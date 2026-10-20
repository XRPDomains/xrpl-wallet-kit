import assert from "node:assert/strict";
import test from "node:test";
import { Wallet } from "xrpl";
import { getProviderHint, XRPL_MAINNET, MemoryWalletStorage } from "../packages/core/src";
import type { WalletNetwork, WalletProtocol } from "../packages/core/src";
import { GemWalletAdapter } from "../packages/adapters/gemwallet/src";
import { XamanAdapter } from "../packages/adapters/xaman/src";
import { LedgerAdapter } from "../packages/adapters/ledger/src";
import { XyraAdapter } from "../packages/adapters/xyra/src";

const network: WalletNetwork = { id: "side-test", family: "rippled-side", name: "Side Test", networkId: 12345,
  networkType: "TESTNET", rpcUrl: "wss://example.invalid", nativeAsset: "SIDE",
  providerHints: { xaman: "SIDE_TEST", xyra: "side-test-selector", gemwallet: { chain: "SIDE", network: "Testnet" }, ledgerApp: "XAH" } };
const unused = () => { throw new Error("Not used by connect"); };
const protocol: WalletProtocol = { family: network.family!, networks: [network], transactionTypes: [],
  prepare: unused, verify: unused, encode: unused, decode: unused, submit: unused };

test("wire hints come from presets, with XRPL fallback and no non-XRPL inference", () => {
  assert.equal(getProviderHint({ ...XRPL_MAINNET, providerHints: undefined }, "xaman"), "MAINNET");
  assert.equal(getProviderHint(network, "xyra"), "side-test-selector");
  assert.deepEqual(getProviderHint(network, "gemwallet"), { chain: "SIDE", network: "Testnet" });
  assert.throws(() => getProviderHint({ ...network, providerHints: undefined }, "ledgerApp"), { code: "NETWORK_NOT_SUPPORTED" });
  assert.throws(() => getProviderHint({ ...network, providerHints: { xaman: "" } }, "xaman"), { code: "NETWORK_NOT_SUPPORTED" });
});

test("four adapters accept a configured rippled-family mapping without chain-name edits", async () => {
  const wallet = Wallet.generate();
  const supportedChains = { families: [network.family!] };
  let calls = 0;
  const gem = new GemWalletAdapter({ supportedChains, provider: {
    isInstalled: async () => { calls++; return true; },
    getAddress: async () => ({ result: { address: wallet.address } }),
    getPublicKey: async () => ({ result: { address: wallet.address, publicKey: wallet.publicKey } }),
    getNetwork: async () => ({ result: { chain: "SIDE", network: "Testnet" } })
  } });
  const xaman = new XamanAdapter({ supportedChains, recoveryStorage: new MemoryWalletStorage(),
    auth: { authorize: async () => { calls++; return { me: { sub: wallet.address, networkEndpoint: network.rpcUrl } }; } } });
  const ledger = new LedgerAdapter({ supportedChains, connectLedger: async () => {
    calls++; return { address: wallet.address, publicKey: wallet.publicKey };
  } });
  const xyra = new XyraAdapter({ supportedChains });
  (xyra as unknown as { popup: { request: (...args: any[]) => Promise<unknown> } }).popup.request = async (_method, payload) => {
    calls++; assert.equal(payload.network, "side-test-selector");
    return { address: wallet.address, publicKey: wallet.publicKey, network: payload.network };
  };
  for (const adapter of [gem, xaman, ledger, xyra]) {
    const result = await adapter.connect({ network, protocolContext: { network, protocol } });
    assert.equal(result.account.network?.id, network.id);
    if (adapter === ledger) assert.equal(result.session?.metadata?.requestedDeviceApp, "XAH");
    await adapter.disconnect();
  }
  assert.equal(calls, 4);
  for (const adapter of [gem, xaman, ledger, xyra]) {
    await assert.rejects(adapter.connect({ network: { ...network, providerHints: undefined },
      protocolContext: { network: { ...network, providerHints: undefined }, protocol } }), { code: "NETWORK_NOT_SUPPORTED" });
  }
  assert.equal(calls, 4, "Missing mapping must fail before provider prompts");
});
