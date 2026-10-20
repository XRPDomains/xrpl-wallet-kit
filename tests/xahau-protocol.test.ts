import assert from "node:assert/strict";
import test from "node:test";
import { Wallet } from "xrpl";
import { sign } from "ripple-keypairs";
import { XrplDefinitions, encodeForSigning } from "xahau-binary-codec";
import definitionsData from "xahau-binary-codec/dist/enums/definitions.json" with { type: "json" };
import { createXahauProtocol, XAHAU_TESTNET } from "../packages/xahau/src/index";
import { WalletKitErrorCode } from "../packages/core/src/index";
import type { XahauRpcRequest } from "../packages/xahau/src/index";

const address = "rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh";
test("URIToken operations retain their intent through preparation and signature verification", async () => {
  const wallet = Wallet.generate();
  const definitions = new XrplDefinitions(structuredClone(definitionsData));
  const protocol = createXahauProtocol({ request: async (_network, method) => {
    if (method === "server_info") return { info: { network_id: 21338, validated_ledger: { seq: 100, age: 1 } } };
    if (method === "account_info") return { account_data: { Account: wallet.address, Sequence: 1 } };
    if (method === "fee") return { drops: { base_fee: "10", open_ledger_fee: "10" } };
    throw new Error(`Unexpected RPC: ${method}`);
  } });
  const account = { address: wallet.address, publicKey: wallet.publicKey };
  const policy = { maxFeeDrops: "100" };
  for (const type of ["URITokenMint", "URITokenBurn", "URITokenBuy", "URITokenCreateSellOffer", "URITokenCancelSellOffer"]) {
    const input = { TransactionType: type, ...(type === "URITokenMint" ? { URI: "697066733A2F2F74657374", Flags: 1 } : { URITokenID: "AB".repeat(32) }),
      ...(["URITokenBuy", "URITokenCreateSellOffer"].includes(type) ? { Amount: "0" } : {}) };
    const tx = await protocol.prepare(input, account, XAHAU_TESTNET, policy);
    const signed = { ...tx, TxnSignature: sign(encodeForSigning(tx, definitions), wallet.privateKey) };
    const blob = protocol.encode(signed);
    assert.equal(protocol.verify(blob, tx, account, XAHAU_TESTNET, policy).txBlob, blob);
    assert.equal(protocol.decode(blob).TransactionType, type);
    assert.equal(protocol.decode(blob).NetworkID, 21338);
  }
  await assert.rejects(protocol.prepare({ TransactionType: "URITokenMint", URI: "" }, account, XAHAU_TESTNET, policy), /URI/);
  await assert.rejects(protocol.prepare({ TransactionType: "URITokenBurn", URITokenID: "AB" }, account, XAHAU_TESTNET, policy), /URITokenID/);
});

test("Xahau verification identifies changed fields without accepting wallet mutations", () => {
  const protocol = fixture();
  const wallet = Wallet.generate();
  const account = { address: wallet.address };
  const expected = { TransactionType: "Payment", Account: wallet.address, Destination: address,
    Amount: "10000", Fee: "10", Sequence: 1, LastLedgerSequence: 120, NetworkID: 21338,
    Flags: 2147483648, SigningPubKey: "" };
  const sign = (changes = {}) => wallet.sign({ ...expected, ...changes } as never).tx_blob;
  assert.equal(protocol.verify(sign(), expected, account, XAHAU_TESTNET, { maxFeeDrops: "100" }).txBlob, sign());
  for (const changes of [{ SourceTag: 0 }, { Amount: "20000" }, { Fee: "11" }]) {
    assert.throws(() => protocol.verify(sign(changes), expected, account, XAHAU_TESTNET, { maxFeeDrops: "100" }), (error: any) => {
      const field = Object.keys(changes)[0];
      assert.equal(error.code, WalletKitErrorCode.SIGN_FAILED);
      assert.match(error.message, new RegExp(`Signed fields changed: ${field}`));
      assert.deepEqual(error.details.changedFields, [field]);
      assert.equal(error.details.changes[0].field, field);
      assert.equal(error.details.changes[0].actual, changes[field as keyof typeof changes]);
      assert.equal(JSON.stringify(error.details).includes("TxnSignature"), false);
      return true;
    });
  }
});

function fixture(engineResult = "tesSUCCESS", transportFailure = false) {
  const request: XahauRpcRequest = async (_network, method, params) => {
    if (method === "server_info") return { info: { network_id: 21338, validated_ledger: { seq: 100, age: 1 } } };
    if (method === "account_info") {
      assert.equal(params.ledger_index, "current");
      assert.equal(params.queue, true);
      return { account_data: { Account: address, Sequence: 8 }, queue_data: { txn_count: 2, highest_sequence: 9 } };
    }
    if (method === "fee") return { drops: { base_fee: "10", open_ledger_fee: "10" } };
    if (method === "submit") {
      if (transportFailure) throw new Error("Connection lost");
      return { engine_result: engineResult };
    }
    throw new Error(`Unexpected RPC ${method}`);
  };
  return createXahauProtocol({ request });
}

test("Xahau uses the current account and queued sequence, with validated-ledger expiry", async () => {
  const protocol = fixture();
  const tx = await protocol.prepare({ TransactionType: "Payment", Destination: "rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe", Amount: "1" },
    { address }, XAHAU_TESTNET, { maxFeeDrops: "100" });
  assert.equal(tx.Sequence, 10);
  assert.equal(tx.LastLedgerSequence, 120);
  await assert.rejects(protocol.prepare({ ...tx, Sequence: 8 }, { address }, XAHAU_TESTNET, { maxFeeDrops: "100" }), /Sequence is stale/);
});

test("Xahau separates rejected submit, provisional outcomes, and lost responses", async () => {
  for (const [code, unknown, final] of [["temMALFORMED", false, true], ["telINSUF_FEE_P", false, false],
    ["tefBAD_AUTH", false, false], ["tefPAST_SEQ", true, false], ["tecPATH_DRY", true, false]] as const) {
    const protocol = fixture(code);
    const blob = protocol.encode({ TransactionType: "AccountSet", Account: address, Sequence: 10, NetworkID: 21338,
      Fee: "10", SigningPubKey: "", LastLedgerSequence: 120 });
    await assert.rejects(protocol.submit(blob, XAHAU_TESTNET, { maxFeeDrops: "100" }), (error: any) => {
      assert.equal(error.code, WalletKitErrorCode.SUBMIT_FAILED);
      assert.equal(error.details.outcomeUnknown, unknown);
      assert.equal(error.details.final, final);
      assert.match(error.details.hash, /^[0-9A-F]{64}$/);
      return true;
    });
  }
  const protocol = fixture("", true);
  const blob = protocol.encode({ TransactionType: "AccountSet", Account: address, Sequence: 10, NetworkID: 21338,
    Fee: "10", SigningPubKey: "", LastLedgerSequence: 120 });
  await assert.rejects(protocol.submit(blob, XAHAU_TESTNET, { maxFeeDrops: "100" }), (error: any) =>
    error.code === WalletKitErrorCode.SUBMIT_FAILED && error.details.outcomeUnknown === true);
});
