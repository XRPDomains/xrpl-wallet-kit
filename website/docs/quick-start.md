# Quick Start

Connect your first XRPL wallet in under 5 minutes.

## 1. Create the WalletManager

`WalletManager` is the central controller. Register the adapters you want to support:

```ts
import { WalletManager } from "@xrpl-wallet-kit/core";
import { createXamanAdapter } from "@xrpl-wallet-kit/adapter-xaman";
import { createGemWalletAdapter } from "@xrpl-wallet-kit/adapter-gemwallet";
import { createWalletConnectAdapter } from "@xrpl-wallet-kit/adapter-walletconnect";

const manager = new WalletManager({
  adapters: [
    createXamanAdapter({ apiKey: import.meta.env.VITE_XAMAN_CLIENT_ID }),
    createGemWalletAdapter(),
    createWalletConnectAdapter({
      projectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID,
    }),
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

## 2. Add the UI

Drop in the prebuilt modal and connect button — no framework needed:

```ts
import { WalletModal, WalletButton } from "@xrpl-wallet-kit/ui";

// Create a container in your HTML: <div id="xwk-root"></div>
const modal = new WalletModal({
  manager,
  title: "Connect Wallet",
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
manager.on("connect", (result) => {
  console.log("Connected:", result.account.address);
});

manager.on("disconnect", () => {
  console.log("Disconnected");
});

manager.on("error", (error) => {
  console.error("Wallet error:", error.message);
});
```

## 4. Sign a Transaction

Once connected, sign and submit a Payment transaction:

```ts
const result = await manager.signAndSubmit({
  txJson: {
    TransactionType: "Payment",
    Account: manager.activeSession?.account.address,
    Destination: "rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe",
    Amount: "1000000", // 1 XRP in drops
    Fee: "12",
    Sequence: 1,
  },
});

console.log("Transaction hash:", result.hash);
```

## 5. Session Restore

On page reload, the manager automatically attempts to restore the previous session:

```ts
// Call this once on app startup
const restored = await manager.recoverSession();
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
      adapters: [createGemWalletAdapter()],
      network: {
        id: "testnet",
        networkType: "TESTNET",
        url: "wss://s.altnet.rippletest.net:51233",
        nativeAsset: "XRP",
        nativeAssetDecimals: 6,
      },
    });

    const modal = new WalletModal({ manager, title: "Connect Wallet" });
    const button = new WalletButton({
      manager,
      modal,
      target: document.getElementById("connect-btn-root"),
    });

    await manager.recoverSession();
  </script>
</body>
</html>
```

## Next Steps

- [Theming](/docs/configuration/theming) — customize modal colors and fonts
- [Adapters](/docs/adapters/overview) — configure individual wallets
- [API Reference](/docs/api/wallet-manager) — full WalletManager API
