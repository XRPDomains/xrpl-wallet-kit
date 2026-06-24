# @xrpl-wallet-kit/browser

Browser-ready XRPL Wallet Kit bundle for vanilla JavaScript and legacy HTML sites.

## Install

```bash
npm install @xrpl-wallet-kit/browser
```

The package publishes:

- `dist/xrpl-wallet-kit.iife.js`
- `dist/xrpl-wallet-kit.iife.min.js`
- `dist/xrpl-wallet-kit-legacy-bridge.js`

## Basic HTML

```html
<div id="connect-wallet"></div>
<script src="./xrpl-wallet-kit.iife.min.js"></script>
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

## Legacy Bridge

Use `xrpl-wallet-kit-legacy-bridge.js` when a legacy page needs a smaller integration surface around the browser bundle. The bridge is intended for HTML/jQuery apps that want to mount the connect button and read wallet state without migrating the whole app at once.

## Notes

- Always inject `walletConnectProjectId` from the host app.
- Do not put private keys, seeds, or secrets in browser code.
- Use HTTPS in production for wallet browser APIs and mobile deep links.
