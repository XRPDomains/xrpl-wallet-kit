import { ClaspError } from "clasp-connect";
import { BaseWalletAdapter, createWalletError, getNetworkFamily, WalletKitError, WalletKitErrorCode } from "@xrpl-wallet-kit/core";
import type { ConnectOptions, SignAndSubmitRequest, SignTransactionRequest, WalletAccount, WalletCapabilities, WalletMetadata, WalletNetwork, WalletRequestOptions } from "@xrpl-wallet-kit/core";
import { deriveAddress } from "ripple-keypairs";
import { decode, encode, hashes, isValidClassicAddress, validate, verifySignature, type Transaction } from "xrpl";
import { CLASP_ICON } from "./icon";
import { createClaspClient, type ClaspClient } from "./client";

const origin = "https://claspwallet.com";
const hashPattern = /^[a-f0-9]{64}$/i;
const autofill = ["Fee", "Sequence", "LastLedgerSequence"];

export interface ClaspAdapterOptions {
  maxFeeDrops?: string;
  /** Optional custom client; implement cancelPendingRequest to release its underlying requests. */
  client?: ClaspClient;
}

function invalid(message: string, details: Record<string, unknown> = {}): never {
  throw new WalletKitError(WalletKitErrorCode.INVALID_REQUEST, message, { details: { ...details, outcomeUnknown: false } });
}

function fee(value: unknown): bigint {
  if (typeof value !== "string" || !/^[1-9]\d{0,17}$/.test(value)) invalid("Clasp requires a positive fee in drops.");
  return BigInt(value);
}

function networkFor(network?: WalletNetwork): "mainnet" | "testnet" {
  if (network && getNetworkFamily(network) === "xrpl") {
    if (network.id === "mainnet" && network.networkType === "MAINNET" && (network.networkId ?? 0) === 0) return "mainnet";
    if (network.id === "testnet" && network.networkType === "TESTNET" && (network.networkId ?? 1) === 1) return "testnet";
  }
  throw createWalletError.networkNotSupported("Clasp", network?.id);
}

export class ClaspAdapter extends BaseWalletAdapter {
  override adapterApiVersion = "1.2" as const;
  metadata: WalletMetadata = { id: "clasp", name: "Clasp", type: "web", group: "Web wallets", homepage: origin, icon: CLASP_ICON };
  capabilities: WalletCapabilities = {
    connect: true, disconnect: true, signTransaction: true, signAndSubmit: true,
    details: { supportedChains: { families: ["xrpl"], networkIds: ["mainnet", "testnet"] }, transactionModes: ["sign-only", "sign-and-submit"] }
  };
  private client?: ClaspClient;
  private account?: WalletAccount;
  private pending?: AbortController;

  constructor(private readonly options: ClaspAdapterOptions = {}) {
    super();
    if (options.maxFeeDrops !== undefined) fee(options.maxFeeDrops);
  }

  isAvailable(): boolean { return typeof window !== "undefined" && typeof window.open === "function"; }

  async connect(options: ConnectOptions) {
    const network = networkFor(options.network);
    return this.run(options, "connect", async (client, signal) => {
      const result = await client.connect({ network });
      this.assertActive(signal);
      if (result.network !== network || !isValidClassicAddress(result.address) ||
        typeof result.publicKey !== "string" || deriveAddress(result.publicKey) !== result.address) {
        invalid("Clasp returned an invalid account or network.");
      }
      this.account = { address: result.address, publicKey: result.publicKey.toUpperCase(), network: options.network };
      return { account: this.account, raw: result };
    });
  }

  cancelPendingConnection(): void { this.pending?.abort(); }

  async disconnect(): Promise<void> {
    this.account = undefined;
    this.cancelPendingConnection();
  }

