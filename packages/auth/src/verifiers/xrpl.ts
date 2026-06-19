import type { SignatureVerifier, WalletAuthVerifyParams } from "../types";

interface RippleKeypairsModule {
  verify(messageHex: string, signature: string, publicKey: string): boolean;
  deriveAddress(publicKey: string): string;
}

interface VerifyXrplSignatureModule {
  verifySignature(txBlob: string): { signatureValid?: boolean; signedBy?: string } | boolean;
}

interface XrplModule {
  decode(txBlob: string): XrplDecodedTransaction;
  Client?: new (url: string) => XrplClient;
}

interface XrplClient {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  request(request: { command: "account_info"; account: string }): Promise<{ result?: { account_data?: { PublicKey?: string } }; account_data?: { PublicKey?: string } }>;
}

interface XrplDecodedTransaction {
  Account?: string;
  Memos?: Array<{ Memo?: { MemoData?: string } }>;
}

export interface XrplSignatureVerifierOptions {
  nodeUrl?: string;
  hashMessage?: (message: string) => string;
  nodeTimeout?: number;
  dependencies?: {
    rippleKeypairs?: RippleKeypairsModule;
    verifyXrplSignature?: VerifyXrplSignatureModule;
    xrpl?: XrplModule;
    loadPeer?: <T>(name: string) => Promise<T>;
  };
}

const PEER_ERROR = "Install ripple-keypairs, verify-xrpl-signature, and xrpl to use @xrpl-wallet-kit/auth/verifiers.";

export function createXrplSignatureVerifier(options: XrplSignatureVerifierOptions = {}): SignatureVerifier {
  return {
    async verify(params: WalletAuthVerifyParams): Promise<boolean> {
      if (params.signatureKind === "signedTx") return verifySignedTransaction(params, options);
      return verifyCompactSignature(params, options);
    }
  };
}

async function verifyCompactSignature(params: WalletAuthVerifyParams, options: XrplSignatureVerifierOptions): Promise<boolean> {
  const signature = params.signature ?? params.proof;
  if (!signature) return false;
  const rippleKeypairs = options.dependencies?.rippleKeypairs ?? await loadPeer<RippleKeypairsModule>("ripple-keypairs", options);
  const publicKey = params.publicKey ?? await resolveLedgerPublicKey(params.address, options);
  if (!publicKey) throw new Error("Cannot resolve public key for address.");

  const messageHex = options.hashMessage ? options.hashMessage(params.message) : utf8ToHex(params.message);
  try {
    if (!rippleKeypairs.verify(messageHex, signature, publicKey)) return false;
    return rippleKeypairs.deriveAddress(publicKey) === params.address;
  } catch {
    return false;
  }
}

async function verifySignedTransaction(params: WalletAuthVerifyParams, options: XrplSignatureVerifierOptions): Promise<boolean> {
  const txBlob = params.txBlob ?? params.proof;
  if (!txBlob) return false;

  const verifyModule = options.dependencies?.verifyXrplSignature ?? await loadPeer<VerifyXrplSignatureModule>("verify-xrpl-signature", options);
  const xrpl = options.dependencies?.xrpl ?? await loadPeer<XrplModule>("xrpl", options);
  const verifyResult = verifyModule.verifySignature(txBlob);
  if (typeof verifyResult === "boolean") {
    if (!verifyResult) return false;
  } else {
    if (verifyResult.signatureValid === false) return false;
    if (verifyResult.signedBy && verifyResult.signedBy !== params.address) return false;
  }

  const tx = xrpl.decode(txBlob);
  if (tx.Account !== params.address) return false;
  return extractFirstMemoText(tx) === params.message;
}

async function resolveLedgerPublicKey(address: string, options: XrplSignatureVerifierOptions): Promise<string | undefined> {
  if (!options.nodeUrl) return undefined;
  const xrpl = options.dependencies?.xrpl ?? await loadPeer<XrplModule>("xrpl", options);
  if (!xrpl.Client) throw new Error(PEER_ERROR);
  const client = new xrpl.Client(options.nodeUrl);
  try {
    await withTimeout(client.connect(), options.nodeTimeout ?? 5000);
    const response = await withTimeout(client.request({ command: "account_info", account: address }), options.nodeTimeout ?? 5000);
    return response.result?.account_data?.PublicKey ?? response.account_data?.PublicKey;
  } finally {
    await client.disconnect().catch(() => undefined);
  }
}

async function loadPeer<T>(name: string, options: XrplSignatureVerifierOptions): Promise<T> {
  try {
    if (options.dependencies?.loadPeer) return await options.dependencies.loadPeer<T>(name);
    const mod = await import(name);
    const maybeDefault = mod as { default?: unknown };
    return (maybeDefault.default && typeof maybeDefault.default === "object" ? maybeDefault.default : mod) as T;
  } catch (error) {
    const peerError = new Error(PEER_ERROR);
    (peerError as Error & { cause?: unknown }).cause = error;
    throw peerError;
  }
}

function utf8ToHex(value: string): string {
  const bytes = new TextEncoder().encode(value);
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("").toUpperCase();
}

function hexToUtf8(value: string): string {
  const normalized = value.length % 2 === 0 ? value : `0${value}`;
  const bytes = new Uint8Array(normalized.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(normalized.slice(index * 2, index * 2 + 2), 16);
  }
  return new TextDecoder().decode(bytes);
}

function extractFirstMemoText(tx: XrplDecodedTransaction): string | undefined {
  const memoData = tx.Memos?.[0]?.Memo?.MemoData;
  return memoData ? hexToUtf8(memoData) : undefined;
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`XRPL request timed out after ${timeoutMs}ms.`)), timeoutMs);
      })
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
