import assert from "node:assert/strict";
import test from "node:test";
import {
  BaseWalletAdapter,
  MemoryWalletStorage,
  WalletKitErrorCode,
  WalletManager,
  WALLET_STORAGE_VERSION,
  assertWalletAdapter,
  createNetworkRegistry,
  getExplorerAccountUrl,
  getExplorerTxUrl,
  getHttpRpcUrl,
  getNativeAsset,
  isMainnetNetwork,
  isWalletKitError,
  normalizeTxResult,
  validateWalletAdapter
} from "../packages/core/src/index";
import { WALLETCONNECT_ICON, XRPL_WALLETCONNECT_WALLETS, createWalletConnectAdapter } from "../packages/adapters/walletconnect/src/index";
import { normalizeWalletUiLocale, resolveWalletUiMessages } from "../packages/ui/src/index";

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

  async signMessage() {
    return { signatureKind: "signature" as const, signature: "mock-signature" };
  }

  async signAndSubmit() {
    return { hash: "mock-hash", status: "success" };
  }
}

test("WalletEventEmitter once unsubscribes after the first event", () => {
  const manager = new WalletManager({
    appName: "Test",
    adapters: [new MockAdapter()],
    logger: { level: "silent" }
  });
  let calls = 0;

  manager.once("connected", () => {
    calls += 1;
  });
  manager.emit("connected", { adapterId: "mock", account: { address: "rOnce" } });
  manager.emit("connected", { adapterId: "mock", account: { address: "rOnce" } });

  assert.equal(calls, 1);
});

test("WalletManager returns available wallet adapters", async () => {
  class AvailabilityAdapter extends BaseWalletAdapter {
    capabilities = { connect: true };

    constructor(readonly id: string, private available: boolean) {
      super();
    }

    get metadata() {
      return { id: this.id, name: this.id, type: "extension" } as const;
    }

    async isAvailable() {
      return this.available;
    }

    async connect() {
      return { account: { address: `r${this.id}` } };
    }
  }

  const manager = new WalletManager({
    appName: "Test",
    adapters: [new AvailabilityAdapter("available", true), new AvailabilityAdapter("missing", false)],
    logger: { level: "silent" }
  });

  const wallets = await manager.getAvailableWallets();

  assert.deepEqual(wallets.map((wallet) => wallet.metadata.id), ["available"]);
});

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
  const connectedAddresses: string[] = [];
  const restoredAddresses: string[] = [];

  manager.on("connected", (event) => connectedAddresses.push(event.account.address));
  manager.on("session_restored", (event) => restoredAddresses.push(event.account.address));

  const restored = await manager.autoReconnect();

  assert.equal(adapter.restoreCalls, 1);
  assert.equal(restored?.account.address, "rLegacyAddress");
  assert.equal(manager.getSession()?.wallet?.name, "Mock Wallet");
  assert.deepEqual(restoredAddresses, ["rLegacyAddress"]);
  assert.deepEqual(connectedAddresses, ["rLegacyAddress"]);
});

