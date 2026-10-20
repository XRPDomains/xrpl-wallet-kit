import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";
import codec from "xahau-binary-codec";
import xahau from "xahau";
import xrpl from "xrpl";
import keypairs from "ripple-keypairs";

const require = createRequire(import.meta.url);
const definitionsPath = join(dirname(require.resolve("xahau-binary-codec")), "enums", "definitions.json");
const definitions = JSON.parse(readFileSync(definitionsPath, "utf8"));
const makeCodec = () => {
  const instance = new codec.XrplDefinitions(structuredClone(definitions));
  return {
    encode: tx => codec.encode(tx, instance),
    decode: blob => codec.decode(blob, instance),
    signingData: tx => codec.encodeForSigning(tx, instance)
  };
};

// Public deterministic OFFLINE fixtures only. Never fund these accounts.
const fixture = xrpl.Wallet.fromEntropy(Uint8Array.from({ length: 16 }, (_, index) => index + 1));
const destination = xrpl.Wallet.fromEntropy(Uint8Array.from({ length: 16 }, (_, index) => index + 32)).address;
const candidateWallet = xahau.Wallet.fromSeed(fixture.seed);
const params = [{ HookParameter: { HookParameterName: "414354494F4E", HookParameterValue: "01" } }];
const payment = {
  TransactionType: "Payment", Account: fixture.address, Destination: destination,
  Amount: "1", Fee: "100000", Sequence: 1, LastLedgerSequence: 1000,
  NetworkID: 21338, Flags: 2147483648, SigningPubKey: fixture.publicKey
};
const vectors = [payment, { ...payment, HookParameters: params }, {
  TransactionType: "Invoke", Account: fixture.address, Destination: destination,
  Fee: "100000", Sequence: 2, LastLedgerSequence: 1000, NetworkID: 21338,
  Flags: 2147483648, SigningPubKey: fixture.publicKey, HookParameters: params
}];
const expectedHashes = [
  "D3DA622D2E17129F757C17C827222835A0B229023D6CEFE696D396014966A89A",
  "5EF11E91464A9099DF6F6754D351FD01438CA2A440F2847B68B49AB54E74E72F",
  "C7BB9725DC4BA5887426985922016118F42C69613AA17E154D94454CF7F63A9D"
];

// Spike-only strict boundary for canonical, fully prepared fixtures. Not a public runtime.
function strictEncode(runtime, input) {
  const snapshot = structuredClone(input);
  const blob = runtime.encode(snapshot);
  assert.deepEqual(runtime.decode(blob), snapshot, "codec dropped or normalized input fields; reject before signing");
  return blob;
}

function hashBlob(blob) {
  return createHash("sha512").update(Buffer.from("54584E00" + blob, "hex")).digest("hex").slice(0, 64).toUpperCase();
}

function verifyFixture(runtime, blob, expected) {
  const signed = runtime.decode(blob);
  const { TxnSignature, ...intent } = signed;
  assert.deepEqual(intent, expected, "signed transaction changed the prepared intent");
  assert.equal(intent.NetworkID, 21338);
  assert.equal(keypairs.deriveAddress(intent.SigningPubKey), intent.Account);
  assert.equal(keypairs.verify(runtime.signingData(intent), TxnSignature, intent.SigningPubKey), true);
  return hashBlob(blob);
}

test("candidate packages import without browser globals or a network request", () => {
  execFileSync(process.execPath, ["--input-type=module", "-e", `
    import assert from 'node:assert/strict';
    globalThis.fetch = () => { assert.fail('unexpected fetch'); };
    assert.equal(typeof window, 'undefined');
    assert.equal(typeof document, 'undefined');
    assert.equal(typeof localStorage, 'undefined');
    await import('xahau-binary-codec');
    await import('xahau');
  `], { cwd: dirname(fileURLToPath(import.meta.url)), stdio: "pipe" });
});

for (const [index, vector] of vectors.entries()) {
  test(`offline vector ${index + 1}: ${vector.TransactionType}${vector.HookParameters ? " + HookParameters" : ""}`, () => {
    const runtime = makeCodec();
    const before = structuredClone(vector);
    const unsigned = strictEncode(runtime, vector);
    assert.deepEqual(runtime.decode(unsigned), vector);
    const signature = keypairs.sign(runtime.signingData(vector), fixture.privateKey);
    const blob = runtime.encode({ ...vector, TxnSignature: signature });
    const hash = verifyFixture(runtime, blob, vector);
    assert.equal(hash, expectedHashes[index]);
    const reference = candidateWallet.sign(structuredClone(vector));
    assert.equal(reference.tx_blob, blob);
    assert.equal(reference.hash, hash);
    assert.deepEqual(vector, before, "input must not be mutated");
  });
}

test("negative vectors reject intent, network, fee, key and signature substitution", () => {
  const runtime = makeCodec();
  const expected = vectors[2];
  const sign = tx => runtime.encode({ ...tx, TxnSignature: keypairs.sign(runtime.signingData(tx), fixture.privateKey) });
  for (const tx of [
    { ...expected, Destination: fixture.address },
    { ...expected, NetworkID: 21337 },
    { ...expected, Fee: "200000" },
    { ...expected, HookParameters: [{ HookParameter: { HookParameterName: "414354494F4E", HookParameterValue: "02" } }] }
  ]) assert.throws(() => verifyFixture(runtime, sign(tx), expected));
  const blob = sign(expected);
  const decoded = runtime.decode(blob);
  assert.throws(() => verifyFixture(runtime, runtime.encode({ ...decoded, TxnSignature: "00".repeat(64) }), expected));
  const forged = { ...expected, SigningPubKey: candidateWallet.publicKey, Account: destination };
  assert.throws(() => verifyFixture(runtime, sign(forged), forged));
  assert.notEqual(hashBlob(blob), hashBlob(blob + "00"));
});

test("raw codec drops unknown fields: strict roundtrip boundary must reject them", () => {
  const runtime = makeCodec();
  const unknownTopLevel = { ...payment, UnrecognizedIntentField: "01" };
  const unknownNested = { ...payment, HookParameters: [{ HookParameter: {
    HookParameterName: "414354494F4E", HookParameterValue: "01", UnrecognizedIntentField: "02"
  } }] };
  for (const tx of [unknownTopLevel, unknownNested]) {
    assert.notDeepEqual(runtime.decode(runtime.encode(tx)), tx);
    assert.throws(() => strictEncode(runtime, tx));
  }
});

test("explicit definition contexts do not change XRPL encoding during interleaved work", async () => {
  const xrplTx = { ...payment };
  delete xrplTx.NetworkID;
  const baseline = xrpl.encode(xrplTx);
  const baselineJson = xrpl.decode(baseline);
  const first = makeCodec();
  const second = makeCodec();
  await Promise.all(Array.from({ length: 12 }, async (_, index) => {
    const runtime = index % 2 === 0 ? first : second;
    assert.deepEqual(runtime.decode(strictEncode(runtime, vectors[index % vectors.length])), vectors[index % vectors.length]);
    assert.equal(xrpl.encode(xrplTx), baseline);
    assert.deepEqual(xrpl.decode(baseline), baselineJson);
  }));
  assert.equal(xrpl.encode(xrplTx), baseline);
});
