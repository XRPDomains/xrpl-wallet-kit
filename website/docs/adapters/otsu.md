# Otsu Wallet Adapter

[Otsu Wallet](https://github.com/RomThpt/otsu-wallet) is an MV3 browser extension wallet for XRPL. It supports mainnet, testnet, and devnet, and offers granular dApp permission scopes, transaction simulation, and risk scanning before user approval.

## Installation

```bash
npm install @xrpl-wallet-kit/adapter-otsu
```

## Quick Start

```ts
import { createOtsuAdapter } from "@xrpl-wallet-kit/adapter-otsu";

const adapter = createOtsuAdapter();
```

## Options

| Option | Type | Default | Description |
|---|---|---|---|
| `provider` | `OtsuProvider` | `window.xrpl` (with `isOtsu: true`) | Override the injected provider (useful for testing) |
| `scopes` | `string[]` | `["read", "sign", "submit", "switchNetwork"]` | Permission scopes to request at connect time |

::: info Scope declaration is required upfront
Otsu requires all needed scopes to be declared at connection time. It does not support incremental scope elevation. Declare the minimum set your dApp needs: if you only need to read the address, use `scopes: ["read"]`.
:::

## Connection Flow

1. User clicks Otsu Wallet in the connect modal
2. Otsu extension opens a notification popup for the user to approve the requested scopes
3. On approval, the adapter returns the XRPL address and resolves the active network type
4. The adapter queries `provider.getNetwork()` to populate `networkType` (MAINNET / TESTNET / DEVNET)

## Provider Detection

The adapter looks for `window.xrpl` with `isOtsu === true`. This discriminator prevents collision with `xrpl.js` or other wallets injecting at `window.xrpl`.

## Capabilities

| Capability | Supported |
|---|:---:|
| connect | ✅ |
| disconnect | ✅ |
| signMessage | ✅ |
| signTransaction | ✅ |
| signAndSubmit | ✅ |
| sessionRestore | ✅ |
| payments | ⚠️ pending live testing |
| nftOffers | ⚠️ pending live testing |

## Message Signing

Otsu returns a **compact message signature** (ECDSA/Ed25519):

```ts
const result = await manager.signMessage({ message: "Verify wallet ownership" });

// result.signatureKind === "signature"
// result.proof      — same as result.signature
// result.signature  — compact hex signature
// result.publicKey  — account public key (when Otsu exposes it)
```

## Transactions

Otsu supports both sign-only and sign-and-submit flows:

```ts
// Sign-only (no broadcast)
const signed = await manager.signTransaction({
  txJson: {
    TransactionType: "Payment",
    Account: session.account.address,
    Destination: "rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe",
    Amount: "1000000",
  },
});
// signed.txBlob — hex blob (also exposed as signed.tx_blob for compatibility)
// signed.hash   — pre-submission hash

// Sign + submit
const result = await manager.signAndSubmit({
  txJson: { TransactionType: "Payment", ... },
});
// result.hash   — transaction hash after submission
// result.status — e.g. "tesSUCCESS"
```

When `signAndSubmit` is called with `{ submit: false }`, the adapter automatically falls back to `signTransaction` — the blob is returned without broadcasting.

## Session Restore / Mobile Return Recovery

**Session restore**: on page reload, the adapter checks `provider.isConnected()`. If connected, it calls `provider.getAddress()` to verify the address matches the stored session, then silently restores.

There is no mobile return / deeplink recovery — Otsu is a desktop browser extension.

## Known Limitations

- `payments` and `nftOffers` capabilities are not yet confirmed with live Otsu transaction tests. Enable them in your adapter options once Payment and NFT offer payloads have been validated end-to-end.
- Scopes must be declared at connect time — no incremental scope elevation after the initial connection.
- The Otsu Wallet is an early-stage project. The provider API may change in future releases.

## Troubleshooting

**Extension not detected?** Verify Otsu Wallet is installed and that `window.xrpl.isOtsu === true`. In DevTools: `console.log(window.xrpl?.isOtsu)`. If this returns `undefined`, the extension is not installed or did not inject.

**Another wallet also uses `window.xrpl`?** Otsu is identified by `window.xrpl.isOtsu === true`. Other wallets at `window.xrpl` without that flag are ignored. Inject the Otsu provider directly via `options.provider` if needed.

**Scope permission denied?** If the user denies a scope at connection time, the adapter throws a `CONNECTION_REJECTED` error. Request only the minimum scopes needed (`["read"]` for address-only flows).

**`signAndSubmit` failed?** Ensure the `sign` and `submit` scopes were approved at connect time. Without those scopes, Otsu will reject signing requests.

## Monorepo Integration Notes

This adapter is an official monorepo package at `packages/adapters/otsu/`. The placeholder icon in the source should be replaced with the official Otsu Wallet logo before publishing. Obtain the logo from the `assets/` folder of the [otsu-wallet GitHub repository](https://github.com/RomThpt/otsu-wallet) and convert it to a `data:image/...;base64` URL.

## Manual Test Checklist

- [ ] Extension detected — `window.xrpl.isOtsu === true`
- [ ] Connect with default scopes — Otsu popup shows all 4 scopes, address returned
- [ ] Connect with `scopes: ["read"]` — Otsu popup shows read-only scope
- [ ] `signAndSubmit` — Otsu popup shows txn with simulation/risk info, hash returned
- [ ] `signTransaction` — Otsu popup shows txn, `txBlob` returned without broadcast
- [ ] `signMessage` — Otsu popup shows message, compact signature returned, `signatureKind: "signature"`
- [ ] Page reload — `autoReconnect()` restores session via `isConnected()` + address match
- [ ] Disconnect — `provider.disconnect()` called, session cleared
- [ ] Extension not installed — modal shows install link to GitHub
- [ ] Scope denied — user unchecks scopes, adapter throws `CONNECTION_REJECTED`
- [ ] Rejection — user cancels popup, adapter throws readable error
