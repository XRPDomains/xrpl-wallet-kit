# HTML/jQuery Browser Bundle Preview

This example shows the beta browser-bundle integration style for legacy HTML or jQuery apps.

Build the bundle first:

```bash
npm run build:browser
```

Then open `examples/html-jquery/index.html` from a local server, or copy:

```txt
packages/browser/dist/xrpl-wallet-kit.iife.js
packages/browser/dist/xrpl-wallet-kit.iife.min.js
```

into your app and load the minified file in production.

The browser global is:

```js
window.XRPLWalletKit
```

The simple entrypoint is:

```js
XRPLWalletKit.create({
  appName: "My dApp",
  walletConnectProjectId: "...",
  xamanClientId: "...",
  connectButton: "#connect-wallet"
});
```

For this preview, set your keys in `window.XRPL_WALLET_KIT_DEMO_CONFIG` inside `index.html`:

```js
window.XRPL_WALLET_KIT_DEMO_CONFIG = {
  xamanClientId: "",
  walletConnectProjectId: ""
};
```

Empty keys intentionally disable the corresponding adapters so the example does not ship fake credentials.

For the bundled local preview:

```bash
npm run dev:html-jquery
```

Open:

```txt
http://127.0.0.1:5175/
```
