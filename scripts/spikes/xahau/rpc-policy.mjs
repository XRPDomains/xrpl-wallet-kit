import { WalletKitError, WalletKitErrorCode } from "../../../packages/core/src/errors.ts";
import { prepareIntent } from "./boundary.mjs";

const endpoint = "https://xahau-test.net";
const networkId = 21338;
const allowed = new Set(["server_info", "account_info", "fee"]);
const fail = message => new WalletKitError(WalletKitErrorCode.PREFLIGHT_FAILED, message);
const uint32 = value => Number.isInteger(value) && value >= 0 && value <= 0xFFFFFFFF;
const drops = value => typeof value === "string" && /^[1-9][0-9]{0,17}$/.test(value);

// Fixed testnet research client: no wallet-selected URL, redirects or submit API.
export function createTestnetReader(fetcher = globalThis.fetch) {
  return async (method, params = {}) => {
    if (!allowed.has(method)) throw fail("Read-only M0 RPC method required");
    try {
      const response = await fetcher(endpoint, {
        method: "POST", redirect: "error", headers: { "content-type": "application/json" },
        body: JSON.stringify({ method, params: [params] }), signal: AbortSignal.timeout(10000)
      });
      if (!response.ok) throw fail(`RPC HTTP ${response.status}`);
      const body = await response.json();
      if (!body?.result || body.error || body.result.error || body.result.status === "error") throw fail("RPC returned an error or missing result");
      return body.result;
    } catch (cause) {
      if (cause instanceof WalletKitError) throw cause;
      throw new WalletKitError(WalletKitErrorCode.PREFLIGHT_FAILED, "Read-only M0 RPC failed", { cause });
    }
  };
}

export async function checkPreparedFee(runtime, definitions, input, policy, reader = createTestnetReader()) {
  if (policy.networkId !== networkId) throw fail("M0 RPC policy supports testnet 21338 only");
  const tx = prepareIntent(runtime, definitions, input, policy);
  const getLedger = async () => {
    const { info } = await reader("server_info");
    if (info?.network_id !== networkId) throw new WalletKitError(WalletKitErrorCode.NETWORK_MISMATCH, "RPC is not the expected Xahau testnet");
    const ledger = info.validated_ledger;
    if (!uint32(ledger?.seq) || !Number.isFinite(ledger.age) || ledger.age < 0 || ledger.age > 30) throw fail("RPC validated ledger is missing or stale");
    if (tx.LastLedgerSequence <= ledger.seq || tx.LastLedgerSequence > ledger.seq + 20) throw fail("Transaction expiry is outside the M0 ledger window");
    return ledger.seq;
  };
  const firstLedger = await getLedger();
  const account = await reader("account_info", { account: tx.Account, ledger_index: "validated" });
  if (account.validated !== true || !uint32(account.ledger_index) || account.ledger_index < firstLedger ||
      account.account_data?.Account !== tx.Account || account.account_data?.Sequence !== tx.Sequence) throw fail("Validated account or sequence mismatch");
  // Measure the same transaction fields; zero Fee / empty key are query-only.
  const fee = await reader("fee", { tx_blob: runtime.encode({ ...tx, Fee: "0", SigningPubKey: "" }) });
  if (!drops(fee.drops?.base_fee) || !drops(fee.drops?.open_ledger_fee)) throw fail("Missing canonical transaction-aware fee values");
  const required = [BigInt(fee.drops.base_fee), BigInt(fee.drops.open_ledger_fee)].reduce((a, b) => a > b ? a : b);
  if (required > BigInt(policy.maxFeeDrops)) throw fail("Estimated fee exceeds caller maximum; do not request a signature");
  if (BigInt(tx.Fee) < required) throw fail("Prepared fee is below estimate; explicitly prepare and approve a new intent");
  const lastLedger = await getLedger();
  if (lastLedger < account.ledger_index) throw fail("RPC ledger moved backwards");
  return { endpoint, networkId, validatedLedger: lastLedger, requiredFeeDrops: required.toString(), preparedFeeDrops: tx.Fee };
}
