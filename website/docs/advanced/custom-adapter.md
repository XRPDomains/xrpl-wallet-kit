# Writing a Custom Adapter

Every wallet in XRPL Wallet Kit is implemented as an **adapter** — a small object that wraps the wallet's native SDK behind a unified interface. If your target wallet isn't in the official list, you can write your own.

## Adapter interface

An adapter must implement `WalletAdapter` from `@xrpl-wallet-kit/core`:

```ts
import type { WalletAdapter } from "@xrpl-wallet-kit/core";

const myAdapter: WalletAdapter = {
  id: "my-wallet",
  name: "My Wallet",
  icon: "https://my-wallet.io/logo.png",

  async connect(context) { /* ... */ },
  async disconnect() { /* ... */ },
  async signTransaction(txJson, context) { /* ... */ },

  // Optional but recommended:
  async signMessage(message, context) { /* ... */ },
  async signAndSubmitTransaction(txJson, context) { /* ... */ },
  async recoverSession() { /* ... */ },
  isAvailable() { /* ... */ },
};
```

## Metadata fields

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | `string` | ✅ | Unique kebab-case ID: `"my-wallet"` |
| `name` | `string` | ✅ | Human-readable name shown in the modal |
| `icon` | `string` | ✅ | URL or data URI for the wallet's logo (min 64×64 px) |
| `type` | `"extension" \| "mobile" \| "hardware" \| "web"` | — | Hint for the modal UI |
| `downloadUrl` | `string` | — | Link shown when `isAvailable()` returns false |
| `apiVersion` | `string` | — | Set to `WALLET_ADAPTER_API_VERSION` from core |

## Required methods

### `connect(context): Promise<ConnectResult>`

Opens the wallet, prompts the user to choose an account, and returns the session.

```ts
import type { ConnectContext, ConnectResult } from "@xrpl-wallet-kit/core";
import { WalletKitError, WalletKitErrorCode } from "@xrpl-wallet-kit/core";

async connect(context?: ConnectContext): Promise<ConnectResult> {
  if (!window.MyWallet) {
    throw new WalletKitError(
      WalletKitErrorCode.WALLET_NOT_FOUND,
      "My Wallet extension is not installed."
    );
  }

  const response = await window.MyWallet.connect();

  if (!response || !response.address) {
    throw new WalletKitError(
      WalletKitErrorCode.CONNECT_REJECTED,
      "User rejected the connection."
    );
  }

  return {
    account: {
      address: response.address,
      publicKey: response.publicKey,  // include if available
    },
    adapterId: this.id,
    connectedAt: Date.now(),
  };
}
```

### `disconnect(): Promise<void>`

Cleans up the wallet connection. Must not throw if already disconnected.

```ts
async disconnect(): Promise<void> {
  try {
    await window.MyWallet?.disconnect();
  } catch {
    // ignore — already disconnected
  }
}
```

### `signTransaction(txJson, context): Promise<SignTransactionResult>`

Asks the user to sign a prepared transaction. Returns the signed blob.

```ts
import type { SignTransactionResult } from "@xrpl-wallet-kit/core";

async signTransaction(
  txJson: Record<string, unknown>,
  context?: SignContext
): Promise<SignTransactionResult> {
  const result = await window.MyWallet.signTransaction({ transaction: txJson });

  if (!result || result.cancelled) {
    throw new WalletKitError(WalletKitErrorCode.SIGN_REJECTED, "User cancelled signing.");
  }

  return {
    signedTxBlob: result.blob,
    // hash: result.hash,  // if the wallet returns it
  };
}
```

## Optional methods

### `signMessage(message, context): Promise<SignMessageResult>`

Signs an arbitrary text message. Required if you want to use `@xrpl-wallet-kit/auth`.

```ts
import type { SignMessageResult } from "@xrpl-wallet-kit/core";

async signMessage(
  message: string,
  context?: SignContext
): Promise<SignMessageResult> {
  const result = await window.MyWallet.signMessage({ message });

  return {
    signature: result.signature,         // hex compact signature
    publicKey: result.publicKey,          // hex public key (optional)
    signatureKind: "signature",           // "signature" | "signedTx"
  };
}
```

