import assert from "node:assert/strict";
import test from "node:test";
import { Wallet } from "xrpl";
import type { JoeyInjectedProvider } from "@joeywallet/wallet-sdk";
import { createJoeyWalletAdapter } from "../packages/adapters/joey-wallet/src/index";
import { assertWalletAdapter, XRPL_MAINNET, XRPL_TESTNET, WalletKitErrorCode, WalletManager, MemoryWalletStorage, WALLET_STORAGE_VERSION } from "../packages/core/src/index";
import { createWalletClient } from "../packages/client/src/index";

const wallet = Wallet.generate();
const other = Wallet.generate();
const tx = { TransactionType: "Payment" as const, Destination: other.address, Amount: "10000" };

function fixture() {
  const calls: Array<{ method: string; params?: unknown }> = [];
  const listeners = new Map<string, Set<(value: never) => void>>();
  let chain = "xrpl:0";
  let addresses = [wallet.address];
  let failure: unknown;
  let mutate = (value: Record<string, unknown>) => value;
  let wait: (() => Promise<void>) | undefined;
  let readWait: ((method: string) => Promise<void>) | undefined;
  const provider: JoeyInjectedProvider = {
    isJoey: true,
    async request<T>({ method, params }: { method: string; params?: unknown }): Promise<T> {
      calls.push({ method, params });
      if (failure) throw failure;
      if (method === "getAccounts" || method === "getNetwork") await readWait?.(method);
      if (method === "connect") return { accounts: addresses.map(address => ({ address })), chain } as T;
      if (method === "getAccounts") return addresses as T;
      if (method === "getNetwork") return { chain, networkId: Number(chain.split(":")[1]) } as T;
      if (method === "disconnect") return undefined as T;
      if (method === "signTransaction" || method === "signAndSubmitTransaction") {
        await wait?.();
        const input = params as { tx_json: Record<string, unknown>; chain: string; account: string };
        assert.equal(input.account, wallet.address); assert.equal(input.chain, "xrpl:0");
        const signed = wallet.sign(mutate({ ...input.tx_json, Fee: "12", Sequence: 1, LastLedgerSequence: 100 } ) as never);
        return { ...signed, engine_result: "tesSUCCESS" } as T;
      }
      throw new Error(`Unexpected method ${method}`);
    },
    on(event, listener) {
      const set = listeners.get(event) ?? new Set(); set.add(listener); listeners.set(event, set);
      return () => { set.delete(listener); };
    },
  };
  return { provider, calls, listeners,
    emit: (event: string, value: unknown) => { for (const listener of [...(listeners.get(event) ?? [])]) listener(value as never); },
    chain: (value: string) => { chain = value; }, addresses: (value: string[]) => { addresses = value; },
    fail: (value: unknown) => { failure = value; }, mutate: (value: typeof mutate) => { mutate = value; },
    wait: (value: typeof wait) => { wait = value; }, readWait: (value: typeof readWait) => { readWait = value; } };
}

test("Joey is SSR-safe, passive, XRPL-only and separate from WalletConnect", () => {
  const adapter = createJoeyWalletAdapter();
  assertWalletAdapter(adapter);
  assert.equal(adapter.isAvailable(), false);
  assert.equal(adapter.metadata.id, "joey-wallet");
  assert.equal(adapter.metadata.name, "Joey Wallet");
  assert.equal(adapter.capabilities.signMessage, false);
  const client = createWalletClient({ wallets: ["joey-wallet"], network: "mainnet", autoReconnect: false });
  assert.ok(client.getAdapter("joey-wallet"));
  assert.equal(client.getAdapter("joey"), undefined);
});

