# createWalletKit

`createWalletKit` is the all-in-one convenience entry point from `@xrpl-wallet-kit/client`. It creates a `WalletManager`, a `WalletModal`, a `WalletButton`, and a `WalletToast` in a single call with sensible defaults.

If you need more control, use [`createWalletClient`](#createwalletclient) instead — it only creates the `WalletManager`.

## Installation

```bash
npm install @xrpl-wallet-kit/client
```

## Usage

```ts
import { createWalletKit } from "@xrpl-wallet-kit/client";

const { manager, modal, button, toast, openModal } = createWalletKit({
  wallets: "all",
  walletConnectProjectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID,
  xamanClientId: import.meta.env.VITE_XAMAN_CLIENT_ID,
  connectButton: "#connect-btn",
});

await manager.recoverSession();
```

```html
<!-- index.html -->
<button id="connect-btn"></button>
```

That's all you need. The connect button renders itself, the modal opens on click, toasts appear for transactions, and sessions are restored on reload.

## Options

### `CreateWalletKitOptions`

Extends all `CreateWalletClientOptions` (see below) with UI-specific fields.

```ts
interface CreateWalletKitOptions extends CreateWalletClientOptions {
  // Wallet modal — set to false to disable, or pass WalletUiConfig to customize
  modal?: boolean | (WalletUiConfig & { autoOpen?: boolean });

  // Connect button — CSS selector, DOM element, or button config object
  connectButton?: string | HTMLElement | WalletKitConnectButtonConfig;

  // Identity resolver for on-chain display names (XRP Domains, etc.)
  identity?: {
    resolve: WalletIdentityResolver;
    cacheMs?: number;
  };
}
```

### `CreateWalletClientOptions`

```ts
interface CreateWalletClientOptions {
  // Adapters to register — defaults to all installed adapters when "all" is used
  wallets?: "all" | WalletKitAdapterId[];

  // Provide pre-built adapter instances instead of auto-creation
  adapters?: WalletAdapter[];

  // Session storage — "localStorage" (default), "memory", or a custom StorageAdapter
  storage?: "localStorage" | "memory" | StorageAdapter;

  // WalletConnect Project ID (required for WalletConnect adapter)
  walletConnectProjectId?: string;

  // Xaman OAuth client ID (required for Xaman adapter)
  xamanClientId?: string;

  // Network config
  network?: WalletNetwork;

  // Auto-reconnect on page load (default: true)
  autoReconnect?: boolean;

  // UI config — shared theme/locale applied to modal, button, and toast
  ui?: WalletUiConfig;
}
```

## Return Value

```ts
const kit = createWalletKit(options);

kit.manager        // WalletManager instance
kit.modal          // WalletModal instance (undefined if modal: false)
kit.button         // WalletButton instance (undefined if no connectButton)
kit.toast          // WalletToast instance (undefined if no modal)
kit.openModal()    // () => void — open the modal programmatically
kit.closeModal()   // () => void — close the modal
kit.disconnect()   // () => void — disconnect the active wallet
kit.getSession()   // () => WalletSession | null — current session
kit.signAndSubmit  // manager.signAndSubmit (bound)
kit.signTransaction// manager.signTransaction (bound)
kit.signMessage    // manager.signMessage (bound)
kit.refreshAccount()    // force-refresh account data shown in button
kit.refreshBalance()    // force-refresh balance in button
kit.refreshIdentity()   // force-refresh identity (name/avatar) in button
```

## Customizing the Modal

Pass a `WalletUiConfig` object to the `modal` option:

```ts
createWalletKit({
  wallets: "all",
  walletConnectProjectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID,
  modal: {
    mode: "dark",
    themeName: "midnight",
    customTheme: { accent: "#7c3aed" },
    modal: { title: "Connect to MyApp", width: "default" },
    autoOpen: true,   // open the modal immediately on page load
  },
});
```

See [WalletUiConfig](/docs/api/wallet-modal#walletuiconfig) for the full interface.

For app-wide UI settings, prefer the top-level `ui` option. It is shared by the modal, connect button, account panel, and toast:

```ts
createWalletKit({
  wallets: "all",
  walletConnectProjectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID,
  connectButton: "#connect-btn",
  ui: {
    mode: "dark",
    themeName: "glass",
    customTheme: {
      accent: "#10b981",
      accentText: "#ffffff",
    },
    accountPanel: {
      showRecentTransactions: true,
      maxVisibleTransactions: 5,
    },
    toast: true,
  },
});
```

## Recent Transactions in the Account Panel

Recent transactions are opt-in. Enable them through the shared `ui.accountPanel` config when using the all-in-one kit:

```ts
const kit = createWalletKit({
  wallets: "all",
  walletConnectProjectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID,
  connectButton: "#connect-btn",
  ui: {
    accountPanel: {
      showRecentTransactions: true,
      maxVisibleTransactions: 5,
    },
  },
});
```

When `showRecentTransactions` is enabled, `manager.signAndSubmit()` records submitted transactions with a hash and the account panel shows compact rows with status, shortened hash, relative time, and an explorer link. The section only appears when there are transactions for the active account/network.

For custom flows, add entries manually:

```ts
kit.manager.addTransaction({
  hash: "A1B2...",
  status: "submitted",
  submittedAt: Date.now(),
  account: kit.getSession()?.account,
});
```

## Selecting Specific Wallets

```ts
createWalletKit({
  wallets: ["xaman", "gemwallet", "walletconnect"],
  walletConnectProjectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID,
});
```

Available IDs: `"xaman"`, `"gemwallet"`, `"walletconnect"`, `"crossmark"`, `"ledger"`, `"dropfi"`, `"xrpl-snap"`, `"otsu"`.

## Custom Adapters

To mix built-in adapters with your own:

```ts
import { createWalletKit, createXamanAdapter } from "@xrpl-wallet-kit/client";
import { createMyCustomAdapter } from "./adapters/my-adapter";

createWalletKit({
  adapters: [
    createXamanAdapter({ apiKey: import.meta.env.VITE_XAMAN_CLIENT_ID }),
    createMyCustomAdapter(),
  ],
});
```

When `adapters` is provided, the `wallets` and `walletConnectProjectId` fields are ignored.

## Session Restore

Call `recoverSession()` once on startup:

```ts
const { manager } = createWalletKit({ wallets: "all", ... });
await manager.recoverSession();
```

## `createWalletClient`

A lighter variant that returns only a `WalletManager` with no UI:

```ts
import { createWalletClient } from "@xrpl-wallet-kit/client";

const manager = createWalletClient({
  wallets: "all",
  walletConnectProjectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID,
});
```

Use this when you're building your own UI or using a framework integration.

## TypeScript

All option types are exported from `@xrpl-wallet-kit/client`:

```ts
import type {
  CreateWalletKitOptions,
  CreateWalletClientOptions,
  WalletKitAdapterId,
  WalletKitUiConfig,
} from "@xrpl-wallet-kit/client";
```
