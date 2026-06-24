# WalletConnect Adapter

[WalletConnect](https://walletconnect.com) is an open protocol that lets users connect any compatible wallet by scanning a QR code. The XRPL Wallet Kit adapter supports WalletConnect v2 with two usage modes: a **single generic entry** or **per-wallet detail entries** (Bitget, Girin, etc.).

## Installation

```bash
npm install @xrpl-wallet-kit/adapter-walletconnect
```

Get a free Project ID from [cloud.walletconnect.com](https://cloud.walletconnect.com).

## Quick Start

```ts
import { createWalletConnectAdapter } from "@xrpl-wallet-kit/adapter-walletconnect";

const adapter = createWalletConnectAdapter({
  projectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID,
  // useModal: true and modalMode: "always" are the defaults —
  // the AppKit QR modal opens on both desktop and mobile.
});
```

## Options

| Option | Type | Default | Description |
|---|---|---|---|
| `projectId` | `string` | **required** | WalletConnect Cloud Project ID |
| `useModal` | `boolean` | `true` | Use WalletConnect's built-in AppKit QR modal |
| `modalMode` | `"mobile-only"` \| `"always"` \| `"never"` | `"always"` | When to show the modal. `"always"` = desktop + mobile; `"mobile-only"` = emit `qr` on desktop, AppKit on mobile; `"never"` = always emit `qr` |
| `metadata` | `AppMetadata` | — | Your app's name, description, URL, and icons shown in the wallet |
| `themeMode` | `"light"` \| `"dark"` | — | Force light or dark theme for the AppKit modal |
| `signMessage` | `boolean` | `true` | Enable `xrpl_signMessage` capability (set `false` to disable) |
| `deeplink` | `(uri: string) => string` | — | Generate a wallet-specific deep link URL from the WC URI |
| `onQr` | `(event) => void` | — | Callback invoked with the WC URI when `useModal` is false or on desktop in `"mobile-only"` mode |
| `id` | `string` | `"walletconnect"` | Adapter ID (used when registering multiple WC adapters) |
| `name` | `string` | `"WalletConnect"` | Display name in the wallet list |
| `icon` | `string` | WC icon | Icon URL or data-URI |
| `requestTimeoutMs` | `number` | `120000` | Timeout for WC connection handshake (ms) |
| `signRequestTimeoutMs` | `number` | — | Override timeout for sign requests only |

## Connection Flow

### Option A — WalletConnect built-in modal (default)

`useModal: true` (the default) delegates QR rendering to WalletConnect's AppKit. `modalMode: "always"` (also the default) shows the modal on both desktop and mobile.

```ts
const adapter = createWalletConnectAdapter({
  projectId: "YOUR_PROJECT_ID",
  themeMode: "dark",     // optional: match your app theme
  metadata: {
    name:        "My XRPL dApp",
    description: "Trade on XRPL",
    url:         "https://mydapp.example.com",
    icons:       ["https://mydapp.example.com/icon.png"],
  },
});
```

`modalMode` controls when the AppKit modal appears:

| `modalMode` | Desktop | Mobile |
|---|---|---|
| `"always"` (default) | AppKit modal | AppKit modal |
| `"mobile-only"` | emits `qr` event | AppKit modal |
| `"never"` | emits `qr` event | emits `qr` event |

### Option B — Custom QR screen

Set `modalMode: "never"` and handle the `onQr` callback yourself:

```ts
const adapter = createWalletConnectAdapter({
  projectId: "YOUR_PROJECT_ID",
  onQr: ({ uri, deeplink }) => {
    renderQrCode(uri);
    if (deeplink) showDeeplinkButton(deeplink);
  },
});
```

## Multi-Wallet Setup

`createWalletConnectAdapters` (plural) creates a list of per-wallet adapters — each wallet appears as its own row in the connect modal.

```ts
import { createWalletConnectAdapters } from "@xrpl-wallet-kit/adapter-walletconnect";

// mode: "default" — one generic WalletConnect entry
const adapters = createWalletConnectAdapters({
  projectId: "YOUR_PROJECT_ID",
  mode: "default",
});

// mode: "details" — individual entries: Bitget, Girin, Bifrost, Joey, StaticBit …
const adapters = createWalletConnectAdapters({
  projectId: "YOUR_PROJECT_ID",
  mode:    "details",
  wallets: "all",          // or ["bitget", "girin"] to pick specific wallets
});
```

Detail-mode adapters (`"details"`) do **not** background-restore sessions on page load. This is intentional — each wallet deeplink flow is user-initiated.

## Supported Wallets (`"details"` mode)

| Wallet | ID | Universal Link |
|---|---|---|
| Bitget Wallet | `bitget` | `bitkeep.com` |
| Joey Wallet | `joey` | `joey.finance` |
| Girin Wallet | `girin` | `girin.io` |
| Bifrost Wallet | `bifrost` | `bifrostwallet.com` |
| StaticBit | `staticbit` | `staticbit.io` |

## Capabilities

| Capability | Supported |
|---|:---:|
| connect | ✅ |
| disconnect | ✅ |
| signMessage | ✅ (enabled by default; set `signMessage: false` to disable) |
| signTransaction | ✅ |
| signAndSubmit | ✅ |
| sessionRestore | ✅ |
| qr | ✅ |
| deeplink | ✅ |

## Namespace Details

All methods are declared as **optional namespaces** (`optionalNamespaces`) for maximum wallet compatibility. Wallets that don't implement a method will still connect.

| Method | Namespace | Purpose |
|---|---|---|
| `xrpl_signTransaction` | optional | Sign + submit transactions |
| `xrpl_signTransactionFor` | optional | Sign on behalf of another account |
| `xrpl_signMessage` | optional | Sign an arbitrary message |
| **Chain** | `xrpl:0` | XRPL mainnet |

::: info Why optional namespaces?
Using `requiredNamespaces` blocks wallets that haven't declared a method in their manifest, even if they support it. Optional namespaces maximise compatible wallet count.
:::

## Message Signing

WalletConnect does **not** support raw cryptographic message signing via XRPL. Instead, `signMessage` constructs a 1-drop `Payment` transaction (Amount: `"1"`) with the message encoded as a hex Memo, sends it to the wallet for signing, and returns the signed blob **without submitting**.

```ts
const result = await manager.signMessage({ message: "Verify wallet ownership" });

// result.signatureKind === "signedTx"
// result.proof   — the signed XRPL Payment transaction hex blob
// result.txBlob  — same value (alias for proof)
```

::: warning Server-side verification
`proof` is a signed XRPL transaction blob, not a compact signature. Server verification must decode the blob and validate the transaction signature against the account's public key.
:::

## Transactions

Pass standard XRPL `txJson` via `xrpl_signTransaction`. The wallet handles display and approval:

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

## Session Restore / Mobile Return Recovery

**Session restore** (`restoreSession`): on page reload, the adapter looks up the stored WalletConnect session topic in the WC v2 client. If the session is still active, it is restored silently without re-approval.

**Mobile return recovery**: detail-mode adapters (Bitget, Girin, etc.) do not background-restore — each reconnect is user-initiated. Request-time stale WalletConnect proposal/key/pairing errors are caught; the adapter clears stale sessions/pairings and returns a reconnect-friendly error.

```ts
// On startup — handles session restore
await manager.autoReconnect();
```

## Known Limitations

- WalletConnect v2 only; v1 is not supported.
- `signMessage` returns a transaction blob proof, not a compact signature.
- Session expiry is managed by the WalletConnect cloud relay; expired sessions require re-scanning the QR.
- Detail-mode adapters (Bitget, Girin, etc.) do not background-restore sessions on page load.
- Wrong network: XRPL mainnet chain ID is `xrpl:0`. WalletConnect does not enforce network switching on XRPL — communicate the expected network to users out-of-band.

## Troubleshooting

**QR code expires?** WalletConnect URIs are valid for a limited time. The modal shows a retry button that regenerates a fresh URI automatically.

**Session lost after page refresh?** Call `manager.autoReconnect()` on startup. WalletConnect sessions are persisted in `localStorage` and restored without re-approval.

**Warning: `requiredNamespaces are deprecated`?** Upgrade to `@xrpl-wallet-kit/adapter-walletconnect` ≥ 0.1.3 — all namespaces are now declared as optional.

**Stale pairing/proposal error on reconnect?** The adapter automatically clears stale WalletConnect proposals and pairings before retrying. If reconnect still fails, call `manager.disconnect()` and start a fresh connection.

## Manual Test Checklist

- [ ] Connect via AppKit modal (desktop) — QR displays, wallet connects, address returned
- [ ] Connect via AppKit modal (mobile) — deep link opens wallet app, approval returns address
- [ ] Connect via custom QR (`modalMode: "never"`) — `onQr` callback fires with URI
- [ ] `signAndSubmit` — wallet popup shows txn, hash returned after approval
- [ ] `signMessage` — wallet popup shows message txn, `signatureKind: "signedTx"` returned
- [ ] Page reload — `autoReconnect()` restores session from stored WC topic
- [ ] Session expiry — QR retry button shown, fresh QR generated
- [ ] Rejection — user cancels in wallet, adapter throws readable error
- [ ] `createWalletConnectAdapters` `"details"` mode — per-wallet entries shown, deeplinks work
