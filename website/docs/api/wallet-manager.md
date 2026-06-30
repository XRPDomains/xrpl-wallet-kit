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
  /** Adapter instances to register */
  adapters: BaseWalletAdapter[];

  /** Active network configuration */
  network?: XRPLNetwork;

  /** Custom session storage (default: localStorage) */
  storage?: StorageAdapter;

  /** Session storage key prefix (default: "xwk") */
  storageKey?: string;

  /** Logger instance or false to disable logging */
  logger?: Logger | false;

  /** Retry delays for session recovery in ms */
  recoveryRetryDelaysMs?: number[];
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
| `options.network` | `XRPLNetwork` | Override the active network |
| `options.signal` | `AbortSignal` | Cancel the connection |

Returns `ConnectResult`:
```ts
interface ConnectResult {
  account: {
    address: string;
    network?: XRPLNetwork;
    networkType?: string;
  };
  session?: WalletSession;
  raw?: unknown;
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
// result.hash     — transaction hash
```

### signAndSubmit()

Sign and submit a transaction to the network.

```ts
const result = await manager.signAndSubmit({ txJson });
// result.hash     — transaction hash
// result.result   — ledger result code (e.g., "tesSUCCESS")
```

When a transaction hash is returned, the manager emits `tx_submitted` and records the transaction in the recent transaction store if transaction persistence is enabled.

### signMessage()

Sign an arbitrary UTF-8 message.

```ts
const { signature } = await manager.signMessage({ message: "Hello XRPL" });
```

### recoverSession()

Attempt to restore the previous session from storage. Call this once on app startup.

```ts
const restored = await manager.recoverSession();
// null if no session to restore
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
manager.on("connect", (result: ConnectResult) => { ... });
manager.on("disconnect", () => { ... });
manager.on("error", (error: WalletError) => { ... });
manager.on("sessionRestored", (result: ConnectResult) => { ... });
manager.on("availabilityChanged", (availability: Record<string, boolean>) => { ... });
manager.on("tx_submitted", ({ transaction }) => { ... });
manager.on("tx_confirmed", ({ transaction }) => { ... });
manager.on("tx_failed", ({ transaction }) => { ... });
```

## Properties

| Property | Type | Description |
|---|---|---|
| `activeSession` | `WalletSession \| null` | Current active session |
| `activeAdapterId` | `string \| null` | ID of the connected adapter |
| `adapters` | `Map<string, BaseWalletAdapter>` | All registered adapters |
| `network` | `XRPLNetwork \| undefined` | Active network |

## WalletSession

```ts
interface WalletSession {
  adapterId: string;
  account: {
    address: string;
    network?: XRPLNetwork;
    networkType?: string;
  };
  connectedAt: number;   // Unix timestamp
}
```
