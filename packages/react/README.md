# @xrpl-wallet-kit/react

React bindings for XRPL Wallet Kit.

This package provides a provider, hooks, and a React `WalletButton` wrapper around the framework-agnostic wallet manager and UI.

## Install

```bash
npm install @xrpl-wallet-kit/react @xrpl-wallet-kit/client
```

## Choosing a setup

| You want | Use | Bundle profile |
| --- | --- | --- |
| Default wallets with the least setup | `client` + `react` | Largest |
| Selected wallets with the kit modal | `client/selective` + `react` + named adapters | Medium |
| Your own buttons and views | `core` + named adapters | Smallest |

`@xrpl-wallet-kit/client` statically includes the first-party adapter factories. For a selective build, create `WalletManager` with only the adapter packages your app supports.

## Setup

```tsx
import { createWalletKit } from "@xrpl-wallet-kit/client";
import { WalletKitProvider, WalletButton } from "@xrpl-wallet-kit/react";

const kit = createWalletKit({
  metadata: {
    name: "My XRPL App",
    description: "Wallet connection for My XRPL App",
    url: window.location.origin,
    icons: [`${window.location.origin}/icon.png`],
  },
  network: "mainnet",
  autoReconnect: true,
  walletConnectProjectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID,
  ui: {
    accountPanel: {
      showBalance: true,
      showRecentTransactions: true,
    },
    toast: true,
  },
});

export function App() {
  return (
    <WalletKitProvider manager={kit.manager}>
      <WalletButton />
    </WalletKitProvider>
  );
}
```

`WalletButton` forwards normal host attributes to its `<span>` mount and exposes both the host and controller through a ref:

```tsx
import { useRef } from "react";
import { WalletButton, type WalletButtonHandle } from "@xrpl-wallet-kit/react";

const walletButton = useRef<WalletButtonHandle>(null);

<WalletButton ref={walletButton} className="wallet-slot" aria-label="Wallet account" />;

walletButton.current?.controller?.updateOptions({ showBalance: false });
walletButton.current?.element?.focus();
```

Managed wallet options remain owned by the controller; standard host fields, event handlers, `aria-*`, and `data-*` are applied to the host element.

## Hooks

```tsx
import {
  useWalletAccount,
  useWalletCapabilities,
  useWalletKit,
  useWalletSession,
  useWalletStatus,
} from "@xrpl-wallet-kit/react";

function AccountState() {
  const status = useWalletStatus();
  const account = useWalletAccount();
  const capabilities = useWalletCapabilities();

  return (
    <pre>
      {JSON.stringify({ status, account, capabilities }, null, 2)}
    </pre>
  );
}
```

Status values:

- `disconnected`
- `connecting`
- `connected`

`useWalletKit()` also exposes `availability` and `refreshAvailability()`. Availability starts as `"unknown"` during SSR and resolves to a boolean after mount, so custom selectors can avoid hydration mismatches and disabled-wallet guesswork.

```tsx
const { wallets, availability, connect } = useWalletKit();

return wallets.map((wallet) => {
  const state = availability[wallet.id];
  return (
    <button
      key={wallet.id}
      disabled={state !== true}
      onClick={() => connect(wallet.id)}
    >
      {wallet.name}{state === "unknown" ? " (checking)" : ""}
    </button>
  );
});
```

The provider syncs connection, account, network, stale session, expired session, and transaction-related manager events so consumers re-render from wallet state changes.

## Notes

- Create the wallet kit once at module scope or inside a stable app-level initializer.
- Use `@xrpl-wallet-kit/client` for the default adapter/UI wiring.
- Use `@xrpl-wallet-kit/core` directly only when building a custom integration.
- In Next.js App Router, place the provider in a Client Component. The package publishes its own `"use client"` boundary; the local directive is still useful because the component creates browser-side configuration.
- Provider children remain in server-rendered HTML. `modal` is `null` until the client mounts; `openModal()` and `closeModal()` are safe no-ops before then.
