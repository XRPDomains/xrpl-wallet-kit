import assert from "node:assert/strict";
import test from "node:test";
import { Wallet } from "xrpl";
import { createXahauProtocol, XAHAU_TESTNET } from "../packages/xahau/src/index";
import { WalletManager, MemoryWalletStorage, verifyAndSubmitProtocolTransaction } from "../packages/core/src/index";
import { createXahauProtocolLoader } from "../packages/xahau/src/lazy-loader";
import { GemWalletAdapter } from "../packages/adapters/gemwallet/src/index";
import { XamanAdapter, type XamanSdkLike } from "../packages/adapters/xaman/src/index";
import { XyraAdapter } from "../packages/adapters/xyra/src/index";
import { LedgerAdapter } from "../packages/adapters/ledger/src/index";

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
}
const tick = () => new Promise<void>(resolve => setImmediate(resolve));

function fixture() {
  const wallet = Wallet.generate();
  const account = { address: wallet.address, publicKey: wallet.publicKey };
  const policy = { maxFeeDrops: "100" };
  const calls: string[] = [];
  const state = { index: 100, networkId: 21338, fee: "10", queued: false, lostResponse: false,
    onRead: undefined as undefined | ((method: string) => Promise<void> | void) };
  const protocol = createXahauProtocol({ request: async (_network, method, params) => {
    calls.push(method);
    await state.onRead?.(method);
    if (method === "server_info") return { info: { network_id: state.networkId, validated_ledger: { seq: state.index, age: 1 } } };
    if (method === "account_info") {
      assert.equal(params.queue, true);
      assert.equal(params.ledger_index, "current");
      return { account_data: { Account: wallet.address, Sequence: 1 },
        queue_data: state.queued ? { txn_count: 1, highest_sequence: 1 } : { txn_count: 0 } };
    }
    if (method === "fee") {
      assert.equal(protocol.decode(String(params.tx_blob)).Fee, "0");
      return { drops: { base_fee: state.fee, open_ledger_fee: state.fee } };
    }
    if (method === "submit") {
      if (state.lostResponse) throw new Error("Dropped submit response");
      return { engine_result: "tesSUCCESS" };
    }
    throw new Error(`Unexpected RPC ${method}`);
  } });
  const prepare = () => protocol.prepare({ TransactionType: "Payment", Destination: Wallet.generate().address, Amount: "1" }, account, XAHAU_TESTNET, policy);
  const sign = (tx: Record<string, unknown>) => wallet.sign(tx as never).tx_blob;
  return { wallet, protocol, account, policy, calls, state, prepare, sign };
}

test("Xahau parallelizes independent reads and uses seven RPCs before the separate receipt", async () => {
  const f = fixture();
  const head = deferred(); const account = deferred();
  f.state.onRead = method => method === "server_info" ? head.promise : method === "account_info" ? account.promise : undefined;
  const preparing = f.prepare();
  await tick();
  assert.deepEqual(f.calls, ["server_info", "account_info"]);
  account.resolve();
  await tick();
  assert.equal(f.calls.includes("fee"), false);
  head.resolve();
  const tx = await preparing;
  f.state.index = 105; // Approval crossed ledgers, but the original deadline remains valid.
  assert.deepEqual(f.calls, ["server_info", "account_info", "fee"]);

  const gate = deferred();
  f.state.onRead = method => method !== "submit" ? gate.promise : undefined;
  const submitting = f.protocol.verifyAndSubmit!(f.sign(tx), tx, f.account, XAHAU_TESTNET, f.policy, () => {});
  await tick();
  assert.deepEqual(f.calls.slice(3), ["server_info", "account_info", "fee"]);
  gate.resolve();
  const result = await submitting;
  assert.deepEqual(f.calls, ["server_info", "account_info", "fee", "server_info", "account_info", "fee", "submit"]);
  assert.equal(result.status, "submitted"); // Preliminary tesSUCCESS is not a validated receipt.

  f.calls.length = 0;
  f.state.onRead = undefined;
  await f.protocol.submit(result.txBlob, XAHAU_TESTNET, f.policy);
  assert.deepEqual(f.calls, ["server_info", "submit"]);
});

