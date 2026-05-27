# Adapter Checklist

## Metadata

- Adapter either omits `adapterApiVersion` or declares a compatible `1.x` version.
- `id` is lowercase, stable, unique, and has no spaces.
- `name` matches wallet branding.
- `type` is one of: `mobile`, `extension`, `walletconnect`, `snap`, `hardware`, `embedded`.
- `icon` is optimized, square, transparent or clean-background, and not app-specific.
- `group` is presentation metadata only, not business logic.

## Provider Boundary

- Adapter talks only to wallet provider, SDK, or transport.
- UI packages render QR, deeplink, loading, rejected, and error states.
- Business API calls stay outside the adapter.
- Adapter does not import React, Next, DOM modals, jQuery, or business app helpers.

## Session

- `connect()` returns `account.address`, network when known, and a `WalletSession` when useful.
- `connect(options)` honors `options.signal` when the provider/SDK supports abort or cancellation.
- `restoreSession()` returns `null` for normal stale/unavailable sessions.
- `disconnect()` clears provider session where possible and always runs cleanup.
- Events/listeners/timers are cleaned on disconnect/destroy.
- Redirect/mobile recovery markers use `WalletStorage` or core storage helpers, not direct `window.localStorage`.
- `cancelPendingConnection()` clears temporary markers, timers, popups, pending proposals, and local pending promises.

## Signing

- `signMessage()` result includes `signature`, `txBlob`, or `raw` depending on provider.
- `signTransaction()` is implemented only when `capabilities.signTransaction` is true and never submits to the network.
- `signTransaction()` result includes `txBlob`, `signed`, or `raw`.
- `signAndSubmit()` returns `hash`, `status`, `signed`, `rejected`, and/or `raw`.
- Successful submitted transactions expose `hash` when the provider returns one, so core can emit `tx_submitted` and WalletToast can show a transaction link.
- Provider-specific transaction response shapes are normalized with `normalizeTxResult()` or equivalent logic.
- Provider raw results are preserved under `raw`.
- Provider-specific payload conversions are documented.
- No private key or seed flow is introduced.

## Mobile And WalletConnect

- QR/deeplink URI is emitted through adapter/manager events.
- WalletConnect network paths validate `walletConnectChainId` at runtime and throw a clear configuration error when missing.
- Mobile return/focus behavior is considered.
- Reject/cancel/expired proposal does not leave UI connecting forever.
- Stale WalletConnect sessions are ignored or cleaned.

## Validation

- `assertWalletAdapter(adapter)` passes.
- Typecheck passes.
- Tests pass.
- Browser bundle builds if the adapter is included in browser/all-in-one flows.
- Manual smoke tests cover missing provider, installed provider, connect, reject, disconnect, and signing capabilities.
