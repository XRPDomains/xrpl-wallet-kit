# XRPL Wallet Kit UI Configuration

This document describes the current public UI configuration surface so the project can keep naming, docs, and implementation aligned across HTML, React, NextJS, and mobile webviews. The preferred structure is component-based configuration instead of scattered single-purpose options.

> Note: the CSS variables section at the end is the next theming direction. The current implementation uses `ui.customTheme` through JavaScript config.

## Full Example

```ts
createWalletKit({
  appName: "My XRPL dApp",
  walletConnectProjectId: "...",
  xamanClientId: "...",
  autoReconnect: true,

  ui: {
    mode: "light",
    themeName: "default",
    language: "en-US",
    customTheme: {
      accent: "#0078ae",
      background: "#ffffff",
      foreground: "#111827",
      muted: "#64748b",
      border: "#e5e7eb",
      overlay: "rgba(15,23,42,.46)",
      surface: "#f8fafc",
      surfaceHover: "#f1f5f9",
      shadow: "none",
      radius: "14px",
      walletRadius: "10px",
      fontFamily: "Inter, system-ui, sans-serif"
    },

    modal: {
      title: "Connect Wallet",
      width: "default",
      footerText: "XRPL Wallet Kit",
      autoOpen: false
    },

    walletList: {
      layout: "list",
      wallets: "all",
      groups: undefined,
      showGroup: true,
      showInstalledBadge: true
    },

    walletConnect: {
      mode: "group",
      cta: "both",
      qr: {
        style: "dots",
        showLogo: false
      }
    },

    connectButton: {
      label: "Connect Wallet",
      size: "md",
      variant: "default",
      accountStatus: "full",
      showBalance: false,
      showAdapterIcon: true,
      showChevron: true
    },

    accountPanel: {
      mode: "modal",
      showAvatar: true,
      copyAddress: true,
      disconnect: true,
      explorer: false
    },

    toast: {
      position: "bottom-right",
      maxVisible: 3,
      autoDismissMs: 5000
    },

    identity: {
      enabled: true,
      fallbackToAddress: true,
      resolver: async (address, session) => null
    }
  }
});
```

## `ui.mode`

Controls the global theme mode.

Values:

- `light`: light UI.
- `dark`: dark UI.
- `auto`: follows the browser `prefers-color-scheme` setting.

Current default: `light`.

## `ui.themeName`

Theme preset name. The current type allows:

- `default`
- `minimal`
- `rounded`
- `compact`
- custom string for future presets

Note: the resolver does not deeply apply `themeName` yet. Use `customTheme` / `theme` for actual visual customization today.

## `ui.language`

UI language placeholder for future translations.

Examples:

- `vi-VN`
- `en-US`
- `auto`

Note: a full translation resolver is not implemented yet, so public docs should not present this as a completed feature.

## `ui.customTheme`

Customizes UI tokens through a JS object. This is the current primary way to change color, font, radius, and shadow.

```ts
customTheme: {
  accent: "#0078ae",
  background: "#ffffff",
  foreground: "#111827",
  muted: "#64748b",
  border: "#e5e7eb",
  overlay: "rgba(15,23,42,.46)",
  surface: "#f8fafc",
  surfaceHover: "#f1f5f9",
  fallbackIconBackground: "rgba(15,23,42,.06)",
  fallbackIconColor: "#111827",
  shadow: "none",
  radius: "14px",
  walletRadius: "10px",
  fontFamily: "Inter, system-ui, sans-serif"
}
```

Token meanings:

- `accent`: main accent color.
- `background`: modal/panel background.
- `foreground`: primary text color.
- `muted`: secondary text color.
- `border`: subtle border color.
- `overlay`: modal overlay background.
- `surface`: wallet item, account action, and QR card background.
- `surfaceHover`: hover/tap background without layout shift.
- `fallbackIconBackground`: background for generated/fallback icons when no wallet icon is available.
- `fallbackIconColor`: foreground color for generated/fallback icons.
- `shadow`: modal/panel shadow. Current UI prefers `none`.
- `radius`: modal/account panel radius.
- `walletRadius`: wallet item/action button radius.
- `fontFamily`: UI font stack.

When using a custom dark theme, provide at least `background`, `foreground`, `accent`, `border`, `surface`, `surfaceHover`, and `muted`. If `fallbackIconBackground` / `fallbackIconColor` are omitted, the kit uses dark/light defaults designed to keep generated icons visible.

## `ui.modal`

Wallet selection modal settings.

```ts
modal: {
  title: "Connect Wallet",
  width: "default",
  footerText: "XRPL Wallet Kit",
  autoOpen: false
}
```

Fields:

- `title`: modal title.
- `width`: modal size.
- `footerText`: small footer text.
- `autoOpen`: opens the modal when the kit is initialized.

`width` values:

- `compact`
- `default`
- `wide`

Mobile behavior: on small screens, the modal automatically becomes a full-width bottom sheet with only the top corners rounded.

## `ui.walletList`

Wallet list settings inside the modal.

```ts
walletList: {
  layout: "list",
  wallets: "all",
  groups: undefined,
  showGroup: true,
  showInstalledBadge: true
}
```

