import type { PrivyAdapter as UpstreamPrivyAdapter, PrivyAdapterOptions } from "@xrpl-commons/xrpl-connect-privy";
import { BaseWalletAdapter, createWalletError, getNetworkFamily, WalletKitError, WalletKitErrorCode } from "@xrpl-wallet-kit/core";
import type { ConnectOptions, SignAndSubmitRequest, SignTransactionRequest, WalletCapabilities, WalletInteraction, WalletNetwork, WalletSession } from "@xrpl-wallet-kit/core";
import { PRIVY_ICON } from "./icon";

type PrivyTransaction = Parameters<UpstreamPrivyAdapter["sign"]>[0];
type PrivyProvider = Pick<UpstreamPrivyAdapter, "on" | "onAuthPrompt" | "getLoginMethods" | "connect" |
  "disconnect" | "serializeReconnectOptions" | "hasPendingConnection" | "sign" | "signAndSubmit">;
type LoadProvider = (options: PrivyAdapterOptions) => Promise<PrivyProvider>;

const loadPrivyProvider: LoadProvider = async options => {
  const { PrivyAdapter: Provider } = await import("@xrpl-commons/xrpl-connect-privy");
  return new Provider(options);
};

export type CreatePrivyAdapterOptions = Pick<PrivyAdapterOptions, "appId" | "clientId" | "redirectUri"> & {
  onDisconnected?: () => void;
};

function resolveNetwork(network?: WalletNetwork) {
  if (!network || getNetworkFamily(network) !== "xrpl" ||
      !((network.id === "mainnet" && network.networkType === "MAINNET" && (network.networkId ?? 0) === 0) ||
        (network.id === "testnet" && network.networkType === "TESTNET" && (network.networkId ?? 1) === 1))) {
    throw createWalletError.networkNotSupported("Privy", network?.id);
  }
  return { id: network.id, name: network.name, wss: network.rpcUrl, rpc: network.httpRpcUrl };
}

function loginIcon(url?: string) {
  const prefix = "data:image/svg+xml,";
  if (!url?.startsWith(prefix)) return url;
  const svg = new TextEncoder().encode(decodeURIComponent(url.slice(prefix.length)));
  return "data:image/svg+xml;base64," + btoa(Array.from(svg, byte => String.fromCharCode(byte)).join(""));
}

function rejected() {
  return new WalletKitError(WalletKitErrorCode.REQUEST_CANCELLED, "Privy interaction cancelled.");
}

export class PrivyAdapter extends BaseWalletAdapter {
  readonly metadata;
  readonly capabilities: WalletCapabilities = {
    connect: true, disconnect: true, signTransaction: true, signAndSubmit: true, signMessage: false,
    details: {
      supportedChains: { families: ["xrpl"], networkIds: ["mainnet", "testnet"] },
      transactionModes: ["sign-only", "sign-and-submit"]
    }
  };
  readonly restoreSessionTimeoutMs = 30_000;
  private provider?: Promise<PrivyProvider>;
  private readonly listeners = new Set<(prompt: WalletInteraction | null) => void>();
  private cancel?: () => void;
  private connection?: AbortController;
  private signing?: { request: SignTransactionRequest; promptError?: WalletKitError };
  private teardown?: Promise<void>;
  private connectionPromptError?: WalletKitError;

  constructor(private readonly options: CreatePrivyAdapterOptions, private readonly loadProvider = loadPrivyProvider) {
    super();
    let redirect: URL;
    try { redirect = new URL(options.redirectUri); } catch { throw this.invalidConfiguration(); }
    if (!options.appId.trim() || redirect.username || redirect.password ||
        !["http:", "https:"].includes(redirect.protocol) ||
        (typeof window !== "undefined" && redirect.origin !== window.location.origin)) {
      throw this.invalidConfiguration();
    }
    this.metadata = { id: "privy", name: "Privy", type: "embedded" as const, icon: PRIVY_ICON, homepage: "https://privy.io" };
  }

  private invalidConfiguration() {
    return new WalletKitError(WalletKitErrorCode.INVALID_REQUEST, "Privy requires a public App ID and an absolute same-origin callback URL.");
  }

