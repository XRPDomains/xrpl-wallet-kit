import { ClaspConnect, ClaspError } from "clasp-connect";
import { BaseWalletAdapter, createWalletError, getNetworkFamily, WalletKitError, WalletKitErrorCode } from "@xrpl-wallet-kit/core";
import type { ConnectOptions, SignAndSubmitRequest, SignTransactionRequest, WalletAccount, WalletCapabilities, WalletMetadata, WalletNetwork, WalletRequestOptions } from "@xrpl-wallet-kit/core";
import { deriveAddress } from "ripple-keypairs";
import { decode, encode, hashes, isValidClassicAddress, validate, verifySignature, type Transaction } from "xrpl";
import { CLASP_ICON } from "./icon";

const origin = "https://claspwallet.com";
const hashPattern = /^[a-f0-9]{64}$/i;
const autofill = ["Fee", "Sequence", "LastLedgerSequence"];
type ClaspClient = Pick<ClaspConnect, "connect" | "sign" | "signAndSubmit">;

export interface ClaspAdapterOptions {
  maxFeeDrops?: string;
  /** Test or application-supplied SDK client. The default uses the official Clasp origin. */
  client?: ClaspClient;
}

function invalid(message: string): never {
  throw new WalletKitError(WalletKitErrorCode.INVALID_REQUEST, message);
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
      try {
        if (typeof result.tx_blob !== "string" || result.tx_blob.length > 262144 || !/^(?:[a-f0-9]{2})+$/i.test(result.tx_blob) ||
          typeof result.hash !== "string" || !hashPattern.test(result.hash)) invalid("Clasp did not return a signed transaction.");
        const signed = decode(result.tx_blob) as Record<string, unknown>;
        validate(signed);
        if (signed.Account !== account.address || signed.SigningPubKey !== account.publicKey || "Signers" in signed ||
          !verifySignature(result.tx_blob) || hashes.hashSignedTx(result.tx_blob) !== result.hash.toUpperCase()) invalid("Invalid Clasp signature or hash.");
        if (fee(signed.Fee) > cap || !Number.isInteger(signed.LastLedgerSequence) || Number(signed.LastLedgerSequence) <= 0 ||
          !Number.isInteger(signed.Sequence) || Number(signed.Sequence) < 0) invalid("Invalid Clasp autofill fields.");
        delete signed.SigningPubKey;
        delete signed.TxnSignature;
        for (const field of autofill) if (!(field in tx)) delete signed[field];
        if (encode(signed as unknown as Transaction) !== encode(tx as Transaction)) invalid("Clasp changed the transaction intent.");
        return { txBlob: result.tx_blob, hash: result.hash.toUpperCase(), signed: true, raw: result };
      } catch (cause) {
        throw new WalletKitError(WalletKitErrorCode.SIGN_FAILED, "Clasp signed transaction failed verification.", { cause });
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
    if (request.walletPayload !== undefined) invalid("Clasp accepts txJson only.");
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
      const client = this.client ??= this.options.client ?? new ClaspConnect({ walletUrl: origin });
      return await this.withWalletRequest({ ...request, signal: controller.signal }, signal => {
        dispatched = true;
        return action(client, signal);
      });
    } catch (cause) {
      const code = cause instanceof ClaspError ? cause.code : undefined;
      if (code === "user_rejected" && mode !== "submit") {
        throw mode === "connect" ? createWalletError.connectionRejected("Clasp", cause) : createWalletError.signRejected(cause);
      }
      if (mode === "submit" && dispatched) {
        const details = cause instanceof ClaspError ? { providerHash: cause.hash, engineResult: cause.engineResult } : {};
        throw new WalletKitError(WalletKitErrorCode.SUBMIT_FAILED, "Clasp submission did not complete. Check the ledger before retrying.", {
          cause, details: { ...details, outcomeUnknown: !["popup_blocked", "busy", "bad_request", "wrong_wallet", "unsupported_tx"].includes(code ?? "") }
        });
      }
      if (cause instanceof WalletKitError) throw cause;
      throw new WalletKitError(mode === "connect" ? WalletKitErrorCode.CONNECTION_FAILED : WalletKitErrorCode.SIGN_FAILED,
        code === "popup_blocked" ? "Clasp popup blocked. Retry from a click." : "Clasp request failed.", { cause, details: { providerCode: code } });
    } finally {
      request.signal?.removeEventListener("abort", onAbort);
      this.pending = undefined;
      // The SDK owns the popup and may reuse it for the next approval.
    }
  }
}

export function createClaspAdapter(options?: ClaspAdapterOptions) { return new ClaspAdapter(options); }
