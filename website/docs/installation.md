# Installation

## Prerequisites

- Node.js 18 or later
- TypeScript 5.0 or later (if using TypeScript)
- A bundler (Vite, webpack, Rollup) — **recommended for production**
- Or a plain HTML page — use the [IIFE bundle](#plain-html--legacy) instead

## Recommended: Modular Install

Install the core and only the adapters your app needs:

::: code-group
```sh [npm]
# Core (required)
npm install @xrpl-wallet-kit/core

# UI components (optional — skip if building your own UI)
npm install @xrpl-wallet-kit/ui

# Adapters — install only what you need
npm install @xrpl-wallet-kit/adapter-xaman
npm install @xrpl-wallet-kit/adapter-gemwallet
npm install @xrpl-wallet-kit/adapter-walletconnect
```
```sh [yarn]
yarn add @xrpl-wallet-kit/core
yarn add @xrpl-wallet-kit/ui
yarn add @xrpl-wallet-kit/adapter-xaman
yarn add @xrpl-wallet-kit/adapter-gemwallet
yarn add @xrpl-wallet-kit/adapter-walletconnect
```
```sh [pnpm]
pnpm add @xrpl-wallet-kit/core
pnpm add @xrpl-wallet-kit/ui
pnpm add @xrpl-wallet-kit/adapter-xaman
pnpm add @xrpl-wallet-kit/adapter-gemwallet
pnpm add @xrpl-wallet-kit/adapter-walletconnect
```
:::

All available adapters:

| Package | Wallet |
|---|---|
| `@xrpl-wallet-kit/adapter-xaman` | Xaman (mobile) |
| `@xrpl-wallet-kit/adapter-gemwallet` | GemWallet (extension) |
| `@xrpl-wallet-kit/adapter-walletconnect` | WalletConnect v2 |
| `@xrpl-wallet-kit/adapter-crossmark` | Crossmark (extension) |
| `@xrpl-wallet-kit/adapter-ledger` | Ledger hardware wallet |
| `@xrpl-wallet-kit/adapter-dropfi` | DropFi (extension + mobile) |
| `@xrpl-wallet-kit/adapter-xrpl-snap` | XRPL Snap (MetaMask) |
| `@xrpl-wallet-kit/adapter-otsu` | Otsu Wallet |

## All-in-One Client Package

If you want everything in one install:

::: code-group
```sh [npm]
npm install @xrpl-wallet-kit/client
```
```sh [yarn]
yarn add @xrpl-wallet-kit/client
```
```sh [pnpm]
pnpm add @xrpl-wallet-kit/client
```
:::

The client package re-exports core, ui, and all adapters. Bundlers will tree-shake unused adapters automatically.

## React / Next.js

::: code-group
```sh [React]
npm install @xrpl-wallet-kit/react @xrpl-wallet-kit/client
```
```sh [Next.js]
npm install @xrpl-wallet-kit/next @xrpl-wallet-kit/client
```
:::

See the [React guide](/docs/frameworks/react) or [Next.js guide](/docs/frameworks/next) for setup instructions.

## Sign-In with Wallet (Auth)

::: code-group
```sh [npm]
npm install @xrpl-wallet-kit/auth
```
```sh [yarn]
yarn add @xrpl-wallet-kit/auth
```
```sh [pnpm]
pnpm add @xrpl-wallet-kit/auth
```
:::

Server-side peer dependencies (install on your backend only):

```sh
npm install ripple-keypairs verify-xrpl-signature xrpl
```

## HTML (Legacy / CDN)

For pages that cannot use a bundler, load the IIFE bundle from a CDN or copy it to your server:

```html
<!-- From CDN (pinned to the current stable release) -->
<script src="https://cdn.jsdelivr.net/npm/@xrpl-wallet-kit/browser@0.1.3/dist/xrpl-wallet-kit.iife.min.js"></script>

<!-- Or host it yourself -->
<script src="/assets/xrpl-wallet-kit.iife.min.js"></script>
```

The bundle exposes a global `XRPLWalletKit` object:

```js
const { createWalletKit, createXamanAdapter } = XRPLWalletKit;
```

::: warning Bundle size
The IIFE bundle is large because it includes all adapters and polyfills. For production sites, prefer the modular install with a bundler.
:::

See the [HTML Legacy / CDN guide](/docs/frameworks/legacy-cdn) for a complete example.

## TypeScript

All packages ship full TypeScript declarations. No `@types/` package needed.

```ts
import type { WalletManager, WalletSession, WalletAccount } from "@xrpl-wallet-kit/core";
```

## Environment Variables

Some adapters require credentials. Add them to your `.env` file (never commit secrets):

::: code-group
```bash [Vite]
# .env.local
VITE_WALLETCONNECT_PROJECT_ID=your_project_id_here
VITE_XAMAN_CLIENT_ID=your_xaman_client_id_here
```
```bash [Next.js]
# .env.local
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id_here
NEXT_PUBLIC_XAMAN_CLIENT_ID=your_xaman_client_id_here
```
:::

Get your WalletConnect Project ID at [cloud.walletconnect.com](https://cloud.walletconnect.com).  
Get your Xaman Client ID at [apps.xaman.dev](https://apps.xaman.dev).
