# @xrpl-wallet-kit/adapter-walletconnect

WalletConnect adapter for XRPL Wallet Kit.

This package provides the generic XRPL WalletConnect adapter plus built-in wallet profiles for supported XRPL WalletConnect wallets.

## Capabilities

- `connect`
- `disconnect`
- `signMessage` when enabled and supported by the wallet
- `signTransaction`
- `signAndSubmit`
- `payments`
- `nftOffers`
- `qr`
- `deeplink`

## Install

```bash
npm install @xrpl-wallet-kit/adapter-walletconnect
```

## Usage

```ts
import { createWalletKit } from "@xrpl-wallet-kit/client";
import { createWalletConnectAdapters } from "@xrpl-wallet-kit/adapter-walletconnect";

const kit = createWalletKit({
  adapters: [
    ...createWalletConnectAdapters({
      projectId: "YOUR_WALLETCONNECT_PROJECT_ID"
    })
  ]
});
```

When using `@xrpl-wallet-kit/client` defaults, WalletConnect adapters are created from `walletConnectProjectId`.

## Runtime Notes

- Requires a WalletConnect project id.
- `walletConnectChainId` is optional on a network object, but WalletConnect paths validate it at runtime and throw a clear configuration error if it is missing.
- Custom QR/deeplink flows are emitted through the manager/UI event path.
- Pending return recovery markers use `WalletStorage` through `recoveryStorage`.
- `signTransaction()` signs without submit when the connected wallet supports the method.
- `signAndSubmit()` normalizes provider responses with `normalizeTxResult()`.

## Wallet Profiles

The package includes profiles for the currently supported XRPL WalletConnect wallets in `src/wallets.ts`. Use `createWalletConnectAdapters({ wallets: [...] })` to limit the generated detail adapters.

## Testing

Use mock `SignClient` sessions for unit tests and verify:

- generated namespaces include the expected XRPL chain id;
- QR/deeplink events are emitted;
- stale sessions return `null`;
- disconnect clears WalletConnect sessions and pending state.
- request-time stale proposal/key/pairing failures are treated as stale WalletConnect state. The adapter best-effort clears the session and pairings, then asks the user to reconnect instead of surfacing low-level SignClient key errors.

## Links

- WalletConnect: https://walletconnect.com
- XRPL Wallet Kit: https://github.com/XRPDomains/xrpl-wallet-kit
