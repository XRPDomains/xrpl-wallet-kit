import assert from "node:assert/strict";
import test from "node:test";
import { WalletManager, type SignMessageResult } from "../packages/core/src/index";
import { createWalletAuth, formatAuthMessage, generateNonce, parseAuthMessage, validateAuthMessage } from "../packages/auth/src/index";
import { createXrplSignatureVerifier } from "../packages/auth/src/verifiers/index";
import type { WalletAuthAdapter } from "../packages/auth/src/types";

const account = { address: "rAuthAddress", publicKey: "EDAUTH" };

function makeManager(signResult: SignMessageResult = { signatureKind: "signature", signature: "ABC", publicKey: "EDAUTH" }) {
  const session = { adapterId: "mock", account, connectedAt: 1 };
  return {
    getAccount() {
      return account;
    },
    getSession() {
      return session;
    },
    getCapabilities() {
      return { connect: true, signMessage: true };
    },
    async signMessage() {
      return {
        ...signResult,
        proof: signResult.proof ?? (signResult.signatureKind === "signature" ? signResult.signature : signResult.txBlob)
      };
    }
  } as unknown as WalletManager;
}

function makeAuthAdapter(verifyResult = true): WalletAuthAdapter {
  return {
    async getNonce() {
      return "nonce-123";
    },
    createMessage(params) {
      return formatAuthMessage(params);
    },
    async verify() {
      return verifyResult;
    }
  };
}

test("formatAuthMessage and parseAuthMessage round-trip required and optional fields", () => {
  const params = {
    domain: "example.com",
    address: "rAuthAddress",
    statement: "Sign in to Example",
    uri: "https://example.com",
    version: "1",
    nonce: "nonce-123",
    issuedAt: "2026-06-19T00:00:00.000Z",
    expirationTime: "2026-06-19T01:00:00.000Z",
    chainId: "xrpl:0"
  };

  assert.deepEqual(parseAuthMessage(formatAuthMessage(params)), params);
});

test("validateAuthMessage detects domain mismatch, expiration, old messages, and reused nonce", async () => {
  const message = formatAuthMessage({
    domain: "example.com",
    address: "rAuthAddress",
    uri: "https://example.com",
    version: "1",
    nonce: "nonce-123",
    issuedAt: "2026-06-19T00:00:00.000Z",
    expirationTime: "2026-06-19T00:10:00.000Z"
  });

  const result = await validateAuthMessage(message, {
    expectedDomain: "wrong.example",
    now: new Date("2026-06-19T00:20:00.000Z"),
    maxAgeSeconds: 60,
    isNonceUsed: () => true
  });

  assert.equal(result.valid, false);
  assert(result.errors.includes("Domain does not match."));
  assert(result.errors.includes("Message has expired."));
  assert(result.errors.includes("Message is older than maxAgeSeconds."));
  assert(result.errors.includes("Nonce has already been used."));
});

test("generateNonce returns unique secure-length values", () => {
  const nonceA = generateNonce();
  const nonceB = generateNonce();
  assert.notEqual(nonceA, nonceB);
  assert(nonceA.length >= 32);
});

test("createWalletAuth signs, verifies, emits state, and returns normalized proof", async () => {
  const auth = createWalletAuth(makeManager(), makeAuthAdapter(), {
    domain: "example.com",
    uri: "https://example.com",
    chainId: "xrpl:0",
    statement: "Sign in"
  });
  const states: string[] = [];
  auth.on("change", (state) => states.push(state.status));

  const result = await auth.signIn();

  assert.equal(result.address, "rAuthAddress");
  assert.equal(result.signatureKind, "signature");
  assert.equal(result.proof, "ABC");
  assert.deepEqual(states, ["loading", "authenticated"]);
});

test("createWalletAuth fails before prompt when active adapter cannot sign messages", async () => {
  const manager = {
    ...makeManager(),
    getCapabilities() {
      return { connect: true, signMessage: false };
    }
  } as unknown as WalletManager;
  const auth = createWalletAuth(manager, makeAuthAdapter());

  await assert.rejects(() => auth.signIn(), /does not support message signing/);
});

