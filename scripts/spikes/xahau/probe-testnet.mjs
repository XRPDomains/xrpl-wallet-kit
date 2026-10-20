import assert from "node:assert/strict";
import codec from "xahau-binary-codec";

// Read-only, fixed testnet endpoint. Never signs or submits a transaction.
const endpoint = "https://xahau-test.net";
const allowed = new Set(["server_info", "server_definitions", "account_info", "fee"]);
async function rpc(method, params = {}) {
  assert.ok(allowed.has(method), "read-only probe method required");
  const response = await fetch(endpoint, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ method, params: [params] }), signal: AbortSignal.timeout(10000)
  });
  assert.equal(response.ok, true, `HTTP ${response.status}`);
  const body = await response.json();
  assert.ok(body.result && !body.result.error, body.result?.error ?? "missing result");
  return body.result;
}

const info = (await rpc("server_info")).info;
assert.equal(info.network_id, 21338, "do not probe fees on another network");
const definitions = await rpc("server_definitions");
const account = "rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh";
const accountInfo = await rpc("account_info", { account, ledger_index: "validated" });
const common = {
  Account: account, Destination: "rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe",
  Fee: "0", Sequence: accountInfo.account_data.Sequence,
  LastLedgerSequence: info.validated_ledger.seq + 20, NetworkID: 21338, SigningPubKey: ""
};
const fees = [];
for (const tx of [{ ...common, TransactionType: "Payment", Amount: "1" }, {
  ...common, TransactionType: "Invoke", HookParameters: [{ HookParameter: {
    HookParameterName: "414354494F4E", HookParameterValue: "01"
  } }]
}]) {
  try {
    const result = await rpc("fee", { tx_blob: codec.encode(tx) });
    fees.push({ transactionType: tx.TransactionType, drops: result.drops });
  } catch (error) {
    fees.push({ transactionType: tx.TransactionType, error: error instanceof Error ? error.message : String(error) });
  }
}
console.log(JSON.stringify({ checkedAt: new Date().toISOString(), endpoint, networkId: info.network_id,
  serverVersion: info.build_version, validatedLedger: info.validated_ledger.seq,
  definitionsHash: definitions.hash, invokeType: definitions.TRANSACTION_TYPES?.Invoke, fees }, null, 2));
