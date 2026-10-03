import assert from "node:assert/strict";
import test from "node:test";
import { BaseWalletAdapter, WalletManager, WalletKitError, WalletKitErrorCode, waitForWalletRequest,
  type SignAndSubmitRequest, type WalletRequest, type TransactionPreflightPolicy } from "../packages/core/src/index";
import { WalletRequestTracker } from "../packages/core/src/request";

const network = { id: "testnet", name: "Testnet", rpcUrl: "wss://example.invalid" } as const;
const account = { address: "rLifecycle", network };
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}
const tick = () => new Promise<void>(resolve => setImmediate(resolve));
class Adapter extends BaseWalletAdapter {
  metadata = { id: "lifecycle", name: "Lifecycle", type: "extension" } as const;
  capabilities = { connect: true, signAndSubmit: true, details: { transactionModes: ["sign-only", "sign-and-submit"] as ("sign-only" | "sign-and-submit")[] } };
  calls: SignAndSubmitRequest[] = [];
  result = deferred<{ hash: string; status: "success" }>();
  async connect() { return { account }; }
  async signAndSubmit(request: SignAndSubmitRequest) { this.calls.push(request); return this.result.promise; }
}
async function setup(preflight?: TransactionPreflightPolicy) {
  const adapter = new Adapter();
  const manager = new WalletManager({ adapters: [adapter], network: "testnet", preflight, logger: { level: "silent" } });
  await manager.connect(adapter.metadata.id);
  return { manager, adapter };
}
const txJson = { TransactionType: "Payment", Account: account.address };

test("request helper invokes synchronously, never dispatches pre-aborted/invalid requests, and consumes late failure", async () => {
  let calls = 0;
  const done = waitForWalletRequest(() => { calls++; return Promise.resolve(1); });
  assert.equal(calls, 1);
  assert.equal(await done, 1);
  const controller = new AbortController(); controller.abort();
  await assert.rejects(waitForWalletRequest(() => { calls++; return Promise.resolve(1); }, { signal: controller.signal }), { code: WalletKitErrorCode.REQUEST_CANCELLED });
  for (const timeoutMs of [0, -1, NaN, Infinity, 2147483648]) {
    await assert.rejects(waitForWalletRequest(() => { calls++; return Promise.resolve(1); }, { timeoutMs }), { code: WalletKitErrorCode.INVALID_REQUEST });
  }
  assert.equal(calls, 1);
  const late = deferred<number>();
  await assert.rejects(waitForWalletRequest(() => late.promise, { timeoutMs: 5 }), { code: WalletKitErrorCode.REQUEST_TIMEOUT });
  late.reject(new Error("late provider failure")); await tick();
});

test("manager cancellation retains immutable diagnostics and ignores late submitted results", async () => {
  const { manager, adapter } = await setup();
  const states: WalletRequest[] = [];
  let signed = 0;
  manager.on("request_changed", ({ request }) => states.push(request));
  manager.on("signed", () => signed++);
  const pending = manager.signAndSubmit({ txJson, requestId: "cancel-submit" });
  assert.equal(adapter.calls.length, 1, "wallet dispatch preserves user activation");
  assert.equal(manager.getPendingRequests().length, 1);
  const rejection = assert.rejects(pending, (error: any) => error.code === WalletKitErrorCode.REQUEST_CANCELLED && error.details.outcomeUnknown === true);
  assert.equal(manager.cancelRequest("cancel-submit"), true);
  assert.equal(manager.cancelRequest("cancel-submit"), false);
  await rejection;
  adapter.result.resolve({ hash: "LATE", status: "success" }); await tick();
  assert.deepEqual(states.map(request => request.state), ["pending", "opened", "cancelled"]);
  assert.ok(states.every(Object.isFrozen));
  assert.equal(states[0].state, "pending");
  assert.equal(signed, 0); assert.deepEqual(manager.getTransactions(), []);
  assert.deepEqual(manager.getPendingRequests(), []);
  await manager.destroy();
});

