import assert from "node:assert/strict";
import test from "node:test";
import { BaseWalletAdapter, MemoryWalletStorage, WalletManager, WalletTransactionStore, type WalletAdapter, type WalletSession } from "../packages/core/src/index";
import { WalletButtonController } from "../packages/ui/src/button";
import { createXrpBalanceResolver } from "../packages/ui/src/balance";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}

function adapter(id: string): WalletAdapter {
  return {
    metadata: { id, name: id, type: "extension" }, capabilities: { connect: true },
    async connect(options) { return { account: { address: "r" + id, network: options.network } }; },
    async disconnect() {}
  };
}

for (const invalidate of ["disconnect", "destroy", "connect"] as const) {
  test(`late restoration cannot survive ${invalidate}`, async () => {
    const started = deferred<void>();
    const restored = deferred<{ session: WalletSession }>();
    const original = adapter("original");
    original.restoreSession = () => { started.resolve(); return restored.promise; };
    const storage = new MemoryWalletStorage();
    const manager = new WalletManager({ adapters: [original, adapter("new")], storage, autoReconnect: true, accountStatus: { enabled: false } });
    const session: WalletSession = { adapterId: "original", connectedAt: 1, account: { address: "rOriginal", network: manager.getNetwork() } };
    storage.setItem("session", JSON.stringify(session));
    let events = 0;
    manager.on("session_restored", () => { events += 1; });
    const pending = manager.autoReconnect();
    await started.promise;
    if (invalidate === "disconnect") await manager.disconnect();
    else if (invalidate === "destroy") manager.destroy();
    else await manager.connect("new");
    restored.resolve({ session });
    assert.equal(await pending, null);
    assert.equal(events, 0);
    assert.equal(manager.getSession()?.adapterId ?? null, invalidate === "connect" ? "new" : null);
    manager.destroy();
  });
}

test("pending-return recovery cannot reconnect after logout", async () => {
  const started = deferred<void>();
  const recovered = deferred<{ session: WalletSession }>();
  const wallet = adapter("recover");
  wallet.canRecoverSession = async () => true;
  wallet.recoverSession = () => { started.resolve(); return recovered.promise; };
  const manager = new WalletManager({ adapters: [wallet], autoReconnect: true, recoveryRetryDelaysMs: [0], accountStatus: { enabled: false } });
  const pending = manager.autoReconnect();
  await started.promise;
  await manager.disconnect();
  recovered.resolve({ session: { adapterId: "recover", connectedAt: 1, account: { address: "rRecover", network: manager.getNetwork() } } });
  assert.equal(await pending, null);
  assert.equal(manager.getSession(), null);
});

test("concurrent transaction mutations preserve records, index and clear ordering", async () => {
  const store = new WalletTransactionStore({ storage: new MemoryWalletStorage(), staleSubmittedMs: 0 });
  await Promise.all([
    store.add("rA", "mainnet", { hash: "first", status: "submitted", submittedAt: 1 }),
    store.add("rA", "mainnet", { hash: "second", status: "submitted", submittedAt: 2 }),
    store.add("rA", "testnet", { hash: "third", status: "submitted", submittedAt: 3 })
  ]);
  assert.deepEqual((await store.get("rA", "mainnet")).map(tx => tx.hash), ["second", "first"]);
  await Promise.all([
    store.add("rA", "mainnet", { hash: "second", status: "confirmed", submittedAt: 2, confirmedAt: 4 }),
    store.clear("rA"),
    store.add("rA", "mainnet", { hash: "after", status: "submitted", submittedAt: 5 })
  ]);
  assert.deepEqual((await store.get("rA", "mainnet")).map(tx => tx.hash), ["after"]);
  assert.deepEqual(await store.get("rA", "testnet"), []);
});

test("logout removes a recovery session even when its storage write completes late", async () => {
  const saving = deferred<void>();
  const release = deferred<void>();
  class DelayedStorage extends MemoryWalletStorage {
    override async setItem(key: string, value: string) {
      saving.resolve();
      await release.promise;
      super.setItem(key, value);
    }
  }
  const storage = new DelayedStorage();
  const wallet = adapter("recover");
  wallet.canRecoverSession = async () => true;
  wallet.recoverSession = async options => ({ session: {
    adapterId: "recover", connectedAt: 1, account: { address: "rRecover", network: options.network }
  } });
  const manager = new WalletManager({ adapters: [wallet], storage, autoReconnect: true, recoveryRetryDelaysMs: [0], accountStatus: { enabled: false } });
  const restoring = manager.autoReconnect();
  await saving.promise;
  const loggingOut = manager.disconnect();
  release.resolve();
  assert.equal(await restoring, null);
  await loggingOut;
  assert.equal(await storage.getItem("session"), null);
  assert.equal(manager.getSession(), null);
});

