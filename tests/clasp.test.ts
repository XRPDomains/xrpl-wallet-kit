import assert from "node:assert/strict";
import test from "node:test";
import { Wallet } from "xrpl";
import { assertWalletAdapter, XRPL_MAINNET, XRPL_TESTNET } from "../packages/core/src/index";
import { createClaspAdapter, type ClaspAdapterOptions } from "../packages/adapters/clasp/src/index";

const wallet = Wallet.generate();
const txJson = { TransactionType: "Payment" as const, Destination: Wallet.generate().address, Amount: "1" };

function fixture() {
  const calls: string[] = [];
  const client: NonNullable<ClaspAdapterOptions["client"]> = {
    async connect({ network = "mainnet" }) {
      calls.push("connect:" + network);
      return { address: wallet.address, publicKey: wallet.publicKey, network };
    },
    async sign({ network, address, tx }) {
      calls.push("sign:" + network);
      assert.equal(address, wallet.address);
      const result = wallet.sign({ Fee: "12", Sequence: 1, LastLedgerSequence: 100, ...tx } as never);
      return { tx_blob: result.tx_blob, hash: result.hash };
    },
    async signAndSubmit({ network }) {
      calls.push("submit:" + network);
      return { hash: "A".repeat(64), engineResult: "tesSUCCESS" };
    }
  };
  return { adapter: createClaspAdapter({ client }), client, calls };
}

test("Clasp binds Testnet and routes submit:false to verified sign-only", async () => {
  const { adapter, calls } = fixture();
  assertWalletAdapter(adapter);
  assert.equal(adapter.isAvailable(), false);
  await adapter.connect({ network: XRPL_TESTNET });
  assert.ok((await adapter.signTransaction({ txJson })).txBlob);
  assert.ok("txBlob" in await adapter.signAndSubmit({ txJson, submit: false }));
  assert.deepEqual(calls, ["connect:testnet", "sign:testnet", "sign:testnet"]);
});

test("Clasp rejects intent changes, caps fees, and does not claim validated submission", async () => {
  const { adapter, client, calls } = fixture();
  await adapter.connect({ network: XRPL_MAINNET });
  const sign = client.sign.bind(client);
  client.sign = params => sign({ ...params, tx: { ...params.tx, Amount: "2" } });
  await assert.rejects(adapter.signTransaction({ txJson }), { code: "SIGN_FAILED" });
  await assert.rejects(adapter.signAndSubmit({ txJson, maxFeeDrops: "20" }), { code: "INVALID_REQUEST" });
  await assert.rejects(adapter.signAndSubmit({ txJson: { ...txJson, Fee: "21" }, maxFeeDrops: "20" }), { code: "INVALID_REQUEST" });
  const result = await adapter.signAndSubmit({ txJson: { ...txJson, Fee: "12" }, maxFeeDrops: "20" });
  assert.ok("status" in result && result.status === "submitted");
  assert.deepEqual(calls, ["connect:mainnet", "sign:mainnet", "submit:mainnet"]);
});

test("Clasp NFT accept-offer sign-only verifies either offer side and identifies changed fields", async () => {
  const { adapter, client } = fixture();
  await adapter.connect({ network: XRPL_MAINNET });
  const sign = client.sign.bind(client);
  for (const field of ["NFTokenBuyOffer", "NFTokenSellOffer"] as const) {
    const nftTx = { TransactionType: "NFTokenAcceptOffer" as const, Account: wallet.address, [field]: "A".repeat(64) };
    const signed = await adapter.signAndSubmit({ txJson: nftTx, submit: false, methodHint: "acceptNFTOffer",
      walletPayload: { [field]: nftTx[field] } });
    assert.ok("txBlob" in signed && signed.txBlob);
    client.sign = params => sign({ ...params, tx: { ...params.tx, [field]: "B".repeat(64) } });
    await assert.rejects(adapter.signTransaction({ txJson: nftTx }), (error: unknown) => {
      const failure = error as { code: string; message: string; details: Record<string, unknown> };
      assert.equal(failure.code, "SIGN_FAILED");
      assert.equal(failure.details.verificationStage, "intent");
      assert.deepEqual(failure.details.changedFields, [field]);
      assert.equal(failure.details.outcomeUnknown, false);
      assert.ok(failure.message.includes(field));
      return true;
    });
    client.sign = sign;
  }
});

test("Clasp disconnect cancels connect without adopting a late account", async () => {
  const { adapter, client } = fixture();
  const connect = client.connect.bind(client);
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  client.connect = async params => { await gate; return connect(params); };
  const connecting = adapter.connect({ network: XRPL_TESTNET });
  const rejected = assert.rejects(connecting, { code: "REQUEST_CANCELLED" });
  await adapter.disconnect();
  release();
  await rejected;
  await assert.rejects(adapter.signTransaction({ txJson }), { code: "NOT_CONNECTED" });
});

