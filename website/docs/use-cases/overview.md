# Use Cases

XRPL Wallet Kit is designed for browser dApps that need wallet connection, signing, and transaction submission across the XRPL wallet ecosystem. This page maps common product patterns to the kit APIs and configuration areas you will use most often.

Use this as a shareable overview when planning an integration, onboarding a new developer, or deciding which wallet flows your dApp needs to support.

## Use Case Map

| Use case | What users do | Main kit surface | Start here |
|---|---|---|---|
| Payments & Commerce | Send XRP, IOU tokens, exchange deposits, and cross-currency payments | `signAndSubmit`, `showBalance`, recent transactions | [Payments & Commerce](/docs/use-cases/payments) |
| NFT Marketplace | Mint, list, accept, cancel, and burn XLS-20 NFTs | `signAndSubmit`, transaction lifecycle events | [NFT Marketplace](/docs/use-cases/nft-marketplace) |
| DEX & AMM | Place offers, cancel offers, add liquidity, remove liquidity, and route swaps | `signAndSubmit`, custom transaction builders | [DEX & AMM](/docs/use-cases/dex-amm) |
| Cross-chain Bridge | Sign XRPL-side bridge transactions while an external SDK handles the destination chain | `signAndSubmit`, memos, destination tags | [Cross-chain Bridge](/docs/use-cases/bridge) |
| Sign In with XRPL | Authenticate users with wallet proofs instead of passwords | `@xrpl-wallet-kit/auth`, `signMessage` | [Authentication](/docs/auth/introduction) |
| Account UX | Show connected account, balance, address QR, identity, and recent transactions | `WalletButton`, account panel config | [Connect Button](/docs/configuration/connect-button) |
| Wallet Selection | Offer Xaman, GemWallet, WalletConnect, Ledger, XRPL Snap, and extension wallets | adapters, WalletConnect modes, metadata | [Adapter Overview](/docs/adapters/overview) |

## Product Patterns

### Payment and Checkout

Use XRPL Wallet Kit when your app needs a direct wallet payment flow without custody. Typical examples include checkout pages, creator payments, membership fees, tip jars, and exchange-style deposits.

Recommended docs:

- [Payments & Commerce](/docs/use-cases/payments)
- [Recent Transactions](/docs/configuration/recent-transactions)
- [Networks](/docs/configuration/networks)

### NFT Marketplaces

Use the kit to collect wallet signatures for native XLS-20 transactions. Your marketplace still owns listing discovery, metadata indexing, image hosting, and offer state, while the kit handles wallet-specific signing behavior.

Recommended docs:

- [NFT Marketplace](/docs/use-cases/nft-marketplace)
- [WalletManager API](/docs/api/wallet-manager)
- [Events & Hooks](/docs/advanced/events-hooks)

### Trading and Liquidity Apps

DEX and AMM interfaces usually build transactions from market data fetched with `xrpl.js` or an indexer. XRPL Wallet Kit should sit at the signing boundary: your app prepares the `txJson`, the wallet signs and submits it.

Recommended docs:

- [DEX & AMM](/docs/use-cases/dex-amm)
- [Headless Core](/docs/advanced/headless)
- [Bundle & Performance](/docs/advanced/bundle-performance)

### Bridge Frontends

Bridge products normally combine XRPL-side signing with a protocol-specific bridge SDK. Use the kit for XRPL transactions such as `Payment`, `EscrowCreate`, or `XChainCommit`; keep destination-chain claim logic in the bridge integration layer.

Recommended docs:

- [Cross-chain Bridge](/docs/use-cases/bridge)
- [Going Live](/docs/guides/going-live)
- [Errors](/docs/api/errors)

### Wallet-based Authentication

Use Sign In with XRPL when users should prove control of an XRPL account before accessing an app, dashboard, profile editor, marketplace account, or API session.

Recommended docs:

- [Sign In with XRPL](/docs/auth/introduction)
- [Next.js Integration](/docs/auth/nextjs)
- [Custom Backend](/docs/auth/custom-backend)

## Choosing the Integration Style

| App type | Recommended package path | Why |
|---|---|---|
| React or Next.js app | `@xrpl-wallet-kit/react` or `@xrpl-wallet-kit/next` | Framework-friendly provider and hooks |
| Vite / Vue / vanilla TypeScript app | `@xrpl-wallet-kit/client` or individual packages | Good balance of convenience and bundling control |
| Plain HTML or legacy app | `@xrpl-wallet-kit/browser` | Single IIFE script, no build step |
| Custom design system | `@xrpl-wallet-kit/core` plus adapters | Full control over UI and state management |

## What the Kit Does Not Own

XRPL Wallet Kit intentionally focuses on wallet integration. Your app remains responsible for:

- fetching ledger data, order books, NFT metadata, and bridge state;
- validating business rules before creating transactions;
- indexing historical activity beyond the kit's recent transaction UI;
- server-side authentication sessions and nonce storage;
- compliance, risk checks, and production monitoring.

## Next Steps

- [Quick Start](/docs/quick-start) - connect a wallet in a minimal app
- [Playground](/docs/playground) - test wallet flows in the browser
- [Theme Builder](/docs/theme-builder) - tune UI tokens before integrating
- [Adapter Overview](/docs/adapters/overview) - choose supported wallets
