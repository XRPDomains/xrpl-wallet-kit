import assert from "node:assert/strict";
import test from "node:test";
import { Wallet, decode } from "xrpl";
import { formatAuthMessage, validateAuthMessage, verifyWalletAuth } from "../packages/auth/src/index";
import { createXrplSignatureVerifier } from "../packages/auth/src/verifiers/index";

const owner = Wallet.generate();
const other = Wallet.generate();
const message = "nonce-bound challenge";
const tx = { TransactionType: "AccountSet" as const, Account: owner.address, Fee: "12", Sequence: 1,
  Memos: [{ Memo: { MemoData: Buffer.from(message).toString("hex").toUpperCase() } }] };

for (const legacyResult of [true, { signatureValid: true }]) {
  test(`legacy proof verifier binds actual keys when signedBy is absent (${JSON.stringify(legacyResult)})`, async () => {
    const verifier = createXrplSignatureVerifier({ dependencies: {
      xrpl: { decode }, verifyXrplSignature: { verifySignature: () => legacyResult }
    } });
    for (const multisign of [false, true]) {
      const params = { address: owner.address, message, signatureKind: "signedTx" as const, proof: owner.sign(tx, multisign).tx_blob };
      assert.equal(await verifier.verify(params), true);
      assert.equal(await verifier.verify({ ...params, proof: other.sign(tx, multisign).tx_blob }), false);
    }
  });
}

test("auth validation fails closed without nonce protection; format-only is explicit", async () => {
  const message = challenge();
  assert.equal((await validateAuthMessage(message)).valid, false);
  assert.equal((await validateAuthMessage(message, { noncePolicy: "format-only" })).valid, true);
});

function challenge() {
  return formatAuthMessage({ domain: "dapp.example", uri: "https://dapp.example", address: owner.address,
    nonce: "server-issued", version: "1", issuedAt: new Date().toISOString(),
    expirationTime: new Date(Date.now() + 60000).toISOString() });
}

test("server auth consumes an issued nonce once, including parallel replay", async () => {
  let unused = true;
  const params = { address: owner.address, message: challenge(), signatureKind: "signature" as const, proof: "verified-mock" };
  const options = { expectedDomain: "dapp.example", expectedUri: "https://dapp.example",
    verifier: { verify: async () => true }, consumeNonce: (parsed: { nonce: string }) => {
      if (parsed.nonce !== "server-issued" || !unused) return false;
      unused = false; return true;
    } };
  const results = await Promise.all([verifyWalletAuth(params, options), verifyWalletAuth(params, options)]);
  assert.equal(results.filter(Boolean).length, 1);
  assert.equal(await verifyWalletAuth(params, options), false);
});

test("invalid proof or mismatched identity never consumes a server nonce", async () => {
  let consumed = 0;
  const params = { address: owner.address, message: challenge(), signatureKind: "signature" as const, proof: "invalid" };
  const options = { expectedDomain: "dapp.example", expectedUri: "https://dapp.example",
    verifier: { verify: async () => false }, consumeNonce: () => { consumed++; return true; } };
  assert.equal(await verifyWalletAuth(params, options), false);
  assert.equal(await verifyWalletAuth({ ...params, address: other.address }, options), false);
  assert.equal(consumed, 0);
});