test("Xahau combined submission rejects stale queue/fee/expiry, switched sessions and tampered intent", async () => {
  for (const mode of ["queue", "fee", "expiry", "network", "session", "cancel", "intent", "ceiling"] as const) {
    const f = fixture();
    const tx = await f.prepare();
    const blob = f.sign(mode === "intent" ? { ...tx, Amount: "2" } : tx);
    f.calls.length = 0;
    let active = true;
    const controller = new AbortController();
    if (mode === "queue") f.state.queued = true;
    if (mode === "fee") f.state.fee = "11";
    if (mode === "expiry") f.state.index = 121;
    if (mode === "network") f.state.networkId = 21337;
    if (mode === "session" || mode === "cancel") f.state.onRead = method => {
      if (method === "account_info") { active = false; if (mode === "cancel") controller.abort(); }
    };
    await assert.rejects(f.protocol.verifyAndSubmit!(blob, tx, f.account, XAHAU_TESTNET,
      { ...f.policy, signal: controller.signal, ...(mode === "ceiling" ? { maxFeeDrops: "9" } : {}) },
      () => { if (!active) throw new Error("Session changed"); }), mode);
    assert.equal(f.calls.includes("submit"), false, mode);
  }
});

test("Xahau revalidates an expired post-sign phase without retrying any submission", async t => {
  const f = fixture();
  const tx = await f.prepare();
  f.calls.length = 0;
  let now = 1000;
  t.mock.method(Date, "now", () => now);
  let delayed = false;
  f.state.onRead = method => {
    if (method === "server_info" && !delayed) { delayed = true; now += 6000; }
  };
  await f.protocol.verifyAndSubmit!(f.sign(tx), tx, f.account, XAHAU_TESTNET, f.policy, () => {});
  assert.deepEqual(f.calls, ["server_info", "account_info", "fee", "server_info", "account_info", "fee", "submit"]);
  f.calls.length = 0;
  f.state.onRead = method => { if (method === "server_info") now += 6000; };
  await assert.rejects(f.protocol.verifyAndSubmit!(f.sign(tx), tx, f.account, XAHAU_TESTNET, f.policy, () => {}), /validation expired/);
  assert.equal(f.calls.includes("submit"), false);
});

test("Xahau lost submit responses retain the exact hash and are never automatically resubmitted", async () => {
  const f = fixture();
  const tx = await f.prepare();
  const blob = f.sign(tx);
  const expected = f.protocol.verify(blob, tx, f.account, XAHAU_TESTNET, f.policy);
  f.state.lostResponse = true;
  f.calls.length = 0;
  await assert.rejects(f.protocol.verifyAndSubmit!(blob, tx, f.account, XAHAU_TESTNET, f.policy, () => {}), (error: any) => {
    assert.equal(error.code, "SUBMIT_FAILED");
    assert.equal(error.details.hash, expected.hash);
    assert.equal(error.details.outcomeUnknown, true);
    return true;
  });
  assert.equal(f.calls.filter(method => method === "submit").length, 1);
});

