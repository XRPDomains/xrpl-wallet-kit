---
title: Playground
description: Configure and preview the XRPL Wallet Kit modal live — layout, theme, size, and colors.
---

# Playground

Adjust the controls to see how the modal looks with your configuration. The code snippet below updates automatically.

::: info
The playground uses demo mode — no real wallet connection. Wallets are shown as empty slots to demonstrate layout and theming.
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
  network: XRPL_MAINNET,
});

// Paste your config from the playground above:
const modal = new WalletModal({
  manager,
  layout: "grid",
  theme: {
    accent: "#7c3aed",
    radius: "20px",
  },
});
```

## Theme tokens

All theme properties are optional. Unset properties fall back to the defaults shown below:

| Property | Light default | Dark default | Description |
|---|---|---|---|
| `mode` | `"auto"` | — | `"light"` / `"dark"` / `"auto"` |
| `accent` | `#2563eb` | `#3b82f6` | Primary actions, active states |
| `background` | `#ffffff` | `#0f172a` | Modal background |
| `foreground` | `#0f172a` | `#f1f5f9` | Primary text |
| `muted` | `#64748b` | `#94a3b8` | Secondary text |
| `surface` | `#f8fafc` | `#1e293b` | Wallet card background |
| `surfaceHover` | `#f1f5f9` | `#334155` | Wallet card hover |
| `border` | `#e2e8f0` | `rgba(255,255,255,.08)` | Borders |
| `overlay` | `rgba(0,0,0,0.5)` | `rgba(0,0,0,0.7)` | Backdrop |
| `radius` | `"16px"` | — | Modal corner radius |
| `walletRadius` | `"12px"` | — | Wallet card radius |
| `shadow` | `0 20px 60px rgba(0,0,0,.12)` | — | Modal drop shadow |
| `fontFamily` | `system-ui, sans-serif` | — | Font stack |

See [Theming](/docs/configuration/theming) for the full guide.