test("connect verifies the provider chain; restore reads passive state only", async () => {
  const f = fixture(); const adapter = createJoeyWalletAdapter({ provider: f.provider });
  assert.equal(adapter.isAvailable(), true); assert.equal(f.calls.length, 0);
  const result = await adapter.connect({ network: XRPL_MAINNET });
  const session = { adapterId: adapter.metadata.id, account: result.account, connectedAt: Date.now() };
  f.calls.length = 0;
  const restored = await adapter.restoreSession(session);
  assert.equal(restored?.account.address, wallet.address);
  assert.equal(restored?.session.account, restored?.account);
  assert.equal(restored?.session.connectedAt, session.connectedAt);
  assert.deepEqual(f.calls.map(call => call.method), ["getAccounts", "getNetwork"]);
  f.addresses([other.address]); assert.equal(await adapter.restoreSession(session), null);
  f.addresses([wallet.address]); f.chain("xrpl:1"); assert.equal(await adapter.restoreSession(session), null);
  await assert.rejects(adapter.connect({ network: XRPL_MAINNET }));
  assert.equal((await adapter.connect({ network: XRPL_TESTNET })).account.network?.id, "testnet");
  await adapter.disconnect();
  assert.equal([...f.listeners.values()].flatMap(set => [...set]).length, 0);
});

test("manager accepts Joey restored sessions and can sign without a new connect", async () => {
  const f = fixture();
  const adapter = createJoeyWalletAdapter({ provider: f.provider });
  const storage = new MemoryWalletStorage();
  const stored = { adapterId: adapter.metadata.id, connectedAt: Date.now(), account: {
    address: wallet.address, publicKey: "untrusted-cache", network: { ...XRPL_MAINNET }
  } };
  storage.setItem("session", JSON.stringify({ version: WALLET_STORAGE_VERSION, session: stored, updatedAt: Date.now() }));
  const manager = new WalletManager({ adapters: [adapter], network: "mainnet", autoReconnect: true, storage,
    accountStatus: { enabled: false }, transactionConfirmation: { enabled: false }, logger: { level: "silent" } });
  let restoredEvents = 0, connectedEvents = 0;
  manager.on("session_restored", () => { restoredEvents++; });
  manager.on("connected", () => { connectedEvents++; });
  try {
    const restored = await manager.autoReconnect();
    assert.equal(restored?.account.address, wallet.address);
    assert.equal(restored?.account.network?.rpcUrl, XRPL_MAINNET.rpcUrl);
    assert.equal(restored?.account.publicKey, undefined);
    assert.equal(restored?.connectedAt, stored.connectedAt);
    assert.equal(manager.getSession(), restored);
    assert.ok(storage.getItem("session"));
    assert.equal(restoredEvents, 1);
    assert.equal(connectedEvents, 1);
    assert.ok((await manager.signTransaction({ txJson: tx })).txBlob);
    assert.equal(f.calls.some(call => call.method === "connect" || call.method === "signAndSubmitTransaction"), false);
  } finally { manager.destroy(); await adapter.disconnect(); }
});

test("aborted Joey restore cannot bind late provider results or request network", async () => {
  const f = fixture();
  const adapter = createJoeyWalletAdapter({ provider: f.provider });
  const controller = new AbortController();
  let entered!: () => void, release!: () => void;
  const started = new Promise<void>(resolve => { entered = resolve; });
  const gate = new Promise<void>(resolve => { release = resolve; });
  f.readWait(async method => { if (method === "getAccounts") { entered(); await gate; } });
  const session = { adapterId: adapter.metadata.id, connectedAt: Date.now(), account: { address: wallet.address, network: XRPL_MAINNET } };
  const restoring = adapter.restoreSession(session, { network: XRPL_MAINNET, signal: controller.signal });
  try {
    await started;
    controller.abort();
    assert.equal(await restoring, null);
    release();
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.equal(f.calls.some(call => call.method === "getNetwork"), false);
    assert.equal([...f.listeners.values()].some(set => set.size > 0), false);
    await assert.rejects(adapter.signTransaction({ txJson: tx }), { code: WalletKitErrorCode.NOT_CONNECTED });
  } finally { release(); await adapter.disconnect(); }
});

