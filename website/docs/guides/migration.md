# Migration Guide

## v0.1.x to v0.2.0

Existing XRPL integrations retain their manager and signing entry points.
To enable Xahau with the full client, select `"xahau-mainnet"` or
`"xahau-testnet"` and a positive `preflight.maxFeeDrops`. Core/selective setups
must register the protocol explicitly; see [Xahau](/docs/configuration/xahau).

## v0.2.x to v0.3.x

- Keep Wallet Kit package versions aligned.
- Enable GhostSig, Xyra and Joey Wallet explicitly on XRPL; exported factories
  do not imply membership in `wallets: "all"`.
- Joey's extension uses `joey-wallet`, not the WalletConnect ID `joey`.
- Native `signIn()` is additive. Keep existing `signMessage()` authentication
  flows; use the [native verifier](/docs/auth/native-sign-in) only for native proofs.
- Set `ui.walletList.layout: "auto"` to switch overflowing lists to Card.
  Explicit layouts remain fixed; `grid` is retained for compatibility, but
  website controls offer Auto, List, Card and Icon.
- Remove host CSS that forces inline balances onto a new line or always visible.
  Kit hides the inline balance when constrained, keeping it in the account panel.
- The footer identifies chain/network; do not add a second Testnet/Devnet badge.

These additions do not require changing existing XRPL transaction calls. Check
[adapter capabilities](/docs/adapters/overview) before offering an operation,
and [Bundle & Performance](/docs/advanced/bundle-performance) for lazy Xahau
loading, selective imports and confirmation ownership.

---

## Pre-0.1.0 to v0.1.0

### `WalletModal` constructor

The constructor now takes a single options object. Update any calls that passed `manager` as the first argument:

```ts
// Before
const modal = new WalletModal(manager, { title: "Connect" });

// After (v0.1.0)
const modal = new WalletModal({ manager, title: "Connect" });
```

### `WalletButton` constructor

Same change — `manager` is now inside the options object, and the mount target is `target` (not `root`):

```ts
// Before
const button = new WalletButton(manager, { root: el, modal });

// After (v0.1.0)
const button = new WalletButton({ manager, modal, target: el });
```

### `themeMode` moved to top-level

The `mode` option moved out of `theme: {}` and is now `themeMode` at the top level:

```ts
// Before
new WalletModal({ manager, theme: { mode: "dark", accent: "#0078ae" } });

// After (v0.1.0)
new WalletModal({ manager, themeMode: "dark", theme: { accent: "#0078ae" } });
```

### `updateOptions()` replaces `setTheme()`

The `setTheme()` method was removed. Use `updateOptions(WalletUiConfig)` instead:

```ts
// Before
modal.setTheme({ mode: "dark" });

// After (v0.1.0)
modal.updateOptions({ mode: "dark" });
```

### Locale options

The `locale` option was renamed. Update your i18n configuration:

```ts
// Before
new WalletModal({ manager, locale: jaJPMessages });

// After (v0.1.0)
import { jaJPMessages } from "@xrpl-wallet-kit/ui";
new WalletModal({ manager, language: "ja-JP", messages: jaJPMessages });
```

