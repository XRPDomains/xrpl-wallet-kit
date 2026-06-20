# Theming

XRPL Wallet Kit modal supports deep theming through a `theme` option. You can customize colors, fonts, border radius, and shadows — or switch between `light` and `dark` modes.

## Basic Usage

```ts
import { WalletModal } from "@xrpl-wallet-kit/ui";

const modal = new WalletModal({
  manager,
  themeMode: "dark",            // "light" | "dark" | "auto"
  theme: {
    accent: "#4aa3ff",          // primary action color
    background: "#111827",
    foreground: "#f8fafc",
    border: "#334155",
    radius: "14px",
  },
});
```

> **Note:** `manager` is passed inside the options object. `themeMode` is a top-level option — it is not a property of `theme`.

## Theme Properties

| Property | Default (light) | Default (dark) | Description |
|---|---|---|---|
| `accent` | `#0078ae` | `#4aa3ff` | Buttons, active states, links |
| `background` | `#ffffff` | `#111827` | Modal background |
| `foreground` | `#111827` | `#f8fafc` | Primary text |
| `muted` | `#64748b` | `#94a3b8` | Secondary / hint text |
| `error` | `#b45309` | `#fbbf24` | Error state color |
| `surface` | `#f8fafc` | `#1f2937` | Wallet card background |
| `surfaceHover` | `#f1f5f9` | `#263244` | Wallet card hover |
| `border` | `#e5e7eb` | `#334155` | Borders |
| `overlay` | `rgba(15,23,42,.46)` | `rgba(2,6,23,.72)` | Backdrop overlay |
| `fallbackIconBackground` | `rgba(15,23,42,.06)` | `rgba(255,255,255,.10)` | Fallback wallet icon background |
| `fallbackIconColor` | `#111827` | `#f8fafc` | Fallback wallet icon foreground |
| `radius` | `"14px"` | — | Modal corner radius |
| `walletRadius` | `"10px"` | — | Wallet card corner radius |
| `shadow` | `"0 8px 40px rgba(15,23,42,.12),`<br>`0 0 0 1px rgba(15,23,42,.04)"` | `"none"` | Modal shadow |
| `fontFamily` | `"Inter, ui-sans-serif, system-ui, -apple-system,`<br>`BlinkMacSystemFont, 'Segoe UI', sans-serif"` | — | Font stack |

## Mode (Light / Dark / Auto)

`themeMode` is a top-level constructor option — it is **not** inside the `theme` object:

```ts
const modal = new WalletModal({
  manager,
  themeMode: "auto",   // "light" (default) | "dark" | "auto"
});
```

`"auto"` follows the user's OS preference via `prefers-color-scheme`.

To toggle programmatically at runtime, use `updateOptions()`:

```ts
// Respond to your app's own dark mode toggle
modal.updateOptions({ mode: isDark ? "dark" : "light" });
```

## Layout Options

```ts
const modal = new WalletModal({
  manager,
  layout: "list",    // "list" | "grid" | "card" | "icon"
  size: "default",   // "default" | "compact" | "wide"
  textSize: "sm",    // "sm" (default) | "md" | "lg"
});
```

### Layout previews

**`list`** — one wallet per row with name and group label (default, best for many wallets)  
**`grid`** — 3-column grid with icon and name (like ConnectKit)  
**`card`** — 3-column card with larger icon  
**`icon`** — 4-column icon-only grid, compact

## Preset Themes

Four built-in theme presets are available via `walletUiThemes`:

```ts
import { WalletModal, walletUiThemes } from "@xrpl-wallet-kit/ui";

// Use a preset directly
const modal = new WalletModal({
  manager,
  theme: walletUiThemes.dark(),
});

// Preset + overrides
const modal = new WalletModal({
  manager,
  themeMode: "dark",
  theme: walletUiThemes.dark({ accent: "#10b981" }),
});
```

| Preset | Description |
|---|---|
| `walletUiThemes.light()` | Default light theme |
| `walletUiThemes.dark()` | Default dark theme |
| `walletUiThemes.xrpl()` | XRPL brand colors (`#0078ae` accent, `12px` radius) |
| `walletUiThemes.minimal()` | Flat, no shadow, `8px` radius |

Each preset factory accepts an optional `overrides` object.

## Custom Brand Example

```ts
const modal = new WalletModal({
  manager,
  themeMode: "dark",
  theme: {
    accent: "#10b981",          // emerald green brand
    background: "#0a0a0a",
    foreground: "#fafafa",
    surface: "#141414",
    surfaceHover: "#1f1f1f",
    border: "rgba(255,255,255,0.06)",
    radius: "20px",
    walletRadius: "14px",
    fontFamily: "'Inter', system-ui, sans-serif",
  },
});
```
