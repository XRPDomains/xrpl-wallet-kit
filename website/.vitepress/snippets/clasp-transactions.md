<!-- #region payment-submit -->
```ts [Sign and Submit]
const result = await manager.signAndSubmit({
  txJson: {
    TransactionType: "Payment",
    Account: account.address,
    Destination: "<recipient_address>",
    Amount: "1000000",
    Fee: quotedFeeDrops,
  },
  maxFeeDrops: "50000",
});
console.log(result.hash);
```
<!-- #endregion payment-submit -->

<!-- #region payment-sign-only -->
```ts [Sign Only]
const result = await manager.signTransaction({
  txJson: {
    TransactionType: "Payment",
    Account: account.address,
    Destination: "<recipient_address>",
    Amount: "1000000",
    Fee: quotedFeeDrops,
  },
  maxFeeDrops: "50000",
});
console.log(result.txBlob); // Signed, not broadcast
```
<!-- #endregion payment-sign-only -->

<!-- #region nft -->
Each tab signs and submits one transaction. Obtain a fresh, transaction-appropriate `quotedFeeDrops` before the user starts approval.

::: code-group

```ts [Mint]
await manager.signAndSubmit({
  txJson: {
    TransactionType: "NFTokenMint",
    Account: account.address,
    NFTokenTaxon: 0,
    Flags: 8,
    Fee: quotedFeeDrops,
  },
  maxFeeDrops: "50000",
});
```

```ts [Create Sell Offer]
await manager.signAndSubmit({
  txJson: {
    TransactionType: "NFTokenCreateOffer",
    Account: account.address,
    NFTokenID: "<nft_id>",
    Amount: "1000000",
    Flags: 1,
    Fee: quotedFeeDrops,
  },
  maxFeeDrops: "50000",
});
```

```ts [Accept Sell Offer]
await manager.signAndSubmit({
  txJson: {
    TransactionType: "NFTokenAcceptOffer",
    Account: account.address,
    NFTokenSellOffer: "<sell_offer_id>",
    Fee: quotedFeeDrops,
  },
  maxFeeDrops: "50000",
});
```

```ts [Cancel Offer]
await manager.signAndSubmit({
  txJson: {
    TransactionType: "NFTokenCancelOffer",
    Account: account.address,
    NFTokenOffers: ["<offer_id>"],
    Fee: quotedFeeDrops,
  },
  maxFeeDrops: "50000",
});
```

```ts [Burn]
await manager.signAndSubmit({
  txJson: {
    TransactionType: "NFTokenBurn",
    Account: account.address,
    NFTokenID: "<nft_id>",
    Fee: quotedFeeDrops,
  },
  maxFeeDrops: "50000",
});
```

:::

Burning permanently destroys the NFT. For buy offers and brokered acceptance, see [NFT Marketplace](/docs/use-cases/nft-marketplace).
<!-- #endregion nft -->
