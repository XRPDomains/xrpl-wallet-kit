# Crossmark Adapter

[Crossmark](https://crossmark.io) is a browser extension wallet for XRPL. It provides extension-based signing with a WebAuthn-backed security model and a persistent SDK session layer.

## Installation

```bash
npm install @xrpl-wallet-kit/adapter-crossmark
```

## Quick Start

```ts
import { createCrossmarkAdapter } from "@xrpl-wallet-kit/adapter-crossmark";

const adapter = createCrossmarkAdapter();
```

## Options

| Option | Type | Description |
|---|---|---|
| `provider` | `CrossmarkProvider` | Override the Crossmark SDK (useful for testing) |

## Connection Flow

1. User clicks Crossmark in the connect modal
2. The adapter calls `sdk.methods.signInAndWait(randomHex)` — a random 32-byte hex challenge
3. Crossmark opens a popup for the user to approve the sign-in request
4. On approval, the adapter extracts the XRPL address from the response

The random hex challenge proves the connection is live. Crossmark re-uses `signInAndWait` for both connection and message signing.

## Capabilities

| Capability | Supported |
|---|:---:|
| connect | ✅ |
| signMessage | ✅ |
| signAndSubmit | ✅ |
| nftOffers | ✅ |
| payments | ✅ |
| sessionRestore | ✅ |
| disconnect | ❌ |
| signTransaction | ❌ |

## Message Signing

Crossmark returns a **compact message signature** (ECDSA/Ed25519). The adapter encodes the message as UTF-8 hex and calls `signInAndWait`, then extracts the signature from the response.

```ts
const result = await manager.signMessage({ message: "Verify wallet ownership" });

// result.signatureKind === "signature"
// result.proof      — same as result.signature
// result.signature  — compact hex signature
// result.publicKey  — account public key (when Crossmark includes it)
```

The adapter searches multiple response paths for the signature field (`response.data.signature`, `response.data.signedMessage`, `response.data.resp.signature`, etc.) because Crossmark's response shape has varied across versions.

## Transactions

Pass standard XRPL `txJson` to `signAndSubmit`. The adapter calls `sdk.methods.signAndSubmitAndWait(txJson)` and normalises the result:

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
// result.status — e.g. "tesSUCCESS"
// result.signed — boolean
```

NFT offers, TrustSet, and other transaction types are passed through identically — Crossmark handles the UI display based on `TransactionType`.

## Session Restore / Mobile Return Recovery

**Session restore**: on page reload, the adapter checks `sdk.sync.getAddress()` (or falls back to `sdk.session.address`). If the address matches the stored session, the session is silently restored without any popup.

The adapter waits up to 2.5 seconds for the Crossmark extension to inject before checking availability.

There is no mobile return / deeplink recovery — Crossmark is a desktop browser extension only.

## Known Limitations

- No `disconnect()` — Crossmark does not expose a provider-level disconnect. The kit clears local session storage only.
- No `signTransaction` (sign without submit) — `signAndSubmit` is the only signing path.
- The signature response path varies across Crossmark SDK versions; the adapter searches multiple paths as a fallback.

## Troubleshooting

**Extension not detected?** Verify Crossmark is installed, enabled, and not blocked by a browser privacy shield for the current domain.

**Connection popup doesn't appear?** The Crossmark SDK must be loaded. A hard reload sometimes helps if the extension didn't inject in time.

**"signInAndWait is missing"?** Your Crossmark SDK version may be too old. Update the extension or inject a fresh `provider` via the adapter option.

**Signature not extracted?** If `signMessage` throws after the user approves, the response shape may not match any expected path. Open a GitHub issue with the raw response object.

## Manual Test Checklist

- [ ] Extension detected — "Installed" badge shows in the modal
- [ ] Connect — Crossmark sign-in popup appears, address returned on approval
- [ ] `signAndSubmit` Payment — Crossmark popup shows correct txn, hash returned
- [ ] `signAndSubmit` NFT offer — Crossmark popup shows correct NFT transaction
- [ ] `signMessage` — compact signature returned, `signatureKind: "signature"`
- [ ] Page reload — `autoReconnect()` restores session using `sync.getAddress()`
- [ ] Extension not installed — modal shows install link to crossmark.io
- [ ] Rejection — user clicks Cancel, adapter throws readable error
