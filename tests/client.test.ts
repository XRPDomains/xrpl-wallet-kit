import assert from "node:assert/strict";
import test from "node:test";
import { createWalletClient, createWalletKit } from "../packages/client/src/index";
import { LEDGER_ICON } from "../packages/adapters/ledger/src/index";
import type { WalletManager } from "../packages/core/src/manager";
import type { WalletAdapter } from "../packages/core/src/types";
import { adapterSupportsNetwork, WalletKitErrorCode, XRPL_MAINNET, XRPL_TESTNET, MemoryWalletStorage } from "../packages/core/src/index";
import type { WalletProtocolContext } from "../packages/core/src/protocol";

function getAdapterOption(manager: WalletManager, adapterId: string, key: string): unknown {
  const adapter = manager.adapters.get(adapterId) as unknown as { options?: Record<string, unknown> } | undefined;
  return adapter?.options?.[key];
}

test("client isolates localStorage per family/network for XRPL and Xahau", async () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  const values = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key)
  } });
  const managers = ["mainnet", "testnet", "devnet", "xahau-mainnet", "xahau-testnet"].map(network => createWalletClient({ network, storage: "localStorage", adapters: [] }));
  try {
    for (const [index, manager] of managers.entries()) await manager.storage.setItem("marker", String(index));
    for (const [index, manager] of managers.entries()) assert.equal(await manager.storage.getItem("marker"), String(index));
    assert.equal(values.get("xrpl-wallet-kit.xrpl.mainnet.marker"), "0");
    const legacySession = JSON.stringify({ version: 1, updatedAt: 1, session: {
      adapterId: "mock", connectedAt: 1, account: { address: "rLegacy", network: XRPL_MAINNET }
    } });
    values.set("xrpl-wallet-kit.session", legacySession);
    assert.equal(await managers[0].storage.getItem("session"), legacySession);
    assert.equal(await managers[1].storage.getItem("session"), null);
    assert.equal(await managers[3].storage.getItem("session"), null);
    await managers[0].storage.removeItem("session");
    const reloaded = createWalletClient({ network: "mainnet", storage: "localStorage", adapters: [] });
    try { assert.equal(await reloaded.storage.getItem("session"), null); } finally { reloaded.destroy(); }
    assert.equal(values.get("xrpl-wallet-kit.session"), legacySession, "Legacy data is not deleted");
    const custom = new MemoryWalletStorage();
    const injected = createWalletClient({ network: "testnet", storage: custom, adapters: [] });
    try { assert.equal(injected.storage, custom); } finally { injected.destroy(); }
  } finally {
    managers.forEach(manager => manager.destroy());
    if (previous) Object.defineProperty(globalThis, "localStorage", previous);
    else Reflect.deleteProperty(globalThis, "localStorage");
  }
});

test("client configures Xahau presets/runtime and compatible default wallets without changing XRPL defaults", () => {
  for (const network of ["xahau-mainnet", "xahau-testnet"]) {
    const manager = createWalletClient({ network, xamanClientId: "fixture-client" });
    try {
      assert.equal(manager.getNetwork().family, "xahau");
      assert.deepEqual([...manager.adapters.values()].filter(adapter => adapterSupportsNetwork(adapter, manager.getNetwork()))
        .map(adapter => adapter.metadata.id), ["xaman", "gemwallet", "xyra"]);
      assert.equal(adapterSupportsNetwork(manager.adapters.get("ledger")!, manager.getNetwork()), false);
    } finally { manager.destroy(); }
  }
  const xrpl = createWalletClient({ network: "mainnet" });
  try {
    assert.equal(getAdapterOption(xrpl, "gemwallet", "supportedChains"), undefined);
    assert.equal(xrpl.adapters.has("xyra"), false);
  } finally { xrpl.destroy(); }
  const explicit = createWalletClient({ network: "xahau-testnet", wallets: ["ledger"] });
  try { assert.equal(adapterSupportsNetwork(explicit.adapters.get("ledger")!, explicit.getNetwork()), true); }
  finally { explicit.destroy(); }
});

test("client merges Xahau networks by id with caller overrides taking precedence", () => {
  const custom = { id: "xahau-testnet", family: "xahau", name: "Custom label", networkType: "TESTNET" as const,
    networkId: 21338, rpcUrl: "wss://xahau-test.net", httpRpcUrl: "https://xahau-test.net" };
  const manager = createWalletClient({ network: custom.id, networks: [custom, { ...custom, name: "Final label" }] });
  try {
    assert.equal(manager.networks.filter(network => network.id === custom.id).length, 1);
    assert.equal(manager.getNetwork().name, "Final label");
  } finally { manager.destroy(); }
});

