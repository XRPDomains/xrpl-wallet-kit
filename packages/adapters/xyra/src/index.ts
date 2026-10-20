import { BaseWalletAdapter, DEFAULT_XRPL_NETWORKS, WalletKitError, WalletKitErrorCode, createWalletError, getProviderHint, isLegacyNetwork, adapterSupportsNetwork, prepareProtocolTransaction } from "@xrpl-wallet-kit/core";
import type { ConnectOptions, SignAndSubmitRequest, SignTransactionRequest, WalletAccount, WalletCapabilities, WalletMetadata, WalletNetwork, WalletChainFilter, WalletProtocolContext } from "@xrpl-wallet-kit/core";
import { deriveAddress } from "ripple-keypairs";
import { decode, encode, hashes, validate, verifySignature, type Transaction } from "xrpl";
import { XyraPopup } from "./popup";

export const XYRA_ICON = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAzMDAgMzAwIj4KICA8ZGVmcz4KICAgIDxsaW5lYXJHcmFkaWVudCBpZD0ieHlyYS1pY29uLWdyYWRpZW50LTEiIHgxPSIwIiB5MT0iMCIgeDI9IjEiIHkyPSIxIiBncmFkaWVudFVuaXRzPSJvYmplY3RCb3VuZGluZ0JveCI+CiAgICAgIDxzdG9wIG9mZnNldD0iMCUiIHN0b3AtY29sb3I9IiM2M2UwZmYiIC8+CiAgICAgIDxzdG9wIG9mZnNldD0iNTAlIiBzdG9wLWNvbG9yPSIjNWE3Y2ZmIiAvPgogICAgICA8c3RvcCBvZmZzZXQ9IjEwMCUiIHN0b3AtY29sb3I9IiNiMjZiZmYiIC8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogICAgPGxpbmVhckdyYWRpZW50IGlkPSJ4eXJhLWljb24tZ3JhZGllbnQtMiIgeDE9IjAiIHkxPSIwIiB4Mj0iMSIgeTI9IjEiIGdyYWRpZW50VW5pdHM9Im9iamVjdEJvdW5kaW5nQm94Ij4KICAgICAgPHN0b3Agb2Zmc2V0PSIwJSIgc3RvcC1jb2xvcj0iIzYzZTBmZiIgLz4KICAgICAgPHN0b3Agb2Zmc2V0PSI1MCUiIHN0b3AtY29sb3I9IiM1YTdjZmYiIC8+CiAgICAgIDxzdG9wIG9mZnNldD0iMTAwJSIgc3RvcC1jb2xvcj0iI2IyNmJmZiIgLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgPC9kZWZzPgogIDxnIHRyYW5zZm9ybT0ibWF0cml4KDEuMzY5ODA2IDAgMCAxLjM2OTgwNiAtNDQ4LjMzMjY0NCAtMTMwLjE5MzgyMikiPgogICAgPGcgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoNDM2LjgwMSAyMDQuNTUpIj4KICAgICAgPGVsbGlwc2Ugcng9IjkwIiByeT0iMzgiIHRyYW5zZm9ybT0ibWF0cml4KDAuODE5MTUyIDAuNTczNTc2IC0wLjU3MzU3NiAwLjgxOTE1MiAwIDApIiBmaWxsPSJub25lIiBzdHJva2U9InVybCgjeHlyYS1pY29uLWdyYWRpZW50LTEpIiBzdHJva2Utd2lkdGg9IjE4IiBzdHJva2UtbGluZWNhcD0icm91bmQiIC8+CiAgICAgIDxlbGxpcHNlIHJ4PSI5MCIgcnk9IjM4IiB0cmFuc2Zvcm09Im1hdHJpeCgwLjgxOTE1MiAtMC41NzM1NzYgMC41NzM1NzYgMC44MTkxNTIgMCAwKSIgb3BhY2l0eT0iMC45NSIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJ1cmwoI3h5cmEtaWNvbi1ncmFkaWVudC0yKSIgc3Ryb2tlLXdpZHRoPSIxOCIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiAvPgogICAgPC9nPgogIDwvZz4KPC9zdmc+Cg==";

export interface XyraAdapterOptions { timeoutMs?: number; maxFeeDrops?: string; supportedChains?: WalletChainFilter; }
interface SignedReply extends Record<string, unknown> { tx_blob: string; hash: string; submitted: boolean; }

