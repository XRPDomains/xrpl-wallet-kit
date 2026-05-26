---
name: xrpl-wallet-kit-adapter-developer
description: Use when implementing, reviewing, or scaffolding a third-party XRPL Wallet Kit adapter from wallet provider documentation, injected API docs, WalletConnect wallet config, hardware SDK docs, Snap/provider APIs, or existing wallet integrations. Guides any coding agent to follow @xrpl-wallet-kit/core interfaces, capability rules, event cleanup, test expectations, and browser bundle validation.
---

# XRPL Wallet Kit Adapter Developer

This skill is an agent-readable implementation guide for building or reviewing wallet adapters for XRPL Wallet Kit.

It is intentionally portable. Codex may load it as a skill; Claude Code, Antigravity, or other coding agents can read this `SKILL.md` directly and follow the same workflow. If an agent does not understand the YAML frontmatter, ignore it and start from this section.

## When To Use

Use this guide when the task involves:

- creating a new adapter package for XRPL Wallet Kit;
- reviewing a third-party adapter contribution;
- converting an existing dApp wallet integration into a clean adapter;
- adding a WalletConnect wallet definition;
- integrating injected extension APIs, mobile/deeplink SDKs, hardware wallets, or Snap-style providers.

## Required Project Context

If working inside this repository, inspect only the files needed for the task:

- `packages/core/src/types.ts`
- `packages/core/src/adapter.ts`
- `packages/core/src/errors.ts`
- `docs/adapters/adapter-contract.md`
- a similar adapter under `packages/adapters/*/src/index.ts`
- `docs/adapters/creating-an-adapter.md`
- `docs/adapters/testing-checklist.md`
- `docs/adapters/templates/adapter-package`

If working outside this repository, require the adapter package to depend on `@xrpl-wallet-kit/core` and follow the same `WalletAdapter` contract.

## Core Workflow

1. Read the wallet provider/API documentation supplied by the user.
2. Classify the adapter type:
   - injected extension/provider;
   - WalletConnect wallet config;
   - mobile/deeplink/QR SDK;
   - hardware transport;
   - Snap or embedded provider.
3. Identify provider capabilities before coding.
4. Implement the smallest adapter that accurately maps provider behavior into `WalletAdapter`.
5. Add package exports and TypeScript declarations.
6. Add focused tests or a preview example when behavior is non-trivial.
7. Run validation commands from the repo root.

## Hard Rules

- Never hardcode private keys, seeds, secrets, API keys, or WalletConnect project IDs.
- Never call app/business DOM, jQuery, Bootbox, alerts, React, Next, or UI modal code from an adapter.
- Never silently mutate transaction payloads except for a documented provider requirement.
- Never claim a capability until the method is implemented and validated.
- Never swallow user rejection; return or throw a useful rejected/canceled error.
- Always clean up listeners, timers, popups, transports, subscriptions, and stale sessions.
- Keep business APIs outside the SDK and adapters.
- Keep adapter code independent from UI packages.

## Required Adapter Shape

Every adapter must expose:

- `metadata`: stable `id`, display `name`, `type`, optional `icon`, `group`, `homepage`;
- `capabilities`: accurate booleans;
- `connect(options)`: returns normalized `{ account, session?, raw? }`;
- `isAvailable()`: detects provider availability without throwing for normal missing-provider cases.

When available, set `adapterApiVersion = WALLET_ADAPTER_API_VERSION`.

Optional methods:

- `disconnect()` if provider supports cleanup/logout;
- `restoreSession(session)` for `autoReconnect`;
- `signMessage(request)` only if supported;
- `signAndSubmit(request)` only if supported.
- `canRecoverSession()` plus `recoverSession()` only for redirect/deeplink/session recovery flows.
- `cancelPendingConnection()` when the adapter can leave pending proposals, popups, timers, or temporary markers.

## Contract Validation

Use the core validator in tests:

```ts
import { assertWalletAdapter } from "@xrpl-wallet-kit/core";

assertWalletAdapter(adapter);
```

If reviewing a contribution, call `validateWalletAdapter(adapter)` and inspect warnings plus errors. Do not accept adapters that fail the validator unless the core contract itself is being intentionally changed.

## Capability Rules

Set capabilities conservatively:

- `connect`: true only if the adapter can return a usable XRPL account address.
- `disconnect`: true only if cleanup is implemented or session cleanup is meaningful.
- `signMessage`: true only if the wallet supports message proof or an agreed transaction-style message proof.
- `signTransaction`: true only if the wallet can sign without submit.
- `signAndSubmit`: true only if the wallet can submit or its provider handles submit.
- `payments`, `nftOffers`: true only after testing the expected XRPL transaction payloads.
- `qr`, `deeplink`: true only if the adapter emits usable QR/deeplink data.

## Error Mapping

Use `createWalletError` from `@xrpl-wallet-kit/core` where possible.

- Missing provider: `createWalletError.walletNotAvailable(walletName)`.
- Unsupported method: use `this.unsupported("methodName")` in `BaseWalletAdapter` subclasses.
- User cancel/reject: message should include `rejected`, `cancelled`, `canceled`, `denied`, or `closed`.
- Timeout: include `timeout` or `timed out`.
- Provider raw errors should be preserved in `raw`/cause where useful, but user-facing messages must be concise.

## Implementation Notes

- Prefer extending `BaseWalletAdapter` when building inside this repo.
- Use provider SDKs directly; do not inject CDN scripts from the adapter unless the provider requires a documented loader.
- Use structured provider APIs instead of string parsing when possible.
- Normalize account metadata into `WalletAccount`.
- Include `network` when known; otherwise rely on `WalletManager` default network enrichment.
- Return `session.wallet` metadata if the adapter can provide it.
- For WalletConnect, keep wallet list/deeplink config separate from protocol logic.
- For mobile flows, consider focus/pageshow/visibility return paths and stale proposal cleanup.
- For hardware wallets, do not fake a restored connection after refresh. Require a fresh device/user confirmation unless the transport SDK explicitly supports safe session restoration.

## Validation

Run from repository root:

```powershell
npm.cmd run typecheck
npm.cmd test
npm.cmd run build:browser
```

For quality review when available:

```powershell
npm.cmd run check:quality
```

Manual smoke test at minimum:

- provider missing/installed states;
- connect success;
- user reject/cancel;
- disconnect;
- autoReconnect if implemented;
- sign message if implemented;
- payment and NFT offer signing if claimed;
- mobile deeplink/QR return for WalletConnect/mobile wallets.

## Reference Loading

Read these only when needed:

- `references/adapter-checklist.md` when reviewing or approving an adapter.
- `references/scaffold.md` when creating a new adapter package.
- `references/hardware-adapters.md` when implementing Ledger, Trezor, or any USB/HID/hardware transport adapter.
