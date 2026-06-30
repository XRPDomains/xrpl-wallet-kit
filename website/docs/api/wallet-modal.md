# WalletModal

`WalletModal` is the prebuilt connect modal UI. It handles the full connection flow: wallet list → connecting state → QR code (for mobile wallets) → error/retry.

## Import

```ts
import { WalletModal } from "@xrpl-wallet-kit/ui";
```

## Constructor

```ts
const modal = new WalletModal(options);
```

`manager` is passed inside the options object. There is no second argument.

### Options (`WalletUiOptions`)

```ts
interface WalletUiOptions {
  /** WalletManager instance — required */
  manager: WalletManager;

  /** DOM element to render the overlay into (default: document.body) */
  mount?: HTMLElement;

  /** Light/dark/auto theme mode (default: "light") */
  themeMode?: "light" | "dark" | "auto";

  /** Built-in theme preset name */
  themeName?: "default" | "light" | "dark" | "xrpl" | "minimal" | "midnight" | "glass" | "rounded" | "crisp" | "soft";

  /** Theme color/font overrides applied on top of the active mode */
  theme?: WalletUiTheme;

  /** Alias for theme overrides, useful when overriding a themeName preset */
  customTheme?: WalletUiTheme;

  /** Wallet list layout (default: "list") */
  layout?: "list" | "grid" | "card" | "icon";

  /** Modal width preset (default: "default") */
  size?: "default" | "compact" | "wide";

  /** Base font size (default: "sm") */
  textSize?: "sm" | "md" | "lg";

  /** WalletConnect sub-section display mode */
  walletConnectUiMode?: "default" | "list" | "group";

  /** Filter shown wallets by adapter ID */
  wallets?: string[];

  /** Custom wallet groups */
  groups?: WalletUiGroup[];

  /** Show small wallet group subtitles under wallet names (default: false) */
  showWalletGroup?: boolean;

  /** Modal title (default: "Connect Wallet") */
  title?: string;

  /** Footer text (default: "XRPL Wallet Kit") */
  footerText?: string;

  /** Language locale (default: "en-US") */
  language?: WalletUiLocale;

  /** Custom / partial message overrides */
  messages?: WalletUiMessagesInput;

  /** Transaction preview resolver */
  transactionPreview?: WalletTransactionPreviewResolver;
}
```

### Minimal example

```ts
const modal = new WalletModal({ manager });
```

### With theming

```ts
const modal = new WalletModal({
  manager,
  themeMode: "dark",
  themeName: "midnight",
  theme: { accent: "#10b981", radius: "20px" },
  title: "Connect your XRPL wallet",
});
```

## Methods

### open()

Open the modal (shows the wallet list).

```ts
modal.open();
```

### close()

Close the modal without disconnecting.

```ts
modal.close();
```

### isOpen()

Returns `true` if the modal is currently visible.

```ts
if (modal.isOpen()) { ... }
```

### destroy()

Remove the modal from the DOM and clean up all event listeners.

```ts
modal.destroy();
```

### updateOptions()

Update theme, language, or layout at runtime without recreating the modal.

```ts
// Switch to dark mode
modal.updateOptions({ mode: "dark" });

// Update accent and language together
modal.updateOptions({
  mode: "dark",
  customTheme: { accent: "#10b981" },
  language: "vi-VN",
});
```

`updateOptions` accepts a `WalletUiConfig` object:

