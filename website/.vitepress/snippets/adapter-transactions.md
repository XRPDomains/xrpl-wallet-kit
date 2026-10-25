<!-- #region introduction -->
These XRPL examples use `manager` and `account` from either Connect tab. Run each request separately from a user action. Replace recipient addresses and 64-character NFT/offer IDs before signing. Amounts are in drops: `"1000000"` is 1 XRP. Include `DestinationTag` when the recipient requires it.

`maxFeeDrops` is an application-selected ceiling, not the expected fee. Adjust the example limit for your application.

A returned hash or `submitted` status is not validated ledger confirmation. Check the transaction result before treating a payment or NFT transfer as complete. See [WalletManager Events](/docs/api/wallet-manager#events).
<!-- #endregion introduction -->

<!-- #region payment-submit -->
```ts [Sign and Submit]
const result = await manager.signAndSubmit({
  txJson: {
    TransactionType: "Payment",
    Account: account.address,
    Destination: "<recipient_address>",
    Amount: "1000000",
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
  },
  maxFeeDrops: "50000",
});
console.log(result.txBlob); // Signed, not broadcast
```
<!-- #endregion payment-sign-only -->

<!-- #region nft -->
Each tab signs and submits one transaction. Wallet display and supported transaction types depend on the wallet/provider; generic signing is not a promise of support for every amendment.

::: code-group

```ts [Mint]
await manager.signAndSubmit({
  txJson: {
    TransactionType: "NFTokenMint",
    Account: account.address,
    NFTokenTaxon: 0,
    Flags: 8, // tfTransferable
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
    Flags: 1, // tfSellNFToken
  },
  maxFeeDrops: "50000",
});
```

```ts [Accept Sell Offer]
await manager.signAndSubmit({
  txJson: {
    TransactionType: "NFTokenAcceptOffer",
    Account: account.address, // Buyer's account
    NFTokenSellOffer: "<sell_offer_id>",
  },
  maxFeeDrops: "50000",
});
```

```ts [Cancel Offer]
await manager.signAndSubmit({
  txJson: {
    TransactionType: "NFTokenCancelOffer",
    Account: account.address, // Offer creator's account
    NFTokenOffers: ["<offer_id>"],
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
  },
  maxFeeDrops: "50000",
});
```

:::

Burning permanently destroys the NFT. For buy offers, brokered acceptance and additional fields, see [NFT Marketplace](/docs/use-cases/nft-marketplace). Xahau uses different transaction examples; see the [Xahau guide](/docs/configuration/xahau).
<!-- #endregion nft -->
