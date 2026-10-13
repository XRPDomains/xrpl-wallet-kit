# GhostSig Adapter

[GhostSig](https://ghostsig.dev/) is a hosted XRPL wallet. The adapter opens a
popup for connection and transaction approval; no browser extension or
WalletConnect project ID is required. Available starting in **v0.1.20** as an
experimental, opt-in adapter.

## Installation

```sh
npm install @xrpl-wallet-kit/core @xrpl-wallet-kit/adapter-ghostsig xrpl@^4
```

## Quick Start

```ts
import { WalletManager } from "@xrpl-wallet-kit/core";
import { createGhostsigAdapter } from "@xrpl-wallet-kit/adapter-ghostsig";

const manager = new WalletManager({
  network: "mainnet",
  adapters: [createGhostsigAdapter()],
});

// Call from a connect button's click handler.
const { account } = await manager.connect("ghostsig");
console.log(account.address);
```

With the all-in-one client:

```ts
import { createWalletClient } from "@xrpl-wallet-kit/client";

const manager = createWalletClient({
  network: "mainnet",
  wallets: ["ghostsig"],
  ghostsig: { timeoutMs: 60000 },
});
```

GhostSig is not included in the default wallet list or `wallets: "all"`.
For plain HTML, the browser bundle exports
`XRPLWalletKit.createGhostsigAdapter(options)`.

## Options

| Option | Type | Default | Description |
|---|---|---|---|
| `timeoutMs` | `number` | `60000` | Timeout for connection and signing requests, in milliseconds |
| `url` | `string` | `https://ghostsig.dev/?connect` | Wallet popup URL; only the GhostSig origin or explicit HTTP localhost development is allowed |

## Capabilities

| Capability | Supported |
|---|:---:|
| connect / disconnect | Yes |
| signTransaction (sign-only) | Yes |
| signAndSubmit | Yes |
| payments / nftOffers | Yes |
| signMessage | No |

Supports the kit's standard mainnet, testnet and devnet configurations.
Custom RPC/network definitions are not supported.

## Transactions

The examples below use `manager` and the connected `account` from Quick Start.
Run each request separately from a button's click handler so GhostSig can open
its approval popup. Replace the recipient and NFT/offer IDs before signing.
Every transaction needs an explicit `SourceTag`; `0` is valid.

### Payment

::: code-group

```ts [Sign Only]
const result = await manager.signTransaction({
  txJson: {
    TransactionType: "Payment",
    Account: account.address,
    Destination: "<recipient_address>",
    Amount: "1000000", // 1 XRP in drops
    SourceTag: 0,
  },
});

console.log(result.txBlob); // Signed transaction; not submitted
```

```ts [Sign and Submit]
const result = await manager.signAndSubmit({
  txJson: {
    TransactionType: "Payment",
    Account: account.address,
    Destination: "<recipient_address>",
    Amount: "1000000", // 1 XRP in drops
    SourceTag: 0,
  },
  submit: true,
});

console.log(result.hash, result.status);
```

:::

`signAndSubmit` broadcasts the transaction and spends real funds on mainnet.
Use `signTransaction` when you only need a signed `txBlob`.
If the recipient requires a destination tag, include its `DestinationTag`
in the Payment; `SourceTag` does not replace it.

### NFT Transactions

These examples sign **and submit**. For a signature without submission, use
`manager.signTransaction({ txJson: ... })` with the same transaction fields.
NFT and offer IDs are 64-character hexadecimal strings.

::: code-group

```ts [Mint]
const result = await manager.signAndSubmit({
  txJson: {
    TransactionType: "NFTokenMint",
    Account: account.address,
    NFTokenTaxon: 0,
    Flags: 8, // tfTransferable
    SourceTag: 0,
  },
});
console.log(result.hash);
```

```ts [Create Sell Offer]
const result = await manager.signAndSubmit({
  txJson: {
    TransactionType: "NFTokenCreateOffer",
    Account: account.address,
    NFTokenID: "<nft_id>",
    Amount: "1000000", // Sell for 1 XRP
    Flags: 1, // tfSellNFToken
    SourceTag: 0,
  },
});
console.log(result.hash);
```

```ts [Accept Sell Offer]
const result = await manager.signAndSubmit({
  txJson: {
    TransactionType: "NFTokenAcceptOffer",
    Account: account.address, // Buyer's connected account
    NFTokenSellOffer: "<sell_offer_id>",
    SourceTag: 0,
  },
});
console.log(result.hash);
```

```ts [Cancel Offer]
const result = await manager.signAndSubmit({
  txJson: {
    TransactionType: "NFTokenCancelOffer",
    Account: account.address, // Offer creator's connected account
    NFTokenOffers: ["<offer_id>"],
    SourceTag: 0,
  },
});
console.log(result.hash);
```

```ts [Burn]
const result = await manager.signAndSubmit({
  txJson: {
    TransactionType: "NFTokenBurn",
    Account: account.address, // NFT owner's connected account
    NFTokenID: "<nft_id>",
    SourceTag: 0,
  },
});
console.log(result.hash);
```

:::

Burning permanently destroys the NFT. See the
[NFT Marketplace guide](/docs/use-cases/nft-marketplace) for more transaction fields.

## Integration Notes

- Open connection and signing popups from a user action, using HTTPS or localhost.
- Include an explicit uint32 `SourceTag` in each transaction; `SourceTag: 0` is valid.
- GhostSig does not support message signing for the kit's wallet sign-in flow.
- If your site sets COOP, use `Cross-Origin-Opener-Policy: same-origin-allow-popups` so the wallet can reply.
- If a submit request times out or is cancelled, check its transaction hash before retrying; the transaction may already have been submitted.
