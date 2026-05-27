# @xrpl-wallet-kit/adapter-gemwallet

GemWallet adapter for XRPL Wallet Kit.

GemWallet is an XRPL browser extension wallet. This adapter wraps the `@gemwallet/api` package and normalizes account, message signing, payment, and NFT offer results into the XRPL Wallet Kit adapter contract.

## Capabilities

- `connect`
- `signMessage`
- `signAndSubmit`
- `payments`
- `nftOffers`

## Install

```bash
npm install @xrpl-wallet-kit/adapter-gemwallet
```

## Usage

```ts
import { createWalletKit } from "@xrpl-wallet-kit/client";
import { createGemWalletAdapter } from "@xrpl-wallet-kit/adapter-gemwallet";

const kit = createWalletKit({
  adapters: [createGemWalletAdapter()]
});
```

When using `@xrpl-wallet-kit/client` defaults, GemWallet is already included.

## Runtime Notes

- Requires the GemWallet browser extension.
- Availability is detected with `provider.isInstalled()`.
- `connect()` reads the active extension address and network.
- `signAndSubmit()` routes by `methodHint`:
  - `payment` -> `sendPayment`
  - `createNFTOffer` -> `createNFTOffer`
  - `acceptNFTOffer` -> `acceptNFTOffer`
  - `cancelNFTOffer` -> `cancelNFTOffer`
- Transaction responses are normalized with `normalizeTxResult()` so submitted hashes can drive lifecycle events and WalletToast.

## Testing

Pass a mock provider for isolated tests:

```ts
import { assertWalletAdapter } from "@xrpl-wallet-kit/core";
import { createGemWalletAdapter } from "@xrpl-wallet-kit/adapter-gemwallet";

assertWalletAdapter(createGemWalletAdapter({ provider: mockGemWallet }));
```

## Links

- GemWallet: https://gemwallet.app
- XRPL Wallet Kit: https://github.com/XRPDomains/xrpl-wallet-kit
