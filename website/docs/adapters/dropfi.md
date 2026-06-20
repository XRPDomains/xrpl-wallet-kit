# DropFi Adapter

[DropFi](https://dropfi.app) is a browser extension wallet for XRPL. It injects its provider into the page at `window.__xwk_dropfi` (modern) or `window.dropfi` (legacy).

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

## Connection Flow

1. User clicks DropFi in the connect modal
2. The adapter resolves the DropFi provider from the injection point (see Provider Detection below)
3. `provider.initialize()` is called to hydrate the provider state
4. `provider.connect()` opens the DropFi extension popup for user approval
5. On approval, the adapter returns the XRPL account address

## Provider Detection

The adapter resolves the DropFi provider in this priority order:

1. `options.provider` — injected directly (useful for testing or embedding)
2. `window.__xwk_dropfi` — current DropFi injection point
3. `window.dropfi` — legacy DropFi injection point
4. `window.xrpl` — only accepted when it passes the DropFi feature guard (must expose `isDropFi` or specific DropFi methods: `connect`, `getAddress`, `sendTransaction`, etc.) to avoid collision with `xrpl.js` or other XRPL extension providers

## Capabilities

| Capability | Supported |
|---|:---:|
| connect | ✅ |
| disconnect | ✅ |
| signMessage | ✅ |
| signAndSubmit | ✅ |
| payments | ✅ |
| nftOffers | ✅ |
| sessionRestore | ✅ |
| signTransaction | ❌ |

## Message Signing

DropFi returns a **compact message signature** (ECDSA/Ed25519):

```ts
const result = await manager.signMessage({ message: "Verify wallet ownership" });

// result.signatureKind === "signature"
// result.proof      — same as result.signature
// result.signature  — compact hex signature
// result.publicKey  — account public key (if DropFi exposes it)
```

Use DropFi (or GemWallet/Crossmark) when your backend expects a compact verifiable signature rather than an XRPL transaction blob.

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

## Session Restore / Mobile Return Recovery

**Session restore**: on page reload, the adapter calls `provider.isConnected()`. If connected, it fetches the current address via `provider.getAddress()` and compares with the stored session. If they match, the session is silently restored without re-approval.

There is no mobile return / deeplink recovery — DropFi is a desktop browser extension.

## Known Limitations

- No `signTransaction` (sign without submit).
- The `window.xrpl` fallback only activates when the provider passes the DropFi feature guard — it will not pick up `xrpl.js` global or other XRPL extension providers at `window.xrpl`.

## Troubleshooting

**Extension not detected?** DropFi must be installed and enabled for the current site. Verify the extension injects `window.__xwk_dropfi` or `window.dropfi` on your domain. Open DevTools and run `console.log(window.__xwk_dropfi)`.

**Provider resolves to wrong wallet?** If another wallet extension also injects at `window.xrpl`, inject the DropFi provider explicitly via `options.provider` or use the `window.__xwk_dropfi` injection point.

**"Connection rejected"?** The user dismissed the DropFi approval popup. The adapter throws a `WalletError` with code `CONNECTION_REJECTED`.

**`isConnected()` returns false on reload?** The extension may not have hydrated yet. The adapter's session restore path runs after a short delay. If the issue is consistent, file a bug on the DropFi extension repository.

## Manual Test Checklist

- [ ] Extension detected — `window.__xwk_dropfi` or `window.dropfi` present
- [ ] Connect — DropFi popup appears, address returned on approval
- [ ] `signAndSubmit` Payment — DropFi popup shows txn, hash returned
- [ ] `signAndSubmit` NFT offer — DropFi popup shows NFT txn, hash returned
- [ ] `signMessage` — compact signature returned, `signatureKind: "signature"`
- [ ] Page reload — `autoReconnect()` restores session via `isConnected()` + address match
- [ ] Extension not installed — modal shows install link to dropfi.app
- [ ] Rejection — user dismisses popup, adapter throws `CONNECTION_REJECTED`
