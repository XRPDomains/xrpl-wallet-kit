import type { Batch, Client, Transaction } from "xrpl";
import { WalletKitError, WalletKitErrorCode } from "./errors";
import type { TransactionPayload, TransactionPreflightIssue, WalletBatchResult } from "./types";

export const BATCH_ALL_OR_NOTHING = 0x00010000;
export const INNER_BATCH_FLAG = 0x40000000;
export const BATCH_V1_1_AMENDMENT = "9F287AED3CDB50A7BD1ACEC24296A30C9B5230CCD136219317AC790E3B884377";
export const FIX_BATCH_V1_2_AMENDMENT = "14A2B45E48A4A124D1BBA657AC7B0DC3D5EA8C256C89E8F0D8142D32960A7944";

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function uint32(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 0 && Number(value) <= 0xffffffff;
}

function invalid(message: string, cause?: unknown): never {
  throw new WalletKitError(WalletKitErrorCode.INVALID_REQUEST, message, { cause });
}

/** V1 supports only prepared, unsigned, single-account All-or-Nothing batches. */
export function validateBatchTransaction(tx: Readonly<Record<string, unknown>>, account?: string, prepared = true): TransactionPreflightIssue[] {
  const issues: TransactionPreflightIssue[] = [];
  const error = (message: string, field: string) => issues.push({ code: "INVALID_BATCH", severity: "error", message, field });
  if (tx.TransactionType !== "Batch") error("Expected a Batch transaction.", "TransactionType");
  if (tx.Flags !== BATCH_ALL_OR_NOTHING) error("Batch V1 supports only All-or-Nothing mode.", "Flags");
  if (typeof tx.Account !== "string" || !tx.Account || (account !== undefined && tx.Account !== account)) error("Batch Account must match the connected account.", "Account");
  if ("BatchSigners" in tx) error("Multi-account Batch signing is not supported in V1.", "BatchSigners");
  if (tx.SourceTag !== undefined && !uint32(tx.SourceTag)) error("SourceTag must be uint32.", "SourceTag");
  if (prepared) {
    if (typeof tx.Fee !== "string" || !/^[1-9]\d*$/.test(tx.Fee)) error("Prepare an explicit positive outer Fee before signing.", "Fee");
    if (!uint32(tx.LastLedgerSequence) || tx.LastLedgerSequence === 0) error("Prepare an explicit LastLedgerSequence before signing.", "LastLedgerSequence");
    if (tx.TicketSequence !== undefined ? !uint32(tx.TicketSequence) || tx.TicketSequence === 0 || tx.Sequence !== 0 : !uint32(tx.Sequence) || tx.Sequence === 0) {
      error("Prepare a valid outer Sequence or TicketSequence before signing.", "Sequence");
    }
  }
  if (!Array.isArray(tx.RawTransactions) || tx.RawTransactions.length < 2 || tx.RawTransactions.length > 8) {
    error("Batch must contain 2 to 8 inner transactions.", "RawTransactions");
    return issues;
  }
  const sequences = new Set<string>();
  if (tx.TicketSequence !== undefined) sequences.add(`ticket:${tx.TicketSequence}`);
  for (const [index, wrapper] of tx.RawTransactions.entries()) {
    const path = `RawTransactions[${index}].RawTransaction`;
    const entry = record(wrapper);
    const inner = entry && record(entry.RawTransaction);
    if (!entry || Object.keys(entry).length !== 1 || !inner) { error("Each inner transaction must use exactly the RawTransaction wrapper.", path); continue; }
    if (typeof inner.TransactionType !== "string" || !inner.TransactionType || inner.TransactionType === "Batch") error("Inner transaction type is required; nested Batch is forbidden.", `${path}.TransactionType`);
    if (inner.Account !== tx.Account) error("Every inner Account must match the outer Account.", `${path}.Account`);
    if (!uint32(inner.Flags) || (inner.Flags & INNER_BATCH_FLAG) === 0) error("Inner transaction requires tfInnerBatchTxn.", `${path}.Flags`);
    if (inner.Fee !== "0") error("Inner Fee must be exactly '0'.", `${path}.Fee`);
    if (inner.SigningPubKey !== "" || "TxnSignature" in inner || "Signers" in inner) error("Inner transactions must be unsigned with an empty SigningPubKey.", path);
    if ("LastLedgerSequence" in inner) error("Expiry belongs on the outer Batch, not inner transactions.", `${path}.LastLedgerSequence`);
    if (inner.SourceTag !== undefined && !uint32(inner.SourceTag)) error("Inner SourceTag must be uint32.", `${path}.SourceTag`);
    if (inner.NetworkID !== undefined && inner.NetworkID !== tx.NetworkID) error("Inner NetworkID differs from the outer Batch.", `${path}.NetworkID`);
    if (prepared || inner.Sequence !== undefined || inner.TicketSequence !== undefined) {
      const ticket = inner.TicketSequence !== undefined;
      const sequence = ticket ? inner.TicketSequence : inner.Sequence;
      if (!uint32(sequence) || sequence === 0 || (ticket && inner.Sequence !== undefined && inner.Sequence !== 0)) error("Inner transaction requires a valid Sequence or TicketSequence, not both.", `${path}.Sequence`);
      else {
        const key = `${ticket ? "ticket" : "sequence"}:${sequence}`;
        if (sequences.has(key) || (!ticket && sequence === tx.Sequence)) error("Batch sequences/tickets must not be reused.", `${path}.Sequence`);
        sequences.add(key);
      }
    }
  }
  return issues;
}

