# Headless Core

`@xrpl-wallet-kit/core` is the foundation of the kit — **no DOM, no UI, no framework**. Use it when you want to build your own UI from scratch, integrate with a design system, or use XRPL Wallet Kit in a non-browser environment.

## When to use the headless core

- Building a custom connect button or modal in your own design system
- Integrating with Radix UI, shadcn/ui, Headless UI, or similar libraries
- Server-side utilities — nonce generation, message validation, session parsing
- React Native or Electron apps where the DOM-based UI doesn't apply
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
  adapters: [
    createGemWalletAdapter(),
    createXamanAdapter({ apiKey: import.meta.env.VITE_XAMAN_CLIENT_ID }),
  ],
  network: {
    id: "mainnet",
    networkType: "MAINNET",
    url: "wss://xrplcluster.com",
    nativeAsset: "XRP",
    nativeAssetDecimals: 6,
  },
});
```

That's it. No root element, no stylesheet, no framework.

## Connecting a wallet

Connect using a specific adapter ID, or let the user choose with your own UI:

```ts
// List available adapters to build your own picker UI
const adapters = manager.getAdapters();
// [{ id: "gemwallet", name: "GemWallet", icon: "...", isAvailable: true }, ...]

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

// Get current connection status
const status = manager.getStatus();
// "idle" | "connecting" | "connected" | "disconnecting" | "error"
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
manager.off("connected");
```

## Signing transactions

```ts
// Sign only — returns the signed blob, does not submit
const { signedTxBlob } = await manager.signTransaction({
  txJson: {
    TransactionType: "Payment",
    Account: session.account.address,
    Destination: "rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe",
    Amount: "1000000",   // 1 XRP in drops
    Fee: "12",
    Sequence: 1,
  },
});

// Sign and submit — returns hash + result
const { hash, result } = await manager.signAndSubmit({
  txJson: { /* ... */ },
});
```

## Building a custom connect UI

Here's a minimal example of a custom adapter picker + connect flow:

```ts
class WalletPickerUI {
  private manager: WalletManager;
  private root: HTMLElement;

  constructor(manager: WalletManager, root: HTMLElement) {
    this.manager = manager;
    this.root = root;
    this.subscribeToManager();
    this.render();
  }

  private subscribeToManager() {
    this.manager.on("connecting",   () => this.render());
    this.manager.on("connected",    () => this.render());
    this.manager.on("disconnected", () => this.render());
    this.manager.on("error",        () => this.render());
  }

  private render() {
    const status  = this.manager.getStatus();
    const session = this.manager.getSession();

    if (status === "connected" && session) {
      this.root.innerHTML = `
        <div class="wallet-info">
          <span>${session.account.address.slice(0, 10)}…</span>
          <button id="wk-disconnect">Disconnect</button>
        </div>`;
      this.root.querySelector("#wk-disconnect")
        ?.addEventListener("click", () => this.manager.disconnect());
      return;
    }

    if (status === "connecting") {
      this.root.innerHTML = `<div class="wallet-loading">Connecting…</div>`;
      return;
    }

    // Show adapter list
    const adapters = this.manager.getAdapters();
    this.root.innerHTML = `
      <div class="wallet-picker">
        <h3>Connect Wallet</h3>
        ${adapters.map(a => `
          <button class="adapter-btn" data-id="${a.id}" ${!a.isAvailable ? "disabled" : ""}>
            <img src="${a.icon}" width="24" height="24" alt="" />
            ${a.name}
            ${!a.isAvailable ? " (not installed)" : ""}
          </button>
        `).join("")}
      </div>`;

    this.root.querySelectorAll<HTMLButtonElement>(".adapter-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        this.manager.connect(btn.dataset.id!).catch(console.error);
      });
    });
  }

  destroy() {
    this.manager.off("connecting");
    this.manager.off("connected");
    this.manager.off("disconnected");
    this.manager.off("error");
    this.root.innerHTML = "";
  }
}
```

## Session restore on startup

Always call `recoverSession()` once on app load to restore the previous session without prompting the user:

```ts
const restored = await manager.recoverSession();
if (restored) {
  console.log("Session restored:", restored.account.address);
}
```

## React without the React package

If you're in React but don't want `@xrpl-wallet-kit/react`, you can use a `useSyncExternalStore`-based hook:

```ts
import { useSyncExternalStore, useEffect, useRef } from "react";
import type { WalletManager, WalletSession } from "@xrpl-wallet-kit/core";

export function useWalletSession(manager: WalletManager): WalletSession | null {
  const subscribe = useRef((cb: () => void) => {
    const off1 = manager.on("connected",    cb);
    const off2 = manager.on("disconnected", cb);
    const off3 = manager.on("session_restored", cb);
    return () => { off1(); off2(); off3(); };
  }).current;

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
- [Events & Hooks](/docs/advanced/events-hooks) — all 17 events with payloads
- [React integration](/docs/frameworks/react) — if you want the React package
- [Writing a Custom Adapter](/docs/advanced/custom-adapter)
