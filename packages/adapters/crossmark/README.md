# @xrpl-wallet-kit/adapter-crossmark

Crossmark adapter for XRPL Wallet Kit.

Crossmark is an XRPL browser extension wallet. This adapter wraps `@crossmarkio/sdk` and maps Crossmark connection, message signing, and transaction methods into the XRPL Wallet Kit adapter contract.

## Capabilities

- `connect`
- `signMessage`
- `signAndSubmit`
- `payments`
- `nftOffers`

## Install

```bash
npm install @xrpl-wallet-kit/adapter-crossmark
```

## Usage

```ts
import { createWalletKit } from "@xrpl-wallet-kit/client";
import { createCrossmarkAdapter } from "@xrpl-wallet-kit/adapter-crossmark";

const kit = createWalletKit({
  adapters: [createCrossmarkAdapter()]
});
```

When using `@xrpl-wallet-kit/client` defaults, Crossmark is already included.

## Runtime Notes

- Requires the Crossmark browser extension.
- Availability checks require the SDK install signal and `signInAndWait`.
- `connect()` uses Crossmark sign-in and returns the selected XRPL account.
- `signAndSubmit()` chooses the Crossmark method by `methodHint` and normalizes transaction results with `normalizeTxResult()`.
- Provider-specific errors should still surface as rejected/canceled/timeout messages so the UI can recover cleanly.

## Testing

Pass a mock provider for isolated tests:

```ts
import { assertWalletAdapter } from "@xrpl-wallet-kit/core";
import { createCrossmarkAdapter } from "@xrpl-wallet-kit/adapter-crossmark";

assertWalletAdapter(createCrossmarkAdapter({ provider: mockCrossmark }));
```

## Links

- Crossmark: https://crossmark.io
- XRPL Wallet Kit: https://github.com/XRPDomains/xrpl-wallet-kit
