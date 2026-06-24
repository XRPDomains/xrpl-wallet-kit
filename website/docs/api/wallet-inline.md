# WalletInline

`WalletInline` renders the wallet picker in normal document flow. It is intended for onboarding pages, drawers, sidebars, multi-step forms, documentation previews, and host-managed mobile sheets.

It shares wallet list, WalletConnect group/list, custom QR, theme, and i18n rendering with `WalletModal`.

## Import

```ts
import { WalletInline } from "@xrpl-wallet-kit/ui";
```

## Basic usage

```html
<section id="wallet-section"></section>
```

```ts
const inline = new WalletInline({
  manager,
  themeMode: "light",
  layout: "list",
});

inline.mount("#wallet-section");
```

The mount target is required and may be a selector or an `HTMLElement`.

## Connection event

```ts
const offConnect = inline.on("connect", (session) => {
  console.log(session.account.address);
});

// Remove only this listener.
offConnect();
```

The manager remains the source of truth. Existing manager events such as `connected`, `error`, and `qr` continue to work normally.

## Lifecycle

```ts
inline.isMounted(); // true while attached
inline.destroy();   // removes DOM and manager listeners
```

Calling `mount()` again moves the picker to the new target and replaces its previous inline root.

## Options

`WalletInline` accepts the same visual and wallet-selection options as `WalletModal`:

```ts
const inline = new WalletInline({
  manager,
  themeMode: "dark",
  theme: { accent: "#0ea5e9" },
  layout: "grid",
  size: "wide",
  textSize: "md",
  wallets: ["xaman", "gemwallet", "walletconnect"],
  walletConnectUiMode: "group",
  language: "en-US",
});
```

## Differences from WalletModal

| Concern | WalletModal | WalletInline |
| --- | --- | --- |
| Position | Fixed overlay | Normal document flow |
| Backdrop | Yes | No |
| Page scroll lock | Yes | No |
| Close button / Escape | Yes | No |
| Mount target | Optional | Required |
| Wallet and QR rendering | Shared | Shared |

`WalletInline` is intentionally not created by `createWalletKit()` in phase 1. This keeps the default integration small and avoids introducing a second automatic UI lifecycle.
