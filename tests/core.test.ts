import assert from "node:assert/strict";
import test from "node:test";
import {
  BaseWalletAdapter,
  MemoryWalletStorage,
  WalletKitErrorCode,
  WalletManager,
  WALLET_STORAGE_VERSION,
  createNetworkRegistry,
  getExplorerAccountUrl,
  getHttpRpcUrl,
  getNativeAsset,
  isMainnetNetwork,
  isWalletKitError,
  normalizeTxResult
} from "../packages/core/src/index";

const network = {
  id: "mainnet",
  name: "XRPL Mainnet",
  networkType: "MAINNET",
  rpcUrl: "wss://xrplcluster.com",
  walletConnectChainId: "xrpl:0"
} as const;

class MockAdapter extends BaseWalletAdapter {
  metadata = { id: "mock", name: "Mock Wallet", type: "extension" } as const;
  capabilities = { connect: true, signMessage: true, signAndSubmit: true };
  restoreCalls = 0;

  async isAvailable() {
    return true;
  }

  async connect(options: { network?: typeof network }) {
    const account = { address: "rMockAddress", network: options.network ?? network };
    return {
      account,
      session: {
        adapterId: this.metadata.id,
        account,
        connectedAt: 1
      }
    };
  }

  async restoreSession(session: Awaited<ReturnType<WalletManager["connect"]>>) {
    this.restoreCalls += 1;
    return { account: session.account, session };
  }
}

test("WalletManager stores sessions in a versioned envelope", async () => {
  const storage = new MemoryWalletStorage();
  const manager = new WalletManager({
    appName: "Test",
    adapters: [new MockAdapter()],
    storage,
    logger: { level: "silent" }
  });

  await manager.connect("mock", { network });
  const stored = JSON.parse(await storage.getItem("session") ?? "{}") as {
    version?: number;
    session?: { adapterId?: string; wallet?: { name?: string } };
    updatedAt?: number;
  };

  assert.equal(stored.version, WALLET_STORAGE_VERSION);
  assert.equal(stored.session?.adapterId, "mock");
  assert.equal(stored.session?.wallet?.name, "Mock Wallet");
  assert.equal(typeof stored.updatedAt, "number");
});

test("WalletManager can restore legacy unversioned sessions", async () => {
  const storage = new MemoryWalletStorage();
  const adapter = new MockAdapter();
  const legacySession = {
    adapterId: "mock",
    account: { address: "rLegacyAddress", network },
    connectedAt: 1
  };
  await storage.setItem("session", JSON.stringify(legacySession));

  const manager = new WalletManager({
    appName: "Test",
    adapters: [adapter],
    storage,
    autoReconnect: true,
    logger: { level: "silent" }
  });

  const restored = await manager.autoReconnect();

  assert.equal(adapter.restoreCalls, 1);
  assert.equal(restored?.account.address, "rLegacyAddress");
  assert.equal(manager.getSession()?.wallet?.name, "Mock Wallet");
});

test("WalletManager throws typed errors for missing adapters", async () => {
  const manager = new WalletManager({
    appName: "Test",
    adapters: [],
    logger: { level: "silent" }
  });

  await assert.rejects(
    () => manager.connect("missing"),
    (error) => isWalletKitError(error) && error.code === WalletKitErrorCode.WALLET_NOT_FOUND
  );
});


test("NetworkRegistry resolves native asset, HTTP RPC, explorer, and mainnet identity guard", () => {
  const xahau = {
    id: "xahau-mainnet",
    name: "Xahau Mainnet",
    family: "xrpl",
    networkType: "CUSTOM",
    nativeAsset: "XAH",
    nativeAssetDecimals: 6,
    rpcUrl: "wss://xahau.network",
    walletConnectChainId: "xrpl:21337",
    explorerAccountUrl: "https://explorer.xahau.network/accounts/{address}"
  } as const;
  const registry = createNetworkRegistry([network, xahau]);

  assert.equal(registry.resolve("xahau-mainnet").name, "Xahau Mainnet");
  assert.equal(getNativeAsset(xahau), "XAH");
  assert.equal(getHttpRpcUrl(xahau), "https://xahau.network");
  assert.equal(getExplorerAccountUrl(xahau, "rTest"), "https://explorer.xahau.network/accounts/rTest");
  assert.equal(isMainnetNetwork(network), true);
  assert.equal(isMainnetNetwork(xahau), false);
});
test("BaseWalletAdapter runs cleanup handlers once in reverse order", async () => {
  class CleanupAdapter extends BaseWalletAdapter {
    metadata = { id: "cleanup", name: "Cleanup Wallet", type: "extension" } as const;
    capabilities = { connect: true };

    async connect() {
      return { account: { address: "rCleanup" } };
    }

    track(handler: () => void) {
      return this.addCleanup(handler);
    }
  }

  const calls: string[] = [];
  const adapter = new CleanupAdapter();
  adapter.track(() => calls.push("first"));
  adapter.track(() => calls.push("second"));

  await adapter.disconnect();
  await adapter.disconnect();

  assert.deepEqual(calls, ["second", "first"]);
});

test("normalizeTxResult preserves signed-only transaction results", () => {
  const result = normalizeTxResult({
    signed: true,
    raw: {
      txBlob: "ABC"
    }
  });

  assert.equal(result.signed, true);
  assert.equal(result.rejected, undefined);
});