test("createWalletAuth fails clearly when no wallet is connected", async () => {
  const manager = {
    ...makeManager(),
    getAccount() {
      return null;
    }
  } as unknown as WalletManager;
  const auth = createWalletAuth(manager, makeAuthAdapter());

  await assert.rejects(() => auth.signIn(), /No active wallet session/);
});

test("createWalletAuth prevents concurrent sign-in requests", async () => {
  let resolveNonce: ((nonce: string) => void) | undefined;
  const auth = createWalletAuth(makeManager(), {
    ...makeAuthAdapter(),
    getNonce() {
      return new Promise<string>((resolve) => {
        resolveNonce = resolve;
      });
    }
  });

  const first = auth.signIn();
  await assert.rejects(() => auth.signIn(), /already in progress/);
  resolveNonce?.("nonce-123");
  await first;
});

test("createWalletAuth destroy removes listeners and blocks future sign-in", async () => {
  const auth = createWalletAuth(makeManager(), makeAuthAdapter());
  let calls = 0;
  auth.on("change", () => {
    calls += 1;
  });

  auth.destroy();

  await assert.rejects(() => auth.signIn(), /destroyed/);
  assert.equal(calls, 0);
});

test("createWalletAuth resets state on signOut even if adapter signOut fails", async () => {
  const auth = createWalletAuth(makeManager(), {
    ...makeAuthAdapter(),
    async signOut() {
      throw new Error("server unavailable");
    }
  });

  await assert.rejects(() => auth.signOut(), /server unavailable/);
  assert.equal(auth.getState().status, "unauthenticated");
});

test("createXrplSignatureVerifier verifies compact signatures with supplied publicKey", async () => {
  const verifier = createXrplSignatureVerifier({
    dependencies: {
      rippleKeypairs: {
        verify(messageHex, signature, publicKey) {
          assert.equal(messageHex, "48656C6C6F");
          return signature === "SIG" && publicKey === "EDAUTH";
        },
        deriveAddress() {
          return "rAuthAddress";
        }
      }
    }
  });

  assert.equal(await verifier.verify({
    address: "rAuthAddress",
    message: "Hello",
    signatureKind: "signature",
    proof: "SIG",
    publicKey: "EDAUTH"
  }), true);
});

test("createXrplSignatureVerifier verifies signedTx memo proof", async () => {
  const verifier = createXrplSignatureVerifier({
    dependencies: {
      verifyXrplSignature: {
        verifySignature() {
          return { signatureValid: true, signedBy: "rAuthAddress" };
        }
      },
      xrpl: {
        decode() {
          return {
            Account: "rAuthAddress",
            Memos: [{ Memo: { MemoData: "48656C6C6F" } }]
          };
        }
      }
    }
  });

  assert.equal(await verifier.verify({
    address: "rAuthAddress",
    message: "Hello",
    signatureKind: "signedTx",
    proof: "SIGNED_TX"
  }), true);
});

test("createXrplSignatureVerifier rejects signedTx proofs from a different signer", async () => {
  const verifier = createXrplSignatureVerifier({
    dependencies: {
      verifyXrplSignature: {
        verifySignature() {
          return { signatureValid: true, signedBy: "rDifferentAddress" };
        }
      },
      xrpl: {
        decode() {
          return {
            Account: "rAuthAddress",
            Memos: [{ Memo: { MemoData: "48656C6C6F" } }]
          };
        }
      }
    }
  });

  assert.equal(await verifier.verify({
    address: "rAuthAddress",
    message: "Hello",
    signatureKind: "signedTx",
    proof: "SIGNED_TX"
  }), false);
});

test("createXrplSignatureVerifier reports a clear peer dependency error", async () => {
  const verifier = createXrplSignatureVerifier({
    dependencies: {
      async loadPeer() {
        throw new Error("missing peer");
      }
    }
  });

  await assert.rejects(
    () => verifier.verify({
      address: "rAuthAddress",
      message: "Hello",
      signatureKind: "signature",
      proof: "SIG",
      publicKey: "EDAUTH"
    }),
    /Install ripple-keypairs, verify-xrpl-signature, and xrpl/
  );
});
