import assert from "node:assert/strict";
import test from "node:test";
import { getWallets } from "@wallet-standard/app";
import type { Wallet, WalletAccount } from "@wallet-standard/base";
import { MemoryWalletStorage, WalletManager, WalletStandardAdapter, startWalletStandardDiscovery, isXrplStandardWallet,
  WalletKitErrorCode, XRPL_STANDARD_SIGN_TRANSACTION as SIGN, XRPL_STANDARD_SIGN_AND_SUBMIT as SUBMIT } from "../packages/core/src/index";
import { createWalletStandardWallet } from "../packages/core/src/standard-wallet";

const network = { id: "testnet", name: "Testnet", networkType: "TESTNET", rpcUrl: "wss://example.invalid", walletConnectChainId: "xrpl:1" } as const;
const icon = "data:image/png;base64,YQ==" as const;
const txJson = { TransactionType: "Payment", Account: "rStandard" };
function fixture(name = "Example") {
  const listeners = new Set<(properties: unknown) => void>();
  let accounts: readonly WalletAccount[] = [{ address: "rStandard", publicKey: new Uint8Array([1, 2]), chains: ["xrpl:1"], features: [SIGN, SUBMIT] }];
  const calls: { method: string; input?: any }[] = [];
  const features: Wallet["features"] = {
    "standard:connect": { version: "1.0.0", connect: async () => { calls.push({ method: "connect" }); return { accounts }; } },
    "standard:disconnect": { version: "1.0.0", disconnect: async () => { calls.push({ method: "disconnect" }); } },
    "standard:events": { version: "1.0.0", on: (_event: string, listener: (properties: unknown) => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; } },
    [SIGN]: { version: "1.0.0", signTransaction: async (input: any) => { calls.push({ method: "sign", input }); return { signed_tx_blob: "ABCD" }; } },
    [SUBMIT]: { version: "1.0.0", signAndSubmitTransaction: async (input: any) => { calls.push({ method: "submit", input }); return { tx_hash: "HASH" }; } }
  };
  const wallet: Wallet = { version: "1.0.0", name, icon, chains: ["xrpl:1"], features, get accounts() { return accounts; } };
  return { wallet, calls, features, listeners, change: (next: readonly WalletAccount[]) => { accounts = next; listeners.forEach(listener => listener({ accounts })); } };
}
function manager() { return new WalletManager({ networks: [network], network: network.id, accountStatus: { enabled: false }, transactionConfirmation: { enabled: false }, logger: { level: "silent" } }); }

test("discovery handles pre-existing and late wallets, duplicate names and legacy coexistence without prompting", () => {
  const registry = getWallets(); const before = fixture("Same Name"); const after = fixture("Same Name");
  const removeBefore = registry.register(before.wallet);
  const kit = manager();
  const legacy = { metadata: { id: "legacy", name: "Legacy", type: "extension" as const }, capabilities: { connect: true }, connect: async () => ({ account: { address: "rLegacy" } }) };
  kit.register(legacy);
  const discovery = startWalletStandardDiscovery(kit, { registry });
  let changes = 0; kit.on("walletsChanged", () => changes++);
  const removeAfter = registry.register(after.wallet);
  const duplicate = registry.register(after.wallet);
  assert.equal(discovery.getAdapters().length, 2);
  assert.equal(kit.getWallets().length, 3);
  assert.notEqual(discovery.getAdapters()[0].metadata.id, discovery.getAdapters()[1].metadata.id);
  assert.equal(kit.getAdapter("legacy"), legacy);
  assert.equal(changes, 1);
  assert.deepEqual(before.calls, []); assert.deepEqual(after.calls, []);
  duplicate(); assert.equal(discovery.getAdapters().length, 2);
  removeAfter(); assert.equal(discovery.getAdapters().length, 1);
  discovery.dispose(); discovery.dispose();
  assert.equal(before.listeners.size, 0); assert.equal(after.listeners.size, 0);
  assert.equal(kit.getWallets().length, 1); removeBefore(); kit.destroy();
});