export interface PrepareBatchOptions {
  account: string;
  transactions: readonly TransactionPayload[];
  /** Integer drops; required to bound the fee returned by autofill. */
  maxFeeDrops: string;
  /** Applied to the outer Batch and inner transactions without a SourceTag. */
  sourceTag?: number;
}

/** Read-only RPC preparation. Call before the separate user gesture that opens a wallet. */
export async function prepareBatchTransaction(client: Pick<Client, "request" | "autofill">, options: PrepareBatchOptions): Promise<Batch> {
  const input = structuredClone(options);
  if (!Array.isArray(input.transactions) || input.transactions.length < 2 || input.transactions.length > 8) invalid("Batch must contain 2 to 8 transactions.");
  if (typeof input.maxFeeDrops !== "string" || !/^[1-9]\d*$/.test(input.maxFeeDrops)) invalid("maxFeeDrops must be a positive integer drops string.");
  const sourceTag = input.sourceTag ?? 0;
  if (!uint32(sourceTag)) invalid("SourceTag must be uint32.");
  const tx = {
    TransactionType: "Batch", Account: input.account, Flags: BATCH_ALL_OR_NOTHING, SourceTag: sourceTag,
    RawTransactions: input.transactions.map(value => {
      const inner = record(value);
      if (!inner) invalid("Inner transaction must be an object.");
      if ((inner.Account !== undefined && inner.Account !== input.account) ||
        (inner.Fee !== undefined && inner.Fee !== "0") ||
        (inner.SigningPubKey !== undefined && inner.SigningPubKey !== "") ||
        "TxnSignature" in inner || "Signers" in inner || "LastLedgerSequence" in inner) invalid("Batch input must be unsigned and single-account; omit inner Fee and expiry.");
      if (inner.Flags !== undefined && !uint32(inner.Flags)) invalid("Inner Flags must be uint32.");
      return { RawTransaction: { ...inner, Account: input.account, Flags: ((Number(inner.Flags ?? 0) | INNER_BATCH_FLAG) >>> 0), Fee: "0", SigningPubKey: "", SourceTag: inner.SourceTag ?? sourceTag } };
    })
  };
  const issues = validateBatchTransaction(tx, input.account, false);
  if (issues.length) invalid(issues[0].message);
  const xrpl = await import("xrpl");
  if (!xrpl.isValidClassicAddress(input.account)) invalid("Batch Account must be a classic XRPL address.");
  for (const wrapper of tx.RawTransactions) {
    xrpl.validate(wrapper.RawTransaction);
    const canonical = xrpl.decode(xrpl.encode(wrapper.RawTransaction as unknown as Transaction));
    if (Object.entries(wrapper.RawTransaction).some(([field, value]) => value !== undefined && !(field in canonical))) invalid("Inner transaction contains unsupported non-signing fields.");
  }
  // Require the replacement amendment and its canonical-wrapper security fix, not legacy Batch.
  for (const feature of [BATCH_V1_1_AMENDMENT, FIX_BATCH_V1_2_AMENDMENT]) {
    const response = await client.request({ command: "feature", feature });
    const state = record(record(response.result)?.[feature]);
    if (state?.enabled !== true) invalid("The selected RPC must confirm BatchV1_1 and fixBatchV1_2 are enabled.");
  }
  const prepared = await client.autofill(tx as unknown as Batch);
  const preparedIssues = validateBatchTransaction(prepared as unknown as Record<string, unknown>, input.account);
  if (preparedIssues.length) invalid(preparedIssues[0].message);
  if (BigInt(prepared.Fee!) > BigInt(input.maxFeeDrops)) invalid("Prepared Batch fee exceeds maxFeeDrops.");
  xrpl.validate(prepared);
  for (const wrapper of prepared.RawTransactions) xrpl.validate(wrapper.RawTransaction);
  xrpl.encode(prepared);
  return prepared;
}

