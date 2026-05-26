# Adapter Checklist

## Metadata

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
- `restoreSession()` returns `null` for normal stale/unavailable sessions.
- `disconnect()` clears provider session where possible and always runs cleanup.
- Events/listeners/timers are cleaned on disconnect/destroy.

## Signing

- `signMessage()` result includes `signature`, `txBlob`, or `raw` depending on provider.
- `signAndSubmit()` returns `hash`, `status`, `signed`, `rejected`, and/or `raw`.
- Provider-specific payload conversions are documented.
- No private key or seed flow is introduced.

## Mobile And WalletConnect

- QR/deeplink URI is emitted through adapter/manager events.
- Mobile return/focus behavior is considered.
- Reject/cancel/expired proposal does not leave UI connecting forever.
- Stale WalletConnect sessions are ignored or cleaned.

## Validation

- Typecheck passes.
- Tests pass.
- Browser bundle builds if the adapter is included in browser/all-in-one flows.
- Manual smoke tests cover missing provider, installed provider, connect, reject, disconnect, and signing capabilities.