function invalid(message: string, cause?: unknown): never {
  throw new WalletKitError(WalletKitErrorCode.INVALID_REQUEST, message, { cause });
}

function resolveNetwork(network?: WalletNetwork): WalletNetwork {
  const standard = DEFAULT_XRPL_NETWORKS.find(item => item.id === (network?.id ?? "mainnet"));
  if (!standard || !["mainnet", "testnet"].includes(standard.id) || (network &&
    ((network.family ?? "xrpl") !== "xrpl" || network.networkType !== standard.networkType || network.rpcUrl !== standard.rpcUrl ||
      (network.httpRpcUrl !== undefined && network.httpRpcUrl !== standard.httpRpcUrl) || network.networkId !== undefined || network.definitionsUrl !== undefined))) {
    throw createWalletError.networkNotSupported("Xyra", network?.id);
  }
  return { ...standard };
}

const selector = (network: WalletNetwork) => getProviderHint(network, "xyra");
function resolveAccount(reply: Record<string, unknown>, network: WalletNetwork): WalletAccount {
  if (reply.network !== selector(network) || typeof reply.address !== "string" ||
    typeof reply.publicKey !== "string" || !/^(ED|02|03)[0-9a-f]{64}$/i.test(reply.publicKey)) invalid("Malformed Xyra account or network reply.");
  const publicKey = reply.publicKey.toUpperCase();
  try { if (deriveAddress(publicKey) !== reply.address) invalid("Xyra address does not match its public key."); }
  catch (cause) { invalid("Invalid Xyra public key or address.", cause); }
  return { address: reply.address, publicKey, network, networkType: network.networkType };
}

function encodePayload(value: unknown): string {
  // Escape Unicode for wallet versions using JSON.parse(atob(payload)).
  const json = JSON.stringify(value).replace(/[^\x20-\x7e]/g, character => `\\u${character.charCodeAt(0).toString(16).padStart(4, "0")}`);
  return btoa(json);
}

export class XyraAdapter extends BaseWalletAdapter {
  metadata: WalletMetadata = { id: "xyra", name: "Xyra", type: "web", group: "Web wallets", homepage: "https://www.xyra.now/", icon: XYRA_ICON };
  capabilities: WalletCapabilities = { connect: true, disconnect: true, signMessage: false, signTransaction: true, signAndSubmit: true,
    payments: false, nftOffers: false, details: { supportedNetworks: ["mainnet", "testnet"], transactionModes: ["sign-only", "sign-and-submit"] } };
  private readonly popup = new XyraPopup();
  private account?: WalletAccount;
  private generation = 0;
  private readonly maxFee: bigint;
  private protocolContext?: WalletProtocolContext;
  private protocolSigning = false;
  private protocolWindow?: Window;

  constructor(private readonly options: XyraAdapterOptions = {}) {
    super();
    const maxFee = options.maxFeeDrops ?? "1000000";
    if (!/^[1-9]\d{0,17}$/.test(maxFee)) invalid("Xyra maxFeeDrops must be a positive drops string (at most 18 digits).");
    this.maxFee = BigInt(maxFee);
    if (options.supportedChains) {
      this.adapterApiVersion = "1.2";
      this.capabilities.details = { ...this.capabilities.details, supportedNetworks: undefined, supportedChains: structuredClone(options.supportedChains) };
    }
  }
  isAvailable() { return typeof window !== "undefined" && typeof window.open === "function" && Boolean(globalThis.crypto?.getRandomValues); }

  async connect(options: ConnectOptions = {}) {
    if (this.popup.pending || this.protocolSigning) invalid("A Xyra popup request is already pending.");
    const external = options.network && !isLegacyNetwork(options.network);
    if (external && !options.protocolContext) throw createWalletError.networkNotSupported("Xyra (runtime required)", options.network!.id);
    const context = external ? options.protocolContext : undefined;
    const network = context ? { ...context.network } : resolveNetwork(options.network);
    selector(network);
    if (!adapterSupportsNetwork(this, network)) throw createWalletError.networkNotSupported("Xyra", network.id);
    const generation = ++this.generation;
    this.account = undefined;
    const raw = await this.popup.request("connect", { network: selector(network) }, { ...options, timeoutMs: options.timeoutMs ?? this.options.timeoutMs });
    if (generation !== this.generation || options.signal?.aborted) throw new WalletKitError(WalletKitErrorCode.REQUEST_CANCELLED, "Xyra connection cancelled.");
    this.account = resolveAccount(raw, network);
    this.protocolContext = context;
    return { account: structuredClone(this.account), raw };
  }
  cancelPendingConnection() { this.generation++; this.popup.cancel(); try { this.protocolWindow?.close(); } catch { /* Popup may have severed access. */ } }
  async disconnect() { this.cancelPendingConnection(); this.account = undefined; this.protocolContext = undefined; await super.disconnect(); }
  // No passive provider session signal exists; reconnect must be explicitly approved.

