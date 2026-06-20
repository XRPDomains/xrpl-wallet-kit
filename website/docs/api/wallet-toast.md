# WalletToast

`WalletToast` is a zero-dependency transaction notification component that automatically displays toast messages for XRPL transaction events — submitted, confirmed, or failed — without any framework.

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

Or use the factory helper which mounts automatically when a `mount` container is provided:

```ts
import { createWalletToast } from "@xrpl-wallet-kit/ui";

const toast = createWalletToast({
  manager,
  mount: document.getElementById("app")!,
});
```

The toast listens for `tx_submitted`, `tx_confirmed`, and `tx_failed` events on `WalletManager` automatically. No manual wiring needed.

## Options

```ts
interface WalletToastOptions {
  // Required
  manager: WalletManager;

  // Mount container — passed to mount() automatically by createWalletToast()
  mount?: HTMLElement;

  // Position on screen (default: "bottom-right")
  position?: "bottom-right" | "bottom-left" | "bottom-center";

  // Auto-dismiss delay in ms after confirmed/failed (default: 5000, set to 0 to disable)
  autoDismissMs?: number;

  // Max toasts shown at once (default: 3, oldest removed first)
  maxVisible?: number;

  // Custom explorer URL builder — overrides the built-in network explorer
  explorerUrl?: (hash: string, network?: WalletNetwork) => string | undefined;

  // Theme
  themeMode?: "light" | "dark" | "auto";
  theme?: Partial<WalletUiTheme>;

  // Localization
  language?: WalletUiLocale;
  messages?: Partial<WalletUiMessages>;
}
```

## Methods

### `mount(container?)`

Mounts the toast container to the DOM. Safe to call multiple times — re-mounts only if previously detached.

```ts
toast.mount();                              // appends to document.body
toast.mount(document.getElementById("app")!); // appends to a specific element
```

### `clearAll()`

Immediately removes all visible toasts and cancels pending dismiss timers.

```ts
toast.clearAll();
```

### `destroy()`

Removes the toast from the DOM, cancels all timers, and detaches all WalletManager event listeners. Call this when tearing down your app.

```ts
toast.destroy();
```

## Theming

`WalletToast` inherits the same theme tokens as `WalletModal`. If you're already using `createWalletKit()`, the toast is automatically themed to match the modal.

```ts
import { walletUiThemes } from "@xrpl-wallet-kit/ui";

const toast = new WalletToast({
  manager,
  themeMode: "dark",
  theme: walletUiThemes.dark(),
});
```

## Custom Explorer URL

By default, toast links to the XRPL explorer for the active network. Override with your own explorer:

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

If you use `createWalletKit()`, a `WalletToast` is created and mounted automatically. Access it via the returned object:

```ts
import { createWalletKit } from "@xrpl-wallet-kit/client";

const { toast } = createWalletKit({
  wallets: "all",
  walletConnectProjectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID,
  connectButton: "#connect-btn",
});

// Manually clear all toasts
toast?.clearAll();
```

## Accessibility

The toast container has `role="status"` and `aria-live="polite"` — screen readers announce new toasts without interrupting the user. Each individual toast has `role="status"` as well. The dismiss button includes an `aria-label` sourced from the active locale's `close` message key.

## `createWalletToast` helper

```ts
function createWalletToast(options: WalletToastOptions): WalletToast
```

Creates a `WalletToast` and immediately mounts it to `options.mount` if provided. Equivalent to:

```ts
const toast = new WalletToast(options);
if (options.mount) toast.mount(options.mount);
return toast;
```
