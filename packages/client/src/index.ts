export * from "@xrpl-wallet-kit/core";
export * from "@xrpl-wallet-kit/adapter-crossmark";
export * from "@xrpl-wallet-kit/adapter-dropfi";
export * from "@xrpl-wallet-kit/adapter-gemwallet";
export * from "@xrpl-wallet-kit/adapter-ledger";
export * from "@xrpl-wallet-kit/adapter-walletconnect";
export * from "@xrpl-wallet-kit/adapter-xaman";
export * from "@xrpl-wallet-kit/adapter-xrpl-snap";
export * from "@xrpl-wallet-kit/ui";

import { WalletManager, createBrowserWalletStorage } from "@xrpl-wallet-kit/core";
import type { WalletAdapter, WalletManagerConfig } from "@xrpl-wallet-kit/core";

export interface CreateXrplWalletKitOptions extends Omit<WalletManagerConfig, "adapters" | "storage"> {
  adapters: WalletAdapter[];
  storage?: WalletManagerConfig["storage"] | "localStorage" | "memory";
}

export function createXrplWalletKit(options: CreateXrplWalletKitOptions): WalletManager {
  return new WalletManager({
    ...options,
    storage: options.storage === "localStorage" ? createBrowserWalletStorage() : options.storage === "memory" ? undefined : options.storage
  });
}
