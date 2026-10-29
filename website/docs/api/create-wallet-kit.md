# createWalletKit

`createWalletKit` is the all-in-one entry point from `@xrpl-wallet-kit/client`.
It creates a manager and optional modal, button and transaction toast.

If you need more control, use [`createWalletClient`](#createwalletclient) instead — it only creates the `WalletManager`.

## Installation

```bash
npm install @xrpl-wallet-kit/client
```

## Usage

```ts
import { createWalletKit } from "@xrpl-wallet-kit/client";

const { manager, modal, button, toast, openModal } = createWalletKit({
  autoReconnect: true,
  metadata: {
    name: "My XRPL dApp",
    description: "Wallet connection for My XRPL dApp",
    url: window.location.origin,
    icons: [`${window.location.origin}/icon.png`],
  },
  wallets: "all",
  walletConnectProjectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID,
  xamanClientId: import.meta.env.VITE_XAMAN_API_KEY,
  connectButton: "#connect-btn",
});

```

```html
<!-- index.html -->
<button id="connect-btn"></button>
```

The connect button renders itself and opens the modal on click. Toasts are
opt-in through `ui.toast`; restoration is opt-in through `autoReconnect`.
In the example above, the kit schedules restoration once after page load.

## Options

### `CreateWalletKitOptions`

Extends all `CreateWalletClientOptions` (see below) with UI-specific fields.

```ts
interface CreateWalletKitOptions extends CreateWalletClientOptions {
  // Wallet modal — set to false to disable, or pass WalletUiConfig to customize
  modal?: boolean | (WalletUiConfig & { autoOpen?: boolean });

  // Connect button — CSS selector, DOM element, or button config object
  connectButton?: string | HTMLElement | WalletKitConnectButtonConfig;

  // Display-name preferences; custom resolver belongs in ui.identity.resolver
  identity?: {
    web3Name?: boolean;
    fallbackToAddress?: boolean;
  };
}

interface WalletKitConnectButtonConfig {
  target?: string | HTMLElement;
  label?: string;
  icon?: { type: "default" }
    | { type: "image"; src: string; alt?: string }
    | { type: "html"; html: string; ariaLabel?: string };
  size?: "sm" | "md" | "lg";
  variant?: "default" | "pill" | "minimal" | "outline";
  showAdapterIcon?: boolean;
  showChevron?: boolean;
  showBalance?: boolean | { smallScreen?: boolean; largeScreen?: boolean };
  accountStatus?: "full" | "address" | "icon"
    | { smallScreen?: "full" | "address" | "icon"; largeScreen?: "full" | "address" | "icon" };
}
```

The button config also accepts other
[`WalletButton` options](/docs/configuration/connect-button), including
`balanceResolver`, `identityResolver` and `showRecentTransactions`.

### `CreateWalletClientOptions`

```ts
interface CreateWalletClientOptions extends Omit<WalletManagerConfig, "adapters" | "storage"> {
  // dApp identity shown in WalletConnect/AppKit and future auth prompts
  metadata?: {
    name: string;
    description?: string;
    url?: string;
    icons?: string[];
  };

  // Legacy aliases. Prefer metadata for new integrations.
  appName?: string;
  appDescription?: string;
  appUrl?: string;
  appIcons?: string[];

  // Runtime selection; "all" uses the default list, not every exported adapter
  wallets?: "all" | WalletKitAdapterId[];

  // Provide pre-built adapter instances instead of auto-creation
  adapters?: WalletAdapter[];

  // Session storage — "localStorage" (default), "memory", or custom WalletStorage
  storage?: "localStorage" | "memory" | WalletStorage;

  // WalletConnect Project ID (required for WalletConnect adapter)
  walletConnectProjectId?: string;

  // Xaman OAuth client ID (required for Xaman adapter)
  xamanClientId?: string;

  // Network config
  network?: WalletNetworkId; // "mainnet", "xahau-mainnet", etc.
  networks?: WalletNetwork[];
  protocols?: readonly WalletProtocol[];
  preflight?: TransactionPreflightPolicy;
  ghostsig?: GhostsigAdapterOptions;
  xahau?: { request?: XahauRpcRequest };

  // Auto-reconnect on page load (default: false)
  autoReconnect?: boolean;

  // UI config — shared theme/locale applied to modal, button, and toast
  ui?: WalletUiConfig;
}
```

## App Metadata

Use `metadata` to identify your dApp to wallets. XRPL Wallet Kit forwards it to WalletConnect/AppKit and will reuse it for app-context UI such as connection loading and Sign-In with XRPL prompts.

```ts
createWalletKit({
  metadata: {
    name: "XRP Domains",
    description: "XRPL domains and wallet tools",
    url: "https://xrpdomains.xyz",
    icons: ["https://xrpdomains.xyz/icon.png"],
  },
  walletConnectProjectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID,
});
```

`metadata` takes precedence over the older `appName`, `appDescription`, `appUrl`, and `appIcons` fields. Those aliases remain supported for existing integrations.

## Return Value

```ts
const kit = createWalletKit(options);

kit.manager        // WalletManager instance
kit.modal          // WalletModal instance (undefined if modal: false)
kit.button         // WalletButton instance (undefined if no connectButton)
kit.toast          // WalletToast instance (undefined unless toast is enabled)
kit.openModal()    // () => void — open the modal programmatically
kit.closeModal()   // () => void — close the modal
kit.disconnect()   // Promise<void> — disconnect the active wallet
kit.switchNetwork("testnet") // switch through the active adapter when supported
kit.getSession()   // () => WalletSession | null — current session
kit.signAndSubmit  // manager.signAndSubmit (bound)
kit.signTransaction// manager.signTransaction (bound)
kit.signMessage    // manager.signMessage (bound)
kit.signIn         // wallet-native login proof (bound; capability dependent)
kit.connect("gemwallet") // explicit wallet connection
kit.on            // manager.on (bound; returns unsubscribe)
kit.off           // manager.off (bound; requires the same handler)
kit.once          // subscribe for one event
kit.subscribe     // event subscription or immediate state snapshot + updates
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
  // adapters, network, etc.
  ui: {
    nonce: window.__CSP_NONCE__, // optional CSP style nonce
    mode: "dark",
  },
});
```

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
    connectButton: {
      icon: {
        type: "image",
        src: "/brand-wallet.svg",
        alt: "MyApp wallet",
      },
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
  wallets: ["xaman", "gemwallet", "ledger", "walletconnect"],
  walletConnectProjectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID,
});
```

Available IDs: `"xaman"`, `"gemwallet"`, `"walletconnect"`, `"crossmark"`, `"ledger"`, `"dropfi"`, `"xrpl-snap"`, `"ghostsig"`, `"xyra"`, `"joey-wallet"`.

[GhostSig](/docs/adapters/ghostsig), [Xyra](/docs/adapters/xyra) and
[Joey Wallet](/docs/adapters/joey-wallet) can be enabled explicitly:

```ts
const kit = createWalletKit({
  network: "mainnet",
  wallets: ["gemwallet", "ghostsig", "xyra", "joey-wallet"],
  ui: { walletList: { layout: "auto" } },
});
```

Default XRPL lists and `wallets: "all"` exclude all three. Xyra is included by
default when Xahau is configured. The separate `"joey"` ID uses WalletConnect,
not the extension. See [Adapters Overview](/docs/adapters/overview) for defaults.

`ledger` is included on XRPL by default and requires explicit selection on Xahau.
It uses WebHID/WebUSB and never silently restores after reload. The device app
is XRP for XRPL or XAH for Xahau; connection can request the app on the hardware.

## Xahau

```ts
const kit = createWalletKit({
  network: "xahau-mainnet",
  wallets: ["xaman", "gemwallet", "xyra", "ledger"],
  xamanClientId: "YOUR_XAMAN_CLIENT_ID",
  preflight: { maxFeeDrops: "50000" }, // Application ceiling, not a fixed fee
  connectButton: "#connect-wallet",
});
```

The full client registers presets and lazily loads the protocol; no extra import
is needed. Core and `client/selective` require explicit setup. See
[Xahau Configuration](/docs/configuration/xahau) for Payment, Invoke,
HookParameters, URITokens and browser runtime hosting.

## Authentication

Check `kit.manager.can("signIn")` before using `kit.signIn(request)` for
[wallet-native authentication](/docs/auth/native-sign-in), currently Joey Wallet.
It is separate from `kit.signMessage()` and does not establish a server session.

## Custom Adapters

To mix built-in adapters with your own:

```ts
import { createWalletKit, createXamanAdapter } from "@xrpl-wallet-kit/client";
import { createMyCustomAdapter } from "./adapters/my-adapter";

createWalletKit({
  adapters: [
    createXamanAdapter({ apiKey: import.meta.env.VITE_XAMAN_API_KEY }),
    createMyCustomAdapter(),
  ],
});
```

When `adapters` is provided, the `wallets` and `walletConnectProjectId` fields are ignored.

## Session Restore

`createWalletKit({ autoReconnect: true })` schedules restoration. Do not also
call it from a startup effect. With a headless client, enable restoration and
call it once yourself:

```ts
const manager = createWalletClient({ wallets: ["gemwallet"], autoReconnect: true });
await manager.autoReconnect();
```

Restore guarantees are wallet-dependent. On Xahau, GemWallet can restore a verified
account/network with the registered protocol; other adapters require reconnect.
Cached account metadata is not backend authentication.

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
