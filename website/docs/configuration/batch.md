# Batch Transactions

Group **2-8 XRPL transactions from one account** into an All-or-Nothing Batch.
Use it for multi-recipient payments, a payment plus a platform fee, or NFT
operations whose token and offer IDs are already known.

::: warning Experimental
The Batch integration is available starting in **v0.1.21**, including
`prepareBatchTransaction` and `batch.adapterIds` in npm and browser CDN packages.
Wallet support must be tested before enabling this flow for users.
:::

## Scope

| Feature | V1 |
|---|---|
| Accounts | One connected account |
| Inner transactions | 2-8 |
| Execution mode | All-or-Nothing |
| Signing | Sign-only or sign-and-submit, depending on the wallet |
| Preparation | `xrpl.js` autofill, fee ceiling and amendment checks |
| Confirmation | Validated results for each inner transaction |
| Multi-account / other modes | Not supported in V1 |

All-or-Nothing means the inner operations succeed together or their changes are
rolled back. A failed operation can still incur the outer transaction fee.
Batch does not guarantee lower fees and cannot include off-chain backend work.

## 1. Enable a Wallet Explicitly

Use Wallet Kit **0.1.21 or later** and a Batch-capable `xrpl.js` version
(**4.7.0 or later**).

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

// Connect from your connect button's click handler.
const { account } = await manager.connect("xaman");
```

`batch.adapterIds` is an application allowlist, **not a wallet capability guarantee**.
The manager rejects Batch requests from adapters not in this list. Ordinary
non-Batch requests continue to use the existing signing flow.

If you use `createWalletClient`, pass the same `batch` and `preflight` options to
it. The helper is also exported from `@xrpl-wallet-kit/client`.

## 2. Prepare and Review

Run preparation before enabling a separate approval button. Replace the recipient
placeholders with valid classic XRPL addresses.

```ts
const client = new Client(account.network!.rpcUrl);
await client.connect();

let prepared: Awaited<ReturnType<typeof prepareBatchTransaction>>;
try {
  prepared = await prepareBatchTransaction(client, {
    account: account.address,
    maxFeeDrops: "1000", // Application ceiling, not a fixed fee
    sourceTag: 0,
    transactions: [
      { TransactionType: "Payment", Destination: "<recipient_1>", Amount: "1000000" },
      { TransactionType: "Payment", Destination: "<recipient_2>", Amount: "2000000" },
    ],
  });
} finally {
  await client.disconnect();
}
```

The helper confirms that `BatchV1_1` and the canonical-wrapper security fix
`fixBatchV1_2` are enabled on the selected RPC. It prepares inner sequences,
zero inner fees, empty inner signing keys and `tfInnerBatchTxn`, plus outer fee
and expiry. It rejects signed input and foreign accounts instead of silently
removing those fields.

In your review view, show **every inner operation**, recipient, amount, destination
tag, connected account/network, outer fee, expiry and All-or-Nothing mode.
Add `DestinationTag` to each Payment when its recipient requires one;
`SourceTag` does not replace it.

Changing the wallet, network, recipient, amount or any other field invalidates
the review. Discard the prepared Batch and prepare again. Check sequence and
expiry freshness before approving an older prepared payload.

::: tip Separate Preparation From Signing
Do not automatically open a wallet popup after awaiting preparation RPC calls.
Have the user review the prepared Batch, then invoke signing from a new button
click. The application owns this review UI; the helper does not create it.
:::

## 3. Sign the Outer Batch

Choose one action from the approval button. Never sign or submit an inner
transaction independently.

::: code-group

```ts [Sign Only]
const signed = await manager.signTransaction({ txJson: prepared });
console.log(signed.txBlob); // Signed outer Batch; not broadcast
```

```ts [Sign and Submit]
const submitted = await manager.signAndSubmit({ txJson: prepared });
console.log(submitted.hash); // Outer hash, not proof that all operations succeeded
```

:::

`signAndSubmit({ txJson: prepared, submit: false })` is another sign-only path
when the adapter supports it. Signing and submission on **mainnet can spend real
funds**; the kit signs or submits only when your application requests it.

Preflight type allowlists must include both `Batch` and the inner types you permit.
Application checks also run on each inner transaction. Fee ceiling and expiry
policies apply to the outer Batch; inner fees must be zero and inner expiry
fields must be omitted.

## 4. Check Each Operation's Result

An outer `tesSUCCESS` is **not** evidence that every inner operation succeeded.
The manager compares expected inner hashes, validated results, `ParentBatchID`
and ledger index before emitting `tx_confirmed` for a Batch.

```ts
// Register this listener before signing.
manager.on("tx_confirmed", ({ transaction }) => {
  if (transaction?.batch) {
    console.log("Batch operations confirmed:", transaction.batch.innerTransactions);
  }
});

// Inspect this from your application's status view after confirmation polling.
const batches = manager.getTransactions().filter(tx => tx.batch);
console.log(batches.map(tx => ({ hash: tx.hash, status: tx.status, batch: tx.batch })));
```

Missing inner results, RPC failures or mismatched parent/ledger data remain
`unknown`, not successful. Rollback can leave no committed inner transactions.
Reconcile the outer hash and ledger data before retrying; never automatically
resubmit an unresolved Batch. If confirmation is disabled, your application
must reconcile the results itself.

## Wallet Compatibility

Enable only wallets that support the complete outer Batch payload and your
chosen signing mode. Generic transaction signing or Payment/NFT support does
not imply Batch support. For WalletConnect, compatibility depends on the wallet
behind the session. Batch is XRPL-only; it is not supported by the kit's Xahau runtime.

V1 does not offer multi-account `BatchSigners`, other Batch modes or `simulate`
support. See the official [Batch reference](https://xrpl.org/docs/references/protocol/transactions/types/batch)
and [integration requirements](https://xrpl.org/docs/concepts/transactions/batch-transactions).

## Related Guides

- [Payments & Commerce](/docs/use-cases/payments)
- [NFT Marketplace](/docs/use-cases/nft-marketplace)
- [WalletManager API](/docs/api/wallet-manager)
- [Xaman Adapter](/docs/adapters/xaman)
