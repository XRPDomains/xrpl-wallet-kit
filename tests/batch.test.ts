import assert from "node:assert/strict";
import test from "node:test";
import type { Client } from "xrpl";
import { BaseWalletAdapter, WalletManager, prepareBatchTransaction, validateBatchTransaction, validateTransactionPreflight,
  type SignTransactionRequest, type SignAndSubmitRequest } from "../packages/core/src/index";
import { createBatchTracking, inspectBatchResult, BATCH_V1_1_AMENDMENT, FIX_BATCH_V1_2_AMENDMENT } from "../packages/core/src/batch";

const address = "rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe";
const destination = "rG1QQv2nh2gr7RCZ1P8YYcBUKCCN633jCn";
const network = { id: "mainnet", name: "Mainnet", networkType: "MAINNET", rpcUrl: "wss://example.invalid", httpRpcUrl: "https://example.invalid" } as const;
const payment = () => ({ TransactionType: "Payment", Account: address, Destination: destination, Amount: "1000000" });
const batch = () => ({ TransactionType: "Batch", Account: address, Flags: 65536, SourceTag: 0, Sequence: 10, Fee: "40", LastLedgerSequence: 120,
  RawTransactions: [11, 12].map(Sequence => ({ RawTransaction: { ...payment(), Flags: 1073741824, Sequence, Fee: "0", SigningPubKey: "", SourceTag: 0 } })) });
const options = () => ({ account: address, transactions: [payment(), payment()], maxFeeDrops: "100" });
const client = (fee = "40", enabled = true) => ({
  request: async ({ feature }: { feature: string }) => ({ result: { [feature]: { enabled } } }),
  autofill: async (tx: ReturnType<typeof batch>) => ({ ...tx, Sequence: 10, Fee: fee, LastLedgerSequence: 120,
    RawTransactions: tx.RawTransactions.map(({ RawTransaction }, index) => ({ RawTransaction: { ...RawTransaction, Sequence: index + 11 } })) })
}) as unknown as Pick<Client, "request" | "autofill">;

test("Batch preparation uses SDK autofill, explicit tags, and does not mutate input", async () => {
  const input = options();
  const original = structuredClone(input);
  const prepared = await prepareBatchTransaction(client(), input);
  assert.deepEqual(input, original);
  assert.deepEqual(validateBatchTransaction(prepared as unknown as Record<string, unknown>), []);
  assert.equal(prepared.SourceTag, 0);
  assert.deepEqual(prepared.RawTransactions.map(item => [item.RawTransaction.Sequence, item.RawTransaction.Fee, item.RawTransaction.SigningPubKey]), [[11, "0", ""], [12, "0", ""]]);
});

test("preparation works with real xrpl.js autofill and mocked read-only RPC", async () => {
  const { Client } = await import("xrpl");
  const rpc = new Client("wss://example.invalid");
  rpc.request = (async (request: any) => {
    if (request.command === "feature") return { result: { [request.feature]: { enabled: true } } };
    if (request.command === "account_info") return { result: { account_data: { Sequence: 10 } } };
    if (request.command === "ledger") return { result: { ledger_index: 100 } };
    if (request.command === "server_info") return { result: { info: { validated_ledger: { base_fee_xrp: "0.00001" }, load_factor: 1 } } };
    throw new Error(`Unexpected RPC command: ${request.command}`);
  }) as Client["request"];
  const prepared = await prepareBatchTransaction(rpc, options());
  assert.deepEqual(validateBatchTransaction(prepared as unknown as Record<string, unknown>), []);
  assert.deepEqual(prepared.RawTransactions.map(item => item.RawTransaction.Sequence), [11, 12]);
  assert.ok(BigInt(prepared.Fee!) >= 40n);
});

test("preparation requires both current amendments and enforces a fee ceiling", async () => {
  const seen: string[] = [];
  const rpc = client();
  rpc.request = (async ({ feature }: { feature: string }) => { seen.push(feature); return { result: { [feature]: { enabled: true } } }; }) as Client["request"];
  await prepareBatchTransaction(rpc, options());
  assert.deepEqual(seen, [BATCH_V1_1_AMENDMENT, FIX_BATCH_V1_2_AMENDMENT]);
  await assert.rejects(prepareBatchTransaction(client("40", false), options()), /enabled/);
  await assert.rejects(prepareBatchTransaction(client("101"), options()), /maxFeeDrops/);
  await assert.rejects(prepareBatchTransaction(client(), { ...options(), maxFeeDrops: "-1" }), /maxFeeDrops/);
});

