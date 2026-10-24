# Introduction

**XRPL Wallet Kit** is a framework-agnostic wallet adapter toolkit for building XRPL and Xahau browser dApps. It provides a unified connection and transaction API, a headless core, and optional DOM-based UI components.

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
    ├── JoeyWalletAdapter (opt-in)
    ├── WalletConnectAdapter
    ├── CrossmarkAdapter
    ├── LedgerAdapter
    ├── DropfiAdapter
    ├── XrplSnapAdapter
    ├── GhostsigAdapter (opt-in)
    └── XyraAdapter (opt-in)
```

The **core** package contains the manager, types, errors, and storage logic. It has zero dependencies on any UI framework. The **ui** package adds a DOM-based modal and connect button. The **adapters** are separate packages — install only what you need.

## Supported Wallets

The table below covers XRPL. The [Xahau integration](/docs/configuration/xahau) in v0.2.0
uses a chain-filtered subset with its own transaction scope and wallet configuration.

| Wallet | Package | Type | connect | sign | signAndSubmit |
|---|---|---|:---:|:---:|:---:|
| Xaman | `adapter-xaman` | Mobile QR / OAuth | ✅ | ✅ | ✅ |
| GemWallet | `adapter-gemwallet` | Browser Extension | ✅ | ✅ | ✅ |
| [Joey Wallet](/docs/adapters/joey-wallet) | `adapter-joey-wallet` | Browser Extension (opt-in) | ✅ | ✅ | ✅ |
| WalletConnect | `adapter-walletconnect` | Multi-wallet QR | ✅ | ✅ | ✅ |
| Crossmark | `adapter-crossmark` | Browser Extension | ✅ | ✅ | ✅ |
| Ledger | `adapter-ledger` | Hardware (USB/HID) | ✅ | ✅ | ✅ |
| DropFi | `adapter-dropfi` | Extension + Mobile App | ✅ | ✅ | ✅ |
| XRPL Snap | `adapter-xrpl-snap` | MetaMask Snap | ✅ | ✅ | ✅ |
| [GhostSig](/docs/adapters/ghostsig) | `adapter-ghostsig` | Hosted web / popup (opt-in) | ✅ | ✅ | ✅ |
| [Xyra](/docs/adapters/xyra) | `adapter-xyra` | Hosted web / popup (opt-in) | ✅ | ✅ | ✅ |

[Joey Wallet](/docs/adapters/joey-wallet) connects directly to Joey's
browser extension on XRPL Mainnet, Testnet and Devnet. Enable
`wallets: ["joey-wallet"]` or use `createJoeyWalletAdapter()` explicitly.
The separate `joey` entry continues to use WalletConnect. Extension support
includes passive restore and transaction signing with or without submission;
it does not expose `signMessage()` or Xahau.

GhostSig is published starting in **v0.1.20**. It supports transaction signing
and submission, including Payment and NFT offers, but not `signMessage()`.
Enable it explicitly with `wallets: ["ghostsig"]` or `createGhostsigAdapter()`;
the default client list and `wallets: "all"` do not include it.

[Xyra](/docs/adapters/xyra) supports XRPL mainnet/testnet connection and
transaction signing with or without submission. Add `createXyraAdapter()`
explicitly to your manager's `adapters`. It does not support `signMessage()`
or passive session restore. The sign column above refers to transaction signing;
see the [capability matrix](/docs/adapters/overview#capability-matrix) for message signing.

## Package Overview

| Package | Description |
|---|---|
| `@xrpl-wallet-kit/core` | Headless core, WalletManager, types |
| `@xrpl-wallet-kit/ui` | DOM modal, connect button |
| `@xrpl-wallet-kit/client` | All-in-one client with adapters and automatic Xahau configuration |
| `@xrpl-wallet-kit/browser` | IIFE bundle for plain HTML, with a separately loaded Xahau runtime |
| `@xrpl-wallet-kit/xahau` | Xahau protocol and network presets for core/selective integration |

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
| Plain HTML / CDN | [HTML legacy guide](/docs/frameworks/legacy-cdn) |

## Experimental Batch Integration

Version **0.1.21** adds opt-in, single-account **All-or-Nothing Batch**
preparation, inner-transaction preflight and per-operation confirmation tracking.
Applications can group 2-8 operations while retaining the existing signing API.
Enable compatible wallets explicitly. See [Batch Transactions](/docs/configuration/batch)
for scope, examples and integration requirements.

## Next Steps

- [Installation](/docs/installation) — install the packages
- [Quick Start](/docs/quick-start) — connect your first wallet in 5 minutes
- [Adapters](/docs/adapters/overview) — pick the wallets you want to support
- [Xahau](/docs/configuration/xahau) — configure Xahau wallets, payments, Hooks and URITokens
- [Theming](/docs/configuration/theming) — customize colors, fonts, and layout
