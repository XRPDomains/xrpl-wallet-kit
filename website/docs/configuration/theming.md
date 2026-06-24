# Theming

XRPL Wallet Kit UI supports deep theming through `themeName`, `theme`, and `customTheme`. The same token system is shared by `WalletModal`, `WalletInline`, `WalletButton`, account panels, and `WalletToast`.

## Basic Usage

```ts
import { WalletModal } from "@xrpl-wallet-kit/ui";

const modal = new WalletModal({
  manager,
  themeMode: "dark", // "light" | "dark" | "auto"
  theme: {
    accent: "#4aa3ff",
    accentText: "#ffffff",
    background: "#111827",
    foreground: "#f8fafc",
    border: "#334155",
    radius: "14px",
  },
});
```

`manager`, `themeMode`, and `themeName` are top-level options. They are not nested inside the `theme` object.

## Theme Tokens

| Property | Default light | Default dark | Description |
|---|---|---|---|
| `accent` | `#0078ae` | `#4aa3ff` | Links, focus rings, selected states, and primary accents |
| `accentText` | `#ffffff` | `#ffffff` | Text/icons shown on accent-colored backgrounds |
| `background` | `#ffffff` | `#111827` | Modal, panel, and toast background |
| `foreground` | `#111827` | `#f8fafc` | Primary text |
| `muted` | `#64748b` | `#94a3b8` | Secondary and helper text |
| `error` | `#b45309` | `#fbbf24` | Error state color |
| `success` | `#059669` | `#34d399` | Success state color, such as copied/checkmark feedback |
| `surface` | `#f8fafc` | `#1f2937` | Wallet card and action surface |
| `surfaceHover` | `#f1f5f9` | `#263244` | Hover surface |
| `border` | `#e5e7eb` | `#334155` | Borders |
| `overlay` | `rgba(15,23,42,.46)` | `rgba(2,6,23,.72)` | Backdrop overlay |
| `overlayBlur` | `0` | `0` | Backdrop blur in pixels |
| `fallbackIconBackground` | `rgba(15,23,42,.06)` | `rgba(255,255,255,.10)` | Fallback wallet icon background |
| `fallbackIconColor` | `#111827` | `#f8fafc` | Fallback wallet icon foreground |
| `radius` | `14px` | `14px` | Modal and panel corner radius |
| `walletRadius` | `10px` | `10px` | Wallet rows, cards, buttons, and small surfaces |
| `spinnerTrail` | `rgba(0,0,0,.08)` | `rgba(255,255,255,.08)` | Spinner track color |
| `headerBackground` | `#ffffff` | `#111827` | Modal and account panel header background |
| `shadow` | `0 8px 40px rgba(15,23,42,.12), 0 0 0 1px rgba(15,23,42,.04)` | `none` | Modal shadow |
| `fontFamily` | `Inter, ui-sans-serif, system-ui, ...` | `Inter, ui-sans-serif, system-ui, ...` | Font stack |

`overlayBlur` uses `backdrop-filter` and `-webkit-backdrop-filter`. Keep the default `0` for safest mobile performance; high blur values can be expensive on low-end devices.

## Mode

```ts
const modal = new WalletModal({
  manager,
  themeMode: "auto",
});
```

`themeMode: "auto"` follows `prefers-color-scheme`. If `themeName` is not set, the kit uses `lightTheme` or `darkTheme` based on the resolved mode.

::: tip Try it live
Use the **[Theme Builder](/docs/theme-builder)** to preview all presets and token changes in real time — then copy the generated config directly into your project.
:::

## Preset Themes

Use `themeName` when you want a named preset:

```ts
const modal = new WalletModal({
  manager,
  themeName: "midnight",
});
```

The all-in-one client uses the same API:

```ts
const kit = createWalletKit({
  // adapters, network, etc.
  ui: {
    themeName: "glass",
    customTheme: {
      accent: "#10b981",
    },
  },
});
```

| `themeName` | Factory | Description |
|---|---|---|
| `"default"` / `"light"` | `walletUiThemes.light()` | Default light theme |
| `"dark"` | `walletUiThemes.dark()` | Default dark theme |
| `"xrpl"` | `walletUiThemes.xrpl()` | XRPL brand colors with a slightly tighter radius |
| `"minimal"` | `walletUiThemes.minimal()` | Flat, no shadow, smaller radius |
| `"midnight"` | `walletUiThemes.midnight()` | Dark crypto/DeFi preset with deeper surfaces and overlay blur |
| `"glass"` | `walletUiThemes.glass()` | Semi-transparent glass preset for rich backgrounds |
| `"rounded"` | `walletUiThemes.rounded()` | Friendly rounded preset with softer surfaces |
| `"crisp"` | `walletUiThemes.crisp()` | Sharp, high-border preset for fintech or developer tools |
| `"soft"` | `walletUiThemes.soft()` | Pastel surfaces for consumer or NFT-style apps |

You can still import preset factories directly:

```ts
import { WalletModal, walletUiThemes } from "@xrpl-wallet-kit/ui";

const modal = new WalletModal({
  manager,
  theme: walletUiThemes.dark({ accent: "#10b981" }),
});
```

## Merge Order

Theme values are merged in this order:

```txt
base mode or themeName preset -> theme -> customTheme
```

Use `theme` for low-level constructor overrides. Use `customTheme` in `createWalletKit({ ui })` when you want to override a preset without replacing it.

## Custom Brand Example

```ts
const modal = new WalletModal({
  manager,
  themeMode: "dark",
  theme: {
    accent: "#10b981",
    accentText: "#ffffff",
    background: "#0a0a0a",
    foreground: "#fafafa",
    success: "#22c55e",
    surface: "#141414",
    surfaceHover: "#1f1f1f",
    border: "rgba(255,255,255,0.06)",
    overlay: "rgba(0,0,0,.64)",
    overlayBlur: 8,
    spinnerTrail: "rgba(255,255,255,.10)",
    headerBackground: "#0a0a0a",
    radius: "20px",
    walletRadius: "14px",
    fontFamily: "'Inter', system-ui, sans-serif",
  },
});
```
