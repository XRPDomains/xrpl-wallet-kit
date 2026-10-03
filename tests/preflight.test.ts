import assert from "node:assert/strict";
import test from "node:test";
import {
  BaseWalletAdapter, WalletManager, WalletKitErrorCode, validateTransactionPreflight,
  type TransactionPreflightPolicy, type SignTransactionRequest, type SignAndSubmitRequest
} from "../packages/core/src/index";

const network = { id: "testnet", name: "Testnet", rpcUrl: "wss://example.invalid", networkId: 1 } as const;
const account = { address: "rConnected", network };
const tx = { TransactionType: "Payment", Account: account.address, Fee: "12", LastLedgerSequence: 110 };

class Adapter extends BaseWalletAdapter {
  metadata = { id: "preflight-test", name: "Test", type: "extension" } as const;
  capabilities = { connect: true, signAndSubmit: true, details: { transactionModes: ["sign-only", "sign-and-submit"] as ("sign-only" | "sign-and-submit")[] } };
  calls: (SignTransactionRequest | SignAndSubmitRequest)[] = [];
  async connect() { return { account }; }
  async signTransaction(request: SignTransactionRequest) {
    this.calls.push(request);
    request.txJson.Fee = "13";
    return { txBlob: "ABCD" };
  }
  async signAndSubmit(request: SignAndSubmitRequest) {
    this.calls.push(request);
    return { txBlob: "ABCD", status: "success" };
  }
}

async function setup(preflight?: TransactionPreflightPolicy) {
  const adapter = new Adapter();
  const manager = new WalletManager({ adapters: [adapter], network: network.id, preflight, logger: { level: "silent" } });
  await manager.connect(adapter.metadata.id);
  return { adapter, manager };
}

async function codes(payload: Record<string, unknown>, policy: TransactionPreflightPolicy = {}) {
  const report = await validateTransactionPreflight({ txJson: payload, account, network, mode: "sign-only" }, policy);
  return report.issues.map(issue => issue.code);
}

test("preflight validates account, network and allowed/denied transaction types", async () => {
  assert.deepEqual(await codes({ ...tx, Account: "rOther", NetworkID: 2 }, { networkId: "mainnet", allowedTransactionTypes: ["TrustSet"], deniedTransactionTypes: ["Payment"] }),
    ["ACCOUNT_MISMATCH", "NETWORK_MISMATCH", "NETWORK_MISMATCH", "TRANSACTION_TYPE_NOT_ALLOWED", "TRANSACTION_TYPE_DENIED", "LEDGER_FRESHNESS_UNKNOWN"]);
  assert.ok((await codes({})).includes("TRANSACTION_TYPE_REQUIRED"));
  assert.deepEqual(await codes(null as unknown as Record<string, unknown>), ["INVALID_TRANSACTION"]);
});

test("fee checks use exact integer drops and require an explicit enforceable fee", async () => {
  for (const fee of [12, "-1", "1.5", "1e2"]) assert.ok((await codes({ ...tx, Fee: fee })).includes("INVALID_FEE"));
  assert.ok((await codes({ ...tx, Fee: undefined }, { maxFeeDrops: "20" })).includes("FEE_REQUIRED"));
  assert.ok((await codes(tx, { maxFeeDrops: "invalid" })).includes("INVALID_POLICY"));
  assert.ok((await codes({ ...tx, Fee: "9007199254740993" }, { maxFeeDrops: "9007199254740992" })).includes("FEE_EXCEEDED"));
  assert.ok(!(await codes(tx, { maxFeeDrops: "12" })).includes("FEE_EXCEEDED"));
});

