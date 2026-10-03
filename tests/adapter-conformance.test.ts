import assert from "node:assert/strict";
import test from "node:test";
import { encode } from "xrpl";
import { runAdapterConformance, assertAdapterConformance, type AdapterConformanceCase, type AdapterConformanceFixture } from "../packages/core/src/testing";
import { MemoryWalletStorage, WalletKitErrorCode, WalletManager, XRPL_MAINNET, XRPL_TESTNET } from "../packages/core/src/index";
import { GemWalletAdapter } from "../packages/adapters/gemwallet/src/index";
import { CrossmarkAdapter } from "../packages/adapters/crossmark/src/index";
import { DropFiAdapter } from "../packages/adapters/dropfi/src/index";
import { OtsuAdapter, type OtsuProvider } from "../packages/adapters/otsu/src/index";
import { LedgerAdapter } from "../packages/adapters/ledger/src/index";
import { XamanAdapter, type XamanSdkLike } from "../packages/adapters/xaman/src/index";
import { XrplSnapAdapter } from "../packages/adapters/xrpl-snap/src/index";
import { WalletConnectXrplAdapter, XRPLWalletConnectMethod } from "../packages/adapters/walletconnect/src/index";

const address = "rrrrrrrrrrrrrrrrrrrrBZbvji";
const hash = "A".repeat(64);
const payment = { TransactionType: "Payment", Account: address, Destination: address, Amount: "1", Fee: "12", Sequence: 1 };
const blob = encode(payment);
const ids = ["gemwallet", "crossmark", "dropfi", "otsu", "ledger", "xaman", "xrplsnap", "walletconnect"] as const;

