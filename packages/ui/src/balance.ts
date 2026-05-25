import { getHttpRpcUrl, getNativeAsset } from "@xrpl-wallet-kit/core";
import type { WalletBalance, WalletBalanceResolver } from "./types";

const FALLBACK_RESERVE_BASE_DROPS = 10_000_000;
const FALLBACK_RESERVE_INC_DROPS = 2_000_000;

export function createXrpBalanceResolver(): WalletBalanceResolver {
  return async ({ address, network }) => {
    if (!network?.rpcUrl) return null;
    const symbol = getNativeAsset(network);
    const endpoint = getHttpRpcUrl(network);
    if (!endpoint) return null;
    const accountInfo = await rpc<AccountInfoResult>(endpoint, {
      method: "account_info",
      params: [{ account: address, ledger_index: "validated" }]
    });

    if (accountInfo.result?.error === "actNotFound") {
      return {
        value: "0",
        formatted: `0 ${symbol}`,
        symbol,
        activationStatus: "unfunded",
        available: "0",
        availableFormatted: `0 ${symbol}`,
        total: "0",
        totalFormatted: `0 ${symbol}`,
        reserve: "0",
        ownerCount: 0,
        raw: accountInfo
      };
    }

    const accountData = accountInfo.result?.account_data;
    const balanceDrops = parseDrops(accountData?.Balance);
    if (balanceDrops == null || accountInfo.result?.error) return null;

    const ownerCount = accountData?.OwnerCount ?? 0;
    const reserveInfo = await resolveReserve(endpoint).catch(() => ({
      baseDrops: FALLBACK_RESERVE_BASE_DROPS,
      incDrops: FALLBACK_RESERVE_INC_DROPS
    }));
    const reserveDrops = reserveInfo.baseDrops + ownerCount * reserveInfo.incDrops;
    const availableDrops = Math.max(balanceDrops - reserveDrops, 0);

    const available = formatDrops(availableDrops);
    const total = formatDrops(balanceDrops);
    const reserve = formatDrops(reserveDrops);

    return {
      value: available,
      formatted: `${available} ${symbol}`,
      symbol,
      activationStatus: "active",
      available,
      availableFormatted: `${available} ${symbol}`,
      total,
      totalFormatted: `${total} ${symbol}`,
      reserve,
      ownerCount,
      raw: { accountInfo, reserveInfo }
    } satisfies WalletBalance;
  };
}

async function rpc<T>(endpoint: string, payload: unknown): Promise<T> {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error(`Wallet RPC request failed: ${response.status}`);
  return response.json() as Promise<T>;
}

async function resolveReserve(endpoint: string): Promise<{ baseDrops: number; incDrops: number }> {
  const serverState = await rpc<ServerStateResult>(endpoint, { method: "server_state", params: [] });
  const ledger = serverState.result?.state?.validated_ledger;
  const baseDrops = parseReserveDrops(ledger?.reserve_base, ledger?.reserve_base_xrp, FALLBACK_RESERVE_BASE_DROPS);
  const incDrops = parseReserveDrops(ledger?.reserve_inc, ledger?.reserve_inc_xrp, FALLBACK_RESERVE_INC_DROPS);
  return { baseDrops, incDrops };
}


function parseDrops(value: string | number | undefined): number | null {
  if (value == null) return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseReserveDrops(drops: string | number | undefined, xrp: string | number | undefined, fallback: number): number {
  const parsedDrops = parseDrops(drops);
  if (parsedDrops != null) return parsedDrops;
  const parsedXrp = parseDrops(xrp);
  if (parsedXrp != null) return Math.round(parsedXrp * 1_000_000);
  return fallback;
}

function formatDrops(drops: number): string {
  return formatXrpBalance(drops / 1_000_000);
}

function formatXrpBalance(value: number): string {
  if (!Number.isFinite(value)) return "0";
  const precision = value >= 100 ? 2 : value >= 1 ? 4 : 6;
  return value.toLocaleString("en-US", {
    maximumFractionDigits: precision,
    minimumFractionDigits: 0
  });
}

interface AccountInfoResult {
  result?: {
    account_data?: {
      Balance?: string;
      OwnerCount?: number;
    };
    error?: string;
  };
}

interface ServerStateResult {
  result?: {
    state?: {
      validated_ledger?: {
        reserve_base?: string | number;
        reserve_base_xrp?: string | number;
        reserve_inc?: string | number;
        reserve_inc_xrp?: string | number;
      };
    };
  };
}
