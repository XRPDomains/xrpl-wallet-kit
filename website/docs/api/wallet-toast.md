# WalletToast

`WalletToast` is a framework-agnostic transaction notification component. It automatically displays toast messages for XRPL transaction events: submitted, confirmed, or failed.

## Installation

```bash
npm install @xrpl-wallet-kit/ui
```

## Basic Usage

```ts
import { WalletToast } from "@xrpl-wallet-kit/ui";

const toast = new WalletToast({ manager });
toast.mount(); // mounts to document.body
```

Or use the factory helper:

```ts
import { createWalletToast } from "@xrpl-wallet-kit/ui";

const toast = createWalletToast({
  manager,
  mount: document.getElementById("app")!,
});
```

The toast listens for `tx_submitted`, `tx_confirmed`, and `tx_failed` events on `WalletManager` automatically.

## Options

```ts
interface WalletToastOptions {
  manager: WalletManager;
  mount?: HTMLElement;

  position?: "bottom-right" | "bottom-left" | "bottom-center";
  autoDismissMs?: number; // default: 5000, set to 0 to disable
  maxVisible?: number;    // default: 3

  explorerUrl?: (hash: string, network?: WalletNetwork) => string | undefined;

  themeMode?: "light" | "dark" | "auto";
  themeName?: "default" | "light" | "dark" | "xrpl" | "minimal" | "midnight" | "glass" | "rounded" | "crisp" | "soft";
  theme?: Partial<WalletUiTheme>;
  customTheme?: Partial<WalletUiTheme>;

  language?: WalletUiLocale;
  messages?: Partial<WalletUiMessages>;
}
```

## Methods

### `mount(container?)`

Mounts the toast container to the DOM. Safe to call multiple times; it remounts only if previously detached.

```ts
toast.mount();
toast.mount(document.getElementById("app")!);
```

### `clearAll()`

Immediately removes all visible toasts and cancels pending dismiss timers.

```ts
toast.clearAll();
```

### `destroy()`

Removes the toast from the DOM, cancels all timers, and detaches all WalletManager event listeners.

```ts
toast.destroy();
```

## Theming

`WalletToast` uses the same theme resolver as `WalletModal`, `WalletInline`, and `WalletButton`. If you use `createWalletKit()`, the toast inherits the resolved UI theme.

```ts
const toast = new WalletToast({
  manager,
  themeMode: "dark",
  themeName: "midnight",
  customTheme: {
    success: "#22c55e",
  },
});
```

## Custom Explorer URL

By default, toast links use the built-in XRPL explorer for the active network. Override with your own explorer:

```ts
const toast = new WalletToast({
  manager,
  explorerUrl: (hash, network) => {
    if (network?.id === "mainnet") {
      return `https://livenet.xrpl.org/transactions/${hash}`;
    }
    return `https://testnet.xrpl.org/transactions/${hash}`;
  },
});
```

## With createWalletKit

```ts
import { createWalletKit } from "@xrpl-wallet-kit/client";

const { toast } = createWalletKit({
  wallets: "all",
  walletConnectProjectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID,
  connectButton: "#connect-btn",
  ui: {
    themeName: "glass",
    toast: true,
  },
});

toast?.clearAll();
```

## Accessibility

The toast container has `role="status"` and `aria-live="polite"` so screen readers announce new toasts without interrupting the user. Each toast also has `role="status"`. The dismiss button uses the active locale's `close` message.