test("restore events share balance work and disconnect cancels stale results", async () => {
  const oldWindow = globalThis.window;
  const oldDocument = globalThis.document;
  globalThis.window = { setTimeout, clearTimeout } as unknown as Window & typeof globalThis;
  globalThis.document = { removeEventListener() {} } as unknown as Document;
  const manager = new WalletManager({ adapters: [] });
  const result = deferred<string>();
  const session: WalletSession = { adapterId: "mock", connectedAt: 1, account: { address: "rA", network: manager.getNetwork() } };
  let calls = 0;
  let signal: AbortSignal | undefined;
  const button = new WalletButtonController({ manager, modal: { onClose: () => () => {} } as never, showBalance: true, showWeb3Name: false,
    balanceResolver: context => { calls += 1; signal = context.signal; return result.promise; }
  });
  try {
  manager.emit("session_restored", { adapterId: "mock", account: session.account, session });
  manager.emit("connected", { adapterId: "mock", account: session.account, session });
  assert.equal(calls, 1);
  manager.emit("disconnected", { adapterId: "mock" });
  assert.equal(signal?.aborted, true);
  result.resolve("123");
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(session.balance, undefined);
  } finally {
    button.destroy();
    manager.destroy();
    if (oldWindow === undefined) delete (globalThis as { window?: Window }).window;
    else globalThis.window = oldWindow;
    if (oldDocument === undefined) delete (globalThis as { document?: Document }).document;
    else globalThis.document = oldDocument;
  }
});

test("default balance resolver caches reserves by endpoint and times out hung RPC", async () => {
  const originalFetch = globalThis.fetch;
  const manager = new WalletManager({ adapters: [] });
  const network = manager.getNetwork();
  const session: WalletSession = { adapterId: "mock", connectedAt: 1, account: { address: "rA", network } };
  const methods: string[] = [];
  try {
    globalThis.fetch = (async (_url, init) => {
      const method = JSON.parse(String(init?.body)).method;
      methods.push(method);
      return { ok: true, json: async () => method === "account_info" ? { result: { account_data: { Balance: "20000000" } } } : { result: { state: { validated_ledger: { reserve_base: 1000000, reserve_inc: 200000 } } } } } as Response;
    }) as typeof fetch;
    const resolver = createXrpBalanceResolver();
    await resolver({ address: "rA", network, session });
    await resolver({ address: "rB", network, session });
    assert.deepEqual(methods, ["account_info", "server_state", "account_info"]);
    globalThis.fetch = ((_url, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
    })) as typeof fetch;
    await assert.rejects(createXrpBalanceResolver({ timeoutMs: 10 })({ address: "rA", network, session }), /aborted/);
  } finally { globalThis.fetch = originalFetch; }
});

test("shared abort helper avoids pre-aborted provider work and removes listeners", async () => {
  class Mock extends BaseWalletAdapter {
    metadata = { id: "mock", name: "Mock", type: "extension" as const };
    capabilities = { connect: true as const };
    async connect() { return { account: { address: "rA" } }; }
    run(operation: () => Promise<string>, signal: AbortSignal) { return this.withAbort(operation, signal); }
  }
  const wallet = new Mock();
  const pre = new AbortController(); pre.abort();
  let calls = 0;
  await assert.rejects(wallet.run(async () => { calls += 1; return "late"; }, pre.signal), /connection was rejected/);
  assert.equal(calls, 0);
  const controller = new AbortController();
  let listeners = 0;
  const add = controller.signal.addEventListener.bind(controller.signal);
  const remove = controller.signal.removeEventListener.bind(controller.signal);
  controller.signal.addEventListener = (...args) => { listeners += 1; add(...args); };
  controller.signal.removeEventListener = (...args) => { listeners -= 1; remove(...args); };
  assert.equal(await wallet.run(async () => "ok", controller.signal), "ok");
  assert.equal(listeners, 0);
  const late = deferred<string>();
  const pending = wallet.run(() => late.promise, controller.signal);
  await Promise.resolve();
  controller.abort();
  await assert.rejects(pending, /connection was rejected/);
  assert.equal(listeners, 0);
  late.resolve("ignored");
});
