# Website Docs Review — Config & Theming
**Date:** 2026-06-19  
**Scope:** `website/docs/configuration/theming.md`, `i18n.md`, `api/wallet-modal.md`, `quick-start.md`  
**Method:** Cross-referenced every value against actual source in `packages/ui/src/`

---

## Summary

All four docs files had inaccuracies ranging from wrong default values to completely invented API shapes. All issues have been **fixed directly in the docs files** as part of this review. This document records what changed and why.

---

## 1. theming.md — Fixed

### 1A. Constructor syntax (CRITICAL)

| | Before (wrong) | After (correct) |
|---|---|---|
| Constructor | `new WalletModal(manager, { theme: { mode: "dark" } })` | `new WalletModal({ manager, themeMode: "dark", theme: { ... } })` |
| `mode` placement | Inside `theme: {}` object | Top-level option `themeMode` |

Source: `packages/ui/src/modal.ts` line 50 — `constructor(options: WalletUiOptions)`. Single argument only; `manager` is a required field inside `WalletUiOptions`.

`mode` is not a field of `WalletUiTheme`. It belongs to `WalletUiOptions.themeMode` (constructor) or `WalletUiConfig.mode` (for `updateOptions()`).

### 1B. Wrong default values (12 corrections)

Source of truth: `packages/ui/src/themes.ts` (`lightTheme`, `darkTheme`) and `packages/ui/src/config.ts` (`resolveWalletUiOptions`).

| Property | Was (docs) | Now (actual) |
|---|---|---|
| `accent` light | `#2563eb` | `#0078ae` |
| `accent` dark | `#3b82f6` | `#4aa3ff` |
| `background` dark | `#0f172a` | `#111827` |
| `foreground` light | `#0f172a` | `#111827` |
| `foreground` dark | `#f1f5f9` | `#f8fafc` |
| `surface` dark | `#1e293b` | `#1f2937` |
| `surfaceHover` dark | `#334155` | `#263244` |
| `border` light | `#e2e8f0` | `#e5e7eb` |
| `border` dark | `rgba(255,255,255,.08)` | `#334155` |
| `overlay` light | `rgba(0,0,0,0.5)` | `rgba(15,23,42,.46)` |
| `overlay` dark | `rgba(0,0,0,0.7)` | `rgba(2,6,23,.72)` |
| `radius` | `"16px"` | `"14px"` |
| `walletRadius` | `"12px"` | `"10px"` |
| `shadow` light | `0 20px 60px rgba(0,0,0,.12)` | `"0 8px 40px rgba(15,23,42,.12), 0 0 0 1px rgba(15,23,42,.04)"` |
| `shadow` dark | (not shown) | `"none"` |
| `fontFamily` | `system-ui, sans-serif` | `"Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"` |
| `mode` default | `"auto"` | `"light"` (from `resolveWalletUiOptions`) |
| `textSize` default | `"md"` | `"sm"` (from `resolveWalletUiOptions`) |

### 1C. Missing theme tokens (3 additions)

`WalletUiTheme` has three properties not documented:

| Token | Light | Dark |
|---|---|---|
| `error` | `#b45309` | `#fbbf24` |
| `fallbackIconBackground` | `rgba(15,23,42,.06)` | `rgba(255,255,255,.10)` |
| `fallbackIconColor` | `#111827` | `#f8fafc` |

Source: `packages/ui/src/types.ts` lines 13–29.

### 1D. setTheme() doesn't exist

Docs showed `modal.setTheme({ mode: "dark" })`. This method does not exist.

Correct API: `modal.updateOptions({ mode: "dark" })` — source: `packages/ui/src/modal.ts` line 144.

### 1E. New section added — Preset Themes

`walletUiThemes` is exported from `@xrpl-wallet-kit/ui` (`export * from "./themes"`) but was completely undocumented. Four presets: `light()`, `dark()`, `xrpl()`, `minimal()`. Each accepts an optional overrides object.

---

## 2. i18n.md — Fixed (near-complete rewrite)

### 2A. Wrong option name

| | Before (wrong) | After (correct) |
|---|---|---|
| Option | `locale: VI_VN` | `language: "vi-VN"` |

Source: `WalletUiOptions.language?: WalletUiLocale` — `locale` is not a field.

### 2B. Wrong export names

| | Before (wrong) | After (correct) |
|---|---|---|
| Import | `import { VI_VN } from "@xrpl-wallet-kit/ui/locales"` | `import { viVNMessages } from "@xrpl-wallet-kit/ui"` |
| Import | `import { EN_US } from "..."` | `import { enUSMessages } from "@xrpl-wallet-kit/ui"` |

