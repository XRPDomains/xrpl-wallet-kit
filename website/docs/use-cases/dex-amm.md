# DEX & AMM

XRPL has a native decentralised exchange built into the protocol — no smart contracts, no wrapped tokens, no gas auctions. From ledger version 1.12 it also supports an Automated Market Maker (AMM, XLS-30) alongside the order-book DEX.

## Native Order-book DEX

### Place a Limit Order

```ts
await manager.signAndSubmit({
  txJson: {
    TransactionType: "OfferCreate",
    Account: manager.activeSession?.account.address,
    // Sell 1 XRP, expect at least 0.50 USD in return
    TakerGets: "1000000",          // 1 XRP in drops
    TakerPays: {
      currency: "USD",
      issuer: "rhub8VRN55s94qWKDv6jmDy1pUykJzF3wq",
      value: "0.50",
    },
  },
});
```

> `OfferCreate` auto-matches against existing crossing offers. Set `Flags: 131072` (`tfPassive`) to post the order without crossing.

### Cancel an Order

```ts
await manager.signAndSubmit({
  txJson: {
    TransactionType: "OfferDelete",
    Account: manager.activeSession?.account.address,
    OfferSequence: 42,   // sequence number of the OfferCreate transaction
  },
});
```

## AMM (XLS-30)

### Add Liquidity

```ts
await manager.signAndSubmit({
  txJson: {
    TransactionType: "AMMDeposit",
    Account: manager.activeSession?.account.address,
    Asset:  { currency: "XRP" },
    Asset2: { currency: "USD", issuer: "<issuer_address>" },
    Amount: "10000000",   // XRP side in drops
    Flags: 1048576,       // tfLPToken — receive LP tokens proportionally
  },
});
```

### Remove Liquidity

```ts
await manager.signAndSubmit({
  txJson: {
    TransactionType: "AMMWithdraw",
    Account: manager.activeSession?.account.address,
    Asset:  { currency: "XRP" },
    Asset2: { currency: "USD", issuer: "<issuer_address>" },
    LPTokenIn: {
      currency: "<lp_token_currency_code>",
      issuer: "<amm_account_address>",
      value: "100",
    },
    Flags: 1048576,   // tfLPToken
  },
});
```

> Retrieve the LP token `currency` code and AMM account address via `xrpl.js` `AMMInfoRequest` before building the withdraw transaction.

## Adapter Compatibility

| Adapter | OfferCreate / OfferDelete | AMMDeposit / AMMWithdraw | Notes |
|---------|---------------------------|--------------------------|-------|
| Xaman | ✅ | ✅ | |
| GemWallet | ✅ | ✅ | |
| Crossmark | ✅ | ✅ | |
| DropFi | ✅ | ✅ | |
| WalletConnect | ✅ | ✅ | Depends on connected wallet |
| XRPL Snap | ✅ | ✅ | |
| Ledger | ✅ | ✅ | XRPL app **v2.3.0+** required for AMM transactions |

## Tips

**Fetch the order book before placing an offer.** Use `xrpl.js` `book_offers` command independently — the wallet kit handles signing only, not data fetching.

**`OfferCreate` fills immediately against crossing orders.** The remainder becomes a resting order on the book. Set `Flags: 524288` (`tfFillOrKill`) if you only want full fills.

**Enable a trust line before receiving IOU tokens.** See [TrustSet](/docs/use-cases/payments) — users must have a trust line for the currency before they can receive it as a result of an OfferCreate.

**AMM path-finding is automatic.** For simple token swaps, you can use a `Payment` transaction with `SendMax` and let the ledger route through the AMM automatically — no need to call `AMMDeposit` unless you're providing liquidity.

## Next Steps

- [Payments & Commerce](/docs/use-cases/payments) — TrustSet and IOU transfers
- [Events & Hooks](/docs/advanced/events-hooks) — subscribe to `tx_confirmed`
- [Adapter Overview](/docs/adapters/overview) — hardware wallet support notes