```ts
interface WalletUiConfig {
  /** Light/dark/auto mode */
  mode?: "light" | "dark" | "auto";
  /** Built-in theme preset name */
  themeName?: "default" | "light" | "dark" | "xrpl" | "minimal" | "midnight" | "glass" | "rounded" | "crisp" | "soft";
  /** Theme token overrides */
  customTheme?: WalletUiTheme;
  /** Language locale */
  language?: WalletUiLocale;
  /** String overrides */
  messages?: WalletUiMessagesInput;
  /** Modal-level settings */
  modal?: {
    title?: string;
    width?: "default" | "compact" | "wide";
    footerText?: string;
    autoOpen?: boolean;
  };
  /** Wallet list settings */
  walletList?: {
    layout?: "list" | "grid" | "card" | "icon";
    wallets?: string[];
    groups?: WalletUiGroup[];
    /** Show small wallet group subtitles under wallet names (default: false) */
    showGroup?: boolean;
  };
  /** WalletConnect section settings */
  walletConnect?: {
    mode?: "default" | "list" | "group";
    cta?: "copy" | "open" | "both";
    qr?: { style?: "standard" | "dots"; showLogo?: boolean };
  };
  /** Connect button settings */
  connectButton?: {
    label?: string;
    size?: "sm" | "md" | "lg";
    variant?: "default" | "pill" | "minimal" | "outline";
    accountStatus?: "full" | "address" | "icon";
    showBalance?: boolean;
    showRecentTransactions?: boolean;
    maxVisibleTransactions?: number;
    showAdapterIcon?: boolean;
    showChevron?: boolean;
  };
  /** Account panel settings */
  accountPanel?: {
    mode?: "dropdown" | "modal";
    showAvatar?: boolean;
    copyAddress?: boolean;
    showAddressQr?: boolean;
    showRecentTransactions?: boolean;
    maxVisibleTransactions?: number;
    disconnect?: boolean;
    explorer?: boolean;
  };
  /** Identity resolution settings */
  identity?: {
    enabled?: boolean;
    fallbackToAddress?: boolean;
    resolver?: WalletIdentityResolver;
  };
  /** Toast notification settings */
  toast?: boolean | WalletToastConfig;
}
```

## Events

```ts
// Subscribe — returns unsubscribe function
const off = modal.on("open", () => console.log("modal opened"));
modal.on("close", () => console.log("modal closed"));

// Unsubscribe
off();

// Shorthand for close
modal.onClose(() => { ... });
```

---

## WalletButton

`WalletButton` is a companion connect/disconnect button that syncs with the manager state automatically.

```ts
import { WalletButton } from "@xrpl-wallet-kit/ui";

const button = new WalletButton({
  manager,
  modal,
  target: document.getElementById("connect-btn-root")!,
  label: "Connect Wallet",
  showAdapterIcon: true,
  showChevron: true,
});
```

> **Note:** The mount element is `target` (not `root`).

The button renders:
- **Disconnected:** "Connect Wallet" button → opens modal on click
- **Connected:** abbreviated address (e.g., `rXXX…XXXX`) with optional account panel

### WalletButton options

```ts
interface WalletButtonOptions {
  manager: WalletManager;
  modal: WalletModalController;
  /** CSS selector string or HTMLElement (mounted lazily if omitted) */
  target?: string | HTMLElement;
  /** Connect label (default: "Connect Wallet") */
  label?: string;
  /** Show active wallet icon when connected */
  showAdapterIcon?: boolean;
  /** Show chevron on button */
  showChevron?: boolean;
  /** Show resolved Web3 / XRP domain name */
  showWeb3Name?: boolean;
  /** Show address when no identity name resolves */
  fallbackToAddress?: boolean;
  /** Enable copy-address action in account panel */
  copyAddress?: boolean;
  /** Enable address QR in account panel */
  showAddressQr?: boolean;
  /** Enable block explorer link in account panel */
  explorer?: boolean;
  /** Enable disconnect in account panel */
  disconnect?: boolean;
  /** Enable account panel on click (default: true) */
  accountPanel?: boolean;
  accountPanelMode?: "dropdown" | "modal";
  showBalance?: boolean;
  showRecentTransactions?: boolean;
  maxVisibleTransactions?: number;
  transactionExplorerUrl?: (hash: string, network?: WalletNetwork) => string | undefined;
  size?: "sm" | "md" | "lg";
  variant?: "default" | "pill" | "minimal" | "outline";
  themeMode?: "light" | "dark" | "auto";
  theme?: WalletUiTheme;
  language?: WalletUiLocale;
  messages?: WalletUiMessagesInput;
  identityResolver?: WalletIdentityResolver;
  balanceResolver?: WalletBalanceResolver;
  explorerUrl?: (session: WalletSession) => string | undefined;
  formatAddress?: (address: string) => string;
}
```

### Mount / Destroy

```ts
// Mount to a different element after construction
button.mount(document.getElementById("other-root")!);

// Update options without recreating the button
button.updateOptions({ showBalance: true });

// Clean up DOM and event listeners
button.destroy();
```
