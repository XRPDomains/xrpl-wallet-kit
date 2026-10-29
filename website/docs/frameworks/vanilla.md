# Vanilla TypeScript

Use XRPL Wallet Kit with vanilla TypeScript (Vite, Rollup, webpack) — no framework required.

## Installation

::: code-group
```sh [npm]
npm install @xrpl-wallet-kit/core @xrpl-wallet-kit/ui @xrpl-wallet-kit/adapter-gemwallet
```
```sh [yarn]
yarn add @xrpl-wallet-kit/core @xrpl-wallet-kit/ui @xrpl-wallet-kit/adapter-gemwallet
```
```sh [pnpm]
pnpm add @xrpl-wallet-kit/core @xrpl-wallet-kit/ui @xrpl-wallet-kit/adapter-gemwallet
```
:::

Or install everything at once:

::: code-group
```sh [npm]
npm install @xrpl-wallet-kit/client
```
```sh [yarn]
yarn add @xrpl-wallet-kit/client
```
```sh [pnpm]
pnpm add @xrpl-wallet-kit/client
```
:::

## One-liner Setup

The fastest path — `createWalletKit` wires up everything automatically:

```ts
import { createWalletKit } from "@xrpl-wallet-kit/client";

const { manager, openModal } = createWalletKit({
  autoReconnect: true,
  wallets: "all",
  walletConnectProjectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID,
  xamanClientId: import.meta.env.VITE_XAMAN_API_KEY,
  connectButton: "#connect-btn",   // CSS selector for your button element
});

```

```html
<!-- index.html -->
<button id="connect-btn"></button>
```

The button renders itself and opens the modal on click. `autoReconnect: true`
schedules restoration for eligible wallets; do not also call it manually.

## Manual Setup

For more control, create each piece individually:

```ts
import { WalletManager } from "@xrpl-wallet-kit/core";
import { createXamanAdapter } from "@xrpl-wallet-kit/adapter-xaman";
import { createGemWalletAdapter } from "@xrpl-wallet-kit/adapter-gemwallet";
import { createWalletConnectAdapter } from "@xrpl-wallet-kit/adapter-walletconnect";
import { WalletModal, WalletButton } from "@xrpl-wallet-kit/ui";

// 1. Create the manager
const manager = new WalletManager({
  autoReconnect: true,
  adapters: [
    createXamanAdapter({ apiKey: import.meta.env.VITE_XAMAN_API_KEY }),
    createGemWalletAdapter(),
    createWalletConnectAdapter({
      projectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID,
    }),
  ],
  network: "mainnet",
});

// 2. Create the modal
const modal = new WalletModal({
  manager,
  title: "Connect Wallet",
});

// 3. Attach a connect button
const button = new WalletButton({
  manager,
  modal,
  target: document.getElementById("connect-btn")!,
});

// 4. Restore previous session
await manager.autoReconnect();
```

## Listening to Events

```ts
manager.on("connected", ({ account }) => {
  console.log("Connected:", account.address);
  showDashboard(account.address);
});

manager.on("disconnected", () => {
  console.log("Disconnected");
  showConnectScreen();
});

manager.on("error", ({ error }) => {
  console.error("Wallet error:", error.message);
});
```

See [Events & Hooks](/docs/advanced/events-hooks) for the full event reference.

## Signing a Transaction

```ts
const result = await manager.signAndSubmit({
  txJson: {
    TransactionType: "Payment",
    Account: manager.getAccount()!.address,
    Destination: "rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe",
    Amount: "1000000", // 1 XRP in drops
  },
});

console.log("Transaction hash:", result.hash);
```

## Transaction Toasts

Add automatic toast notifications for every transaction:

```ts
import { WalletToast } from "@xrpl-wallet-kit/ui";

const toast = new WalletToast({ manager });
toast.mount();
```

Toasts appear automatically when a transaction is submitted, confirmed, or fails — no extra wiring needed.

## Next Steps

For Xahau, use the full client's `network: "xahau-mainnet"` plus a positive
`preflight.maxFeeDrops`. Manual core setup requires the Xahau protocol and chain
filters; see [Xahau Configuration](/docs/configuration/xahau). To include the
new XRPL wallets, select `"ghostsig"`, `"xyra"` or `"joey-wallet"` explicitly.

- [Theming](/docs/configuration/theming) — customize colors and fonts
- [Adapters](/docs/adapters/overview) — configure individual wallets
- [Events & Hooks](/docs/advanced/events-hooks) — full event reference
