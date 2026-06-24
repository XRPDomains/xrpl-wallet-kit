# Introduction

**XRPL Wallet Kit** is a framework-agnostic wallet adapter toolkit for building XRPL browser dApps. It provides a unified API across all major XRPL wallets, a headless DOM-based UI, and optional prebuilt components — so you can ship a wallet connection flow in minutes, not days.

## Why XRPL Wallet Kit?

Each XRPL wallet has its own JavaScript API: Xaman uses OAuth + deep links, GemWallet injects a browser extension, WalletConnect uses a relay protocol, Ledger talks to USB hardware. Without an abstraction layer, your dApp must implement and maintain a different integration for every wallet — and break whenever a wallet updates its API.

XRPL Wallet Kit solves this with a **uniform adapter contract**:

```ts
adapter.connect(options)      // → ConnectResult
adapter.signTransaction(req)  // → { txBlob, hash }
adapter.signAndSubmit(req)    // → { hash, ... }
adapter.signMessage(req)      // → { signature }
adapter.disconnect()
```

Every adapter speaks the same language. Your app talks to the manager; the manager talks to the adapters.

## Architecture

```
Your dApp
    │
    ▼
WalletManager          ← orchestrates adapters, sessions, events
    │
    ├── XamanAdapter
    ├── GemWalletAdapter
    ├── WalletConnectAdapter
    ├── CrossmarkAdapter
    ├── LedgerAdapter
    ├── DropfiAdapter
    ├── XrplSnapAdapter
    └── OtsuAdapter
```

The **core** package contains the manager, types, errors, and storage logic. It has zero dependencies on any UI framework. The **ui** package adds a DOM-based modal and connect button. The **adapters** are separate packages — install only what you need.

## Supported Wallets

| Wallet | Package | Type | connect | sign | signAndSubmit |
|---|---|---|:---:|:---:|:---:|
| Xaman | `adapter-xaman` | Mobile QR / OAuth | ✅ | ✅ | ✅ |
| GemWallet | `adapter-gemwallet` | Browser Extension | ✅ | ✅ | ✅ |
| WalletConnect | `adapter-walletconnect` | Multi-wallet QR | ✅ | ✅ | ✅ |
| Crossmark | `adapter-crossmark` | Browser Extension | ✅ | ✅ | ✅ |
| Ledger | `adapter-ledger` | Hardware (USB/HID) | ✅ | ✅ | — |
| DropFi | `adapter-dropfi` | Extension + Mobile App | ✅ | ✅ | ✅ |
| XRPL Snap | `adapter-xrpl-snap` | MetaMask Snap | ✅ | ✅ | ✅ |
| Otsu Wallet | `adapter-otsu` | Browser Extension | ✅ | ✅ | ✅ |

## Package Overview

| Package | Size (gzip) | Description |
|---|---|---|
| `@xrpl-wallet-kit/core` | ~5.7 KB | Headless core, WalletManager, types |
| `@xrpl-wallet-kit/ui` | ~12 KB | DOM modal, connect button |
| `@xrpl-wallet-kit/client` | umbrella | core + ui + all adapters |
| `@xrpl-wallet-kit/browser` | 528 KB | IIFE bundle for plain HTML |

::: tip
For production apps using a bundler (Vite, webpack), import from individual packages so tree-shaking removes unused adapters.  
The IIFE bundle includes everything and is intended for quick prototyping or legacy HTML pages.
:::

## Supported Frameworks

XRPL Wallet Kit has no React dependency. The headless core works with any JavaScript environment.

| Framework | Guide |
|---|---|
| React | [React guide](/docs/frameworks/react) |
| Next.js | [Next.js guide](/docs/frameworks/next) |
| Vue 3 | [Vue 3 guide](/docs/frameworks/vue) |
| Nuxt 3 | [Nuxt 3 guide](/docs/frameworks/nuxt) |
| Vanilla TypeScript | [Vanilla TS guide](/docs/frameworks/vanilla) |
| Plain HTML / CDN | [HTML legacy guide](/docs/frameworks/html-legacy) |

## Next Steps

- [Installation](/docs/installation) — install the packages
- [Quick Start](/docs/quick-start) — connect your first wallet in 5 minutes
- [Adapters](/docs/adapters/overview) — pick the wallets you want to support
- [Theming](/docs/configuration/theming) — customize colors, fonts, and layout
