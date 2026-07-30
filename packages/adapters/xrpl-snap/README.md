# @xrpl-wallet-kit/adapter-xrpl-snap

MetaMask XRPL Snap adapter for XRPL Wallet Kit.

This adapter uses the EIP-1193 `ethereum.request()` interface to install/invoke an XRPL Snap and expose it through the XRPL Wallet Kit adapter contract.

## Capabilities

- `connect`
- `signMessage`
- `signAndSubmit`
- `payments`
- `nftOffers`

## Install

```bash
npm install @xrpl-wallet-kit/adapter-xrpl-snap
```

## Usage

```ts
import { createWalletKit } from "@xrpl-wallet-kit/client";
import { createXrplSnapAdapter } from "@xrpl-wallet-kit/adapter-xrpl-snap";

const kit = createWalletKit({
  adapters: [createXrplSnapAdapter()]
});
```

When using `@xrpl-wallet-kit/client` defaults, the XRPL Snap adapter is already included.

## Runtime Notes

- Requires MetaMask with Snaps support.
- `isAvailable()` verifies Snaps support with `wallet_getSnaps`; providers that expose `window.ethereum` but do not support Snaps are treated as unavailable.
- When multiple browser wallets are installed, the adapter prefers a MetaMask provider from `window.ethereum.providers` or EIP-6963 before falling back to `window.ethereum`. EIP-6963 announcements are cached so MetaMask can still be selected when wallets such as OKX own `window.ethereum`.
- Default snap id is `npm:xrpl-snap`.
- `connect()` calls `wallet_requestSnaps` and then invokes the snap to fetch the XRPL account.
- `signMessage()` uses a transaction-style proof flow because Snap message-signing support can vary.
- `signAndSubmit()` invokes the snap and normalizes the result with `normalizeTxResult()`.

If you see `the method wallet_requestSnaps does not exist/is not available`, the active provider is not a MetaMask Snaps-capable provider. Use MetaMask desktop with Snaps enabled, and check that another injected wallet such as OKX is not taking over `window.ethereum`.

## Testing

Pass a mock EIP-1193 provider for isolated tests:

```ts
import { assertWalletAdapter } from "@xrpl-wallet-kit/core";
import { createXrplSnapAdapter } from "@xrpl-wallet-kit/adapter-xrpl-snap";

assertWalletAdapter(createXrplSnapAdapter({ ethereum: mockEthereum }));
```

## Links

- MetaMask Snaps: https://metamask.io/snaps/
- XRPL Wallet Kit: https://github.com/XRPDomains/xrpl-wallet-kit
