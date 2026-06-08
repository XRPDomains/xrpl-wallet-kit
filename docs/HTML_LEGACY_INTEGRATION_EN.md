# Install XRPL Wallet Kit in Legacy HTML / jQuery Sites

This guide is for plain HTML, jQuery, Bootstrap, or older frontend apps that already have their own `Connect Wallet` button or legacy wallet functions. The goal is to add XRPL Wallet Kit with a few script tags and one initialization call. React is not required.

## 1. Files to Copy to Your Server

Build the browser bundle from the wallet kit repository:

```bash
npm run build:browser
```

Copy these files into your public directory, for example `/js/`:

```txt
packages/browser/dist/xrpl-wallet-kit.iife.min.js
packages/browser/dist/xrpl-wallet-kit-legacy-bridge.js
```

`xrpl-wallet-kit.iife.min.js` is the main SDK. `xrpl-wallet-kit-legacy-bridge.js` is the helper for legacy websites.

## 2. Add a Mount Point

Place a div where the Wallet Kit button should render:

```html
<div id="wallet-kit-button"></div>
<input type="hidden" class="currentAddress" />
```

If your old site already has a connect button, you can keep it temporarily:

```html
<button class="btn-connect-wallet" type="button">Connect Wallet</button>
<div id="wallet-kit-button"></div>
<input type="hidden" class="currentAddress" />
```

The bridge hides the legacy button after the Wallet Kit button renders successfully.

## 3. Load the Scripts

Do not hardcode private keys, seeds, or secrets in frontend code. `xamanClientId` and `walletConnectProjectId` are public integration config values and should come from your app config.

```html
<script src="/js/xrpl-wallet-kit.iife.min.js?v=0.1.0-beta"></script>
<script src="/js/xrpl-wallet-kit-legacy-bridge.js?v=0.1.0-beta"></script>
```

After both scripts load, these globals are available:

```js
window.XRPLWalletKit
window.XRPLWalletKitLegacyBridge
```

## 4. Minimal Setup

```html
<script>
  window.walletKit = XRPLWalletKitLegacyBridge.mount({
    target: '#wallet-kit-button',
    legacyButton: '.btn-connect-wallet',
    hiddenAddress: '.currentAddress',

    appName: 'My XRPL App',
    appDescription: 'Wallet connection for My XRPL App',
    appUrl: window.location.origin,
    appIcons: [window.location.origin + '/favicon/favicon-96x96.png'],

    network: 'mainnet',
    storage: 'localStorage',
    autoReconnect: true,

    xamanClientId: 'YOUR_XAMAN_CLIENT_ID',
    walletConnectProjectId: 'YOUR_WALLETCONNECT_PROJECT_ID'
  });
</script>
```

Default bridge behavior:

```js
wallets: ['xaman', 'gemwallet', 'crossmark', 'dropfi', 'xrplsnap', 'walletconnect']
showWeb3Name: true
showBalance: true
buttonSize: 'lg'
accountPanel.mode: 'modal'
walletConnect.mode: 'group'
reloadOnDisconnect: false
```

## 5. Recommended Full Setup

```js
window.walletKit = XRPLWalletKitLegacyBridge.mount({
  target: '#wallet-kit-button',
  legacyButton: '.btn-connect-wallet',
  hiddenAddress: '.currentAddress',

  appName: 'My XRPL App',
  appDescription: 'My XRPL identity and payment app',
  appUrl: window.location.origin,
  network: 'mainnet',
  storage: 'localStorage',
  autoReconnect: true,

  xamanClientId: window.APP_CONFIG.xamanClientId,
  walletConnectProjectId: window.APP_CONFIG.walletConnectProjectId,

  showWeb3Name: true,
  showBalance: true,
  buttonSize: 'lg',
  reloadOnDisconnect: true,

  identityEndpoint: '/api/xrplnft/getName',
  identityProfileEndpoint: '/api/xrplnft/getAddress',

  ui: {
    mode: 'light',
    modal: {
      title: 'Connect Wallet',
      width: 'default',
      footerText: 'XRPL Wallet Kit'
    },
    walletList: {
      layout: 'list',
      wallets: 'all',
      showGroup: true,
      showInstalledBadge: true
    },
    walletConnect: {
      mode: 'group',
      cta: 'both',
      qr: {
        style: 'dots',
        showLogo: false
      }
    },
    accountPanel: {
      mode: 'modal',
      copyAddress: true,
      disconnect: true,
      explorer: false
    },
    identity: {
      enabled: true,
      fallbackToAddress: true
    }
  },

  onSession: function (session, legacy) {
    window.currentAddress = legacy.address;
    window.currentAdapter = legacy.adapter;
  },

  onConnected: async function (session, legacy, kit) {
    console.log('Connected:', legacy.address, legacy.adapter);
  },

  onDisconnected: function () {
    console.log('Disconnected');
  },

  onError: function (error) {
    console.error(error);
  }
});
```