test("Clasp generic Kit requests use txJson, not walletPayload, for signing and submission", async () => {
  const { adapter, client, calls } = fixture();
  await adapter.connect({ network: XRPL_MAINNET });
  const original = structuredClone(txJson);
  const walletPayload = { amount: "999", destination: Wallet.generate().address };
  const submit = client.signAndSubmit.bind(client);
  client.signAndSubmit = async params => {
    assert.deepEqual(params.tx, { ...original, Account: wallet.address });
    return submit(params);
  };
  const request = { txJson, walletPayload, methodHint: "payment" as const };
  const signed = await adapter.signTransaction(request);
  assert.ok(signed.txBlob);
  assert.ok("txBlob" in await adapter.signAndSubmit({ ...request, submit: false }));
  const result = await adapter.signAndSubmit({ ...request, submit: true });
  assert.ok("status" in result && result.status === "submitted");
  assert.deepEqual(txJson, original);
  assert.deepEqual(calls, ["connect:mainnet", "sign:mainnet", "sign:mainnet", "submit:mainnet"]);
});

test("Clasp pre-dispatch validation has a known non-submitted outcome", async () => {
  const { adapter, calls } = fixture();
  await adapter.connect({ network: XRPL_MAINNET });
  await assert.rejects(adapter.signAndSubmit({ txJson, maxFeeDrops: "20" }), (error: unknown) => {
    const failure = error as { code: string; details: { outcomeUnknown: boolean } };
    assert.equal(failure.code, "INVALID_REQUEST");
    assert.equal(failure.details.outcomeUnknown, false);
    return true;
  });
  assert.deepEqual(calls, ["connect:mainnet"]);
});

async function browserFixture(run: (context: ReturnType<typeof fakeBrowser>) => Promise<void>) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "window");
  const browser = fakeBrowser();
  Object.defineProperty(globalThis, "window", { configurable: true, value: browser.window });
  try { await run(browser); }
  finally {
    if (previous) Object.defineProperty(globalThis, "window", previous);
    else Reflect.deleteProperty(globalThis, "window");
  }
}

function fakeBrowser() {
  const listeners = new Set<(event: unknown) => void>();
  const popups: Array<{ name: string; closed: boolean; request?: { id: string; method: string; params: unknown };
    postMessage(data: unknown, origin: string): void; close(): void }> = [];
  return {
    listeners, popups,
    window: {
      addEventListener(_type: string, listener: (event: unknown) => void) { listeners.add(listener); },
      removeEventListener(_type: string, listener: (event: unknown) => void) { listeners.delete(listener); },
      open(url: string, name: string) {
        assert.equal(url, "https://claspwallet.com/connect/");
        const popup = { name, closed: false, request: undefined as typeof popups[number]["request"],
          postMessage(data: unknown, origin: string) {
            assert.equal(origin, "https://claspwallet.com");
            this.request = data as NonNullable<typeof this.request>;
          },
          close() { this.closed = true; }
        };
        popups.push(popup);
        return popup;
      }
    },
    emit(index: number, data: object, origin = "https://claspwallet.com", source: unknown = popups[index]) {
      for (const listener of [...listeners]) listener({ data: { v: 1, ...data }, origin, source });
    },
    ready(index: number) { this.emit(index, { clasp: "ready" }); },
    reply(index: number, result: object) { this.emit(index, { clasp: "response", id: popups[index].request?.id, ok: true, result }); },
    fail(index: number, error: object) { this.emit(index, { clasp: "response", id: popups[index].request?.id, ok: false, error }); },
    async connect(adapter: ReturnType<typeof createClaspAdapter>) {
      const pending = adapter.connect({ network: XRPL_TESTNET });
      const index = popups.length - 1;
      this.ready(index);
      this.reply(index, { network: "testnet", address: wallet.address, publicKey: wallet.publicKey });
      await pending;
    }
  };
}