  async signTransaction(request: SignTransactionRequest) {
    const { tx, network, account, cap } = this.prepare(request);
    return this.run(request, "sign", async (client, signal) => {
      const result = await client.sign({ network, address: account.address, tx });
      this.assertActive(signal);
      let verificationStage = "response";
      try {
        if (typeof result.tx_blob !== "string" || result.tx_blob.length > 262144 || !/^(?:[a-f0-9]{2})+$/i.test(result.tx_blob) ||
          typeof result.hash !== "string" || !hashPattern.test(result.hash)) invalid("Clasp did not return a signed transaction.");
        verificationStage = "decode";
        const signed = decode(result.tx_blob) as Record<string, unknown>;
        verificationStage = "validation";
        validate(signed);
        verificationStage = "signer";
        if (signed.Account !== account.address || signed.SigningPubKey !== account.publicKey || "Signers" in signed) {
          invalid("Clasp signer differs from the connected account.");
        }
        verificationStage = "signature";
        if (!verifySignature(result.tx_blob)) invalid("Invalid Clasp signature.");
        verificationStage = "hash";
        if (hashes.hashSignedTx(result.tx_blob) !== result.hash.toUpperCase()) invalid("Clasp hash does not match the signed blob.");
        verificationStage = "autofill";
        if (fee(signed.Fee) > cap) invalid("Clasp fee exceeds the ceiling.", { field: "Fee" });
        if (!Number.isInteger(signed.LastLedgerSequence) || Number(signed.LastLedgerSequence) <= 0) {
          invalid("Invalid Clasp expiry.", { field: "LastLedgerSequence" });
        }
        if (!Number.isInteger(signed.Sequence) || Number(signed.Sequence) < 0) invalid("Invalid Clasp sequence.", { field: "Sequence" });
        delete signed.SigningPubKey;
        delete signed.TxnSignature;
        for (const field of autofill) if (!(field in tx)) delete signed[field];
        verificationStage = "intent";
        const expectedBlob = encode(tx as Transaction);
        if (encode(signed as unknown as Transaction) !== expectedBlob) {
          const expected = decode(expectedBlob) as Record<string, unknown>;
          const changedFields = [...new Set([...Object.keys(expected), ...Object.keys(signed)])]
            .filter(field => JSON.stringify(expected[field]) !== JSON.stringify(signed[field]));
          invalid("Clasp changed transaction fields: " + changedFields.join(", ") + ".", { changedFields });
        }
        return { txBlob: result.tx_blob, hash: result.hash.toUpperCase(), signed: true, raw: result };
      } catch (cause) {
        const reason = cause instanceof WalletKitError ? cause.message : "Invalid signed transaction.";
        throw new WalletKitError(WalletKitErrorCode.SIGN_FAILED, "Clasp verification failed: " + reason, {
          cause, details: { ...(cause instanceof WalletKitError ? cause.details : {}), verificationStage, outcomeUnknown: false }
        });
      }
    });
  }

  async signAndSubmit(request: SignAndSubmitRequest) {
    if (request.submit === false) return this.signTransaction(request);
    const { tx, network, account, hasExplicitCap } = this.prepare(request);
    if (hasExplicitCap && tx.Fee === undefined) invalid("Set Fee explicitly when submitting with a Clasp fee ceiling.");
    return this.run(request, "submit", async (client, signal) => {
      const result = await client.signAndSubmit({ network, address: account.address, tx });
      this.assertActive(signal);
      if (result.engineResult !== "tesSUCCESS" || typeof result.hash !== "string" || !hashPattern.test(result.hash)) {
        throw new WalletKitError(WalletKitErrorCode.SUBMIT_FAILED, "Clasp did not return a successful submission result.", { details: { outcomeUnknown: true } });
      }
      return { hash: result.hash.toUpperCase(), status: "submitted" as const, signed: true, raw: result };
    });
  }