test("Batch V1 rejects malformed wrappers, nesting, unsupported modes and foreign accounts", () => {
  for (const alter of [
    (tx: any) => { tx.Flags = 524288; },
    (tx: any) => { tx.BatchSigners = []; },
    (tx: any) => { tx.RawTransactions[0] = { Memo: tx.RawTransactions[0].RawTransaction }; },
    (tx: any) => { tx.RawTransactions[0].Memo = {}; },
    (tx: any) => { tx.RawTransactions[0].RawTransaction.TransactionType = "Batch"; },
    (tx: any) => { tx.RawTransactions[0].RawTransaction.Account = destination; },
    (tx: any) => { tx.RawTransactions[0].RawTransaction.Fee = "1"; },
    (tx: any) => { tx.RawTransactions[0].RawTransaction.Flags = 0; },
    (tx: any) => { tx.RawTransactions[0].RawTransaction.SigningPubKey = "ED1234"; },
    (tx: any) => { tx.RawTransactions[0].RawTransaction.TxnSignature = "ABCD"; },
    (tx: any) => { tx.RawTransactions[0].RawTransaction.Signers = []; },
    (tx: any) => { tx.RawTransactions[0].RawTransaction.LastLedgerSequence = 120; },
    (tx: any) => { tx.RawTransactions[0].RawTransaction.NetworkID = 2; },
    (tx: any) => { tx.RawTransactions[0].RawTransaction.Sequence = 12; },
    (tx: any) => { tx.RawTransactions[0].RawTransaction.TicketSequence = 30; },
    (tx: any) => { tx.RawTransactions[0].RawTransaction.SourceTag = -1; },
    (tx: any) => { delete tx.Sequence; },
    (tx: any) => { delete tx.LastLedgerSequence; },
    (tx: any) => { tx.RawTransactions = Array(9).fill(tx.RawTransactions[0]); }
  ]) {
    const tx = batch(); alter(tx);
    assert.ok(validateBatchTransaction(tx).length > 0);
  }
  assert.ok(validateBatchTransaction({ ...batch(), RawTransactions: [] }).length);
});

test("preparation rejects signed, cross-account and invalid inner transaction input", async () => {
  for (const extra of [{ Account: destination }, { Fee: "10" }, { TxnSignature: "ABCD" }, { Flags: "invalid" }, { Amount: "invalid" }, { UnsupportedField: "ignored" }]) {
    await assert.rejects(prepareBatchTransaction(client(), { ...options(), transactions: [{ ...payment(), ...extra }, payment()] }));
  }
});

test("Batch preflight applies type policies and application checks to every inner transaction", async () => {
  const calls: string[] = [];
  const report = await validateTransactionPreflight({ txJson: batch(), account: { address }, network, mode: "sign-only" }, {
    allowedTransactionTypes: ["Batch", "Payment"], deniedTransactionTypes: ["Payment"], requireLastLedgerSequence: true,
    validatedLedgerIndex: 100, maxLedgerOffset: 30, maxFeeDrops: "100",
    checks: [context => { calls.push(context.txJson.TransactionType as string); }]
  });
  assert.equal(report.allowed, false);
  assert.deepEqual(calls, ["Payment", "Payment", "Batch"]);
  assert.deepEqual(report.issues.map(issue => issue.code), ["TRANSACTION_TYPE_DENIED", "TRANSACTION_TYPE_DENIED"]);
  assert.equal(report.issues[0].field, "RawTransactions[0].RawTransaction.TransactionType");
});

class Adapter extends BaseWalletAdapter {
  metadata = { id: "batch-test", name: "Test", type: "extension" } as const;
  capabilities = { connect: true, signTransaction: true, signAndSubmit: true };
  calls: (SignTransactionRequest | SignAndSubmitRequest)[] = [];
  async connect() { return { account: { address, network } }; }
  async signTransaction(request: SignTransactionRequest) { this.calls.push(request); return { txBlob: "ABCD", signed: true }; }
  async signAndSubmit(request: SignAndSubmitRequest) { this.calls.push(request); return { hash: "A".repeat(64), signed: true }; }
}

async function manager(enabled: boolean, confirmation = false) {
  const adapter = new Adapter();
  const instance = new WalletManager({ adapters: [adapter], batch: enabled ? { adapterIds: [adapter.metadata.id] } : undefined,
    accountStatus: { enabled: false }, transactionConfirmation: { enabled: confirmation, attempts: 1, intervalMs: 0 }, logger: { level: "silent" } });
  await instance.connect(adapter.metadata.id);
  return { instance, adapter };
}

test("all signing entrypoints require opt-in and block invalid Batch before a wallet prompt", async () => {
  for (const enabled of [false, true]) {
    const { instance, adapter } = await manager(enabled);
    for (const submit of [undefined, false, true]) {
      const request = { txJson: { ...batch(), Flags: enabled ? 524288 : 65536 }, submit };
      await assert.rejects(submit === undefined ? instance.signTransaction(request) : instance.signAndSubmit(request));
    }
    assert.equal(adapter.calls.length, 0);
    instance.destroy();
  }
});