  async signTransaction(request: SignTransactionRequest) {
    const raw = await this.sign(request, false);
    return { txBlob: raw.tx_blob, signed: true, raw };
  }
  async signAndSubmit(request: SignAndSubmitRequest) {
    const context = this.protocolContext;
    if (context && request.submit !== false) {
      const raw = await this.sign(request, false);
      if (context !== this.protocolContext || request.signal?.aborted) throw createWalletError.notConnected();
      return context.protocol.submit(raw.tx_blob, context.network, request);
    }
    if (request.submit === false) {
      const raw = await this.sign(request, false);
      return { hash: raw.hash, txBlob: raw.tx_blob, signed: true, status: "signed", raw };
    }
    const raw = await this.sign(request, true);
    const outcome = raw.submitResult as { validated?: boolean; engine_result?: string; ledger_index?: number } | undefined;
    if (raw.submitted === true && outcome?.validated === true && outcome.engine_result === "tesSUCCESS" &&
      Number.isInteger(outcome.ledger_index) && outcome.ledger_index! > 0) {
      return { hash: raw.hash, txBlob: raw.tx_blob, signed: true, status: "confirmed", raw };
    }
    if (raw.submitted === true && ["tesSUCCESS", "terQUEUED"].includes(outcome?.engine_result ?? "")) {
      return { hash: raw.hash, txBlob: raw.tx_blob, signed: true, status: "submitted", raw };
    }
    const outcomeUnknown = raw.submitted !== false;
    throw new WalletKitError(WalletKitErrorCode.SUBMIT_FAILED, outcomeUnknown
      ? `Xyra submission outcome is unknown. Inspect transaction ${raw.hash} before retrying.`
      : "Xyra signed the transaction but did not submit it.", {
      details: { hash: raw.hash, transaction: raw, submitted: raw.submitted, outcomeUnknown }
    });
  }

