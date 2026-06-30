# @xrpl-wallet-kit/core

Headless XRPL wallet manager, adapter contract, event system, storage helpers, network registry, and transaction lifecycle primitives for XRPL Wallet Kit.

Use this package when you want full control over wallet UI or when building a custom adapter, framework binding, or server-aware integration.

## Install

```bash
npm install @xrpl-wallet-kit/core
```

Most apps should install `@xrpl-wallet-kit/client` instead. It wires the manager, official adapters, modal UI, connect button, toast, identity, balance, and recent transaction options for you.

## Manager

```ts
import { WalletManager, MAINNET } from "@xrpl-wallet-kit/core";
import { createGemWalletAdapter } from "@xrpl-wallet-kit/adapter-gemwallet";

const manager = new WalletManager({
  network: MAINNET,
  adapters: [createGemWalletAdapter()],
  autoReconnect: true,
});

await manager.connect("gemwallet");
```

## Signing

```ts
const messageResult = await manager.signMessage({
  message: "Sign in to My XRPL App",
});

const txResult = await manager.signAndSubmit({
  txJson: {
    TransactionType: "Payment",
    Account: manager.getSession()?.account.address,
    Destination: "r...",
    Amount: "1000000",
  },
});
```

`signMessage()` returns a normalized proof shape:

```ts
{
  signatureKind: "signature" | "signedTx",
  proof: string,
  signature?: string,
  txBlob?: string,
  publicKey?: string,
  raw?: unknown
}
```

Apps should read `signatureKind`. Some wallets return compact message signatures, while Xaman, WalletConnect, and XRPL Snap may return signed transaction proofs.

## Transaction Lifecycle

When `signAndSubmit()` returns a hash, the manager records the transaction and emits lifecycle events.

```ts
manager.on("tx_submitted", ({ hash, transaction }) => {});
manager.on("tx_confirmed", ({ hash, transaction }) => {});
manager.on("tx_failed", ({ hash, error, transaction }) => {});
```

Custom flows can register or update transactions manually:

```ts
manager.addTransaction({
  hash: "A1B2...",
  status: "submitted",
  account: manager.getSession()?.account,
});

const transactions = manager.getTransactions();
```

The transaction confirmer is best-effort. If confirmation is inconclusive, keep an explorer link available instead of marking the transaction failed too early.

## Adapter Contract

Adapters implement the `WalletAdapter` interface and declare capabilities for the methods they truly support.

```ts
import { assertWalletAdapter } from "@xrpl-wallet-kit/core";

assertWalletAdapter(myAdapter);
```

Capability rules:

- `signMessage: true` requires a real `signMessage()` implementation.
- `signTransaction: true` requires signing without submitting.
- `signAndSubmit: true` requires submitting or delegating submission to the wallet.
- Adapters should throw typed `WalletKitError`s for rejected, unsupported, unavailable, or failed flows.

## Storage and Auto Reconnect

`WalletManager` stores session state through `WalletStorage`. Auto reconnect is passive: adapters should restore only from wallet state they can read without opening popups, QR panels, deep links, or approval prompts.

## Related

- `@xrpl-wallet-kit/client` - all-in-one app integration
- `@xrpl-wallet-kit/ui` - framework-agnostic modal, button, inline picker, and toast
- `@xrpl-wallet-kit/auth` - Sign-In with XRPL helpers and verification
