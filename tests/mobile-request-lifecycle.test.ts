import assert from "node:assert/strict";
import test from "node:test";
import { XamanAdapter, type XamanPayloadSubscription } from "../packages/adapters/xaman/src/index";
import { createWalletConnectAdapter, XRPLWalletConnectMethod } from "../packages/adapters/walletconnect/src/index";
import { WalletKitErrorCode, type WalletRequestProgress } from "../packages/core/src/index";

const network = { id: "mainnet", name: "Mainnet", networkType: "MAINNET", rpcUrl: "wss://example.invalid", walletConnectChainId: "xrpl:0" } as const;
const account = { address: "rLifecycle", network };
const txJson = { TransactionType: "Payment", Account: account.address };
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(res => { resolve = res; });
  return { promise, resolve };
}
const tick = () => new Promise<void>(resolve => setImmediate(resolve));

test("Xaman closes a subscription created after cancellation and does not emit a late QR", async () => {
  const created = deferred<XamanPayloadSubscription>();
  let closed = 0; let resolved = 0; let fetched = 0; let qr = 0;
  const adapter = new XamanAdapter({ onQr: () => qr++, sdk: {
    state: { account: account.address, signedIn: true },
    payload: { createAndSubscribe: () => created.promise, get: async () => { fetched++; return null; } }
  } });
  const controller = new AbortController();
  const pending = adapter.signMessage({ message: "hello", account, signal: controller.signal });
  const rejection = assert.rejects(pending, error => {
    assert.equal((error as { details?: { outcomeUnknown?: boolean } }).details?.outcomeUnknown, true);
    return (error as { code: string }).code === WalletKitErrorCode.REQUEST_CANCELLED;
  });
  controller.abort(); await rejection;
  created.resolve({ created: { uuid: "late" }, resolve: () => resolved++, websocket: { close: () => closed++ }, resolved: Promise.resolve({ signed: true }) });
  await tick();
  assert.equal(closed, 1); assert.equal(resolved, 1); assert.equal(fetched, 0); assert.equal(qr, 0);
  const restored = await adapter.restoreSession({ adapterId: "xaman", account, connectedAt: Date.now() });
  assert.equal(restored?.account.address, account.address);
  assert.equal(fetched, 0, "passive deeplink return restores account, not a signing request");
});

test("Xaman timeout cleans subscription and suppresses late provider progress", async () => {
  const done = deferred<unknown>();
  let callback!: (event: unknown) => unknown;
  let closed = 0; let fetched = 0;
  const progress: WalletRequestProgress[] = [];
  const adapter = new XamanAdapter({ sdk: { payload: {
    createAndSubscribe: async (_payload, handler) => {
      callback = handler!;
      return { created: { uuid: "uuid" }, resolved: done.promise, resolve: done.resolve, websocket: { close: () => closed++ } };
    },
    get: async () => { fetched++; return null; }
  } } });
  await assert.rejects(adapter.signMessage({ message: "hello", account, timeoutMs: 10, onRequestProgress: event => progress.push(event) }), { code: WalletKitErrorCode.REQUEST_TIMEOUT });
  assert.equal(closed, 1);
  assert.deepEqual(progress, [{ state: "opened", providerRequestId: "uuid" }]);
  callback({ data: { signed: true, payload_uuidv4: "uuid" } }); await tick();
  assert.equal(progress.length, 1); assert.equal(fetched, 0);
});

test("Xaman normalizes opened/signed/expired provider progress and expiry errors", async () => {
  const progress: WalletRequestProgress[] = [];
  const adapter = new XamanAdapter({ sdk: { payload: {
    createAndSubscribe: async (_payload, handler) => {
      handler?.({ data: { opened: true, payload_uuidv4: "uuid" } });
      handler?.({ data: { signed: true, payload_uuidv4: "uuid" } });
      handler?.({ data: { expired: true, payload_uuidv4: "uuid" } });
      return { created: { uuid: "uuid" }, resolved: Promise.resolve({ expired: true }) };
    }, get: async () => ({ meta: { expired: true } })
  } } });
  await assert.rejects(adapter.signMessage({ message: "hello", account, onRequestProgress: event => progress.push(event) }), { code: WalletKitErrorCode.REQUEST_EXPIRED });
  assert.ok(progress.some(event => event.state === "signed"));
  assert.ok(progress.some(event => event.state === "expired" && event.providerRequestId === "uuid"));
});

