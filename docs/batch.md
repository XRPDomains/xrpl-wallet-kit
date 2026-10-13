# Batch Transactions (Experimental)

This opt-in integration is available starting in **0.1.21**.
V1 supports **2-8 transactions, one account,
All-or-Nothing mode**. Existing non-Batch signing flows are unchanged.

The selected network must have both `BatchV1_1` and `fixBatchV1_2` enabled.
Use a current `xrpl.js` version that supports Batch; local validation uses 4.7.0.
The helper delegates encoding, validation, fee calculation and autofill to that SDK.

## Wallet Compatibility

Xaman documents Batch sign requests and is the first live-test candidate.
GhostSig and Xyra accept generic transaction payloads but need live Batch acceptance
testing. WalletConnect support depends on the wallet behind the session.
Other adapters, including Ledger, are not yet confirmed.

The adapter allowlist below is an explicit application opt-in for testing,
**not** a capability claim or a guarantee that the provider supports Batch.
Do not enable all wallets by default.

## Prepare, Review, Then Sign

```ts
import { Client } from "xrpl";
import { WalletManager, prepareBatchTransaction } from "@xrpl-wallet-kit/core";
import { createXamanAdapter } from "@xrpl-wallet-kit/adapter-xaman";

const manager = new WalletManager({
  network: "mainnet",
  adapters: [createXamanAdapter({ apiKey: "YOUR_XAMAN_API_KEY" })],
  batch: { adapterIds: ["xaman"] },
  preflight: {
    allowedTransactionTypes: ["Batch", "Payment"],
    maxFeeDrops: "1000",
    requireLastLedgerSequence: true,
  },
});

// Connect from a user gesture, using the existing wallet connection flow.
const { account } = await manager.connect("xaman");
const client = new Client(account.network!.rpcUrl);
await client.connect();
try {
  const prepared = await prepareBatchTransaction(client, {
    account: account.address,
    maxFeeDrops: "1000", // Application ceiling, not a fixed Batch fee
    sourceTag: 0,
    transactions: [
      { TransactionType: "Payment", Destination: "<recipient_1>", Amount: "1000000" },
      { TransactionType: "Payment", Destination: "<recipient_2>", Amount: "2000000" },
    ],
  });

  // Review the exact prepared object before enabling a separate signing button.
  // Invoke only ONE of these from that button's click handler:
  // const signed = await manager.signTransaction({ txJson: prepared });
  // const submitted = await manager.signAndSubmit({ txJson: prepared });
} finally {
  await client.disconnect();
}
```

Replace recipient placeholders with valid classic addresses. Include
`DestinationTag` on each Payment when required by its recipient.
The helper sets missing inner `Account` and `SourceTag`, adds `tfInnerBatchTxn`,
and prepares zero inner fees and empty inner signing keys. It rejects signed
inputs, foreign accounts and inner expiry fields instead of silently removing them.
Outer fee and expiry are prepared by `client.autofill`.

Do not run preparation and automatically open a wallet popup after its RPC calls.
Preparation and approval must be separate steps. In the approval view show every
inner transaction, account, recipient, amount/tag, outer fee, expiry and batch mode.
Changing account, network or any transaction invalidates approval; prepare again.
Recheck expiry/sequence freshness before enabling the final signing action.

`signTransaction` and `signAndSubmit({ submit: false })` do not broadcast.
`signAndSubmit` broadcasts on the connected network and can spend real funds.
Never sign or broadcast an inner transaction independently.

## Preflight and Confirmation

- Structural checks always apply to Batch, even when optional preflight is disabled.
- When preflight is enabled, transaction type policies and application checks run
  on the outer Batch and every inner transaction. An allowlist must include both.
- Fee ceiling and expiry policy apply to the outer Batch; inner transactions use
  fee zero and must not contain `LastLedgerSequence`.
- Network activation is checked during preparation. Use the connected account's
  RPC, not an unrelated mainnet/testnet client.

An outer `tesSUCCESS` confirms only the wrapper, not the operations inside it.
The manager tracks expected inner hashes and checks their validated results,
`ParentBatchID` and matching ledger index before emitting `tx_confirmed`.

```ts
manager.on("tx_confirmed", ({ transaction }) => {
  if (transaction?.batch) console.log(transaction.batch.innerTransactions);
});

// After the configured confirmation attempts, inspect the store for unresolved results.
const transactions = manager.getTransactions();
console.log(transactions.map(tx => ({ hash: tx.hash, status: tx.status, batch: tx.batch })));
```

Missing inner results, unavailable RPC data, mismatched parent/ledger or changed
inner payloads remain `unknown`, not successful. All-or-Nothing rollback can leave
no committed inner transactions; do not interpret their absence as success or
automatically retry. Reconcile using the outer hash and ledger data first.
Disabling transaction confirmation leaves the Batch pending for application-owned reconciliation.

V1 does not support multi-account `BatchSigners`, other execution modes, simulation
via `simulate`, or an automatic conversion of ordinary payments into a Batch.
Batch is not a guarantee of lower fees.

## Live Acceptance Before Enabling a Wallet

- Confirm the wallet displays every inner transaction and All-or-Nothing mode.
- Test sign-only, rejection and cancellation without a broadcast.
- Check returned signatures preserve the reviewed inner fields.
- With a dedicated test wallet and explicit user approval, test successful submission
  and rollback; verify the manager never reports outer-only success as completion.
- Record wallet/SDK versions and network. Payment/NFT acceptance outside Batch does
  not count as Batch acceptance.

## References

- [Batch transaction fields](https://xrpl.org/docs/references/protocol/transactions/types/batch)
- [Metadata and integration requirements](https://xrpl.org/docs/concepts/transactions/batch-transactions)
- [Single-account tutorial](https://xrpl.org/docs/tutorials/best-practices/transaction-sending/send-a-single-account-batch-transaction)
- [Xaman Batch requests](https://github.com/XRPL-Labs/Developer-Help-Center/blob/main/concepts/special-transaction-types/batch-multiple-inner-signers.md)
- [Canonical-wrapper security fix](https://xrpl.org/blog/2026/vulnerabilitydisclosurereport-bug-20261009)
