import assert from "node:assert/strict";
import test from "node:test";
import { adapterSupportsNetwork, intersectChainFilter, matchesChainFilter, MemoryWalletStorage,
  WalletKitErrorCode, WalletManager, WalletStandardAdapter } from "../packages/core/src/index";
import type { WalletAdapter, WalletCapabilities, WalletChainFilter, WalletNetwork } from "../packages/core/src/types";
import type { Wallet } from "@wallet-standard/base";
import type { WalletProtocol } from "../packages/core/src/protocol";

const xrpl: WalletNetwork = { id: "mainnet", name: "XRPL", family: "xrpl", networkType: "MAINNET", rpcUrl: "wss://example.invalid", walletConnectChainId: "xrpl:0" };
const xahau: WalletNetwork = { ...xrpl, id: "xahau-mainnet", name: "Xahau", family: "xahau", networkId: 21337, walletConnectChainId: "xrpl:21337" };
const xahauTest: WalletNetwork = { ...xahau, id: "xahau-testnet", networkId: 21338, networkType: "TESTNET", walletConnectChainId: "xrpl:21338" };

function fixture(details?: WalletCapabilities["details"]) {
  const calls: string[] = [];
  const adapter: WalletAdapter = {
    metadata: { id: "fixture", name: "Fixture", type: "extension" },
    capabilities: { connect: true, signMessage: true, signTransaction: true, signAndSubmit: true, switchNetwork: true, details },
    isAvailable: () => { calls.push("available"); return true; },
    connect: async options => { calls.push("connect"); return { account: { address: "rFixture", network: options.network } }; },
    restoreSession: async session => { calls.push("restore"); return { account: session.account, session }; },
    canRecoverSession: () => { calls.push("canRecover"); return true; },
    recoverSession: async () => { calls.push("recover"); return null; },
    signMessage: async () => { calls.push("message"); return { signatureKind: "signature", signature: "proof" }; },
    signTransaction: async () => { calls.push("sign"); return { txBlob: "ABCD" }; },
    signAndSubmit: async () => { calls.push("submit"); return { hash: "HASH" }; },
    switchNetwork: async network => { calls.push("switch"); return { network }; }
  };
  return { adapter, calls };
}

function manager(adapter: WalletAdapter, network = xrpl, storage = new MemoryWalletStorage()) {
  const unused = () => { throw new Error("Chain-filter fixture must not encode transactions"); };
  const protocol: WalletProtocol = { family: "xahau", networks: [xahau, xahauTest], transactionTypes: [],
    prepare: unused, verify: unused, encode: unused, decode: unused, submit: unused };
  return new WalletManager({ adapters: [adapter], networks: [xrpl, xahau, xahauTest], network: network.id,
    protocols: [protocol],
    storage, autoReconnect: true, accountStatus: { enabled: false }, transactionConfirmation: { enabled: false }, logger: { level: "silent" } });
}

test("runtime selection matches family and network, and refuses undeclared networks", async () => {
  const { adapter } = fixture({ supportedChains: { families: ["xahau"] } });
  let selected: WalletProtocol | undefined;
  adapter.connect = async options => { selected = options.protocolContext?.protocol; return { account: { address: "rFixture", network: options.network } }; };
  const unused = () => { throw new Error("Not called"); };
  const main: WalletProtocol = { family: "xahau", networks: [xahau], transactionTypes: [], prepare: unused, verify: unused, encode: unused, decode: unused, submit: unused };
  const testnet: WalletProtocol = { ...main, networks: [xahauTest] };
  const config = { adapters: [adapter], networks: [xahau, xahauTest], network: xahauTest.id, accountStatus: { enabled: false } };
  const kit = new WalletManager({ ...config, protocols: [main, testnet] });
  try { await kit.connect(adapter.metadata.id); assert.equal(selected, testnet); }
  finally { kit.destroy(); }
  const blocked = new WalletManager({ ...config, protocols: [main] });
  selected = undefined;
  try {
    await assert.rejects(blocked.connect(adapter.metadata.id), { code: WalletKitErrorCode.NETWORK_NOT_SUPPORTED });
    assert.equal(selected, undefined);
  } finally { blocked.destroy(); }
});

