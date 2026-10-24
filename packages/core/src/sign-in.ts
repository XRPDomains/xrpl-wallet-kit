import { WalletKitError, WalletKitErrorCode } from "./errors";
import type { SignInRequest, SignInResult } from "./types";

export interface SignInContext {
  address: string;
  chainId: string;
  domain: string;
  uri: string;
  nonce: string;
  statement?: string;
  resources?: readonly string[];
  now?: number;
  maxAgeMs?: number;
}

function invalid(): never { throw new WalletKitError(WalletKitErrorCode.INVALID_REQUEST, "Invalid wallet sign-in proof or context."); }

export function assertSignInRequest(request: Pick<SignInRequest, "nonce" | "statement" | "resources">): void {
  if (!request || typeof request.nonce !== "string" || !/^[\x21-\x7e]{8,128}$/.test(request.nonce) ||
    (request.statement !== undefined && (typeof request.statement !== "string" || request.statement.length > 512)) ||
    (request.resources !== undefined && (!Array.isArray(request.resources) || request.resources.length > 16 ||
      request.resources.some(uri => typeof uri !== "string" || uri.length > 2048 || /[\r\n]/.test(uri))))) invalid();
  for (const uri of request.resources ?? []) { try { new URL(uri); } catch { invalid(); } }
}

/** Structural/context validation only. Server must also verify signatures and consume its nonce. */
export function assertSignInContext(result: SignInResult, context: SignInContext, transaction?: Record<string, unknown>): void {
  assertSignInRequest(context);
  if (!result || result.address !== context.address || result.chainId !== context.chainId || result.nonce !== context.nonce ||
    typeof result.proof !== "string" || !result.proof || result.proof.length > 262144 ||
    !Number.isFinite(context.now ?? Date.now()) || !Number.isFinite(context.maxAgeMs ?? 300000) || (context.maxAgeMs ?? 300000) <= 0) invalid();
  if (result.mode === "caip122" && result.signatureKind === "signature") {
    if (result.proof !== result.signature || typeof result.message !== "string" || result.message.length > 65536 ||
      typeof result.signature !== "string" || !/^[0-9a-f]+$/i.test(result.signature) ||
      typeof result.publicKey !== "string" || !/^(ED|02|03)[0-9a-f]{64}$/i.test(result.publicKey)) invalid();
    const issued = result.message.split("\n").filter(line => line.startsWith("Issued At: "));
    if (issued.length !== 1) invalid();
    const timestamp = issued[0].slice(11);
    const time = Date.parse(timestamp), now = context.now ?? Date.now();
    if (!Number.isFinite(time) || time > now + 30000 || now - time > (context.maxAgeMs ?? 300000)) invalid();
    const expected = [`${context.domain} wants you to sign in with your XRPL account:`, context.address, "",
      ...(context.statement ? [context.statement, ""] : []), `URI: ${context.uri}`, "Version: 1", `Chain ID: ${context.chainId}`,
      `Nonce: ${context.nonce}`, `Issued At: ${timestamp}`,
      ...((context.resources?.length ?? 0) > 0 ? ["Resources:", ...context.resources!.map(uri => `- ${uri}`)] : [])].join("\n");
    if (result.message !== expected) invalid();
    return;
  }
  if (result.mode !== "challenge-v1" || result.signatureKind !== "signedTx" || result.proof !== result.txBlob || !transaction) invalid();
  const tx = transaction;
  const fields = new Set(["TransactionType", "Account", "Destination", "Amount", "Fee", "Sequence", "Flags", "NetworkID", "Memos", "SigningPubKey", "TxnSignature"]);
  if (Object.keys(tx).some(field => !fields.has(field)) || tx.TransactionType !== "Payment" || tx.Account !== context.address ||
    tx.Destination !== context.address || tx.Amount !== "1" || tx.Fee !== "10" || tx.Sequence !== 0 ||
    (tx.Flags !== undefined && tx.Flags !== 0 && tx.Flags !== 2147483648) ||
    (tx.NetworkID !== undefined && `xrpl:${tx.NetworkID}` !== context.chainId) ||
    !Array.isArray(tx.Memos) || tx.Memos.length !== 1) invalid();
  const memo = (tx.Memos[0] as { Memo?: { MemoData?: unknown } })?.Memo?.MemoData;
  if (typeof memo !== "string" || !/^(?:[0-9a-f]{2})+$/i.test(memo) || memo.length > 4096) invalid();
  try {
    const challenge = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(Uint8Array.from(memo.match(/../g)!, byte => parseInt(byte, 16))));
    if (!challenge || challenge.wallet !== "joey" || challenge.challenge !== context.nonce ||
      Object.keys(challenge).some(key => key !== "wallet" && key !== "challenge")) invalid();
  } catch { invalid(); }
}
