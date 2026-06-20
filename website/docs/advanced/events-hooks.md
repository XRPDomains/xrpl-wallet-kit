# Events & Hooks

`WalletManager` is an event emitter. Subscribe to events to react to connection state, transactions, and errors — no polling required.

## Subscribing

```ts
const unsubscribe = manager.on("connected", (event) => {
  console.log("Connected:", event.account.address);
});

// Clean up when done
unsubscribe();
```

`manager.on()` always returns an unsubscribe function. Call it to remove the listener.

## Connection Events

### `connecting`

Fired when a connection attempt starts — either from `manager.connect()` or a background session recovery.

```ts
manager.on("connecting", ({ adapterId }) => {
  showSpinner(`Connecting to ${adapterId}…`);
});
```

### `connected`

Fired after a successful connection or session restore.

```ts
manager.on("connected", ({ account, session, adapterId }) => {
  console.log("Address:", account.address);
  console.log("Adapter:", adapterId);
  console.log("Session:", session);
});
```

### `disconnected`

Fired after a successful disconnect.

```ts
manager.on("disconnected", ({ adapterId }) => {
  resetUI();
});
```

### `session_restored`

Fired when a previous session is recovered on page load (background auto-reconnect). This fires before or alongside `connected`.

```ts
manager.on("session_restored", ({ session, stale }) => {
  if (stale) {
    console.warn("Session was restored in degraded state");
  }
});
```

### `session_stale`

Fired when a session is detected but cannot be fully recovered.

```ts
manager.on("session_stale", ({ adapterId, reason }) => {
  // reason: "restore_unavailable" | "adapter_unavailable" | "connection_cancelled" | "disconnect_timeout" | "recover_unavailable"
  console.warn("Stale session:", reason);
});
```

### `session_expired`

Fired when a stored session has expired and was cleared.

```ts
manager.on("session_expired", () => {
  showReconnectPrompt();
});
```

### `accountChanged`

Fired when the connected account changes (e.g. user switches wallet account).

```ts
manager.on("accountChanged", ({ account, previousAccount }) => {
  console.log("Switched from", previousAccount?.address, "to", account.address);
});
```

### `networkChanged`

Fired when the active network changes.

```ts
manager.on("networkChanged", ({ network, previousNetwork }) => {
  console.log("Network:", network.id);
});
```

## Transaction Events

### `tx_submitted`

Fired when a transaction is broadcast to the XRPL network.

```ts
manager.on("tx_submitted", ({ hash, account, transaction }) => {
  console.log("TX submitted:", hash);
});
```

### `tx_confirmed`

Fired when a transaction is included in a validated ledger.

```ts
manager.on("tx_confirmed", ({ hash, result, transaction }) => {
  console.log("TX confirmed:", hash);
  console.log("Result:", result); // ledger result code
});
```

### `tx_failed`

Fired when a transaction fails (network error or ledger rejection).

```ts
manager.on("tx_failed", ({ hash, error, transaction }) => {
  console.error("TX failed:", hash, error.message);
});
```

## Signing Events

### `signing`

Fired when a sign request is sent to the wallet.

```ts
manager.on("signing", ({ adapterId, kind }) => {
  // kind: "message" | "transaction"
  showSignPrompt();
});
```

### `signed`

Fired after the user approves the sign request.

```ts
manager.on("signed", ({ kind, result }) => {
  hideSignPrompt();
});
```

### `rejected`

Fired when the user rejects a sign request.

```ts
manager.on("rejected", ({ kind, error }) => {
  hideSignPrompt();
  showError("Signing was rejected");
});
```

## QR Event

### `qr`

Fired when a QR code URI is available for scanning (e.g. WalletConnect or Xaman mobile).

```ts
manager.on("qr", ({ uri, deeplink }) => {
  // If you build a custom UI, render your own QR from `uri`
  // The built-in WalletModal handles this automatically
  renderQrCode(uri);
});
```

## Error Event

### `error`

Fired on connection or signing errors.

```ts
manager.on("error", ({ adapterId, error }) => {
  console.error(`${adapterId} error:`, error.code, error.message);
});
```

`error` is a `WalletKitError` with a `code` from `WalletKitErrorCode`. See [Errors](/docs/api/errors) for the full list.

## Modal Events

`WalletModal` also emits events:

```ts
const modal = new WalletModal({ manager });

// Subscribe to open/close
const offOpen  = modal.on("open",  () => console.log("Modal opened"));
const offClose = modal.on("close", () => console.log("Modal closed"));

// Shorthand
modal.onClose(() => analytics.track("modal_closed"));

// Unsubscribe
offOpen();
offClose();
```

## React Hooks

If you use the React package, consume events through hooks instead of `manager.on()` directly — the provider re-renders React state automatically:

```tsx
import { useWalletKit, useWalletStatus, useWalletAccount } from "@xrpl-wallet-kit/react";

function MyApp() {
  const { status } = useWalletKit();       // "disconnected" | "connecting" | "connected"
  const account = useWalletAccount();       // WalletAccount | null
  const session = useWalletSession();       // WalletSession | null
}
```

See the [React guide](/docs/frameworks/react) for the full hook reference.

## Full Event Reference

| Event | Payload | Description |
|---|---|---|
| `connecting` | `{ adapterId }` | Connection attempt started |
| `connected` | `{ adapterId, account, session }` | Connection successful |
| `disconnected` | `{ adapterId }` | Disconnected |
| `session_restored` | `{ adapterId, account, session, stale? }` | Session recovered on load |
| `session_stale` | `{ adapterId, reason, account?, session? }` | Session partially recovered |
| `session_expired` | `{ adapterId? }` | Session expired and cleared |
| `accountChanged` | `{ adapterId, account, previousAccount }` | Active account changed |
| `networkChanged` | `{ adapterId, network, previousNetwork }` | Active network changed |
| `signing` | `{ adapterId, kind }` | Sign request sent to wallet |
| `signed` | `{ adapterId, kind, result }` | User approved sign request |
| `rejected` | `{ adapterId, kind, error }` | User rejected sign request |
| `tx_submitted` | `{ adapterId, account, hash, transaction }` | Transaction broadcast |
| `tx_confirmed` | `{ adapterId, account, hash, result, transaction }` | Transaction confirmed |
| `tx_failed` | `{ adapterId, account, hash, error, transaction }` | Transaction failed |
| `qr` | `{ adapterId, uri, deeplink }` | QR code URI available |
| `error` | `{ adapterId, error }` | Connection or signing error |
