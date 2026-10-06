import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { Wallet, decode, encode } from "xrpl";
import { assertWalletAdapter, WalletKitErrorCode, XRPL_TESTNET } from "../packages/core/src/index";
import { createGhostsigAdapter } from "../packages/adapters/ghostsig/src/index";
import { createWalletClient } from "../packages/client/src/index";
import { runAdapterConformance } from "../packages/core/src/testing";

const wallet = Wallet.generate();
const stranger = Wallet.generate();
const shared = { address: wallet.address, publicKey: wallet.publicKey.slice(2) };
const tx = { TransactionType: "AccountSet" as const, Account: wallet.address, SourceTag: 0, Flags: 0, Fee: "12", Sequence: 1, LastLedgerSequence: 100 };
const signed = wallet.sign(tx);
const reply = { ...shared, blob: signed.tx_blob, hash: signed.hash, signature: decode(signed.tx_blob).TxnSignature };

test("GhostSig advertises tested transaction families without message signing", () => {
  const { capabilities } = createGhostsigAdapter();
  assert.equal(capabilities.payments, true);
  assert.equal(capabilities.nftOffers, true);
  assert.equal(capabilities.signTransaction, true);
  assert.equal(capabilities.signAndSubmit, true);
  assert.equal(capabilities.signMessage, false);
});

function browser(t: TestContext) {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "window");
  const listeners = new Set<(event: MessageEvent) => void>();
  const popups: Array<{ closed: boolean; sent: Array<{ data: Record<string, unknown>; origin: string }>; close(): void; postMessage(data: Record<string, unknown>, origin: string): void }> = [];
  let blocked = false;
  let autoReady = false;
  let respond: ((data: Record<string, unknown>) => void) | undefined;
  const win = {
    open(_url: string, name: string) {
      assert.match(name, /^ghostsig-[a-f0-9]{64}$/);
      if (blocked) return null;
      const popup = { closed: false, sent: [] as Array<{ data: Record<string, unknown>; origin: string }>,
        close() { this.closed = true; }, postMessage(data: Record<string, unknown>, origin: string) { this.sent.push({ data, origin }); respond?.(data); } };
      popups.push(popup);
      if (autoReady) queueMicrotask(() => emit({ ghostsig: 1, type: "ready" }, "https://ghostsig.dev", popup));
      return popup;
    },
    addEventListener(_kind: string, listener: (event: MessageEvent) => void) { listeners.add(listener); },
    removeEventListener(_kind: string, listener: (event: MessageEvent) => void) { listeners.delete(listener); }
  };
  Object.defineProperty(globalThis, "window", { configurable: true, value: win });
  let restored = false;
  const restore = () => {
    if (restored) return;
    restored = true;
    if (descriptor) Object.defineProperty(globalThis, "window", descriptor); else Reflect.deleteProperty(globalThis, "window");
  };
  t.after(restore);
  const emit = (data: unknown, origin = "https://ghostsig.dev", source: unknown = popups.at(-1)) => {
    for (const listener of [...listeners]) listener({ data, origin, source } as MessageEvent);
  };
  const ready = () => emit({ ghostsig: 1, type: "ready" });
  const result = (value: unknown) => emit({ ghostsig: 1, type: "result", id: popups.at(-1)!.sent[0].data.id, result: value });
  return { popups, listeners, emit, ready, result, restore, block: () => { blocked = true; },
    automate: (handler: (data: Record<string, unknown>) => void) => { autoReady = true; respond = handler; } };
}

const code = (expected: WalletKitErrorCode) => (error: unknown) => (error as { code?: string }).code === expected;

test("GhostSig is SSR safe, validates metadata and remains opt-in", () => {
  const adapter = createGhostsigAdapter();
  assertWalletAdapter(adapter);
  assert.equal(adapter.isAvailable(), false);
  assert.equal(adapter.metadata.type, "web");
  assert.equal(adapter.capabilities.signMessage, false);
  for (const wallets of [undefined, "all"] as const) {
    const client = createWalletClient({ wallets });
    assert.equal(client.getWallets().some(item => item.id === "ghostsig"), false);
    client.destroy();
  }
  const selected = createWalletClient({ wallets: ["ghostsig"] });
  assert.deepEqual(selected.getWallets().map(item => item.id), ["ghostsig"]);
  selected.destroy();
});