Source: `packages/ui/src/locales/index.ts` — exports are `enUSMessages` and `viVNMessages`.

### 2C. Wrong / incomplete message keys list

The docs listed 12 keys including `scanQrCode`, `openApp`, and `retry` — none of which exist in `WalletUiMessages`. The actual interface has 35 static string keys plus 8 dynamic function keys. Full correct list now documented.

Source: `packages/ui/src/locales/types.ts`.

### 2D. Language shorthand aliases

`WalletUiLocale` accepts shorthand codes: `"en"` → `en-US`, `"vi"` → `vi-VN`, `"ja"` → `ja-JP`, `"ko"` → `ko-KR`, `"zh"` → `zh-CN`. Not documented before.

---

## 3. api/wallet-modal.md — Fixed (near-complete rewrite)

### 3A. Invented WalletModalOptions interface

The docs defined a `WalletModalOptions` type that does not exist. The correct type is `WalletUiOptions`. Issues in the invented interface:

| Field | Was | Correct |
|---|---|---|
| `locale` | `locale?: Partial<WalletUiMessages>` | `language?: WalletUiLocale` + `messages?: WalletUiMessagesInput` |
| `theme` | `theme?: Partial<WalletUiTheme>` | `theme?: WalletUiTheme` + `themeMode?: WalletUiThemeMode` |
| `root` | `root?: HTMLElement` | `mount?: HTMLElement` |
| `showNetworkBadge` | `showNetworkBadge?: boolean` | **Does not exist** in WalletUiOptions |

### 3B. setTheme() replaced with updateOptions()

`setTheme()` doesn't exist. Removed. Added `updateOptions(WalletUiConfig)` with the full `WalletUiConfig` shape.

### 3C. isOpen() and onClose() added

`isOpen(): boolean` and `onClose(handler)` exist on the modal but were missing from docs.

### 3D. WalletButton: root → target, no labels object

| | Was (wrong) | Correct |
|---|---|---|
| Mount prop | `root: HTMLElement` | `target: string \| HTMLElement` |
| Labels | `labels: { connect, connected, disconnect }` | `label?: string` (top-level, no nested object) |

Source: `packages/ui/src/types.ts` `WalletButtonOptions` interface.

---

## 4. quick-start.md — Fixed

Two occurrences of wrong WalletModal/WalletButton constructor:

```ts
// Was (wrong — 2-arg constructor, root:, manager separate)
const modal = new WalletModal(manager, { title: "..." });
const button = new WalletButton(manager, { root: el, modal });

// Now (correct — single options object, target:, manager inside)
const modal = new WalletModal({ manager, title: "..." });
const button = new WalletButton({ manager, modal, target: el });
```

---

## Outstanding Items (for coder)

### C-DOC-1: Playground widget default accent mismatch

`website/.vitepress/theme/components/PlaygroundWidget.vue` uses `#d97706` (amber) as the default accent in the preview. The actual modal default is `#0078ae`. The playground should either use the real default or add an explanatory note that it's a demo accent.

### C-DOC-2: Playground radius default

The playground shows `16px` as default border radius. Actual default is `14px`.

### C-DOC-3: Playground code output uses `theme: { mode: "..." }`

The generated code snippet from the playground places `mode` inside the `theme` object, which is wrong. Generated code should emit `themeMode: "..."` at options level.

### C-DOC-4: API section missing WalletToast

`WalletToast` is exported from `@xrpl-wallet-kit/ui` but has no docs page yet.

### C-DOC-5: WalletUiConfig structured approach undocumented

`WalletUiConfig` (the structured config used by `createWalletKit()`) is not documented anywhere on the website. The `createWalletKit` convenience API from `@xrpl-wallet-kit/client` is the recommended integration path and needs its own doc page or at minimum a section in Quick Start.

---

## Files Changed

| File | Change |
|---|---|
| `website/docs/configuration/theming.md` | Constructor, defaults (12 values), 3 missing tokens, preset themes section, updateOptions |
| `website/docs/configuration/i18n.md` | Option names, export names, full message key list, shorthand aliases |
| `website/docs/api/wallet-modal.md` | Constructor shape, WalletUiOptions, updateOptions, isOpen/onClose, WalletButton options |
| `website/docs/quick-start.md` | WalletModal constructor, WalletButton target/root |