test("client lazily prepares Xahau, forwards bounded fees, and exposes kit.connect", async () => {
  let context: WalletProtocolContext | undefined;
  let rpcCalls = 0;
  const address = "rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh";
  const adapter: WalletAdapter = {
    metadata: { id: "fixture", name: "Fixture", type: "extension" },
    capabilities: { connect: true, signTransaction: true, signAndSubmit: true, details: { supportedChains: { families: ["xahau"] } } },
    connect: async options => {
      context = options.protocolContext;
      return { account: { address, network: options.network } };
    },
    signTransaction: async request => {
      assert.equal(request.maxFeeDrops, "50");
      const tx = await context!.protocol.prepare(request.txJson, { address }, context!.network, request);
      assert.equal(tx.NetworkID, 21338);
      assert.equal(tx.Fee, "10");
      assert.equal(tx.Account, address);
      return { txBlob: context!.protocol.encode(tx) };
    },
    signAndSubmit: async request => {
      assert.equal(request.maxFeeDrops, "100");
      return { signed: true, status: "signed" };
    }
  };
  const kit = createWalletKit({ network: "xahau-testnet", adapters: [adapter], modal: false,
    accountStatus: { enabled: false }, transactionConfirmation: { enabled: false },
    preflight: { maxFeeDrops: "100", allowedTransactionTypes: ["Payment"] },
    xahau: { request: async (_network, method) => {
      rpcCalls++;
      if (method === "server_info") return { info: { network_id: 21338, validated_ledger: { seq: 100, age: 1 } } };
      if (method === "account_info") return { account_data: { Account: address, Sequence: 1 }, queue_data: { txn_count: 0 } };
      if (method === "fee") return { drops: { base_fee: "10", open_ledger_fee: "10" } };
      throw new Error(`Unexpected RPC ${method}`);
    } }
  });
  const txJson = { TransactionType: "Payment", Destination: "rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe", Amount: "1" };
  try {
    await kit.connect("fixture");
    assert.equal(rpcCalls, 0);
    const result = await kit.signTransaction({ txJson, maxFeeDrops: "50" });
    assert.ok(result.txBlob);
    assert.equal(rpcCalls, 3);
    await kit.signAndSubmit({ txJson, maxFeeDrops: "1000", preflight: { maxFeeDrops: "500" } });
    await kit.signAndSubmit({ txJson, preflight: false });
    assert.equal((await kit.manager.preflightTransaction({ txJson })).allowed, true);
    await assert.rejects(kit.signTransaction({ txJson, maxFeeDrops: "0" }), { code: WalletKitErrorCode.INVALID_REQUEST });
    await assert.rejects(kit.signTransaction({ txJson: { ...txJson, Fee: "101" } }), { code: WalletKitErrorCode.PREFLIGHT_FAILED });
    await assert.rejects(kit.signTransaction({ txJson: { ...txJson, TransactionType: "Invoke" } }),
      { code: WalletKitErrorCode.PREFLIGHT_FAILED });
    assert.equal("Account" in txJson, false);
  } finally { kit.manager.destroy(); }
});

test("createWalletClient forwards WalletConnect sign message destination to default adapter", () => {
  const manager = createWalletClient({
    appName: "Test dApp",
    walletConnectProjectId: "test-project",
    walletConnectSignMessageDestination: "rDestinationForMessageProof",
    ui: {
      walletConnect: {
        mode: "default"
      }
    }
  });

  assert.equal(getAdapterOption(manager, "walletconnect", "signMessageDestination"), "rDestinationForMessageProof");
});

test("createWalletClient uses WalletConnect AppKit mode by default", () => {
  const manager = createWalletClient({
    appName: "Test dApp",
    walletConnectProjectId: "test-project"
  });

  assert.deepEqual([...manager.adapters.keys()].filter((id) => id === "walletconnect"), ["walletconnect"]);
  assert.equal(getAdapterOption(manager, "walletconnect", "useModal"), true);
  assert.equal(getAdapterOption(manager, "walletconnect", "modalMode"), "always");
});