test("Xaman reconciles an existing payload when subscription events are lost", async () => {
  const done = deferred<unknown>();
  let created = 0; let fetched = 0; let closed = 0;
  const adapter = new XamanAdapter({ sdk: { payload: {
    createAndSubscribe: async () => {
      created++;
      return { created: { uuid: "missed-event" }, resolved: done.promise, resolve: done.resolve, websocket: { close: () => closed++ } };
    },
    get: async uuid => {
      assert.equal(uuid, "missed-event"); fetched++;
      return { meta: { signed: true, resolved: true }, response: { hex: "proof" } };
    }
  } } });
  const result = await adapter.signMessage({ message: "hello", account, timeoutMs: 3500 });
  assert.equal(result.txBlob, "proof");
  assert.equal(created, 1, "recovery must never create another payload");
  assert.equal(fetched, 1); assert.equal(closed, 1);
});

test("Xaman timeout preserves the existing payload UUID and uncertain outcome", async () => {
  const done = deferred<unknown>();
  const adapter = new XamanAdapter({ sdk: { payload: {
    createAndSubscribe: async () => ({ created: { uuid: "uncertain-payload" }, resolved: done.promise, resolve: done.resolve }),
    get: async () => null
  } } });
  await assert.rejects(adapter.signMessage({ message: "hello", account, timeoutMs: 10 }), error => {
    const details = (error as { details?: { providerRequestId?: string; outcomeUnknown?: boolean } }).details;
    assert.equal(details?.providerRequestId, "uncertain-payload");
    assert.equal(details?.outcomeUnknown, true);
    return (error as { code: string }).code === WalletKitErrorCode.REQUEST_TIMEOUT;
  });
});

function walletConnectFixture() {
  const response = deferred<unknown>(); const dispatched = deferred<void>();
  const session = { topic: "topic", expiry: Math.floor(Date.now() / 1000) + 3600,
    namespaces: { xrpl: { methods: [XRPLWalletConnectMethod.SIGN_TRANSACTION], accounts: [`xrpl:0:${account.address}`] } } };
  const requests: unknown[] = [];
  const client = { session: { get: () => session, getAll: () => [session] }, on: () => {}, off: () => {},
    request: async (request: unknown) => { requests.push(request); dispatched.resolve(); return response.promise; } };
  const adapter = createWalletConnectAdapter({ projectId: "test-project", signClient: client as never });
  const stored = { adapterId: adapter.metadata.id, account, connectedAt: Date.now(), metadata: { topic: session.topic } };
  return { adapter, client, stored, response, dispatched, requests };
}

test("WalletConnect cancellation leaves session intact and reload never replays signing RPC", async () => {
  const fixture = walletConnectFixture();
  await fixture.adapter.restoreSession(fixture.stored);
  const controller = new AbortController();
  const pending = fixture.adapter.signAndSubmit({ txJson, signal: controller.signal, requestId: "local-only" });
  const rejection = assert.rejects(pending, { code: WalletKitErrorCode.REQUEST_CANCELLED });
  await fixture.dispatched.promise; controller.abort(); await rejection;
  fixture.response.resolve({ hash: "LATE" }); await tick();
  const restored = createWalletConnectAdapter({ projectId: "test-project", signClient: fixture.client as never });
  assert.equal((await restored.restoreSession(fixture.stored))?.account.address, account.address);
  assert.equal(fixture.requests.length, 1);
  const rpc = fixture.requests[0] as { request: { params: Record<string, unknown> } };
  assert.equal("signal" in rpc.request.params, false);
  assert.equal("requestId" in rpc.request.params, false);
});

test("WalletConnect pre-abort and explicit timeout do not restart provider requests", async () => {
  const fixture = walletConnectFixture();
  await fixture.adapter.restoreSession(fixture.stored);
  const controller = new AbortController(); controller.abort();
  await assert.rejects(fixture.adapter.signAndSubmit({ txJson, signal: controller.signal }), { code: WalletKitErrorCode.REQUEST_CANCELLED });
  assert.equal(fixture.requests.length, 0);
  await assert.rejects(fixture.adapter.signAndSubmit({ txJson, timeoutMs: 10 }), { code: WalletKitErrorCode.REQUEST_TIMEOUT });
  assert.equal(fixture.requests.length, 1);
  fixture.response.resolve({ hash: "LATE" }); await tick();
});