test("custom XRPL networks work when both legacy and chain declarations permit them", async () => {
  const custom = { ...xrpl, id: "private-node" };
  const { adapter } = fixture({ supportedNetworks: [custom.id], supportedChains: { families: ["xrpl"] } });
  const kit = new WalletManager({ adapters: [adapter], networks: [custom], network: custom.id, accountStatus: { enabled: false } });
  try {
    await kit.connect(adapter.metadata.id);
    assert.equal(kit.getAccount()?.network?.id, custom.id);
    adapter.capabilities.details!.supportedNetworks = [];
    await assert.rejects(kit.signMessage({ message: "test" }), { code: WalletKitErrorCode.NETWORK_NOT_SUPPORTED });
  } finally { kit.destroy(); }
});

test("manager authentication adds non-XRPL chain identity but raw signMessage stays unchanged", async () => {
  const { adapter } = fixture({ supportedChains: { families: ["xahau"] } });
  let received = "";
  adapter.signMessage = async request => { received = request.message; return { signatureKind: "signature", signature: "proof" }; };
  const kit = manager(adapter, xahau);
  try {
    await kit.connect(adapter.metadata.id);
    await kit.authenticate({ statement: "Sign in" });
    assert.match(received, /Chain ID: xahau:21337/);
    await kit.signMessage({ message: "raw bytes unchanged" });
    assert.equal(received, "raw bytes unchanged");
  } finally { kit.destroy(); }
});

test("non-XRPL chains require a registered runtime before any third-party provider call", async () => {
  const { adapter, calls } = fixture({ supportedChains: { families: ["xahau"] } });
  const kit = new WalletManager({ adapters: [adapter], networks: [xahau], network: xahau.id });
  try {
    await assert.rejects(kit.connect(adapter.metadata.id), { code: WalletKitErrorCode.NETWORK_NOT_SUPPORTED });
    assert.deepEqual(calls, []);
  } finally { kit.destroy(); }
});

test("chain filters distinguish omitted criteria from empty lists and apply AND", () => {
  for (const filter of [{}, { families: [] }, { networkIds: [] }, { networkTypes: [] }]) {
    assert.equal(matchesChainFilter(filter, xrpl), false);
    assert.equal(matchesChainFilter(filter, xahau), false);
  }
  const filter: WalletChainFilter = { families: ["xahau"], networkIds: [xahau.id], networkTypes: ["MAINNET"] };
  assert.equal(matchesChainFilter(filter, xahau), true);
  assert.equal(matchesChainFilter(filter, xrpl), false);
  assert.equal(matchesChainFilter(filter, xahauTest), false);
  assert.equal(matchesChainFilter({ networkIds: [xahau.id] }, xahau), true);
  assert.equal(matchesChainFilter({ families: ["xrpl"] }, { ...xrpl, family: undefined }), true);
});

test("intersection never broadens support, including empty, disjoint and cross-dimension restrictions", () => {
  const max: WalletChainFilter = { families: ["xrpl"], networkIds: [xrpl.id], networkTypes: ["MAINNET"] };
  const requests: readonly WalletChainFilter[] = [{}, { families: [] }, { families: ["xahau"] },
    { families: ["xrpl", "xahau"] }, { networkIds: [xahau.id] }, { networkTypes: ["TESTNET"] }];
  for (const request of requests) {
    const intersection = intersectChainFilter(max, request);
    for (const network of [xrpl, xahau, xahauTest]) {
      assert.equal(matchesChainFilter(intersection, network), matchesChainFilter(max, network) && matchesChainFilter(request, network));
    }
  }
  const values = ["xrpl"];
  const intersection = intersectChainFilter({ families: values }, { families: ["xrpl", "xahau"] });
  values.push("xahau");
  assert.deepEqual(intersection.families, ["xrpl"]);
  assert.equal(matchesChainFilter(intersectChainFilter({ families: ["xrpl"], networkIds: [] }, { families: ["xrpl"] }), xrpl), false);
});

test("new declarations cannot override legacy network restrictions; API version is not authorization", () => {
  const { adapter } = fixture();
  adapter.adapterApiVersion = "1.2";
  assert.equal(adapterSupportsNetwork(adapter, xrpl), true);
  assert.equal(adapterSupportsNetwork(adapter, xahau), false);
  adapter.capabilities.details = { supportedNetworks: [] };
  assert.equal(adapterSupportsNetwork(adapter, xrpl), false);
  adapter.capabilities.details = { supportedNetworks: [xrpl.id], supportedChains: { families: ["xrpl", "xahau"] } };
  assert.equal(adapterSupportsNetwork(adapter, xrpl), true);
  assert.equal(adapterSupportsNetwork(adapter, xahau), false);
  assert.equal(adapterSupportsNetwork(adapter, { ...xrpl, family: "xahau" }), true);
  adapter.capabilities.details = { supportedNetworks: [xrpl.id] };
  assert.equal(adapterSupportsNetwork(adapter, { ...xrpl, family: "xahau" }), false);
});