test("XRPL Standard bridge preserves sign-only versus submit and does not leak control fields", async () => {
  const wallet = fixture(); const kit = manager(); const registry = getWallets();
  const unregister = registry.register(wallet.wallet);
  const discovery = startWalletStandardDiscovery(kit, { registry });
  const id = discovery.getAdapters()[0].metadata.id;
  await kit.connect(id);
  assert.equal(kit.getAccount()?.publicKey, "0102");
  assert.equal((await kit.signTransaction({ txJson, signal: new AbortController().signal })).txBlob, "ABCD");
  const signed = await kit.signAndSubmit({ txJson, submit: false });
  assert.equal(signed.status, "signed"); assert.equal(kit.getTransactions().length, 0);
  assert.equal((await kit.signAndSubmit({ txJson })).hash, "HASH");
  assert.deepEqual(wallet.calls.map(call => call.method), ["connect", "sign", "sign", "submit"]);
  for (const call of wallet.calls.slice(1)) {
    assert.equal(call.input.network, "xrpl:1"); assert.equal(call.input.account, wallet.wallet.accounts[0]);
    assert.deepEqual(Object.keys(call.input).sort(), ["account", "network", "tx_json"]);
    assert.notEqual(call.input.tx_json, txJson);
  }
  await assert.rejects(kit.signTransaction({ txJson: { ...txJson, Account: "rOther" } }), { code: WalletKitErrorCode.INVALID_REQUEST });
  await assert.rejects(kit.signTransaction({ txJson, walletPayload: {} }), { code: WalletKitErrorCode.INVALID_REQUEST });
  assert.equal(kit.can("signMessage"), false);
  unregister(); assert.equal(kit.getSession(), null); assert.equal(discovery.getAdapters().length, 0);
  discovery.dispose(); kit.destroy();
});

test("account change/revocation updates manager and unregister cancels in-flight signing", async () => {
  const wallet = fixture(); const kit = manager(); const registry = getWallets();
  const unregister = registry.register(wallet.wallet); const discovery = startWalletStandardDiscovery(kit, { registry });
  const id = discovery.getAdapters()[0].metadata.id;
  await kit.connect(id);
  wallet.change([{ ...wallet.wallet.accounts[0], address: "rChanged" }]);
  assert.equal(kit.getAccount()?.address, "rChanged");
  let finish!: (value: unknown) => void;
  (wallet.features[SUBMIT] as any).signAndSubmitTransaction = () => new Promise(resolve => { finish = resolve; });
  let signed = 0; kit.on("signed", () => signed++);
  const pending = kit.signAndSubmit({ txJson: { ...txJson, Account: "rChanged" } });
  const rejection = assert.rejects(pending, { code: WalletKitErrorCode.REQUEST_CANCELLED });
  unregister(); await rejection;
  finish({ tx_hash: "LATE" }); await new Promise(resolve => setImmediate(resolve));
  assert.equal(signed, 0); assert.equal(kit.getSession(), null); assert.equal(wallet.listeners.size, 0);
  discovery.dispose(); kit.destroy();
});

test("restoration is opt-in and passive, and collisions never replace configured adapters", async () => {
  const wallet = fixture(); const kit = manager(); const registry = getWallets(); const remove = registry.register(wallet.wallet);
  assert.throws(() => startWalletStandardDiscovery(kit, { registry, allowRestore: true }), { code: WalletKitErrorCode.INVALID_REQUEST });
  const discovery = startWalletStandardDiscovery(kit, { registry, resolveId: () => "trusted-wallet", allowRestore: true });
  const adapter = discovery.getAdapters()[0];
  const restored = await adapter.restoreSession({ adapterId: adapter.metadata.id, account: { address: "rStandard", network }, connectedAt: Date.now() });
  assert.equal(restored?.account.address, "rStandard"); assert.equal(wallet.calls.length, 0);
  assert.equal(await adapter.restoreSession({ adapterId: adapter.metadata.id, account: { address: "rOther", network }, connectedAt: Date.now() }), null);
  const other = startWalletStandardDiscovery(kit, { registry, resolveId: () => "trusted-wallet" });
  assert.equal(other.getAdapters().length, 0);
  other.dispose(); assert.equal(kit.getAdapter("trusted-wallet"), adapter);
  discovery.dispose(); remove(); kit.destroy();
});

test("destroy detaches each discovery listener even when an earlier observer throws, without logging out wallets", async () => {
  const wallet = fixture(); const kit = manager(); const registry = getWallets(); const remove = registry.register(wallet.wallet);
  kit.on("destroyed", () => { throw new Error("observer"); });
  const discovery = startWalletStandardDiscovery(kit, { registry });
  await kit.connect(discovery.getAdapters()[0].metadata.id);
  kit.destroy(); kit.destroy();
  assert.equal(wallet.listeners.size, 0); assert.equal(discovery.getAdapters().length, 0);
  assert.deepEqual(wallet.calls.map(call => call.method), ["connect"]);
  const next = fixture(); const removeNext = registry.register(next.wallet);
  assert.equal(next.listeners.size, 0); removeNext(); remove();
});

