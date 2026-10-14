import assert from "node:assert/strict";
import test from "node:test";
import { WalletManager, MemoryWalletStorage, sanitizeWalletUrl } from "../packages/core/src/index";
import { createWalletConnectAdapter } from "../packages/adapters/walletconnect/src/index";

test("restoration rejects an adapter returning an account different from the persisted identity", async () => {
  const storage = new MemoryWalletStorage();
  const session = { adapterId: "mock", account: { address: "rPlanted" }, connectedAt: 1 };
  await storage.setItem("session", JSON.stringify(session));
  const manager = new WalletManager({ autoReconnect: true, storage, logger: { level: "silent" }, adapters: [{
    metadata: { id: "mock", name: "Mock", type: "extension" }, capabilities: { connect: true },
    connect: async () => { throw Error("No prompts while restoring"); },
    restoreSession: async () => ({ account: { address: "rActual" }, session: { ...session, account: { address: "rActual" } } })
  }] });
  assert.equal(await manager.autoReconnect(), null);
  assert.equal(manager.getAccount(), null);
  manager.destroy();
});

test("WalletConnect requires classic addresses and selects the requested chain", () => {
  const adapter = createWalletConnectAdapter({ projectId: "test" }) as unknown as {
    extractAddress(session: unknown, network: unknown): string;
    sessionHasNetworkAccount(session: unknown, network: unknown, address?: string): boolean;
  };
  const network = { id: "mainnet", walletConnectChainId: "xrpl:0" };
  const valid = "rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh";
  const session = (accounts: string[]) => ({ namespaces: { xrpl: { accounts } } });
  assert.equal(adapter.extractAddress(session([`xrpl:1:${valid}`, `xrpl:0:${valid}`]), network), valid);
  for (const address of ["junk", valid + ":extra", "rWallet", "../../session"]) {
    assert.throws(() => adapter.extractAddress(session([`xrpl:0:${address}`]), network), /invalid XRPL/);
  }
  assert.throws(() => adapter.extractAddress(session([`xrpl:1:${valid}`]), network), /not found/);
  assert.equal(adapter.sessionHasNetworkAccount(session([`xrpl:0:junk:${valid}`]), network, valid), false);
  assert.equal(adapter.sessionHasNetworkAccount(session([`xrpl:1:${valid}`]), network, valid), false);
  assert.equal(adapter.sessionHasNetworkAccount(session([`xrpl:0:${valid}`]), network, valid), true);
});

test("wallet URLs reject arbitrary system/custom handlers but retain supported wallet deeplinks", () => {
  for (const scheme of ["web+unknown", "intent", "market", "ms-settings", "ms-calculator"]) {
    assert.equal(sanitizeWalletUrl(`${scheme}://payload`), undefined);
  }
  assert.equal(sanitizeWalletUrl("java\nscript:alert(1)"), undefined);
  for (const url of ["wc:pairing", "xaman://sign", "metamask://wc", "bitkeep://wc", "girin://wc", "bifrostwallet://wc", "/wallet.png"]) assert.equal(sanitizeWalletUrl(url), url);
});
