# Recent Transactions

Recent transactions are an opt-in account panel feature. They help users see transactions submitted through the current dApp session without requiring the kit to fetch full ledger history.

The account panel only renders this section when recent transactions are enabled and at least one transaction matches the active account and network.

## Enable with createWalletKit

Use `ui.accountPanel.showRecentTransactions` when you create the all-in-one kit.

```ts
const kit = createWalletKit({
  wallets: "all",
  walletConnectProjectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID,
  connectButton: "#connect-wallet",
  ui: {
    accountPanel: {
      showRecentTransactions: true,
      maxVisibleTransactions: 5,
    },
  },
});
```

`maxVisibleTransactions` controls how many rows are visible before the transaction list uses its own compact internal scroll.

## Enable with WalletButton

If you wire `WalletManager`, `WalletModal`, and `WalletButton` manually, pass the same options to the button.

```ts
const button = new WalletButton({
  manager,
  modal,
  target: document.querySelector("#connect-wallet"),
  showRecentTransactions: true,
  maxVisibleTransactions: 5,
});
```

## Automatic Entries

`manager.signAndSubmit()` automatically records a transaction when the wallet returns a transaction hash.

```ts
const result = await kit.manager.signAndSubmit({
  txJson: {
    TransactionType: "Payment",
    Account: kit.getSession()?.account.address,
    Destination: "r...",
    Amount: "1000000",
  },
});

console.log(result.hash);
```

The manager emits `tx_submitted` first. If transaction confirmation polling is enabled and the ledger result can be resolved, the transaction may later move to `confirmed` or `failed`.

## Manual Entries

Use `manager.addTransaction()` for custom flows, externally submitted transactions, or signed transactions that your app submits separately.

```ts
kit.manager.addTransaction({
  hash: "A1B2...",
  status: "submitted",
  submittedAt: Date.now(),
  account: kit.getSession()?.account,
  description: "Payment",
});
```

You can update the same transaction by calling `addTransaction()` again with the same hash.

```ts
kit.manager.addTransaction({
  hash: "A1B2...",
  status: "confirmed",
  confirmedAt: Date.now(),
});
```

## Transaction Status

| Status | Meaning |
| --- | --- |
| `submitted` | The wallet returned a transaction hash and the kit is waiting for confirmation or external verification. |
| `confirmed` | The transaction was found on-ledger with a successful result. |
| `failed` | The transaction was found on-ledger with a failed result, or the app explicitly marked it failed. |
| `unknown` | The kit or app cannot confidently determine the final result. Show the explorer link instead of marking it failed too early. |

## Explorer Links

By default, the kit builds explorer links from the connected network when possible. You can provide a custom link builder.

```ts
const button = new WalletButton({
  manager,
  modal,
  target,
  showRecentTransactions: true,
  transactionExplorerUrl: (hash, network) => {
    if (network?.id === "mainnet") {
      return `https://livenet.xrpl.org/transactions/${hash}`;
    }

    return `https://testnet.xrpl.org/transactions/${hash}`;
  },
});
```

## UI Behavior

- The section is hidden when there are no matching transactions.
- Rows are filtered to the active account and network.
- The transaction list scrolls internally when it exceeds `maxVisibleTransactions`.
- The account panel keeps the default modal frame when there are no recent transactions.
- When recent transactions are enabled and visible, the panel may use extra vertical space to avoid overlapping account details and action buttons.

## Related APIs

- [`WalletManager.addTransaction()`](/docs/api/wallet-manager#addtransaction)
- [`WalletManager.getTransactions()`](/docs/api/wallet-manager#gettransactions)
- [`WalletButton` options](/docs/configuration/connect-button)
