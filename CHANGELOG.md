# Changelog

## 0.3.1

- Add opt-in Auto wallet layout: use List until it overflows, then reuse the built-in Card layout.
- Keep Card at three columns on mobile and synchronize styles/content during live layout changes without losing keyboard focus.

## 0.2.0

- Theme Builder includes Xyra and chain/network selection for XRPL and Xahau, with matching wallet lists and generated configuration. Xahau Mainnet, like XRPL Mainnet, does not display a network badge.

- Auth challenges on non-XRPL networks include a chain ID. Server verification accepts `expectedChainId` and rejects non-XRPL challenges without a server-pinned chain; raw `signMessage` bytes are unchanged. Existing XRPL auth remains compatible.
- Select injected protocols by family and declared network identity for connection and transaction lookup. All client localStorage sessions use family/network namespaces, with one-time identity-checked legacy XRPL session migration. Caller-provided storage is preserved.
- Load the CDN Xahau codec on demand from a separate, version-matched runtime asset. Keep provider wire selectors in trusted network preset hints rather than adapter chain-name branches.
- GemWallet XRPL sign-only now uses the provider's `signTransaction` API with blob verification. Its default 1,000,000-drop fee ceiling is configurable through `xrplMaxFeeDrops` or a request `maxFeeDrops`; when both are explicit, the lower applies. Submission routing is unchanged.
- Compatibility: legacy `supportedNetworks` is enforced across connect/restore/sign and empty arrays deny all. A new `supportedChains` declaration does not widen a legacy allowlist. Direct Standard adapters must receive custom network mappings; manager discovery forwards the registered presets automatically.
- Correct chain-sensitive amount validation and connection text; show a Xahau Testnet label rather than a generic testnet or XRP label. Unknown non-XRPL native assets no longer default to XRP. The product name remains XRPL Wallet Kit.

- Add the Xahau protocol package and Xaman/GemWallet/Xyra integration with explicit Ledger opt-in. The all-in-one client registers the runtime automatically for Xahau; core/selective consumers configure it explicitly. Xahau uses explicit fee ceilings, verified sign-only, then optional RPC submission. Device/provider live acceptance remains user-driven.
- Xyra accepted broadcasts return `submitted` with a verified hash for manager ledger confirmation, not a false validated-success result or an unconditional unknown-outcome error.
- Add declarative chain filters with deny-all empty lists and narrowing-only intersection. Manager connection, restoration, recovery, switching and signing enforce both legacy and new network restrictions; modal lists follow the active network.
- Resolve Wallet Standard chain capabilities through registered network mappings rather than namespace prefixes. Chain-aware adapters must retain network identity in connection results and provider events; Xahau runtime/provider opt-in is explicit.

## 0.1.23

- Ledger can request opening XRP on the hardware during explicit connection (`autoOpenApp`, default true), with selected-device-only reconnect attempts, cancellation and manual fallback. No Ledger Live desktop dependency or signing-flow change.

- Security: reject unverified cached sessions, bind legacy auth proofs to account keys, validate WalletConnect classic addresses, require nonce checks with an atomic server verification helper, and allowlist wallet URL schemes. Existing backend integrations must supply replay protection; format-only inspection is explicitly opt-in.

- Coalesce and cache passive wallet availability checks; preserve keyboard focus during modal list refreshes.
- Isolate browser Xaman OAuth attempts, verify tokens with the issuer and recover same-origin return tabs without adopting cancelled callbacks.
- Add app-scoped Vue 3 bindings and replace Vue/Nuxt recipes with SSR-safe provider guidance.
- Set stylesheet nonces before DOM insertion and add enforced browser CSP coverage with negative controls.
- Expand packed-consumer CI to xrpl v4/v5, Vue and React 18/19 with offline codec/signing checks.
- Add manual documentation builds from published release tags, with optional GitHub Pages deployment.

## 0.1.22

### Fixed

- GhostSig defaults an omitted or undefined SourceTag to 0 on a cloned txJson used for both dispatch and signature verification. Explicit uint32 tags are preserved; invalid tags and wallet-modified tags remain rejected.
- Widen GhostSig connect/sign popups from 420 to 560 px, keeping 720 px height, resizing and scrolling.

### Documentation

- Record maintainer-reported successful live testing of documented GhostSig and Ledger transaction commands on 2026-10-13. Results apply to the tested setup, not every network/firmware combination; Batch acceptance remains separate.
- Synchronize package versions and website navigation to 0.1.22.

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
