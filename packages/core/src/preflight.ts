import type { TransactionPreflightContext, TransactionPreflightIssue, TransactionPreflightPolicy, TransactionPreflightReport } from "./types";

function isLedgerIndex(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 0 && Number(value) <= 0xffffffff;
}

function isDrops(value: unknown): value is string {
  return typeof value === "string" && /^\d+$/.test(value);
}

/** Pure built-in checks plus opt-in application checks; never autofills the transaction. */
export async function validateTransactionPreflight(
  context: TransactionPreflightContext,
  policy: TransactionPreflightPolicy
): Promise<TransactionPreflightReport> {
  const issues: TransactionPreflightIssue[] = [];
  const error = (code: string, message: string, field?: string) => issues.push({ code, severity: "error", message, field });
  const tx = context.txJson;
  if (!tx || typeof tx !== "object" || Array.isArray(tx)) {
    return { enabled: true, allowed: false, issues: [{ code: "INVALID_TRANSACTION", severity: "error", message: "txJson must be a transaction object." }] };
  }
  if (!context.account.address) error("ACCOUNT_REQUIRED", "A connected account is required.", "Account");
  if (tx.Account !== undefined && tx.Account !== context.account.address) {
    error("ACCOUNT_MISMATCH", "Transaction Account differs from the connected wallet.", "Account");
  }
  if (policy.networkId !== undefined && policy.networkId !== context.network.id) {
    error("NETWORK_MISMATCH", "The connected network does not match the policy.", "NetworkID");
  }
  if (tx.NetworkID !== undefined && context.network.networkId !== undefined && tx.NetworkID !== context.network.networkId) {
    error("NETWORK_MISMATCH", "Transaction NetworkID differs from the selected network.", "NetworkID");
  }
  if (typeof tx.TransactionType !== "string" || !tx.TransactionType) {
    error("TRANSACTION_TYPE_REQUIRED", "TransactionType must be a non-empty string.", "TransactionType");
  } else {
    if (policy.allowedTransactionTypes && !policy.allowedTransactionTypes.includes(tx.TransactionType)) {
      error("TRANSACTION_TYPE_NOT_ALLOWED", "Transaction type is not allowed by policy.", "TransactionType");
    }
    if (policy.deniedTransactionTypes?.includes(tx.TransactionType)) {
      error("TRANSACTION_TYPE_DENIED", "Transaction type is denied by policy.", "TransactionType");
    }
  }
  if (tx.Fee !== undefined && !isDrops(tx.Fee)) error("INVALID_FEE", "Fee must be an integer drops string.", "Fee");
  if (policy.maxFeeDrops !== undefined) {
    if (!isDrops(policy.maxFeeDrops)) error("INVALID_POLICY", "maxFeeDrops must be an integer drops string.", "Fee");
    else if (!isDrops(tx.Fee)) error("FEE_REQUIRED", "An explicit Fee is required to enforce the fee ceiling.", "Fee");
    else if (BigInt(tx.Fee) > BigInt(policy.maxFeeDrops)) error("FEE_EXCEEDED", "Fee exceeds the configured ceiling.", "Fee");
  }
  const ledger = tx.LastLedgerSequence;
  if (ledger !== undefined && !isLedgerIndex(ledger)) error("INVALID_LEDGER_SEQUENCE", "LastLedgerSequence must be a UInt32 integer.", "LastLedgerSequence");
  if (policy.requireLastLedgerSequence && ledger === undefined) error("LEDGER_SEQUENCE_REQUIRED", "LastLedgerSequence is required by policy.", "LastLedgerSequence");
  const current = policy.validatedLedgerIndex;
  if (current !== undefined && !isLedgerIndex(current)) error("INVALID_POLICY", "validatedLedgerIndex must be a UInt32 integer.");
  if (policy.maxLedgerOffset !== undefined && (!isLedgerIndex(policy.maxLedgerOffset) || current === undefined)) {
    error("INVALID_POLICY", "maxLedgerOffset requires a validated ledger index and a non-negative integer offset.");
  }
  if (isLedgerIndex(ledger) && isLedgerIndex(current)) {
    if (ledger <= current) error("TRANSACTION_EXPIRED", "LastLedgerSequence is not ahead of the validated ledger.", "LastLedgerSequence");
    if (policy.maxLedgerOffset !== undefined && isLedgerIndex(policy.maxLedgerOffset) && ledger - current > policy.maxLedgerOffset) {
      error("LEDGER_WINDOW_EXCEEDED", "LastLedgerSequence exceeds the permitted ledger window.", "LastLedgerSequence");
    }
  } else if (isLedgerIndex(ledger) && current === undefined) {
    issues.push({ code: "LEDGER_FRESHNESS_UNKNOWN", severity: "warning", message: "No validated ledger index was supplied; expiry cannot be checked.", field: "LastLedgerSequence" });
  }
  if (policy.maxLedgerOffset !== undefined && ledger === undefined) error("LEDGER_SEQUENCE_REQUIRED", "LastLedgerSequence is required to enforce the ledger window.", "LastLedgerSequence");
  // Run checks in declaration order so diagnostics do not depend on network timing.
  for (const check of policy.checks ?? []) {
    try {
      const result = await check(context);
      const findings = result === undefined ? [] : Array.isArray(result) ? result : [result];
      for (const finding of findings) {
        if (!finding || typeof finding.code !== "string" || typeof finding.message !== "string"
          || (finding.severity !== "error" && finding.severity !== "warning")) {
          error("INVALID_CHECK_RESULT", "A preflight check returned an invalid diagnostic.");
        } else issues.push({ ...finding });
      }
    } catch {
      error("CHECK_FAILED", "An application preflight check failed; the wallet was not invoked.");
    }
  }
  return { enabled: true, allowed: !issues.some(issue => issue.severity === "error"), issues };
}

/** Isolate caller input and prevent asynchronous checks from rewriting transaction intent. */
export function snapshotPreflightValue<T>(value: T): T {
  const copy = structuredClone(value);
  const seen = new WeakSet<object>();
  function freeze(item: unknown): void {
    if (!item || typeof item !== "object" || seen.has(item)) return;
    seen.add(item);
    Object.values(item).forEach(freeze);
    Object.freeze(item);
  }
  freeze(copy);
  return copy;
}
