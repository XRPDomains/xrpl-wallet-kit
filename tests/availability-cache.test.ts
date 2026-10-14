import assert from "node:assert/strict";
import test from "node:test";
import { WalletManager } from "../packages/core/src/index";
import type { WalletAdapter } from "../packages/core/src/types";

function adapter(id: string, available: () => Promise<boolean>): WalletAdapter {
  return { metadata: { id, name: id, type: "extension" }, capabilities: { connect: true },
    isAvailable: available, connect: async () => { throw Error("No prompts in discovery"); } };
}

test("availability coalesces callers, caches results, supports refresh and returns isolated snapshots", async () => {
  let calls = 0;
  const manager = new WalletManager({ adapters: [adapter("one", async () => { calls++; return true; })] });
  const [first, second] = await Promise.all([manager.getWalletAvailability(), manager.getWalletAvailability()]);
  assert.equal(calls, 1);
  first.one = false;
  assert.equal(second.one, true);
  assert.equal((await manager.getWalletAvailability()).one, true);
  await manager.getWalletAvailability({ refresh: true });
  assert.equal(calls, 2);
  manager.destroy();
  assert.deepEqual(await manager.getWalletAvailability(), {});
});

test("replacing a wallet invalidates in-flight discovery and never returns obsolete results", async () => {
  let resolve!: (value: boolean) => void;
  const manager = new WalletManager({ adapters: [adapter("one", () => new Promise(done => { resolve = done; }))] });
  const pending = manager.getWalletAvailability();
  manager.unregister("one");
  manager.register(adapter("two", async () => true));
  resolve(true);
  assert.deepEqual(await pending, { two: true });
  assert.deepEqual((await manager.getAvailableWallets()).map(wallet => wallet.metadata.id), ["two"]);
  manager.destroy();
});
