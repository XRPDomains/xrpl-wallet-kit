# Going Live

Before shipping your XRPL dApp to production, run through this checklist.

## ✅ Credentials & Config

- [ ] Replace `VITE_WALLETCONNECT_PROJECT_ID` with your own project ID from [WalletConnect Cloud](https://cloud.walletconnect.com) — the development key rate-limits you
- [ ] Register your Xaman client ID at [apps.xaman.dev](https://apps.xaman.dev) and replace the example key
- [ ] Set `network` to **MAINNET** — remove any testnet/devnet network config
- [ ] Verify `storage` prefix doesn't conflict if you have multiple apps on the same domain

```ts
// ✅ Production
const manager = new WalletManager({
  network: {
    id: "mainnet",
    networkType: "MAINNET",
    url: "wss://xrplcluster.com",
    nativeAsset: "XRP",
    nativeAssetDecimals: 6,
  },
});
```

## ✅ Bundle

- [ ] Using **individual packages** (`@xrpl-wallet-kit/core`, `@xrpl-wallet-kit/ui`, individual adapters), not the IIFE browser bundle
- [ ] Tree-shaking is enabled — only the adapters you use are in the output
- [ ] WalletConnect SDK is in a separate async chunk (verify in `dist/assets/`)
- [ ] Source maps are disabled or private for production builds

## ✅ UI / UX

- [ ] Test on **mobile** — Xaman QR scan, WalletConnect mobile pairing
- [ ] Test in **dark mode** — both auto-detect and forced dark
- [ ] Wallet **not installed** state shows the install link (GemWallet, Crossmark, MetaMask Snap)
- [ ] Connect button has a visible **loading state** during connection
- [ ] **Session restore** works on page reload without flickering

## ✅ Error Handling

Handle the common `WalletKitError` codes your users will encounter:

```ts
import { WalletKitError, WalletKitErrorCode } from "@xrpl-wallet-kit/core";

manager.on("error", ({ error }) => {
  if (error instanceof WalletKitError) {
    switch (error.code) {
      case WalletKitErrorCode.USER_REJECTED:
        // User closed the wallet prompt — don't show an error toast
        break;
      case WalletKitErrorCode.NOT_CONNECTED:
        // Prompt the user to connect first
        showConnectPrompt();
        break;
      case WalletKitErrorCode.SIGN_FAILED:
        showError("Signing failed — please try again");
        break;
      default:
        showError(error.message);
    }
  }
});
```

- [ ] `USER_REJECTED` is handled silently (no toast) — this is normal UX
- [ ] `NOT_CONNECTED` redirects to connect flow
- [ ] Network/submission errors are shown clearly with a retry option
- [ ] Unexpected errors are reported to your error tracking service (Sentry, etc.)

## ✅ Security

- [ ] **No private keys, seeds, or secrets** in any client-side code
- [ ] Environment variables with `VITE_` or `NEXT_PUBLIC_` prefix are exposed to the client — review what you've exposed
- [ ] WalletConnect `projectId` is fine to expose client-side (it's a public identifier)
- [ ] Xaman `clientId` is fine to expose client-side
- [ ] If using `@xrpl-wallet-kit/auth`: all signature verification happens **server-side**, never in the browser

## ✅ Accessibility

- [ ] Connect button is keyboard focusable and activatable with Enter/Space
- [ ] Modal closes on `Escape` key
- [ ] Screen reader announcement works (the modal uses `role="dialog"` and `aria-modal`)
- [ ] Color contrast passes WCAG AA (4.5:1 for text) — the default themes already comply

## ✅ Performance

- [ ] `manager.recoverSession()` is called once on startup — not on every render
- [ ] `WalletToast` is mounted once, not per component
- [ ] No wallet-related network requests fire before user initiates connect

## Monitoring

Add event listeners to send wallet telemetry to your analytics service:

```ts
manager.on("connected", ({ adapterId }) => {
  analytics.track("wallet_connected", { adapter: adapterId });
});

manager.on("tx_confirmed", ({ hash }) => {
  analytics.track("transaction_confirmed", { hash });
});

manager.on("error", ({ adapterId, error }) => {
  errorTracker.capture(error, { adapter: adapterId });
});
```
