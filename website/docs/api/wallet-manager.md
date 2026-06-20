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
