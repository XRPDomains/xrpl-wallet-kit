# Errors

Kit normalizes wallet and protocol failures as `WalletKitError`, with a stable
`code`, a broader `category` and optional `cause`/`details`. Event errors are
typed as `unknown`; narrow them before reading these fields.

## Import

```ts
import { WalletKitError, WalletKitErrorCode, isWalletKitError } from "@xrpl-wallet-kit/core";
```

## Error Codes

| Code | When thrown |
|---|---|
| `WALLET_NOT_FOUND` | Adapter ID is not registered |
| `WALLET_NOT_INSTALLED` | Required wallet extension is missing |
| `WALLET_NOT_AVAILABLE` | Wallet not installed / not detected |
| `CONNECTION_REJECTED` | User rejected the connection request |
| `CONNECTION_FAILED` | Connection attempt failed (network, timeout, etc.) |
| `SIGN_REJECTED` | User rejected a sign request |
| `SIGN_FAILED` | Signing failed (device error, invalid tx, etc.) |
| `SUBMIT_FAILED` | RPC submission failed or returned an unsuccessful result |
| `NOT_CONNECTED` | No active session when an operation requires one |
| `ALREADY_CONNECTED` | Conflicting connection state |
| `REQUEST_TIMEOUT` | Operation timed out (e.g., user didn't respond) |
| `REQUEST_CANCELLED` | Request cancelled or session changed |
| `REQUEST_EXPIRED` | Request expired |
| `UNSUPPORTED_METHOD` | The adapter does not support the requested operation |
| `INVALID_ADAPTER` | Adapter fails the contract validator |
| `INVALID_REQUEST` | Request fields or fee policy are invalid |
| `PREFLIGHT_FAILED` | Application/protocol preflight rejected the request |
| `NETWORK_MISMATCH` | Wallet network differs from the requested network |
| `NETWORK_NOT_SUPPORTED` | Adapter or protocol does not support the network |
| `UNKNOWN_ERROR` | Unclassified failure |

## Checking Errors

```ts
import { isWalletKitError, WalletKitErrorCode } from "@xrpl-wallet-kit/core";

try {
  await manager.connect("xaman");
} catch (error) {
  if (isWalletKitError(error)) {
    switch (error.code) {
      case WalletKitErrorCode.WALLET_NOT_AVAILABLE:
        showInstallPrompt("xaman");
        break;

      case WalletKitErrorCode.CONNECTION_REJECTED:
        showMessage("Connection cancelled. Try again when ready.");
        break;

      case WalletKitErrorCode.REQUEST_TIMEOUT:
        showMessage("No response from wallet. Please try again.");
        break;

      default:
        showMessage(`Wallet error: ${error.message}`);
    }
  }
}
```

## WalletKitError Properties {#walleterror-properties}

```ts
class WalletKitError extends Error {
  readonly code: WalletKitErrorCode;
  readonly category: WalletKitErrorCategory;
  readonly cause?: unknown;
  readonly details?: Record<string, unknown>;
}
```

Categories are `WALLET_UNAVAILABLE`, `USER_ACTION`, `NETWORK`, `INVALID_INPUT`,
`TIMEOUT` and `INTERNAL`. Use codes for specific actions; a category alone does
not tell you whether a transaction was broadcast.

For Xahau, `SUBMIT_FAILED` details may include `hash`, `engineResult`,
`submissionRejected`, `final` and `outcomeUnknown`. A preliminary `tec` response
is not a validated final result. Local cancellation cannot undo dispatch.
If `outcomeUnknown` is true, reconcile the hash/provider request before offering
another submission. Never automatically retry a potentially broadcast transaction.

## Factory Functions

The SDK provides factory helpers to create consistent errors inside adapters:

```ts
import { createWalletError } from "@xrpl-wallet-kit/core";

createWalletError.walletNotAvailable(walletName)
createWalletError.connectionRejected(walletName, cause?)
createWalletError.connectionFailed(walletName, cause)
createWalletError.signRejected(cause?)
createWalletError.signFailed(cause)
createWalletError.notConnected()
createWalletError.requestTimeout(message, cause?)
createWalletError.unsupportedMethod(operation, walletName)
```

These are used internally by adapters. App code should use `isWalletKitError` + `error.code` to handle errors.

## Manager-level Error Event

Errors are also emitted on the manager so you can handle them globally:

```ts
manager.on("error", ({ error }) => {
  if (!isWalletKitError(error)) return;
  console.error(`[${error.code}] ${error.message}`);
  analytics.track("wallet_error", { code: error.code });
});
```
