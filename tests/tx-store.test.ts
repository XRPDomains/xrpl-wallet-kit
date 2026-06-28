import assert from "node:assert/strict";
import test from "node:test";
import { MemoryWalletStorage, WalletTransactionStore } from "../packages/core/src/index";

test("WalletTransactionStore persists, sorts, and caps transactions per account and network", async () => {
  const storage = new MemoryWalletStorage();
  const store = new WalletTransactionStore({ storage, max: 2 });

  await store.add("rAccount", "mainnet", { hash: "old", status: "submitted", submittedAt: 1 });
  await store.add("rAccount", "mainnet", { hash: "new", status: "confirmed", submittedAt: 2, confirmedAt: 4 });
  await store.add("rAccount", "mainnet", { hash: "middle", status: "failed", submittedAt: 3, failedAt: 3 });

  assert.deepEqual((await store.get("rAccount", "mainnet")).map((tx) => tx.hash), ["new", "middle"]);
  assert.deepEqual(await store.get("rAccount", "testnet"), []);
});

test("WalletTransactionStore marks stale submitted transactions as unknown", async () => {
  const storage = new MemoryWalletStorage();
  const store = new WalletTransactionStore({
    storage,
    staleSubmittedMs: 100,
    now: () => 500
  });

  await store.add("rAccount", "mainnet", { hash: "stale", status: "submitted", submittedAt: 1 });
  await store.add("rAccount", "mainnet", { hash: "fresh", status: "submitted", submittedAt: 450 });

  const transactions = await store.get("rAccount", "mainnet");

  assert.equal(transactions.find((tx) => tx.hash === "stale")?.status, "unknown");
  assert.equal(transactions.find((tx) => tx.hash === "fresh")?.status, "submitted");
});
