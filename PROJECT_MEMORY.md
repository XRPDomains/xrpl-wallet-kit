# XRPL Wallet Kit Project Memory

## Project Location

- Active workspace: `C:\Users\PC\OneDrive\Develop\VibeCode\xrplWalletKit`
- Old temporary workspace `New project 2` should not be used for this project anymore.
- Root `.env.example` documents preview env vars. Use `.env.local` locally for real values; `.gitignore` excludes `.env*` except `.env.example`.

## Product Direction

- Build a framework-agnostic XRPL Wallet Adapter / Wallet Kit.
- Core must stay headless: no UI dependency, no DOM calls, no business app APIs.
- UI must stay generic: no XRPDomains business logic.
- WalletConnect `projectId` must be injected by app config.
- No private keys, seeds, or secrets in SDK code or examples.
- Vanilla preview reads `VITE_WALLETCONNECT_PROJECT_ID`, `VITE_XAMAN_CLIENT_ID`, and optional `VITE_XRPL_WALLET_KIT_APP_*` metadata from Vite env. If required preview keys are missing, the corresponding adapter is disabled with a config warning instead of using hardcoded keys.

## Business Logic Boundary

- Do not add set-primary/default-domain logic to SDK.
- Removed/avoid these SDK concepts: `createSetPrimaryMemoPayload`, `shouldVerifySetPrimary`, `signAuthPayload`, `isVerify`.
- XRPDomains APIs such as `/api/xrplnft/setPrimary` belong only in the business app.

## Package Layout

Adapters are grouped for source organization under:

```text
packages/wallet-adapters/
```

The npm package names remain unchanged:

- `@xrpname/wallet-adapter-xaman`
- `@xrpname/wallet-adapter-gemwallet`
- `@xrpname/wallet-adapter-crossmark`
- `@xrpname/wallet-adapter-walletconnect`
- `@xrpname/wallet-adapter-dropfi`
- `@xrpname/wallet-adapter-xrpl-snap`
- `@xrpname/wallet-adapter-ledger`

`@xrpname/wallet-kit` is only an aggregate package and should not contain adapter business logic.

## Adapter Notes

- Xaman uses the `xumm` package and supports `apiKey -> new Xumm(apiKey)`, while still allowing injected `auth/sdk`.
- Adapter metadata may use embedded `data:image/svg+xml;base64,...` icon defaults only when the source is verified. Current verified defaults come from XRPL Commons `xrpl-connect` adapter sources.
- GemWallet adapter imports `@gemwallet/api` internally; examples should call `createGemWalletAdapter()` without injecting the library. Provider injection remains available only for tests/mocks.
- Crossmark adapter imports `@crossmarkio/sdk` internally; examples should call `createCrossmarkAdapter()` without app-level SDK injection.
- WalletConnect uses `@walletconnect/sign-client`, `@walletconnect/modal`, `@walletconnect/types`, and `@walletconnect/utils`.
- WalletConnect wallet registry/deeplinks live in `wallet-adapter-walletconnect/src/wallets.ts`, not in the app preview.
- WalletConnect keeps the generic WalletConnect icon plus approved wallet-specific icons for StaticBit, Bitget, Joey, Girin, and Bifrost in `wallet-adapter-walletconnect/src/icons.ts`.
- WalletConnect package exposes `createWalletConnectAdapter()` as the one-adapter primitive and `createWalletConnectAdapters()` as the DX helper. Helper defaults to `mode: "default"`, `wallets: "all"`, and returns one `walletconnect` adapter using the official WalletConnect modal. `mode: "details"` returns the selected child wallet adapters, defaulting to all registry wallets, for custom QR/drilldown UI.
- The aggregate default WalletConnect adapter reports `capabilities.qr = false` when configured with `useModal: true` and `modalMode: "always"` so `wallet-ui` shows the normal loading panel and lets the official WalletConnect modal own QR rendering. Child/detail WalletConnect adapters keep custom QR capability.
- Ledger adapter imports `@ledgerhq/hw-app-xrp`, WebHID/WebUSB transports, and `xrpl` internally. `connectLedger` injection remains available only for tests/custom transports.
- DropFi follows `window.xrpl` injection API:
  - `connect(): Promise<boolean>`
  - `getAddress()`
  - `signMessage(message): Promise<string>`
  - `sendTransaction(tx): Promise<string>`
- `normalizeTxResult(raw)` maps raw string to transaction hash for DropFi-style responses.

## QR / WalletConnect UX

