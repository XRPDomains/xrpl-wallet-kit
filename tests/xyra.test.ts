import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { Wallet } from "xrpl";
import { assertWalletAdapter, XRPL_MAINNET, XRPL_TESTNET, XRPL_DEVNET } from "../packages/core/src/index";
import { createXyraAdapter } from "../packages/adapters/xyra/src/index";

function browser(t: TestContext) {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "window");
  const listeners = new Set<(event: MessageEvent) => void>();
  const popups: Array<{ closed: boolean; url: URL; close(): void; postMessage(data: unknown, origin: string): void }> = [];
  let blocked = false;
  const win = {
    open(url: string, name: string) {
      assert.match(name, /^xyra-[0-9a-f]{64}$/);
      if (blocked) return null;
      const popup = { url: new URL(url), closed: false, close() { this.closed = true; }, postMessage() {} };
      popups.push(popup);
      return popup;
    },
    addEventListener(_name: string, handler: (event: MessageEvent) => void) { listeners.add(handler); },
    removeEventListener(_name: string, handler: (event: MessageEvent) => void) { listeners.delete(handler); }
  };
  Object.defineProperty(globalThis, "window", { configurable: true, value: win });
  t.after(() => {
    if (descriptor) Object.defineProperty(globalThis, "window", descriptor);
    else Reflect.deleteProperty(globalThis, "window");
  });
  return { popups, listeners, block: () => { blocked = true; },
    emit(data: unknown, source: unknown = popups.at(-1), origin = "https://wallet.xyra.now") {
      for (const handler of [...listeners]) handler({ data, source, origin } as MessageEvent);
    } };
}

const wallet = Wallet.generate();
const stranger = Wallet.generate();
const tx = { TransactionType: "AccountSet" as const, Account: wallet.address, Flags: 0, Fee: "12", Sequence: 1, LastLedgerSequence: 100 };
const signed = wallet.sign(tx);
const reply = { type: "SIGN_RESPONSE", network: "xrpl-testnet", tx_blob: signed.tx_blob, hash: signed.hash, submitted: false };
const account = { type: "CONNECT_RESPONSE", address: wallet.address, publicKey: wallet.publicKey, network: "xrpl-testnet" };

async function connected(t: TestContext) {
  const b = browser(t);
  const adapter = createXyraAdapter({ timeoutMs: 1000 });
  t.after(() => adapter.disconnect());
  const pending = adapter.connect({ network: XRPL_TESTNET });
  b.emit(account);
  await pending;
  return { b, adapter };
}

test("Xyra is opt-in, SSR-safe and rejects unsupported networks before opening", async t => {
  const b = browser(t);
  const adapter = createXyraAdapter();
  assertWalletAdapter(adapter);
  assert.equal(adapter.capabilities.signMessage, false);
  assert.equal(adapter.capabilities.payments, false);
  assert.equal(adapter.capabilities.nftOffers, false);
  assert.equal("restoreSession" in adapter, false);
  for (const network of [XRPL_DEVNET, { ...XRPL_TESTNET, rpcUrl: "wss://other.example" }, { ...XRPL_MAINNET, family: "xahau" }]) {
    await assert.rejects(adapter.connect({ network }));
  }
  assert.equal(b.popups.length, 0);
  assert.throws(() => createXyraAdapter({ maxFeeDrops: "0" }));
});

test("Xyra correlates exact origin/source and isolates late popup replies", async t => {
  const { b, adapter } = await connected(t);
  const old = b.popups[0];
  const pending = adapter.signTransaction({ txJson: tx });
  b.emit(reply, old);
  b.emit(reply, undefined, "https://evil.example");
  assert.equal(b.listeners.size, 1);
  b.emit(reply);
  assert.equal((await pending).txBlob, signed.tx_blob);
  assert.equal(b.listeners.size, 0);
  assert.ok(b.popups.every(popup => popup.closed));
});

