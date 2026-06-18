# @xrpl-wallet-kit/adapter-walletconnect

WalletConnect adapter for XRPL Wallet Kit.

This package provides the generic XRPL WalletConnect adapter plus built-in wallet profiles for supported XRPL WalletConnect wallets.

## Capabilities

- `connect`
- `disconnect`
- `signMessage` via legacy transaction proof (`xrpl_signTransaction` with `submit: false`)
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
- WalletConnect `signMessage` intentionally uses the legacy transaction-proof path: `xrpl_signTransaction` with `submit: false` and the message encoded in a Memo. This avoids unreliable `xrpl_signMessage` responses observed in some XRPL WalletConnect wallets.
- Pass `signMessageDestination` (or `walletConnectSignMessageDestination` through `@xrpl-wallet-kit/client`) so the non-submitted proof transaction does not self-send to the connected account.

## Wallet Profiles

The package includes profiles for the currently supported XRPL WalletConnect wallets in `src/wallets.ts`. Use `createWalletConnectAdapters({ wallets: [...] })` to limit the generated detail adapters.

Built-in detail profiles enable `signMessage` only when the legacy transaction-proof flow has been verified:

| Wallet | signMessage default | Notes |
| --- | --- | --- |
| Bifrost Wallet | enabled | Verified with legacy `xrpl_signTransaction` + `submit: false`. Payment, trust line, and common NFT offer flows work; `NFTokenBurn` is not supported over WalletConnect in current testing. |
| Joey | enabled | Verified with legacy `xrpl_signTransaction` + `submit: false`. Payment, trust line, NFT offer, and `NFTokenBurn` flows work in current testing. |
| Bitget Wallet | disabled | Message signing is disabled because the proof request can be treated as a real Payment; Payment, trust line, NFT offer, and `NFTokenBurn` flows work in current testing. |
| Girin Wallet | disabled | Message signing is not supported; Payment, trust line, NFT offer, and `NFTokenBurn` flows work in current testing. |
| StaticBit | disabled | Observed signing error: `Scalar is not in the interval [1,n - 1]`; QR scanning is sensitive to dark QR contrast, so the UI provides a Light QR toggle for custom QR flows. |

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
