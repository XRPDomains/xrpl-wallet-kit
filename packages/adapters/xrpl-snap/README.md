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
- Default snap id is `npm:xrpl-snap`.
- `connect()` calls `wallet_requestSnaps` and then invokes the snap to fetch the XRPL account.
- `signMessage()` uses a transaction-style proof flow because Snap message-signing support can vary.
- `signAndSubmit()` invokes the snap and normalizes the result with `normalizeTxResult()`.

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
