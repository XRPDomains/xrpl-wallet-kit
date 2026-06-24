# Adapters Overview

An adapter is the only layer in XRPL Wallet Kit that talks directly to a wallet or provider. Core and UI consume only the adapter's `metadata`, `capabilities`, manager events, and normalized results — they never touch wallet-specific APIs.

## Built-In Adapters

| Adapter | Package | Wallet Type | Runtime |
|---|---|---|---|
| [Xaman](/docs/adapters/xaman) | `@xrpl-wallet-kit/adapter-xaman` | Mobile app (OAuth2 + QR / deep link) | Browser |
| [GemWallet](/docs/adapters/gemwallet) | `@xrpl-wallet-kit/adapter-gemwallet` | Browser extension | Browser |
| [WalletConnect](/docs/adapters/walletconnect) | `@xrpl-wallet-kit/adapter-walletconnect` | Multi-wallet QR protocol | Browser |
| [Crossmark](/docs/adapters/crossmark) | `@xrpl-wallet-kit/adapter-crossmark` | Browser extension | Browser |
| [Ledger](/docs/adapters/ledger) | `@xrpl-wallet-kit/adapter-ledger` | Hardware wallet (USB/HID) | Browser |
| [DropFi](/docs/adapters/dropfi) | `@xrpl-wallet-kit/adapter-dropfi` | Extension + Mobile App | Browser / Mobile |
| [XRPL Snap](/docs/adapters/xrpl-snap) | `@xrpl-wallet-kit/adapter-xrpl-snap` | MetaMask Snap | Browser |
| [Otsu Wallet](/docs/adapters/otsu) | `@xrpl-wallet-kit/adapter-otsu` | Browser extension (MV3) | Browser |

## Capability Matrix

| Adapter | connect | disconnect | signMessage | signTx | signAndSubmit | signMessage proof type |
|:---|:---:|:---:|:---:|:---:|:---:|:---|
| Xaman | ✅ | ✅ | ✅ | — | ✅ | `signedTx` (SignIn blob) |
| GemWallet | ✅ | — | ✅ | — | ✅ | `signature` (compact) |
| WalletConnect | ✅ | ✅ | ✅ | ✅ | ✅ | `signedTx` (Payment blob) |
| Crossmark | ✅ | ✅ | ✅ | ✅ | ✅ | `signature` (compact) |
| Ledger | ✅ | ✅ | — | ✅ | ✅ | — |
| DropFi | ✅ | ✅ | ✅ | — | ✅ | `signature` (compact) |
| XRPL Snap | ✅ | — | ✅ | — | ✅ | `signedTx` (Payment blob) |
| Otsu Wallet | ✅ | ✅ | ✅ | ✅ | ✅ | `signature` (compact) |

> **signMessage proof types:** `signature` = compact ECDSA/Ed25519 hex; `signedTx` = signed XRPL transaction blob. Read `signatureKind` on the result to know which you received.

## Recommended Setup

Most apps should use `createWalletKit()` or `WalletManager` directly:

```ts
import { WalletManager } from "@xrpl-wallet-kit/core";
import { createXamanAdapter } from "@xrpl-wallet-kit/adapter-xaman";
import { createGemWalletAdapter } from "@xrpl-wallet-kit/adapter-gemwallet";
import { createWalletConnectAdapter } from "@xrpl-wallet-kit/adapter-walletconnect";

const manager = new WalletManager({
  adapters: [
    createXamanAdapter({ apiKey: import.meta.env.VITE_XAMAN_API_KEY }),
    createGemWalletAdapter(),
    createWalletConnectAdapter({
      projectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID,
    }),
  ],
  network: XRPL_MAINNET,
});
```

Pass adapters in the order you want them listed in the modal.

## WalletConnect Modes

WalletConnect supports two factory functions:

```ts
// Single generic entry — AppKit QR modal, desktop + mobile (default behavior)
import { createWalletConnectAdapter } from "@xrpl-wallet-kit/adapter-walletconnect";
const adapter = createWalletConnectAdapter({ projectId: "..." });

// Per-wallet entries (Bitget, Girin, Bifrost, Joey, StaticBit …)
import { createWalletConnectAdapters } from "@xrpl-wallet-kit/adapter-walletconnect";
const adapters = createWalletConnectAdapters({ projectId: "...", mode: "details" });
```

Only `mode: "details"` wallet entries use `modalMode: "mobile-only"` or `"never"` by default, routing desktop users to a custom QR panel. The generic entry and `mode: "default"` always use `modalMode: "always"`.

## Message Signing Result Shape

`signMessage()` always returns a `SignMessageResult`. Read `signatureKind` to know what kind of proof you received:

```ts
const result = await manager.signMessage({ message: "Sign in to My dApp" });

if (result.signatureKind === "signature") {
  // Compact ECDSA/Ed25519 hex — verify with the account's public key
  console.log(result.proof);       // hex signature
  console.log(result.publicKey);   // may be provided by the wallet
} else {
  // signatureKind === "signedTx"
  // Signed XRPL transaction blob — verify by decoding the transaction
  console.log(result.proof);       // hex tx blob
  console.log(result.txBlob);      // same value
}
```

Adapters that return `signedTx`: Xaman (uses `SignIn` tx), WalletConnect, XRPL Snap (both use a 1-drop Payment with message in Memos).

Adapters that return `signature`: GemWallet, Crossmark, DropFi, Otsu Wallet.

## Session Restore

All adapters support session restore on page reload — the manager calls `autoReconnect()` and the adapter verifies whether the previously stored session is still valid:

```ts
// On app startup, restore any previous session silently
await manager.autoReconnect();
```

Restore behavior varies by wallet type:

- **Browser extensions** (GemWallet, Crossmark, Otsu): check whether the extension still reports the same active address — passive, no popup.
- **DropFi**: same passive check via `isConnected()` — works identically for both the Chrome extension and the mobile in-app browser.
- **Xaman**: verify via saved SDK state; no new QR or deep link needed.
- **WalletConnect**: look up the stored session topic in the SignClient store; restore without re-approval if still valid.
- **Hardware (Ledger)**: USB device must be re-connected and unlocked — no silent restore.

## Availability Detection

```ts
const adapter = createGemWalletAdapter();
if (!await adapter.isAvailable()) {
  window.open("https://gemwallet.app", "_blank");
}
```

The manager uses this automatically to show **"Installed"** badges in the wallet list.

