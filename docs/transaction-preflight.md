# Transaction Preflight

Preflight is opt-in. Existing applications keep their current signing behavior
unless they configure `WalletManagerConfig.preflight` or a request's `preflight`.
The same pipeline runs for `signTransaction`, `signAndSubmit`, and
`signAndSubmit({ submit: false })`, including sign-only adapter fallbacks.

```ts
const manager = new WalletManager({
  adapters,
  network: "testnet",
  preflight: {
    networkId: "testnet",
    allowedTransactionTypes: ["Payment", "TrustSet"],
    maxFeeDrops: "100",
    requireLastLedgerSequence: true,
  },
});

const request = {
  txJson: payment, // Include explicit Fee and LastLedgerSequence.
  preflight: {
    validatedLedgerIndex: latestValidatedLedgerIndex,
    maxLedgerOffset: 20,
    checks: [async ({ txJson, account, network, mode }) => {
      // Application-owned destination-tag or trust-line validation.
      return needsDestinationTag(txJson) && txJson.DestinationTag === undefined
        ? { code: "DESTINATION_TAG_REQUIRED", severity: "error", message: "Destination requires a tag." }
        : undefined;
    }],
  },
};

const report = await manager.preflightTransaction(request, "sign-only");
if (report.allowed) await manager.signTransaction(request);
```

The example's `adapters`, `payment`, `latestValidatedLedgerIndex`, and
`needsDestinationTag` are application-owned values. The kit performs no implicit
RPC calls. Supply a recent validated ledger index yourself; without one, an
explicit LastLedgerSequence produces a `LEDGER_FRESHNESS_UNKNOWN` warning.

## Policy Rules

- An explicit Account must match the connected account. Omitted Account is left
  untouched for wallet autofill. A connected account is required when enabled.
- `networkId` constrains the connected network. An explicit transaction NetworkID
  is compared with the network's numeric `networkId` when configured. NetworkID
  does not universally distinguish XRPL public networks; this is not proof of
  the wallet's actual submission endpoint.
- Allow and deny lists apply to TransactionType; denial always wins.
- Fee is an integer drops string. A fee ceiling requires an explicit Fee rather
  than relying on unknown wallet autofill. Comparison uses exact integers.
- LastLedgerSequence is a UInt32. It must be ahead of the supplied validated
  ledger index and within `maxLedgerOffset` when set. An offset requires both a
  validated index and an explicit LastLedgerSequence.
- Request policy shallowly overrides manager policy. Arrays, including `checks`,
  replace global arrays rather than append. `preflight: false` explicitly opts
  out for that request; this is a trusted dapp control, not a sandbox for hostile
  request producers.
- Provider-specific `walletPayload` is rejected when enabled, because it can
  instruct a wallet to sign a different transaction than the validated txJson.

## Diagnostics And Isolation

`transaction_preflight` fires before `signing` with adapterId, mode, and an
immutable report. Errors block the wallet with `PREFLIGHT_FAILED` and structured
diagnostics in `error.details.issues`. Warnings permit signing. Thrown application
checks and invalid diagnostics fail closed. Checks run in declaration order.

Manager checks receive an isolated, deeply frozen input snapshot. The wallet
receives a mutable copy for SDK compatibility, without the preflight property.
Changing the caller request while checks run cannot change the provider request.
Disconnecting, replacing the session, or changing account/network during checks
prevents dispatch; the application must start a new request.

`preflightTransaction` is report-only and does not open the wallet. Signing always
runs the checks again: an earlier report is not an authorization token. The
exported `validateTransactionPreflight(context, policy)` also supports standalone
validation; callers of that lower-level function own input/session isolation.

This feature validates intent before signing, not the signed blob or the final
wallet-autofilled transaction. It does not automatically validate trust lines,
destination tags, addresses, balances, quorum, or cryptographic signatures. Use
application checks for business rules and independently validate signed outputs
where the integration requires it. Hooks must implement their own RPC timeouts.
