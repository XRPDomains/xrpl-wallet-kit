# Changelog

## Unreleased

### Added

- Experimental opt-in GhostSig hosted popup adapter with verified signing replies, cancellation and cached session restoration. Available in workspace client/IIFE exports, not enabled by defaults or `wallets: "all"`. Live passkey/testnet acceptance and npm publication remain pending under #34.

### Security

- Replace auth's default legacy signed-transaction verifier with modern XRPL codec/keypairs peers, preserving compact versus signedTx proofs and explicit injected verifiers. Reject malformed proofs and ambiguous injected validity results; remove the legacy verifier peer requirement.
- Patch development Next.js and compatible root transitive dependencies; upgrade duplicate-detection tooling without its vulnerable glob dependency chain.
- Patch the private website's Vite/PostCSS/nanoid dependency chain and add scoped audit regression checks.
- Keep remaining unpatched Crossmark dependency risks visible under P1 issue #48. These changes do not resolve all root audit findings or upgrade consuming dApps' Next.js versions.

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