test("GhostSig validates URL and custom networks before opening", async t => {
  const b = browser(t);
  for (const url of ["https://evil.test/?connect", "http://ghostsig.dev/", "https://ghostsig.dev.evil.test/", "https://u:p@ghostsig.dev/"]) assert.throws(() => createGhostsigAdapter({ url }));
  assert.doesNotThrow(() => createGhostsigAdapter({ url: "http://localhost:1234/?connect" }));
  for (const network of [{ ...XRPL_TESTNET, id: "custom" }, { ...XRPL_TESTNET, rpcUrl: "wss://evil.test" }, { ...XRPL_TESTNET, family: "other" }]) {
    await assert.rejects(createGhostsigAdapter().connect({ network }), code(WalletKitErrorCode.NETWORK_NOT_SUPPORTED));
  }
  assert.equal(b.popups.length, 0);
});

test("GhostSig synchronously opens, ignores forged traffic and posts a request once", async t => {
  const b = browser(t);
  const adapter = createGhostsigAdapter();
  const pending = adapter.connect({ network: XRPL_TESTNET });
  assert.equal(b.popups.length, 1);
  b.emit({ ghostsig: 1, type: "ready" }, "https://evil.test");
  b.emit({ ghostsig: 1, type: "ready" }, "https://ghostsig.dev", {});
  b.emit({ ghostsig: 2, type: "ready" });
  assert.equal(b.popups[0].sent.length, 0);
  b.ready(); b.ready();
  assert.equal(b.popups[0].sent.length, 1);
  assert.equal(b.popups[0].sent[0].origin, "https://ghostsig.dev");
  b.emit({ ghostsig: 1, type: "result", id: "wrong", result: shared });
  assert.equal(b.listeners.size, 1);
  b.result(shared);
  const result = await pending;
  assert.equal(result.account.publicKey, wallet.publicKey);
  assert.equal(b.listeners.size, 0);
  assert.equal(b.popups[0].closed, true);
  await adapter.disconnect();
});

test("GhostSig rejects blocked, aborted, closed, cancelled and rejected popups with cleanup", async t => {
  const b = browser(t);
  const adapter = createGhostsigAdapter();
  const signal = AbortSignal.abort();
  await assert.rejects(adapter.connect({ signal }), code(WalletKitErrorCode.REQUEST_CANCELLED));
  assert.equal(b.popups.length, 0);
  for (const stop of ["abort", "closed", "cancel", "reject", "timeout"]) {
    const controller = new AbortController();
    const pending = adapter.connect({ signal: controller.signal, timeoutMs: 150 });
    const rejection = assert.rejects(pending, code(stop === "abort" || stop === "cancel" ? WalletKitErrorCode.REQUEST_CANCELLED :
      stop === "timeout" ? WalletKitErrorCode.REQUEST_TIMEOUT : WalletKitErrorCode.CONNECTION_REJECTED));
    b.ready();
    if (stop === "abort") controller.abort();
    if (stop === "cancel") adapter.cancelPendingConnection();
    if (stop === "closed") b.popups.at(-1)!.closed = true;
    if (stop === "reject") b.emit({ ghostsig: 1, type: "error", id: b.popups.at(-1)!.sent[0].data.id, error: { code: -4, message: "Declined" } });
    await rejection;
    assert.equal(b.listeners.size, 0);
    assert.equal(b.popups.at(-1)!.closed, true);
  }
  b.block();
  await assert.rejects(adapter.connect({}), code(WalletKitErrorCode.WALLET_NOT_AVAILABLE));
});

test("GhostSig rejects malformed or inconsistent connect replies", async t => {
  const b = browser(t);
  for (const value of [null, {}, { ...shared, publicKey: "BAD" }, { ...shared, address: stranger.address }]) {
    const adapter = createGhostsigAdapter();
    const pending = adapter.connect({}); b.ready(); b.result(value);
    await assert.rejects(pending, code(WalletKitErrorCode.INVALID_REQUEST));
    assert.equal(b.listeners.size, 0);
  }
});

