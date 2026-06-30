# @xrpl-wallet-kit/react

React bindings for XRPL Wallet Kit.

This package provides a provider, hooks, and a React `WalletButton` wrapper around the framework-agnostic wallet manager and UI.

## Install

```bash
npm install @xrpl-wallet-kit/react @xrpl-wallet-kit/client
```

## Setup

```tsx
import { createWalletKit } from "@xrpl-wallet-kit/client";
import { WalletKitProvider, WalletButton } from "@xrpl-wallet-kit/react";

const kit = createWalletKit({
  appName: "My XRPL App",
  network: "mainnet",
  autoReconnect: true,
  walletConnectProjectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID,
  ui: {
    accountPanel: {
      showBalance: true,
      showRecentTransactions: true,
    },
    toast: true,
  },
});

export function App() {
  return (
    <WalletKitProvider manager={kit.manager}>
      <WalletButton />
    </WalletKitProvider>
  );
}
```

## Hooks

```tsx
import {
  useWalletAccount,
  useWalletCapabilities,
  useWalletKit,
  useWalletSession,
  useWalletStatus,
} from "@xrpl-wallet-kit/react";

function AccountState() {
  const status = useWalletStatus();
  const account = useWalletAccount();
  const capabilities = useWalletCapabilities();

  return (
    <pre>
      {JSON.stringify({ status, account, capabilities }, null, 2)}
    </pre>
  );
}
```

Status values:

- `disconnected`
- `connecting`
- `connected`

The provider syncs connection, account, network, stale session, expired session, and transaction-related manager events so consumers re-render from wallet state changes.

## Notes

- Create the wallet kit once at module scope or inside a stable app-level initializer.
- Use `@xrpl-wallet-kit/client` for the default adapter/UI wiring.
- Use `@xrpl-wallet-kit/core` directly only when building a custom integration.
