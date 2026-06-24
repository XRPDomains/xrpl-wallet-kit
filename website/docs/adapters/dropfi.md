# DropFi Adapter

[DropFi](https://dropfi.app) is a non-custodial XRPL wallet available as a **Chrome extension** and a **mobile app** (iOS & Android). Both platforms inject the wallet provider at `window.xrpl`. The adapter detects whichever platform is active — browser extension or mobile WebView — using the same `isDropFi` feature guard.

XRPL Wallet Kit also checks `window.__xwk_dropfi` and `window.dropfi` first so host apps can preserve the DropFi provider before loading `xrpl.js` or other injected wallets.

## Installation

```bash
npm install @xrpl-wallet-kit/adapter-dropfi
```

## Quick Start

```ts
import { createDropFiAdapter } from "@xrpl-wallet-kit/adapter-dropfi";

const adapter = createDropFiAdapter();
```

## Options

| Option | Type | Description |
|---|---|---|
| `provider` | `DropFiProvider` | Override the injected provider (useful for testing) |
| `icon` | `string` | Override the default DropFi icon (data-URI or URL) |

## Supported Platforms

| Platform | How it works |
|---|---|
| **Chrome Extension** | Injects `window.xrpl` via content script on page load |
| **Mobile App (iOS / Android)** | Injects `window.xrpl` via React Native WebView when the DApp is opened inside the DropFi in-app browser |

::: tip Mobile users
Users on mobile open your DApp URL inside DropFi's built-in browser. The app injects `window.xrpl` into the WebView automatically — no QR code, no deeplink required.
:::

## Connection Flow

1. User clicks DropFi in the connect modal
2. The adapter resolves the DropFi provider from the injection point (see Provider Detection below)
3. `provider.initialize()` is called to hydrate the provider state
4. `provider.connect()` opens the DropFi approval UI (extension popup on desktop; native approval sheet on mobile)
5. On approval, the adapter returns the XRPL account address

## Provider Detection

The adapter resolves the DropFi provider in this priority order:

1. `options.provider` — injected directly (useful for testing or embedding)
2. `window.__xwk_dropfi` — optional private alias for host apps that preserve the DropFi provider before loading `xrpl.js`
3. `window.dropfi` — optional legacy/private alias
4. `window.xrpl` — the official DropFi injection point, accepted only when it passes the DropFi feature guard (must expose `isDropFi` or specific DropFi methods: `connect`, `sendTransaction`, `initialize`, etc.) to avoid collision with `xrpl.js` or other XRPL extension providers

Both the Chrome extension and the mobile app inject at `window.xrpl` with `isDropFi: true`. The adapter does not distinguish between them — the same detection and API path is used for both.

**Mobile-specific injection detail:** The mobile app first checks `window.ReactNativeWebView` exists and skips injection if `window.xrpl.isDropFi` is already set, preventing double-injection in nested WebViews.

The official provider exposes: `selectedAddress`, `connectedAccounts`, `selectedNetwork`, `network`, `endpoint`, `connect`, `disconnect`, `signMessage`, `sendTransaction`, `switchNetwork`, `changeAccount`, `initialize`, and `isConnected`. It emits events: `xrpl_selectedAddress`, `xrpl_connectedAccounts`, `xrpl_selectedNetwork`, `xrpl_disconnect`.

## Capabilities

| Capability | Extension | Mobile App |
|---|:---:|:---:|
| connect | ✅ | ✅ |
| disconnect | ✅ | ✅ |
| signMessage | ✅ | ✅ |
| signAndSubmit | ✅ | ✅ |
| payments | ✅ | ✅ |
| nftOffers | ✅ | ✅ |
| sessionRestore | ✅ | ✅ |
| switchNetwork | ✅ | ✅ |
| signTransaction | ❌ | ❌ |

## Message Signing

DropFi returns a **compact message signature** and public key:

```ts
const result = await manager.signMessage({ message: "Verify wallet ownership" });

// result.signatureKind === "signature"
// result.proof      — same as result.signature
// result.signature  — compact hex signature
// result.publicKey  — public key returned by DropFi
```

Use DropFi (or GemWallet/Crossmark) when your backend expects a compact verifiable signature rather than an XRPL transaction blob. DropFi's auth docs require the server to receive the original `message`, `signature`, and `publicKey`, convert the UTF-8 message to hex, and verify with `ripple-keypairs.verify(messageHex, signature, publicKey)`.

If DropFi returns no `signature` or no `publicKey`, the adapter raises `SIGN_REJECTED`. Apps should not fall through to a different signing method after the user has already seen a DropFi signing prompt.

## Transactions

Pass standard XRPL `txJson` to `signAndSubmit`. The adapter calls `provider.sendTransaction(txJson)` and returns the normalized result:

```ts
const result = await manager.signAndSubmit({
  txJson: {
    TransactionType: "Payment",
    Account: session.account.address,
    Destination: "rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe",
    Amount: "1000000",
  },
});
// result.hash   — transaction hash
// result.signed — boolean
```

All standard XRPL transaction types (Payment, TrustSet, NFT offers, etc.) are passed through as-is via `sendTransaction`.

## Session Restore

On page reload, the adapter calls `provider.isConnected()`. If connected, it fetches the current address via `provider.getAddress()` and compares with the stored session. If they match, the session is silently restored without re-approval.

This works identically for both the Chrome extension and the mobile in-app browser.

## Known Limitations

- No `signTransaction` (sign without submit) on either platform.
- The `window.xrpl` fallback only activates when the provider passes the DropFi feature guard — it will not pick up `xrpl.js` global or other XRPL extension providers at `window.xrpl`.
- DropFi `signMessage` is not GemWallet's `{ result: { signedMessage } }` shape. Treat the canonical DropFi shape as `{ signature, publicKey }`.
- Mobile: the DApp must be opened inside DropFi's **in-app browser** for injection to work. Opening the DApp in an external browser (Safari, Chrome) on mobile will not detect the provider.

## Troubleshooting

**Extension not detected?** DropFi must be installed and enabled for the current site. Verify the extension injects `window.__xwk_dropfi` or `window.dropfi` on your domain. Open DevTools and run `console.log(window.__xwk_dropfi)`.

**Mobile not detected?** The user must be browsing your DApp from inside the DropFi mobile app's built-in browser, not an external browser. Share a link that users can paste into DropFi's browser, or add a "Open in DropFi" button.

**Provider resolves to wrong wallet?** If another wallet extension also injects at `window.xrpl`, inject the DropFi provider explicitly via `options.provider` or use the `window.__xwk_dropfi` injection point.

**"Connection rejected"?** The user dismissed the DropFi approval UI. The adapter throws a `WalletError` with code `CONNECTION_REJECTED`.

**`isConnected()` returns false on reload?** The extension may not have hydrated yet. The adapter's session restore path runs after a short delay. If the issue is consistent, file a bug on the DropFi extension repository.

## Manual Test Checklist

**Extension (Desktop)**
- [ ] Extension detected — `window.__xwk_dropfi` or `window.dropfi` present
- [ ] Connect — DropFi popup appears, address returned on approval
- [ ] `signAndSubmit` Payment — DropFi popup shows txn, hash returned
- [ ] `signAndSubmit` NFT offer — DropFi popup shows NFT txn, hash returned
- [ ] `signMessage` — compact signature and public key returned, `signatureKind: "signature"`
- [ ] Page reload — session restored via `isConnected()` + address match
- [ ] Extension not installed — modal shows install link to dropfi.app
- [ ] Rejection — user dismisses popup, adapter throws `CONNECTION_REJECTED`

**Mobile App (iOS / Android)**
- [ ] Open DApp inside DropFi in-app browser — `window.xrpl.isDropFi` is `true`
- [ ] Connect — native approval sheet shown, address returned
- [ ] `signAndSubmit` Payment — native signing sheet shown, hash returned
- [ ] `signMessage` — compact signature and public key returned
- [ ] Page reload in WebView — session restored without re-approval
- [ ] Open DApp in external browser (Safari/Chrome) — provider not detected (expected)

## References

- [DropFi Extension](https://www.dropfi.app/docs/dropfi-extension)
- [DropFi Mobile App](https://www.dropfi.app/docs/dropfi-mobile-app)
- [DropFi Web Injection Script](https://www.dropfi.app/docs/dropfi-web-injection-script)
- [DropFi Mobile Injection Script](https://www.dropfi.app/docs/dropfi-mobile-injection-script)
- [XRPL Injection API](https://www.dropfi.app/docs/xrpl-injection-api)
- [Authentication with Message Hashing](https://www.dropfi.app/docs/authentication-with-message-hashing)
