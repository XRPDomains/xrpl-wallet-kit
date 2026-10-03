import { getWallets, type Wallets } from "@wallet-standard/app";
import type { Wallet, WalletAccount as StandardAccount } from "@wallet-standard/base";
import type { StandardConnectFeature, StandardDisconnectFeature, StandardEventsFeature } from "@wallet-standard/features";
import { BaseWalletAdapter } from "./adapter";
import { assertWalletRequestActive } from "./request";
import { createWalletError, WalletKitError, WalletKitErrorCode } from "./errors";
import { normalizeSignTransactionResult } from "./result";
import type { WalletManager } from "./manager";
import type { ConnectOptions, SignAndSubmitRequest, SignTransactionRequest, WalletCapabilities, WalletMetadata, WalletNetwork, WalletSession } from "./types";

export const XRPL_STANDARD_SIGN_TRANSACTION = "xrpl:signTransaction";
export const XRPL_STANDARD_SIGN_AND_SUBMIT = "xrpl:signAndSubmitTransaction";

/** XLS-72d / tequdev feature input. Distinct from other chains' signing APIs. */
export interface XrplStandardTransactionInput {
  tx_json: SignTransactionRequest["txJson"];
  account: StandardAccount;
  network: `xrpl:${string}`;
}
export interface XrplStandardSignTransactionFeature {
  version: "1.0.0";
  signTransaction(input: XrplStandardTransactionInput): Promise<{ signed_tx_blob: string }>;
}
export interface XrplStandardSignAndSubmitFeature {
  version: "1.0.0";
  signAndSubmitTransaction(input: XrplStandardTransactionInput): Promise<{ tx_hash: string; tx_json?: unknown }>;
}

const aliases: Record<string, string> = { "xrpl:mainnet": "xrpl:0", "xrpl:testnet": "xrpl:1", "xrpl:devnet": "xrpl:2",
  "xrpl:xahau-mainnet": "xrpl:21337", "xrpl:xahau-testnet": "xrpl:21338" };
function chain(value: string): string { return aliases[value] ?? value; }
function feature<T>(wallet: Wallet, name: string, method: string): T | undefined {
  const value = wallet.features[name as `${string}:${string}`] as { version?: unknown; [key: string]: unknown } | undefined;
  return value?.version === "1.0.0" && typeof value[method] === "function" ? value as T : undefined;
}
function connectFeature(wallet: Wallet) { return feature<StandardConnectFeature["standard:connect"]>(wallet, "standard:connect", "connect"); }
function eventsFeature(wallet: Wallet) { return feature<StandardEventsFeature["standard:events"]>(wallet, "standard:events", "on"); }
function signFeature(wallet: Wallet) { return feature<XrplStandardSignTransactionFeature>(wallet, XRPL_STANDARD_SIGN_TRANSACTION, "signTransaction"); }
function submitFeature(wallet: Wallet) { return feature<XrplStandardSignAndSubmitFeature>(wallet, XRPL_STANDARD_SIGN_AND_SUBMIT, "signAndSubmitTransaction"); }

export function isXrplStandardWallet(value: unknown): value is Wallet {
  try {
    const wallet = value as Wallet;
    return Boolean(wallet && wallet.version === "1.0.0" && typeof wallet.name === "string" && wallet.name.trim() && wallet.name.length <= 100
      && Array.isArray(wallet.chains) && wallet.chains.some(item => typeof item === "string" && /^xrpl:[a-z0-9-]+$/i.test(item))
      && Array.isArray(wallet.accounts) && connectFeature(wallet) && eventsFeature(wallet));
  } catch { return false; }
}

