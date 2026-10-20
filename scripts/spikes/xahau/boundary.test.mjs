import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import test from "node:test";
import codec from "xahau-binary-codec";
import xrpl from "xrpl";
import keypairs from "ripple-keypairs";
import { prepareIntent, verifySignedBlob } from "./boundary.mjs";

const require = createRequire(import.meta.url);
const definitions = new codec.XrplDefinitions(JSON.parse(readFileSync(join(dirname(require.resolve("xahau-binary-codec")), "enums", "definitions.json"), "utf8")));
const runtime = { encode: tx => codec.encode(tx, definitions), decode: blob => codec.decode(blob, definitions), signingData: tx => codec.encodeForSigning(tx, definitions) };
// Public offline keys only; never fund.
const wallet = xrpl.Wallet.fromEntropy(Uint8Array.from({ length: 16 }, (_, i) => i + 1));
const tx = { TransactionType: "Payment", Account: wallet.address, Destination: wallet.address, Amount: "1", Fee: "100000", Sequence: 1, LastLedgerSequence: 1000, NetworkID: 21338, Flags: 2147483648, SigningPubKey: wallet.publicKey };
const policy = { account: wallet.address, networkId: 21338, maxFeeDrops: "100000" };
const prepare = input => prepareIntent(runtime, definitions, input, policy);
const sign = input => runtime.encode({ ...input, TxnSignature: keypairs.sign(runtime.signingData(input), wallet.privateKey) });
const verify = (blob, expected = tx, hash) => verifySignedBlob(runtime, definitions, blob, expected, policy, hash);

test("strict subset accepts canonical Payment/Invoke without mutating input", () => {
  const invoke = { ...tx, TransactionType: "Invoke", HookParameters: [{ HookParameter: { HookParameterName: "AB", HookParameterValue: "01" } }] };
  delete invoke.Amount;
  for (const input of [tx, invoke]) {
    const before = structuredClone(input);
    const prepared = prepare(input);
    assert.notEqual(prepared, input);
    const result = verify(sign(prepared), prepared);
    assert.equal(verify(result.txBlob, prepared, result.hash).hash, result.hash);
    assert.deepEqual(input, before);
  }
});

test("rejects typos, misplaced known fields, wrapper extras and implicit normalization", () => {
  const params = body => ({ ...tx, HookParameters: [{ HookParameter: body }] });
  for (const input of [
    { ...tx, Amout: "1" }, { ...tx, MemoData: "AB" }, { ...tx, SourceTag: undefined },
    { ...tx, Amount: 1 }, { ...tx, Fee: "010" }, { ...tx, Destination: xrpl.classicAddressToXAddress(wallet.address, 1, false) },
    params({ HookParameterName: "AB", HookParameterVale: "01" }),
    params({ HookParameterName: "ab", HookParameterValue: "01" }),
    params({ HookParameterName: "AB", HookParameterValue: "01", Account: wallet.address }),
    { ...tx, HookParameters: [{ HookParameter: { HookParameterName: "AB", HookParameterValue: "01" }, Memo: {} }] },
    { ...tx, HookParameters: new Array(1) }, { ...tx, Memos: [{ Memo: { MemoData: undefined } }] },
    { ...tx, Fee: "100001" }, { ...tx, NetworkID: 21337 }, { ...tx, SigningPubKey: "" }
  ]) assert.throws(() => prepare(input), { code: "INVALID_REQUEST" });
});

test("rejects unsigned/compact responses, modified intent, forged signature and wallet hash", () => {
  for (const blob of [runtime.encode(tx), "00".repeat(64), sign({ ...tx, Amount: "2" }), sign({ ...tx, NetworkID: 21337 }), sign({ ...tx, Fee: "100001" }), runtime.encode({ ...tx, TxnSignature: "00".repeat(64) }), sign(tx) + "00"]) {
    assert.throws(() => verify(blob), { code: "PREFLIGHT_FAILED" });
  }
  assert.throws(() => verify(sign(tx), tx, "00".repeat(32)), { code: "PREFLIGHT_FAILED" });
});

test("rejects accessor, symbol and cyclic payloads without executing getters", () => {
  const accessor = { ...tx };
  Object.defineProperty(accessor, "Amount", { enumerable: true, get() { assert.fail("getter executed"); } });
  const typeAccessor = { ...tx };
  Object.defineProperty(typeAccessor, "TransactionType", { enumerable: true, get() { assert.fail("type getter executed"); } });
  const cycle = { ...tx };
  cycle.HookParameters = [{ HookParameter: cycle }];
  for (const input of [accessor, typeAccessor, { ...tx, [Symbol("hidden")]: "AB" }, cycle]) assert.throws(() => prepare(input), { code: "INVALID_REQUEST" });
});
