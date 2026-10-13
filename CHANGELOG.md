# Changelog

## Unreleased

## 0.1.21

### Added

- Experimental opt-in single-account All-or-Nothing Batch preparation for 2-8 transactions, recursive inner preflight, amendment/fee checks and per-inner confirmation tracking. Wallet acceptance requires live testing; no Ledger Batch support is claimed.
- Shared React Batch panel in the unified local wallet test console on port 5173, with separate prepare, review, sign-only and explicit submit actions.
- Batch integration guides and GhostSig transaction examples on the website.

### Fixed

- Ledger multisign now sends ordinary unsigned transaction serialization to the XRP app, which constructs its own signing preimage.
- Verify default Ledger signatures before returning or broadcasting; prevent stale connections/signing/account discovery from surviving disconnect.
- Preserve RPC errors instead of translating them into device errors. Include device status, app version and prepared payload in device-signing diagnostics.
- Set the canonical signature flag in Ledger single-sign requests while preserving transaction flags for XRP app 2.3.2 compatibility.
- Block standalone inner Batch requests in both numeric and object Flags forms.
- Align release checks with the website's shared latest-CDN loader and validate npm credentials before publication.
- Mock and clean up browser globals in conformance fixtures when Node does not expose `navigator`.

## 0.1.20

### Added

- Opt-in GhostSig hosted popup adapter with verified signing replies and cancellation. Available in client/IIFE exports, not enabled by defaults or `wallets: "all"`. Payment and NFT flows were reported working by the user; broader live acceptance is not claimed.
- Experimental standalone Xyra adapter with verified sign-only replies, popup cancellation, and an embedded icon. Opt-in only; no default-client/CDN integration. Live acceptance and validated-submission confirmation remain pending under #49.

### Fixed

- Reconcile existing Xaman signing payloads after missed subscription events, bound waits, and retain payload UUID/uncertain outcome on timeout without resubmitting.
- Add wallet visibility controls to local React/vanilla previews and keep mainnet as the default.

### Security

- Replace auth's default legacy signed-transaction verifier with modern XRPL codec/keypairs peers, preserving compact versus signedTx proofs and explicit injected verifiers. Reject malformed proofs and ambiguous injected validity results; remove the legacy verifier peer requirement.
- Patch development Next.js and compatible root transitive dependencies; upgrade duplicate-detection tooling without its vulnerable glob dependency chain.
- Patch the private website's Vite/PostCSS/nanoid dependency chain and add scoped audit regression checks.
- Bundle the pinned Crossmark SDK runtime in the adapter artifact instead of installing its legacy typings tree in consumers. Preserve upstream license text and document its manifest/license discrepancy. Upstream crypto findings remain in development dependencies; this is not an upstream crypto patch.
- Patch source-map-js and the private website's Vue dependency family. These changes do not upgrade consuming dApps' Next.js versions.

## 0.1.19

### Added

- Opt-in transaction preflight policies, request lifecycle diagnostics and cancellation.
- Reusable adapter conformance checks through `@xrpl-wallet-kit/core/testing`.
- Opt-in XRPL Wallet Standard discovery and legacy adapter registration bridge.
- Multisign contribution verification, deterministic combination and quorum/fee-gated submission helpers.

### Fixed

- Signing/session race conditions, stale-operation cleanup and React lifecycle handling.
- Mobile theme-builder preview, wallet selection controls and dark-mode navigation.
- Onboarding configuration and selective entry-point documentation.

### Migration

- Default Ledger multisign signing now requires a fully prepared transaction and does not autofill each contribution. Prepare all fields once before collecting signatures. Single-sign behavior is unchanged.
- Wallet discovery and preflight remain opt-in. GhostSig integration is planned, not included.

## 0.1.3

### Fixed

- Fixed the browser package build so npm publishes both the IIFE bundles and the root ESM/type entry files.

## 0.1.2

### Fixed

- Lazy-load Ledger browser transport dependencies so `@xrpl-wallet-kit/client` can be imported in Node.js and SSR environments.

## 0.1.1

### Fixed

- Fixed npm package ESM output so published packages can be imported directly by Node.js and modern bundlers.

## 0.1.0

First stable public release for XRPL Wallet Kit.

### Added

- Headless wallet core with adapter architecture, session storage, network registry, activation status, and wallet events.
- Prebuilt wallet UI with connect modal, WalletConnect modes, custom QR panel, Connect Button, Account Panel, themes, layouts, and mobile bottom sheet behavior.
- Browser bundle for vanilla JavaScript and legacy HTML/jQuery integrations.
- React and Next.js helper packages.
- First-party adapters for Xaman, GemWallet, Crossmark, DropFi, WalletConnect, XRPL Snap, and Ledger.
- Sign-only and sign-and-submit manager flows.
- Basic docs for npm, browser usage, and legacy HTML integration.

### Notes

- Intended for the `latest` npm dist-tag.
- WalletConnect `projectId` must be provided by the integrating app.
- APIs may still change before `1.0.0`.