test("GhostSig passive restore opens no popup and sign-only verifies full identity and autofill", async t => {
  const b = browser(t);
  const adapter = createGhostsigAdapter();
  const session = { adapterId: "ghostsig", account: { address: wallet.address, publicKey: wallet.publicKey, network: XRPL_TESTNET }, connectedAt: 1 };
  assert.ok(await adapter.restoreSession(session));
  assert.equal(b.popups.length, 0);
  const request = { txJson: { TransactionType: "AccountSet", SourceTag: 0, Flags: 0 } };
  const pending = adapter.signTransaction(request); b.ready();
  const params = b.popups[0].sent[0].data.params as { submit: boolean; payload: string };
  assert.equal(params.submit, false);
  assert.equal(JSON.parse(params.payload).Account, wallet.address);
  b.result(reply);
  assert.equal((await pending).txBlob, signed.tx_blob);
  assert.deepEqual(request.txJson, { TransactionType: "AccountSet", SourceTag: 0, Flags: 0 });
  await adapter.disconnect();
  await assert.rejects(adapter.signTransaction({ txJson: tx }), code(WalletKitErrorCode.NOT_CONNECTED));
});

test("GhostSig rejects changed intent, identity, blob, signature, hash and sign-only submission", async t => {
  const b = browser(t);
  const adapter = createGhostsigAdapter();
  await adapter.restoreSession({ adapterId: "ghostsig", account: { address: wallet.address, publicKey: wallet.publicKey, network: XRPL_TESTNET }, connectedAt: 1 });
  const changed = wallet.sign({ ...tx, SetFlag: 1 });
  const changedReply = { ...shared, blob: changed.tx_blob, hash: changed.hash, signature: decode(changed.tx_blob).TxnSignature };
  for (const value of [{ ...reply, address: stranger.address }, { ...reply, publicKey: stranger.publicKey.slice(2) },
    { ...reply, blob: "BAD" }, { ...reply, hash: "0".repeat(64) }, { ...reply, signature: "0".repeat(128) }, changedReply,
    { ...reply, submitted: { kind: "validated" } }]) {
    const pending = adapter.signTransaction({ txJson: tx }); b.ready(); b.result(value);
    await assert.rejects(pending, code(WalletKitErrorCode.INVALID_REQUEST));
    assert.equal(b.listeners.size, 0);
  }
  for (const txJson of [{ ...tx, Account: stranger.address }, { ...tx, TxnSignature: "BAD" }, { ...tx, SigningPubKey: "" }, { ...tx, Signers: [] }, { ...tx, SourceTag: undefined }]) {
    await assert.rejects(adapter.signTransaction({ txJson }), code(WalletKitErrorCode.INVALID_REQUEST));
  }
  const damaged = decode(reply.blob); damaged.Sequence = 2;
  const pending = adapter.signTransaction({ txJson: tx }); b.ready(); b.result({ ...reply, blob: encode(damaged) });
  await assert.rejects(pending, code(WalletKitErrorCode.INVALID_REQUEST));
  await adapter.disconnect();
});

test("GhostSig submit requires confirmed tesSUCCESS and preserves uncertain results", async t => {
  const b = browser(t);
  const adapter = createGhostsigAdapter();
  await adapter.restoreSession({ adapterId: "ghostsig", account: { address: wallet.address, publicKey: wallet.publicKey, network: XRPL_TESTNET }, connectedAt: 1 });
  for (const submitted of [undefined, { kind: "unsent" }, { kind: "validated", ok: false, code: "tecFAILED", ledger: 12 },
    { kind: "validated", ok: true }, { kind: "validated", ok: true, code: "tesSUCCESS", ledger: 12 }]) {
    const pending = adapter.signAndSubmit({ txJson: tx }); b.ready(); b.result({ ...reply, submitted });
    if (submitted?.code === "tesSUCCESS") assert.equal((await pending).status, "tesSUCCESS");
    else await assert.rejects(pending, error => code(WalletKitErrorCode.SIGN_FAILED)(error) &&
      (error as { details: { hash: string; transaction: unknown } }).details.hash === reply.hash && Boolean((error as { details: { transaction: unknown } }).details.transaction));
  }
  const pending = adapter.signAndSubmit({ txJson: tx, submit: false }); b.ready(); b.result(reply);
  assert.equal((await pending).status, "signed");
  await adapter.disconnect();
});