test("unsupported schemas/feature versions are rejected and unsafe icons are omitted", async () => {
  const wallet = fixture();
  assert.equal(isXrplStandardWallet({ ...wallet.wallet, version: "2.0.0" }), false);
  assert.equal(isXrplStandardWallet({ ...wallet.wallet, chains: ["solana:mainnet"] }), false);
  const adapter = new WalletStandardAdapter({ ...wallet.wallet, icon: "data:image/svg+xml;base64,PHN2Zz4=" }, { id: "safe" });
  assert.equal(adapter.metadata.icon, undefined);
  (wallet.features[SIGN] as any).version = "2.0.0";
  assert.equal(adapter.capabilities.signTransaction, false);
  await assert.rejects(adapter.connect({ network: { ...network, walletConnectChainId: "xrpl:0" } }), { code: WalletKitErrorCode.NETWORK_NOT_SUPPORTED });
  await adapter.connect({ network });
  await assert.rejects(adapter.signTransaction({ txJson }), { code: WalletKitErrorCode.UNSUPPORTED_METHOD });
  wallet.change([]); adapter.dispose();
});

test("removing an adapter invalidates a passive restoration already in progress", async () => {
  const storage = new MemoryWalletStorage();
  let resolve!: (value: any) => void; let entered!: () => void;
  const started = new Promise<void>(done => { entered = done; });
  const adapter = { metadata: { id: "slow", name: "Slow", type: "extension" as const }, capabilities: { connect: true },
    connect: async () => ({ account: { address: "rStandard", network } }),
    restoreSession: async () => { entered(); return new Promise<any>(done => { resolve = done; }); } };
  const kit = new WalletManager({ adapters: [adapter], networks: [network], network: network.id, storage, accountStatus: { enabled: false }, logger: { level: "silent" } });
  await kit.connect("slow");
  kit.destroy();
  const next = new WalletManager({ adapters: [adapter], networks: [network], network: network.id, storage, autoReconnect: true, accountStatus: { enabled: false }, logger: { level: "silent" } });
  const pending = next.autoReconnect(); await started; next.unregister("slow");
  resolve({ account: { address: "rStandard", network } });
  assert.equal(await pending, null); assert.equal(next.getSession(), null); next.destroy();
});

test("legacy Standard wrapper delegates signing without prompting during discovery or silent connect", async () => {
  const calls: string[] = [];
  const wallet = createWalletStandardWallet({ metadata: { id: "legacy", name: "Legacy", type: "extension" },
    capabilities: { connect: true, signAndSubmit: true, details: { transactionModes: ["sign-only", "sign-and-submit"] } },
    connect: async () => { calls.push("connect"); return { account: { address: "rStandard", network } }; },
    signAndSubmit: async request => { calls.push(request.submit === false ? "sign" : "submit"); return request.submit === false ? { txBlob: "ABCD" } : { hash: "HASH" }; }
  }, { networks: [network], icon });
  const connect = (wallet.features["standard:connect"] as any).connect;
  assert.deepEqual((await connect({ silent: true })).accounts, []);
  assert.equal(calls.length, 0);
  const kit = manager(); const registry = getWallets(); const remove = registry.register(wallet);
  const discovery = startWalletStandardDiscovery(kit, { registry });
  const id = discovery.getAdapters()[0].metadata.id;
  await kit.connect(id);
  await kit.signTransaction({ txJson }); await kit.signAndSubmit({ txJson });
  assert.deepEqual(calls, ["connect", "sign", "submit"]);
  await assert.rejects((wallet.features[SIGN] as any).signTransaction({ tx_json: txJson, account: { ...wallet.accounts[0] }, network: "xrpl:1" }), { code: WalletKitErrorCode.INVALID_REQUEST });
  await (wallet.features["standard:disconnect"] as any).disconnect();
  assert.equal(kit.getSession(), null);
  discovery.dispose(); remove(); kit.destroy();
});

test("discovery rejects a destroyed manager and removing during connection startup cannot activate a wallet", async () => {
  const kit = manager();
  let calls = 0;
  kit.register({ metadata: { id: "transient", name: "Transient", type: "extension" }, capabilities: { connect: true },
    connect: async () => { calls++; return { account: { address: "rStandard", network } }; } });
  const pending = kit.connect("transient");
  kit.unregister("transient");
  await assert.rejects(pending);
  assert.equal(calls, 0); assert.equal(kit.getSession(), null);
  kit.destroy();
  assert.throws(() => startWalletStandardDiscovery(kit, { registry: getWallets() }), { code: WalletKitErrorCode.REQUEST_CANCELLED });
});

