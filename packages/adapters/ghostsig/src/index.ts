import { BaseWalletAdapter, DEFAULT_XRPL_NETWORKS, WalletKitError, WalletKitErrorCode, createWalletError } from "@xrpl-wallet-kit/core";
import type { ConnectOptions, SignAndSubmitRequest, SignTransactionRequest, WalletAccount, WalletCapabilities, WalletMetadata, WalletNetwork, WalletSession } from "@xrpl-wallet-kit/core";
import { deriveAddress } from "ripple-keypairs";
import { decode, encode, hashes, validate, verifySignature, type Transaction } from "xrpl";
import { GhostsigPopup, resolveGhostsigUrl } from "./popup";

export const GHOSTSIG_ICON = "https://ghostsig.dev/assets/icon-180.png";

export interface GhostsigAdapterOptions { url?: string; timeoutMs?: number; }

function invalid(text: string, cause?: unknown): never {
  throw new WalletKitError(WalletKitErrorCode.INVALID_REQUEST, text, { cause });
}

function accountFrom(value: unknown, network: WalletNetwork): WalletAccount {
  const result = value as { address?: unknown; publicKey?: unknown } | null;
  if (!result || typeof result.address !== "string" || typeof result.publicKey !== "string" || !/^[0-9a-f]{64}$/i.test(result.publicKey)) invalid("Malformed GhostSig account reply.");
  const publicKey = `ED${result.publicKey.toUpperCase()}`;
  try { if (deriveAddress(publicKey) !== result.address) invalid("GhostSig address does not match its public key."); }
  catch (cause) { invalid("Invalid GhostSig public key or address.", cause); }
  return { address: result.address, publicKey, network, networkType: network.networkType };
}

function networkFor(network?: WalletNetwork): WalletNetwork {
  const standard = DEFAULT_XRPL_NETWORKS.find(item => item.id === (network?.id ?? "mainnet"));
  if (!standard || (network && ((network.family ?? "xrpl") !== "xrpl" || network.networkType !== standard.networkType ||
    network.rpcUrl !== standard.rpcUrl || (network.httpRpcUrl !== undefined && network.httpRpcUrl !== standard.httpRpcUrl) ||
    network.definitionsUrl !== undefined || network.networkId !== undefined))) throw createWalletError.networkNotSupported("GhostSig", network?.id);
  return { ...standard };
}

export class GhostsigAdapter extends BaseWalletAdapter {
  metadata: WalletMetadata = { id: "ghostsig", name: "GhostSig", type: "web", group: "Web wallets", homepage: "https://ghostsig.dev/", icon: GHOSTSIG_ICON };
  capabilities: WalletCapabilities = { connect: true, disconnect: true, signMessage: false, signTransaction: true, signAndSubmit: true,
    payments: false, nftOffers: false, details: { supportedNetworks: ["mainnet", "testnet", "devnet"], transactionModes: ["sign-only", "sign-and-submit"] } };
  private readonly popup = new GhostsigPopup();
  private readonly url: URL;
  private account?: WalletAccount;
  private generation = 0;

  constructor(private readonly options: GhostsigAdapterOptions = {}) { super(); this.url = resolveGhostsigUrl(options.url); }
  isAvailable(): boolean { return typeof window !== "undefined" && typeof window.open === "function" && Boolean(globalThis.crypto?.getRandomValues); }

  async connect(options: ConnectOptions = {}) {
    if (this.popup.pending) invalid("A GhostSig popup request is already pending.");
    const network = networkFor(options.network);
    const generation = ++this.generation;
    this.account = undefined;
    const raw = await this.popup.request(this.url, network.id, "connect", {}, { ...options, timeoutMs: options.timeoutMs ?? this.options.timeoutMs });
    if (generation !== this.generation || options.signal?.aborted) throw new WalletKitError(WalletKitErrorCode.REQUEST_CANCELLED, "GhostSig connection cancelled.");
    this.account = accountFrom(raw, network);
    return { account: structuredClone(this.account), raw };
  }

  cancelPendingConnection(): void { this.generation++; this.popup.cancel(); }
  async disconnect(): Promise<void> { this.cancelPendingConnection(); this.account = undefined; await super.disconnect(); }

  async restoreSession(session: WalletSession) {
    if (session.adapterId !== "ghostsig" || (session.expiresAt !== undefined && session.expiresAt <= Date.now()) || !this.isAvailable()) return null;
    try {
      const network = networkFor(session.account.network);
      const key = session.account.publicKey;
      if (typeof key !== "string" || !/^ED[0-9a-f]{64}$/i.test(key)) return null;
      const account = accountFrom({ address: session.account.address, publicKey: key.slice(2) }, network);
      this.cancelPendingConnection();
      this.account = account;
      return { account: structuredClone(account), session: { ...session, account: structuredClone(account) } };
    } catch { return null; }
  }

  async signTransaction(request: SignTransactionRequest) {
    const raw = await this.sign(request, false);
    return { txBlob: raw.blob, signed: true, raw };
  }