test("GhostSig rejects late replies after disconnect and invalid restored sessions", async t => {
  const b = browser(t);
  const adapter = createGhostsigAdapter();
  const pending = adapter.connect({}); b.ready();
  const rejected = assert.rejects(pending, code(WalletKitErrorCode.REQUEST_CANCELLED));
  await adapter.disconnect(); b.result(shared); await rejected;
  assert.equal(b.listeners.size, 0);
  for (const session of [{ adapterId: "other", account: { address: wallet.address, publicKey: wallet.publicKey }, connectedAt: 1 },
    { adapterId: "ghostsig", account: { address: stranger.address, publicKey: wallet.publicKey }, connectedAt: 1 },
    { adapterId: "ghostsig", account: { address: wallet.address, publicKey: "BAD" }, connectedAt: 1 }]) assert.equal(await adapter.restoreSession(session), null);
});

test("GhostSig conformance probes pass without a live wallet", async t => {
  const report = await runAdapterConformance({ createFixture(scenario) {
    const b = browser(t);
    const adapter = createGhostsigAdapter({ timeoutMs: scenario === "timeout" ? 20 : 500 });
    b.automate(data => {
      if (scenario === "timeout") return;
      if (scenario === "rejection") {
        b.emit({ ghostsig: 1, id: data.id, type: "error", error: { code: -4, message: "Declined" } });
      } else {
        const params = data.params as { submit?: boolean };
        const result = data.method === "connect" ? shared : params.submit ?
          { ...reply, submitted: { kind: "validated", code: "tesSUCCESS", ok: true, ledger: 12 } } : reply;
        b.emit({ ghostsig: 1, id: data.id, type: "result", result });
      }
    });
    return { adapter, connectOptions: { network: XRPL_TESTNET }, expectedAddress: wallet.address,
      transaction: { txJson: tx }, message: { message: "unsupported" },
      remainingResources: () => b.listeners.size + b.popups.filter(popup => !popup.closed).length,
      dispose: async () => { await adapter.disconnect(); b.restore(); } };
  } });
  assert.equal(report.passed, true, JSON.stringify(report));
  assert.equal(report.results.find(result => result.scenario === "cleanup")?.status, "passed");
  assert.equal(report.results.find(result => result.scenario === "events")?.status, "skipped");
});

test("GhostSig fails closed without randomness and does not disturb a concurrent request", async t => {
  const b = browser(t);
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "crypto")!;
  try {
    Object.defineProperty(globalThis, "crypto", { configurable: true, value: {} });
    await assert.rejects(createGhostsigAdapter().connect({}), code(WalletKitErrorCode.INVALID_REQUEST));
    assert.equal(b.popups.length, 0);
  } finally { Object.defineProperty(globalThis, "crypto", descriptor); }
  const adapter = createGhostsigAdapter();
  const pending = adapter.connect({});
  await assert.rejects(adapter.connect({}), code(WalletKitErrorCode.INVALID_REQUEST));
  b.ready(); b.result(shared);
  assert.equal((await pending).account.address, wallet.address);
  await adapter.disconnect();
});

test("GhostSig keeps the provider hash and unknown outcome on submission timeout", async t => {
  const b = browser(t);
  const adapter = createGhostsigAdapter({ timeoutMs: 20 });
  await adapter.restoreSession({ adapterId: "ghostsig", account: { address: wallet.address, publicKey: wallet.publicKey, network: XRPL_TESTNET }, connectedAt: 1 });
  const pending = adapter.signAndSubmit({ txJson: tx });
  const rejected = assert.rejects(pending, error => code(WalletKitErrorCode.REQUEST_TIMEOUT)(error) &&
    (error as { details: { providerHash?: string; outcomeUnknown: boolean } }).details.providerHash === reply.hash &&
    (error as { details: { outcomeUnknown: boolean } }).details.outcomeUnknown === true);
  b.ready(); b.emit({ ghostsig: 1, id: b.popups[0].sent[0].data.id, type: "signed", hash: reply.hash });
  await rejected;
  assert.equal(b.listeners.size, 0);
});