test("Standard account feature restrictions, reserved aliases, and malformed submit results fail closed", async () => {
  const wallet = fixture();
  wallet.change([{ ...wallet.wallet.accounts[0], chains: ["xrpl:testnet"], features: [SIGN] }]);
  const adapter = new WalletStandardAdapter(wallet.wallet, { id: "restricted" });
  await adapter.connect({ network });
  await adapter.signTransaction({ txJson });
  await assert.rejects(adapter.signAndSubmit({ txJson }), { code: WalletKitErrorCode.UNSUPPORTED_METHOD });
  assert.equal(wallet.calls.some(call => call.method === "submit"), false);
  wallet.change([{ ...wallet.wallet.accounts[0], features: [SIGN, SUBMIT] }]);
  (wallet.features[SUBMIT] as any).signAndSubmitTransaction = async () => ({});
  await assert.rejects(adapter.signAndSubmit({ txJson }), { code: WalletKitErrorCode.SIGN_FAILED });
  (wallet.features[SIGN] as any).signTransaction = async () => ({ signed_tx_blob: "not-hex" });
  await assert.rejects(adapter.signTransaction({ txJson }), { code: WalletKitErrorCode.SIGN_FAILED });
  adapter.dispose();
});

test("stable opt-in discovery restores only an already-authorized account through autoReconnect", async () => {
  const wallet = fixture(); const registry = getWallets(); const remove = registry.register(wallet.wallet);
  const storage = new MemoryWalletStorage();
  const setup = () => new WalletManager({ networks: [network], network: network.id, storage, autoReconnect: true, accountStatus: { enabled: false }, logger: { level: "silent" } });
  const first = setup(); startWalletStandardDiscovery(first, { registry, resolveId: () => "trusted", allowRestore: true });
  await first.connect("trusted"); first.destroy();
  const second = setup(); startWalletStandardDiscovery(second, { registry, resolveId: () => "trusted", allowRestore: true });
  assert.equal((await second.autoReconnect())?.account.address, "rStandard");
  assert.deepEqual(wallet.calls.map(call => call.method), ["connect"]);
  second.destroy(); remove();
});

test("legacy wrapper rejects reported network mismatch and relays authorization revocation", async () => {
  const legacy = { metadata: { id: "legacy", name: "Legacy", type: "extension" as const }, capabilities: { connect: true },
    connect: async () => ({ account: { address: "rStandard", networkType: "MAINNET" } }) };
  const wallet = createWalletStandardWallet(legacy, { networks: [network], icon });
  await assert.rejects((wallet.features["standard:connect"] as any).connect(), { code: WalletKitErrorCode.NETWORK_MISMATCH });
  wallet.updateAccount({ address: "rAuthorized", network });
  assert.equal(wallet.accounts[0].address, "rAuthorized");
  wallet.updateAccount(null); assert.deepEqual(wallet.accounts, []);
});

test("duplicate discovery does not register the same provider twice or remove another controller's adapter", () => {
  const wallet = fixture(); const registry = getWallets(); const remove = registry.register(wallet.wallet); const kit = manager();
  const first = startWalletStandardDiscovery(kit, { registry });
  const second = startWalletStandardDiscovery(kit, { registry });
  assert.equal(kit.getWallets().length, 1); assert.equal(second.getAdapters().length, 0);
  second.dispose(); assert.equal(kit.getWallets().length, 1);
  first.dispose(); remove(); kit.destroy();
});

test("account revocation during connection persistence cannot save a stale Standard session", async () => {
  const wallet = fixture(); const registry = getWallets(); const remove = registry.register(wallet.wallet);
  let writing!: () => void; let release!: () => void;
  const started = new Promise<void>(resolve => { writing = resolve; });
  const gate = new Promise<void>(resolve => { release = resolve; });
  const values = new Map<string, string>();
  const kit = new WalletManager({ networks: [network], network: network.id, accountStatus: { enabled: false }, logger: { level: "silent" }, storage: {
    getItem: key => values.get(key) ?? null,
    setItem: async (key, value) => { writing(); await gate; values.set(key, value); },
    removeItem: key => { values.delete(key); }
  } });
  const discovery = startWalletStandardDiscovery(kit, { registry });
  const pending = kit.connect(discovery.getAdapters()[0].metadata.id);
  const rejection = assert.rejects(pending, { code: WalletKitErrorCode.REQUEST_CANCELLED });
  await started; wallet.change([]); await rejection; release();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(kit.getSession(), null); assert.equal(values.size, 0);
  discovery.dispose(); kit.destroy(); remove();
});