  private async sign(request: SignTransactionRequest, submit: boolean): Promise<SignedReply> {
    const account = this.account && structuredClone(this.account);
    if (!account?.network || !account.publicKey) throw createWalletError.notConnected();
    const generation = this.generation;
    const context = this.protocolContext;
    if (context) {
      if (this.protocolSigning || this.popup.pending) invalid("A Xyra signing request is already pending.");
      // Before adapter RPC only: manager preflight may already consume activation (Safari/iOS live gate).
      const reserved = typeof window !== "undefined" ? window.open("about:blank", `xyra-${crypto.randomUUID()}`, "popup=yes,width=480,height=760,resizable=yes,scrollbars=yes") : null;
      if (!reserved) throw createWalletError.walletNotAvailable("Xyra", new Error("Allow popups for this dApp"));
      this.protocolSigning = true;
      this.protocolWindow = reserved;
      const abort = () => { try { reserved.close(); } catch { /* Best-effort local cancellation. */ } };
      request.signal?.addEventListener("abort", abort, { once: true });
      try {
        const tx = await prepareProtocolTransaction(context, request, account);
        if (generation !== this.generation || request.signal?.aborted) throw createWalletError.notConnected();
        const raw = await this.popup.request("sign", { network: selector(context.network), tx: encodePayload(tx) }, request, reserved);
        if (generation !== this.generation || request.signal?.aborted || raw.network !== selector(context.network) || raw.submitted !== false || raw.submitResult !== undefined || typeof raw.tx_blob !== "string" || typeof raw.hash !== "string") invalid("Invalid Xyra sign-only network/result");
        const verified = context.protocol.verify(raw.tx_blob, tx, account, context.network, request);
        if (verified.hash !== raw.hash.toUpperCase()) invalid("Xyra transaction hash mismatch");
        await context.protocol.prepare(tx, account, context.network, request);
        if (generation !== this.generation || request.signal?.aborted) throw createWalletError.notConnected();
        return { ...raw, tx_blob: verified.txBlob, hash: verified.hash, submitted: false };
      } finally {
        request.signal?.removeEventListener("abort", abort);
        this.protocolSigning = false; this.protocolWindow = undefined;
        try { reserved.close(); } catch { /* Cross-origin popup may already be closed. */ }
      }
    }
    const tx = structuredClone(request.txJson) as Record<string, unknown>;
    if (tx.Account !== undefined && tx.Account !== account.address) invalid("Xyra transaction Account differs from connected account.");
    if (["Signers", "TxnSignature", "SigningPubKey"].some(field => field in tx)) invalid("Xyra expects an unsigned single-sign transaction.");
    tx.Account = account.address;
    try {
      validate(tx);
      const canonical = decode(encode(tx as unknown as Transaction));
      if (Object.keys(tx).some(field => !(field in canonical))) invalid("Xyra request contains unsupported non-signing fields.");
      if (tx.Fee !== undefined && (typeof tx.Fee !== "string" || !/^[1-9]\d{0,17}$/.test(tx.Fee) || BigInt(tx.Fee) > this.maxFee)) invalid("Xyra requested fee exceeds maxFeeDrops or is invalid.");
    } catch (cause) { invalid("Invalid Xyra transaction request.", cause); }
    const raw = await this.popup.request("sign", {
      network: selector(account.network), tx: encodePayload(tx), ...(submit ? { submit: "true" } : {})
    }, { ...request, timeoutMs: request.timeoutMs ?? this.options.timeoutMs });
    try {
      if (generation !== this.generation || request.signal?.aborted) throw new WalletKitError(WalletKitErrorCode.REQUEST_CANCELLED, "Xyra signing cancelled.");
      if (raw.network !== selector(account.network) || typeof raw.tx_blob !== "string" || !/^(?:[0-9a-f]{2})+$/i.test(raw.tx_blob) ||
        typeof raw.hash !== "string" || !/^[0-9a-f]{64}$/i.test(raw.hash) || typeof raw.submitted !== "boolean") invalid("Malformed Xyra signed reply.");
      const signed = decode(raw.tx_blob) as Record<string, unknown>;
      validate(signed);
      if (signed.Account !== account.address || signed.SigningPubKey !== account.publicKey || "Signers" in signed ||
        hashes.hashSignedTx(raw.tx_blob) !== raw.hash.toUpperCase() || !verifySignature(raw.tx_blob)) invalid("Invalid Xyra signer, signature or hash.");
      if (typeof signed.Fee !== "string" || !/^[1-9]\d{0,17}$/.test(signed.Fee) || BigInt(signed.Fee) > this.maxFee ||
        !Number.isInteger(signed.Sequence) || (signed.Sequence as number) < 0 || (signed.Sequence as number) > 0xffffffff ||
        !Number.isInteger(signed.LastLedgerSequence) || (signed.LastLedgerSequence as number) <= 0 || (signed.LastLedgerSequence as number) > 0xffffffff) invalid("Xyra reply has invalid or unbounded autofill fields.");
      delete signed.SigningPubKey; delete signed.TxnSignature;
      for (const field of ["Sequence", "Fee", "LastLedgerSequence"]) if (!(field in tx)) delete signed[field];
      if (encode(signed as unknown as Transaction) !== encode(tx as unknown as Transaction)) invalid("Xyra signed transaction changes requested fields.");
      if (!submit && (raw.submitted !== false || raw.submitResult !== undefined)) invalid("Xyra sign-only reply unexpectedly reports submission.");
      return raw as SignedReply;
    } catch (cause) {
      if (submit || raw.submitted === true) throw new WalletKitError(WalletKitErrorCode.SIGN_FAILED, "Xyra reply failed verification; submission outcome may be unknown. Inspect the ledger before retrying.", {
        cause, details: { outcomeUnknown: true, raw, providerHash: typeof raw.hash === "string" && /^[0-9a-f]{64}$/i.test(raw.hash) ? raw.hash : undefined }
      });
      invalid("Xyra signed reply failed verification.", cause);
    }
  }
}

export function createXyraAdapter(options?: XyraAdapterOptions) { return new XyraAdapter(options); }