When the legacy app changes the user's primary XRP name, refresh the visible identity without reloading the page:

```js
await window.walletKit.refreshIdentity();
```

## 6. Patch a Legacy Facade

If the old site already uses an object such as `xrplWalletKit.connect()`, `disconnect()`, `signAuthPayload()`, or `signAndSubmit()`, patch it so existing code routes through the new Wallet Kit:

```js
XRPLWalletKitLegacyBridge.patchLegacyFacade({
  facade: window.xrplWalletKit,
  kit: window.walletKit,

  getAdapter: function () {
    return window.currentAdapter;
  },

  getCurrentAddress: function () {
    return window.currentAddress;
  },

  onDisconnect: async function () {
    window.currentAddress = '';
    window.currentAdapter = '';
  }
});
```

After patching, legacy code can keep calling:

```js
await xrplWalletKit.connect('gemwallet');
await xrplWalletKit.disconnect();
await xrplWalletKit.signAuthPayload('Login message');
await xrplWalletKit.signAndSubmit(txJson, { methodHint: 'payment' });
```

## 7. Payment signAndSubmit

```js
const session = walletKit.manager.getSession();

const result = await walletKit.manager.signAndSubmit({
  methodHint: 'payment',
  submit: true,
  txJson: {
    TransactionType: 'Payment',
    Account: session.account.address,
    Destination: 'rDestinationAddress...',
    Amount: '100000'
  }
});
```

`Amount` is drops:

```txt
0.001 XRP = 1000 drops
0.01 XRP  = 10000 drops
0.1 XRP   = 100000 drops
1 XRP     = 1000000 drops
```

## 8. NFT Offers

Create a sell or buy offer:

```js
const session = walletKit.manager.getSession();

await walletKit.manager.signAndSubmit({
  methodHint: 'createNFTOffer',
  submit: true,
  txJson: {
    TransactionType: 'NFTokenCreateOffer',
    Account: session.account.address,
    NFTokenID: 'NFTOKEN_ID',
    Amount: '1000000',
    Flags: 1
  }
});
```

Accept an offer:

```js
const session = walletKit.manager.getSession();

await walletKit.manager.signAndSubmit({
  methodHint: 'acceptNFTOffer',
  submit: true,
  txJson: {
    TransactionType: 'NFTokenAcceptOffer',
    Account: session.account.address,
    NFTokenSellOffer: 'OFFER_ID'
  }
});
```

## 9. Sign a Message

```js
const result = await walletKit.manager.signMessage({
  message: 'Login to My XRPL App'
});
```

For some WalletConnect wallets, Wallet Kit may use a transaction proof with `Payment` and `submit: false` to produce a compatible signature flow.

## 10. Production Checklist

- Serve the website through HTTP/HTTPS. Do not open the HTML file directly from disk.
- Pass a real `walletConnectProjectId` from your app config.
- Pass a real `xamanClientId` from your app config.
- Never expose private keys, seeds, or secrets in frontend code.
- When replacing JS files, add a cache-busting query string such as `?v=20260523`.
- If reverse-name APIs use same-origin `/api/...`, make sure your server proxy returns valid JSON with correct encoding.
- Test connect, reconnect, disconnect, copy address, a small payment, sign message, WalletConnect QR, and mobile deeplinks.

## 11. When You Do Not Need the Bridge

For a new app without legacy globals or old wallet facade code, use the SDK directly:

```js
const kit = XRPLWalletKit.create({
  appName: 'My XRPL App',
  xamanClientId: '...',
  walletConnectProjectId: '...',
  connectButton: '#wallet-kit-button'
});
```

The bridge is only for older sites that need to preserve existing global variables, buttons, or facade methods during migration.
