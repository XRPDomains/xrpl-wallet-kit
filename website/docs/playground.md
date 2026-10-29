---
title: Playground
description: Configure and preview the XRPL Wallet Kit modal live — layout, theme, size, and colors.
---

# Playground

Adjust the controls to see how the modal looks with your configuration. The code snippet below updates automatically.

::: info
The playground previews wallet names and logos without connecting or signing.
Controls offer Auto, List, Card and Icon. Auto starts with List and switches to
Card when the modal list would overflow; the SDK default remains List.
:::

> Want more control? **[🎨 Open Theme Builder →](/docs/theme-builder)** — full-page tool with presets, desktop/mobile preview, and live modal preview.

<PlaygroundWidget />

## Applying your config

Copy the generated snippet and pass it to `WalletModal`:

```ts
import { WalletManager } from "@xrpl-wallet-kit/core";
import { createGemWalletAdapter } from "@xrpl-wallet-kit/adapter-gemwallet";
import { WalletModal } from "@xrpl-wallet-kit/ui";

const manager = new WalletManager({
  adapters: [createGemWalletAdapter()],
  network: "mainnet",
});

// Paste your config from the playground above:
const modal = new WalletModal({
  manager,
  layout: "auto",
  theme: {
    accent: "#7c3aed",
    radius: "20px",
  },
});
```

## Theme tokens

All theme properties are optional. Use `themeMode` on constructors or `ui.mode`
on the client; mode is not a theme token. Common defaults are shown below;
the [Theming guide](/docs/configuration/theming#theme-tokens) is the full reference.

| Property | Light default | Dark default | Description |
|---|---|---|---|
| `accent` | `#0078ae` | `#4aa3ff` | Primary actions, active states |
| `background` | `#fbfcff` | `#111827` | Modal background |
| `foreground` | `#111827` | `#f8fafc` | Primary text |
| `muted` | `#64748b` | `#94a3b8` | Secondary text |
| `surface` | `#f3f7fb` | `#1f2937` | Wallet card background |
| `surfaceHover` | `#edf3f8` | `#263244` | Wallet card hover |
| `border` | `rgba(17,24,39,.08)` | `rgba(248,250,252,.10)` | Borders |
| `overlay` | `rgba(15,23,42,.46)` | `rgba(2,6,23,.72)` | Backdrop |
| `radius` | `"14px"` | `"14px"` | Modal corner radius |
| `walletRadius` | `"10px"` | `"10px"` | Wallet card radius |

See [Theming](/docs/configuration/theming) for the full guide.

For chain and wallet selection, use [Theme Builder](/docs/theme-builder).
Share [Theme Builder for Xahau](/docs/theme-builder?chain=xahau) to open it with
Xahau selected. Wallet preview selection is not a declaration of provider
capabilities; see [Adapters Overview](/docs/adapters/overview).