test("real managers and all four Xahau adapters reach the combined seven-RPC signing path", async () => {
  const oldWindow = globalThis.window;
  globalThis.window = { open: () => ({ close() {} }) } as unknown as Window & typeof globalThis;
  try {
    for (const name of ["gemwallet", "xaman", "xyra", "ledger"] as const) {
      const f = fixture();
      const supportedChains = { families: ["xahau"] };
      let blob = "";
      const sdk: XamanSdkLike = { payload: {
        createAndSubscribe: async (payload: any) => {
          assert.equal(payload.options.submit, false);
          blob = f.sign(payload.txjson);
          return { created: { uuid: "test" }, resolved: Promise.resolve({ signed: true }) };
        }, get: async () => ({ meta: { signed: true }, response: { hex: blob } })
      } };
      const adapters = {
        gemwallet: () => new GemWalletAdapter({ supportedChains, provider: {
          isInstalled: async () => true,
          getAddress: async () => ({ result: { address: f.account.address } }),
          getPublicKey: async () => ({ result: { ...f.account } }),
          getNetwork: async () => ({ result: { chain: "XAHAU", network: "Testnet" } }),
          signTransaction: async (payload: any) => ({ result: { signature: f.sign(payload.transaction) } })
        } }),
        xaman: () => new XamanAdapter({ sdk, supportedChains, recoveryStorage: new MemoryWalletStorage(),
          auth: { authorize: async () => ({ sdk, me: { sub: f.account.address, networkEndpoint: XAHAU_TESTNET.rpcUrl } }) } }),
        ledger: () => new LedgerAdapter({ supportedChains, connectLedger: async () => ({ ...f.account,
          signTransaction: async (tx: unknown) => ({ txBlob: f.sign(tx as Record<string, unknown>) }) }) }),
        xyra: () => {
          const adapter = new XyraAdapter({ supportedChains });
          (adapter as any).popup.request = async (method: string, payload: any) => {
            if (method === "connect") return { ...f.account, network: "xahau-testnet" };
            const tx = JSON.parse(atob(payload.tx));
            const tx_blob = f.sign(tx);
            return { tx_blob, hash: f.protocol.verify(tx_blob, tx, f.account, XAHAU_TESTNET, f.policy).hash,
              network: "xahau-testnet", submitted: false };
          };
          return adapter;
        }
      };
      const adapter = adapters[name]();
      adapter.isAvailable = async () => true;
      const manager = new WalletManager({ adapters: [adapter], networks: [XAHAU_TESTNET], network: "xahau-testnet",
        protocols: [f.protocol], storage: new MemoryWalletStorage(), preflight: { maxFeeDrops: "100" },
        accountStatus: { enabled: false }, transactionConfirmation: { enabled: false }, logger: { level: "silent" } });
      try {
        await manager.connect(adapter.metadata.id);
        f.calls.length = 0;
        const result = await manager.signAndSubmit({ txJson: { TransactionType: "Payment", Destination: Wallet.generate().address, Amount: "1" } });
        assert.equal(result.status, "submitted", name);
        assert.deepEqual(f.calls, ["server_info", "account_info", "fee", "server_info", "account_info", "fee", "submit"], name);
      } finally { await manager.disconnect(); manager.destroy(); }
    }
  } finally {
    if (oldWindow === undefined) delete (globalThis as { window?: Window }).window;
    else globalThis.window = oldWindow;
  }
});

test("concurrent combined operations have separate validation and cancellation state", async () => {
  const f = fixture();
  const tx = await f.prepare();
  const other = { ...tx, Destination: Wallet.generate().address };
  const gate = deferred();
  f.calls.length = 0;
  f.state.onRead = method => method === "submit" ? undefined : gate.promise;
  let active = true;
  const first = f.protocol.verifyAndSubmit!(f.sign(tx), tx, f.account, XAHAU_TESTNET, f.policy, () => {
    if (!active) throw new Error("First operation cancelled");
  });
  const rejected = assert.rejects(first, /First operation cancelled/);
  const second = f.protocol.verifyAndSubmit!(f.sign(other), other, f.account, XAHAU_TESTNET, f.policy, () => {});
  await tick();
  active = false;
  gate.resolve();
  await rejected;
  const result = await second;
  assert.equal(f.protocol.decode(result.txBlob).Destination, other.Destination);
  assert.equal(f.calls.filter(method => method === "server_info").length, 2);
  assert.equal(f.calls.filter(method => method === "submit").length, 1);
});

test("older protocols and lazy runtimes keep post-sign preparation and the standalone head check", async () => {
  for (const lazy of [false, true]) {
    const f = fixture();
    delete f.protocol.verifyAndSubmit;
    const protocol = lazy ? createXahauProtocolLoader({}, async () => ({ createXahauProtocol: () => f.protocol })) : f.protocol;
    const tx = await protocol.prepare({ TransactionType: "Payment", Destination: Wallet.generate().address, Amount: "1" }, f.account, XAHAU_TESTNET, f.policy);
    f.calls.length = 0;
    const result = await verifyAndSubmitProtocolTransaction({ protocol, network: XAHAU_TESTNET },
      { txJson: tx, ...f.policy }, f.account, tx, f.sign(tx), () => {}, 0);
    assert.equal(result.status, "submitted");
    assert.deepEqual(f.calls, ["server_info", "account_info", "fee", "server_info", "submit"]);
  }
});
