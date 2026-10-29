# Quick Start

Connect an XRPL wallet with the headless manager and optional UI. For the
all-in-one entry point, see [createWalletKit](/docs/api/create-wallet-kit).
For XAH payments and Hooks, use the [Xahau quick start](/docs/configuration/xahau#quick-start).

## 1. Create the WalletManager

`WalletManager` is the central controller. Register the adapters you want to support:

```ts
import { WalletManager } from "@xrpl-wallet-kit/core";
import { createXamanAdapter } from "@xrpl-wallet-kit/adapter-xaman";
import { createGemWalletAdapter } from "@xrpl-wallet-kit/adapter-gemwallet";
import { createWalletConnectAdapter } from "@xrpl-wallet-kit/adapter-walletconnect";

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
```

## 2. Add the UI

Drop in the prebuilt modal and connect button — no framework needed:

```ts
import { WalletModal, WalletButton } from "@xrpl-wallet-kit/ui";

// Create a container in your HTML: <div id="xwk-root"></div>
const modal = new WalletModal({
  manager,
  title: "Connect Wallet",
  layout: "auto",
  footerText: "Powered by XRPL Wallet Kit",
});

// Attach a connect button
const button = new WalletButton({
  manager,
  modal,
  target: document.getElementById("connect-btn-root")!,
});
```

```html
<!-- index.html -->
<div id="xwk-root"></div>
<div id="connect-btn-root"></div>
```

That's it. The button handles the full connect → display address → disconnect lifecycle automatically.

## 3. Listen for Events

```ts
manager.on("connected", ({ account }) => {
  console.log("Connected:", account.address);
});

manager.on("disconnected", () => {
  console.log("Disconnected");
});

manager.on("error", ({ error }) => {
  console.error("Wallet error:", error);
});
```

## 4. Sign a Transaction

Once connected, sign and submit a Payment transaction:

```ts
const result = await manager.signAndSubmit({
  txJson: {
    TransactionType: "Payment",
    Account: manager.getSession()?.account.address,
    Destination: "<recipient_address>",
    Amount: "1000000", // 1 XRP in drops
  },
});

console.log("Transaction hash:", result.hash);
```

## 5. Session Restore

With core, call `autoReconnect()` once on startup. Only wallets with an eligible
restore/recovery flow can restore. On Xahau, GemWallet supports verified restore;
other adapters require explicit reconnect:

```ts
// Call this once on app startup
const restored = await manager.autoReconnect();
if (restored) {
  console.log("Session restored:", restored.account.address);
}
```

## Full Example

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>My XRPL dApp</title>
</head>
<body>
  <div id="xwk-root"></div>
  <div id="connect-btn-root"></div>

  <script type="module">
    import { WalletManager } from "@xrpl-wallet-kit/core";
    import { createGemWalletAdapter } from "@xrpl-wallet-kit/adapter-gemwallet";
    import { WalletModal, WalletButton } from "@xrpl-wallet-kit/ui";

    const manager = new WalletManager({
      autoReconnect: true,
      adapters: [createGemWalletAdapter()],
      network: "testnet",
    });

    const modal = new WalletModal({ manager, title: "Connect Wallet" });
    const button = new WalletButton({
      manager,
      modal,
      target: document.getElementById("connect-btn-root"),
    });

    await manager.autoReconnect();
  </script>
</body>
</html>
```

The module example above assumes a bundler resolving npm imports. For an HTML
file without a build step, use the [browser bundle](/docs/frameworks/legacy-cdn).
Do not hardcode `Sequence` or `Fee`: let the adapter prepare them, or autofill
with a connected XRPL client when your chosen wallet requires prepared fields.
Check validated results before treating a submission as complete.

## Next Steps

- [Theming](/docs/configuration/theming) — customize modal colors and fonts
- [Adapters](/docs/adapters/overview) — configure individual wallets
- [GhostSig](/docs/adapters/ghostsig), [Xyra](/docs/adapters/xyra) and [Joey Wallet](/docs/adapters/joey-wallet) - opt-in XRPL wallets
- [Xahau](/docs/configuration/xahau) - configure Xaman, GemWallet, Xyra and Ledger
- [API Reference](/docs/api/wallet-manager) — full WalletManager API