  async signAndSubmit(request: SignAndSubmitRequest) {
    if (request.submit === false) {
      const raw = await this.sign(request, false);
      return { hash: raw.hash, signed: true, status: "signed", raw };
    }
    const raw = await this.sign(request, true);
    const outcome = raw.submitted;
    if (!raw.handOver && outcome?.kind === "validated" && outcome.ok === true && outcome.code === "tesSUCCESS" &&
      ((typeof outcome.ledger === "number" && Number.isInteger(outcome.ledger) && outcome.ledger > 0) ||
        (typeof outcome.ledger === "string" && /^[1-9]\d*$/.test(outcome.ledger)))) {
      return { hash: raw.hash, signed: true, status: "tesSUCCESS", raw };
    }
    throw new WalletKitError(WalletKitErrorCode.SIGN_FAILED, `GhostSig submission not confirmed successful. Check transaction ${raw.hash} before retrying.`,
      { details: { hash: raw.hash, transaction: raw, outcomeUnknown: true } });
  }

  private async sign(request: SignTransactionRequest, submit: boolean): Promise<GhostsigSignedReply> {
    const account = this.account && structuredClone(this.account);
    if (!account?.network || !account.publicKey) throw createWalletError.notConnected();
    const generation = this.generation;
    const tx = structuredClone(request.txJson) as Record<string, unknown>;
    if (tx.Account !== undefined && tx.Account !== account.address) invalid("GhostSig transaction Account differs from connected account.");
    if ("Signers" in tx || "TxnSignature" in tx || "SigningPubKey" in tx) invalid("GhostSig expects an unsigned single-sign transaction.");
    tx.Account = account.address;
    if (!Number.isInteger(tx.SourceTag) || (tx.SourceTag as number) < 0 || (tx.SourceTag as number) > 0xffffffff) {
      invalid("GhostSig requires an explicit uint32 SourceTag (0 is allowed) to prevent the wallet adding an unrequested field.");
    }
    try {
      validate(tx);
      const canonical = decode(encode(tx as unknown as Transaction));
      if (Object.keys(tx).some(field => !(field in canonical))) invalid("GhostSig request contains unsupported non-signing fields.");
    }
    catch (cause) { invalid("Invalid GhostSig transaction request.", cause); }
    const reply = await this.popup.request(this.url, account.network.id, "sign", { payload: JSON.stringify(tx), submit, address: account.address },
      { ...request, timeoutMs: request.timeoutMs ?? this.options.timeoutMs });
    if (generation !== this.generation || request.signal?.aborted) throw new WalletKitError(WalletKitErrorCode.REQUEST_CANCELLED, "GhostSig signing cancelled.", { details: { outcomeUnknown: submit, raw: reply } });
    const raw = reply as GhostsigSignedReply;
    try {
      const returned = accountFrom(reply, account.network);
      if (returned.address !== account.address || returned.publicKey !== account.publicKey) invalid("GhostSig signing reply changed account or public key.");
      if (typeof raw.blob !== "string" || !/^(?:[0-9a-f]{2})+$/i.test(raw.blob) || typeof raw.hash !== "string" || !/^[0-9a-f]{64}$/i.test(raw.hash) ||
        typeof raw.signature !== "string" || !/^[0-9a-f]{128}$/i.test(raw.signature)) invalid("Malformed GhostSig signed reply.");
      const signed = decode(raw.blob) as Record<string, unknown>;
      validate(signed);
      if (typeof signed.Fee !== "string" || !/^[1-9]\d*$/.test(signed.Fee) || !Number.isInteger(signed.Sequence) || (signed.Sequence as number) < 0 ||
        !Number.isInteger(signed.LastLedgerSequence) || (signed.LastLedgerSequence as number) <= 0) invalid("GhostSig reply is not a fully prepared transaction.");
      if (signed.Account !== account.address || signed.SigningPubKey !== account.publicKey || "Signers" in signed ||
        typeof signed.TxnSignature !== "string" || signed.TxnSignature.toUpperCase() !== raw.signature.toUpperCase() ||
        hashes.hashSignedTx(raw.blob) !== raw.hash.toUpperCase() || !verifySignature(raw.blob)) invalid("Invalid GhostSig transaction signature, signer or hash.");
      delete signed.SigningPubKey; delete signed.TxnSignature;
      for (const field of ["Sequence", "Fee", "LastLedgerSequence"]) if (!(field in tx)) delete signed[field];
      if (encode(signed as unknown as Transaction) !== encode(tx as unknown as Transaction)) invalid("GhostSig signed transaction changes requested fields.");
      if (!submit && raw.submitted !== undefined) invalid("GhostSig sign-only reply unexpectedly reports a submission.");
      return raw;
    } catch (cause) {
      if (submit) throw new WalletKitError(WalletKitErrorCode.SIGN_FAILED, "GhostSig reply failed verification; submission outcome is unknown. Inspect the ledger before retrying.",
        { cause, details: { outcomeUnknown: true, raw: reply, providerHash: typeof raw?.hash === "string" && /^[0-9a-f]{64}$/i.test(raw.hash) ? raw.hash : undefined } });
      invalid("GhostSig signed reply failed verification.", cause);
    }
  }
}

interface GhostsigSignedReply {
  address: string; publicKey: string; blob: string; hash: string; signature: string; handOver?: string;
  submitted?: { kind?: string; ok?: boolean; code?: string; ledger?: string | number };
}

export function createGhostsigAdapter(options?: GhostsigAdapterOptions): GhostsigAdapter { return new GhostsigAdapter(options); }
