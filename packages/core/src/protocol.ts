import { WalletKitError, WalletKitErrorCode } from "./errors";
import type { SignTransactionRequest, TransactionPayload, TxResult, WalletAccount, WalletNetwork } from "./types";

export interface WalletProtocolOptions { readonly maxFeeDrops?: string; readonly signal?: AbortSignal; }
export interface WalletProtocol {
  readonly family: string;
  readonly networks: readonly WalletNetwork[];
  readonly transactionTypes: readonly string[];
  prepare(tx: TransactionPayload, account: WalletAccount, network: WalletNetwork, options: WalletProtocolOptions): Promise<TransactionPayload>;
  verify(blob: string, expected: TransactionPayload, account: WalletAccount, network: WalletNetwork, options: WalletProtocolOptions): { txBlob: string; hash: string };
  encode(tx: TransactionPayload): string;
  decode(blob: string): TransactionPayload;
  submit(blob: string, network: WalletNetwork, options: WalletProtocolOptions): Promise<TxResult>;
  lookupTransaction?(hash: string, network: WalletNetwork, signal?: AbortSignal): Promise<Record<string, unknown>>;
}
export interface WalletProtocolContext { readonly protocol: WalletProtocol; readonly network: WalletNetwork; }

export async function prepareProtocolTransaction(context: WalletProtocolContext, request: SignTransactionRequest, account: WalletAccount) {
  if (request.walletPayload !== undefined) throw new WalletKitError(WalletKitErrorCode.INVALID_REQUEST, "Chain-aware signing accepts txJson only, not walletPayload.");
  return context.protocol.prepare(structuredClone(request.txJson), account, context.network, { maxFeeDrops: request.maxFeeDrops, signal: request.signal });
}

/** Permit only bounded changes to a kit-autofilled expiry, then recheck with the protocol's trusted RPC. */
export async function verifyProtocolTransaction(context: WalletProtocolContext, request: SignTransactionRequest,
  account: WalletAccount, prepared: TransactionPayload, blob: string, maxExpiryExtension = 50) {
  let expected = prepared;
  let verified: ReturnType<WalletProtocol["verify"]>;
  try {
    verified = context.protocol.verify(blob, expected, account, context.network, request);
  } catch (error) {
    if (request.txJson.LastLedgerSequence !== undefined || !Number.isInteger(maxExpiryExtension) || maxExpiryExtension <= 0) throw error;
    // A failed check is not permission to normalize other fields or accept malformed blobs.
    let returned: unknown;
    try { returned = context.protocol.decode(blob).LastLedgerSequence; } catch { throw error; }
    const supplied = prepared.LastLedgerSequence;
    if (typeof supplied !== "number" || typeof returned !== "number" || !Number.isInteger(returned) ||
      returned > 0xffffffff || returned <= supplied || returned - supplied > maxExpiryExtension) throw error;
    expected = { ...prepared, LastLedgerSequence: returned };
    verified = context.protocol.verify(blob, expected, account, context.network, request);
  }
  await context.protocol.prepare(expected, account, context.network, request);
  return verified;
}
