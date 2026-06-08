# XRPL Wallet Kit

Framework-agnostic wallet adapter toolkit for XRPL applications.

XRPL Wallet Kit provides a headless core, wallet adapters, a prebuilt wallet UI, React helpers, and a browser bundle for legacy HTML sites. It is designed for dApps that need wallet connection, account state, signing, payment, NFT, identity, and WalletConnect flows without coupling wallet logic to a specific business app.

## Packages

Core and UI:

- `@xrpl-wallet-kit/core`
- `@xrpl-wallet-kit/ui`
- `@xrpl-wallet-kit/client`
- `@xrpl-wallet-kit/browser`
- `@xrpl-wallet-kit/react`
- `@xrpl-wallet-kit/next`

Adapters:

- `@xrpl-wallet-kit/adapter-xaman`
- `@xrpl-wallet-kit/adapter-gemwallet`
- `@xrpl-wallet-kit/adapter-crossmark`
- `@xrpl-wallet-kit/adapter-dropfi`
- `@xrpl-wallet-kit/adapter-walletconnect`
- `@xrpl-wallet-kit/adapter-xrpl-snap`
- `@xrpl-wallet-kit/adapter-ledger`

## Install

```bash
npm install @xrpl-wallet-kit/client@beta
```

For React:

```bash
npm install @xrpl-wallet-kit/client@beta @xrpl-wallet-kit/react@beta
```

For plain HTML or legacy jQuery sites:

```bash
npm install @xrpl-wallet-kit/browser@beta
```

## Quick Start

```ts
import { createWalletKit } from "@xrpl-wallet-kit/client";

const kit = createWalletKit({
  appName: "My XRPL App",
  network: "mainnet",
  autoConnect: true,
  walletConnectProjectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID,
  ui: {
    themeMode: "light",
    layout: "list",
    walletConnectMode: "group",
    showWeb3Name: true,
    showBalance: true
  }
});

kit.button.mount("#connect-wallet");
```

## Browser Bundle

Use the IIFE bundle when an app cannot use a build step.
The IIFE bundle includes all adapters and is intentionally larger than package-level imports.
For production apps with Vite, webpack, or another bundler, prefer importing only the packages and adapters you use.

```html
<div id="connect-wallet"></div>
<script src="/vendor/xrpl-wallet-kit.iife.min.js"></script>
<script>
  const kit = window.XRPLWalletKit.createWalletKit({
    appName: "My XRPL App",
    network: "mainnet",
    autoConnect: true,
    walletConnectProjectId: "YOUR_PROJECT_ID",
    ui: {
      showWeb3Name: true,
      showBalance: true
    }
  });

  kit.button.mount("#connect-wallet");
</script>
```

## React Usage

```tsx
import { createWalletKit } from "@xrpl-wallet-kit/client";
import { WalletKitProvider, WalletButton } from "@xrpl-wallet-kit/react";

const kit = createWalletKit({
  appName: "My XRPL App",
  network: "mainnet",
  walletConnectProjectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID,
  autoConnect: true
});

export function App() {
  return (
    <WalletKitProvider manager={kit.manager}>
      <WalletButton />
    </WalletKitProvider>
  );
}
```

## WalletConnect Modes

- `default`: one WalletConnect entry, using the official WalletConnect modal.
- `list`: show supported WalletConnect wallets as normal wallet items.
- `group`: show one WalletConnect entry, then let users choose a supported wallet.

## Transaction Toasts

Enable built-in transaction notifications with `ui.toast: true`, or pass an object for `position`, `maxVisible`, `autoDismissMs`, and `explorerUrl`.

The built-in confirmer is intentionally best-effort. When a submitted hash is available, the kit polls briefly through the network HTTP RPC URL. If the result is confirmed, the toast updates to confirmed; if the result is inconclusive, it stays submitted and provides a `View` link to the configured explorer.

## Environment

```env
VITE_WALLETCONNECT_PROJECT_ID=
VITE_XAMAN_CLIENT_ID=
```

`WalletConnect projectId` must be provided by the integrating app. No private key, seed, or wallet secret belongs in the SDK or frontend config.

## Development

```powershell
npm.cmd install
npm.cmd run typecheck
npm.cmd test
npm.cmd run build:browser
```

## Status

`0.1.0-beta.0` is the first public beta target. APIs are intended to be stable enough for integration testing, but may still change before `1.0.0`.