test("createWalletClient forwards app metadata to WalletConnect and keeps legacy aliases as fallback", () => {
  const manager = createWalletClient({
    metadata: {
      name: "Metadata dApp",
      description: "Metadata description",
      url: "https://metadata.example",
      icons: ["https://metadata.example/icon.png"]
    },
    appName: "Legacy dApp",
    appDescription: "Legacy description",
    appUrl: "https://legacy.example",
    appIcons: ["https://legacy.example/icon.png"],
    walletConnectProjectId: "test-project"
  });

  assert.deepEqual(getAdapterOption(manager, "walletconnect", "metadata"), {
    name: "Metadata dApp",
    description: "Metadata description",
    url: "https://metadata.example",
    icons: ["https://metadata.example/icon.png"]
  });
});

test("createWalletClient accepts xrpl-snap wallet id alias", () => {
  const manager = createWalletClient({
    appName: "Test dApp",
    wallets: ["xrpl-snap"]
  });

  assert.deepEqual([...manager.adapters.keys()], ["xrplsnap"]);
});

test("createWalletClient keeps canonical xrplsnap wallet id working", () => {
  const manager = createWalletClient({
    appName: "Test dApp",
    wallets: ["xrplsnap"]
  });

  assert.deepEqual([...manager.adapters.keys()], ["xrplsnap"]);
});

test("createWalletClient includes Ledger in default adapters and selective wallet lists", () => {
  const defaultManager = createWalletClient({
    appName: "Test dApp",
    walletConnectProjectId: "test-project"
  });
  assert.equal(defaultManager.adapters.has("ledger"), true);
  assert.deepEqual([...defaultManager.adapters.keys()].slice(-2), ["walletconnect", "ledger"]);

  const ledgerOnlyManager = createWalletClient({
    appName: "Test dApp",
    wallets: ["ledger"]
  });
  assert.deepEqual([...ledgerOnlyManager.adapters.keys()], ["ledger"]);
});

test("Ledger default icon uses a valid SVG namespace", () => {
  const prefix = "data:image/svg+xml;base64,";
  assert.equal(LEDGER_ICON.startsWith(prefix), true);
  const svg = Buffer.from(LEDGER_ICON.slice(prefix.length), "base64").toString("utf8");
  assert.match(svg, /xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
});

test("createWalletClient forwards WalletConnect sign message destination to detail adapters", () => {
  const manager = createWalletClient({
    appName: "Test dApp",
    walletConnectProjectId: "test-project",
    walletConnectSignMessageDestination: "rDestinationForMessageProof",
    ui: {
      walletConnect: {
        mode: "list"
      }
    }
  });

  assert.equal(getAdapterOption(manager, "bitget", "signMessageDestination"), "rDestinationForMessageProof");
  assert.equal(getAdapterOption(manager, "joey", "signMessageDestination"), "rDestinationForMessageProof");
  assert.equal(getAdapterOption(manager, "girin", "signMessageDestination"), "rDestinationForMessageProof");
});

test("createWalletKit exposes subscribe as an event alias", async () => {
  const adapter = createMockAdapter();
  const kit = createWalletKit({
    appName: "Test dApp",
    adapters: [adapter],
    modal: false
  });
  const connected: string[] = [];

  const unsubscribe = kit.subscribe("connected", (event) => {
    connected.push(event.account.address);
  });

  await kit.manager.connect("mock");
  unsubscribe();
  await kit.manager.disconnect();

  assert.deepEqual(connected, ["rMockAddress"]);
});

test("createWalletKit subscribe can track state snapshots", async () => {
  const adapter = createMockAdapter();
  const kit = createWalletKit({
    appName: "Test dApp",
    adapters: [adapter],
    modal: false
  });
  const statuses: string[] = [];

  const unsubscribe = kit.subscribe((snapshot) => {
    statuses.push(`${snapshot.eventName ?? "initial"}:${snapshot.status}`);
  });

  await kit.manager.connect("mock");
  await kit.manager.disconnect();
  unsubscribe();

  assert.deepEqual(statuses, [
    "initial:disconnected",
    "connecting:connecting",
    "connected:connected",
    "disconnected:disconnected"
  ]);
});

function createMockAdapter(): WalletAdapter {
  return {
    metadata: {
      id: "mock",
      name: "Mock Wallet",
      type: "extension"
    },
    capabilities: {
      connect: true,
      disconnect: true
    },
    connect: async () => ({
      account: {
        address: "rMockAddress"
      }
    }),
    disconnect: async () => {}
  };
}