test("manager blocks unsupported connect/restore/recovery/switch before provider calls", async () => {
  const { adapter, calls } = fixture();
  const kit = manager(adapter, xahau);
  await assert.rejects(kit.connect(adapter.metadata.id), { code: WalletKitErrorCode.NETWORK_NOT_SUPPORTED });
  assert.deepEqual(calls, []);
  assert.equal(await kit.autoReconnect(), null);
  assert.deepEqual(calls, []);
  const storage = new MemoryWalletStorage();
  storage.setItem("session", JSON.stringify({ adapterId: adapter.metadata.id, account: { address: "rFixture", network: xahau }, connectedAt: 1 }));
  const restore = manager(adapter, xahau, storage);
  assert.equal(await restore.autoReconnect(), null);
  assert.deepEqual(calls, []);
  const legacy = manager(adapter);
  await legacy.connect(adapter.metadata.id);
  calls.length = 0;
  await assert.rejects(legacy.switchNetwork(xahau), { code: WalletKitErrorCode.NETWORK_NOT_SUPPORTED });
  assert.deepEqual(calls, []);
  kit.destroy(); restore.destroy(); legacy.destroy();
});

test("switch uses NETWORK_NOT_SUPPORTED for legacy, new and combined declarations", async () => {
  const declarations: readonly NonNullable<WalletCapabilities["details"]>[] = [
    { supportedNetworks: [xrpl.id] },
    { supportedChains: { families: ["xrpl"] } },
    { supportedNetworks: [xrpl.id], supportedChains: { families: ["xrpl", "xahau"] } }
  ];
  for (const details of declarations) {
    const { adapter, calls } = fixture(details);
    const kit = manager(adapter);
    try {
      await kit.connect(adapter.metadata.id);
      calls.length = 0;
      await assert.rejects(kit.switchNetwork(xahau), { code: WalletKitErrorCode.NETWORK_NOT_SUPPORTED });
      assert.deepEqual(calls, []);
      assert.equal(kit.getSession()?.account.network?.id, xrpl.id);
    } finally { kit.destroy(); }
  }
});

test("network restrictions are rechecked before every signing mode and after async preflight", async () => {
  const { adapter, calls } = fixture({ supportedChains: { families: ["xrpl"] } });
  const kit = manager(adapter);
  await kit.connect(adapter.metadata.id);
  calls.length = 0;
  adapter.capabilities.details = { supportedChains: { families: [] } };
  await assert.rejects(kit.signMessage({ message: "hello" }), { code: WalletKitErrorCode.NETWORK_NOT_SUPPORTED });
  const txJson = { TransactionType: "Payment", Account: "rFixture", Destination: "rOther", Amount: "1" };
  await assert.rejects(kit.signTransaction({ txJson }), { code: WalletKitErrorCode.NETWORK_NOT_SUPPORTED });
  await assert.rejects(kit.signAndSubmit({ txJson }), { code: WalletKitErrorCode.NETWORK_NOT_SUPPORTED });
  assert.deepEqual(calls, []);
  adapter.capabilities.details = { supportedChains: { families: ["xrpl"] } };
  await assert.rejects(kit.signTransaction({ txJson, preflight: { checks: [async () => {
    adapter.capabilities.details = { supportedChains: { families: [] } };
  }] } }), { code: WalletKitErrorCode.NETWORK_NOT_SUPPORTED });
  assert.deepEqual(calls, []);
  kit.destroy();
});

test("unsupported provider network changes revoke the active session", async () => {
  const { adapter, calls } = fixture();
  const kit = manager(adapter);
  await kit.connect(adapter.metadata.id);
  const errors: unknown[] = [];
  kit.on("error", event => errors.push(event.error));
  calls.length = 0;
  kit.emitNetworkChanged(adapter.metadata.id, xahau);
  assert.equal(kit.getSession(), null);
  assert.equal(errors.length, 1);
  await assert.rejects(kit.signTransaction({ txJson: { TransactionType: "Payment" } }), { code: WalletKitErrorCode.NOT_CONNECTED });
  assert.deepEqual(calls, []);
  kit.destroy();
});

test("same preset ID cannot hide a provider family or numeric network mismatch", async () => {
  const { adapter } = fixture();
  adapter.connect = async () => ({ account: { address: "rFixture", network: { ...xrpl, family: "xahau" } } });
  const kit = manager(adapter);
  await assert.rejects(kit.connect(adapter.metadata.id), { code: WalletKitErrorCode.NETWORK_MISMATCH });
  assert.equal(kit.getSession(), null);
  kit.destroy();
});

