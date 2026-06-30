# @xrpl-wallet-kit/next

Next.js helper exports for XRPL Wallet Kit.

This package keeps Next.js integrations pointed at the client-safe React bindings while allowing apps to depend on a Next-specific package name.

## Install

```bash
npm install @xrpl-wallet-kit/next @xrpl-wallet-kit/client
```

## Client Component Usage

```tsx
"use client";

import { createWalletKit } from "@xrpl-wallet-kit/client";
import { WalletKitProvider, WalletButton } from "@xrpl-wallet-kit/next";

const kit = createWalletKit({
  appName: "My XRPL App",
  network: "mainnet",
  autoReconnect: true,
  walletConnectProjectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID,
  ui: {
    accountPanel: {
      showBalance: true,
      showRecentTransactions: true,
    },
    toast: true,
  },
});

export function WalletConnectButton() {
  return (
    <WalletKitProvider manager={kit.manager}>
      <WalletButton />
    </WalletKitProvider>
  );
}
```

## App Router Notes

- Use this package from Client Components only.
- Prefix browser-exposed environment variables with `NEXT_PUBLIC_`.
- Keep auth verification and private API secrets in server routes.
- For Sign-In with XRPL, pair this package with `@xrpl-wallet-kit/auth`.

## Related

- `@xrpl-wallet-kit/react` - underlying React provider, hooks, and button
- `@xrpl-wallet-kit/client` - default wallet kit factory
- `@xrpl-wallet-kit/auth` - Sign-In with XRPL helpers