function createFixture(id: typeof ids[number], scenario: AdapterConformanceCase): AdapterConformanceFixture {
  const outcome = async <T>(value: T): Promise<T> => {
    if (scenario === "rejection") throw new Error("User rejected the request");
    if (scenario === "timeout") throw new Error("Provider request timed out");
    return value;
  };
  const listeners = new Map<string, Set<(...args: any[]) => void>>();
  const on = (event: string, handler: (...args: any[]) => void) => {
    if (!listeners.has(event)) listeners.set(event, new Set());
    listeners.get(event)!.add(handler);
  };
  const off = (event: string, handler: (...args: any[]) => void) => { listeners.get(event)?.delete(handler); };
  let adapter;
  if (id === "gemwallet") adapter = new GemWalletAdapter({ provider: {
    isInstalled: async () => true, getAddress: () => outcome({ result: { address } }),
    signMessage: async () => ({ result: { signedMessage: "signature" } }), signAndSubmit: async () => ({ hash })
  } });
  else if (id === "crossmark") adapter = new CrossmarkAdapter({ provider: {
    sync: { isInstalled: () => true, getAddress: () => address },
    methods: { signInAndWait: () => outcome({ response: { data: { address, signature: "signature" } } }),
      signAndSubmitAndWait: async () => ({ hash }) }
  } });
  else if (id === "dropfi") adapter = new DropFiAdapter({ provider: {
    isDropFi: true, selectedAddress: scenario === "rejection" || scenario === "timeout" ? undefined : address,
    connect: () => outcome(address), isConnected: () => false,
    getAddress: () => scenario === "rejection" || scenario === "timeout" ? null : address, disconnect: async () => undefined, on, off,
    signMessage: async () => ({ signature: "signature", publicKey: "EDPUBLICKEY" }), sendTransaction: async () => hash
  } });
  else if (id === "otsu") adapter = new OtsuAdapter({ provider: {
    isOtsu: true, isConnected: () => true, connect: () => outcome({ address }),
    getAddress: async () => ({ address }), getNetwork: async () => ({ network: "mainnet" }),
    disconnect: async () => undefined, on, off,
    signMessage: async () => ({ signature: "signature" }), signTransaction: async () => ({ tx_blob: blob, hash }),
    signAndSubmit: async () => ({ tx_blob: blob, hash })
  } satisfies OtsuProvider });
  else if (id === "ledger") adapter = new LedgerAdapter({ connectLedger: () => outcome({ address,
    signTransaction: async (_tx, submit) => ({ txBlob: blob, hash: submit ? hash : undefined, signed: true })
  }) });
  else if (id === "xaman") {
    const sdk: XamanSdkLike = { state: { account: address, signedIn: true },
      payload: { createAndSubscribe: async () => ({ created: { uuid: "test" }, resolved: Promise.resolve({ signed: true }) }),
        get: async () => ({ meta: { signed: true }, response: { hex: blob, txid: hash } }) }, logout: async () => undefined };
    adapter = new XamanAdapter({ sdk, auth: { authorize: () => outcome({ me: { sub: address }, sdk }) }, recoveryStorage: new MemoryWalletStorage() });
  } else if (id === "xrplsnap") adapter = new XrplSnapAdapter({ ethereum: { request: async request => {
    if (request.method === "wallet_requestSnaps") return outcome({});
    if (request.method === "wallet_getSnaps") return { "npm:xrpl-snap": {} };
    const method = (request.params as any)?.request?.method;
    if (method === "xrpl_getActiveNetwork") return { chainId: 0 };
    if (method === "xrpl_getAccount") return { account: address };
    if (method === "xrpl_signMessage") return { signature: "signature" };
    return { tx_blob: blob, hash, engine_result: "tesSUCCESS" };
  } }, snapRequestRetryDelaysMs: [] });
  else {
    const session = { topic: "test-topic", expiry: Math.floor(Date.now() / 1000) + 3600,
      namespaces: { xrpl: { accounts: [`xrpl:0:${address}`], methods: Object.values(XRPLWalletConnectMethod), events: [] } } };
    let approved = false;
    const client = { connect: async () => ({ uri: "wc:test", approval: async () => { const result = await outcome(session); approved = true; return result; } }),
      session: { getAll: () => approved ? [session] : [], get: () => session },
      request: async ({ request }) => request.method === XRPLWalletConnectMethod.SIGN_MESSAGE
        ? { signature: "signature" } : { tx_blob: blob, hash, engine_result: "tesSUCCESS" },
      disconnect: async () => { approved = false; }, on, off };
    adapter = new WalletConnectXrplAdapter({ projectId: "mock-conformance", signClient: client as any, useModal: false, recoveryStorage: new MemoryWalletStorage() });
  }
  return { adapter, expectedAddress: address, connectOptions: { network: XRPL_MAINNET }, transaction: { txJson: payment },
    message: { message: "Conformance only", account: { address } }, restoreExpected: id === "ledger" ? "unavailable" : "connected",
    remainingResources: () => [...listeners.values()].reduce((total, set) => total + set.size, 0),
    exerciseEvents: async () => {
      // Ledger's injected transport needs browser availability for manager admission.
      const hid = Object.getOwnPropertyDescriptor(navigator, "hid");
      if (id === "ledger") Object.defineProperty(navigator, "hid", { configurable: true, value: {} });
      const manager = new WalletManager({ adapters: [adapter], accountStatus: { enabled: false }, storage: new MemoryWalletStorage(), logger: { level: "silent" } });
      const observed: string[] = [];
      const offAccount = manager.on("accountChanged", event => observed.push(event.account.address));
      const offNetwork = manager.on("networkChanged", event => observed.push(String(event.network?.id)));
      try {
        await manager.connect(adapter.metadata.id, { network: XRPL_MAINNET });
        manager.emitAccountChanged(adapter.metadata.id, { address: "rNextAccount", network: XRPL_MAINNET });
        manager.emitNetworkChanged(adapter.metadata.id, XRPL_TESTNET);
        assert.equal(manager.getAccount()?.address, "rNextAccount");
        assert.equal(manager.getAccount()?.network?.id, "testnet");
        assert.deepEqual(observed, ["rNextAccount", "testnet"]);
        offAccount(); offNetwork();
        manager.emitAccountChanged(adapter.metadata.id, { address });
        assert.equal(observed.length, 2, "unsubscribed listeners must not receive updates");
      } finally {
        offAccount(); offNetwork();
        try { await manager.disconnect(); } finally {
          manager.destroy();
          if (id === "ledger") { if (hid) Object.defineProperty(navigator, "hid", hid); else Reflect.deleteProperty(navigator, "hid"); }
        }
      }
    },
    dispose: () => { listeners.clear(); } };
}