test("Xyra rejects malformed accounts, blocked/closed popups, rejection and timeout", async t => {
  const b = browser(t);
  const adapter = createXyraAdapter({ timeoutMs: 20 });
  const malformed = adapter.connect({ network: XRPL_TESTNET });
  b.emit({ ...account, address: stranger.address });
  await assert.rejects(malformed);
  const rejected = adapter.connect({ network: XRPL_TESTNET });
  b.emit({ ...account, address: "" });
  await assert.rejects(rejected);
  const timed = adapter.connect({ network: XRPL_TESTNET });
  await assert.rejects(timed, { code: "REQUEST_TIMEOUT" });
  const closed = adapter.connect({ network: XRPL_TESTNET, timeoutMs: 1000 });
  b.popups.at(-1)!.closed = true;
  await assert.rejects(closed, { code: "CONNECTION_REJECTED" });
  b.block();
  await assert.rejects(adapter.connect({ network: XRPL_TESTNET }));
  assert.equal(b.listeners.size, 0);
});

test("Xyra cancellation and disconnect remove listeners and close popups", async t => {
  const { b, adapter } = await connected(t);
  const controller = new AbortController();
  const pending = adapter.signTransaction({ txJson: tx, signal: controller.signal });
  const rejected = assert.rejects(pending, { code: "REQUEST_CANCELLED" });
  controller.abort();
  await rejected;
  const second = adapter.signTransaction({ txJson: tx });
  const disconnected = assert.rejects(second, { code: "REQUEST_CANCELLED" });
  await adapter.disconnect();
  await disconnected;
  assert.equal(b.listeners.size, 0);
  assert.ok(b.popups.every(popup => popup.closed));
  b.emit(reply);
  await assert.rejects(adapter.signTransaction({ txJson: tx }));
});

test("Xyra preserves JSON in the request and permits only bounded missing autofill", async t => {
  const { b, adapter } = await connected(t);
  const partial = { TransactionType: "AccountSet" as const, Flags: 0, Domain: "78797261" };
  const full = wallet.sign({ ...partial, Account: wallet.address, Fee: "12", Sequence: 1, LastLedgerSequence: 100 });
  const pending = adapter.signTransaction({ txJson: partial });
  const popup = b.popups.at(-1)!;
  const sent = JSON.parse(Buffer.from(popup.url.searchParams.get("tx")!, "base64").toString("utf8"));
  assert.equal(sent.Account, wallet.address);
  assert.equal(popup.url.searchParams.has("submit"), false);
  b.emit({ ...reply, tx_blob: full.tx_blob, hash: full.hash });
  assert.equal((await pending).txBlob, full.tx_blob);
});

test("Xyra fails closed for changed intent, key, hash, network, fee and sign-only submission", async t => {
  const { b, adapter } = await connected(t);
  const changed = wallet.sign({ ...tx, Domain: "78797261" });
  const wrongSigner = stranger.sign({ ...tx, Account: stranger.address });
  const highFee = wallet.sign({ ...tx, Fee: "1000001" });
  for (const bad of [
    { ...reply, tx_blob: changed.tx_blob, hash: changed.hash },
    { ...reply, tx_blob: wrongSigner.tx_blob, hash: wrongSigner.hash },
    { ...reply, hash: "0".repeat(64) },
    { ...reply, network: "xahau-testnet" },
    { ...reply, tx_blob: highFee.tx_blob, hash: highFee.hash },
    { ...reply, submitted: true },
    { ...reply, submitResult: { engine_result: "tesSUCCESS" } }
  ]) {
    const pending = adapter.signTransaction({ txJson: tx });
    b.emit(bad);
    await assert.rejects(pending);
  }
  assert.equal(b.listeners.size, 0);
});

test("Xyra submit false returns blob; preliminary submission is not validated success", async t => {
  const { b, adapter } = await connected(t);
  const only = adapter.signAndSubmit({ txJson: tx, submit: false });
  b.emit(reply);
  assert.equal((await only).txBlob, signed.tx_blob);
  const pending = adapter.signAndSubmit({ txJson: tx });
  assert.equal(b.popups.at(-1)!.url.searchParams.get("submit"), "true");
  b.emit({ ...reply, submitted: true, submitResult: { engine_result: "tesSUCCESS" } });
  await assert.rejects(pending, error => Boolean((error as { details?: { hash?: string; outcomeUnknown?: boolean } }).details?.outcomeUnknown)
    && (error as { details: { hash: string } }).details.hash === signed.hash);
  assert.equal(b.listeners.size, 0);
});
