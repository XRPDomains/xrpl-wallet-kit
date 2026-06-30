# Migration Guide

## v0.1.x to v0.2.0

No breaking changes yet. Updates will be listed here when v0.2.0 is released.

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

