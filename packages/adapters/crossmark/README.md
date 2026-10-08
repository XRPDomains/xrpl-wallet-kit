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

## Package Preparation

Starting with 0.1.20, the prepared package bundles the pinned Crossmark SDK runtime, leaving
`@xrpl-wallet-kit/core` as its only runtime dependency. The SDK and its legacy
typings chain remain development dependencies. Public adapter types do not
re-export upstream SDK declarations.

Workspace `build` and this adapter's `build`/`prepack` run the preparation step.
Run a workspace build before packing; `prepack` requires existing compiled JS
and declarations. The step rejects unexpected bundled dependencies, unresolved
runtime imports, and upstream declaration imports, and retains the exact SDK
license. See `THIRD_PARTY_NOTICES.md` for the unresolved upstream license
discrepancy. Published versions are unchanged until an explicit release.

An isolated tarball consumer install, runtime/type smoke checks, dependency
audit, and redistribution review are still required before release. Do not
treat a source-level check as evidence that a published package is clean.

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
