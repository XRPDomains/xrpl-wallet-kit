# Wallet Kit Code Audit - 2026-10-01

## Scope and Method

Open Code Review Delegation Mode: OCR supplies file selection/rules; Codex performs the assessment without an external review LLM. The diff preview contained one reviewable source file (ThemeBuilderWidget.vue), reviewed in full. This was extended with targeted inspection of core lifecycle/storage, UI balance handling, React provider, adapters, dependencies and bundle reports. This is not an exhaustive line-by-line audit of every repository file.

Existing working-tree changes were preserved. No production source was edited, no issues/PRs were created, and nothing was committed or pushed.

## Findings

### P1 - Late auto-reconnect can undo an explicit disconnect

- Location: packages/core/src/manager.ts:173, 185 (also fallback/recovery session writes at 211 and 271).
- The restore path awaits adapter work and subsequently installs a session without checking whether disconnect or a newer connection invalidated that operation. The connect-path cancellation guards do not cover this restore path.
- Reproduced with a delayed fake adapter: start autoReconnect, disconnect, then resolve restoreSession. The manager returns to a connected session after logout.
- Fix: share a lifecycle generation or cancellation mechanism across connection, restoration and recovery; verify ownership after every asynchronous boundary before mutating state or emitting events.

### P2 - Concurrent transaction writes lose records

- Location: packages/core/src/tx-store.ts:46-52.
- add() performs an asynchronous read-modify-write without serialization. Concurrent additions can read the same initial list and overwrite each other, even with MemoryWalletStorage.
- Reproduced: two concurrent additions, expected two records, observed one.
- Fix: serialize mutations by account/network key, including status updates, pruning and clear operations. Protect the shared index as well; a per-instance queue alone does not guarantee cross-tab atomicity.

### P2 - Restoration duplicates balance work; RPC lifetime is unbounded

- Locations: packages/ui/src/button.ts:80-90, 549; packages/ui/src/balance.ts:13, 40, 71.
- A restored session emits both connected and session_restored. The button independently resolves balance for both events. A request counter suppresses stale results but does not deduplicate or cancel requests.
- Reproduced: one restored session invokes the balance resolver twice. Two default refreshes invoke four RPC requests (account_info and server_state for each refresh).
- Static inspection: the default RPC fetch has no timeout/AbortSignal, and reserve lookup is repeated rather than cached. A pending fetch can keep loading active; obsolete work continues after session changes.
- Fix: deduplicate in-flight work by account/network, cancel obsolete requests, bound request duration, and cache reserve data by endpoint with an appropriate TTL.

### P2 - React manager replacement retains the previous session

- Locations: packages/react/src/index.tsx:44-45, 85-128.
- Session/status are initialized from manager only on the initial mount. On manager replacement the subscription effect rebinds events but does not immediately synchronize state. autoReconnect can return null without a session event.
- A connected manager A replaced by disconnected manager B can display A's account while actions use B.
- Evidence: source inspection; a React rerender reproduction was not run in this audit.
- Fix: synchronize session/status when the manager prop changes, including the disconnected case, and add a manager-replacement regression test.

### P2 - Theme Builder restores preview with the wrong network argument

- Location: website/.vitepress/theme/components/ThemeBuilderWidget.vue:1052.
- getNetwork expects a registry ID but receives previewSession.account.network, a WalletNetwork object. The resulting error is swallowed, interrupting restoration when settings rebuild the preview.
- Reproduced the contract failure: manager.getNetwork(manager.getNetwork()) throws "XRPL network is not registered: [object Object]". The full browser configuration-change flow was not replayed.
- Fix: use the network ID and an explicit supported preview-state restoration path rather than mutating private manager fields. Preserve meaningful diagnostics instead of silently swallowing restoration errors.

## Cleanup and Optimization

- jscpd: 160 files, 18,126 lines, 10 clone groups, 350 duplicated lines (1.93%). This is below the configured 5% threshold; duplication is not broadly excessive.
- The main production duplication is five withAbort implementations: Xaman (386), XRPL Snap (445), GemWallet (200), DropFi (185), Crossmark (152). A shared cancellation helper could remove repeated lifecycle logic while preserving provider-specific errors.
- Other clone groups include tests, example CSS and package metadata. These are lower priority than the flow defects above.
- Knip cleanup candidates without direct source imports include xumm-oauth2-pkce in Xaman, @walletconnect/utils in WalletConnect, and @ledgerhq/errors, @ledgerhq/hw-transport and buffer in Ledger. Validate package builds, packed consumers and transitive requirements before removing them. Root SDK dependencies need separate script/build verification.
- Knip false positives: browser buffer is actively used, Next re-exports core, and public API aliases intentionally preserve compatibility. examples/react/App.tsx is an illustrative example rather than the runnable entry; do not delete it as garbage without deciding its documentation role.
- Theme Builder deep watchers rebuild managers/adapters and UI for each configuration change (renderPreview at 965; watchers at 1283). Prefer persistent preview objects and coalesced presentation updates. Cleanup is broad (global styles/overlays); scope it to the preview. This is a source-level optimization candidate, not a measured browser performance regression.
- Dependency cycle check passed: 88 modules, 215 dependencies. This check does not prove all dependencies are necessary.
- Bundle check passed: selective GemWallet build 22,820 bytes gzip; default adapter set 508,087 bytes gzip. The default includes multiple wallet SDKs by design. Prefer selective imports for dapps; the larger default bundle is not itself a correctness bug.