test("ledger checks reject expiry, excessive windows and invalid policy", async () => {
  assert.ok((await codes(tx, { validatedLedgerIndex: 110 })).includes("TRANSACTION_EXPIRED"));
  assert.ok((await codes(tx, { validatedLedgerIndex: 100, maxLedgerOffset: 5 })).includes("LEDGER_WINDOW_EXCEEDED"));
  assert.deepEqual(await codes(tx, { validatedLedgerIndex: 100, maxLedgerOffset: 10 }), []);
  assert.ok((await codes(tx, { maxLedgerOffset: 10 })).includes("INVALID_POLICY"));
  assert.ok((await codes({ ...tx, LastLedgerSequence: undefined }, { requireLastLedgerSequence: true })).includes("LEDGER_SEQUENCE_REQUIRED"));
  for (const value of [-1, 1.5, 4294967296, "110"]) assert.ok((await codes({ ...tx, LastLedgerSequence: value })).includes("INVALID_LEDGER_SEQUENCE"));
});

test("application checks preserve order and fail closed on errors or invalid diagnostics", async () => {
  const report = await validateTransactionPreflight({ txJson: tx, account, network, mode: "sign-only" }, {
    validatedLedgerIndex: 100,
    checks: [() => ({ code: "TAG", severity: "warning", message: "Check destination tag" }),
      () => { throw new Error("RPC unavailable"); },
      () => ({ code: "bad" } as never),
      async () => [{ code: "TRUSTLINE", severity: "error", message: "Missing trust line" }]]
  });
  assert.equal(report.allowed, false);
  assert.deepEqual(report.issues.map(issue => issue.code), ["TAG", "CHECK_FAILED", "INVALID_CHECK_RESULT", "TRUSTLINE"]);
});

test("all transaction entrypoints block before prompting and emit a report", async () => {
  const { manager, adapter } = await setup({ maxFeeDrops: "10" });
  let reports = 0;
  let prompts = 0;
  manager.on("transaction_preflight", ({ report }) => { reports++; assert.equal(report.allowed, false); assert.ok(Object.isFrozen(report)); });
  manager.on("signing", () => prompts++);
  for (const sign of [() => manager.signTransaction({ txJson: tx }), () => manager.signAndSubmit({ txJson: tx }), () => manager.signAndSubmit({ txJson: tx, submit: false })]) {
    await assert.rejects(sign, { code: WalletKitErrorCode.PREFLIGHT_FAILED });
  }
  assert.equal(reports, 3);
  assert.equal(prompts, 0);
  assert.equal(adapter.calls.length, 0);
  await manager.destroy();
});

test("preflight is opt-in; request overrides merge and false disables global checks", async () => {
  const { manager, adapter } = await setup({ maxFeeDrops: "10", deniedTransactionTypes: ["TrustSet"] });
  await manager.signTransaction({ txJson: { ...tx }, preflight: { maxFeeDrops: "20" } });
  await assert.rejects(manager.signTransaction({ txJson: { ...tx, TransactionType: "TrustSet" }, preflight: { maxFeeDrops: "20" } }), { code: WalletKitErrorCode.PREFLIGHT_FAILED });
  await manager.signTransaction({ txJson: { ...tx }, preflight: false });
  assert.equal(adapter.calls.length, 2);
  assert.equal("preflight" in adapter.calls[0], false);
  await manager.destroy();
  const defaults = await setup();
  assert.deepEqual(await defaults.manager.preflightTransaction({ txJson: tx }), { enabled: false, allowed: true, issues: [] });
  await defaults.manager.signAndSubmit({ txJson: { ...tx, Account: "rOther" } });
  assert.equal(defaults.adapter.calls.length, 1);
  const immediate = defaults.manager.signTransaction({ txJson: { ...tx } });
  assert.equal(defaults.adapter.calls.length, 2, "default signing must not add an await before opening a wallet");
  await immediate;
  await defaults.manager.destroy();
});

test("hooks cannot mutate intent, providers receive a mutable copy and warnings permit signing", async () => {
  const input = { ...tx };
  const { manager, adapter } = await setup({ checks: [context => {
    assert.ok(Object.isFrozen(context.txJson));
    assert.ok(Object.isFrozen(context.account));
    assert.throws(() => { (context.txJson as Record<string, unknown>).Fee = "999"; }, TypeError);
    return { code: "NOTICE", severity: "warning", message: "Review payment" };
  }] });
  await manager.signTransaction({ txJson: input });
  assert.equal(input.Fee, "12");
  assert.equal(adapter.calls[0].txJson.Fee, "13");
  await manager.destroy();
});

