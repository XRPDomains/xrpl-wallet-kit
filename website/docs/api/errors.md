# Errors

All wallet errors are instances of `WalletError` — a typed error class with a `code` and optional `cause`.

## Import

```ts
import { WalletError, WalletErrorCode, isWalletError } from "@xrpl-wallet-kit/core";
```

## Error Codes

| Code | When thrown |
|---|---|
| `WALLET_NOT_AVAILABLE` | Wallet not installed / not detected |
| `CONNECTION_REJECTED` | User rejected the connection request |
| `CONNECTION_FAILED` | Connection attempt failed (network, timeout, etc.) |
| `SIGN_REJECTED` | User rejected a sign request |
| `SIGN_FAILED` | Signing failed (device error, invalid tx, etc.) |
| `SESSION_NOT_FOUND` | No active session when an operation requires one |
| `REQUEST_TIMEOUT` | Operation timed out (e.g., user didn't respond) |
| `NOT_SUPPORTED` | The adapter does not support the requested operation |

## Checking Errors

```ts
import { isWalletError, WalletErrorCode } from "@xrpl-wallet-kit/core";

try {
  await manager.connect("xaman");
} catch (error) {
  if (isWalletError(error)) {
    switch (error.code) {
      case WalletErrorCode.WALLET_NOT_AVAILABLE:
        showInstallPrompt("xaman");
        break;

      case WalletErrorCode.CONNECTION_REJECTED:
        showMessage("Connection cancelled. Try again when ready.");
        break;

      case WalletErrorCode.REQUEST_TIMEOUT:
        showMessage("No response from wallet. Please try again.");
        break;

      default:
        showMessage(`Wallet error: ${error.message}`);
    }
  }
}
```

## WalletError Properties

```ts
class WalletError extends Error {
  code: WalletErrorCode;    // error category
  cause?: unknown;          // original error (if any)
  walletName?: string;      // which wallet threw
}
```

## Factory Functions

The SDK provides factory helpers to create consistent errors inside adapters:

```ts
import { createWalletError } from "@xrpl-wallet-kit/core";

createWalletError.walletNotAvailable(walletName)
createWalletError.connectionRejected(walletName, cause?)
createWalletError.connectionFailed(walletName, cause)
createWalletError.signRejected(cause?)
createWalletError.signFailed(cause)
createWalletError.sessionNotFound()
createWalletError.requestTimeout(message, cause?)
createWalletError.notSupported(walletName, operation)
```

These are used internally by adapters. App code should use `isWalletError` + `error.code` to handle errors.

## Manager-level Error Event

Errors are also emitted on the manager so you can handle them globally:

```ts
manager.on("error", (error: WalletError) => {
  console.error(`[${error.code}] ${error.message}`);
  analytics.track("wallet_error", { code: error.code });
});
```
