# XRPL Wallet Kit Adapter Guide

This guide is for wallet teams and third-party developers who want to add a wallet adapter to XRPL Wallet Kit.

## What an adapter does

An adapter is the only layer that talks to a wallet provider, extension, mobile SDK, WalletConnect session, hardware transport, or snap. The core manager and UI only talk to the adapter interface.

A production adapter must:

- expose wallet metadata (`id`, `name`, `type`, optional `icon`, `group`, `homepage`);
- declare capabilities accurately;
- implement `connect()` and return a normalized XRPL account/session;
- implement only the signing methods the wallet really supports;
- never hardcode private keys, seeds, secrets, or project IDs;
- not render DOM, modals, alerts, or app-specific UI directly;
- normalize user cancellation/rejection so the manager can emit predictable errors;
- clean up listeners, timers, sessions, transports, and popups in `disconnect()`.

## Recommended adapter IDs

Use lowercase stable IDs without spaces. Existing IDs:

- `xaman`
- `gemwallet`
- `crossmark`
- `dropfi`
- `metamask`
- `walletconnect`
- `staticbit`
- `bitget`
- `joey`
- `girin`
- `bifrost`
- `ledger` (currently available as an adapter package but disabled in default UI examples)

Third-party IDs should be short and unique, for example `mywallet`.

## Files to start with

Use the template in `docs/adapters/templates/adapter-package` as a starting point. Copy it into `packages/adapters/<wallet-id>` when adding an official package to this monorepo.

## Required validation

Before opening a PR or shipping a new adapter, run:

```powershell
npm.cmd run typecheck
npm.cmd test
npm.cmd run build:browser
```

Also complete the manual checklist in `testing-checklist.md` for desktop, mobile browser, and in-app browser when the wallet supports mobile flows.
