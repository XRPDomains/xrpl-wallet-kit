import type { TxResult } from "./types";

export function pickPath(source: unknown, paths: string[]): unknown {
  if (!source || typeof source !== "object") return undefined;
  for (const path of paths) {
    const value = path.split(".").reduce<unknown>((current, key) => {
      if (!current || typeof current !== "object") return undefined;
      return (current as Record<string, unknown>)[key];
    }, source);
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return undefined;
}

export function normalizeTxResult(raw: unknown): TxResult {
  if (typeof raw === "string") {
    return {
      hash: raw,
      signed: true,
      raw
    };
  }

  const hash = pickPath(raw, [
    "hash",
    "txid",
    "txHash",
    "tx_hash",
    "transactionHash",
    "transaction_hash",
    "tx_json.hash",
    "result.hash",
    "result.txid",
    "result.txHash",
    "result.tx_hash",
    "result.transactionHash",
    "result.transaction_hash",
    "result.tx_json.hash",
    "payload.hash",
    "payload.txid",
    "payload.txHash",
    "payload.tx_hash",
    "payload.transactionHash",
    "payload.transaction_hash",
    "response.hash",
    "response.txid",
    "response.txHash",
    "response.tx_hash",
    "response.transactionHash",
    "response.transaction_hash",
    "response.data.hash",
    "response.data.txid",
    "response.data.txHash",
    "response.data.tx_hash",
    "response.data.transactionHash",
    "response.data.transaction_hash",
    "response.data.result.hash",
    "response.data.result.txid",
    "response.data.result.txHash",
    "response.data.result.tx_hash",
    "response.data.result.transactionHash",
    "response.data.result.transaction_hash",
    "response.data.result.tx_json.hash",
    "response.data.resp.result.hash",
    "result.response.hash",
    "result.response.txid",
    "result.response.txHash",
    "result.response.tx_hash",
    "result.response.transactionHash",
    "result.response.transaction_hash",
    "result.response.data.hash",
    "result.response.data.txid",
    "result.response.data.txHash",
    "result.response.data.tx_hash",
    "result.response.data.transactionHash",
    "result.response.data.transaction_hash",
    "result.response.data.result.hash"
  ]);
  const status = pickPath(raw, ["status", "result", "engine_result", "result.engine_result", "result.meta.TransactionResult", "response.data.resp.result.meta.TransactionResult"]);
  const signed = pickPath(raw, ["signed"]);
  const rejected = pickPath(raw, ["rejected"]);
  return {
    hash: typeof hash === "string" ? hash : undefined,
    status: typeof status === "string" ? status : undefined,
    signed: typeof signed === "boolean" ? signed : status === "tesSUCCESS" || Boolean(hash),
    rejected: typeof rejected === "boolean" ? rejected : undefined,
    raw
  };
}

export function isSuccessResult(result: TxResult): boolean {
  return result.status === "tesSUCCESS" || Boolean(result.hash && !result.rejected);
}
