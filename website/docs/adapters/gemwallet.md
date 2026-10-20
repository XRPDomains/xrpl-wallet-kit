# GemWallet Adapter

[GemWallet](https://gemwallet.app) is a browser extension wallet for XRPL. It injects a `window.gemWallet` API into the page. No credentials or API keys required.

## Installation

For Xahau mainnet/testnet configuration and transaction examples in v0.2.0+,
see the [Xahau guide](/docs/configuration/xahau). The examples below target XRPL.

```bash
npm install @xrpl-wallet-kit/adapter-gemwallet
```

## Quick Start

```ts
import { createGemWalletAdapter } from "@xrpl-wallet-kit/adapter-gemwallet";

const adapter = createGemWalletAdapter();
```

## Options

| Option | Type | Description |
|---|---|---|
| `provider` | `GemWalletProvider` | Override the injected provider (useful for testing) |

## Connection Flow

1. User clicks GemWallet in the connect modal (shows "Installed" badge when detected)
2. GemWallet opens a browser popup asking for permission
3. On approval, the adapter returns the XRPL account address

The adapter waits up to 2.5 seconds for the extension to hydrate before reporting `isAvailable()`.

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
| signTransaction | ✅ when exposed by the provider |

## Message Signing

GemWallet returns a **compact ECDSA/Ed25519 message signature** — the proof a server can verify directly against the account's public key.

```ts
const result = await manager.signMessage({ message: "Verify wallet ownership" });

// result.signatureKind === "signature"
// result.proof      — same as result.signature
// result.signature  — compact hex signature
// result.publicKey  — account public key (if GemWallet exposes it)
```

Use GemWallet (or Crossmark/DropFi) when your backend expects a standard compact signature rather than an XRPL transaction blob.

## Transactions

GemWallet exposes separate provider APIs per transaction type. The adapter maps `TransactionType` automatically:

| XRPL TransactionType | GemWallet method | Field notes |
|---|---|---|
| `Payment` | `sendPayment()` | PascalCase → camelCase: `Amount`→`amount`, `Destination`→`destination`, `DestinationTag`→`destinationTag` |
| `TrustSet` | `setTrustline()` | `LimitAmount`→`limitAmount`, `QualityIn`→`qualityIn`, `QualityOut`→`qualityOut` |
| `NFTokenCreateOffer` | `createNFTOffer()` | raw `txJson` passed through |
| `NFTokenAcceptOffer` | `acceptNFTOffer()` | raw `txJson` passed through |
| `NFTokenCancelOffer` | `cancelNFTOffer()` | raw `txJson` passed through |
| `NFTokenBurn` | `burnNFT()` | `NFTokenID`→`NFTokenID`, `Owner`→`owner` |
| all others | `signAndSubmit()` | raw `txJson` passed through |

```ts
// Payment — fields auto-mapped for you
const tx = await manager.signAndSubmit({
  txJson: {
    TransactionType: "Payment",
    Account: session.account.address,
    Destination: "rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe",
    Amount: "1000000",
  },
});
console.log(tx.hash);

// Override method detection explicitly
await manager.signAndSubmit({
  txJson: { TransactionType: "TrustSet", ... },
  methodHint: "setTrustline",
});
```

For sign-only requests, use the generic transaction API:

```ts
const signed = await manager.signTransaction({
  txJson: {
    TransactionType: "Payment",
    Account: session.account.address,
    Destination: "<recipient_address>",
    Amount: "1000000", // 1 XRP
  },
});
console.log(signed.txBlob); // Not broadcast
```

Check `manager.can("signTransaction")` when using a custom or older provider.
On XRPL, normal sign-and-submit requests use GemWallet's transaction methods.
On Xahau, the kit prepares and verifies the generic transaction before RPC
submission; use the [Xahau configuration and examples](/docs/configuration/xahau).

## Session Restore / Mobile Return Recovery

**XRPL session restore**: on page reload, the adapter calls `getAddress()` via the GemWallet provider. If the returned address matches the stored session address, the session is silently restored. Xahau requires an explicit reconnect after reload.

There is no mobile return / deeplink recovery — GemWallet is a desktop browser extension only.

## Known Limitations

- No `disconnect()` — GemWallet does not expose a provider-level disconnect method. The session is cleared from the kit's internal storage only.
- Sign-only requires the provider's `signTransaction` method; unsupported providers return `UNSUPPORTED_METHOD`.
- Payment and TrustSet fields are automatically converted to GemWallet's camelCase format; other transaction types are passed as-is.

## Troubleshooting

**Extension not detected?** Verify GemWallet is installed and the extension is enabled for the current site (check browser extension permissions / site access).

**"Installed" badge not showing?** Allow the extension access to the current site. Keep the wallet list open briefly while detection refreshes; the badge indicates availability, not a connected session.

**User rejected the request?** The adapter throws a `WalletError` with code `CONNECTION_REJECTED`. The connect modal shows a user-friendly error and a retry option.

**Transaction failed to infer method?** Pass `methodHint` explicitly if the auto-detection picks the wrong GemWallet API for your transaction type.
