# DEX & AMM

XRPL has a native decentralised exchange built into the protocol — no smart contracts, no wrapped tokens, no gas auctions. From ledger version 1.12 it also supports an Automated Market Maker (AMM, XLS-30) alongside the order-book DEX.

These examples target XRPL. The Kit's Xahau runtime supports `OfferCreate` and
`OfferCancel`, but not AMM transactions; see [Xahau scope](/docs/configuration/xahau#transaction-scope).

## Native Order-book DEX

### Place a Limit Order

```ts
await manager.signAndSubmit({
  txJson: {
    TransactionType: "OfferCreate",
    Account: manager.getSession()?.account.address,
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

> `OfferCreate` can match existing crossing offers. `Flags: 65536` (`tfPassive`)
> prevents matching offers at exactly the same price, not all crossing offers.

### Cancel an Order

```ts
await manager.signAndSubmit({
  txJson: {
    TransactionType: "OfferCancel",
    Account: manager.getSession()?.account.address,
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
    Account: manager.getSession()?.account.address,
    Asset:  { currency: "XRP" },
    Asset2: { currency: "USD", issuer: "<issuer_address>" },
    Amount: "10000000",   // XRP side in drops
    Amount2: { currency: "USD", issuer: "<issuer_address>", value: "5" },
    Flags: 1048576,       // tfTwoAsset; both deposit limits are specified
  },
});
```

### Remove Liquidity

```ts
await manager.signAndSubmit({
  txJson: {
    TransactionType: "AMMWithdraw",
    Account: manager.getSession()?.account.address,
    Asset:  { currency: "XRP" },
    Asset2: { currency: "USD", issuer: "<issuer_address>" },
    LPTokenIn: {
      currency: "<lp_token_currency_code>",
      issuer: "<amm_account_address>",
      value: "100",
    },
    Flags: 65536,    // tfLPToken
  },
});
```

> Retrieve the LP token `currency` code and AMM account address via `xrpl.js` `AMMInfoRequest` before building the withdraw transaction.

## Adapter Compatibility

| Adapter | OfferCreate / OfferCancel | AMMDeposit / AMMWithdraw | Notes |
|---------|---------------------------|--------------------------|-------|
| Xaman | ✅ | ✅ | |
| GemWallet | ✅ | ✅ | |
| Crossmark | ✅ | ✅ | |
| DropFi | ✅ | ✅ | |
| WalletConnect | ✅ | ✅ | Depends on connected wallet |
| XRPL Snap | ✅ | ✅ | |
| Ledger | Wallet dependent | Wallet dependent | Check XRP app version and supported fields |
| [GhostSig](/docs/adapters/ghostsig) | Wallet dependent | Wallet dependent | Generic XRPL signing |
| [Xyra](/docs/adapters/xyra) | Wallet dependent | Wallet dependent | Generic XRPL signing |
| [Joey Wallet](/docs/adapters/joey-wallet) | Wallet dependent | Wallet dependent | Generic XRPL signing |

## Tips

**Fetch the order book before placing an offer.** Use `xrpl.js` `book_offers` command independently — the wallet kit handles signing only, not data fetching.

**`OfferCreate` fills against crossing orders.** The remainder can become a
resting order. Set `Flags: 262144` (`tfFillOrKill`) if you only want a full fill.

**Enable a trust line before receiving IOU tokens.** See [TrustSet](/docs/use-cases/payments) — users must have a trust line for the currency before they can receive it as a result of an OfferCreate.

**AMM path-finding is automatic.** For simple token swaps, you can use a `Payment` transaction with `SendMax` and let the ledger route through the AMM automatically — no need to call `AMMDeposit` unless you're providing liquidity.

## Next Steps

Consult the official [OfferCreate flags](https://xrpl.org/docs/references/protocol/transactions/types/offercreate),
[AMMDeposit](https://xrpl.org/docs/references/protocol/transactions/types/ammdeposit)
and [AMMWithdraw](https://xrpl.org/docs/references/protocol/transactions/types/ammwithdraw)
references for execution modes and field combinations. Quote amounts from
current pool/order-book data, not from these placeholders.

- [Payments & Commerce](/docs/use-cases/payments) — TrustSet and IOU transfers
- [Events & Hooks](/docs/advanced/events-hooks) — subscribe to `tx_confirmed`
- [Adapter Overview](/docs/adapters/overview) — hardware wallet support notes