test("provider-specific payloads cannot bypass policy", async () => {
  const { manager, adapter } = await setup({});
  const report = await manager.preflightTransaction({ txJson: tx, walletPayload: { Account: "rOther" } });
  assert.equal(report.allowed, false);
  assert.ok(report.issues.some(issue => issue.code === "WALLET_PAYLOAD_NOT_VALIDATED"));
  await assert.rejects(manager.signTransaction({ txJson: tx, walletPayload: {} }), { code: WalletKitErrorCode.PREFLIGHT_FAILED });
  assert.equal(adapter.calls.length, 0);
  await manager.destroy();
});

test("session changes during asynchronous preflight prevent wallet dispatch", async () => {
  let release!: () => void;
  let entered!: () => void;
  const started = new Promise<void>(resolve => { entered = resolve; });
  const wait = new Promise<void>(resolve => { release = resolve; });
  const { manager, adapter } = await setup({ checks: [async () => { entered(); await wait; }] });
  const pending = manager.signTransaction({ txJson: tx });
  const rejection = assert.rejects(pending, { code: WalletKitErrorCode.REQUEST_CANCELLED });
  await started;
  await manager.disconnect();
  release();
  await rejection;
  assert.equal(adapter.calls.length, 0);
  await manager.destroy();
});

test("preflight snapshots provider fields before awaiting checks", async () => {
  let release!: () => void;
  let entered!: () => void;
  const started = new Promise<void>(resolve => { entered = resolve; });
  const wait = new Promise<void>(resolve => { release = resolve; });
  const { manager, adapter } = await setup({ checks: [async () => { entered(); await wait; }] });
  const request: SignAndSubmitRequest = { txJson: { ...tx } };
  const pending = manager.signAndSubmit(request);
  await started;
  request.walletPayload = { Account: "rOther" };
  request.txJson.Account = "rOther";
  release();
  await pending;
  assert.equal(adapter.calls[0].walletPayload, undefined);
  assert.equal(adapter.calls[0].txJson.Account, account.address);
  await manager.destroy();
});

test("sign-only fallback uses the same pipeline and submit false", async () => {
  const { manager, adapter } = await setup({ validatedLedgerIndex: 100 });
  Object.defineProperty(adapter, "signTransaction", { value: undefined });
  await manager.signTransaction({ txJson: tx });
  assert.equal((adapter.calls[0] as SignAndSubmitRequest).submit, false);
  await manager.destroy();
});

test("hooks receive the correct mode for each public signing path", async () => {
  const modes: string[] = [];
  const { manager } = await setup({ checks: [context => { modes.push(context.mode); }] });
  await manager.signTransaction({ txJson: tx });
  await manager.signAndSubmit({ txJson: tx });
  await manager.signAndSubmit({ txJson: tx, submit: false });
  assert.deepEqual(modes, ["sign-only", "sign-and-submit", "sign-only"]);
  await manager.destroy();
});

test("account changes in signing listeners cannot dispatch previously validated intent", async () => {
  const { manager, adapter } = await setup({});
  manager.on("signing", () => manager.emitAccountChanged(adapter.metadata.id, { ...account, address: "rChanged" }));
  await assert.rejects(manager.signTransaction({ txJson: tx }), { code: WalletKitErrorCode.REQUEST_CANCELLED });
  assert.equal(adapter.calls.length, 0);
  await manager.destroy();
});

test("failed snapshot and malformed tx input never invoke providers", async () => {
  const { manager, adapter } = await setup({});
  await assert.rejects(manager.signTransaction({ txJson: { ...tx, unsupported: () => undefined } }), { code: WalletKitErrorCode.PREFLIGHT_FAILED });
  await assert.rejects(manager.signTransaction({ txJson: null as never }), { code: WalletKitErrorCode.PREFLIGHT_FAILED });
  assert.equal(adapter.calls.length, 0);
  await manager.destroy();
});
