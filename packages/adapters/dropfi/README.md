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

- The adapter looks for an injected XRPL provider and can also accept a mock provider through options.
- `connect()` supports provider initialization, passive account reads, and provider-driven connect flows.
- `restoreSession()` is intentionally passive: it reads current provider state and returns `null` for unavailable or disconnected sessions.
- `disconnect()` is best-effort and bounded by a timeout so stale provider cleanup does not block the app.
- Transaction responses are normalized with `normalizeTxResult()`.

## Testing

Pass a mock provider for isolated tests:

```ts
import { assertWalletAdapter } from "@xrpl-wallet-kit/core";
import { createDropFiAdapter } from "@xrpl-wallet-kit/adapter-dropfi";

assertWalletAdapter(createDropFiAdapter({ provider: mockDropFi }));
```

## Links

- XRPL Wallet Kit: https://github.com/XRPDomains/xrpl-wallet-kit