test("submission completes signed/submitted while submit:false does not enter transaction history", async () => {
  for (const submit of [true, false]) {
    const { manager, adapter } = await setup();
    const states: string[] = [];
    manager.on("request_changed", ({ request }) => states.push(request.state));
    const pending = manager.signAndSubmit({ txJson, submit, requestId: "success" });
    adapter.result.resolve({ hash: "HASH", status: "success" });
    await pending;
    assert.deepEqual(states, submit ? ["pending", "opened", "signed", "submitted"] : ["pending", "opened", "signed"]);
    assert.equal(manager.getTransactions().length, submit ? 1 : 0);
    assert.equal(manager.getRequest("success")?.outcomeUnknown, false);
    await manager.destroy();
  }
});

test("timeout marks expired and forbids duplicate IDs without second dispatch", async () => {
  const { manager, adapter } = await setup();
  await assert.rejects(manager.signAndSubmit({ txJson, timeoutMs: 5, requestId: "timeout" }), { code: WalletKitErrorCode.REQUEST_TIMEOUT });
  assert.equal(manager.getRequest("timeout")?.state, "expired");
  assert.equal(manager.getRequest("timeout")?.outcomeUnknown, true);
  await assert.rejects(manager.signAndSubmit({ txJson, requestId: "timeout" }), { code: WalletKitErrorCode.INVALID_REQUEST });
  assert.equal(adapter.calls.length, 1);
  adapter.result.resolve({ hash: "LATE", status: "success" }); await tick();
  await manager.destroy();
});

test("account/network/disconnect/destroy terminate pending work and suppress stale events", async () => {
  for (const action of ["account", "network", "disconnect", "destroy"]) {
    const { manager, adapter } = await setup();
    let signed = 0; manager.on("signed", () => signed++);
    const pending = manager.signAndSubmit({ txJson, requestId: action });
    const rejected = assert.rejects(pending, { code: WalletKitErrorCode.REQUEST_CANCELLED });
    if (action === "account") manager.emitAccountChanged(adapter.metadata.id, { ...account, address: "rOther" });
    if (action === "network") manager.emitNetworkChanged(adapter.metadata.id, { ...network, id: "mainnet" });
    if (action === "disconnect") await manager.disconnect();
    if (action === "destroy") await manager.destroy();
    await rejected;
    adapter.result.resolve({ hash: "LATE", status: "success" }); await tick();
    assert.equal(signed, 0); assert.deepEqual(manager.getPendingRequests(), []);
    assert.deepEqual(manager.getTransactions(), []);
    await manager.destroy();
    await assert.rejects(manager.signAndSubmit({ txJson }), { code: WalletKitErrorCode.REQUEST_CANCELLED });
  }
});

test("aborting asynchronous preflight does not dispatch and supports non-cloneable controls", async () => {
  const entered = deferred<void>(); const gate = deferred<void>();
  const { manager, adapter } = await setup({ checks: [async () => { entered.resolve(); await gate.promise; }] });
  const controller = new AbortController();
  const pending = manager.signAndSubmit({ txJson, signal: controller.signal, onRequestProgress: () => {}, requestId: "policy" });
  const rejection = assert.rejects(pending, { code: WalletKitErrorCode.REQUEST_CANCELLED });
  await entered.promise; controller.abort(); await rejection;
  gate.resolve(); await tick();
  assert.equal(adapter.calls.length, 0);
  assert.equal(manager.getRequest("policy")?.outcomeUnknown, false);
  await manager.destroy();
});