  private getProvider() {
    this.provider ??= this.loadProvider(this.options).then(provider => {
      if (this.options.onDisconnected) provider.on("disconnect", this.options.onDisconnected);
      provider.onAuthPrompt(prompt => this.handlePrompt(prompt));
      return provider;
    }).catch(error => {
      this.provider = undefined;
      throw error;
    });
    return this.provider;
  }

  private handlePrompt(prompt: Parameters<Parameters<PrivyProvider["onAuthPrompt"]>[0]>[0]) {
    if (!prompt) {
      this.publish(null);
      return;
    }
    if (!this.listeners.size || prompt.captcha || !prompt.submit) {
      const error = new WalletKitError(WalletKitErrorCode.UNSUPPORTED_METHOD, prompt.captcha
        ? "This Privy app requires CAPTCHA. The Kit does not render that challenge."
        : "Privy requires an active Kit modal or an interaction handler.");
      if (this.signing) this.signing.promptError = error;
      else this.connectionPromptError = error;
      prompt.cancel();
      return;
    }
    const cap = this.signing?.request.maxFeeDrops;
    if (prompt.review && cap !== undefined) {
      const fee = prompt.review.transaction.Fee;
      if (!fee || !/^\d+$/.test(fee) || BigInt(fee) > BigInt(cap)) {
        this.signing!.promptError = new WalletKitError(WalletKitErrorCode.PREFLIGHT_FAILED, "Privy transaction fee exceeds the configured limit.");
        prompt.cancel();
        return;
      }
    }
    this.publish({
      kind: prompt.review ? "review" : prompt.fields?.some(field => field.autocomplete === "one-time-code") ? "code" : "email",
      title: prompt.title, description: prompt.description, fields: prompt.fields,
      submitLabel: prompt.submitLabel, submit: prompt.submit,
      secondaryAction: prompt.secondaryAction,
      details: prompt.review?.details,
      cancel: prompt.cancel
    });
  }

