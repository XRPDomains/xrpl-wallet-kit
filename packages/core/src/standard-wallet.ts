import type { Wallet, WalletAccount as StandardAccount } from "@wallet-standard/base";
import type { StandardEventsListeners } from "@wallet-standard/features";
import { assertWalletAdapter } from "./adapter";
import { createWalletError, WalletKitError, WalletKitErrorCode } from "./errors";
import { normalizeSignTransactionResult, normalizeTxResult } from "./result";
import { XRPL_STANDARD_SIGN_TRANSACTION as SIGN, XRPL_STANDARD_SIGN_AND_SUBMIT as SUBMIT, type XrplStandardTransactionInput } from "./discovery";
import type { WalletAccount, WalletAdapter, WalletNetwork } from "./types";

export interface LegacyStandardWalletOptions {
  /** Networks actually supported by this provider, not merely by the app. */
  networks: readonly WalletNetwork[];
  icon: Wallet["icon"];
}

export interface LegacyStandardWallet extends Wallet {
  /** Relay authorized account changes/revocation from the legacy provider's event API. */
  updateAccount(account: WalletAccount | null): void;
}

/** App/wallet-side wrapper for an existing injected provider adapter; no global mutation. */
export function createWalletStandardWallet(adapter: WalletAdapter, options: LegacyStandardWalletOptions): LegacyStandardWallet {
  assertWalletAdapter(adapter);
  if (!options.networks.length || options.networks.some(network => !/^xrpl:[0-9]+$/.test(network.walletConnectChainId ?? ""))) {
    throw new WalletKitError(WalletKitErrorCode.INVALID_REQUEST, "Legacy wrapper requires explicit XRPL chain mappings.");
  }
  const networks = options.networks.map(network => ({ ...network }));
  const canSign = Boolean(adapter.capabilities.signTransaction && adapter.signTransaction)
    || Boolean(adapter.signAndSubmit && adapter.capabilities.details?.transactionModes?.includes("sign-only"));
  const canSubmit = Boolean(adapter.capabilities.signAndSubmit && adapter.signAndSubmit);
  const accountFeatures = Object.freeze([...(canSign ? [SIGN] : []), ...(canSubmit ? [SUBMIT] : [])]) as readonly `${string}:${string}`[];
  const listeners = new Set<StandardEventsListeners["change"]>();
  let accounts: readonly StandardAccount[] = [];
  let selectedNetwork: WalletNetwork | undefined;
  let epoch = 0;
  const changed = () => listeners.forEach(listener => { try { listener({ accounts }); } catch { /* Isolate application observers. */ } });
  const updateAccount = (account: WalletAccount | null) => {
    epoch++;
    const network = account ? networks.find(network => network.id === (account.network?.id ?? selectedNetwork?.id)) : undefined;
    if (!account || !network) { accounts = []; selectedNetwork = undefined; changed(); return; }
    const hex = account.publicKey;
    const publicKey = hex && /^(?:[a-f0-9]{2})+$/i.test(hex) ? Uint8Array.from(hex.match(/../g)!, byte => parseInt(byte, 16)) : new Uint8Array();
    accounts = Object.freeze([Object.freeze({ address: account.address, publicKey, chains: Object.freeze([network.walletConnectChainId!] as `${string}:${string}`[]), features: accountFeatures })]);
    selectedNetwork = network;
    changed();
  };
  const assertEpoch = (expected: number) => {
    if (epoch !== expected) throw new WalletKitError(WalletKitErrorCode.REQUEST_CANCELLED, "Legacy wallet authorization changed during the request.");
  };
  const input = (request: XrplStandardTransactionInput, method: string) => {
    if (!selectedNetwork || request.account !== accounts[0] || request.network !== selectedNetwork.walletConnectChainId || !request.account.features.includes(method as `${string}:${string}`)) {
      throw new WalletKitError(WalletKitErrorCode.INVALID_REQUEST, "Account/network is not authorized by this legacy wallet wrapper.");
    }
    if (request.tx_json.Account !== undefined && request.tx_json.Account !== request.account.address) {
      throw new WalletKitError(WalletKitErrorCode.INVALID_REQUEST, "Transaction account differs from the authorized account.");
    }
    return { txJson: structuredClone(request.tx_json) };
  };
  const features: Record<string, unknown> = {
    "standard:connect": { version: "1.0.0", connect: async (request?: { silent?: boolean }) => {
      // Never trust an old injected provider to interpret a silent authorization flag.
      if (request?.silent) return { accounts };
      const network = networks[0];
      const expected = ++epoch;
      const result = await adapter.connect({ network });
      assertEpoch(expected);
      if (!result.account?.address || (result.account.network && result.account.network.id !== network.id)) throw createWalletError.networkMismatch(adapter.metadata.name, network.id, result.account.network?.id ?? "unknown");
      const reportedType = result.account.networkType ?? result.account.network?.networkType;
      if (reportedType && reportedType.toUpperCase() !== network.networkType) throw createWalletError.networkMismatch(adapter.metadata.name, network.networkType, reportedType);
      updateAccount({ ...result.account, network });
      return { accounts };
    } },
    "standard:events": { version: "1.0.0", on: (event: string, listener: StandardEventsListeners["change"]) => {
      if (event !== "change") throw new WalletKitError(WalletKitErrorCode.INVALID_REQUEST, "Unknown Standard wallet event.");
      listeners.add(listener); return () => { listeners.delete(listener); };
    } },
    "standard:disconnect": { version: "1.0.0", disconnect: async () => {
      updateAccount(null);
      await adapter.disconnect?.();
    } }
  };
  if (canSign) features[SIGN] = { version: "1.0.0", signTransaction: async (request: XrplStandardTransactionInput) => {
    const controlled = input(request, SIGN);
    const expected = epoch;
    const raw = adapter.capabilities.signTransaction && adapter.signTransaction ? await adapter.signTransaction(controlled) : await adapter.signAndSubmit!({ ...controlled, submit: false });
    assertEpoch(expected);
    const blob = normalizeSignTransactionResult(raw).txBlob;
    if (!blob || !/^(?:[a-f0-9]{2})+$/i.test(blob)) throw createWalletError.signFailed(new Error("Legacy provider did not return a signed transaction hex blob."));
    return { signed_tx_blob: blob };
  } };
  if (canSubmit) features[SUBMIT] = { version: "1.0.0", signAndSubmitTransaction: async (request: XrplStandardTransactionInput) => {
    const controlled = input(request, SUBMIT);
    const expected = epoch;
    const result = normalizeTxResult(await adapter.signAndSubmit!(controlled));
    assertEpoch(expected);
    if (!result.hash) throw createWalletError.signFailed(new Error("Legacy provider did not return a transaction hash."));
    return { tx_hash: result.hash, tx_json: result.raw };
  } };
  return Object.freeze({ version: "1.0.0", name: adapter.metadata.name, icon: options.icon,
    chains: Object.freeze(networks.map(network => network.walletConnectChainId as `${string}:${string}`)),
    features: Object.freeze(features), updateAccount, get accounts() { return accounts; } });
}
