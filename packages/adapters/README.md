# XRPL Wallet Kit Adapters

Official wallet adapters for XRPL Wallet Kit.

Each adapter implements the `@xrpl-wallet-kit/core` `WalletAdapter` contract and declares only the capabilities it supports. Apps usually consume these through `@xrpl-wallet-kit/client`, but adapters can also be imported directly for headless or custom UI integrations.

## Packages

| Package | Wallet | Notes |
| --- | --- | --- |
| `@xrpl-wallet-kit/adapter-xaman` | Xaman | QR/push flows, transaction submission, SignIn-style signed transaction proofs. |
| `@xrpl-wallet-kit/adapter-gemwallet` | GemWallet | Extension wallet with compact signatures, payment, TrustSet, NFT offers, and NFTokenBurn routing. |
| `@xrpl-wallet-kit/adapter-crossmark` | Crossmark | Extension wallet with compact signatures and transaction submission. |
| `@xrpl-wallet-kit/adapter-dropfi` | DropFi | Extension/mobile injected provider with compact signatures and passive auto reconnect. |
| `@xrpl-wallet-kit/adapter-walletconnect` | WalletConnect | Generic adapter plus built-in XRPL WalletConnect wallet profiles. |
| `@xrpl-wallet-kit/adapter-xrpl-snap` | XRPL Snap | MetaMask Snap integration with transaction-style message proofs. |
| `@xrpl-wallet-kit/adapter-ledger` | Ledger | Hardware signing through WebHID/WebUSB. |
| `@xrpl-wallet-kit/adapter-otsu` | Otsu Wallet | Community extension adapter scaffolded from the adapter developer contract. |

## Direct Usage

```ts
import { WalletManager, MAINNET } from "@xrpl-wallet-kit/core";
import { createGemWalletAdapter } from "@xrpl-wallet-kit/adapter-gemwallet";
import { createXamanAdapter } from "@xrpl-wallet-kit/adapter-xaman";

const manager = new WalletManager({
  network: MAINNET,
  adapters: [
    createGemWalletAdapter(),
    createXamanAdapter({
      apiKey: import.meta.env.VITE_XAMAN_CLIENT_ID,
    }),
  ],
});
```

## Adapter Rules

- `restoreSession()` must be passive and must not open wallet UI.
- `signMessage()` must return a normalized proof with `signatureKind`.
- Wallet-specific payload conversions must happen inside the adapter, not in app code.
- Submitted transaction responses should expose a hash when the wallet provides one so `WalletManager` can emit transaction lifecycle events and update recent transactions.
- Provider-specific quirks must be documented in the adapter README.

## Creating New Adapters

Use the repository skill at `skills/xrpl-wallet-kit-adapter-developer` and the adapter contract docs in `docs/adapters/adapter-contract.md`.
