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
- `restoreSession()` is passive-only. It reads the current SDK address from `sync.getAddress()` or the SDK session snapshot and restores only when it matches the stored session address.
- `restoreSession()` never calls `signInAndWait()` because sign-in opens an interactive wallet flow.
- `signAndSubmit()` chooses the Crossmark method by `methodHint` and normalizes transaction results with `normalizeTxResult()`.
- Provider-specific errors should still surface as rejected/canceled/timeout messages so the UI can recover cleanly.

## Auto Reconnect

Crossmark restore uses SDK state that is already available after reload. The adapter first checks `sync.getAddress()`, then falls back to the SDK session snapshot address. If neither address exists, or the address differs from the stored session, restore returns `null`.

This keeps Crossmark aligned with the core adapter contract: core manages storage and events, while the adapter proves whether the current wallet provider still owns the stored account. Interactive sign-in remains part of `connect()`, not `restoreSession()`.

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
