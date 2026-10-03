import assert from "node:assert/strict";
import test from "node:test";
import { registerWallet } from "@wallet-standard/wallet";
import { WalletManager, startWalletStandardDiscovery, createWalletStandardWallet } from "../packages/core/src/index";

test("official event handshake discovers wallets on both sides of app startup without fixed provider globals", () => {
  const prior = globalThis.window;
  Object.defineProperty(globalThis, "window", { configurable: true, value: new EventTarget(), writable: true });
  const network = { id: "testnet", name: "Testnet", networkType: "TESTNET", rpcUrl: "wss://example.invalid", walletConnectChainId: "xrpl:1" } as const;
  let prompts = 0;
  const makeWallet = (id: string) => createWalletStandardWallet({ metadata: { id, name: id, type: "extension" }, capabilities: { connect: true },
    connect: async () => { prompts++; return { account: { address: "rExample", network } }; }
  }, { networks: [network], icon: "data:image/png;base64,YQ==" });
  const kit = new WalletManager({ logger: { level: "silent" } });
  try {
    registerWallet(makeWallet("before"));
    const discovery = startWalletStandardDiscovery(kit);
    assert.deepEqual(kit.getWallets().map(wallet => wallet.name), ["before"]);
    registerWallet(makeWallet("after"));
    assert.deepEqual(kit.getWallets().map(wallet => wallet.name), ["before", "after"]);
    assert.equal(prompts, 0);
    discovery.dispose();
    registerWallet(makeWallet("later"));
    assert.equal(kit.getWallets().length, 0);
  } finally {
    kit.destroy();
    if (prior === undefined) delete (globalThis as { window?: unknown }).window;
    else globalThis.window = prior;
  }
});