  private prepare(request: SignTransactionRequest) {
    const account = this.account;
    if (!account?.network) throw createWalletError.notConnected();
    const network = networkFor(account.network);
    // Generic Kit callers may also supply another wallet's payload; txJson is authoritative.
    const tx = structuredClone(request.txJson) as Record<string, unknown>;
    if (tx.Account !== undefined && tx.Account !== account.address) invalid("Clasp transaction Account must match the connected account.");
    if (["Signers", "SigningPubKey", "TxnSignature", "NetworkID"].some(field => field in tx) || tx.TransactionType === "Batch") {
      invalid("Clasp requires an unsigned single transaction on standard XRPL networks.");
    }
    tx.Account = account.address;
    validate(tx);
    const encoded = decode(encode(tx as unknown as Transaction));
    if (Object.keys(tx).some(field => !(field in encoded))) invalid("Clasp request contains unsupported fields.");
    const limits = [this.options.maxFeeDrops, request.maxFeeDrops, request.preflight ? request.preflight.maxFeeDrops : undefined]
      .filter((value): value is string => value !== undefined).map(fee);
    const cap = limits.length ? limits.reduce((a, b) => a < b ? a : b) : 1_000_000n;
    if (tx.Fee !== undefined && fee(tx.Fee) > cap) invalid("Clasp transaction fee exceeds the ceiling.");
    return { tx: tx as unknown as Transaction, network, account, cap, hasExplicitCap: limits.length > 0 };
  }

  private assertActive(signal: AbortSignal) {
    if (signal.aborted) throw new WalletKitError(WalletKitErrorCode.REQUEST_CANCELLED, "Clasp request cancelled.");
  }

  private async run<T>(request: WalletRequestOptions, mode: "connect" | "sign" | "submit",
    action: (client: ClaspClient, signal: AbortSignal) => Promise<T>): Promise<T> {
    if (this.pending) throw new WalletKitError(WalletKitErrorCode.INVALID_REQUEST, "A Clasp request is already active.");
    const controller = new AbortController();
    this.pending = controller;
    const onAbort = () => controller.abort(request.signal?.reason);
    request.signal?.addEventListener("abort", onAbort, { once: true });
    if (request.signal?.aborted) onAbort();
    let dispatched = false;
    try {
      const client = this.client ??= this.options.client ?? createClaspClient();
      return await this.withWalletRequest({ ...request, signal: controller.signal }, async signal => {
        const cancel = () => {
          try { client.cancelPendingRequest?.(signal.reason); } catch { /* Local cancellation still settles. */ }
        };
        signal.addEventListener("abort", cancel, { once: true });
        try {
          dispatched = true;
          return await action(client, signal);
        } finally { signal.removeEventListener("abort", cancel); }
      });
    } catch (cause) {
      const code = cause instanceof ClaspError ? cause.code : undefined;
      if (code === "user_rejected") {
        throw new WalletKitError(mode === "connect" ? WalletKitErrorCode.CONNECTION_REJECTED : WalletKitErrorCode.SIGN_REJECTED,
          mode === "connect" ? "Clasp connection rejected." : "Clasp signing rejected.",
          { cause, details: { outcomeUnknown: false } });
      }
      if (mode === "submit" && dispatched) {
        const details = cause instanceof ClaspError ? { hash: cause.hash?.toUpperCase(), engineResult: cause.engineResult } : {};
        const final = code === "tx_failed" && !!details.hash && !!details.engineResult;
        const outcomeUnknown = cause instanceof WalletKitError && typeof cause.details?.outcomeUnknown === "boolean"
          ? cause.details.outcomeUnknown : !final && !["popup_blocked", "busy", "bad_request", "wrong_wallet", "unsupported_tx", "unsupported_message"].includes(code ?? "");
        const cancelled = cause instanceof WalletKitError &&
          (cause.code === WalletKitErrorCode.REQUEST_CANCELLED || cause.code === WalletKitErrorCode.REQUEST_TIMEOUT);
        throw new WalletKitError(cancelled ? cause.code : WalletKitErrorCode.SUBMIT_FAILED,
          final ? "Clasp submission failed: " + details.engineResult : "Clasp submission did not complete.", {
          cause, details: { ...details, final, outcomeUnknown }
        });
      }
      if (cause instanceof WalletKitError) throw cause;
      throw new WalletKitError(mode === "connect" ? WalletKitErrorCode.CONNECTION_FAILED : WalletKitErrorCode.SIGN_FAILED,
        code === "popup_blocked" ? "Clasp popup blocked. Retry from a click." : "Clasp request failed.", { cause, details: { providerCode: code } });
    } finally {
      request.signal?.removeEventListener("abort", onAbort);
      this.pending = undefined;
    }
  }
}

export function createClaspAdapter(options?: ClaspAdapterOptions) { return new ClaspAdapter(options); }
