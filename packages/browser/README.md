# @xrpl-wallet-kit/browser

Browser-ready XRPL Wallet Kit bundle for vanilla JavaScript and legacy HTML sites.

## Install

```bash
npm install @xrpl-wallet-kit/browser
```

The package publishes:

- `dist/xrpl-wallet-kit.iife.js`
- `dist/xrpl-wallet-kit.iife.min.js`
- `dist/xrpl-wallet-kit-xahau.runtime.js` automatically loaded for Xahau operations
- `dist/xrpl-wallet-kit-legacy-bridge.js` optional compatibility helper

## Basic HTML

```html
<div id="connect-wallet"></div>
<script src="./xrpl-wallet-kit.iife.min.js"></script>
<script>
  const kit = window.XRPLWalletKit.createWalletKit({
    metadata: {
      name: "My XRPL App",
      description: "Wallet connection for My XRPL App",
      url: window.location.origin,
      icons: [window.location.origin + "/icon.png"]
    },
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

## Xahau Runtime

XRPL-only pages do not download the Xahau codec. On first Xahau transaction
preparation or lookup, the IIFE imports `xrpl-wallet-kit-xahau.runtime.js` from
the directory of its original script URL, not from the page directory.
This standalone ESM asset is fully minified, including whitespace, despite
having no `.min.js` suffix.
Self-host both assets together or use a version-pinned CDN script URL. A mixed
bundle/runtime version is rejected before wallet signing. Loading failures do
not trigger automatic transaction retries.

Allow the script directory in CSP `script-src`; `unsafe-eval` is not required.
The runtime is an ES module, so cross-origin hosting must allow CORS. Load the
IIFE with a regular external script tag so its URL can be captured; inline or
eval-based embedding cannot resolve the Xahau asset. ESM applications should
use the client package instead.

After `build:browser`, run `npm run smoke:browser:xahau` with Playwright available
(`PLAYWRIGHT_MODULE_PATH` and `PLAYWRIGHT_EXECUTABLE_PATH` can select an external
installation). This checks lazy loading, signed Invoke, shared error types, CSP,
missing assets and mismatched versions without contacting a ledger or wallet.

## Legacy Bridge

Most HTML integrations only need `xrpl-wallet-kit.iife.min.js`. Use `xrpl-wallet-kit-legacy-bridge.js` only when an older page needs compatibility helpers around the browser bundle. The bridge is intended for Legacy HTML apps that want to mount beside an existing connect button, map older adapter ids, sync session state into legacy callbacks, or patch an existing wallet facade without migrating the whole app at once.

## Notes

- Always inject `walletConnectProjectId` from the host app.
- Do not put private keys, seeds, or secrets in browser code.
- Use HTTPS in production for wallet browser APIs and mobile deep links.
