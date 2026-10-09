---
name: xrpl-wallet-kit-adapter-developer
description: Implement, review, or scaffold an XRPL Wallet Kit adapter using wallet provider APIs, documentation, or SDKs. Align capabilities, signing results, lifecycle, exports, and integration docs with the local core contract.
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
- integrating hosted web wallets using popup messaging.

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
   - hosted web/popup wallet (`type: "web"`).
3. Identify provider capabilities before coding.
4. Implement the smallest adapter that accurately maps provider behavior into `WalletAdapter`.
5. Add package exports and TypeScript declarations.
6. Add focused tests or a preview example when behavior is non-trivial.
7. Run focused validation appropriate to the change; distinguish automated coverage from live wallet acceptance.

Keep changes in the existing checkout. Commit, push, npm publish, GitHub release, and additional worktrees require their own user authorization.

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
- `connect(options)`: returns normalized `{ account, session?, raw? }`.

`isAvailable()` is optional in the core contract. When implemented, it must be passive and must not throw for normal missing-provider cases. Browser API availability is not proof that a passkey or wallet session is usable.

When available, set `adapterApiVersion = WALLET_ADAPTER_API_VERSION`.

Optional methods:

- `disconnect()` if provider supports cleanup/logout;
- `restoreSession(session)` for `autoReconnect`; keep it passive and document whether it verifies provider state or only restores cached account metadata;
- `signMessage(request)` only if supported;
- `signTransaction(request)` only if the wallet can sign without submitting;
- `signAndSubmit(request)` only if supported.
- `canRecoverSession()` plus `recoverSession()` only for redirect/deeplink/session recovery flows.
- `cancelPendingConnection()` when the adapter can leave pending proposals, popups, timers, or temporary markers.
- `switchNetwork(network)` only when provider network switching is implemented.

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
- `signMessage` results must distinguish compact signatures from signed transaction proofs with `signatureKind` and normalize the supported proof fields.
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
- Keep browser globals behind runtime guards so package imports remain SSR-safe.
- For popup messaging, validate origin, source, request correlation and reply shape; open approval UI from a user gesture.
- Use provider SDKs directly; do not inject CDN scripts from the adapter unless the provider requires a documented loader.
- Use structured provider APIs instead of string parsing when possible.
- Normalize account metadata into `WalletAccount`.
- Include `network` when known; otherwise rely on `WalletManager` default network enrichment.
- Return `session.wallet` metadata if the adapter can provide it.
- Honor `ConnectOptions.signal` when the provider or SDK exposes an abort/cancel API. If the provider cannot be aborted externally, `cancelPendingConnection()` must still clear local timers, markers, popups, and pending proposal references.
- Use injected `WalletStorage` or core storage helpers for redirect/mobile recovery markers. Do not call `window.localStorage` directly in new adapter code.
- For `restoreSession()`, never call `connect()`, sign-in, QR, deeplink, popup, hardware approval, or transaction approval APIs. Read only passive provider state that already exists after reload.
- For provider-backed `restoreSession()`, compare the current passive provider address with `session.account.address`. Return `null` when the address is missing, mismatched, locked, stale, or not yet hydrated.
- Do not blindly return the stored session just because the provider exists. Local storage is not proof that the wallet is still connected to the same account.
- If a wallet has no reliable passive account API, normally omit `restoreSession()` or return `null`. A documented cached-only restore is not fresh authentication; subsequent signing must re-prove account/key binding.
- For `signTransaction()`, return a normalized `SignTransactionResult` with `txBlob` and never submit to the network. Preserve `submit: false` semantics in `signAndSubmit()`.
- For `signAndSubmit()`, return a normalized result with `hash` whenever the provider submitted a transaction successfully. Core transaction lifecycle events and WalletToast rely on that hash.
- Use or mirror `normalizeTxResult()` for provider-specific response shapes such as `hash`, `txHash`, `tx_hash`, `transactionHash`, nested `result.hash`, or nested `response.data.transaction_hash`.
- Preserve provider results under `raw` so integrators can debug wallet-specific behavior without leaking it into normalized public fields.
- A hash or preliminary submit response is not validated ledger success. Preserve unknown outcomes after dispatch and never automatically retry a potentially broadcast transaction.
- For WalletConnect, keep wallet list/deeplink config separate from protocol logic.
- For WalletConnect, `walletConnectChainId` is optional on `WalletNetwork`, but WalletConnect paths must validate it at runtime and throw a clear network configuration error when it is missing.
- For mobile flows, consider focus/pageshow/visibility return paths and stale proposal cleanup.
- For hardware wallets, do not fake a restored connection after refresh. Require a fresh device/user confirmation unless the transport SDK explicitly supports safe session restoration.

## Validation

Choose validation according to the changed surface. Prefer focused adapter tests and type checks during development; do not automatically bundle the SDK or build the website for every edit. Full validation commands, when requested or needed for integration/release, run from the repository root:

```powershell
npm.cmd run typecheck
npm.cmd test
npm.cmd run build:browser
```

For quality review when available:

```powershell
npm.cmd run check:quality
```

Manual acceptance checks when relevant (performed by the user for real wallet signing/submission):

- provider missing/installed states;
- connect success;
- user reject/cancel;
- disconnect;
- autoReconnect if implemented, including matching-address restore, missing-address null, and wrong-address null;
- sign message if implemented;
- payment and NFT offer signing if claimed;
- mobile deeplink/QR return for WalletConnect/mobile wallets.

Mock tests do not establish production readiness. Report remaining live acceptance gaps and validation not run.

## Consumer Docs and Registration

- Follow neighboring guides: introduction, installation, minimal connection example, options, capabilities, and essential limitations. Keep audit histories, issue progress, test logs and protocol internals out of consumer quick starts.
- Synchronize Supported Wallets, Adapters overview, installation and relevant client/browser examples. Check published package versions before claiming npm/CDN availability.
- Choose default, opt-in, or standalone registration explicitly. Exporting a factory does not require including the wallet in default lists or `wallets: "all"`.
- Use optimized official icons and the kit's embedded data-URI convention where applicable.

## Reference Loading

Read these only when needed:

- `references/adapter-checklist.md` when reviewing or approving an adapter.
- `references/scaffold.md` when creating a new official adapter package inside this monorepo.
- `references/hardware-adapters.md` when implementing Ledger, Trezor, or any USB/HID/hardware transport adapter.
- `references/walletconnect-wallet.md` when adding a new WalletConnect wallet definition to `wallets.ts`.
- `references/test-template.md` when writing unit tests for a new adapter (Node test runner + tsx).

## Template

A ready-to-copy adapter package scaffold lives at:

```
skills/xrpl-wallet-kit-adapter-developer/templates/adapter-package/
  src/index.ts       — base adapter class with all optional methods stubbed
  package.json       — @xrpl-wallet-kit/adapter-mywallet base config
  tsconfig.json      — extends core tsconfig
```

Adapt this directory to `packages/adapters/<wallet-id>/`, replacing `mywallet` / `MyWallet` and aligning package versions with the workspace. The scaffold is not a validated provider implementation: check result normalization, restore guarantees and capabilities against the current core contract before using it.

## Claude Code usage

When working inside this repository, Claude Code reads `CLAUDE.md` at the project root for project-wide context (build commands, architecture rules, hard constraints). This skill provides adapter-specific implementation guidance on top of that.

To invoke this skill from Claude Code: read this `SKILL.md` file and follow the workflow above. Reference files are in `references/` and the adapter template is in `templates/adapter-package/`.
