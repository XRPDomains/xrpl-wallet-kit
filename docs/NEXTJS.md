# Next.js Usage

Use the package only in a client component because wallet providers, local storage, and QR UI are browser concerns.

```tsx
"use client";

import { useMemo } from "react";
import { WalletManager, createBrowserWalletStorage } from "@xrpname/wallet-core";
import { createGemWalletAdapter } from "@xrpname/wallet-adapter-gemwallet";
import { XrplWalletProvider } from "@xrpname/wallet-next";

export function WalletProviders({ children }: { children: React.ReactNode }) {
  const manager = useMemo(
    () =>
      new WalletManager({
        appName: "Next XRPL dApp",
        network: "mainnet",
        autoReconnect: true,
        storage: createBrowserWalletStorage(),
        adapters: [createGemWalletAdapter()]
      }),
    []
  );

  return <XrplWalletProvider manager={manager}>{children}</XrplWalletProvider>;
}
```

Do not instantiate browser wallet adapters in server components.
