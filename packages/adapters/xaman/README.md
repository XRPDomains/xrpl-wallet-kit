# @xrpl-wallet-kit/adapter-xaman

Xaman adapter for XRPL Wallet Kit.

Xaman is a mobile XRPL wallet. This adapter uses the Xaman SDK / OAuth PKCE flow, emits QR and deeplink connection payloads through XRPL Wallet Kit, and supports mobile return recovery.

## Capabilities

- `connect`
- `signMessage`
- `signAndSubmit`
- `payments`
- `nftOffers`
- `qr`
- `deeplink`

## Install

```bash
npm install @xrpl-wallet-kit/adapter-xaman
```

## Usage

```ts
import { createWalletKit } from "@xrpl-wallet-kit/client";
import { createXamanAdapter } from "@xrpl-wallet-kit/adapter-xaman";

const kit = createWalletKit({
  adapters: [
    createXamanAdapter({
      apiKey: "YOUR_XAMAN_API_KEY"
    })
  ],
  autoReconnect: true
});
```

When using `@xrpl-wallet-kit/client` defaults, Xaman is already included when configured through the client options.

## Runtime Notes

- Requires a Xaman API key or injected test SDK/auth objects.
- Connection and signing may produce QR/deeplink flows. The adapter reports those through the manager/UI event path.
- Pending mobile-return recovery markers use `WalletStorage` through the adapter's `recoveryStorage` option.
- `restoreSession()` and `recoverSession()` are best-effort and return `null` for normal stale or unavailable sessions.

## Testing

Use `assertWalletAdapter(createXamanAdapter({ ... }))` in adapter tests. For deterministic tests, pass mock `auth`, `sdk`, and `recoveryStorage` objects instead of using live Xaman services.

## Links

- Xaman: https://xaman.app
- XRPL Wallet Kit: https://github.com/XRPDomains/xrpl-wallet-kit
