import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import test from "node:test";
import codec from "xahau-binary-codec";
import xrpl from "xrpl";
import { checkPreparedFee, createTestnetReader } from "./rpc-policy.mjs";

const require = createRequire(import.meta.url);
const definitions = new codec.XrplDefinitions(JSON.parse(readFileSync(join(dirname(require.resolve("xahau-binary-codec")), "enums", "definitions.json"), "utf8")));
const runtime = { encode: tx => codec.encode(tx, definitions), decode: blob => codec.decode(blob, definitions) };
// Public deterministic offline fixture only.
const wallet = xrpl.Wallet.fromEntropy(Uint8Array.from({ length: 16 }, (_, i) => i + 1));
const tx = { TransactionType: "Payment", Account: wallet.address, Destination: wallet.address, Amount: "1", Fee: "20", Sequence: 1, LastLedgerSequence: 110, NetworkID: 21338, SigningPubKey: wallet.publicKey };
const policy = { account: wallet.address, networkId: 21338, maxFeeDrops: "100" };
const replies = () => [
  { info: { network_id: 21338, validated_ledger: { seq: 100, age: 1 } } },
  { validated: true, ledger_index: 100, account_data: { Account: wallet.address, Sequence: 1 } },
  { drops: { base_fee: "10", open_ledger_fee: "15" } },
  { info: { network_id: 21338, validated_ledger: { seq: 101, age: 1 } } }
];
function mock(results) {
  const calls = [];
  const reader = createTestnetReader(async (url, options) => {
    assert.equal(url, "https://xahau-test.net");
    assert.equal(options.redirect, "error");
    assert.ok(options.signal instanceof AbortSignal);
    calls.push(JSON.parse(options.body));
    assert.ok(results.length, "unexpected RPC request");
    return { ok: true, json: async () => ({ result: results.shift() }) };
  });
  return { calls, reader };
}

test("fee policy checks network first, queries exact tx and leaves approved Fee unchanged", async () => {
  const { calls, reader } = mock(replies());
  const before = structuredClone(tx);
  const result = await checkPreparedFee(runtime, definitions, tx, policy, reader);
  assert.equal(result.requiredFeeDrops, "15");
  assert.deepEqual(calls.map(call => call.method), ["server_info", "account_info", "fee", "server_info"]);
  assert.deepEqual(runtime.decode(calls[2].params[0].tx_blob), { ...tx, Fee: "0", SigningPubKey: "" });
  assert.deepEqual(tx, before);
});

test("wrong chain and stale ledger stop before account/fee queries", async () => {
  for (const info of [
    { network_id: 0, validated_ledger: { seq: 100, age: 1 } },
    { network_id: 21338, validated_ledger: { seq: 100, age: 31 } },
    { network_id: 21338, validated_ledger: { seq: 110, age: 1 } }
  ]) {
    const { reader, calls } = mock([{ info }]);
    await assert.rejects(checkPreparedFee(runtime, definitions, tx, policy, reader));
    assert.equal(calls.length, 1);
  }
});

test("Invoke fee query preserves HookParameters and applies transaction-aware base fee", async () => {
  const invoke = { ...tx, TransactionType: "Invoke", Fee: "30", HookParameters: [{ HookParameter: { HookParameterName: "AB", HookParameterValue: "01" } }] };
  delete invoke.Amount;
  const results = replies();
  results[2].drops = { base_fee: "25", open_ledger_fee: "10" };
  const { reader, calls } = mock(results);
  const quote = await checkPreparedFee(runtime, definitions, invoke, policy, reader);
  assert.equal(quote.requiredFeeDrops, "25");
  assert.deepEqual(runtime.decode(calls[2].params[0].tx_blob), { ...invoke, Fee: "0", SigningPubKey: "" });
});

test("rejects account changes, malformed fees, fee cap, underfunded fee and changed final chain", async () => {
  for (const mutate of [
    r => { r[1].account_data.Sequence = 2; },
    r => { r[1].validated = false; },
    r => { r[2].drops.base_fee = "01"; },
    r => { r[2].drops.open_ledger_fee = "101"; },
    r => { r[2].drops.open_ledger_fee = "21"; },
    r => { r[3].info.network_id = 21337; },
    r => { r[3].info.validated_ledger.seq = 99; }
  ]) {
    const results = replies();
    mutate(results);
    await assert.rejects(checkPreparedFee(runtime, definitions, tx, policy, mock(results).reader));
  }
});

test("RPC boundary forbids submit and wraps transport/HTTP/RPC failures", async () => {
  const { reader, calls } = mock([]);
  await assert.rejects(reader("submit"), { code: "PREFLIGHT_FAILED" });
  assert.equal(calls.length, 0);
  for (const fetcher of [
    async () => { throw new Error("timeout/redirect"); },
    async () => ({ ok: false, status: 503 }),
    async () => ({ ok: true, json: async () => ({ result: { error: "noNetwork" } }) })
  ]) await assert.rejects(createTestnetReader(fetcher)("server_info"), { code: "PREFLIGHT_FAILED" });
});
