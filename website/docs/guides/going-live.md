# Going Live

Before shipping your XRPL or Xahau dApp, review the configuration and ownership
of wallet, RPC and authentication flows.

## ✅ Credentials & Config

- [ ] Replace `VITE_WALLETCONNECT_PROJECT_ID` with your own project ID from [WalletConnect Cloud](https://cloud.walletconnect.com) — the development key rate-limits you
- [ ] Register your public Xaman API key at [apps.xaman.dev](https://apps.xaman.dev) and replace the example key
- [ ] Select the intended preset: `"mainnet"` for XRPL or `"xahau-mainnet"` for Xahau
- [ ] Verify `storage` prefix doesn't conflict if you have multiple apps on the same domain

```ts
// ✅ Production
const kit = createWalletKit({
  network: "xahau-mainnet",
  wallets: ["xaman", "gemwallet", "xyra", "ledger"],
  xamanClientId: "YOUR_XAMAN_CLIENT_ID",
  preflight: { maxFeeDrops: "50000" }, // App ceiling, not a fixed fee
});
```

## ✅ Bundle

- [ ] Choose full client, selective imports or browser IIFE deliberately; `wallets` filters at runtime, not at bundle time
- [ ] Inspect emitted modules/chunks rather than assuming tree-shaking removed unused adapter SDKs
- [ ] Self-host the matching minified Xahau runtime beside the IIFE when using Xahau
- [ ] WalletConnect SDK is in a separate async chunk (verify in `dist/assets/`)
- [ ] Source maps are disabled or private for production builds

## ✅ UI / UX

- [ ] Test on **mobile** — Xaman QR scan, WalletConnect mobile pairing
- [ ] Test in **dark mode** — both auto-detect and forced dark
- [ ] Wallet **not installed** state shows the install link (GemWallet, Crossmark, MetaMask Snap)
- [ ] Connect button has a visible **loading state** during connection
- [ ] Eligible sessions restore once; Xahau and hardware flows show explicit reconnect where required
- [ ] Opt into GhostSig, Xyra and Joey Wallet on XRPL when your app needs them
- [ ] `showBalance` uses a CORS-enabled RPC/custom resolver and stays compact at the app's button width

## ✅ Error Handling

Handle the common `WalletKitError` codes your users will encounter:

```ts
import { WalletKitError, WalletKitErrorCode } from "@xrpl-wallet-kit/core";

manager.on("error", ({ error }) => {
  if (error instanceof WalletKitError) {
    switch (error.code) {
      case WalletKitErrorCode.CONNECTION_REJECTED:
      case WalletKitErrorCode.SIGN_REJECTED:
      case WalletKitErrorCode.REQUEST_CANCELLED:
        // User closed the wallet prompt — don't show an error toast
        break;
      case WalletKitErrorCode.NOT_CONNECTED:
        // Prompt the user to connect first
        showConnectPrompt();
        break;
      case WalletKitErrorCode.SIGN_FAILED:
        showError("Signing failed. Check the request and wallet.");
        break;
      default:
        showError(error.message);
    }
  }
});
```

- [ ] Connection/signing rejection and cancellation are handled without unnecessary error toasts
- [ ] `NOT_CONNECTED` redirects to connect flow
- [ ] Unknown submission outcomes are reconciled by hash/provider ID before any retry
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

- [ ] `manager.autoReconnect()` is called once on startup — not on every render
- [ ] `WalletToast` is mounted once, not per component
- [ ] Wallet approval requests start from user actions; passive detection does not prompt
- [ ] One service owns confirmation polling; reuse application balance data where available
- [ ] Xahau post-sign intent, sequence, expiry and fee checks remain enabled
- [ ] Native `signIn()` and message-auth proofs use their own server verifier and atomically consumed nonce

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