function safeIcon(icon: unknown): string | undefined {
  return typeof icon === "string" && icon.length <= 262144 && /^data:image\/(png|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(icon) ? icon : undefined;
}
function supportsAccount(account: StandardAccount, network: WalletNetwork, method?: string): boolean {
  return Boolean(account && typeof account.address === "string" && account.address && account.publicKey instanceof Uint8Array
    && Array.isArray(account.chains) && account.chains.some(item => chain(item) === chain(network.walletConnectChainId ?? ""))
    && Array.isArray(account.features) && (!method || account.features.includes(method as `${string}:${string}`)));
}

export interface WalletStandardAdapterOptions {
  id: string;
  networks?: readonly WalletNetwork[];
  /** Explicit opt-in only when the app has a trusted, stable identity mapping. */
  allowRestore?: boolean;
  onAccountChanged?: (account: { address: string; publicKey?: string; network: WalletNetwork }) => void;
  onDisconnected?: () => void;
  onChanged?: () => void;
}

export class WalletStandardAdapter extends BaseWalletAdapter {
  readonly metadata: WalletMetadata;
  private selected?: { address: string; network: WalletNetwork };
  private disposed = false;
  private offChange: () => void;
  get capabilities(): WalletCapabilities {
    const sign = Boolean(signFeature(this.wallet));
    const submit = Boolean(submitFeature(this.wallet));
    return { connect: true, disconnect: Boolean(feature(this.wallet, "standard:disconnect", "disconnect")),
      signTransaction: sign, signAndSubmit: submit,
      details: { supportedNetworks: this.options.networks?.filter(network => this.wallet.chains.some(item => chain(item) === chain(network.walletConnectChainId ?? ""))).map(network => network.id),
        transactionModes: [...(sign ? ["sign-only" as const] : []), ...(submit ? ["sign-and-submit" as const] : [])] } };
  }
  constructor(readonly wallet: Wallet, private options: WalletStandardAdapterOptions) {
    super();
    if (!isXrplStandardWallet(wallet) || !/^[a-z0-9][a-z0-9-]*$/.test(options.id)) throw new WalletKitError(WalletKitErrorCode.INVALID_ADAPTER, "Invalid XRPL Standard wallet or adapter ID.");
    this.metadata = Object.freeze({ id: options.id, name: wallet.name, type: "extension", icon: safeIcon(wallet.icon) });
    this.offChange = eventsFeature(wallet)!.on("change", () => this.changed());
  }
  isAvailable(): boolean { return !this.disposed && isXrplStandardWallet(this.wallet); }
  async connect(options: ConnectOptions) {
    const network = this.requireNetwork(options.network);
    return this.withWalletRequest(options, async signal => {
      if (!this.isAvailable()) throw createWalletError.walletNotAvailable(this.metadata.name);
      const result = await connectFeature(this.wallet)!.connect();
      assertWalletRequestActive(signal);
      if (!this.isAvailable()) throw createWalletError.walletNotAvailable(this.metadata.name);
      const authorized = result.accounts.find(account => supportsAccount(account, network));
      const selected = authorized && this.wallet.accounts.find(account => account.address === authorized.address && supportsAccount(account, network));
      if (!selected) throw new WalletKitError(WalletKitErrorCode.NETWORK_MISMATCH, "Wallet has no authorized account on the requested chain.");
      this.selected = { address: selected.address, network };
      return { account: this.toAccount(selected, network) };
    });
  }
  async restoreSession(session: WalletSession) {
    if (!this.options.allowRestore || !this.isAvailable() || !session.account.network) return null;
    const network = this.requireNetwork(session.account.network);
    const account = this.wallet.accounts.find(account => account.address === session.account.address && supportsAccount(account, network));
    if (!account) return null;
    this.selected = { address: account.address, network };
    const restoredAccount = this.toAccount(account, network);
    return { account: restoredAccount, session: { ...session, account: restoredAccount } };
  }
  async disconnect() {
    this.selected = undefined;
    await feature<StandardDisconnectFeature["standard:disconnect"]>(this.wallet, "standard:disconnect", "disconnect")?.disconnect();
  }
  async signTransaction(request: SignTransactionRequest) {
    return this.withWalletRequest(request, async signal => {
      if (request.walletPayload !== undefined) throw new WalletKitError(WalletKitErrorCode.INVALID_REQUEST, "Standard signing accepts txJson only.");
      const signing = signFeature(this.wallet);
      if (!signing) throw createWalletError.unsupportedMethod("signTransaction", this.metadata.name);
      const input = this.input(request.txJson, XRPL_STANDARD_SIGN_TRANSACTION);
      assertWalletRequestActive(signal);
      const result = await signing.signTransaction(input);
      assertWalletRequestActive(signal);
      if (!this.isAvailable()) throw createWalletError.walletNotAvailable(this.metadata.name);
      if (typeof result?.signed_tx_blob !== "string" || !/^(?:[a-f0-9]{2})+$/i.test(result.signed_tx_blob)) {
        throw createWalletError.signFailed(new Error("Standard wallet returned an invalid signed transaction blob."));
      }
      return normalizeSignTransactionResult({ txBlob: result.signed_tx_blob, raw: result });
    });
  }
  async signAndSubmit(request: SignAndSubmitRequest) {
    if (request.submit === false) return { ...await this.signTransaction(request), status: "signed" };
    return this.withWalletRequest(request, async signal => {
      if (request.walletPayload !== undefined) throw new WalletKitError(WalletKitErrorCode.INVALID_REQUEST, "Standard signing accepts txJson only.");
      const submitting = submitFeature(this.wallet);
      if (!submitting) throw createWalletError.unsupportedMethod("signAndSubmit", this.metadata.name);
      const input = this.input(request.txJson, XRPL_STANDARD_SIGN_AND_SUBMIT);
      assertWalletRequestActive(signal);
      const result = await submitting.signAndSubmitTransaction(input);
      assertWalletRequestActive(signal);
      if (!this.isAvailable()) throw createWalletError.walletNotAvailable(this.metadata.name);
      if (typeof result?.tx_hash !== "string" || !result.tx_hash) throw createWalletError.signFailed(new Error("Wallet did not return a transaction hash."));
      return { hash: result.tx_hash, status: "submitted", raw: result };
    });
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.selected = undefined;
    try { this.offChange(); } catch { /* A faulty provider cleanup cannot block disposal of other wallets. */ }
  }
  private requireNetwork(network?: WalletNetwork): WalletNetwork {
    if (!network?.walletConnectChainId?.startsWith("xrpl:") || !this.wallet.chains.some(item => chain(item) === chain(network.walletConnectChainId!))) {
      throw new WalletKitError(WalletKitErrorCode.NETWORK_NOT_SUPPORTED, "Requested network has no supported XRPL chain mapping.");
    }
    return network;
  }
  private toAccount(account: StandardAccount, network: WalletNetwork) {
    const publicKey = Array.from(account.publicKey, byte => byte.toString(16).padStart(2, "0")).join("").toUpperCase();
    return { address: account.address, publicKey: publicKey || undefined, network };
  }
  private input(txJson: SignTransactionRequest["txJson"], method: string): XrplStandardTransactionInput {
    if (!this.isAvailable() || !this.selected) throw createWalletError.notConnected();
    const network = this.requireNetwork(this.selected.network);
    const account = this.wallet.accounts.find(account => account.address === this.selected!.address && supportsAccount(account, network, method));
    if (!account) throw createWalletError.unsupportedMethod(method, this.metadata.name);
    if (txJson.Account !== undefined && txJson.Account !== account.address) throw new WalletKitError(WalletKitErrorCode.INVALID_REQUEST, "Transaction account does not match the selected Standard account.");
    return { tx_json: structuredClone(txJson), account, network: chain(network.walletConnectChainId!) as `xrpl:${string}` };
  }
  private changed(): void {
    if (this.disposed) return;
    if (this.selected) {
      const { network } = this.selected;
      const valid = this.isAvailable() && this.wallet.chains.some(item => chain(item) === chain(network.walletConnectChainId!));
      const accounts = valid ? this.wallet.accounts.filter(account => supportsAccount(account, network)) : [];
      const account = accounts.find(account => account.address === this.selected!.address) ?? accounts[0];
      if (!account) { this.selected = undefined; this.options.onDisconnected?.(); }
      else { this.selected = { address: account.address, network }; this.options.onAccountChanged?.(this.toAccount(account, network)); }
    }
    this.options.onChanged?.();
  }
}

export interface WalletStandardDiscoveryOptions {
  registry?: Pick<Wallets, "get" | "on">;
  /** Return null to exclude a wallet. IDs must be unique and must not shadow existing adapters. */
  resolveId?: (wallet: Wallet) => string | null;
  allowRestore?: boolean;
}
export interface WalletStandardDiscovery { dispose(): void; getAdapters(): readonly WalletStandardAdapter[]; }

/** Opt-in; never prompts, scans fixed globals, or connects on discovery. */
export function startWalletStandardDiscovery(manager: WalletManager, options: WalletStandardDiscoveryOptions = {}): WalletStandardDiscovery {
  if (manager.isDestroyed) throw new WalletKitError(WalletKitErrorCode.REQUEST_CANCELLED, "Wallet manager was destroyed.");
  if (!options.registry && typeof window === "undefined") throw new WalletKitError(WalletKitErrorCode.INVALID_REQUEST, "Start discovery in a browser, or supply a registry.");
  if (options.allowRestore && !options.resolveId) throw new WalletKitError(WalletKitErrorCode.INVALID_REQUEST, "Restoration requires an explicit stable wallet identity mapping.");
  const registry = options.registry ?? getWallets();
  const adapters = new Map<Wallet, WalletStandardAdapter>();
  const ids = new WeakMap<Wallet, string>();
  const scope = globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  let sequence = 0;
  let disposed = false;
  const remove = (wallet: Wallet) => {
    const adapter = adapters.get(wallet);
    if (!adapter) return;
    adapters.delete(wallet);
    adapter.dispose();
    manager.unregister(adapter.metadata.id, adapter);
  };
  const add = (...wallets: Wallet[]) => {
    if (disposed) return;
    for (const wallet of wallets) {
      if (adapters.has(wallet) || !isXrplStandardWallet(wallet)) continue;
      if ([...manager.adapters.values()].some(adapter => adapter instanceof WalletStandardAdapter && adapter.wallet === wallet)) continue;
      try {
        const id = options.resolveId ? options.resolveId(wallet) : ids.get(wallet) ?? `standard-${scope}-${++sequence}`;
        if (!id || manager.getAdapter(id)) continue;
        ids.set(wallet, id);
        let adapter: WalletStandardAdapter | undefined;
        adapter = new WalletStandardAdapter(wallet, { id, networks: manager.networks, allowRestore: options.allowRestore,
          onAccountChanged: account => {
            if (manager.getSession()?.adapterId === id) manager.emitAccountChanged(id, account);
            else manager.emitDisconnected(id);
          }, onDisconnected: () => manager.emitDisconnected(id),
          onChanged: () => { if (adapter && manager.getAdapter(id) === adapter) manager.register(adapter); } });
        adapters.set(wallet, adapter);
        manager.register(adapter);
      } catch (error) { manager.logger.warn("Standard wallet registration failed", error); }
    }
  };
  const offRegister = registry.on("register", add);
  const offUnregister = registry.on("unregister", (...wallets) => wallets.forEach(remove));
  const dispose = (removeAdapters: boolean) => {
    if (disposed) return;
    disposed = true;
    offRegister(); offUnregister(); offDestroy();
    for (const [wallet, adapter] of adapters) {
      if (removeAdapters) remove(wallet);
      else adapter.dispose();
    }
    adapters.clear();
  };
  const offDestroy = manager.on("destroyed", () => dispose(false));
  add(...registry.get());
  return { dispose: () => dispose(true), getAdapters: () => [...adapters.values()] };
}