::: info signatureKind
Use `"signature"` if the wallet returns a raw compact ECDSA/EdDSA signature.  
Use `"signedTx"` if the wallet returns a full signed transaction blob.  
The auth verifier branches automatically based on `signatureKind`.
:::

### `recoverSession(): Promise<WalletSession | null>`

Attempts to restore a previous session without user interaction. Called on page load.

```ts
async recoverSession(): Promise<WalletSession | null> {
  try {
    const session = await window.MyWallet.getConnectedSession();
    if (!session?.address) return null;

    return {
      account: { address: session.address },
      adapterId: this.id,
      connectedAt: session.connectedAt ?? Date.now(),
    };
  } catch {
    return null;
  }
}
```

### `isAvailable(): boolean`

Returns `true` if the wallet is detectable in the current browser.

```ts
isAvailable(): boolean {
  return typeof window !== "undefined" && !!window.MyWallet;
}
```

## Factory function pattern

Wrap your adapter in a factory so callers can pass options:

```ts
import type { WalletAdapter } from "@xrpl-wallet-kit/core";
import { WALLET_ADAPTER_API_VERSION } from "@xrpl-wallet-kit/core";

export interface MyWalletAdapterOptions {
  clientId?: string;
  network?: "mainnet" | "testnet";
}

export function createMyWalletAdapter(options: MyWalletAdapterOptions = {}): WalletAdapter {
  return {
    id: "my-wallet",
    name: "My Wallet",
    icon: "https://my-wallet.io/logo.png",
    type: "extension",
    apiVersion: WALLET_ADAPTER_API_VERSION,
    downloadUrl: "https://chrome.google.com/webstore/detail/my-wallet",

    async connect(context) {
      // use options.clientId etc.
    },

    async disconnect() { /* ... */ },

    async signTransaction(txJson) { /* ... */ },

    isAvailable() {
      return typeof window !== "undefined" && !!window.MyWallet;
    },
  };
}
```

## Error handling

Use `WalletKitError` with the correct code so the manager and UI can handle errors consistently:

| Code | When to use |
|---|---|
| `WALLET_NOT_FOUND` | Extension/app not installed or not detected |
| `CONNECT_REJECTED` | User cancelled the connect prompt |
| `SIGN_REJECTED` | User cancelled or rejected signing |
| `TIMEOUT` | Wallet didn't respond within a reasonable time |
| `NETWORK_ERROR` | Network or node connection failure |
| `UNKNOWN` | Unexpected error not covered above |

```ts
import { WalletKitError, WalletKitErrorCode } from "@xrpl-wallet-kit/core";

throw new WalletKitError(
  WalletKitErrorCode.SIGN_REJECTED,
  "User cancelled the sign request."
);
```

## Register the adapter

Pass an instance to `WalletManager`:

```ts
import { WalletManager } from "@xrpl-wallet-kit/core";
import { createMyWalletAdapter } from "./my-wallet-adapter";

const manager = new WalletManager({
  adapters: [
    createMyWalletAdapter({ clientId: "..." }),
    // ...other adapters
  ],
  network: { /* ... */ },
});
```

## Hard rules

Never include these in an adapter:

- **No private keys, seeds, or secrets** — adapters must never generate or store key material.
- **No business logic** — `signAuthPayload`, `setPrimary`, domain lookup, identity verification, etc. belong in the app layer, not the adapter.
- **No DOM modals or framework code** — adapters must be pure TypeScript with no UI dependencies.
- **No hardcoded WalletConnect `projectId`** — always require caller injection for credentials.

## Building with AI (Claude Code / Codex)

XRPL Wallet Kit ships an **adapter developer skill** for AI coding agents. If you use Claude Code or Codex, activate the skill at the start of your session:

```
/xrpl-wallet-kit-adapter-developer
```

The skill loads the full adapter contract, capa