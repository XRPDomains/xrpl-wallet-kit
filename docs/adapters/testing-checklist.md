# Adapter Testing Checklist

## Build and static checks

- [ ] `npm.cmd run typecheck`
- [ ] `npm.cmd test`
- [ ] `npm.cmd run build:browser`
- [ ] Fresh consumer TypeScript import resolves package types.

## Connect flow

- [ ] `isAvailable()` returns `false` when provider is missing.
- [ ] `connect()` returns `WalletSession` with `adapterId`, `account.address`, `connectedAt`, `wallet` metadata after manager enrichment.
- [ ] User cancellation emits a rejected/canceled error, not a hanging promise.
- [ ] `disconnect()` clears provider state where possible and manager state always resets.
- [ ] `restoreSession()` either restores a real usable session or returns `null` without throwing for normal stale sessions.

## Signing flow

- [ ] `signMessage()` works or capability is `false`.
- [ ] `signAndSubmit()` works for Payment.
- [ ] NFT offer create/accept/cancel works or `nftOffers` is not enabled.
- [ ] Rejection during signing throws a rejected/canceled error.
- [ ] Timeout/hanging provider does not freeze the UI indefinitely.

## Mobile and WalletConnect

- [ ] QR URI, Copy URI, and Open Wallet appear together when URI is ready.
- [ ] Deeplink opens the selected wallet on iOS/Android.
- [ ] Returning from wallet app updates connected state.
- [ ] Reject/cancel in wallet shows friendly retry UI.
- [ ] Back from custom QR returns to the expected wallet list/group.

## Security

- [ ] No private key, seed, secret, API key, or WalletConnect projectId is hardcoded.
- [ ] Adapter does not submit hidden transactions.
- [ ] Adapter does not mutate transaction fields silently except for documented wallet-specific requirements.
- [ ] Raw provider results are returned only under `raw` for debugging/integration.