test("WalletManager emits connected for stale auto reconnect without adapter restoreSession", async () => {
  class StoredOnlyAdapter extends BaseWalletAdapter {
    metadata = { id: "stored-only", name: "Stored Only", type: "extension" } as const;
    capabilities = { connect: true };

    async isAvailable() {
      return true;
    }

    async connect() {
      return { account: { address: "rStoredOnly", network } };
    }
  }

  const storage = new MemoryWalletStorage();
  const session = {
    adapterId: "stored-only",
    account: { address: "rStoredOnly", network },
    connectedAt: 1
  };
  await storage.setItem("session", JSON.stringify({
    version: WALLET_STORAGE_VERSION,
    session,
    updatedAt: Date.now()
  }));

  const manager = new WalletManager({
    appName: "Test",
    adapters: [new StoredOnlyAdapter()],
    storage,
    autoReconnect: true,
    logger: { level: "silent" }
  });
  const connectedAddresses: string[] = [];
  const restoredEvents: Array<{ address: string; stale?: boolean }> = [];

  manager.on("connected", (event) => connectedAddresses.push(event.account.address));
  manager.on("session_restored", (event) => restoredEvents.push({ address: event.account.address, stale: event.stale }));

  const restored = await manager.autoReconnect();

  assert.equal(restored?.account.address, "rStoredOnly");
  assert.deepEqual(restoredEvents, [{ address: "rStoredOnly", stale: true }]);
  assert.deepEqual(connectedAddresses, ["rStoredOnly"]);
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

test("WalletManager switches wallets by disconnecting the active adapter first", async () => {
  class SwitchAdapter extends BaseWalletAdapter {
    capabilities = { connect: true, disconnect: true };
    disconnectCalls = 0;

    constructor(readonly id: string) {
      super();
    }

    get metadata() {
      return { id: this.id, name: this.id, type: "extension" } as const;
    }

    async connect(options: { network?: typeof network }) {
      const account = { address: `r${this.id}`, network: options.network ?? network };
      return {
        account,
        session: { adapterId: this.id, account, connectedAt: 1 }
      };
    }

    async disconnect() {
      this.disconnectCalls += 1;
    }
  }

  const first = new SwitchAdapter("first");
  const second = new SwitchAdapter("second");
  const manager = new WalletManager({
    appName: "Test",
    adapters: [first, second],
    logger: { level: "silent" }
  });

  await manager.connect("first", { network });
  const switched = await manager.connect("second", { network });

  assert.equal(first.disconnectCalls, 1);
  assert.equal(switched.adapterId, "second");
  assert.equal(manager.getSession()?.adapterId, "second");
});

test("WalletManager clears invalid stored sessions instead of restoring poisoned storage", async () => {
  const storage = new MemoryWalletStorage();
  await storage.setItem("session", JSON.stringify({
    version: WALLET_STORAGE_VERSION,
    session: {
      adapterId: "mock",
      account: { address: null },
      connectedAt: 1
    }
  }));
  const manager = new WalletManager({
    appName: "Test",
    adapters: [new MockAdapter()],
    storage,
    autoReconnect: true,
    logger: { level: "silent" }
  });

  const restored = await manager.autoReconnect();

  assert.equal(restored, null);
  assert.equal(await storage.getItem("session"), null);
});

test("WalletManager destroy removes listeners and cancels pending connection", () => {
  let calls = 0;
  class PendingAdapter extends BaseWalletAdapter {
    metadata = { id: "pending", name: "Pending", type: "extension" } as const;
    capabilities = { connect: true };
    cancelCalls = 0;

    async connect() {
      return { account: { address: "rPending" } };
    }

    cancelPendingConnection() {
      this.cancelCalls += 1;
    }
  }

  const manager = new WalletManager({
    appName: "Test",
    adapters: [new PendingAdapter()],
    logger: { level: "silent" }
  });
  manager.on("connected", () => {
    calls += 1;
  });

  manager.destroy();
  manager.emit("connected", { adapterId: "pending", account: { address: "rPending" } });

  assert.equal(calls, 0);
});

test("WalletManager forces adapter cleanup after disconnect timeout", async () => {
  class SlowDisconnectAdapter extends BaseWalletAdapter {
    metadata = { id: "slow", name: "Slow", type: "extension" } as const;
    capabilities = { connect: true, disconnect: true };
    cancelCalls = 0;

    async connect() {
      return {
        account: { address: "rSlow", network },
        session: {
          adapterId: this.metadata.id,
          account: { address: "rSlow", network },
          connectedAt: 1
        }
      };
    }

    async disconnect() {
      await new Promise(() => undefined);
    }

    cancelPendingConnection() {
      this.cancelCalls += 1;
    }
  }

  const adapter = new SlowDisconnectAdapter();
  const manager = new WalletManager({
    appName: "Test",
    adapters: [adapter],
    logger: { level: "silent" }
  });

  await manager.connect("slow", { network });
  await manager.disconnect();

  assert.equal(adapter.cancelCalls, 1);
  assert.equal(manager.getSession(), null);
});

test("WalletManager recovers pending return sessions once and stores them", async () => {
  class RecoverAdapter extends BaseWalletAdapter {
    metadata = { id: "recover", name: "Recover Wallet", type: "mobile" } as const;
    capabilities = { connect: true };
    canRecoverCalls = 0;
    recoverCalls = 0;

    async connect() {
      return { account: { address: "rRecover" } };
    }

    canRecoverSession() {
      this.canRecoverCalls += 1;
      return true;
    }

    async recoverSession(options: { network?: typeof network }) {
      this.recoverCalls += 1;
      const account = { address: "rRecovered", network: options.network ?? network };
      return {
        account,
        session: {
          adapterId: this.metadata.id,
          account,
          connectedAt: 2
        }
      };
    }
  }

  const storage = new MemoryWalletStorage();
  const adapter = new RecoverAdapter();
  const manager = new WalletManager({
    appName: "Test",
    adapters: [adapter],
    storage,
    autoReconnect: true,
    logger: { level: "silent" }
  });
  const connectedAddresses: string[] = [];
  const restoredAddresses: string[] = [];

  manager.on("connected", (event) => connectedAddresses.push(event.account.address));
  manager.on("session_restored", (event) => restoredAddresses.push(event.account.address));

  const [first, second] = await Promise.all([manager.autoReconnect(), manager.autoReconnect()]);
  const stored = JSON.parse(await storage.getItem("session") ?? "{}") as {
    session?: { adapterId?: string; account?: { address?: string } };
  };

  assert.equal(adapter.canRecoverCalls, 1);
  assert.equal(adapter.recoverCalls, 1);
  assert.equal(first?.account.address, "rRecovered");
  assert.equal(second?.account.address, "rRecovered");
  assert.equal(stored.session?.adapterId, "recover");
  assert.equal(stored.session?.account?.address, "rRecovered");
  assert.deepEqual(restoredAddresses, ["rRecovered"]);
  assert.deepEqual(connectedAddresses, ["rRecovered"]);
});

test("WalletConnect detail adapters can use marker-gated pending return recovery", () => {
  const adapter = createWalletConnectAdapter({
    projectId: "test-project",
    id: "joey",
    name: "Joey",
    useModal: false,
    modalMode: "never"
  });

  assert.equal((adapter as unknown as { shouldRecoverWithoutStoredSession(): boolean }).shouldRecoverWithoutStoredSession(), true);
});

test("WalletConnect built-in detail wallets preserve wallet-specific icons", () => {
  assert.ok(XRPL_WALLETCONNECT_WALLETS.length > 0);
  for (const wallet of XRPL_WALLETCONNECT_WALLETS) {
    assert.match(wallet.icon ?? "", /^data:image\//, `${wallet.id} should ship a wallet-specific data URL icon`);
    assert.notEqual(wallet.icon, WALLETCONNECT_ICON, `${wallet.id} should not fall back to the generic WalletConnect icon`);
  }
});

test("WalletConnect validates missing chain id only when WalletConnect paths need it", () => {
  const adapter = createWalletConnectAdapter({
    projectId: "test-project",
    useModal: false,
    modalMode: "never"
  });
  const customNetwork = {
    id: "custom",
    name: "Custom Network",
    networkType: "CUSTOM",
    rpcUrl: "wss://custom.example"
  };

  assert.throws(
    () => (adapter as unknown as { createRequiredNamespaces(network: typeof customNetwork): unknown }).createRequiredNamespaces(customNetwork),
    /walletConnectChainId/
  );
});

test("WalletManager authenticate signs a structured login message", async () => {
  const manager = new WalletManager({
    appName: "Test",
    adapters: [new MockAdapter()],
    logger: { level: "silent" }
  });

  await manager.connect("mock", { network });
  const result = await manager.authenticate({ statement: "Sign in to Test", expiresIn: 60 });

  assert.equal(result.address, "rMockAddress");
  assert.equal(result.statement, "Sign in to Test");
  assert.equal(result.signatureKind, "signature");
  assert.equal(result.proof, "mock-signature");
  assert.equal(result.signature, "mock-signature");
  assert.match(result.message, /Sign in to Test/);
  assert.match(result.message, /Address: rMockAddress/);
  assert.equal(typeof result.issuedAt, "string");
  assert.equal(typeof result.expiresAt, "string");
});

test("WalletManager infers legacy signMessage result kind with a warning", async () => {
  class LegacySignAdapter extends MockAdapter {
    async signMessage() {
      return { signature: "legacy-signature" } as unknown as Awaited<ReturnType<MockAdapter["signMessage"]>>;
    }
  }
  const warnings: string[] = [];
  const manager = new WalletManager({
    appName: "Test",
    adapters: [new LegacySignAdapter()],
    logger: {
      debug() {},
      info() {},
      warn(message) { warnings.push(message); },
      error() {}
    }
  });

  await manager.connect("mock", { network });
  const result = await manager.signMessage({ message: "hello" });

  assert.equal(result.signatureKind, "signature");
  assert.equal(result.proof, "legacy-signature");
  assert.equal(result.signature, "legacy-signature");
  assert.ok(warnings.some((message) => message.includes("without signatureKind")));
});

test("WalletManager rejects empty message signature proofs", async () => {
  class EmptySignatureAdapter extends MockAdapter {
    async signMessage() {
      return { signatureKind: "signature", signature: "" } as unknown as Awaited<ReturnType<MockAdapter["signMessage"]>>;
    }
  }
  const manager = new WalletManager({
    appName: "Test",
    adapters: [new EmptySignatureAdapter()],
    logger: { level: "silent" }
  });
  const rejected: WalletKitErrorCode[] = [];
  const signed: string[] = [];

  manager.on("rejected", (event) => rejected.push(event.error.code));
  manager.on("signed", () => signed.push("signed"));

  await manager.connect("mock", { network });
  await assert.rejects(
    () => manager.signMessage({ message: "hello" }),
    { code: WalletKitErrorCode.SIGN_REJECTED }
  );

  assert.deepEqual(rejected, [WalletKitErrorCode.SIGN_REJECTED]);
  assert.deepEqual(signed, []);
});

test("WalletManager rejects empty signed transaction proofs", async () => {
  class EmptySignedTxAdapter extends MockAdapter {
    async signMessage() {
      return { signatureKind: "signedTx", txBlob: "   " } as unknown as Awaited<ReturnType<MockAdapter["signMessage"]>>;
    }
  }
  const manager = new WalletManager({
    appName: "Test",
    adapters: [new EmptySignedTxAdapter()],
    logger: { level: "silent" }
  });

  await manager.connect("mock", { network });
  await assert.rejects(
    () => manager.signMessage({ message: "hello" }),
    { code: WalletKitErrorCode.SIGN_REJECTED }
  );
});

test("WalletManager emits transaction lifecycle events and stores submitted transactions", async () => {
  const manager = new WalletManager({
    appName: "Test",
    adapters: [new MockAdapter()],
    logger: { level: "silent" }
  });
  const submitted: string[] = [];
  const confirmed: string[] = [];
  const failed: string[] = [];

  manager.on("tx_submitted", (event) => submitted.push(event.hash));
  manager.on("tx_confirmed", (event) => confirmed.push(event.hash));
  manager.on("tx_failed", (event) => failed.push(event.hash ?? "missing"));

  await manager.connect("mock", { network });
  await manager.signAndSubmit({ txJson: { TransactionType: "Payment" } });
  manager.addTransaction({ hash: "manual-confirm", status: "confirmed", result: { engine_result: "tesSUCCESS" } });
  manager.addTransaction({ hash: "manual-fail", status: "failed", error: new Error("failed") });

  assert.deepEqual(submitted, ["mock-hash"]);
  assert.deepEqual(confirmed, ["manual-confirm"]);
  assert.deepEqual(failed, ["manual-fail"]);
  assert.deepEqual(manager.getTransactions().map((tx) => tx.hash), ["mock-hash", "manual-confirm", "manual-fail"]);
});

test("WalletManager confirms submitted transactions with best-effort polling", async () => {
  const originalFetch = globalThis.fetch;
  const confirmNetwork = { ...network, httpRpcUrl: "https://rpc.test" };
  globalThis.fetch = async () => ({
    json: async () => ({
      result: {
        validated: true,
        meta: {
          TransactionResult: "tesSUCCESS"
        }
      }
    })
  }) as Response;
  try {
    const manager = new WalletManager({
      appName: "Test",
      adapters: [new MockAdapter()],
      accountStatus: { enabled: false },
      transactionConfirmation: { attempts: 1, intervalMs: 0 },
      logger: { level: "silent" }
    });
    const confirmed = new Promise<string>((resolve) => {
      manager.on("tx_confirmed", (event) => resolve(event.hash));
    });

    await manager.connect("mock", { network: confirmNetwork });
    await manager.signAndSubmit({ txJson: { TransactionType: "Payment" } });

    assert.equal(await confirmed, "mock-hash");
    assert.equal(manager.getTransactions().find((tx) => tx.hash === "mock-hash")?.status, "confirmed");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("WalletManager keeps submitted transactions pending when confirmation is inconclusive", async () => {
  const originalFetch = globalThis.fetch;
  const confirmNetwork = { ...network, httpRpcUrl: "https://rpc.test" };
  globalThis.fetch = async () => ({
    json: async () => ({
      result: {
        error: "txnNotFound"
      }
    })
  }) as Response;
  try {
    const manager = new WalletManager({
      appName: "Test",
      adapters: [new MockAdapter()],
      accountStatus: { enabled: false },
      transactionConfirmation: { attempts: 1, intervalMs: 0 },
      logger: { level: "silent" }
    });
    const failed: string[] = [];
    manager.on("tx_failed", (event) => failed.push(event.hash ?? "missing"));

    await manager.connect("mock", { network: confirmNetwork });
    await manager.signAndSubmit({ txJson: { TransactionType: "Payment" } });
    await new Promise((resolve) => setTimeout(resolve, 10));

    assert.deepEqual(failed, []);
    assert.equal(manager.getTransactions().find((tx) => tx.hash === "mock-hash")?.status, "submitted");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("WalletManager keeps the active session in sync with account and network changes", async () => {
  const storage = new MemoryWalletStorage();
  const manager = new WalletManager({
    appName: "Test",
    adapters: [new MockAdapter()],
    storage,
    logger: { level: "silent" }
  });
  const nextNetwork = { ...network, id: "testnet", name: "XRPL Testnet", networkType: "TESTNET" } as const;

  await manager.connect("mock", { network });
  manager.emitAccountChanged("mock", { address: "rNextAddress" });
  manager.emitNetworkChanged("mock", nextNetwork);

  assert.equal(manager.getSession()?.account.address, "rNextAddress");
  assert.equal(manager.getSession()?.account.network?.id, "testnet");
});

test("WalletManager signs transactions without submitting when adapter supports signTransaction", async () => {
  class SignOnlyAdapter extends MockAdapter {
    capabilities = { connect: true, signTransaction: true };

    async signTransaction() {
      return { txBlob: "SIGNED_BLOB", signed: true };
    }
  }

  const manager = new WalletManager({
    appName: "Test",
    adapters: [new SignOnlyAdapter()],
    logger: { level: "silent" }
  });

  await manager.connect("mock", { network });
  const result = await manager.signTransaction({ txJson: { TransactionType: "Payment" } });

  assert.equal(result.txBlob, "SIGNED_BLOB");
  assert.equal(result.signed, true);
});

test("WalletManager falls back to signAndSubmit with submit false for signTransaction", async () => {
  class FallbackSignAdapter extends MockAdapter {
    lastSubmitValue: boolean | undefined;

    async signAndSubmit(request: { submit?: boolean }) {
      this.lastSubmitValue = request.submit;
      return { txBlob: "FALLBACK_BLOB", signed: true, raw: { txBlob: "FALLBACK_BLOB" } };
    }
  }

  const adapter = new FallbackSignAdapter();
  const manager = new WalletManager({
    appName: "Test",
    adapters: [adapter],
    logger: { level: "silent" }
  });

  await manager.connect("mock", { network });
  const result = await manager.signTransaction({ txJson: { TransactionType: "Payment" } });

  assert.equal(adapter.lastSubmitValue, false);
  assert.equal(result.txBlob, "FALLBACK_BLOB");
  assert.equal(result.signed, true);
});

test("WalletManager populates activationStatus from account_info", async () => {
  const statusNetwork = {
    ...network,
    httpRpcUrl: "https://rpc.test"
  };
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({
    result: {
      account_data: {
        Account: "rMockAddress"
      }
    }
  }), { status: 200 });

  try {
    const manager = new WalletManager({
      appName: "Test",
      adapters: [new MockAdapter()],
      logger: { level: "silent" }
    });

    const session = await manager.connect("mock", { network: statusNetwork });

    assert.equal(session.account.activationStatus, "active");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("WalletManager marks actNotFound accounts as unfunded", async () => {
  const statusNetwork = {
    ...network,
    httpRpcUrl: "https://rpc.test"
  };
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({
    result: {
      error: "actNotFound"
    }
  }), { status: 200 });

  try {
    const manager = new WalletManager({
      appName: "Test",
      adapters: [new MockAdapter()],
      logger: { level: "silent" }
    });

    const session = await manager.connect("mock", { network: statusNetwork });

    assert.equal(session.account.activationStatus, "unfunded");
  } finally {
    globalThis.fetch = originalFetch;
  }
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
    explorerAccountUrl: "https://explorer.xahau.network/accounts/{address}",
    explorerTxUrl: "https://explorer.xahau.network/tx/{hash}"
  } as const;
  const registry = createNetworkRegistry([network, xahau]);

  assert.equal(registry.resolve("xahau-mainnet").name, "Xahau Mainnet");
  assert.equal(getNativeAsset(xahau), "XAH");
  assert.equal(getHttpRpcUrl(xahau), "https://xahau.network");
  assert.equal(getExplorerAccountUrl(xahau, "rTest"), "https://explorer.xahau.network/accounts/rTest");
  assert.equal(getExplorerTxUrl(xahau, "ABC/123"), "https://explorer.xahau.network/tx/ABC%2F123");
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

test("validateWalletAdapter enforces the adapter contract", () => {
  const valid = validateWalletAdapter(new MockAdapter());

  assert.equal(valid.valid, true);

  const invalid = validateWalletAdapter({
    metadata: { id: "Bad Adapter", name: "", type: "extension" },
    capabilities: { connect: false, signMessage: true },
    connect: undefined as never,
    recoverSession: async () => null
  });

  assert.equal(invalid.valid, false);
  assert.ok(invalid.issues.some((issue) => issue.field === "metadata.id"));
  assert.ok(invalid.issues.some((issue) => issue.field === "capabilities.connect"));
  assert.ok(invalid.issues.some((issue) => issue.field === "signMessage"));
  assert.ok(invalid.issues.some((issue) => issue.field === "canRecoverSession"));
});

test("assertWalletAdapter throws a typed invalid adapter error", () => {
  assert.throws(
    () => assertWalletAdapter({
      metadata: { id: "invalid", name: "Invalid", type: "extension" },
      capabilities: { connect: true, signAndSubmit: true },
      connect: async () => ({ account: { address: "rInvalid" } })
    }),
    (error) => isWalletKitError(error) && error.code === WalletKitErrorCode.INVALID_ADAPTER
  );
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

test("normalizeTxResult extracts wallet-specific transaction hash shapes", () => {
  assert.equal(normalizeTxResult({ type: "response", result: { hash: "gem-hash" } }).hash, "gem-hash");
  assert.equal(normalizeTxResult({ result: { txHash: "camel-hash" } }).hash, "camel-hash");
  assert.equal(normalizeTxResult({ response: { data: { transaction_hash: "snake-hash" } } }).hash, "snake-hash");
});

test("Wallet UI messages resolve locale defaults and caller overrides", () => {
  const messages = resolveWalletUiMessages("vi-VN", {
    connectWallet: "Custom connect",
    walletCount: (count) => `${count} custom wallets`
  });

  assert.equal(messages.connectWallet, "Custom connect");
  assert.equal(messages.disconnect, "Ngắt kết nối");
  assert.equal(messages.walletCount(3), "3 custom wallets");
  assert.equal(normalizeWalletUiLocale("vi"), "vi-VN");
  assert.equal(resolveWalletUiMessages("vi").disconnect, "Ngắt kết nối");
  assert.equal(resolveWalletUiMessages("en-US").connectWallet, "Connect Wallet");
});
