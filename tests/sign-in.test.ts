import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { Wallet, decode } from "xrpl";
import { sign } from "ripple-keypairs";
import type { JoeyInjectedProvider } from "@joeywallet/wallet-sdk";
import { createJoeyWalletAdapter } from "../packages/adapters/joey-wallet/src/index";
import { WalletManager, XRPL_MAINNET, WalletKitErrorCode, assertWalletAdapter } from "../packages/core/src/index";
import type { SignInResult } from "../packages/core/src/index";
import { verifyWalletSignIn } from "../packages/auth/src/verifiers/index";

const wallet = Wallet.generate(), other = Wallet.generate();
const nonce = "0123456789abcdef0123456789abcdef";
const statement = "Sign in to Example";
const context = { nonce, statement, address: wallet.address, chainId: "xrpl:0", domain: "example.test", uri: "https://example.test" };
function message(value = context, timestamp = new Date().toISOString()) {
  return `${value.domain} wants you to sign in with your XRPL account:\n${value.address}\n\n${value.statement}\n\nURI: ${value.uri}\nVersion: 1\nChain ID: ${value.chainId}\nNonce: ${value.nonce}\nIssued At: ${timestamp}`;
}
function software(text = message()) {
  const hex = Buffer.from(text, "utf8").toString("hex");
  return { address: wallet.address, publicKey: wallet.publicKey, message: text, signature: sign(hex, wallet.privateKey) };
}
function hardware(challenge = nonce, account = wallet) {
  const signed = account.sign({ TransactionType: "Payment", Account: account.address, Destination: account.address,
    Amount: "1", Fee: "10", Sequence: 0, Memos: [{ Memo: { MemoData: Buffer.from(JSON.stringify({ wallet: "joey", challenge })).toString("hex").toUpperCase() } }] });
  return { mode: "challenge-v1" as const, address: account.address, signedTx: JSON.stringify(decode(signed.tx_blob)) };
}
function fixture(t: TestContext) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "location");
  Object.defineProperty(globalThis, "location", { configurable: true, value: new URL(context.uri) });
  t.after(() => { if (previous) Object.defineProperty(globalThis, "location", previous); else Reflect.deleteProperty(globalThis, "location"); });
  const calls: string[] = [];
  let response: unknown = software();
  let pending: (() => Promise<unknown>) | undefined;
  const provider: JoeyInjectedProvider = { on: () => () => {}, async request<T>({ method, params }): Promise<T> {
    calls.push(method);
    if (method === "connect") return { accounts: [{ address: wallet.address }], chain: "xrpl:0" } as T;
    if (method === "getNetwork") return { chain: "xrpl:0", networkId: 0 } as T;
    if (method === "signIn") {
      assert.equal((params as { nonce: string }).nonce, nonce);
      if (pending) return await pending() as T;
      return response as T;
    }
    throw new Error(`Unexpected method ${method}`);
  } };
  let manager: WalletManager;
  const adapter = createJoeyWalletAdapter({ provider, onDisconnected: () => manager.emitDisconnected("joey-wallet") });
  manager = new WalletManager({ adapters: [adapter], network: "mainnet" });
  return { adapter, manager, calls, result: (value: unknown) => { response = value; }, pending: (fn: typeof pending) => { pending = fn; } };
}

test("native software sign-in uses Joey API and existing message signing stays unsupported", async t => {
  const f = fixture(t); assertWalletAdapter(f.adapter);
  await f.manager.connect("joey-wallet");
  const proof = await f.manager.signIn({ nonce, statement, requestId: "native-proof" });
  assert.equal(proof.mode, "caip122");
  assert.equal(f.manager.getCapabilities()?.signIn, true);
  assert.equal(f.manager.getCapabilities()?.signMessage, false);
  assert.equal(f.manager.getRequest("native-proof")?.kind, "sign-in");
  assert.deepEqual(f.calls, ["connect", "getNetwork", "signIn"]);
  let consumed = false;
  const options = { ...context, consumeNonce: () => { if (consumed) return false; consumed = true; return true; } };
  assert.equal(await verifyWalletSignIn(proof, options), true);
  assert.equal(await verifyWalletSignIn(proof, options), false);
  await assert.rejects(f.manager.signMessage({ message: "unchanged" }), (e: any) => e.code === WalletKitErrorCode.UNSUPPORTED_METHOD);
});