Fields:

- `layout`: wallet item layout.
- `wallets`: displayed wallet order. Use `"all"` or an adapter id array.
- `groups`: custom wallet groups.
- `showGroup`: shows a group label under the wallet name.
- `showInstalledBadge`: planned installed badge for installed extensions/snaps.

`layout` values:

- `list`: vertical list, recommended default.
- `card`: card grid.
- `icon`: icon grid.
- `grid`: compatibility alias for card grid.

Example wallet order:

```ts
walletList: {
  wallets: ["xaman", "gemwallet", "crossmark", "dropfi", "xrplsnap", "walletconnect"]
}
```

The new direction does not use include/exclude/recommended. The array order is the display order.

## `ui.walletConnect`

WalletConnect-specific UI settings.

```ts
walletConnect: {
  mode: "group",
  cta: "both",
  qr: {
    style: "dots",
    showLogo: false
  }
}
```

### `walletConnect.mode`

Values:

- `default`: shows a single WalletConnect item. Clicking it uses the default WalletConnect modal (`useModal=true`) and does not use the custom QR panel.
- `list`: shows WalletConnect wallets as individual wallet items.
- `group`: groups WalletConnect wallets under one WalletConnect item. The user clicks the group, selects a child wallet, then sees the custom QR/deeplink panel.

Current client default: `group` when no override is provided.

### `walletConnect.cta`

Planned control for QR panel action buttons.

Values:

- `copy`: Copy URI only.
- `open`: Open Wallet only.
- `both`: show both when a deeplink is available.

Note: the renderer currently prioritizes actual URI/deeplink availability. This option is kept as stable API direction.

### `walletConnect.qr`

QR configuration.

```ts
qr: {
  style: "dots",
  showLogo: false
}
```

`style` values:

- `standard`
- `dots`

The custom QR currently uses `qr-code-styling`, transparent background, and no center logo by default for better scan reliability.

## `ui.connectButton`

Connect Wallet button settings.

```ts
connectButton: {
  label: "Connect Wallet",
  size: "md",
  variant: "default",
  accountStatus: "full",
  showBalance: false,
  showAdapterIcon: true,
  showChevron: true
}
```

Fields:

- `label`: text before connection.
- `size`: button size.
- `variant`: button style.
- `accountStatus`: connected account display direction.
- `showBalance`: shows available XRP balance in the button.
- `showAdapterIcon`: shows the connected wallet icon.
- `showChevron`: shows the chevron button that opens the Account Panel.

`size` values:

- `sm`
- `md`
- `lg`

`variant` values:

- `default`
- `pill`
- `minimal`
- `outline`

`accountStatus` values:

- `full`
- `address`
- `icon`

Note: `accountStatus` is an API direction. The current implementation mostly relies on `showAdapterIcon`, `showBalance`, `showChevron`, `showWeb3Name`, and `fallbackToAddress`.

## `ui.accountPanel`

Connected account panel settings.

```ts
accountPanel: {
  mode: "modal",
  showAvatar: true,
  copyAddress: true,
  disconnect: true,
  explorer: false
}
```

Fields:

- `mode`: panel presentation. Omit it to use the default modal account panel.
- `showAvatar`: avatar display direction. The current UI renders a deterministic avatar or identity avatar when available.
- `copyAddress`: shows Copy address action.
- `disconnect`: shows Disconnect action.
- `explorer`: shows explorer action when `explorerUrl` is configured.

`mode` values:

- `dropdown`: mini modal below the Connect Wallet button.
- `modal`: centered modal on desktop, bottom sheet on mobile.

Current default: `modal`.

`modal` is the recommended default for most dApps. The account panel overlay is mounted at `document.body`, which avoids common containing-block traps caused by host containers using `transform`, `filter`, `backdrop-filter`, `contain`, or `will-change`. These CSS properties can cause `position: fixed` children to behave as if they are positioned relative to the host container instead of the viewport.

Use `dropdown` only when the connect button lives in a stable layout area and the host app controls the surrounding stacking context. Dropdown mode is useful for compact desktop toolbars, but integrators should test it inside sticky headers, glass panels, transformed containers, and mobile webviews before shipping.

## `ui.toast`

Optional transaction toast notifications.

```ts
toast: true
```

or:

```ts
toast: {
  position: "bottom-right",
  maxVisible: 3,
  autoDismissMs: 5000,
  explorerUrl: (hash, network) => undefined
}
```

Values:

- `false` or omitted: toast UI is disabled.
- `true`: enables default toast behavior.
- object: enables toast behavior with overrides.

Fields:

- `position`: `bottom-right`, `bottom-left`, or `bottom-center`.
- `maxVisible`: maximum visible toast count.
- `autoDismissMs`: auto-dismiss delay after a transaction reaches `confirmed` or `failed`. Set `0` to keep those toasts until manually dismissed.
- `explorerUrl`: optional URL resolver. When omitted, the toast uses the connected network's `explorerTxUrl` through `getExplorerTxUrl()`.

