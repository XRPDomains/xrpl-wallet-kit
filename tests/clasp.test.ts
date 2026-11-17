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
