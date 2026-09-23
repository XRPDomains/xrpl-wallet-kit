# WalletManager

`WalletManager` is the central controller. It orchestrates adapters, manages the active session, emits lifecycle events, and handles session persistence.

## Constructor

```ts
import { WalletManager } from "@xrpl-wallet-kit/core";

const manager = new WalletManager(config);
```

### Config

```ts
interface WalletManagerConfig {
  adapters?: WalletAdapter[];
  network?: WalletNetworkId;
  networks?: WalletNetwork[];
  storage?: WalletStorage;
  autoReconnect?: boolean;
  recoveryRetryDelaysMs?: number[];
  logger?: WalletKitLogger | WalletKitLoggerOptions;
}
```

## Methods

### connect()

Connect to a specific wallet by adapter ID.

```ts
const result = await manager.connect(adapterId, options?);
```

| Parameter | Type | Description |
|---|---|---|
| `adapterId` | `string` | Adapter ID (e.g., `"xaman"`, `"gemwallet"`) |
| `options.network` | `WalletNetwork` | Override the active network |
| `options.signal` | `AbortSignal` | Cancel the connection |

Returns the persisted `WalletSession`:
```ts
interface WalletSession {
  adapterId: string;
  account: WalletAccount;
  connectedAt: number;
}
```

### disconnect()

Disconnect the active session.

```ts
await manager.disconnect();
```

### signTransaction()

Sign a transaction without submitting it.

```ts
const result = await manager.signTransaction({ txJson });
// result.txBlob   — signed transaction blob (hex)
// result.signed   — true when signing succeeded
```

### signAndSubmit()

Sign and submit a transaction to the network.

```ts
const result = await manager.signAndSubmit({ txJson });
// result.hash     — transaction hash
// result.status   — normalized wallet/ledger status when available
```

When a transaction hash is returned, the manager emits `tx_submitted` and records the transaction in the recent transaction store if transaction persistence is enabled.

### signMessage()

Sign an arbitrary UTF-8 message.

```ts
const proof = await manager.signMessage({ message: "Hello XRPL" });
// proof.signatureKind — "signature" | "signedTx"
// proof.proof         — normalized signature or signed transaction blob
```

### autoReconnect()

Attempt to restore the previous session from storage. Construct the manager with `autoReconnect: true`, then call this once on app startup. `createWalletKit()` schedules it automatically when that option is enabled.

```ts
const restored = await manager.autoReconnect();
// null if no session to restore
```

### getCapabilities() and getCapabilityDetails()

Inspect both legacy boolean flags and the granular capability metadata added in `0.1.17`.

```ts
const capabilities = manager.getCapabilities();
const details = manager.getCapabilityDetails();

details?.supportedNetworks;
details?.supportedTransactionTypes;
details?.supportedMethods;
details?.transactionModes; // sign-only | sign-and-submit | multisign
```

### switchNetwork()

Request a network change through the active adapter. Unsupported adapters or undeclared target networks fail before session state changes.

```ts
if (manager.can("switchNetwork")) {
  const network = await manager.switchNetwork("testnet");
}
```

### cancelPendingConnection()

Cancel an in-progress connection attempt.

```ts
await manager.cancelPendingConnection();
```

### getWalletAvailability()

Check which adapters are available (wallet installed in browser).

```ts
const availability = await manager.getWalletAvailability();
// { xaman: true, gemwallet: false, crossmark: true, ... }
```

### addTransaction()

Add or update a transaction in the recent transaction store. Use this for custom transaction flows that do not go through `signAndSubmit()`.

```ts
manager.addTransaction({
  hash: "A1B2...",
  status: "submitted", // "submitted" | "confirmed" | "failed" | "unknown"
  submittedAt: Date.now(),
  account: manager.getSession()?.account,
});
```

### getTransactions()

Return recent transactions known to the manager. UI components such as `WalletButton` use this when `showRecentTransactions` is enabled.

```ts
const transactions = manager.getTransactions();
```

### destroy()

Tear down the manager: cancel pending connections, remove all event listeners, and clean up adapter resources.

```ts
manager.destroy();
```

## Events

```ts
manager.on("connected", ({ account, session }) => { ... });
manager.on("disconnected", ({ adapterId }) => { ... });
manager.on("error", ({ error }) => { ... });
manager.on("session_restored", ({ session }) => { ... });
manager.on("accountChanged", ({ account }) => { ... });
manager.on("networkChanged", ({ network }) => { ... });
manager.on("tx_submitted", ({ transaction }) => { ... });
manager.on("tx_confirmed", ({ transaction }) => { ... });
manager.on("tx_failed", ({ transaction }) => { ... });
```

## Properties

| Property | Type | Description |
|---|---|---|
| `adapters` | `Map<string, WalletAdapter>` | All registered adapters |
| `networks` | `WalletNetwork[]` | Registered built-in and custom networks |
| `networkRegistry` | `NetworkRegistry` | Resolves network IDs to metadata |

Use `getSession()`, `getAccount()`, `getAdapter()`, and `getNetwork()` rather than reading internal session fields.

## WalletSession

```ts
interface WalletSession {
  adapterId: string;
  account: {
    address: string;
    network?: WalletNetwork;
    networkType?: string;
  };
  connectedAt: number;   // Unix timestamp
}
```