Transaction confirmation is best-effort. The kit listens for a submitted hash and does short polling when the network has an HTTP RPC URL. If confirmation is inconclusive, the toast remains in `Transaction submitted` state and keeps the `View` link so the user can inspect the transaction on an explorer.

## `ui.identity`

Web3 name / identity settings.

```ts
identity: {
  enabled: true,
  fallbackToAddress: true,
  resolver: async (address, session) => null
}
```

Fields:

- `enabled`: enables/disables Web3 name resolution.
- `fallbackToAddress`: shows a shortened address when no name is resolved.
- `resolver`: custom identity resolver.

Resolver signature:

```ts
type IdentityResolver = (
  address: string,
  session: WalletSession,
  context?: { force?: boolean }
) => WalletIdentity | string | null | Promise<WalletIdentity | string | null>;
```

`WalletIdentity` shape:

```ts
{
  name: string;
  avatar?: string;
  source?: string;
  verified?: boolean;
}
```

A resolver can return:

```ts
{ name: "btcetf.xrp", avatar: "https://...", source: "xrpdomains", verified: true }
```

or a string name, or `null`.

Resolver behavior:

- The resolver may be synchronous or asynchronous.
- It is called with the connected XRPL address and the current `WalletSession`.
- Returning a string is treated as `{ name: string }`.
- Returning `null` means no identity was found.
- If `fallbackToAddress` is `true`, the button/account panel displays a shortened address when no identity is available.
- If no resolver is provided, the kit uses the default XRP Domains resolver when identity is enabled.
- The kit caches identity results per network/address while the button controller is mounted to reduce visible label churn after reconnect or restore.
- `kit.refreshIdentity()` clears the button identity cache and calls the resolver with `{ force: true }`. Use it after your app changes a user's primary XRP name.

Default resolver helper:

```ts
import { createXrpDomainsResolver } from "@xrpl-wallet-kit/ui";

createWalletKit({
  ui: {
    identity: {
      enabled: true,
      resolver: createXrpDomainsResolver()
    }
  }
});
```

After changing a user's primary identity in your app:

```ts
await kit.refreshIdentity();
```

Disable identity resolution if the dApp wants to fully own account naming:

```ts
ui: {
  identity: {
    enabled: false,
    fallbackToAddress: true
  }
}
```

## Direct Connect Button Config

Prefer `ui.accountPanel.mode` for the account panel presentation. `connectButton` is only responsible for the button display itself:

```ts
{
  showWeb3Name: true,
  fallbackToAddress: true,
  copyAddress: true,
  explorer: false,
  disconnect: true,
  accountPanel: true,
  showBalance: false,
  identityResolver,
  balanceResolver,
  onIdentityChange,
  onBalanceChange,
  explorerUrl,
  formatAddress
}
```

## Current Adapter IDs

```ts
[
  "xaman",
  "gemwallet",
  "crossmark",
  "dropfi",
  "xrplsnap",
  "staticbit",
  "bitget",
  "joey",
  "girin",
  "bifrost"
]
```

`ledger` has an adapter direction but is currently disabled in UI/test usage.

## Recommended Configurations

### Simple dApp

```ts
ui: {
  mode: "light",
  walletList: { layout: "list", wallets: "all" },
  walletConnect: { mode: "default" },
  accountPanel: { mode: "modal" }
}
```

### Clean dApp UI

```ts
ui: {
  walletList: {
    layout: "list",
    wallets: ["xaman", "gemwallet", "crossmark", "dropfi", "xrplsnap", "walletconnect"]
  },
  walletConnect: { mode: "group" }
}
```

### Adapter Test Page

```ts
ui: {
  walletList: { layout: "list", wallets: "all", showGroup: true, showInstalledBadge: true },
  walletConnect: { mode: "list", cta: "both" },
  connectButton: { showBalance: true }
}
```

## CSS Variables Direction

The recommended theming direction is to render UI with CSS variables, while JS config remains a convenient way to set tokens. Once implemented, users can override the theme with their own CSS file.

Planned example:

```css
:root {
  --xwk-font-family: Inter, system-ui, sans-serif;
  --xwk-color-background: #ffffff;
  --xwk-color-foreground: #111827;
  --xwk-color-muted: #64748b;
  --xwk-color-surface: #f8fafc;
  --xwk-color-surface-hover: #f1f5f9;
  --xwk-color-border: #e5e7eb;
  --xwk-color-overlay: rgba(15, 23, 42, 0.46);
  --xwk-color-accent: #0078ae;
  --xwk-radius-modal: 14px;
  --xwk-radius-wallet-item: 10px;
  --xwk-shadow-modal: none;
}
```

Benefits:

- Works well for legacy HTML, React, NextJS, and mobile webviews.
- Makes a Theme Builder able to export both `.css` and `.json`.
- Avoids framework lock-in.
- Lets frontend teams customize visuals without writing JS.

## New Config Principles

- Do not add aliases unless there is a real compatibility reason.
- Do not add a config that duplicates an existing config.
- Config names must clearly describe the related UI component or behavior.
- New config must be discussed and agreed before implementation.
- VI/EN docs must be updated together whenever config is added, renamed, or removed.
