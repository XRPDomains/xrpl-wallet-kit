# Joey Wallet

Connect to the Joey Wallet browser extension through its official SDK. This
adapter uses `joey-wallet`; `joey` remains the separate WalletConnect wallet.

## Installation

```sh
npm install @xrpl-wallet-kit/core @xrpl-wallet-kit/adapter-joey-wallet xrpl@^4
```

## Connect

```ts
import { WalletManager } from "@xrpl-wallet-kit/core";
import { createJoeyWalletAdapter } from "@xrpl-wallet-kit/adapter-joey-wallet";

const manager = new WalletManager({
  network: "mainnet",
  autoReconnect: true,
  adapters: [createJoeyWalletAdapter({
    onDisconnected: () => manager.emitDisconnected("joey-wallet"),
  })],
});

await manager.connect("joey-wallet");
```

Select the same XRPL network in Joey and the dApp. Mainnet, Testnet and Devnet
are supported; Xahau is not. Restoring a session reads already granted accounts
and the current network without opening an approval popup. An account/network
change requires reconnecting.

### All-in-One Client

```ts
import { createWalletKit } from "@xrpl-wallet-kit/client";

const kit = createWalletKit({
  network: "mainnet",
  wallets: ["joey-wallet"],
});

await kit.connect("joey-wallet");
```

Joey Wallet is opt-in: default wallet lists and `wallets: "all"` do not
include it. Use `joey` instead when connecting the mobile wallet through
[WalletConnect](/docs/adapters/walletconnect).

## Payment

```ts
const payment = {
  TransactionType: "Payment" as const,
  Destination: recipientAddress,
  Amount: "10000",
};

// Sign without broadcasting.
const signed = await manager.signTransaction({ txJson: payment, maxFeeDrops: "50000" });

// Ask Joey to sign and submit a separate transaction.
const submitted = await manager.signAndSubmit({ txJson: payment, maxFeeDrops: "50000" });
```

The adapter checks the returned signed blob, account, signature, transaction
hash, requested fields and fee ceiling. A `submitted` result is not a validated
ledger receipt; wait for confirmation before treating it as complete.

## NFT Offers

Pass XRPL transaction JSON through the same manager API:

```ts
// Create a sell offer. Amount is in drops.
await manager.signAndSubmit({
  txJson: {
    TransactionType: "NFTokenCreateOffer",
    NFTokenID: tokenId,
    Amount: "1000000",
    Flags: 1,
  },
  maxFeeDrops: "50000",
});

// Accept an existing sell offer.
await manager.signAndSubmit({
  txJson: {
    TransactionType: "NFTokenAcceptOffer",
    NFTokenSellOffer: offerId,
  },
  maxFeeDrops: "50000",
});

// Cancel offers owned by the connected account.
await manager.signAndSubmit({
  txJson: {
    TransactionType: "NFTokenCancelOffer",
    NFTokenOffers: [offerId],
  },
  maxFeeDrops: "50000",
});
```

Replace `tokenId` and `offerId` with the corresponding ledger object IDs.
Use `manager.signTransaction()` instead to sign without submission.

## Native Sign In

```ts
// Obtain this nonce from your backend; never generate login challenges only in the browser.
const proof = await manager.signIn({
  nonce: nonceFromServer,
  statement: "Sign in to My dApp",
});
// Send proof to your backend and verify before establishing a login session.
```

Joey Wallet returns a CAIP-122 message signature for software accounts, or a
signed transaction challenge for Ledger accounts. Kit preserves the actual
proof type. Use `verifyWalletSignIn()` on your backend, not the existing
message-auth verifier. See [Wallet-Native Sign In](/docs/auth/native-sign-in)
for nonce handling, server verification and choosing between `signIn()` and
`signMessage()`. This adapter still does not support arbitrary `signMessage()`.

## Capabilities

| Feature | Support |
|---|---|
| Connect / disconnect | Yes |
| Passive session restore | Yes, for an existing grant on the same network |
| Sign transaction without submitting | Yes |
| Sign and submit | Yes |
| Native sign-in | Yes, CAIP-122 or Ledger challenge |
| Networks | XRPL Mainnet, Testnet, Devnet |
| Switch network | Select the network in Joey, then reconnect |
| Message signing, Batch, bulk signing, multisigning | Not exposed |
| Xahau | Not supported |

## Options

| Option | Purpose |
|---|---|
| `maxFeeDrops` | Adapter fee ceiling; defaults to `"1000000"`. A request may lower it. |
| `provider` | Override the injected Joey provider. |
| `onDisconnected` | Notify the manager when access is revoked or the account/network changes. |

Message signing, Batch, bulk signing and multisigning are not exposed by this
adapter. Joey's `signIn` API is not a generic `signMessage` replacement.

## Wallet Standard Discovery

When combining native adapters and Wallet Standard discovery, use discovery's
`resolveId` filter to exclude Joey from discovery and avoid duplicate entries:

```ts
import { startWalletStandardDiscovery } from "@xrpl-wallet-kit/core";

startWalletStandardDiscovery(manager, {
  resolveId: wallet => wallet.name === "Joey" ? null : `standard-${wallet.name.toLowerCase().replace(/[^a-z0-9-]/g, "-")}`,
});
```

This display-name filter only controls listing; it does not authenticate wallets
or permit restoring discovered sessions.

[Joey browser extension documentation](https://joeywallet.xyz/docs/browser-extension)