- `@walletconnect/modal` already includes its own QR renderer via internal `@walletconnect/modal-ui`.
- `@xrpname/wallet-ui` keeps its own `qrcode` dependency only for custom QR panel mode.
- Do not import private/internal `@walletconnect/modal-ui` APIs from `wallet-ui`.
- WalletConnect wallet configs default to `useModal: false`; preview should use the custom `wallet-ui` QR unless explicitly testing `@walletconnect/modal`.
- If an app enables `useModal: true`, the adapter must close and remove `wcm-modal` elements when WalletConnect modal closes to avoid invisible overlays blocking the page.

## Wallet Icon Policy

- DropFi and XRPL Snap now use approved embedded icon defaults while still allowing `options.icon` override.

- Wallet icon source notes live in `docs/WALLET_ICONS.md`.
- Avoid using XRPDomains wallet icons in SDK packages or examples.
- Do not invent or stylize wallet icons. Use XRPL Commons embedded icons where available; otherwise leave the adapter icon unset and allow `options.icon` / wallet config override.
- Exact third-party wallet marks should be checked against brand/trademark terms before commercial npm publishing.
- Approved icons from `tmp/walletconnect-icons/` have been converted to base64 defaults. Remaining deleted candidates should stay out of source unless re-approved.
- Current approved embedded assets: StaticBit PNG, Bitget SVG, Joey JPEG bytes from `.png` filename, Girin JPEG bytes from `.png` filename, Bifrost PNG, DropFi PNG, and cropped XRPL Snap PNG.
- Apps can always override adapter defaults through `options.icon` or WalletConnect wallet config.

## Wallet UI Notes

- `WalletSession` is enriched by `WalletManager` with `wallet?: WalletMetadata` after connect/restore. This exposes adapter display metadata (`id`, `name`, `type`, `icon`, `group`, etc.) to apps without requiring app-side adapterId lookup. The existing `session.metadata` field remains reserved for adapter/session technical data such as WalletConnect topic.

