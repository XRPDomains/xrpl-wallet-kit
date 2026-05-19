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

  const hash = pickPath(raw, ["hash", "txid", "tx_json.hash", "result.hash", "result.tx_json.hash", "response.data.resp.result.hash"]);
  const status = pickPath(raw, ["status", "result", "engine_result", "result.engine_result", "result.meta.TransactionResult", "response.data.resp.result.meta.TransactionResult"]);
  return {
    hash: typeof hash === "string" ? hash : undefined,
    status: typeof status === "string" ? status : undefined,
    signed: status === "tesSUCCESS" || Boolean(hash),
    raw
  };
}

export function isSuccessResult(result: TxResult): boolean {
  return result.status === "tesSUCCESS" || Boolean(result.hash && !result.rejected);
}
