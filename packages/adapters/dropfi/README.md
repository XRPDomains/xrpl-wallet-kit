# @xrpl-wallet-kit/adapter-dropfi

DropFi adapter for XRPL Wallet Kit.

DropFi is an injected XRPL wallet provider. This adapter detects the provider, normalizes connection state, and maps message signing plus transaction submission into the XRPL Wallet Kit adapter contract.

## Capabilities

- `connect`
- `disconnect`
- `signMessage`
- `signAndSubmit`
- `payments`
- `nftOffers`

## Install

```bash
npm install @xrpl-wallet-kit/adapter-dropfi
```

## Usage

```ts
import { createWalletKit } from "@xrpl-wallet-kit/client";
import { createDropFiAdapter } from "@xrpl-wallet-kit/adapter-dropfi";

const kit = createWalletKit({
  adapters: [createDropFiAdapter()]
});
```

When using `@xrpl-wallet-kit/client` defaults, DropFi is already included.

## Runtime Notes

- The adapter looks for DropFi in this order: an explicit `provider` option, `window.__xwk_dropfi`, `window.dropfi`, then the legacy `window.xrpl` namespace.
- The legacy `window.xrpl` fallback is accepted only when it exposes DropFi-like wallet fields. This avoids treating the standard `xrpl.js` browser global as a wallet provider.
- `connect()` supports provider initialization, passive account reads, and provider-driven connect flows.
- `restoreSession()` is intentionally passive: it reads current provider state and restores only when the passive address matches the stored session address.
- `isConnected() === false` is not treated as final during reload hydration when a matching passive address is already available.
- `disconnect()` is best-effort and bounded by a timeout so stale provider cleanup does not block the app.
- Transaction responses are normalized with `normalizeTxResult()`.

## Auto Reconnect

DropFi can expose account state through multiple passive surfaces, including `selectedAddress`, connected account arrays, and address getters. The adapter uses those passive address signals to verify a stored session after reload.

Some injected providers report `isConnected() === false` briefly while the extension is hydrating, even though the selected address is already available. For that reason, a matching passive address is the restore authority. A missing or mismatched address still returns `null`.

`restoreSession()` does not call `connect()`, open wallet UI, or request user approval.

## Testing

Pass a mock provider for isolated tests:

```ts
import { assertWalletAdapter } from "@xrpl-wallet-kit/core";
import { createDropFiAdapter } from "@xrpl-wallet-kit/adapter-dropfi";

assertWalletAdapter(createDropFiAdapter({ provider: mockDropFi }));
```

## Links

- XRPL Wallet Kit: https://github.com/XRPDomains/xrpl-wallet-kit