for (const id of ids) test(`${id}: applicable adapter conformance scenarios`, async t => {
  const report = await runAdapterConformance({ createFixture: scenario => createFixture(id, scenario) });
  for (const result of report.results) if (result.status === "skipped") t.diagnostic(`${result.scenario}: ${result.message}`);
  assertAdapterConformance(report);
  for (const scenario of ["connect", "disconnect", "restore", "rejection", "timeout", "cleanup", "events"]) {
    assert.equal(report.results.find(result => result.scenario === scenario)?.status, "passed", scenario);
  }
});

test("conformance catches malformed results and always disposes every fixture", async () => {
  let disposals = 0;
  const report = await runAdapterConformance({ createFixture: scenario => {
    const fixture = createFixture("gemwallet", scenario);
    fixture.adapter.connect = async () => ({ account: { address: "rWrong" } });
    fixture.dispose = () => { disposals++; };
    return fixture;
  } });
  assert.equal(disposals, report.results.length);
  assert.equal(report.passed, false);
  assert.throws(() => assertAdapterConformance(report), /connect:.*account.address/);
});

test("conformance watchdog does not misclassify a hanging operation as a provider timeout", async () => {
  const report = await runAdapterConformance({ caseTimeoutMs: 10, createFixture: scenario => {
    const fixture = createFixture("gemwallet", scenario);
    if (scenario === "timeout") fixture.adapter.connect = () => new Promise(() => undefined);
    return fixture;
  } });
  const result = report.results.find(result => result.scenario === "timeout");
  assert.equal(result?.status, "failed");
  assert.match(result?.message ?? "", /watchdog/);
});

test("resource counters detect leaking listeners and event probes are executed", async () => {
  let events = 0;
  const report = await runAdapterConformance({ createFixture: scenario => {
    const fixture = createFixture("gemwallet", scenario);
    fixture.remainingResources = () => 1;
    fixture.exerciseEvents = () => { events++; assert.equal(fixture.adapter.metadata.id, "gemwallet"); };
    return fixture;
  } });
  assert.equal(events, 1);
  assert.equal(report.results.find(result => result.scenario === "cleanup")?.status, "failed");
});

test("published testing entrypoint is importable without a test framework dependency", async () => {
  const published = await import("@xrpl-wallet-kit/core/testing");
  assert.equal(typeof published.runAdapterConformance, "function");
  assert.equal(typeof published.assertAdapterConformance, "function");
});

test("sign-only conformance rejects a hash-only result", async () => {
  const report = await runAdapterConformance({ createFixture: scenario => {
    const fixture = createFixture("ledger", scenario);
    if (scenario === "sign-only") fixture.adapter.signTransaction = async () => ({ raw: { hash } });
    return fixture;
  } });
  assert.equal(report.results.find(result => result.scenario === "sign-only")?.status, "failed");
});

test("fixture disposal still runs when adapter disconnect throws", async () => {
  let disposed = 0;
  const report = await runAdapterConformance({ createFixture: scenario => {
    const fixture = createFixture("gemwallet", scenario);
    fixture.adapter.disconnect = async () => { throw new Error("cleanup rejected"); };
    fixture.dispose = () => { disposed++; };
    return fixture;
  } });
  assert.equal(disposed, report.results.length);
  assert.ok(report.results.every(result => result.status === "failed"));
});

test("missing optional probes are reported as incomplete coverage, not passes", async () => {
  const report = await runAdapterConformance({ createFixture: scenario => {
    const fixture = createFixture("gemwallet", scenario);
    delete fixture.exerciseEvents;
    delete fixture.remainingResources;
    return fixture;
  } });
  assert.equal(report.passed, true);
  for (const scenario of ["cleanup", "events"]) {
    const result = report.results.find(result => result.scenario === scenario);
    assert.equal(result?.status, "skipped");
    assert.match(result?.message ?? "", /incomplete/);
  }
});

test("manager preserves provider timeout classification at the connection boundary", async () => {
  const fixture = createFixture("gemwallet", "timeout");
  const manager = new WalletManager({ adapters: [fixture.adapter], accountStatus: { enabled: false }, logger: { level: "silent" } });
  try {
    await assert.rejects(manager.connect(fixture.adapter.metadata.id, fixture.connectOptions), { code: WalletKitErrorCode.REQUEST_TIMEOUT });
  } finally { await manager.disconnect(); manager.destroy(); await fixture.dispose?.(); }
});
