# Cài XRPL Wallet Kit cho HTML legacy / jQuery

Tài liệu này dùng cho website HTML thuần, jQuery, Bootstrap hoặc code cũ đã có sẵn nút `Connect Wallet` và các hàm legacy. Mục tiêu là nhúng Wallet Kit bằng vài bước, không cần React, không cần build lại toàn bộ app.

## 1. File cần copy lên server

Build bundle trong repo wallet kit:

```bash
npm run build:browser
```

Copy các file sau vào thư mục public của website, ví dụ `/js/`:

```txt
packages/browser/dist/xrpl-wallet-kit.iife.min.js
packages/browser/dist/xrpl-wallet-kit-legacy-bridge.js
```

File `xrpl-wallet-kit.iife.min.js` là SDK chính. File `xrpl-wallet-kit-legacy-bridge.js` là helper cho website legacy.

## 2. Thêm mount point vào HTML

Đặt một div ở vị trí muốn hiện nút Wallet Kit:

```html
<div id="wallet-kit-button"></div>
<input type="hidden" class="currentAddress" />
```

Nếu site cũ đã có nút connect riêng, có thể giữ lại tạm thời:

```html
<button class="btn-connect-wallet" type="button">Connect Wallet</button>
<div id="wallet-kit-button"></div>
<input type="hidden" class="currentAddress" />
```

Bridge sẽ ẩn nút cũ khi nút Wallet Kit render thành công.

## 3. Nhúng script

Không hardcode private key hoặc secret. `xamanClientId` và `walletConnectProjectId` là public config, nên truyền qua config của website.

```html
<script src="/js/xrpl-wallet-kit.iife.min.js?v=0.1.0-beta"></script>
<script src="/js/xrpl-wallet-kit-legacy-bridge.js?v=0.1.0-beta"></script>
```

Khi browser load xong, global có sẵn:

```js
window.XRPLWalletKit
window.XRPLWalletKitLegacyBridge
```

## 4. Cấu hình tối thiểu

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

Mặc định bridge sẽ dùng:

```js
wallets: ['xaman', 'gemwallet', 'crossmark', 'dropfi', 'xrplsnap', 'walletconnect']
showWeb3Name: true
showBalance: true
buttonSize: 'lg'
accountPanelMode: 'modal'
walletConnect.mode: 'group'
reloadOnDisconnect: false
```

## 5. Cấu hình đầy đủ khuyến nghị

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
  accountPanelMode: 'modal',
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

## 6. Patch facade legacy

Nếu site cũ đã có object kiểu `xrplWalletKit.connect()`, `disconnect()`, `signAuthPayload()`, `signAndSubmit()`, có thể patch để code cũ gọi qua Wallet Kit mới:

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

Sau khi patch, code cũ có thể tiếp tục gọi:

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

`Amount` là drops:

```txt
0.001 XRP = 1000 drops
0.01 XRP  = 10000 drops
0.1 XRP   = 100000 drops
1 XRP     = 1000000 drops
```

## 8. NFT Offer

Create sell/buy offer:

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

Accept offer:

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

## 9. Sign message

```js
const result = await walletKit.manager.signMessage({
  message: 'Login to My XRPL App'
});
```

Với một số ví WalletConnect, Wallet Kit có thể dùng transaction proof dạng `Payment` submit false để tạo chữ ký tương thích ví.

## 10. Checklist khi đưa lên server

- Website phải chạy qua HTTP/HTTPS, không mở trực tiếp file HTML.
- `walletConnectProjectId` phải truyền từ config thật của app.
- `xamanClientId` phải truyền từ config thật của app.
- Không đưa private key, seed, secret lên frontend.
- Nếu thay file JS mới, thêm query version để tránh cache: `?v=20260523`.
- Nếu API reverse name dùng same-origin `/api/...`, server cần proxy JSON đúng encoding.
- Test ít nhất: connect, reconnect, disconnect, copy address, payment nhỏ, sign message, WalletConnect QR/deeplink.

## 11. Khi nào không cần bridge

Nếu là dự án mới, không có code legacy cần giữ lại, dùng trực tiếp:

```js
const kit = XRPLWalletKit.create({
  appName: 'My XRPL App',
  xamanClientId: '...',
  walletConnectProjectId: '...',
  connectButton: '#wallet-kit-button'
});
```

Bridge chỉ dành cho site cũ cần giữ flow, biến global hoặc facade cũ trong giai đoạn chuyển đổi.
