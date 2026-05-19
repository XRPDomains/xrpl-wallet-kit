export * from "@xrpname/wallet-core";
export * from "@xrpname/wallet-adapter-crossmark";
export * from "@xrpname/wallet-adapter-dropfi";
export * from "@xrpname/wallet-adapter-gemwallet";
export * from "@xrpname/wallet-adapter-ledger";
export * from "@xrpname/wallet-adapter-walletconnect";
export * from "@xrpname/wallet-adapter-xaman";
export * from "@xrpname/wallet-adapter-xrpl-snap";
export * from "@xrpname/wallet-ui";

import { WalletManager, createBrowserWalletStorage } from "@xrpname/wallet-core";
import type { WalletAdapter, WalletManagerConfig } from "@xrpname/wallet-core";

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
