import assert from "node:assert/strict";
import test from "node:test";
import { createWalletClient } from "../packages/client/src/index";
import type { WalletManager } from "../packages/core/src/manager";

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
