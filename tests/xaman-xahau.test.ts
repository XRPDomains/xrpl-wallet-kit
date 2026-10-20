import assert from "node:assert/strict";
import test from "node:test";
import { Wallet } from "xrpl";
import { XamanAdapter, type XamanSdkLike } from "../packages/adapters/xaman/src/index";
import { MemoryWalletStorage } from "../packages/core/src";
import { createXahauProtocol, XAHAU_TESTNET, XAHAU_MAINNET } from "../packages/xahau/src/index";

test("Xaman permits bounded autofilled expiry changes, not explicit deadlines or other mutations", async () => {
  const wallet = Wallet.generate();
  let submissions = 0;
  let extension = 7;
  let mutateAmount = false;
  let hex = "";
  const protocol = createXahauProtocol({ request: async (_network, method) => {
    if (method === "server_info") return { info: { network_id: 21338, validated_ledger: { seq: 26613868, age: 1 } } };
    if (method === "account_info") return { account_data: { Account: wallet.address, Sequence: 1 } };
    if (method === "fee") return { drops: { base_fee: "10", open_ledger_fee: "10" } };
    if (method === "submit") { submissions++; return { engine_result: "tesSUCCESS" }; }
    throw new Error(`Unexpected RPC: ${method}`);
  } });
  const sdk: XamanSdkLike = { payload: {
    createAndSubscribe: async (payload: any) => {
      assert.equal(payload.options.submit, false);
      assert.equal(payload.options.force_network, "XAHAUTESTNET");
      hex = wallet.sign({ ...payload.txjson,
        LastLedgerSequence: payload.txjson.LastLedgerSequence + extension,
        ...(mutateAmount ? { Amount: "20000" } : {}) }).tx_blob;
      return { created: { uuid: "test" }, resolved: Promise.resolve({ signed: true }) };
    },
    get: async () => ({ meta: { signed: true }, response: { hex } })
  } };
  const adapter = new XamanAdapter({ sdk,
    auth: { authorize: async () => ({ sdk, me: { sub: wallet.address, networkEndpoint: XAHAU_TESTNET.rpcUrl } }) },
    recoveryStorage: new MemoryWalletStorage(), supportedChains: { families: ["xahau"] }
  });
  await adapter.connect({ network: XAHAU_TESTNET, protocolContext: { protocol, network: XAHAU_TESTNET } });
  const request = { txJson: { TransactionType: "Payment", Destination: Wallet.generate().address, Amount: "10000" }, maxFeeDrops: "50000" };
  const signed = await adapter.signAndSubmit({ ...request, submit: false });
  assert.equal(protocol.decode(signed.txBlob!).LastLedgerSequence, 26613895);
  assert.equal(submissions, 0);
  await adapter.signAndSubmit(request);
  assert.equal(submissions, 1);
  await assert.rejects(adapter.signAndSubmit({ ...request, txJson: { ...request.txJson, LastLedgerSequence: 26613888 } }), /LastLedgerSequence/);
  mutateAmount = true;
  await assert.rejects(adapter.signAndSubmit(request), /Amount/);
  mutateAmount = false;
  extension = 51;
  await assert.rejects(adapter.signAndSubmit(request), /LastLedgerSequence/);
  extension = 31;
  await assert.rejects(adapter.signAndSubmit(request), /expiry is outside/);
  assert.equal(submissions, 1);
});

test("Xahau presets use the requested explorers", () => {
  assert.equal(XAHAU_MAINNET.explorerTxUrl, "https://xahau.xrpl.org/transactions/{hash}");
  assert.equal(XAHAU_MAINNET.explorerAccountUrl, "https://xahau.xrpl.org/accounts/{address}");
  assert.equal(XAHAU_TESTNET.explorerTxUrl, "https://xahau-testnet.xrpl.org/transactions/{hash}");
  assert.equal(XAHAU_TESTNET.explorerAccountUrl, "https://xahau-testnet.xrpl.org/accounts/{address}");
});

test("Xaman Xahau message signing requests non-submittable SignIn on the selected network", async () => {
  const wallet = Wallet.generate();
  let signedAccount = wallet.address;
  const message = "Domain: localhost\nNetwork: xahau-testnet\nNonce: test";
  const sdk: XamanSdkLike = { payload: {
    createAndSubscribe: async (payload: any) => {
      assert.equal(payload.txjson.TransactionType, "SignIn");
      assert.equal(Buffer.from(payload.txjson.Memos[0].Memo.MemoData, "hex").toString(), message);
      assert.deepEqual(payload.options, { submit: false, force_network: "XAHAUTESTNET" });
      return { created: { uuid: "message" }, resolved: Promise.resolve({ signed: true }) };
    },
    get: async () => ({ meta: { signed: true }, response: { hex: "ABCD", account: signedAccount } })
  } };
  const adapter = new XamanAdapter({ sdk, supportedChains: { families: ["xahau"] }, recoveryStorage: new MemoryWalletStorage(),
    auth: { authorize: async () => ({ sdk, me: { sub: wallet.address, networkEndpoint: XAHAU_TESTNET.rpcUrl } }) }
  });
  await adapter.connect({ network: XAHAU_TESTNET, protocolContext: { network: XAHAU_TESTNET, protocol: createXahauProtocol() } });
  const result = await adapter.signMessage({ message });
  assert.equal(result.signatureKind, "signedTx");
  assert.equal(result.txBlob, "ABCD");
  signedAccount = Wallet.generate().address;
  await assert.rejects(adapter.signMessage({ message }), /another account/);
});
