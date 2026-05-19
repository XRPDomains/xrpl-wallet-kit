# XRPL Wallet Kit

Framework-agnostic wallet adapter toolkit for XRPL apps.

XRPL Wallet Kit provides a headless core, wallet adapters, and optional prebuilt UI for browser-based XRPL dApps. It is designed to work with plain HTML, React, Next.js, and custom application shells while keeping wallet logic separate from product-specific business logic.

## Packages

Core packages:

- `@xrpl-wallet-kit/core`
- `@xrpl-wallet-kit/ui`
- `@xrpl-wallet-kit/react`
- `@xrpl-wallet-kit/next`
- `@xrpl-wallet-kit/client`

Wallet adapters:

- `@xrpl-wallet-kit/adapter-xaman`
- `@xrpl-wallet-kit/adapter-gemwallet`
- `@xrpl-wallet-kit/adapter-crossmark`
- `@xrpl-wallet-kit/adapter-walletconnect`
- `@xrpl-wallet-kit/adapter-dropfi`
- `@xrpl-wallet-kit/adapter-xrpl-snap`
- `@xrpl-wallet-kit/adapter-ledger`

`@xrpl-wallet-kit/client` is the convenience package for apps that want one import surface. Apps that care about bundle size can install only the core, UI, and adapters they need.

## Design Goals

- Headless core with no UI or application dependency.
- Adapter-based architecture for wallet-specific behavior.
- Optional prebuilt UI with list, icon, and card layouts.
- WalletConnect support with default, list, and grouped UX strategies.
- Event-driven connection, QR, signing, rejection, and error flows.
- Session and storage management with optional auto-reconnect.
- Mainnet, testnet, devnet, and custom XRPL network support.
- No private keys, seeds, or application secrets in SDK code.

## Quick Start

```ts
import {
  WalletManager,
  createBrowserWalletStorage,
  createWalletModal,
  createGemWalletAdapter,
  createCrossmarkAdapter,
  createWalletConnectAdapters
} from "@xrpl-wallet-kit/client";

const manager = new WalletManager({
  appName: "My XRPL App",
  network: "mainnet",
  autoReconnect: true,
  storage: createBrowserWalletStorage("my-app.wallet."),
  adapters: [
    createGemWalletAdapter(),
    createCrossmarkAdapter(),
    ...createWalletConnectAdapters({
      projectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID,
      mode: "details",
      wallets: "all"
    })
  ]
});

const modal = createWalletModal({
  manager,
  layout: "list",
  themeMode: "light"
});

document.querySelector("#connect")?.addEventListener("click", () => {
  modal.open();
});
```

## WalletConnect UX

WalletConnect can be integrated in three common ways:

- `default`: show one WalletConnect item and let the official WalletConnect modal handle wallet selection and QR rendering.
- `list`: show supported WalletConnect wallets as normal wallet items.
- `group`: show one WalletConnect item, then drill into the supported WalletConnect wallets.

Adapter creation is controlled by `createWalletConnectAdapters()`:

```ts
createWalletConnectAdapters({
  projectId,
  mode: "default"
});

createWalletConnectAdapters({
  projectId,
  mode: "details",
  wallets: "all"
});
```

The preview app maps this into `WalletConnect mode`: `default`, `list`, and `group`.

## Session Data

Connected sessions include both account data and wallet display metadata:

```ts
const session = manager.getSession();

console.log(session?.account.address);
console.log(session?.wallet?.name);
console.log(session?.wallet?.icon);
```

The `session.metadata` field is reserved for adapter/session technical data such as WalletConnect topics.

## Local Preview

Copy `.env.example` to `.env.local` and set:

```env
VITE_WALLETCONNECT_PROJECT_ID=
VITE_XAMAN_CLIENT_ID=
```

Run:

```powershell
npm.cmd install
npm.cmd run dev:vanilla
```

Open:

```text
http://127.0.0.1:5173/
```

## Development

```powershell
npm.cmd run typecheck
npm.cmd run build
```

## Status

This repository is in early development. Package names and APIs may change before the first public npm release.