test("Clasp default transport cleans cancellation and timeout, rejects foreign and late replies, and allows reconnect", async () => {
  await browserFixture(async browser => {
    const adapter = createClaspAdapter();
    const connecting = adapter.connect({ network: XRPL_TESTNET });
    browser.emit(0, { clasp: "ready" }, "https://attacker.example");
    browser.emit(0, { clasp: "ready" }, undefined, {});
    assert.equal(browser.popups[0].request, undefined);
    browser.ready(0);
    const cancelled = assert.rejects(connecting, { code: "REQUEST_CANCELLED" });
    await adapter.disconnect();
    await cancelled;
    assert.equal(browser.listeners.size, 0);
    assert.equal(browser.popups[0].closed, true);
    const reconnecting = adapter.connect({ network: XRPL_TESTNET });
    browser.reply(0, { network: "testnet", address: wallet.address, publicKey: wallet.publicKey });
    browser.ready(1);
    browser.emit(1, { clasp: "response", id: "wrong-id", ok: true, result: {} });
    browser.reply(1, { network: "testnet", address: wallet.address, publicKey: wallet.publicKey });
    await reconnecting;
    await adapter.disconnect();
    await assert.rejects(adapter.connect({ network: XRPL_TESTNET, timeoutMs: 5 }), { code: "REQUEST_TIMEOUT" });
    assert.equal(browser.listeners.size, 0);
    assert.equal(browser.popups[2].closed, true);
    await browser.connect(adapter);
    assert.equal(browser.listeners.size, 0);
  });
});

test("Clasp submission preserves rejection, confirmed failure and uncertain hash outcomes", async () => {
  await browserFixture(async browser => {
    const adapter = createClaspAdapter();
    await browser.connect(adapter);
    for (const [code, expectedCode, unknown, final] of [
      ["user_rejected", "SIGN_REJECTED", false, false],
      ["tx_failed", "SUBMIT_FAILED", false, true],
      ["not_confirmed", "SUBMIT_FAILED", true, false]
    ] as const) {
      const pending = adapter.signAndSubmit({ txJson });
      const index = browser.popups.length - 1;
      const checked = assert.rejects(pending, (error: unknown) => {
        const failure = error as { code: string; details: { outcomeUnknown: boolean; final?: boolean; hash?: string } };
        assert.equal(failure.code, expectedCode);
        assert.equal(failure.details.outcomeUnknown, unknown);
        if (code !== "user_rejected") {
          assert.equal(failure.details.final, final);
          assert.equal(failure.details.hash, "A".repeat(64));
        }
        return true;
      });
      browser.ready(index);
      browser.fail(index, { code, message: "Provider result", hash: code === "user_rejected" ? undefined : "a".repeat(64),
        engineResult: code === "tx_failed" ? "tecUNFUNDED_PAYMENT" : undefined });
      await checked;
      assert.equal(browser.listeners.size, 0);
    }
  });
});

test("Clasp cancelled submission stays uncertain and is never replayed or navigated by a new connection", async () => {
  await browserFixture(async browser => {
    const adapter = createClaspAdapter();
    await browser.connect(adapter);
    const controller = new AbortController();
    const pending = adapter.signAndSubmit({ txJson, signal: controller.signal });
    browser.ready(1);
    assert.equal(browser.popups[1].request?.method, "sign_and_submit");
    const checked = assert.rejects(pending, (error: unknown) => {
      const failure = error as { code: string; details: { outcomeUnknown: boolean } };
      assert.equal(failure.code, "REQUEST_CANCELLED");
      assert.equal(failure.details.outcomeUnknown, true);
      return true;
    });
    controller.abort();
    await checked;
    assert.equal(browser.listeners.size, 0);
    assert.equal(browser.popups[1].closed, false);
    await adapter.disconnect();
    await browser.connect(adapter);
    assert.notEqual(browser.popups[1].name, browser.popups[2].name);
    browser.reply(1, { hash: "A".repeat(64), engineResult: "tesSUCCESS" });
    assert.equal(browser.listeners.size, 0);
    assert.equal(browser.popups.filter(popup => popup.request?.method === "sign_and_submit").length, 1);
  });
});

test("Clasp default transport uses sign for submit:false and preserves the SDK wire contract", async () => {
  await browserFixture(async browser => {
    const adapter = createClaspAdapter();
    await browser.connect(adapter);
    const signed = wallet.sign({ ...txJson, Account: wallet.address, Fee: "12", Sequence: 1, LastLedgerSequence: 100 });
    const pending = adapter.signAndSubmit({ txJson, submit: false });
    browser.ready(1);
    assert.equal(browser.popups[1].request?.method, "sign");
    assert.deepEqual(browser.popups[1].request?.params, {
      network: "testnet", address: wallet.address, tx: { ...txJson, Account: wallet.address }
    });
    browser.reply(1, { tx_blob: signed.tx_blob, hash: signed.hash });
    const result = await pending;
    assert.ok("txBlob" in result && result.txBlob === signed.tx_blob);
    const submitting = adapter.signAndSubmit({ txJson });
    browser.ready(2);
    assert.equal(browser.popups[2].request?.method, "sign_and_submit");
    browser.reply(2, { hash: signed.hash, engineResult: "tesSUCCESS" });
    const sent = await submitting;
    assert.ok("status" in sent && sent.status === "submitted");
    assert.equal(browser.popups[1].name, browser.popups[2].name);
    assert.equal(browser.listeners.size, 0);
  });
});
