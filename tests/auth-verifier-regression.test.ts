import assert from "node:assert/strict";
import test from "node:test";
import { Wallet, decode, encode, type AccountSet } from "xrpl";
import { sign } from "ripple-keypairs";
import { createXrplSignatureVerifier } from "../packages/auth/src/verifiers/index";

const message = "Sign in: nonce-123";
const messageHex = Buffer.from(message).toString("hex").toUpperCase();

function transaction(wallet: Wallet): AccountSet {
  return { TransactionType: "AccountSet", Account: wallet.address, Fee: "12", Sequence: 1,
    Memos: [{ Memo: { MemoData: messageHex } }] };
}

for (const algorithm of ["ed25519", "ecdsa-secp256k1"] as const) {
  const wallet = Wallet.generate(algorithm as Parameters<typeof Wallet.generate>[0]);
  const stranger = Wallet.generate(algorithm as Parameters<typeof Wallet.generate>[0]);
  const verifier = createXrplSignatureVerifier();
  const proof = wallet.sign(transaction(wallet)).tx_blob;
  const params = { address: wallet.address, message, signatureKind: "signedTx" as const, proof };

  test(`modern auth verifier accepts real ${algorithm} single-sign and compact proofs`, async () => {
    assert.equal(await verifier.verify(params), true);
    assert.equal(await verifier.verify({ ...params, proof: sign(messageHex, wallet.privateKey),
      publicKey: wallet.publicKey, signatureKind: "signature" }), true);
    assert.equal(await verifier.verify({ ...params, signatureKind: "signature", publicKey: wallet.publicKey }), false);
  });

  test(`modern auth verifier binds ${algorithm} key, Account and memo`, async () => {
    assert.equal(await verifier.verify({ ...params, address: stranger.address }), false);
    assert.equal(await verifier.verify({ ...params, message: "Other nonce" }), false);
    const impersonation = stranger.sign(transaction(wallet)).tx_blob;
    assert.equal(await verifier.verify({ ...params, proof: impersonation }), false);
    const changed = decode(proof);
    changed.Memos = [{ Memo: { MemoData: Buffer.from("Other nonce").toString("hex") } }];
    assert.equal(await verifier.verify({ ...params, proof: encode(changed), message: "Other nonce" }), false);
  });

  test(`modern auth verifier preserves ${algorithm} first-multisigner identity binding`, async () => {
    const multi = wallet.sign(transaction(wallet), true).tx_blob;
    assert.equal(await verifier.verify({ ...params, proof: multi }), true);
    const otherSigner = stranger.sign(transaction(wallet), true).tx_blob;
    assert.equal(await verifier.verify({ ...params, proof: otherSigner }), false);
    const changed = decode(multi);
    changed.Signers![0].Signer.Account = stranger.address;
    assert.equal(await verifier.verify({ ...params, proof: encode(changed) }), false);
  });
}

test("modern auth verifier rejects malformed or unsigned transaction proofs", async () => {
  const wallet = Wallet.generate();
  const verifier = createXrplSignatureVerifier();
  for (const proof of ["NOT_HEX", "00", encode(transaction(wallet))]) {
    assert.equal(await verifier.verify({ address: wallet.address, message, signatureKind: "signedTx", proof }), false);
  }
});

test("signedTx verification loads only modern peers", async () => {
  const wallet = Wallet.generate();
  const loaded: string[] = [];
  const verifier = createXrplSignatureVerifier({ dependencies: { async loadPeer<T>(name: string) {
    loaded.push(name);
    return await import(name) as T;
  } } });
  assert.equal(await verifier.verify({ address: wallet.address, message, signatureKind: "signedTx",
    proof: wallet.sign(transaction(wallet)).tx_blob }), true);
  assert.deepEqual(loaded, ["xrpl", "ripple-keypairs"]);
});

test("injected legacy verifier must affirm validity and cannot authorize malformed memos", async () => {
  for (const result of [{}, { signedBy: "rAuth" }, { signatureValid: false }, { signatureValid: true, signedBy: "rOther" }]) {
    const verifier = createXrplSignatureVerifier({ dependencies: {
      verifyXrplSignature: { verifySignature: () => result },
      xrpl: { decode: () => ({ Account: "rAuth", Memos: [{ Memo: { MemoData: "4869" } }] }) }
    } });
    assert.equal(await verifier.verify({ address: "rAuth", message: "Hi", signatureKind: "signedTx", proof: "injected" }), false);
  }
  for (const memo of ["4869F", "4869ZZ", "4869FF"]) {
    const verifier = createXrplSignatureVerifier({ dependencies: {
      verifyXrplSignature: { verifySignature: () => true },
      xrpl: { decode: () => ({ Account: "rAuth", Memos: [{ Memo: { MemoData: memo } }] }) }
    } });
    assert.equal(await verifier.verify({ address: "rAuth", message: "Hi", signatureKind: "signedTx", proof: "injected" }), false);
  }
});