- `@xrpname/wallet-ui` now supports configurable modal layouts: `list`, `grid`, and `icon`.
- Theme modes: `light`, `dark`, and `auto`; token overrides include accent, background, foreground, muted, border, overlay, surface, radius, walletRadius, shadow, and fontFamily.
- Wallet display config is intentionally simple: omit `wallets` to show all registered adapters, or pass `wallets: string[]` with adapter IDs in the exact display order. No include/exclude/recommended/group filters are used in `wallet-ui`.
- The vanilla preview wallet selector now uses order presets only (`all`, `appv5`, `minimal`) so it mirrors the package API.
- Canonical adapter IDs are `xaman`, `gemwallet`, `crossmark`, `dropfi`, `xrplsnap`, `ledger`, `staticbit`, `bitget`, `joey`, `girin`, and `bifrost`. Ledger remains available as an adapter package but is not registered in the vanilla preview until explicitly enabled.
- `WalletManager.getWalletAvailability()` checks each adapter's `isAvailable()` and returns an adapterId boolean map. `wallet-ui` uses this only in `list` layout to show a neutral grey `Installed` badge with a small grey dot for extension-like wallets (`group === "Extensions"` or `type === "snap"`).
- `wallet-ui` supports `presentation: "flat" | "grouped"`. `flat` remains the default. `grouped` creates virtual wallet groups without fake adapters; by default it puts a WalletConnect card at the bottom. List layout shows a WalletConnect icon plus right-aligned 14px child wallet icons; grid/icon layouts show only WalletConnect icon + label and still drill down to child wallets.
- WalletConnect custom QR uses a smaller 304px QR image in a 332px card and short helper text (`Scan with your wallet app to connect.`) to reduce modal height changes from the wallet list.
- Wallet group labels can be shown/hidden with `showWalletGroup`.
- Vanilla preview intentionally exposes only the active UI test controls: layout, WalletConnect mode, and theme. Size, text size, radius, font, wallet order, and group label use fixed defaults in code so the test page stays focused.
- Vanilla preview `WalletConnect mode` is the product-flow selector: `default` registers one aggregate `walletconnect` adapter using the official WalletConnect modal; `list` registers child WalletConnect wallets and displays every adapter flat without grouping; `group` registers child WalletConnect wallets and shows them through the grouped WalletConnect card. The lower-level `wallet-ui` `presentation` option remains internal render mapping (`flat`/`grouped`) for this preview.
- Vanilla modal is intentionally simple and polished: centered modal, wallet icon/name/group rows, dedicated connecting screen with spinner/icon, QR help text, copy URI action, footer, and responsive centered layout.
- Search, group filter tabs, badges, and mobile bottom-sheet UI are intentionally deferred until requested.
- Preview should not register `Mock XRPL Wallet` in the normal wallet list.
- Custom WalletConnect QR should render the QR first and draw the center WalletConnect logo non-blocking afterward.
- For adapters with `capabilities.qr`, the UI should switch to the QR screen immediately on `connecting` and show `Generating QR...` until the `qr` event provides the URI.
- Keep the hidden back button in the header layout with `visibility:hidden`, not `display:none`, so the centered title does not collapse into the left grid column.
- Modal view switching should be driven by `data-xwk-view` on `.xwk-overlay` so list/connect/QR panes cannot all be hidden accidentally.
- Before mounting a new wallet modal, remove existing `.xwk-overlay` nodes from the mount root to clear any orphan overlay left by failed async wallet flows.
- WalletConnect QR flow now uses a standalone QR modal shell in `wallet-ui`; `qr` events replace the modal body directly instead of switching panes in the wallet list modal.
- QR images are rendered by `wallet-ui` from the standard `qrcode` output with no center logo overlay. Avoid custom dotted/finder QR rendering for production because long WalletConnect URIs may fail wallet scanning.
- Custom QR pending state shows a small neutral loading spinner next to `Generating QR...`.
- QR modal header should use the selected wallet name as the title; the separate wallet-name heading is intentionally removed to save vertical space.
- Modal footer text is `XRPL Wallet Kit`. Wallet row hover should avoid changing border color/width and should not use transform; use subtle background and shadow only so icon/text do not move.
- Default modal widths are intentionally compact (`default` 520px, `compact` 400px, `wide` 640px); list rows/icons and body/footer padding are kept tight so the popup does not dominate desktop viewports.
- QR modal uses a standalone shell. The non-QR loading state also uses a standalone connect shell, not list-pane show/hide, so wallet provider popups cannot leave only the overlay visible. Back-to-list remounts the full modal shell when `.xwk-list` is missing.
- The modal click handler should show loading immediately before `manager.connect()`. Only WalletConnect QR adapters should go straight to QR pending; Xaman/GemWallet/Crossmark/DropFi/XRPL Snap should show the connect/loading panel first.
- Ledger remains in packages but is temporarily hidden from the vanilla preview registration.
- Vanilla preview font selector defaults to Inter and uses this option set: Inter, Noto Sans, Domine, EB Garamond, Bree Serif, Bellota.
- After showing the loading panel, the modal waits for a paint frame before calling `manager.connect()` so provider popups do not prevent the loading state from appearing.
- Wallet icons in modal/list previews use a slightly larger border radius (`12px` in lists, `16px` in loading panel) so square icons feel consistent with the rounded UI.
- Loading spinner uses soft neutral gray (`#cbd5e1` / `#e5e7eb`) instead of the accent blue.
- Popup/modal shadow defaults to `none` for a flatter overlay feel.
- Vanilla preview exposes outer radius sizes S/M/L/XL mapped to 8px/14px/18px/24px.
- Modal title sizes are intentionally modest: 18px/20px/22px for sm/md/lg text presets. Close icon uses a heavier 26px/500 style to balance the back icon.
- Wallet rows in the modal use a soft filled style with no border and no hover shadow. Hover changes only `background` (`surfaceHover`), which should be darker in light theme and lighter in dark theme.
- Header title is smaller at 16px/18px/20px for sm/md/lg, header chrome uses compact 32px controls and 10px/18px padding, footer has no divider line and uses taller soft padding, body top padding is reduced to lift the wallet list, and wallet item gap is 7px.
- Wallet item names use `#333333` in light theme; dark theme keeps the resolved foreground color for contrast.
- Modal layout class must use `xwk-layout-${layout}`. Do not put `xwk-grid` on the modal itself because `.xwk-grid` is the wallet-list grid class and will break header/body/footer layout.

## Preview

- Vanilla preview runs at: `http://127.0.0.1:5173/`
- Start command:

```powershell
npm.cmd run dev:vanilla
```

- If server is already running, `Invoke-WebRequest http://127.0.0.1:5173/` should return `200`.

## Verification Commands

```powershell
npm.cmd run typecheck
npm.cmd run build
```

Both should pass before considering a structural refactor complete.

Useful smoke checks:

```powershell
Invoke-WebRequest -UseBasicParsing 'http://127.0.0.1:5173/' -TimeoutSec 10
Invoke-WebRequest -UseBasicParsing 'http://127.0.0.1:5173/src/main.ts' -TimeoutSec 10
```

## Known Warnings

- `xumm@1.8.0` warns about npm engine range with current npm 11; it has been a warning only.
- NPM reports moderate vulnerabilities from current dependencies; no forced audit fix has been applied.
- Real wallet connect/sign flows still need manual testing with installed wallets/extensions/mobile wallets.




