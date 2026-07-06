import assert from "node:assert/strict";
import test from "node:test";
import { createWalletClient, createWalletKit } from "../packages/client/src/index";
import type { WalletManager } from "../packages/core/src/manager";
import type { WalletAdapter } from "../packages/core/src/types";

function getAdapterOption(manager: WalletManager, adapterId: string, key: string): unknown {
  const adapter = manager.adapters.get(adapterId) as unknown as { options?: Record<string, unknown> } | undefined;
  return adapter?.options?.[key];
}

test("createWalletClient forwards WalletConnect sign message destination to default adapter", () => {
  const manager = createWalletClient({
    appName: "Test dApp",
    walletConnectProjectId: "test-project",
    walletConnectSignMessageDestination: "rDestinationForMessageProof",
    ui: {
      walletConnect: {
        mode: "default"
      }
    }
  });

  assert.equal(getAdapterOption(manager, "walletconnect", "signMessageDestination"), "rDestinationForMessageProof");
});

test("createWalletClient uses WalletConnect AppKit mode by default", () => {
  const manager = createWalletClient({
    appName: "Test dApp",
    walletConnectProjectId: "test-project"
  });

  assert.deepEqual([...manager.adapters.keys()].filter((id) => id === "walletconnect"), ["walletconnect"]);
  assert.equal(getAdapterOption(manager, "walletconnect", "useModal"), true);
  assert.equal(getAdapterOption(manager, "walletconnect", "modalMode"), "always");
});

test("createWalletClient accepts xrpl-snap wallet id alias", () => {
  const manager = createWalletClient({
    appName: "Test dApp",
    wallets: ["xrpl-snap"]
  });

  assert.deepEqual([...manager.adapters.keys()], ["xrplsnap"]);
});

test("createWalletClient keeps canonical xrplsnap wallet id working", () => {
  const manager = createWalletClient({
    appName: "Test dApp",
    wallets: ["xrplsnap"]
  });

  assert.deepEqual([...manager.adapters.keys()], ["xrplsnap"]);
});

test("createWalletClient forwards WalletConnect sign message destination to detail adapters", () => {
  const manager = createWalletClient({
    appName: "Test dApp",
    walletConnectProjectId: "test-project",
    walletConnectSignMessageDestination: "rDestinationForMessageProof",
    ui: {
      walletConnect: {
        mode: "list"
      }
    }
  });

  assert.equal(getAdapterOption(manager, "bitget", "signMessageDestination"), "rDestinationForMessageProof");
  assert.equal(getAdapterOption(manager, "joey", "signMessageDestination"), "rDestinationForMessageProof");
  assert.equal(getAdapterOption(manager, "girin", "signMessageDestination"), "rDestinationForMessageProof");
});

test("createWalletKit exposes subscribe as an event alias", async () => {
  const adapter = createMockAdapter();
  const kit = createWalletKit({
    appName: "Test dApp",
    adapters: [adapter],
    modal: false
  });
  const connected: string[] = [];

  const unsubscribe = kit.subscribe("connected", (event) => {
    connected.push(event.account.address);
  });

  await kit.manager.connect("mock");
  unsubscribe();
  await kit.manager.disconnect();

  assert.deepEqual(connected, ["rMockAddress"]);
});

test("createWalletKit subscribe can track state snapshots", async () => {
  const adapter = createMockAdapter();
  const kit = createWalletKit({
    appName: "Test dApp",
    adapters: [adapter],
    modal: false
  });
  const statuses: string[] = [];

  const unsubscribe = kit.subscribe((snapshot) => {
    statuses.push(`${snapshot.eventName ?? "initial"}:${snapshot.status}`);
  });

  await kit.manager.connect("mock");
  await kit.manager.disconnect();
  unsubscribe();

  assert.deepEqual(statuses, [
    "initial:disconnected",
    "connecting:connecting",
    "connected:connected",
    "disconnected:disconnected"
  ]);
});

function createMockAdapter(): WalletAdapter {
  return {
    metadata: {
      id: "mock",
      name: "Mock Wallet",
      type: "extension"
    },
    capabilities: {
      connect: true,
      disconnect: true
    },
    connect: async () => ({
      account: {
        address: "rMockAddress"
      }
    }),
    disconnect: async () => {}
  };
}
