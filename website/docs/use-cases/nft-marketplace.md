# NFT Marketplace

XRPL supports native NFTs (XLS-20) without smart contracts. Minting, listing, and trading happen directly on-ledger via dedicated transaction types — giving your marketplace low-fee, instant-finality trades.

## Supported Transactions

- `NFTokenMint` — create a new NFT with optional royalty and metadata URI
- `NFTokenCreateOffer` — list an NFT for sale or place a buy offer
- `NFTokenAcceptOffer` — complete a trade (buyer or marketplace account calls this)
- `NFTokenCancelOffer` — withdraw a listing or buy offer
- `NFTokenBurn` — permanently destroy an NFT

## Mint an NFT

```ts
// URI must be hex-encoded
const uri = "ipfs://bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi";
const uriHex = Buffer.from(uri).toString("hex").toUpperCase();

const result = await manager.signAndSubmit({
  txJson: {
    TransactionType: "NFTokenMint",
    Account: manager.activeSession?.account.address,
    NFTokenTaxon: 0,       // collection ID — your app defines the value
    TransferFee: 2500,     // 2.5% creator royalty (unit = 0.001%, max 50000)
    Flags: 8,              // tfTransferable — allows secondary sales
    URI: uriHex,
  },
});

console.log("Minted. TX hash:", result.hash);
// Parse NFTokenID from result.meta or use xrpl.js parseNFTokenID()
```

## List for Sale

```ts
const result = await manager.signAndSubmit({
  txJson: {
    TransactionType: "NFTokenCreateOffer",
    Account: manager.activeSession?.account.address,
    NFTokenID: "<token_id>",
    Amount: "10000000",   // 10 XRP in drops
    Flags: 1,             // tfSellNFToken
  },
});
// Store the resulting offer ID (from tx metadata) for later acceptance
```

## Accept a Sell Offer

```ts
await manager.signAndSubmit({
  txJson: {
    TransactionType: "NFTokenAcceptOffer",
    Account: manager.activeSession?.account.address,
    NFTokenSellOffer: "<offer_id>",
  },
});
```

## Cancel a Listing

```ts
await manager.signAndSubmit({
  txJson: {
    TransactionType: "NFTokenCancelOffer",
    Account: manager.activeSession?.account.address,
    NFTokenOffers: ["<offer_id_1>", "<offer_id_2>"],
  },
});
```

## Adapter Compatibility

| Adapter | NFTokenMint | NFTokenCreateOffer | NFTokenAcceptOffer |
|---------|-------------|--------------------|--------------------|
| Xaman | ✅ | ✅ | ✅ |
| GemWallet | ✅ | ✅ | ✅ |
| Crossmark | ✅ | ✅ | ✅ |
| DropFi | ✅ | ✅ | ✅ |
| WalletConnect | ✅ | ✅ | ✅ |
| XRPL Snap | ✅ | ✅ | ✅ |
| Ledger | ✅ | ✅ | ✅ |

> Ledger requires XRPL app **v2.2.0+** for NFT transactions.

## Tips

**Royalties are enforced on-ledger.** `TransferFee` is collected automatically on every secondary sale — no smart contract needed.

**The `NFTokenID` is in transaction metadata.** After minting, parse `meta.nftoken_id` from the submitted result, or use `xrpl.js` helper `parseNFTokenID(meta)`.

**Marketplace accounts can accept offers on behalf of buyers.** The `NFTokenAcceptOffer` caller does not need to be the NFT owner — useful for gasless UX where the marketplace account submits the acceptance transaction.

**Brokered mode** lets a marketplace match a buy and sell offer atomically by specifying both `NFTokenBuyOffer` and `NFTokenSellOffer` in a single `NFTokenAcceptOffer` call.

## Next Steps

- [WalletManager API](/docs/api/wallet-manager) — full `signAndSubmit` reference
- [Events & Hooks](/docs/advanced/events-hooks) — listen for `tx_confirmed`
- [Recent Transactions](/docs/configuration/recent-transactions) — display trade history in the wallet UI
