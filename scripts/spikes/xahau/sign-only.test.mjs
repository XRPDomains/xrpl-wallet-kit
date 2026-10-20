import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import test from "node:test";
import codec from "xahau-binary-codec";
import xrpl from "xrpl";
import keypairs from "ripple-keypairs";
import { signOnly } from "./sign-only.mjs";

const require = createRequire(import.meta.url);
const definitions = new codec.XrplDefinitions(JSON.parse(readFileSync(join(dirname(require.resolve("xahau-binary-codec")), "enums", "definitions.json"), "utf8")));
const runtime = { encode: tx => codec.encode(tx, definitions), decode: blob => codec.decode(blob, definitions), signingData: tx => codec.encodeForSigning(tx, definitions) };
// Public offline key only. Never fund.
const wallet = xrpl.Wallet.fromEntropy(Uint8Array.from({ length: 16 }, (_, i) => i + 1));
const tx = { TransactionType: "Payment", Account: wallet.address, Destination: wallet.address, Amount: "1", Fee: "20", Sequence: 1, LastLedgerSequence: 110, NetworkID: 21338, SigningPubKey: wallet.publicKey };
const policy = { account: wallet.address, networkId: 21338, maxFeeDrops: "100" };
const signed = input => ({ txBlob: runtime.encode({ ...input, TxnSignature: keypairs.sign(runtime.signingData(input), wallet.privateKey) }) });
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
function fixture() {
  const state = { session: { adapterId: "offline-fixture", revision: 1, family: "xahau", networkId: 21338, account: wallet.address }, calls: [], fee: "10", sequence: 1, ledger: 100 };
  const options = {
    runtime, definitions, input: structuredClone(tx), policy: structuredClone(policy),
    getSession: () => state.session,
    reader: async method => {
      state.calls.push(method);
      if (method === "server_info") return { info: { network_id: 21338, validated_ledger: { seq: state.ledger, age: 1 } } };
      if (method === "account_info") return { validated: true, ledger_index: state.ledger, account_data: { Account: wallet.address, Sequence: state.sequence } };
      if (method === "fee") return { drops: { base_fee: state.fee, open_ledger_fee: state.fee } };
      assert.fail("unexpected RPC method");
    },
    dispatch: async ({ txJson, submit }) => { assert.equal(submit, false); state.calls.push("sign"); return signed(txJson); }
  };
  return { state, options };
}

test("sign-only verifies result and rechecks account/fee/ledger after approval", async () => {
  const { state, options } = fixture();
  const result = await signOnly(options);
  assert.equal(result.txBlob, signed(tx).txBlob);
  assert.equal(result.hash.length, 64);
  assert.deepEqual(state.calls, ["server_info", "account_info", "fee", "server_info", "sign", "server_info", "account_info", "fee", "server_info"]);
});

test("session changes during preflight prevent any wallet dispatch", async () => {
  for (const change of [s => { s.session.networkId = 21337; }, s => { s.session = null; }, s => { s.session.revision += 1; }]) {
    const { state, options } = fixture();
    const reader = options.reader;
    options.reader = async method => { const result = await reader(method); change(state); return result; };
    await assert.rejects(signOnly(options), { code: "REQUEST_CANCELLED" });
    assert.ok(!state.calls.includes("sign"));
  }
});

test("late signature from a replaced session or wrong family is never returned", async () => {
  const { state, options } = fixture();
  options.dispatch = async ({ txJson }) => { state.session.revision += 1; return signed(txJson); };
  await assert.rejects(signOnly(options), { code: "REQUEST_CANCELLED" });
  const second = fixture();
  second.state.session.family = "xrpl";
  await assert.rejects(signOnly(second.options), { code: "NETWORK_MISMATCH" });
  assert.equal(second.state.calls.length, 0);
});

test("approval-time fee, sequence and expiry changes discard otherwise valid blobs", async () => {
  for (const change of [s => { s.fee = "21"; }, s => { s.sequence = 2; }, s => { s.ledger = 110; }]) {
    const { state, options } = fixture();
    options.dispatch = async ({ txJson }) => { change(state); return signed(txJson); };
    await assert.rejects(signOnly(options), { code: "PREFLIGHT_FAILED" });
  }
});

test("provider mutation cannot change frozen intent or fee policy", async () => {
  const { options } = fixture();
  options.dispatch = async ({ txJson }) => {
    options.input.Amount = "2";
    options.policy.maxFeeDrops = "999";
    txJson.Amount = "2";
    return signed(txJson);
  };
  await assert.rejects(signOnly(options), { code: "PREFLIGHT_FAILED" });
});

test("cancellation rejects promptly even when provider ignores AbortSignal", async () => {
  const { state, options } = fixture();
  const started = deferred();
  const reply = deferred();
  const controller = new AbortController();
  options.signal = controller.signal;
  options.dispatch = ({ signal }) => { started.resolve(signal); return reply.promise; };
  const pending = signOnly(options);
  const providerSignal = await started.promise;
  controller.abort();
  await assert.rejects(pending, { code: "REQUEST_CANCELLED" });
  assert.equal(providerSignal.aborted, true);
  reply.resolve(signed(tx));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(state.calls.length, 4, "no post-approval RPC after cancellation");
});

test("already-aborted requests never reach RPC or provider; timeout rejects hung provider", async () => {
  const first = fixture();
  const controller = new AbortController();
  controller.abort();
  first.options.signal = controller.signal;
  await assert.rejects(signOnly(first.options), { code: "REQUEST_CANCELLED" });
  assert.equal(first.state.calls.length, 0);
  const second = fixture();
  second.options.timeoutMs = 50;
  second.options.dispatch = () => new Promise(() => {});
  await assert.rejects(signOnly(second.options), { code: "REQUEST_TIMEOUT" });
});

test("cancellation during a pending RPC prevents subsequent queries and wallet dispatch", async () => {
  const { state, options } = fixture();
  const started = deferred();
  const reply = deferred();
  const controller = new AbortController();
  options.signal = controller.signal;
  options.reader = method => { state.calls.push(method); started.resolve(); return reply.promise; };
  const pending = signOnly(options);
  await started.promise;
  controller.abort();
  await assert.rejects(pending, { code: "REQUEST_CANCELLED" });
  reply.resolve({ info: { network_id: 21338, validated_ledger: { seq: 100, age: 1 } } });
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(state.calls, ["server_info"]);
});

test("malformed wallet replies are rejected before post-approval RPC", async () => {
  for (const result of [undefined, { txBlob: "00".repeat(64) }, { ...signed(tx), hash: "00".repeat(32) }]) {
    const { state, options } = fixture();
    options.dispatch = async () => result;
    await assert.rejects(signOnly(options), { code: "PREFLIGHT_FAILED" });
    assert.equal(state.calls.length, 4);
  }
});
