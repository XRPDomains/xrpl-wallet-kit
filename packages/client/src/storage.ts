import { createBrowserWalletStorage, getNetworkFamily, isLegacyNetwork } from "@xrpl-wallet-kit/core";
import type { WalletNetwork, WalletStorage } from "@xrpl-wallet-kit/core";

export function resolveClientStorage(storage: WalletStorage | "localStorage" | "memory" | undefined, network: WalletNetwork): WalletStorage | undefined {
  if (storage !== "localStorage") return storage === "memory" ? undefined : storage;
  const scoped = createBrowserWalletStorage(`xrpl-wallet-kit.${encodeURIComponent(getNetworkFamily(network))}.${encodeURIComponent(network.id)}.`);
  const legacy = createBrowserWalletStorage();
  const marker = "legacy-session-migrated-v1";
  return {
    async getItem(key) {
      const current = await scoped.getItem(key);
      if (key !== "session" || current !== null || !isLegacyNetwork(network) || await scoped.getItem(marker)) return current;
      // Mark even failed migration attempts so a later disconnect cannot revive the legacy session.
      await scoped.setItem(marker, "1");
      const raw = await legacy.getItem("session");
      if (!raw) return null;
      try {
        const parsed = JSON.parse(raw);
        const session = parsed.version === undefined ? parsed : parsed.version === 1 ? parsed.session : undefined;
        const previous = session?.account?.network;
        if (!previous || previous.id !== network.id || getNetworkFamily(previous) !== getNetworkFamily(network)
          || previous.networkId !== network.networkId || previous.networkType !== network.networkType
          || previous.rpcUrl !== network.rpcUrl || previous.httpRpcUrl !== network.httpRpcUrl) return null;
      } catch { return null; }
      // Migration is not authentication; the manager still verifies the provider on restore.
      await scoped.setItem(key, raw);
      return raw;
    },
    async setItem(key, value) {
      if (key === "session") await scoped.setItem(marker, "1");
      await scoped.setItem(key, value);
    },
    async removeItem(key) {
      if (key === "session") await scoped.setItem(marker, "1");
      await scoped.removeItem(key);
    }
  };
}