## Tokens and Security Scope

API key/client/project configuration fields found in the inspected adapter code have active uses; NFToken fields are XRPL transaction fields, not disposable authentication tokens. Public aliases are not duplicate implementations. No confirmed garbage credential variable was identified.

A limited signature scan of tracked packages, website, scripts and examples found no matching npm token, classic GitHub token or private-key header. This is not a complete secret scan, and untracked local configuration was not printed or audited. CSS design-token liveness was not exhaustively analyzed.

## Verification and Recommended Order

Completed: OCR diff/rule inspection, Knip report, jscpd report, dependency cycle check, bundle-size check, targeted Node/TSX reproductions for restoration cancellation, transaction write races, duplicate balance calls and the network argument contract.

Not performed: live-wallet signing, real mobile profiling, a React manager-swap DOM test, or a new full-suite run during this audit. Earlier passing tests are not substitutes for regression tests covering these findings.

Recommended order: restore lifecycle guard; transaction mutation serialization; balance deduplication/cancellation; React manager synchronization; Theme Builder restoration; then shared abort helper and verified dependency cleanup.

## Implementation Follow-up

The original audit above describes the pre-fix state. The following changes were subsequently implemented locally at the user's request:

- #41: invalidate restore/recovery on connect, disconnect and destroy; check lifecycle ownership after awaits. Serialize session persistence/removal so a delayed recovery write cannot outlive logout. Ignore late transaction history loads for replaced sessions.
- #42: serialize transaction-store reads/mutations by account, including the shared network index and all-network clear. Queue failures do not block subsequent operations. Coordination remains instance-local, not cross-tab atomic storage.
- #43: deduplicate in-flight balance work, abort obsolete work on account/network changes, disconnect and destroy, add an optional resolver signal, bound default RPC duration, and cache reserve data by endpoint with a TTL. Custom resolvers remain compatible and must honor the optional signal to stop their own underlying work.
- #44: synchronize React session/status on manager replacement before client paint; add a renderer regression test covering disconnected and connected replacements and old-manager events.
- #45: remove private-field hydration entirely. The persistent preview manager now preserves the actual session, eliminating the wrong-network-argument path.
- #46: reuse SDK managers/adapters during presentation changes; coalesce rendering, cancel owned animation frames/listeners on teardown, preserve unrelated overlays/styles, and support an optional embedded account-panel host. Configuration pointer events no longer prematurely close/reflow the preview panel. A preview-origin containment fallback supports older CDN bundles.
- #47: remove the validated unused direct Xaman, WalletConnect and Ledger dependencies and redundant root SDK declarations. Remove the unused browser buffer-polyfill source and duplicate example React plugin declaration. Explicitly declare development dependencies used by tests. Keep active Buffer integration, Next/core re-exports, illustrative examples and public compatibility aliases.
- #22 audit follow-up: consolidate five abort helpers into BaseWalletAdapter with lazy provider operations, pre-aborted signal handling, listener cleanup and provider-specific connection errors. This addresses the duplicated helper scope, not the entire broader request-lifecycle roadmap in #22.

Verification includes the Node regression/full test suite, package/browser builds and smoke checks, packed React 18/19 consumers, website production build, dependency-cycle and selective-bundle checks, and Playwright mobile/desktop checks with both current and simulated legacy portal behavior. Browser tests use mocked wallet connections and locally rebuilt bundle interception; they do not sign on live wallets or publish the CDN package.

Post-cleanup jscpd report: 1.19% duplicated lines (219 of 18,386 scanned lines). Remaining Knip findings are documented intentional examples, live Buffer integration, core re-exports and compatibility aliases. Existing third-party npm audit advisories remain outside these seven issues; no previously locked dependency version was changed during this cleanup. Do not interpret successful functional checks as a clean security audit.

Shipping follow-up (2026-10-03): the user requested committing and pushing these fixes to main. Close #41-#47 after the successful push; keep #22 open for its remaining request-lifecycle roadmap. npm publication is separate from this source-code delivery.
