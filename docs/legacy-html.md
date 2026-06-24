# Legacy HTML Integration Guide

This guide shows how to add XRPL Wallet Kit to a plain HTML or jQuery application without converting the app to React or Next.js.

## 1. Copy the Browser Bundle

Build the browser package:

```powershell
npm.cmd run build:browser
```

Copy these files to your site assets:

```text
packages/browser/dist/xrpl-wallet-kit.iife.min.js
packages/browser/dist/xrpl-wallet-kit-legacy-bridge.js
```

Use the readable `xrpl-wallet-kit.iife.js` while debugging, and the minified file in production.

## 2. Add a Mount Element

```html
<div id="connect-wallet"></div>
```

## 3. Load the Bundle

```html
<script src="/assets/xrpl-wallet-kit.iife.min.js"></script>
```

## 4. Create the Kit

```html
<script>
  const kit = window.XRPLWalletKit.createWalletKit({
    appName: "My XRPL App",
    network: "mainnet",
    autoReconnect: true,
    walletConnectProjectId: "YOUR_WALLETCONNECT_PROJECT_ID",
    ui: {
      layout: "list",
      themeMode: "light",
      walletConnect: { mode: "default" },
      showWeb3Name: true,
      showBalance: true
    }
  });

  kit.button.mount("#connect-wallet");
</script>
```

## 5. Read Session State

```js
const session = kit.manager.getSession();
if (session) {
  console.log(session.account.address);
  console.log(session.wallet.name);
}
```

## 6. Listen to Events

```js
kit.manager.on("connected", function (session) {
  console.log("Connected", session.account.address);
});

kit.manager.on("disconnected", function () {
  console.log("Disconnected");
});

kit.manager.on("error", function (error) {
  console.error(error);
});
```

## 7. Signing and Transactions

Use the manager APIs from the browser global:

```js
await kit.manager.signAndSubmit({
  TransactionType: "Payment",
  Destination: "r...",
  Amount: "1000000"
});
```

For sign-only flows:

```js
const signed = await kit.manager.signTransaction({
  transaction: {
    TransactionType: "Payment",
    Destination: "r...",
    Amount: "1"
  }
});
```

## Production Notes

- Use HTTPS in production.
- Keep WalletConnect project IDs in environment or server-rendered config.
- Never hardcode wallet seeds, private keys, or secrets in the page.
- Keep business APIs outside the SDK. Wallet Kit should handle wallet/session/signing UI, not app-specific domain, NFT, or payment business rules.
