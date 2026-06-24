# @xrpl-wallet-kit/ui

Framework-agnostic UI components for XRPL Wallet Kit.

## Install

```sh
npm install @xrpl-wallet-kit/core @xrpl-wallet-kit/ui
```

## WalletModal

Use `WalletModal` for the default full-screen overlay flow.

```ts
import { WalletModal } from "@xrpl-wallet-kit/ui";

const modal = new WalletModal({ manager });
modal.open();
```

## WalletInline

Use `WalletInline` when the wallet picker must render inside a page, drawer, onboarding step, or host-managed sheet.

```ts
import { WalletInline } from "@xrpl-wallet-kit/ui";

const inline = new WalletInline({
  manager,
  themeMode: "dark",
  layout: "list",
  walletConnectUiMode: "group",
});

inline.on("connect", (session) => {
  console.log("Connected", session.account.address);
});

inline.mount("#wallet-section");

// Later:
inline.destroy();
```

`WalletInline` reuses the modal wallet list, WalletConnect group/list flow, QR states, themes, and translations. It does not create a backdrop, lock page scrolling, handle Escape, or render a close button.

Phase 1 intentionally does not add `WalletInline` to `createWalletKit`; instantiate it directly when an embedded picker is required.

## WalletButton

`WalletButton` renders the connect/account control and opens a compatible modal controller.

```ts
import { WalletButton, WalletModal } from "@xrpl-wallet-kit/ui";

const modal = new WalletModal({ manager });
const button = new WalletButton({
  manager,
  modal,
  target: "#connect-wallet",
});
```

See the project documentation for complete options, theming, i18n, and WalletConnect configuration.
