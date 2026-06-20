# WalletButton

`WalletButton` is the prebuilt connect button from `@xrpl-wallet-kit/ui`. It handles the full connect → display address → account panel → disconnect lifecycle automatically.

## Basic usage

```ts
import { WalletManager } from "@xrpl-wallet-kit/core";
import { WalletModal, WalletButton } from "@xrpl-wallet-kit/ui";

const manager = new WalletManager({ adapters: [/* ... */], network: { /* ... */ } });
const modal   = new WalletModal({ manager });

const button = new WalletButton({
  manager,
  modal,
  target: document.getElementById("connect-btn-root")!,
});
```

```html
<!-- Place in your HTML -->
<div id="connect-btn-root"></div>
```

That's it. The button shows "Connect Wallet" when disconnected and the truncated address when connected. Clicking the address opens an account panel with copy, QR, and disconnect options.

## Options reference

```ts
interface WalletButtonOptions {
  // Required
  manager: WalletManager;
  modal:   WalletModalController;

  // Target element — where to mount the button
  target?: string | HTMLElement;    // CSS selector string or HTMLElement

  // Label shown while disconnected
  label?: string;                   // default: "Connect Wallet" (localized)

  // Connected-state display
  showAdapterIcon?: boolean;        // show wallet logo next to address (default: true)
  showChevron?: boolean;            // show ▾ chevron on the button (default: true)
  showWeb3Name?: boolean;           // show xrp.domains name if resolved (default: true)
  fallbackToAddress?: boolean;      // fall back to address if no name resolved (default: true)
  formatAddress?: (addr: string) => string;   // custom address display format

  // Account panel actions
  copyAddress?: boolean;            // show copy address action (default: true)
  showAddressQr?: boolean;          // show QR code in account panel (default: true)
  explorer?: boolean;               // show block explorer link (default: false)
  explorerUrl?: (session: WalletSession) => string | undefined;
  disconnect?: boolean;             // show disconnect action (default: true)

  // Account panel behavior
  accountPanel?: boolean;           // enable account panel (default: true)
  accountPanelMode?: "dropdown" | "modal";    // default: "modal"

  // Balance display
  showBalance?: boolean;            // show XRP balance in panel (default: false)
  balanceResolver?: WalletBalanceResolver;    // custom balance fetcher

  // Identity (web3 name)
  identityResolver?: WalletIdentityResolver; // custom name resolver

  // Size & variant
  size?: "sm" | "md" | "lg";       // default: "md"
  variant?: "default" | "pill" | "minimal" | "outline";  // default: "default"

  // Theming
  themeMode?: "light" | "dark" | "auto";     // default: "light"
  theme?: WalletUiTheme;            // token overrides (see Theming)

  // Localization
  language?: WalletUiLocale;
  messages?: WalletUiMessagesInput;

  // Callbacks
  onIdentityChange?: (identity: WalletIdentity | null, session: WalletSession | null) => void;
  onBalanceChange?: (balance: WalletBalance | null, session: WalletSession | null) => void;
}
```

## Size variants

```ts
// Small — 32px height, suitable for navigation bars
const button = new WalletButton({ manager, modal, target, size: "sm" });

// Default — 40px height (default)
const button = new WalletButton({ manager, modal, target, size: "md" });

// Large — 48px height, prominent CTAs
const button = new WalletButton({ manager, modal, target, size: "lg" });
```

## Style variants

```ts
// Default — solid accent-colored background
const button = new WalletButton({ manager, modal, target, variant: "default" });

// Pill — rounded-full border-radius
const button = new WalletButton({ manager, modal, target, variant: "pill" });

// Minimal — transparent background, text only
const button = new WalletButton({ manager, modal, target, variant: "minimal" });

// Outline — border only, no fill
const button = new WalletButton({ manager, modal, target, variant: "outline" });
```

## Account panel mode

```ts
// Dropdown — panel appears directly below the button (default on desktop)
const button = new WalletButton({
  manager,
  modal,
  target,
  accountPanelMode: "dropdown",
});

// Modal — account panel opens as a centered overlay
const button = new WalletButton({
  manager,
  modal,
  target,
  accountPanelMode: "modal",
});
```

## Balance display

Balance display is off by default. Enable it to show the XRP balance in the account panel.

```ts
const button = new WalletButton({
  manager,
  modal,
  target,
  showBalance: true,
  // Optional: supply a custom balance resolver
  balanceResolver: async ({ address, network }) => {
    const xrp = await myBalanceApi.getBalance(address);
    return { xrpBalance: xrp, symbol: "XRP" };
  },
});
```

## Custom identity (web3 name)

By default, the button uses `createXrpDomainsResolver()` to look up the address in xrp.domains. Supply your own resolver to use a different name registry:

```ts
import { WalletButton } from "@xrpl-wallet-kit/ui";

const button = new WalletButton({
  manager,
  modal,
  target,
  identityResolver: async (address, session) => {
    const name = await myNameRegistry.lookup(address);
    return name ? { name, source: "my-registry" } : null;
  },
  onIdentityChange: (identity, session) => {
    console.log("Name resolved:", identity?.name);
  },
});
```

## Custom explorer link

```ts
const button = new WalletButton({
  manager,
  modal,
  target,
  explorer: true,
  explorerUrl: (session) =>
    `https://bithomp.com/explorer/${session.account.address}`,
});
```

## Theming

The button inherits from the same token system as `WalletModal`:

```ts
const button = new WalletButton({
  manager,
  modal,
  target,
  themeMode: "dark",
  theme: {
    accent: "#7c3aed",
    radius: "999px",   // fully rounded
    fontFamily: "'Inter', sans-serif",
  },
});
```

See [Theming](/docs/configuration/theming) for the full token list.

## Update options at runtime

```ts
button.updateOptions({
  themeMode: "dark",
  showBalance: true,
});
```

## Mount/unmount

```ts
// Re-mount to a different element
button.mount(document.getElementById("new-target")!);

// Destroy and remove from DOM
button.destroy();
```

## `createWalletKit` shorthand

If you're using the all-in-one package, the button is created automatically:

```ts
import { createWalletKit } from "@xrpl-wallet-kit/client";

const kit = createWalletKit({
  adapters: [/* ... */],
  button: {
    target: "#connect-btn-root",
    size: "md",
    variant: "pill",
    showBalance: true,
    themeMode: "dark",
  },
});

// Access the button instance
kit.button.updateOptions({ themeMode: "light" });
```

## See also

- [WalletModal & WalletButton API](/docs/api/wallet-modal) — full API reference
- [Theming](/docs/configuration/theming) — theme token reference
- [Vanilla TypeScript setup](/docs/frameworks/vanilla)
- [createWalletKit](/docs/api/create-wallet-kit)
