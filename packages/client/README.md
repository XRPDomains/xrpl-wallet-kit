# @xrpl-wallet-kit/client

All-in-one XRPL Wallet Kit client for browser dApps.

This package creates the wallet manager, official adapters, modal UI, connect button, identity resolver, balance display, transaction toast, and recent transaction wiring from one configuration object.

## Install

```bash
npm install @xrpl-wallet-kit/client
```

For React apps, also install `@xrpl-wallet-kit/react`.

```bash
npm install @xrpl-wallet-kit/client @xrpl-wallet-kit/react
```

## Quick Start

```ts
import { createWalletKit } from "@xrpl-wallet-kit/client";

const kit = createWalletKit({
  appName: "My XRPL App",
  network: "mainnet",
  autoReconnect: true,
  walletConnectProjectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID,
  connectButton: "#connect-wallet",
  ui: {
    themeMode: "light",
    walletConnect: { mode: "default" },
    accountPanel: {
      showBalance: true,
      showAddressQr: true,
      showRecentTransactions: true,
      maxVisibleTransactions: 5,
    },
    toast: true,
  },
});
```

`walletConnect.mode: "default"` uses the official WalletConnect AppKit modal. Use `"list"` or `"group"` when you want XRPL Wallet Kit to render its custom wallet list and QR/deeplink panel.

## Selecting Wallets

```ts
const kit = createWalletKit({
  wallets: ["xaman", "gemwallet", "dropfi", "walletconnect"],
  walletConnectProjectId: "...",
  connectButton: "#connect-wallet",
});
```

Available built-in ids:

- `xaman`
- `gemwallet`
- `crossmark`
- `dropfi`
- `walletconnect`
- `xrpl-snap` or `xrplsnap`
- `ledger`
- `otsu`

## Signing

```ts
const signed = await kit.signMessage({
  message: "Sign in to My XRPL App",
});

const submitted = await kit.signAndSubmit({
  txJson: {
    TransactionType: "Payment",
    Account: kit.getSession()?.account.address,
    Destination: "r...",
    Amount: "1000000",
  },
});
```

The client delegates to the active adapter. Apps do not need to branch by wallet id for supported methods.

## Recent Transactions

When `showRecentTransactions` is enabled, `manager.signAndSubmit()` records submitted transactions with a returned hash and the account panel can show compact rows with status, relative time, and an explorer link.

```ts
kit.manager.addTransaction({
  hash: "A1B2...",
  status: "submitted",
  account: kit.getSession()?.account,
});
```

## WalletConnect Sign Message Destination

Some WalletConnect wallets use a non-submitted transaction proof for message signing. Pass `walletConnectSignMessageDestination` when you want that proof transaction to use a known destination instead of the default.

```ts
createWalletKit({
  walletConnectProjectId: "...",
  walletConnectSignMessageDestination: "r...",
});
```

## Related

- `@xrpl-wallet-kit/core` - headless manager and adapter contract
- `@xrpl-wallet-kit/ui` - modal, button, inline picker, and toast
- `@xrpl-wallet-kit/browser` - IIFE bundle for HTML/legacy apps