test("sign-only Batch has no submission tracking; submit captures immutable inner hashes", async () => {
  const { instance, adapter } = await manager(true);
  await instance.signTransaction({ txJson: batch() });
  await instance.signAndSubmit({ txJson: batch(), submit: false });
  assert.deepEqual(instance.getTransactions(), []);
  const tx = batch();
  await instance.signAndSubmit({ txJson: tx });
  assert.equal(instance.getTransactions()[0].batch?.innerTransactions.length, 2);
  assert.equal(instance.getTransactions()[0].batch?.status, "pending");
  assert.notEqual(adapter.calls[2].txJson, tx);
  await assert.rejects(instance.signTransaction({ txJson: batch().RawTransactions[0].RawTransaction }), /independently/);
  const inner = { ...batch().RawTransactions[0].RawTransaction, Flags: { tfInnerBatchTxn: true } };
  await assert.rejects(instance.signTransaction({ txJson: inner }), /independently/);
  await assert.rejects(instance.signAndSubmit({ txJson: inner }), /independently/);
  instance.destroy();
});

test("session changes in signing observers block Batch even without optional preflight", async () => {
  for (const submit of [false, true]) {
    const { instance, adapter } = await manager(true);
    instance.on("signing", () => instance.emitNetworkChanged(adapter.metadata.id, { ...network, id: "testnet" }));
    await assert.rejects(submit ? instance.signAndSubmit({ txJson: batch() }) : instance.signTransaction({ txJson: batch() }), { code: "REQUEST_CANCELLED" });
    assert.equal(adapter.calls.length, 0);
    instance.destroy();
  }
});

const parentHash = "A".repeat(64);
const outer = (tx = batch()) => ({ validated: true, transactionResult: "tesSUCCESS", raw: { result: { validated: true, tx_json: tx, ledger_index: 100, meta: { TransactionResult: "tesSUCCESS" } } } });
const innerResult = (code = "tesSUCCESS", parent = parentHash, ledger = 100) => ({ validated: true, transactionResult: code,
  raw: { result: { validated: true, ledger_index: ledger, meta: { TransactionResult: code, ParentBatchID: parent } } } });

test("Batch confirmation requires all inner results, matching parent and matching ledger", async () => {
  const expected = await createBatchTracking(batch());
  assert.equal((await inspectBatchResult(parentHash, outer(), expected, async () => innerResult())).status, "confirmed");
  assert.equal((await inspectBatchResult(parentHash, outer(), expected, async () => innerResult("tecUNFUNDED_PAYMENT"))).status, "failed");
  for (const found of [null, innerResult("tesSUCCESS", "B".repeat(64)), innerResult("tesSUCCESS", parentHash, 99), { ...innerResult(), validated: false }]) {
    assert.equal((await inspectBatchResult(parentHash, outer(), expected, async () => found)).status, "unknown");
  }
  const changed = batch(); changed.RawTransactions[0].RawTransaction.Amount = "2";
  assert.equal((await inspectBatchResult(parentHash, outer(changed), expected, async () => innerResult())).status, "unknown");
  const wrongHash = innerResult();
  Object.assign(wrongHash.raw.result, { hash: "B".repeat(64) });
  assert.equal((await inspectBatchResult(parentHash, outer(), expected, async () => wrongHash)).status, "unknown");
  const legacy = { ...outer(), raw: { result: { ...batch(), ledger_index: 100 } } };
  assert.equal((await inspectBatchResult(parentHash, legacy, expected, async () => innerResult())).status, "confirmed");
});

test("manager never emits tx_confirmed for outer-only success or mismatched inner metadata", async () => {
  const originalFetch = globalThis.fetch;
  try {
    for (const outcome of ["success", "missing", "foreign", "failed"] as const) {
      const tx = batch();
      globalThis.fetch = (async (_url, init) => {
        const hash = JSON.parse(String(init?.body)).params[0].transaction;
        const result = hash === parentHash ? outer(tx).raw : outcome === "missing" ? { result: { error: "txnNotFound" } }
          : innerResult(outcome === "failed" ? "tecUNFUNDED_PAYMENT" : "tesSUCCESS", outcome === "foreign" ? "B".repeat(64) : parentHash).raw;
        return { json: async () => result } as Response;
      }) as typeof fetch;
      const { instance } = await manager(true, true);
      let confirmed = 0;
      instance.on("tx_confirmed", () => confirmed++);
      await instance.signAndSubmit({ txJson: tx });
      for (let attempt = 0; attempt < 100 && instance.getTransactions()[0].status === "submitted"; attempt++) await new Promise(resolve => setTimeout(resolve, 2));
      assert.equal(instance.getTransactions()[0].status, outcome === "success" ? "confirmed" : outcome === "failed" ? "failed" : "unknown");
      assert.equal(confirmed, outcome === "success" ? 1 : 0);
      instance.destroy();
    }
  } finally { globalThis.fetch = originalFetch; }
});
