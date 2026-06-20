# XRPL Snap Adapter

[XRPL Snap](https://snaps.metamask.io) brings XRPL support to MetaMask via the Snaps extension system. Users who already have MetaMask can manage XRPL accounts without installing a separate wallet.

## Installation

```bash
npm install @xrpl-wallet-kit/adapter-xrpl-snap
```

## Quick Start

```ts
import { createXrplSnapAdapter } from "@xrpl-wallet-kit/adapter-xrpl-snap";

const adapter = createXrplSnapAdapter({
  snapId: "npm:xrpl-snap",  // default, can be overridden for custom snaps
});
```

## Requirements

- MetaMask **v11+** (Flask or production with Snaps enabled)
- The XRPL Snap is installed automatically on first connect if not already present

## Options

| Option | Type | Default | Description |
|---|---|---|---|
| `snapId` | `string` | `"npm:xrpl-snap"` | The Snap ID to install and invoke |
| `ethereum` | `Eip1193Provider` | `window.ethereum` | Override the EIP-1193 provider (useful for testing) |
| `icon` | `string` | — | Override the default MetaMask icon (data-URI or URL) |
| `signMessageDestination` | `string` | connected account | XRPL destination address for the 1-drop Payment used in `signMessage` |
| `signMessageMethods` | `string[]` | `["xrpl_sign", "xrpl_signTransaction", "npm:xrpl-snap"]` | Snap methods to try in order when signing a message |

## Connection Flow

1. User clicks XRPL Snap in the connect modal
2. MetaMask prompts to install the XRPL Snap (if not already installed)
3. User approves the Snap installation and permissions
4. MetaMask shows a connection approval popup
5. Adapter receives the XRPL account address

The Snap is installed once and stays available for future connections.

## Capabilities

| Capability | Supported |
|---|:---:|
| connect | ✅ |
| signMessage | ✅ |
| signAndSubmit | ✅ |
| payments | ✅ |
| nftOffers | ✅ |
| sessionRestore | ✅ |
| disconnect | ❌ |
| signTransaction | ❌ |

## Message Signing

XRPL Snap does **not** support raw cryptographic message signing. Instead, `signMessage` constructs a **1-drop Payment** transaction (Amount: `"1"`, Fee: `"15"`) with the message encoded as a hex Memo, and asks the Snap to sign it. The signed blob is returned **without submitting** to the network.

```ts
const result = await manager.signMessage({ message: "Verify wallet ownership" });

// result.signatureKind === "signedTx"
// result.proof   — the signed XRPL Payment transaction hex blob
// result.txBlob  — same value (alias for proof)
```

::: warning Server-side verification
`proof` is a signed XRPL transaction blob, not a compact signature. Server verification must decode the blob and validate the transaction signature against the account's public key. Do not attempt to verify it as a compact ECDSA/Ed25519 signature.
:::

The adapter tries multiple sign methods in order (`signMessageMethods`) to accommodate different Snap versions. `signMessageDestination` sets the Payment destination; it defaults to the connected account (self-transfer).

## Transactions

Standard XRPL `txJson` is passed to the Snap via `invokeSnap("xrpl_signAndSubmit", txJson)`:

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

The Snap handles autofill and submission. All standard XRPL transaction types are supported.

## Session Restore / Mobile Return Recovery

**Session restore**: the adapter checks `window.ethereum` (or the injected provider) for MetaMask availability. If MetaMask is present, it sets `activeAddress` from the stored session. The Snap itself does not provide a passive `isConnected()` check, so the stored address is accepted without re-verification unless `getAddress()` fails.

There is no mobile return / deeplink recovery — XRPL Snap is a desktop MetaMask extension.

## Known Limitations

- No `signTransaction` (sign without submit) via the standard snap API.
- No `disconnect()` — MetaMask/Snap sessions do not expose a disconnect method to dApps.
- `signMessage` produces a Payment transaction blob, not a compact ECDSA/Ed25519 signature. If your backend expects a compact signature, use GemWallet, Crossmark, or DropFi instead.
- Method availability depends on the installed Snap version; the adapter tries a method fallback chain.

## Troubleshooting

**MetaMask not detected?** Ensure MetaMask is installed and that `window.ethereum` is present. MetaMask Flask is required for Snap support in older MetaMask versions.

**Snap installation failed?** The user denied the installation prompt. MetaMask requires explicit permission to install each Snap. Try the connection flow again.

**`signMessage` fails with "method not found"?** Your installed Snap version may not support the default method. Override `signMessageMethods` with methods supported by your Snap version.

**`signAndSubmit` returns null/undefined?** Check that the Snap's `xrpl_signAndSubmit` method is available in the installed version. Verify by calling `wallet_getSnaps` in MetaMask to see installed Snap capabilities.

## Manual Test Checklist

- [ ] MetaMask detected — `window.ethereum` present, Snaps supported
- [ ] First connect — Snap installation popup shown, approved, address returned
- [ ] Second connect (Snap already installed) — connection popup shown, address returned
- [ ] `signAndSubmit` — MetaMask popup shows txn, hash returned after approval
- [ ] `signMessage` — MetaMask popup shows 1-drop Payment, `signatureKind: "signedTx"` returned
- [ ] Page reload — `autoReconnect()` restores session via stored address
- [ ] MetaMask not installed — modal shows install link to metamask.io
- [ ] Snap install rejected — adapter throws readable error
- [ ] Rejection — user cancels in MetaMask, adapter throws readable error