test("Ledger challenge normalizes to a verified, never-submitted transaction proof", async t => {
  const f = fixture(t); f.result(hardware()); await f.manager.connect("joey-wallet");
  const proof = await f.manager.signIn({ nonce, statement });
  assert.equal(proof.mode, "challenge-v1");
  assert.equal(await verifyWalletSignIn(proof, { ...context, consumeNonce: () => true }), true);
  assert.equal(f.calls.includes("signTransaction"), false);
  assert.equal(f.calls.includes("signAndSubmitTransaction"), false);
});

test("native sign-in rejects wrong account, nonce, domain, chain, stale messages and signatures", async t => {
  const f = fixture(t); await f.manager.connect("joey-wallet");
  for (const raw of [software(message({ ...context, nonce: "different-nonce" })), software(message({ ...context, domain: "other.test" })),
    software(message({ ...context, chainId: "xrpl:1" })), software(message(context, new Date(Date.now() - 600000).toISOString())),
    { ...software(), address: other.address }, { ...software(), signature: "00" }, hardware("different-nonce"), hardware(nonce, other)]) {
    f.result(raw); await assert.rejects(f.manager.signIn({ nonce, statement }));
  }
  f.result(software()); const valid = await f.manager.signIn({ nonce, statement });
  let consumed = 0;
  for (const expected of [{ ...context, domain: "other.test" }, { ...context, nonce: "different-nonce" },
    { ...context, address: other.address }, { ...context, resources: ["https://example.test/scope"] }]) {
    assert.equal(await verifyWalletSignIn(valid, { ...expected, consumeNonce: () => { ++consumed; return true; } }), false);
  }
  assert.equal(consumed, 0);
  await assert.rejects(verifyWalletSignIn(valid, { ...context } as never));
});

test("native sign-in preserves cancellation and refuses stale sessions or missing capabilities", async t => {
  const f = fixture(t); await f.manager.connect("joey-wallet");
  let release!: (result: unknown) => void, started!: () => void;
  const ready = new Promise<void>(resolve => { started = resolve; });
  f.pending(() => { started(); return new Promise(resolve => { release = resolve; }); });
  const pending = f.manager.signIn({ nonce, statement }); await ready;
  f.manager.emitDisconnected("joey-wallet");
  await assert.rejects(pending, (e: any) => e.code === WalletKitErrorCode.REQUEST_CANCELLED && e.details?.outcomeUnknown === false);
  release(software());
  const manager = new WalletManager({ adapters: [{ metadata: { id: "mock", name: "Mock", type: "extension" }, capabilities: { connect: true, signMessage: true },
    connect: async () => ({ account: { address: wallet.address, network: XRPL_MAINNET } }), signMessage: async () => ({ signatureKind: "signature", signature: "proof" }) }] });
  await manager.connect("mock");
  await assert.rejects(manager.signIn({ nonce }), (e: any) => e.code === WalletKitErrorCode.UNSUPPORTED_METHOD);
});

test("server rejects spendable challenge transactions and consumes concurrent proofs only once", async t => {
  const f = fixture(t); f.result(hardware()); await f.manager.connect("joey-wallet");
  const proof = await f.manager.signIn({ nonce, statement });
  let consumed = false;
  const options = { ...context, consumeNonce: () => { if (consumed) return false; consumed = true; return true; } };
  const results = await Promise.all([verifyWalletSignIn(proof, options), verifyWalletSignIn(proof, options)]);
  assert.deepEqual(results.sort(), [false, true]);
  const spendable = wallet.sign({ TransactionType: "Payment", Account: wallet.address, Destination: other.address,
    Amount: "1", Fee: "10", Sequence: 1, Memos: [{ Memo: { MemoData: Buffer.from(JSON.stringify({ wallet: "joey", challenge: nonce })).toString("hex") } }] });
  const altered = { ...proof, mode: "challenge-v1", signatureKind: "signedTx", txBlob: spendable.tx_blob, proof: spendable.tx_blob } as SignInResult;
  assert.equal(await verifyWalletSignIn(altered, { ...context, consumeNonce: () => { throw new Error("Invalid proof must not consume a nonce"); } }), false);
});
