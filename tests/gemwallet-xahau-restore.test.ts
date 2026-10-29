import assert from "node:assert/strict";
import test from "node:test";
import { Wallet } from "xrpl";
import { sign } from "ripple-keypairs";
import { XrplDefinitions, encodeForSigning } from "xahau-binary-codec";
import definitionsData from "xahau-binary-codec/dist/enums/definitions.json" with { type: "json" };
import { WalletManager, MemoryWalletStorage, WALLET_STORAGE_VERSION } from "../packages/core/src/index";
import type { WalletNetwork, WalletSession } from "../packages/core/src/types";
import { GemWalletAdapter, type GemWalletProvider } from "../packages/adapters/gemwallet/src/index";
import { createXahauProtocol } from "../packages/xahau/src/index";
import { XAHAU_MAINNET, XAHAU_TESTNET, XAHAU_NETWORKS } from "../packages/xahau/src/networks";

const definitions = new XrplDefinitions(structuredClone(definitionsData));
async function fixture(network: WalletNetwork = XAHAU_TESTNET, override: Partial<GemWalletProvider> = {}, runtime = true) {
  const wallet = Wallet.generate();
  const calls = { address: 0, network: 0, signatures: 0, submits: 0 };
  const protocol = createXahauProtocol({ request: async (selected, method) => {
    assert.equal(selected.rpcUrl, network.rpcUrl);
    if (method === "server_info") return { info: { network_id: network.networkId, validated_ledger: { seq: 100, age: 1 } } };
    if (method === "account_info") return { account_data: { Account: wallet.address, Sequence: 1 } };
    if (method === "fee") return { drops: { base_fee: "10", open_ledger_fee: "10" } };
    if (method === "submit") { calls.submits++; return { engine_result: "tesSUCCESS" }; }
    throw new Error(`Unexpected RPC ${method}`);
  } });
  const provider: GemWalletProvider = {
    isInstalled: async () => true,
    getAddress: async () => { calls.address++; return { result: { address: wallet.address } }; },
    getNetwork: async () => { calls.network++; return { result: { chain: "XAHAU", network: network.networkType === "MAINNET" ? "Mainnet" : "Testnet" } }; },
    getPublicKey: async () => { throw new Error("Restore must not request another public-key approval"); },
    signTransaction: async (payload: any) => {
      calls.signatures++;
      const tx = { ...payload.transaction, SigningPubKey: wallet.publicKey };
      return { result: { signature: protocol.encode({ ...tx, TxnSignature: sign(encodeForSigning(tx, definitions), wallet.privateKey) }) } };
    },
    sendPayment: async () => { throw new Error("Xahau must not use the XRPL payment helper"); },
    signAndSubmit: async () => { throw new Error("Provider submission must not bypass protocol verification"); },
    ...override
  };
  const adapter = new GemWalletAdapter({ provider, supportedChains: { families: ["xrpl", "xahau"] } });
  const storage = new MemoryWalletStorage();
  const stored: WalletSession = {
    adapterId: "gemwallet", connectedAt: Date.now(),
    account: { address: wallet.address, publicKey: "untrusted-cached-key", network: { ...network, rpcUrl: "wss://stored-untrusted.example" } }
  };
  await storage.setItem("session", JSON.stringify({ version: WALLET_STORAGE_VERSION, session: stored, updatedAt: Date.now() }));
  const manager = new WalletManager({
    network: network.id, networks: [...XAHAU_NETWORKS], protocols: runtime ? [protocol] : [], adapters: [adapter], storage,
    autoReconnect: true, preflight: { maxFeeDrops: "50000" }, accountStatus: { enabled: false },
    transactionConfirmation: { enabled: false }, logger: { level: "silent" }
  });
  return { manager, adapter, calls, stored, protocol, storage, wallet, provider };
}

for (const network of [XAHAU_TESTNET, XAHAU_MAINNET]) {
  test(`GemWallet restores ${network.id} then signs and submits through the verified protocol`, async () => {
    const { manager, calls, storage, protocol, wallet } = await fixture(network);
    try {
      const restored = await manager.autoReconnect();
      assert.equal(restored?.account.address, wallet.address);
      assert.equal(restored?.account.network?.rpcUrl, network.rpcUrl);
      assert.equal(restored?.account.publicKey, undefined);
      assert.equal(restored?.metadata?.networkSource, "provider");
      assert.ok(await storage.getItem("session"));
      const request = { txJson: { TransactionType: "Payment", Destination: Wallet.generate().address, Amount: "10000" } };
      const signed = await manager.signTransaction(request);
      assert.equal(protocol.decode(signed.txBlob!).NetworkID, network.networkId);
      assert.equal(calls.submits, 0);
      const submitted = await manager.signAndSubmit(request);
      assert.equal(submitted.status, "submitted");
      assert.ok(submitted.hash);
      assert.deepEqual(calls, { address: 1, network: 1, signatures: 2, submits: 1 });
    } finally { manager.destroy(); }
  });
}

test("GemWallet Xahau restore refuses stale account, missing network proof and missing protocol", async () => {
  const cases: Partial<GemWalletProvider>[] = [
    { getAddress: async () => ({ result: { address: Wallet.generate().address } }) },
    { getAddress: async () => ({ type: "reject" }) },
    { getNetwork: async () => ({ result: { chain: "XRPL", network: "Testnet" } }) },
    { getNetwork: async () => ({ result: { chain: "XAHAU", network: "Mainnet" } }) },
    { getNetwork: async () => ({ type: "reject" }) },
    { getNetwork: undefined }
  ];
  for (const override of cases) {
    const { manager, adapter, calls } = await fixture(XAHAU_TESTNET, override);
    try {
      assert.equal(await manager.autoReconnect(), null);
      assert.equal(manager.getSession(), null);
      await assert.rejects(adapter.signTransaction({ txJson: { TransactionType: "Payment", Amount: "1" } }), { code: "NOT_CONNECTED" });
      assert.equal(calls.signatures, 0);
    } finally { manager.destroy(); }
  }
  const missing = await fixture(XAHAU_TESTNET, {}, false);
  assert.equal(await missing.manager.autoReconnect(), null);
  assert.equal(missing.calls.address, 0);
  assert.equal(await missing.adapter.restoreSession(missing.stored), null);
  missing.manager.destroy();
});

test("destroy cancels a pending GemWallet restore before it can activate signing context", async () => {
  let release!: () => void;
  let entered!: () => void;
  const started = new Promise<void>(resolve => { entered = resolve; });
  const pending = new Promise<void>(resolve => { release = resolve; });
  const { manager, adapter } = await fixture(XAHAU_TESTNET, {
    getNetwork: async () => { entered(); await pending; return { result: { chain: "XAHAU", network: "Testnet" } }; }
  });
  const restoring = manager.autoReconnect();
  await started;
  manager.destroy();
  release();
  assert.equal(await restoring, null);
  await assert.rejects(adapter.signTransaction({ txJson: { TransactionType: "Payment", Amount: "1" } }), { code: "NOT_CONNECTED" });
});
