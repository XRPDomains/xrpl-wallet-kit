# HTML (Legacy / CDN)

Use XRPL Wallet Kit on pages that cannot use a bundler - a classic CMS site, a legacy app, or any plain HTML page. The IIFE bundle works with plain browser JavaScript and does not require a framework.

## Load the IIFE Bundle

```html
<!-- From CDN (pinned to the current stable release) -->
<script src="https://cdn.jsdelivr.net/npm/@xrpl-wallet-kit/browser@latest/dist/xrpl-wallet-kit.iife.min.js"></script>
```

Or self-host the file — copy it from `node_modules/@xrpl-wallet-kit/browser/dist/` to your server:

```html
<script src="/assets/xrpl-wallet-kit.iife.min.js"></script>
```

The bundle exposes a global `XRPLWalletKit` object:

```html
<script>
  var { createWalletKit, WalletManager, WalletModal, WalletButton } = XRPLWalletKit;
</script>
```

::: warning Bundle size
The IIFE bundle is large because it includes all adapters and polyfills. For production sites, prefer the modular install with a bundler.
:::

## Quick Start

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>My XRPL dApp</title>
</head>
<body>
  <!-- The connect button renders itself here -->
  <button id="connect-btn"></button>

  <script src="https://cdn.jsdelivr.net/npm/@xrpl-wallet-kit/browser@latest/dist/xrpl-wallet-kit.iife.min.js"></script>
  <script>
    var kit = XRPLWalletKit.createWalletKit({
      wallets: 'all',
      walletConnectProjectId: 'YOUR_WC_PROJECT_ID',
      connectButton: '#connect-btn',
    });

    kit.manager.recoverSession();
  </script>
</body>
</html>
```

## Manual Setup (more control)

```html
<button id="connect-btn"></button>
<div id="status"></div>

<script src="/assets/xrpl-wallet-kit.iife.min.js"></script>
<script>
  var WalletKit = XRPLWalletKit;

  var manager = new WalletKit.WalletManager({
    adapters: [
      WalletKit.createGemWalletAdapter(),
      WalletKit.createWalletConnectAdapter({
        projectId: 'YOUR_WC_PROJECT_ID'
      }),
    ],
    network: {
      id: 'mainnet',
      networkType: 'MAINNET',
      url: 'wss://xrplcluster.com',
      nativeAsset: 'XRP',
      nativeAssetDecimals: 6,
    }
  });

  var modal = new WalletKit.WalletModal({ manager: manager });

  var button = new WalletKit.WalletButton({
    manager: manager,
    modal:   modal,
    target:  document.getElementById('connect-btn'),
  });

  manager.on('connected', function (event) {
    document.getElementById('status').textContent =
      'Connected: ' + event.account.address;
  });

  manager.on('disconnected', function () {
    document.getElementById('status').textContent = 'Disconnected';
  });

  manager.recoverSession();
</script>
```

## Example: Existing Legacy Page

Call the same global API from your existing page script and keep the wallet UI mounted in a normal DOM node.

```html
<script src="/assets/xrpl-wallet-kit.iife.min.js"></script>

<script>
  var WalletKit = window.XRPLWalletKit;

  var manager = new WalletKit.WalletManager({
    adapters: [ WalletKit.createGemWalletAdapter() ],
    network: {
      id: 'mainnet',
      networkType: 'MAINNET',
      url: 'wss://xrplcluster.com',
      nativeAsset: 'XRP',
      nativeAssetDecimals: 6,
    }
  });

  var modal = new WalletKit.WalletModal({ manager: manager });

  new WalletKit.WalletButton({
    manager: manager,
    modal:   modal,
    target:  '#connect-btn',   // CSS selector string or HTMLElement both work
  });

  manager.on('connected', function (event) {
    document.getElementById('wallet-address').textContent = event.account.address;
    document.getElementById('wallet-address').hidden = false;
    document.getElementById('connect-section').hidden = true;
    document.getElementById('app-section').hidden = false;
  });

  manager.on('disconnected', function () {
    document.getElementById('app-section').hidden = true;
    document.getElementById('connect-section').hidden = false;
  });

  manager.recoverSession();
</script>
```

## Signing a Transaction

```js
document.getElementById('pay-btn').addEventListener('click', async function () {
  try {
    var result = await manager.signAndSubmit({
      txJson: {
        TransactionType: 'Payment',
        Account: manager.getAccount().address,
        Destination: 'rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe',
        Amount: '1000000',
        Fee: '12',
        Sequence: 1,
      }
    });
    alert('Transaction submitted: ' + result.hash);
  } catch (err) {
    alert('Error: ' + err.message);
  }
});
```

## Inline wallet picker

```html
<div id="wallet-picker"></div>
<script>
  var inline = new XRPLWalletKit.WalletInline({
    manager: manager,
    walletConnectUiMode: "group"
  });

  inline.on("connect", function (session) {
    console.log("Connected:", session.account.address);
  });

  inline.mount("#wallet-picker");
</script>
```

The inline picker uses normal document flow and does not create a backdrop or lock page scrolling.

## Available Global Exports

The `XRPLWalletKit` global exposes:

```js
// Factory (recommended)
XRPLWalletKit.createWalletKit(options)
XRPLWalletKit.createWalletClient(options)

// Core classes
XRPLWalletKit.WalletManager
XRPLWalletKit.WalletModal
XRPLWalletKit.WalletInline
XRPLWalletKit.WalletButton
XRPLWalletKit.WalletToast

// Adapter factories
XRPLWalletKit.createXamanAdapter(options)
XRPLWalletKit.createGemWalletAdapter()
XRPLWalletKit.createWalletConnectAdapter(options)
XRPLWalletKit.createCrossmarkAdapter()
XRPLWalletKit.createLedgerAdapter()
XRPLWalletKit.createDropfiAdapter()
XRPLWalletKit.createXrplSnapAdapter()
XRPLWalletKit.createOtsuAdapter()
```

## TypeScript in a `<script type="module">`

If your HTML page uses `<script type="module">` you can also import ESM directly from a CDN like esm.sh:

```html
<script type="module">
  import { createWalletKit } from "https://esm.sh/@xrpl-wallet-kit/client@latest";

  const { manager } = createWalletKit({
    adapters: [XRPLWalletKit.createGemWalletAdapter()],
    network: "mainnet",
  });
</script>
```

::: info
ESM imports from esm.sh do not require a bundler, but they do need a browser that supports `<script type="module">`. For maximum compatibility with older browsers, use the IIFE bundle instead.
:::

## See Also

- [Quick Start](/docs/quick-start) — modern bundler setup
- [Vanilla TypeScript guide](/docs/frameworks/vanilla) — Vite / webpack setup
- [IIFE bundle reference](/docs/api/create-wallet-kit) — full API for `createWalletKit`
