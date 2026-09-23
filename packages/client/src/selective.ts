export * from "@xrpl-wallet-kit/core";
export * from "@xrpl-wallet-kit/ui";

import { WalletManager, createBrowserWalletStorage } from "@xrpl-wallet-kit/core";
import type { WalletAdapter, WalletManagerConfig } from "@xrpl-wallet-kit/core";

export interface CreateSelectiveWalletClientOptions extends Omit<WalletManagerConfig, "adapters" | "storage"> {
  adapters: WalletAdapter[];
  storage?: WalletManagerConfig["storage"] | "localStorage" | "memory";
}

export function createWalletClient(options: CreateSelectiveWalletClientOptions): WalletManager {
  const { storage, ...managerOptions } = options;
  return new WalletManager({
    ...managerOptions,
    storage: storage === "localStorage"
      ? createBrowserWalletStorage()
      : storage === "memory"
        ? undefined
        : storage
  });
}

export const createXrplWalletKit = createWalletClient;
