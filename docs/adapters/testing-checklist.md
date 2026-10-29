# Adapter Testing Checklist

## Build and static checks

- [ ] `npm.cmd run typecheck`
- [ ] `npm.cmd test`
- [ ] `npm.cmd run build:browser`
- [ ] Adapter passes `assertWalletAdapter(adapter)`.
- [ ] Adapter runs the [conformance suite](./conformance.md) with isolated provider fixtures and reviews every skipped scenario.
- [ ] Fresh consumer TypeScript import resolves package types.

## Contract v1

- [ ] `adapterApiVersion` is omitted or compatible with `1.x`.
- [ ] `metadata.id` is stable lowercase and unique.
- [ ] `metadata.name`, `metadata.type`, and `capabilities.connect` are valid.
- [ ] Enabled capabilities have matching implemented methods.
- [ ] `recoverSession()` is implemented only with `canRecoverSession()`.

## Connect flow

- [ ] `isAvailable()` returns `false` when provider is missing.
- [ ] `connect()` returns `WalletSession` with `adapterId`, `account.address`, `connectedAt`, `wallet` metadata after manager enrichment.
- [ ] User cancellation emits a rejected/canceled error, not a hanging promise.
- [ ] `disconnect()` clears provider state where possible and manager state always resets.
- [ ] `restoreSession()` is passive-only and never opens connect/sign-in/QR/deeplink/hardware approval UI.
- [ ] `restoreSession()` verifies a current provider address or equivalent passive account signal before returning a restored session.
- [ ] `restoreSession()` returns `null` when the passive address is missing or differs from the stored session address.
- [ ] Protocol-backed restore uses the manager's network/runtime, verifies provider network identity, and rejects missing context or canceled results before activating signing state.
- [ ] `restoreSession()` returns `null` without throwing for normal stale, unavailable, locked, or not-yet-hydrated sessions.
- [ ] If an adapter intentionally omits `restoreSession()`, README explains that autoReconnect requires manual reconnect.
- [ ] `WalletManager.autoReconnect()` emits `session_restored` and `connected` for the adapter when restore succeeds.

## Chain-aware networks (unreleased foundation)

- [ ] Test omitted criteria, explicit empty lists, empty filters and disjoint intersections; none can broaden support.
- [ ] Test AND semantics for mixed `supportedNetworks` / `supportedChains`, including empty legacy lists.
- [ ] Unsupported connect/restore/recovery/switch/sign operations do not invoke the provider.
- [ ] Unsupported switch targets return `NETWORK_NOT_SUPPORTED` for legacy, new and combined declarations.
- [ ] Chain-aware connect/restore/recovery results and supplied sessions include verified `account.network`.
- [ ] Chain-aware account/network events include verified network identity; missing identity revokes the session with `NETWORK_MISMATCH`.
- [ ] Unsupported network events revoke the session with `NETWORK_NOT_SUPPORTED`; pending signatures cannot complete afterward.
- [ ] Provider authorization loss uses `emitDisconnected(adapterId)`; no fabricated network from requested/cached state.
- [ ] Standard wallet chains map through registered presets, not prefix-derived families, and preserve exact network limits.
- [ ] Modal re-filters on network change using the active account network or `manager.getNetwork()`.

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

- [ ] Non-XRPL connect fails before provider calls if its protocol runtime is missing.
- [ ] Non-XRPL signing consumes `protocolContext`; no fallback to an XRPL codec.
- [ ] Submit rejection preserves hash and known/provisional outcome through the manager request tracker.

- [ ] No private key, seed, secret, API key, or WalletConnect projectId is hardcoded.
- [ ] Adapter does not submit hidden transactions.
- [ ] Adapter does not mutate transaction fields silently except for documented wallet-specific requirements.
- [ ] Raw provider results are returned only under `raw` for debugging/integration.