export async function createBatchTracking(tx: Readonly<Record<string, unknown>>): Promise<WalletBatchResult> {
  const issues = validateBatchTransaction(tx);
  if (issues.length) invalid(issues[0].message);
  const { hashes } = await import("xrpl");
  return {
    mode: "all-or-nothing", status: "pending",
    innerTransactions: (tx.RawTransactions as { RawTransaction: Transaction }[]).map(({ RawTransaction }, index) => ({ index, hash: hashes.hashSignedTx(RawTransaction), status: "pending" }))
  };
}

export interface BatchTransactionLookup {
  validated: boolean;
  transactionResult?: string;
  raw: unknown;
}

/** Missing/foreign inner results remain unknown; outer tesSUCCESS alone never confirms a Batch. */
export async function inspectBatchResult(parentHash: string, outer: BatchTransactionLookup, expected: WalletBatchResult | undefined,
  lookup: (hash: string) => Promise<BatchTransactionLookup | null>): Promise<WalletBatchResult> {
  const result = record(record(outer.raw)?.result);
  const tx = record(result?.tx_json) ?? result;
  const unknown = (): WalletBatchResult => ({ mode: "all-or-nothing", status: "unknown", innerTransactions: expected?.innerTransactions.map(inner => ({ ...inner, status: "unknown" })) ?? [] });
  if (!outer.validated || !tx || validateBatchTransaction(tx).length ||
    (result?.hash !== undefined && (typeof result.hash !== "string" || result.hash.toUpperCase() !== parentHash.toUpperCase()))) return unknown();
  const batch = await createBatchTracking(tx);
  if (expected && (batch.innerTransactions.length !== expected.innerTransactions.length || batch.innerTransactions.some((inner, index) => inner.hash !== expected.innerTransactions[index].hash))) return unknown();
  const ledger = result?.ledger_index;
  if (!uint32(ledger) || ledger === 0) return unknown();
  for (const inner of batch.innerTransactions) {
    const found = await lookup(inner.hash);
    const raw = record(record(found?.raw)?.result);
    const meta = record(raw?.meta) ?? record(raw?.metaData) ?? record(raw?.metadata);
    if (!found?.validated || raw?.ledger_index !== ledger || typeof meta?.ParentBatchID !== "string" || meta.ParentBatchID.toUpperCase() !== parentHash.toUpperCase() || !found.transactionResult ||
      (raw?.hash !== undefined && (typeof raw.hash !== "string" || raw.hash.toUpperCase() !== inner.hash))) {
      inner.status = "unknown";
      continue;
    }
    inner.resultCode = found.transactionResult;
    inner.status = found.transactionResult === "tesSUCCESS" ? "confirmed" : "failed";
  }
  batch.status = batch.innerTransactions.some(inner => inner.status === "failed") ? "failed"
    : batch.innerTransactions.every(inner => inner.status === "confirmed") ? "confirmed" : "unknown";
  return batch;
}