test("sign-only never submits; native submit returns preliminary status", async () => {
  const f = fixture(); const adapter = createJoeyWalletAdapter({ provider: f.provider });
  await adapter.connect({ network: XRPL_MAINNET });
  assert.ok((await adapter.signTransaction({ txJson: tx })).txBlob);
  assert.ok((await adapter.signAndSubmit({ txJson: tx, submit: false })).txBlob);
  assert.equal(f.calls.filter(call => call.method === "signAndSubmitTransaction").length, 0);
  assert.equal((await adapter.signAndSubmit({ txJson: tx })).status, "submitted");
});

test("reject altered intent, excessive fees, unsupported Batch and wrong account/network", async () => {
  const f = fixture(); const adapter = createJoeyWalletAdapter({ provider: f.provider, maxFeeDrops: "100" });
  await adapter.connect({ network: XRPL_MAINNET });
  f.mutate(value => ({ ...value, Amount: "999999" }));
  await assert.rejects(adapter.signTransaction({ txJson: tx }));
  await assert.rejects(adapter.signAndSubmit({ txJson: tx }), (error: any) => error.details?.outcomeUnknown === true);
  f.mutate(value => ({ ...value, Fee: "101" }));
  await assert.rejects(adapter.signTransaction({ txJson: tx }));
  await assert.rejects(adapter.signTransaction({ txJson: { ...tx, Account: other.address } }));
  await assert.rejects(adapter.signTransaction({ txJson: { ...tx, NetworkID: 21337 } }));
  await assert.rejects(adapter.signTransaction({ txJson: { TransactionType: "Batch" } }));
});

test("wallet events invalidate pending signing and remove subscriptions", async () => {
  const f = fixture(); let disconnected = 0;
  const adapter = createJoeyWalletAdapter({ provider: f.provider, onDisconnected: () => { ++disconnected; } });
  await adapter.connect({ network: XRPL_MAINNET });
  let release!: () => void; let started!: () => void;
  const ready = new Promise<void>(resolve => { started = resolve; });
  f.wait(() => { started(); return new Promise<void>(resolve => { release = resolve; }); });
  const pending = adapter.signTransaction({ txJson: tx });
  await ready;
  f.emit("networkChanged", { chain: "xrpl:1" }); release();
  await assert.rejects(pending, (error: any) => error.code === WalletKitErrorCode.REQUEST_CANCELLED);
  assert.equal(disconnected, 1);
  await adapter.disconnect();
  assert.equal([...f.listeners.values()].flatMap(set => [...set]).length, 0);
});

test("rejection and dropped submit responses remain distinguishable", async () => {
  const f = fixture(); const adapter = createJoeyWalletAdapter({ provider: f.provider });
  await adapter.connect({ network: XRPL_MAINNET });
  f.fail({ code: 4001, message: "User rejected" });
  await assert.rejects(adapter.signAndSubmit({ txJson: tx }), (error: any) => error.code === WalletKitErrorCode.SIGN_REJECTED && !error.details?.outcomeUnknown);
  f.fail(new Error("Response dropped"));
  await assert.rejects(adapter.signAndSubmit({ txJson: tx }), (error: any) => error.details?.outcomeUnknown === true);
});

test("local cancellation after dispatch retains unknown submit outcome", async () => {
  const f = fixture(); const adapter = createJoeyWalletAdapter({ provider: f.provider });
  await adapter.connect({ network: XRPL_MAINNET });
  const controller = new AbortController();
  let release!: () => void; let started!: () => void;
  const ready = new Promise<void>(resolve => { started = resolve; });
  f.wait(() => { started(); return new Promise<void>(resolve => { release = resolve; }); });
  const pending = adapter.signAndSubmit({ txJson: tx, signal: controller.signal });
  await ready; controller.abort();
  await assert.rejects(pending, (error: any) => error.code === WalletKitErrorCode.REQUEST_CANCELLED && error.details?.outcomeUnknown === true);
  release();
});