  isAvailable() { return typeof window !== "undefined" && typeof document !== "undefined"; }
  onInteraction(listener: (prompt: WalletInteraction | null) => void) {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  private publish(prompt: WalletInteraction | null) {
    this.cancel = prompt?.cancel;
    this.listeners.forEach(listener => listener(prompt));
  }

  private choose(methods: readonly { id: string; label: string; icon?: string }[]) {
    if (!this.listeners.size || !methods.length) throw new WalletKitError(WalletKitErrorCode.INVALID_REQUEST, "No supported Privy sign-in method is available.");
    return new Promise<string>((resolve, reject) => {
      let settled = false;
      const complete = (action: () => void) => {
        if (settled) return;
        settled = true;
        this.publish(null);
        action();
      };
      this.publish({
        kind: "method", title: this.metadata.name,
        choices: methods.map(method => ({ ...method, icon: loginIcon(method.icon), select: () => complete(() => resolve(method.id)) })),
        cancel: () => complete(() => reject(rejected()))
      });
    });
  }

  async connect(options: ConnectOptions) {
    resolveNetwork(options.network);
    return this.runConnection(options, async signal => {
      const provider = await this.getProvider();
      if (signal.aborted) throw rejected();
      const available = await provider.getLoginMethods({ signal });
      if (signal.aborted) throw rejected();
      const methods = available.filter(method => ["email", "google", "twitter", "x"].includes(method.id));
      const loginMethod = methods.length === 1 && methods[0].id === "email" ? "email" : await this.choose(methods);
      if (signal.aborted) throw rejected();
      return this.open(options, { loginMethod });
    });
  }

  private async runConnection<T>(options: ConnectOptions, operation: (signal: AbortSignal) => Promise<T>) {
    if (options.signal?.aborted) throw rejected();
    if (this.connection) throw new WalletKitError(WalletKitErrorCode.ALREADY_CONNECTED, "A Privy connection is already pending.");
    const controller = new AbortController();
    this.connection = controller;
    const cancel = () => { void this.cancelPendingConnection().catch(() => undefined); };
    options.signal?.addEventListener("abort", cancel, { once: true });
    try {
      await this.teardown;
      if (controller.signal.aborted) throw rejected();
      const result = await operation(controller.signal);
      if (controller.signal.aborted) throw rejected();
      return result;
    } catch (error) {
      throw this.connectionPromptError ?? error;
    } finally {
      this.connectionPromptError = undefined;
      options.signal?.removeEventListener("abort", cancel);
      if (this.connection === controller) this.connection = undefined;
    }
  }
  private async open(options: ConnectOptions, identity: { loginMethod?: string; privyWalletId?: string; privyUserId?: string } = {}, autoReconnect = false) {
    const network = resolveNetwork(options.network);
    const provider = await this.getProvider();
    if (options.signal?.aborted || this.connection?.signal.aborted) throw rejected();
    const account = await provider.connect({ network, ...identity, autoReconnect });
    if (options.signal?.aborted || this.connection?.signal.aborted) throw rejected();
    if (account.network.id !== network.id || !account.publicKey) {
      await this.disconnect();
      throw createWalletError.networkNotSupported("Privy", network.id);
    }
    const connected = { address: account.address, publicKey: account.publicKey, network: options.network };
    return {
      account: connected,
      session: { adapterId: "privy", account: connected, connectedAt: Date.now(), metadata: provider.serializeReconnectOptions() }
    };
  }

  async restoreSession(session: WalletSession, options?: ConnectOptions) {
    const { privyWalletId, privyUserId } = session.metadata ?? {};
    if (!options || typeof privyWalletId !== "string" || typeof privyUserId !== "string") return null;
    const result = await this.runConnection(options, () => this.open(options, { privyWalletId, privyUserId }, true));
    if (result.account.address === session.account.address) return result;
    await this.disconnect();
    return null;
  }

  async canRecoverSession() {
    if (typeof window === "undefined" || window.location.pathname !== new URL(this.options.redirectUri).pathname) return false;
    return (await this.getProvider()).hasPendingConnection();
  }
  async recoverSession(options: ConnectOptions) { return this.runConnection(options, () => this.open(options)); }

  async cancelPendingConnection() {
    if (this.connection) await this.disconnect();
  }

  disconnect(): Promise<void> {
    this.connection?.abort();
    this.cancel?.();
    this.publish(null);
    if (!this.teardown && this.provider) {
      this.teardown = this.provider.then(provider => provider.disconnect()).finally(() => { this.teardown = undefined; });
    }
    return this.teardown ?? Promise.resolve();
  }
  private async runSigning<T>(request: SignTransactionRequest, operation: () => Promise<T>) {
    if (request.signal?.aborted) throw rejected();
    if (this.signing) throw new WalletKitError(WalletKitErrorCode.INVALID_REQUEST, "Another Privy signature is pending.");
    if (request.maxFeeDrops !== undefined && !/^[1-9]\d{0,17}$/.test(request.maxFeeDrops)) {
      throw new WalletKitError(WalletKitErrorCode.INVALID_REQUEST, "Invalid maximum transaction fee.");
    }
    const signing: NonNullable<PrivyAdapter["signing"]> = { request };
    this.signing = signing;
    const abort = () => { void this.disconnect().catch(() => undefined); };
    request.signal?.addEventListener("abort", abort, { once: true });
    try {
      const result = await operation();
      if (request.signal?.aborted) throw rejected();
      return result;
    } catch (error) {
      throw signing.promptError ?? error;
    } finally {
      request.signal?.removeEventListener("abort", abort);
      this.signing = undefined;
    }
  }

  async signTransaction(request: SignTransactionRequest) {
    return this.runSigning(request, async () => {
      const signed = await (await this.getProvider()).sign(request.txJson as PrivyTransaction);
      return { txBlob: signed.tx_blob, signed: true };
    });
  }

  async signAndSubmit(request: SignAndSubmitRequest) {
    if (request.submit === false) {
      const signed = await this.signTransaction(request);
      return { signed: signed.signed, raw: { txBlob: signed.txBlob } };
    }
    return this.runSigning(request, async () => {
      const submitted = await (await this.getProvider()).signAndSubmit(request.txJson as PrivyTransaction);
      const { hash, transactionResult } = submitted;
      const status = transactionResult === "tesSUCCESS" ? "confirmed" : transactionResult ? "failed" : "submitted";
      return { hash, status, signed: true, raw: { transactionResult } };
    });
  }
}

export function createPrivyAdapter(options: CreatePrivyAdapterOptions) { return new PrivyAdapter(options); }
