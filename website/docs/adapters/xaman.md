# Xaman Adapter

[Xaman](https://xaman.app) (formerly XUMM) is the most popular XRPL mobile wallet. It connects via OAuth 2.0 PKCE + QR code on desktop, or a deep link on mobile. No browser extension required.

## Installation

```bash
npm install @xrpl-wallet-kit/adapter-xaman
```

Get an API key from [apps.xaman.dev](https://apps.xaman.dev) and whitelist your domain.

## Quick Start

```ts
import { createXamanAdapter } from "@xrpl-wallet-kit/adapter-xaman";

const adapter = createXamanAdapter({
  apiKey: import.meta.env.VITE_XAMAN_API_KEY,
});
```

## Options

| Option | Type | Description |
|---|---|---|
| `apiKey` | `string` | Your Xaman OAuth2 API key (required when `auth` and `sdk` are not provided) |
| `auth` | `XamanPkceAuth` | Inject a pre-built PKCE auth handler (alternative to `apiKey`) |
| `sdk` | `XamanSdkLike` | Inject an already-initialised Xaman SDK instance |
| `icon` | `string` | Override the default Xaman icon (data-URI or URL) |
| `deeplink` | `(uri: string) => string` | Generate a wallet deep link URL from the Xaman payload URI |
| `onQr` | `(event) => void` | Callback with `{ adapterId, uri, deeplink?, qrPng? }` each time a payload is created — use to render QR in your own UI |
| `recoveryStorage` | `WalletStorage` | Custom storage for the pending-recovery marker (default: localStorage) |
| `maxLastLedgerSequenceExtension` | `number` | Maximum ledgers Xaman may extend a supplied `LastLedgerSequence` in sign-only requests. Default: `50`; use `0` for exact preservation |

## Connection Flow

**Desktop:** Modal shows a QR code. User scans it with the Xaman app and approves the connection request. The adapter polls for approval via the Xaman SDK.

**Mobile:** Modal shows an "Open Xaman" deep link button. Tapping it launches the Xaman app directly for approval.

The adapter triggers a Xaman OAuth2 PKCE authorize flow internally. After approval, the Xaman SDK provides the account address.

## Capabilities

| Capability | Supported |
|---|:---:|
| connect | ✅ |
| disconnect | ✅ |
| signMessage | ✅ |
| signAndSubmit | ✅ |
| qr | ✅ |
| deeplink | ✅ |
| nftOffers | ✅ |
| payments | ✅ |
| sessionRestore | ✅ |

## Message Signing

Xaman does **not** return a compact ECDSA/Ed25519 signature. Instead it creates a `SignIn` payload with the message encoded as a hex Memo, sends a push notification to the user's phone for approval, and returns the signed transaction blob as the proof.

```ts
const result = await manager.signMessage({ message: "Sign in to My dApp" });

// result.signatureKind === "signedTx"
// result.proof   — the signed Xaman SignIn transaction hex blob
// result.txBlob  — same value (alias for proof)
```

::: warning Server-side verification
`proof` is an XRPL transaction blob, not a bare signature. Server verification must decode the blob and check the transaction signature against the account's public key. If your auth flow expects a compact `signature`, use GemWallet or Crossmark instead.
:::

## Transactions

Pass standard XRPL `txJson` to `signAndSubmit`. The adapter wraps it in a Xaman payload and sends a push notification to the user's phone:

```ts
const result = await manager.signAndSubmit({
  txJson: {
    TransactionType: "Payment",
    Account: session.account.address,
    Destination: "rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe",
    Amount: "1000000",
  },
});
// result.hash — the transaction hash once submitted
```

NFT offers, TrustSet, and other transaction types follow the same pattern — pass any valid XRPL `txJson`. Xaman handles submission after user approval.

::: tip Sign-only requests
Xaman does not expose a separate `signTransaction` method, but `manager.signTransaction()` can route through `signAndSubmit({ submit: false })`. When your `txJson` includes `LastLedgerSequence`, the adapter rejects signed responses that widen that value beyond `maxLastLedgerSequenceExtension`.
:::

## Session Restore / Mobile Return Recovery

**Session restore** (`restoreSession`): on page reload, the adapter checks `sdk.state.signedIn` and retrieves the current account address. If the Xaman SDK still reports a valid session, no re-approval is needed. Restore verifies account ownership only; it preserves the manager's stored network context and does not treat Xaman refresh metadata as proof that the mobile app changed networks.

**Mobile return recovery** (`recoverSession`): when a user taps the deep link and returns to the dApp, the adapter checks for a pending-recovery marker in storage. If found (within 3 minutes), it re-runs the OAuth authorize flow to complete the connection without a fresh QR.

```ts
// On app startup — handles both restore and mobile return
await manager.autoReconnect();
```

## Known Limitations

- No `signTransaction` (sign-only without submit).
- Message signing produces a transaction blob proof, not a compact signature.
- Requires a browser environment with popup/redirect support for the OAuth2 flow.
- Domain must be whitelisted in the Xaman developer portal.

## Troubleshooting

**QR code not showing?** Check that your API key is correct and the domain is whitelisted in the Xaman developer portal.

**"Connection timed out"?** The user did not approve within the timeout window. The modal shows a retry button automatically.

**Mobile deep link not working?** Xaman must be installed on the device. If not installed, the browser redirects to the App Store / Google Play.

**`recoverSession` not completing?** The pending-recovery marker expires after 3 minutes. If the user takes longer than that to return from Xaman, a fresh QR scan is required.

## Manual Test Checklist

- [ ] Connect on desktop — QR displays, scan with Xaman, address returned
- [ ] Connect on mobile — deep link opens Xaman, approval returns address
- [ ] `signAndSubmit` — push notification sent, txn confirmed on ledger, hash returned
- [ ] `signMessage` — push notification sent, `proof`/`txBlob` returned, `signatureKind: "signedTx"`
- [ ] Page reload — `autoReconnect()` restores session without re-approval
- [ ] Mobile return recovery — deep link flow, marker present, `recoverSession` completes
- [ ] Rejection — user taps Reject in Xaman, adapter throws with correct error code
- [ ] Expired payload — wait for timeout, adapter throws with readable message