test("tracker keeps progress monotonic, retains expiry UUID and bounds terminal diagnostics", async () => {
  const tracker = new WalletRequestTracker(() => {});
  await assert.rejects(tracker.run("wallet", "sign-only", { requestId: "expired" }, {}, async control => {
    control.progress({ state: "signed" });
    control.progress({ state: "opened", providerRequestId: "uuid" });
    assert.equal(tracker.get("expired")?.state, "signed");
    control.progress({ state: "expired", providerRequestId: "expiry-uuid" });
    return 1;
  }, () => ({ state: "signed" })), { code: WalletKitErrorCode.REQUEST_EXPIRED });
  assert.equal(tracker.get("expired")?.providerRequestId, "expiry-uuid");
  for (let i = 0; i < 101; i++) await tracker.run("wallet", "sign-only", { requestId: String(i) }, {}, async () => 1, () => ({ state: "signed" }));
  assert.equal(tracker.get("expired"), undefined);
  assert.equal(tracker.get("0"), undefined);
  assert.equal(tracker.get("100")?.state, "signed");
});

test("cancelled connection cannot activate a late result and a subsequent connect succeeds", async () => {
  const adapter = new Adapter();
  const response = deferred<{ account: typeof account }>();
  const entered = deferred<void>();
  let cancelled = 0;
  adapter.connect = async () => { entered.resolve(); return response.promise; };
  adapter.cancelPendingConnection = () => { cancelled++; };
  const manager = new WalletManager({ adapters: [adapter], network: "testnet", logger: { level: "silent" } });
  let connected = 0; manager.on("connected", () => connected++);
  const pending = manager.connect(adapter.metadata.id, { requestId: "connect-old" });
  const rejection = assert.rejects(pending, { code: WalletKitErrorCode.REQUEST_CANCELLED });
  await entered.promise; manager.cancelRequest("connect-old"); await rejection;
  adapter.connect = async () => ({ account });
  await manager.connect(adapter.metadata.id, { requestId: "connect-new" });
  response.resolve({ account: { ...account, address: "rLate" } }); await tick();
  assert.equal(manager.getAccount()?.address, account.address);
  assert.equal(connected, 1); assert.equal(cancelled, 1);
  await manager.destroy();
});

test("cancellation rolls back a session while its storage write is pending", async () => {
  const adapter = new Adapter();
  const writing = deferred<void>(); const release = deferred<void>();
  const values = new Map<string, string>();
  const manager = new WalletManager({ adapters: [adapter], network: "testnet", logger: { level: "silent" }, storage: {
    getItem: key => values.get(key) ?? null,
    setItem: async (key, value) => { writing.resolve(); await release.promise; values.set(key, value); },
    removeItem: key => { values.delete(key); }
  } });
  const pending = manager.connect(adapter.metadata.id, { requestId: "persist" });
  const rejection = assert.rejects(pending, { code: WalletKitErrorCode.REQUEST_CANCELLED });
  await writing.promise; manager.cancelRequest("persist"); await rejection;
  assert.equal(manager.getAccount(), null);
  release.resolve(); await tick(); await tick();
  assert.equal(values.size, 0);
  await manager.destroy();
});

test("tracker removes the original abort listener even when callers mutate controls", async () => {
  const tracker = new WalletRequestTracker(() => {});
  const original = new AbortController(); const replacement = new AbortController();
  const originalRemove = original.signal.removeEventListener.bind(original.signal);
  let removed = 0;
  original.signal.removeEventListener = (...args: Parameters<AbortSignal["removeEventListener"]>) => { removed++; originalRemove(...args); };
  const gate = deferred<number>();
  const request = { signal: original.signal, requestId: "mutable" };
  const pending = tracker.run("wallet", "sign-only", request, {}, () => gate.promise, () => ({ state: "signed" }));
  request.signal = replacement.signal;
  gate.resolve(1); await pending;
  assert.equal(removed, 1);
  original.abort(); assert.equal(tracker.get("mutable")?.state, "signed");
});

test("typed cancellation state does not depend on provider message wording", async () => {
  const tracker = new WalletRequestTracker(() => {});
  await assert.rejects(tracker.run("wallet", "sign-only", { requestId: "rejected" }, {}, async () => {
    throw new WalletKitError(WalletKitErrorCode.SIGN_REJECTED, "User chose no");
  }, () => ({ state: "signed" })), { code: WalletKitErrorCode.SIGN_REJECTED });
  assert.equal(tracker.get("rejected")?.state, "cancelled");
});
