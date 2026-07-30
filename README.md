# XRPL Wallet Kit

Framework-agnostic wallet adapter toolkit for XRPL applications.

XRPL Wallet Kit provides a headless core, wallet adapters, a prebuilt wallet UI, React helpers, and a browser bundle for legacy HTML sites. It is designed for dApps that need wallet connection, account state, signing, payment, NFT, identity, and WalletConnect flows without coupling wallet logic to a specific business app.

For detailed guides, framework examples, configuration options, and adapter notes, see the documentation site: https://xrpdomains.xyz/xrpl-wallet-kit/

Useful links:

- Documentation: https://xrpdomains.xyz/xrpl-wallet-kit/
- Playground: https://xrpdomains.xyz/xrpl-wallet-kit/playground
- Theme Builder: https://xrpdomains.xyz/xrpl-wallet-kit/docs/theme-builder

## Features

- Framework agnostic: use the headless manager from Vanilla JS, React, Next.js, Vue, Nuxt, or legacy HTML apps.
- Multi-wallet by default: Xaman, GemWallet, Crossmark, DropFi, WalletConnect detail wallets, XRPL Snap, Ledger, and community adapters.
- Adapter-based architecture: install only the packages you need, or use the all-in-one client/browser bundle.
- Prebuilt wallet UI: connect modal, account panel, QR/deeplink flows, transaction toast, recent transactions, balance, identity, and theme presets.
- Event-driven core: subscribe to connection, account, network, session, and transaction lifecycle events.
- Persistent sessions: best-effort auto reconnect with guarded recovery for browser extensions, Xaman, and WalletConnect.
- Auth-ready signing: normalized `signMessage()` and `@xrpl-wallet-kit/auth` helpers for server verification.
- Type safe: TypeScript-first packages with explicit adapter capabilities and typed wallet results.

## What's Included

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

## Architecture

XRPL Wallet Kit is split into small packages so apps can choose between a batteries-included setup and direct low-level control.

```text
Your dApp
  |
  |-- @xrpl-wallet-kit/client
  |     |-- WalletManager from @xrpl-wallet-kit/core
  |     |-- WalletModal / WalletButton from @xrpl-wallet-kit/ui
  |     `-- first-party wallet adapters
  |
  |-- @xrpl-wallet-kit/react / @xrpl-wallet-kit/next
  |
  `-- @xrpl-wallet-kit/browser for CDN and legacy HTML apps

WalletManager
  |-- session storage
  |-- event emitter
  |-- transaction store
  |-- identity and balance helpers
  `-- adapters
        |-- Xaman
        |-- GemWallet
        |-- Crossmark
        |-- DropFi
        |-- WalletConnect
        |-- XRPL Snap
        `-- Ledger
```

Most applications should start with `@xrpl-wallet-kit/client`. Advanced integrations can compose `@xrpl-wallet-kit/core`, `@xrpl-wallet-kit/ui`, and individual adapters directly.

## Install

```bash
npm install @xrpl-wallet-kit/client
```

For React:

```bash
npm install @xrpl-wallet-kit/client @xrpl-wallet-kit/react
```

For Legacy HTML sites:

```bash
npm install @xrpl-wallet-kit/browser
```

## Quick Start

See the full quick start and examples in the docs: https://xrpdomains.xyz/xrpl-wallet-kit/docs/quick-start

```ts
import { createWalletKit } from "@xrpl-wallet-kit/client";

const kit = createWalletKit({
  metadata: {
    name: "My XRPL App",
    description: "Wallet connection for My XRPL App",
    url: window.location.origin,
    icons: [`${window.location.origin}/icon.png`]
  },
  network: "mainnet",
  autoReconnect: true,
  walletConnectProjectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID,
  ui: {
    themeMode: "light",
    layout: "list",
    walletConnect: { mode: "default" },
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
    metadata: {
      name: "My XRPL App",
      description: "Wallet connection for My XRPL App",
      url: window.location.origin,
      icons: [window.location.origin + "/icon.png"]
    },
    network: "mainnet",
    autoReconnect: true,
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
  metadata: {
    name: "My XRPL App",
    description: "Wallet connection for My XRPL App",
    url: window.location.origin,
    icons: [`${window.location.origin}/icon.png`]
  },
  network: "mainnet",
  walletConnectProjectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID,
  autoReconnect: true
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

- `default`: one WalletConnect entry using the official WalletConnect AppKit modal. This is the client default.
- `list`: show supported WalletConnect wallets as normal wallet items, using the kit custom QR/deeplink panel.
- `group`: show one WalletConnect entry, then let users choose a supported wallet, using the kit custom QR/deeplink panel.

## Transaction Toasts

Enable built-in transaction notifications with `ui.toast: true`, or pass an object for `position`, `maxVisible`, `autoDismissMs`, and `explorerUrl`.

The built-in confirmer is intentionally best-effort. When a submitted hash is available, the kit polls briefly through the network HTTP RPC URL. If the result is confirmed, the toast updates to confirmed; if the result is inconclusive, it stays submitted and provides a `View` link to the configured explorer.

## Recent Transactions

Enable account panel transaction history with `ui.accountPanel.showRecentTransactions: true`. The manager automatically records transactions submitted through `signAndSubmit()` when a hash is returned, and apps can register custom flows with `manager.addTransaction()`.

```ts
const kit = createWalletKit({
  connectButton: "#connect-wallet",
  ui: {
    accountPanel: {
      showRecentTransactions: true,
      maxVisibleTransactions: 5
    }
  }
});
```

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

## Acknowledgments

XRPL Wallet Kit learns from and is inspired by excellent wallet connection projects across the Web3 ecosystem:

- [XRPL Connect](https://github.com/XRPL-Commons/xrpl-connect) by XRPL Commons for XRPL wallet connection patterns and community-first documentation.
- [RainbowKit](https://www.rainbowkit.com/) for wallet onboarding, authentication documentation, and account UX ideas.
- [ConnectKit](https://github.com/family/connectkit) for polished wallet connection UI patterns.
- [WalletConnect](https://walletconnect.com/) and Reown AppKit for cross-wallet session and QR/deeplink flows.
- [Solana Wallet Adapter](https://github.com/anza-xyz/wallet-adapter) for adapter-based wallet architecture.

Thanks to the XRPL wallet teams and community projects that make wallet interoperability possible.

## Status

Current npm release: use the `latest` dist-tag unless your app needs a pinned version.

`0.1.0` was the first stable public release. APIs are ready for real integrations, while the project remains pre-`1.0.0` and may still make carefully documented breaking changes before the long-term stable API.
