import assert from "node:assert/strict";
import test from "node:test";
import { WalletManager, WalletKitErrorCode, type WalletAdapter, type WalletSession } from "../packages/core/src/index";
import { createWalletAuth } from "../packages/auth/src/index";
import { createDropFiAdapter } from "../packages/adapters/dropfi/src/index";
import { createCrossmarkAdapter } from "../packages/adapters/crossmark/src/index";
import { createGemWalletAdapter } from "../packages/adapters/gemwallet/src/index";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

function mockAdapter(id = "mock"): WalletAdapter {
  return {
    metadata: { id, name: id, type: "extension" },
    capabilities: { connect: true },
    async connect(options) { return { account: { address: "rAlice", network: options.network } }; },
    async disconnect() {}
  };
}

test("sign-only never invokes submit-only extension providers", async () => {
  let submissions = 0;
  const submit = async () => { submissions += 1; return { hash: "unexpected" }; };
  const adapters = [
    createDropFiAdapter({ provider: { isDropFi: true, selectedAddress: "rAlice", sendTransaction: async () => { await submit(); return "unexpected"; } } }),
    createCrossmarkAdapter({ provider: { sync: { isInstalled: () => true }, methods: {
      signInAndWait: async () => ({ response: { data: { address: "rAlice" } } }),
      signAndSubmitAndWait: submit
    } } }),
    createGemWalletAdapter({ provider: { isInstalled: async () => true, getAddress: async () => ({ result: { address: "rAlice" } }), sendPayment: submit } })
  ];
  for (const adapter of adapters) {
    const manager = new WalletManager({ adapters: [adapter], accountStatus: { enabled: false } });
    await manager.connect(adapter.metadata.id);
    await assert.rejects(manager.signTransaction({ txJson: { TransactionType: "Payment", Amount: "1000000", Destination: "rBob" } }), { code: WalletKitErrorCode.UNSUPPORTED_METHOD });
    await assert.rejects(manager.signAndSubmit({ txJson: { TransactionType: "Payment" }, submit: false }), { code: WalletKitErrorCode.UNSUPPORTED_METHOD });
    await manager.disconnect();
  }
  assert.equal(submissions, 0);
});

for (const action of ["signOut", "destroy", "changeSession"] as const) {
  test(`pending auth verification cannot authenticate after ${action}`, async () => {
    const verification = deferred<boolean>();
    const started = deferred<void>();
    let session: WalletSession | null = { adapterId: "mock", account: { address: "rAlice" }, connectedAt: 1 };
    const manager = {
      getSession: () => session,
      getAccount: () => session?.account ?? null,
      getCapabilities: () => ({ connect: true, signMessage: true }),
      signMessage: async () => ({ signatureKind: "signature" as const, proof: "sig", signature: "sig" })
    };
    const auth = createWalletAuth(manager, {
      getNonce: async () => "nonce",
      createMessage: () => "message",
      verify: () => { started.resolve(); return verification.promise; }
    });
    const states: string[] = [];
    auth.on("change", (state) => states.push(state.status));
    const pending = auth.signIn();
    const rejection = action === "signOut"
      ? assert.rejects(pending, { code: WalletKitErrorCode.SIGN_REJECTED })
      : assert.rejects(pending, /destroyed|session changed/);
    await started.promise;
    if (action === "changeSession") session = null;
    else if (action === "signOut") await auth.signOut();
    else auth.destroy();
    verification.resolve(true);
    await rejection;
    assert(!states.includes("authenticated"));
    if (action === "signOut") assert.equal(auth.getState().status, "unauthenticated");
  });
}

test("session change during signing prevents server verification", async () => {
  const signed = deferred<{ signatureKind: "signature"; proof: string; signature: string }>();
  const started = deferred<void>();
  let session: WalletSession | null = { adapterId: "mock", account: { address: "rAlice" }, connectedAt: 1 };
  let verifies = 0;
  const auth = createWalletAuth({
    getSession: () => session, getAccount: () => session?.account ?? null,
    getCapabilities: () => ({ connect: true, signMessage: true }),
    signMessage: () => { started.resolve(); return signed.promise; }
  }, {
    getNonce: async () => "nonce", createMessage: () => "message",
    verify: async () => { verifies += 1; return true; }
  });
  const pending = auth.signIn();
  const rejection = assert.rejects(pending, /session changed/);
  await started.promise;
  session = null;
  signed.resolve({ signatureKind: "signature", proof: "sig", signature: "sig" });
  await rejection;
  assert.equal(verifies, 0);
});

test("disconnect cancels connection during account lookup with an external signal", async () => {
  const originalFetch = globalThis.fetch;
  const response = deferred<Response>();
  const started = deferred<void>();
  globalThis.fetch = async () => { started.resolve(); return response.promise; };
  const manager = new WalletManager({ adapters: [mockAdapter()] });
  let connected = 0;
  manager.on("connected", () => { connected += 1; });
  try {
    const pending = manager.connect("mock", { signal: new AbortController().signal });
    const rejection = assert.rejects(pending, /cancelled/);
    await started.promise;
    await manager.disconnect();
    response.resolve(new Response(JSON.stringify({ result: { account_data: {} } })));
    await rejection;
    assert.equal(manager.getSession(), null);
    assert.equal(await manager.storage.getItem("session"), null);
    assert.equal(connected, 0);
  } finally {
    globalThis.fetch = originalFetch;
    manager.destroy();
  }
});

test("a superseded same-wallet connection cannot clear or replace the new request", async () => {
  const first = deferred<{ account: { address: string } }>();
  const second = deferred<{ account: { address: string } }>();
  const started = [deferred<void>(), deferred<void>()];
  let calls = 0;
  const adapter = mockAdapter();
  adapter.connect = async () => {
    const index = calls++;
    started[index].resolve();
    return index === 0 ? first.promise : second.promise;
  };
  const manager = new WalletManager({ adapters: [adapter], accountStatus: { enabled: false } });
  const oldRequest = manager.connect("mock");
  const rejection = assert.rejects(oldRequest, /cancelled/);
  await started[0].promise;
  const newRequest = manager.connect("mock");
  await started[1].promise;
  first.resolve({ account: { address: "rOld" } });
  await rejection;
  second.resolve({ account: { address: "rNew" } });
  assert.equal((await newRequest).account.address, "rNew");
  assert.equal(manager.getAccount()?.address, "rNew");
  manager.destroy();
});

test("late confirmation cannot restore transactions after disconnect", async () => {
  const originalFetch = globalThis.fetch;
  const response = deferred<Response>();
  const started = deferred<void>();
  const finished = deferred<void>();
  let signal: AbortSignal | null | undefined;
  globalThis.fetch = async (_url, options) => {
    signal = options?.signal;
    started.resolve();
    const result = await response.promise;
    return { json: async () => { const body = await result.json(); finished.resolve(); return body; } } as Response;
  };
  const manager = new WalletManager({ adapters: [mockAdapter()], accountStatus: { enabled: false }, transactionConfirmation: { attempts: 1 } });
  let confirmed = 0;
  manager.on("tx_confirmed", () => { confirmed += 1; });
  try {
    await manager.connect("mock");
    manager.addTransaction({ hash: "pending" });
    await started.promise;
    await manager.disconnect();
    assert.equal(signal?.aborted, true);
    response.resolve(new Response(JSON.stringify({ result: { validated: true, meta: { TransactionResult: "tesSUCCESS" } } })));
    await finished.promise;
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.deepEqual(manager.getTransactions(), []);
    assert.equal(confirmed, 0);
  } finally {
    globalThis.fetch = originalFetch;
    manager.destroy();
  }
});
