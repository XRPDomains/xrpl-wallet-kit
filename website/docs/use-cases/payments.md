# Payments & Commerce

XRPL's core strength is fast, low-fee payments settling in 3–5 seconds. The `Payment` transaction handles XRP transfers, IOU token payments, and cross-currency conversions with on-ledger path-finding — all signed through the wallet kit.

This guide targets XRPL. For native XAH payments and Payment with HookParameters,
use the [Xahau guide](/docs/configuration/xahau#payment).

## XRP Payment

For multi-recipient payments or a payment plus a platform fee, see
[Batch Transactions](/docs/configuration/batch). Version 0.1.21 adds experimental
single-account All-or-Nothing flows with explicit application opt-in.
Ordinary Payment examples below do not require Batch.

```ts
await manager.signAndSubmit({
  txJson: {
    TransactionType: "Payment",
    Account: manager.getSession()?.account.address,
    Destination: "rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe",
    Amount: "5000000",   // 5 XRP in drops (1 XRP = 1,000,000 drops)
  },
});
```

## Enable an IOU Token (TrustSet)

Before a user can receive an IOU token, they must create a trust line with the issuer:

```ts
await manager.signAndSubmit({
  txJson: {
    TransactionType: "TrustSet",
    Account: manager.getSession()?.account.address,
    LimitAmount: {
      currency: "USD",
      issuer: "rhub8VRN55s94qWKDv6jmDy1pUykJzF3wq",
      value: "10000",   // maximum trust limit
    },
  },
});
```

## IOU Token Payment

```ts
await manager.signAndSubmit({
  txJson: {
    TransactionType: "Payment",
    Account: manager.getSession()?.account.address,
    Destination: "<recipient_address>",
    Amount: {
      currency: "USD",
      issuer: "rhub8VRN55s94qWKDv6jmDy1pUykJzF3wq",
      value: "25.00",
    },
  },
});
```

## Cross-currency Payment

Pay in XRP; the recipient receives USD. XRPL path-finding handles the conversion automatically:

```ts
await manager.signAndSubmit({
  txJson: {
    TransactionType: "Payment",
    Account: manager.getSession()?.account.address,
    Destination: "<recipient_address>",
    Amount: {
      currency: "USD",
      issuer: "<usd_issuer>",
      value: "10.00",       // exact amount recipient gets
    },
    SendMax: "20000000",    // maximum XRP to spend (in drops)
    Flags: 65536,           // tfNoRippleDirect; provide valid Paths from path-finding
    Paths: quotedPaths,    // Fetch a quote independently before wallet approval
  },
});
```

## Payment with Destination Tag

Required for exchange and custodial wallet deposits:

```ts
await manager.signAndSubmit({
  txJson: {
    TransactionType: "Payment",
    Account: manager.getSession()?.account.address,
    Destination: "<exchange_hot_wallet>",
    Amount: "10000000",
    DestinationTag: 12345678,   // identifies the recipient account at the exchange
  },
});
```

## Adapter Compatibility

| Adapter | XRP Payment | IOU Payment | Cross-currency | TrustSet |
|---------|-------------|-------------|----------------|----------|
| Xaman | ✅ | ✅ | ✅ | ✅ |
| GemWallet | ✅ | ✅ | ✅ | ✅ |
| Crossmark | ✅ | ✅ | ✅ | ✅ |
| DropFi | ✅ | ✅ | ✅ | ✅ |
| WalletConnect | ✅ | ✅ | ✅ | ✅ |
| XRPL Snap | ✅ | ✅ | ✅ | ✅ |
| Ledger | ✅ | ✅ | ✅ | ✅ |
| [GhostSig](/docs/adapters/ghostsig) | ✅ | Wallet dependent | Wallet dependent | Wallet dependent |
| [Xyra](/docs/adapters/xyra) | ✅ | Wallet dependent | Wallet dependent | Wallet dependent |
| [Joey Wallet](/docs/adapters/joey-wallet) | ✅ | Wallet dependent | Wallet dependent | Wallet dependent |

These are XRPL flows; generic signing does not guarantee every provider/version
supports every field. Enable the three opt-in adapters explicitly on XRPL.
For XAH and HookParameters, use the four-wallet [Xahau guide](/docs/configuration/xahau).

## Tips

**Do not hardcode `Sequence` or `Fee`.** Rely on the adapter's preparation path,
or use `xrpl.js` autofill when the wallet requires prepared fields. Xahau uses
its own protocol preparation, fee ceiling and post-sign verification.

**Missing `DestinationTag` can cause permanent fund loss.** If a destination requires a tag (check via `account_info` flag `RequireDestTag`), omitting it will cause the payment to fail — which is safe. However, sending to a custodial address without the correct tag may result in unrecoverable funds.

**Partial payments** allow delivering less than the full `Amount` when there's insufficient liquidity in the path. Set `Flags: 131072` (`tfPartialPayment`) and verify `meta.delivered_amount` in the result rather than the stated `Amount` field.

**3-character currency codes vs. 160-bit hex.** Standard currencies use 3-letter codes (`USD`, `EUR`, `XRP`). Non-standard tokens use a 40-character hex string — your DEX or issuer will provide the correct format.

## Next Steps

See the official [Payment reference](https://xrpl.org/docs/references/protocol/transactions/types/payment)
for path fields and flag combinations. A payment hash/preliminary result is not
validated settlement; check the receipt before fulfilling an order.

- [DEX & AMM](/docs/use-cases/dex-amm) — trading tokens on-ledger
- [Sign In with XRPL](/docs/auth/introduction) — wallet-based authentication
- [Recent Transactions](/docs/configuration/recent-transactions) — show payment history in the UI
