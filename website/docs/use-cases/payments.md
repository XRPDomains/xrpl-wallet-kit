# Payments & Commerce

XRPL's core strength is fast, low-fee payments settling in 3–5 seconds. The `Payment` transaction handles XRP transfers, IOU token payments, and cross-currency conversions with on-ledger path-finding — all signed through the wallet kit.

## XRP Payment

```ts
await manager.signAndSubmit({
  txJson: {
    TransactionType: "Payment",
    Account: manager.activeSession?.account.address,
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
    Account: manager.activeSession?.account.address,
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
    Account: manager.activeSession?.account.address,
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
    Account: manager.activeSession?.account.address,
    Destination: "<recipient_address>",
    Amount: {
      currency: "USD",
      issuer: "<usd_issuer>",
      value: "10.00",       // exact amount recipient gets
    },
    SendMax: "20000000",    // maximum XRP to spend (in drops)
    Flags: 131072,          // tfNoRippleDirect — use DEX/AMM path
  },
});
```

## Payment with Destination Tag

Required for exchange and custodial wallet deposits:

```ts
await manager.signAndSubmit({
  txJson: {
    TransactionType: "Payment",
    Account: manager.activeSession?.account.address,
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

## Tips

**Always autofill `Sequence` and `Fee` before submitting.** Use `xrpl.js` `client.autofill(txJson)` to populate these fields, or rely on the adapter's built-in autofill.

**Missing `DestinationTag` can cause permanent fund loss.** If a destination requires a tag (check via `account_info` flag `RequireDestTag`), omitting it will cause the payment to fail — which is safe. However, sending to a custodial address without the correct tag may result in unrecoverable funds.

**Partial payments** allow delivering less than the full `Amount` when there's insufficient liquidity in the path. Set `Flags: 131072` (`tfPartialPayment`) and verify `meta.delivered_amount` in the result rather than the stated `Amount` field.

**3-character currency codes vs. 160-bit hex.** Standard currencies use 3-letter codes (`USD`, `EUR`, `XRP`). Non-standard tokens use a 40-character hex string — your DEX or issuer will provide the correct format.

## Next Steps

- [DEX & AMM](/docs/use-cases/dex-amm) — trading tokens on-ledger
- [Sign In with XRPL](/docs/auth/introduction) — wallet-based authentication
- [Recent Transactions](/docs/configuration/recent-transactions) — show payment history in the UI
