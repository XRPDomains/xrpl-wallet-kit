# Headless Core

`@xrpl-wallet-kit/core` is the foundation of the kit — **no DOM, no UI, no framework**. Use it when you want to build your own UI from scratch, integrate with a design system, or use XRPL Wallet Kit in a non-browser environment.

## When to use the headless core

- Building a custom connect button or modal in your own design system
- Integrating with Radix UI, shadcn/ui, Headless UI, or similar libraries
- Server-side auth utilities through the separate `@xrpl-wallet-kit/auth` package
- Custom hosts such as Electron, where the chosen provider/transport is available
- Testing or scripting — automating wallet interactions without UI

## Install

```sh
npm install @xrpl-wallet-kit/core
npm install @xrpl-wallet-kit/adapter-gemwallet   # add only the adapters you need
```

## Basic setup

```ts
import { WalletManager } from "@xrpl-wallet-kit/core";
import { createGemWalletAdapter } from "@xrpl-wallet-kit/adapter-gemwallet";
import { createXamanAdapter } from "@xrpl-wallet-kit/adapter-xaman";

const manager = new WalletManager({
  autoReconnect: true,
  adapters: [
    createGemWalletAdapter(),
    createXamanAdapter({ apiKey: import.meta.env.VITE_XAMAN_API_KEY }),
  ],
  network: "mainnet",
});
```

That's it. No root element, no stylesheet, no framework.

## Connecting a wallet

Connect using a specific adapter ID, or let the user choose with your own UI:

```ts
// List available adapters to build your own picker UI
const wallets = manager.getWallets(); // WalletMetadata[]
const availability = await manager.getWalletAvailability(); // { [id]: boolean }

// Connect to a specific adapter
const result = await manager.connect("gemwallet");
console.log(result.account.address); // rN7n3473...

// Or connect by adapter ID from user input
await manager.connect(selectedAdapterId);
```

## Session and state

```ts
// Get the current session (null if not connected)
const session = manager.getSession();
if (session) {
  const { address, publicKey } = session.account;
  const adapterId = session.adapterId;
}

// The core exposes sessions/events, not a getStatus() method.
const connected = manager.getSession() !== null;
```

## Subscribing to events

All UI should be driven by events — never poll.

```ts
// Connection lifecycle
manager.on("connecting", () => { /* show loading state */ });
manager.on("connected", ({ session }) => { /* update UI with session */ });
manager.on("disconnected", () => { /* clear user state */ });

// Transaction lifecycle
manager.on("tx_submitted", ({ hash }) => { /* show pending */ });
manager.on("tx_confirmed", ({ hash, result }) => { /* show success */ });
manager.on("tx_failed", ({ hash, error }) => { /* show error */ });

// Remove a specific listener
const off = manager.on("connected", handler);
off(); // remove

// Remove all listeners for an event
manager.removeAllListeners("connected"); // Only if this code owns all subscribers
```

## Signing transactions

```ts
// Sign only — returns the signed blob, does not submit
const { txBlob } = await manager.signTransaction({
  txJson: {
    TransactionType: "Payment",
    Account: manager.getAccount()!.address,
    Destination: "rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe",
    Amount: "1000000",   // 1 XRP in drops
  },
});

// Sign and submit — returns hash/status and provider data in raw
const { hash, status, raw } = await manager.signAndSubmit({
  txJson: { /* ... */ },
});
```

## Building a custom connect UI

Here's a minimal example of a custom adapter picker + connect flow:

```ts
import { adapterSupportsNetwork } from "@xrpl-wallet-kit/core";

function mountWalletPicker(manager: WalletManager, root: HTMLElement) {
  const render = () => {
    root.replaceChildren();
    const account = manager.getAccount();
    if (account) {
      const label = document.createElement("span");
      label.textContent = account.address;
      const disconnect = document.createElement("button");
      disconnect.textContent = "Disconnect";
      disconnect.onclick = () => { void manager.disconnect().catch(console.error); };
      root.append(label, disconnect);
      return;
    }
    for (const wallet of manager.getWallets()) {
      const adapter = manager.getAdapter(wallet.id)!;
      if (!adapterSupportsNetwork(adapter, manager.getNetwork())) continue;
      const button = document.createElement("button");
      button.textContent = wallet.name;
      button.onclick = () => { void manager.connect(wallet.id).catch(console.error); };
      root.append(button);
    }
  };
  const unsubscribe = [
    manager.on("connected", render), manager.on("disconnected", render),
    manager.on("session_restored", render), manager.on("walletsChanged", render),
    manager.on("accountChanged", render), manager.on("networkChanged", render),
  ];
  render();
  return () => { unsubscribe.forEach(off => off()); root.replaceChildren(); };
}
```

Availability checks can add detection hints but are not authentication. Do not
disable mobile/web/hardware choices merely because no injected extension exists.
Keep text in `textContent` rather than interpolating provider metadata into HTML.

## Session restore on startup

With `autoReconnect: true`, call `autoReconnect()` once on startup to attempt
eligible restoration. Ledger needs an explicit reconnect. On Xahau, only
GemWallet supports verified restore, with the protocol registered:

```ts
const restored = await manager.autoReconnect();
if (restored) {
  console.log("Session restored:", restored.account.address);
}
```

## React without the React package

If you're in React but don't want `@xrpl-wallet-kit/react`, you can use a `useSyncExternalStore`-based hook:

```ts
import { useSyncExternalStore, useCallback } from "react";
import type { WalletManager, WalletSession } from "@xrpl-wallet-kit/core";

export function useWalletSession(manager: WalletManager): WalletSession | null {
  const subscribe = useCallback((cb: () => void) => {
    const off1 = manager.on("connected",    cb);
    const off2 = manager.on("disconnected", cb);
    const off3 = manager.on("session_restored", cb);
    const off4 = manager.on("accountChanged", cb);
    const off5 = manager.on("networkChanged", cb);
    return () => { off1(); off2(); off3(); off4(); off5(); };
  }, [manager]);

  return useSyncExternalStore(
    subscribe,
    () => manager.getSession(),
    () => null   // SSR snapshot
  );
}
```

## Destroying the manager

Clean up event listeners and connections when the app unmounts:

```ts
manager.destroy();
```

## See also

- [WalletManager API](/docs/api/wallet-manager) — full method reference
- [Events & Hooks](/docs/advanced/events-hooks) — lifecycle events and payloads
- [Xahau](/docs/configuration/xahau#core-selective-integration) - explicit protocol setup for headless integrations
- [React integration](/docs/frameworks/react) — if you want the React package
- [Writing a Custom Adapter](/docs/advanced/custom-adapter)