test("Standard derives exact chain presets through the registry, not namespace prefixes", () => {
  const wallet: Wallet = { version: "1.0.0", name: "Fixture", icon: "data:image/png;base64,YQ==", chains: ["xrpl:xahau-mainnet"], accounts: [],
    features: { "standard:connect": { version: "1.0.0", connect: async () => ({ accounts: [] }) },
      "standard:events": { version: "1.0.0", on: () => () => undefined } } };
  const adapter = new WalletStandardAdapter(wallet, { id: "standard", networks: [xrpl, xahau, xahauTest] });
  assert.equal(adapterSupportsNetwork(adapter, xahau), true);
  assert.equal(adapterSupportsNetwork(adapter, xrpl), false);
  assert.equal(adapterSupportsNetwork(adapter, xahauTest), false);
  assert.deepEqual(adapter.capabilities.details?.supportedChains?.families, ["xahau"]);
  const withoutRegistry = new WalletStandardAdapter(wallet, { id: "unmapped" });
  assert.equal(adapterSupportsNetwork(withoutRegistry, xahau), false);
  adapter.dispose(); withoutRegistry.dispose();
});

test("chain-aware connect must prove network on both account and supplied session", async () => {
  const { adapter } = fixture({ supportedChains: { families: ["xrpl"] } });
  const kit = manager(adapter);
  adapter.connect = async () => ({ account: { address: "rFixture" } });
  await assert.rejects(kit.connect(adapter.metadata.id), { code: WalletKitErrorCode.NETWORK_MISMATCH });
  adapter.connect = async () => ({ account: { address: "rFixture", network: xrpl },
    session: { adapterId: adapter.metadata.id, account: { address: "rFixture", network: xahau }, connectedAt: 1 } });
  await assert.rejects(kit.connect(adapter.metadata.id), { code: WalletKitErrorCode.NETWORK_MISMATCH });
  assert.equal(kit.getSession(), null);
  kit.destroy();
});

test("network changes cancel pending signatures even when preset ID is unchanged", async () => {
  const { adapter } = fixture({ supportedChains: { families: ["xrpl", "xahau"] } });
  const kit = manager(adapter);
  await kit.connect(adapter.metadata.id);
  let release!: (value: { txBlob: string }) => void;
  adapter.signTransaction = () => new Promise(resolve => { release = resolve; });
  let signed = 0;
  kit.on("signed", () => { signed++; });
  const signing = kit.signTransaction({ txJson: { TransactionType: "Payment" } });
  const rejection = assert.rejects(signing, { code: WalletKitErrorCode.REQUEST_CANCELLED });
  kit.emitNetworkChanged(adapter.metadata.id, { ...xrpl, family: "xahau", networkId: 21337 });
  await rejection;
  release({ txBlob: "ABCD" });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(signed, 0);
  kit.destroy();
});

test("switch accepts its own provider network event but cannot revive a disconnected session", async () => {
  const { adapter } = fixture({ supportedChains: { families: ["xrpl", "xahau"] } });
  const kit = manager(adapter);
  await kit.connect(adapter.metadata.id);
  adapter.switchNetwork = async network => {
    kit.emitNetworkChanged(adapter.metadata.id, network);
    return { network };
  };
  assert.equal((await kit.switchNetwork(xahau)).id, xahau.id);
  let release!: (value: { network: WalletNetwork }) => void;
  adapter.switchNetwork = () => new Promise(resolve => { release = resolve; });
  const pending = kit.switchNetwork(xrpl);
  const rejection = assert.rejects(pending, { code: WalletKitErrorCode.REQUEST_CANCELLED });
  await kit.disconnect();
  release({ network: xrpl });
  await rejection;
  assert.equal(kit.getSession(), null);
  kit.destroy();
});

test("chain-aware provider events cannot erase network identity and fall back to configured network", async () => {
  for (const event of ["network", "account"] as const) {
    const { adapter } = fixture({ supportedChains: { families: ["xrpl"] } });
    const kit = manager(adapter);
    await kit.connect(adapter.metadata.id);
    if (event === "network") kit.emitNetworkChanged(adapter.metadata.id);
    else kit.emitAccountChanged(adapter.metadata.id, { address: "rOther" });
    assert.equal(kit.getSession(), null);
    kit.destroy();
  }
});
