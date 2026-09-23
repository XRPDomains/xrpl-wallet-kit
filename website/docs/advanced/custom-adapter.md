# Writing a Custom Adapter

Every wallet in XRPL Wallet Kit is implemented as an **adapter** — a small object that wraps the wallet's native SDK behind a unified interface. If your target wallet isn't in the official list, you can write your own.

## Adapter interface

An adapter must implement `WalletAdapter` from `@xrpl-wallet-kit/core`:

```ts
import type { WalletAdapter } from "@xrpl-wallet-kit/core";

const myAdapter: WalletAdapter = {
  adapterApiVersion: "1.1",
  metadata: {
    id: "my-wallet",
    name: "My Wallet",
    type: "extension",
    icon: "https://my-wallet.io/logo.png",
  },
  capabilities: {
    connect: true,
    disconnect: true,
    signTransaction: true,
    details: {
      supportedNetworks: ["mainnet", "testnet"],
      transactionModes: ["sign-only"],
    },
  },

  async connect(options) { /* ... */ },
  async disconnect() { /* ... */ },
  async signTransaction(request) { /* ... */ },

  // Optional but recommended:
  async signMessage(request) { /* ... */ },
  async restoreSession(session) { /* ... */ },
  isAvailable() { /* ... */ },
};
```

## Metadata fields

| Field | Type | Required | Description |
|---|---|---|---|
| `metadata.id` | `string` | ✅ | Unique lowercase kebab-case ID: `"my-wallet"` |
| `metadata.name` | `string` | ✅ | Human-readable name shown in the modal |
| `metadata.icon` | `string` | — | URL or data URI for the wallet logo |
| `metadata.type` | `"extension" \| "mobile" \| "walletconnect" \| "snap" \| "hardware" \| "embedded"` | ✅ | Wallet integration type |
| `adapterApiVersion` | `string` | — | Set to `WALLET_ADAPTER_API_VERSION` from core |
| `capabilities` | `WalletCapabilities` | ✅ | Methods and granular support the adapter actually implements |

## Required methods

### `connect(options): Promise<ConnectResult>`

Opens the wallet, prompts the user to choose an account, and returns the session.

```ts
import type { ConnectOptions, ConnectResult } from "@xrpl-wallet-kit/core";
import { WalletKitError, WalletKitErrorCode } from "@xrpl-wallet-kit/core";

async connect(options: ConnectOptions): Promise<ConnectResult> {
  if (!window.MyWallet) {
    throw new WalletKitError(
      WalletKitErrorCode.WALLET_NOT_FOUND,
      "My Wallet extension is not installed."
    );
  }

  const response = await window.MyWallet.connect();

  if (!response || !response.address) {
    throw new WalletKitError(
      WalletKitErrorCode.CONNECTION_REJECTED,
      "User rejected the connection."
    );
  }

  return {
    account: {
      address: response.address,
      publicKey: response.publicKey,  // include if available
    },
    raw: response,
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

### `signTransaction(request): Promise<SignTransactionResult>`

Asks the user to sign a prepared transaction. Returns the signed blob.

```ts
import type { SignTransactionResult } from "@xrpl-wallet-kit/core";

async signTransaction(
  request: SignTransactionRequest
): Promise<SignTransactionResult> {
  const result = await window.MyWallet.signTransaction({ transaction: request.txJson });

  if (!result || result.cancelled) {
    throw new WalletKitError(WalletKitErrorCode.SIGN_REJECTED, "User cancelled signing.");
  }

  return {
    txBlob: result.blob,
    signed: true,
    raw: result,
  };
}
```

## Optional methods

### `signMessage(request): Promise<SignMessageResult>`

Signs an arbitrary text message. Required if you want to use `@xrpl-wallet-kit/auth`.

```ts
import type { SignMessageResult } from "@xrpl-wallet-kit/core";

async signMessage(
  request: SignMessageRequest
): Promise<SignMessageResult> {
  const result = await window.MyWallet.signMessage({ message: request.message });

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

### `restoreSession(session): Promise<ConnectResult | null>`

Attempts to restore a previous session without user interaction. Called on page load.

```ts
async restoreSession(stored: WalletSession): Promise<ConnectResult | null> {
  try {
    const session = await window.MyWallet.getConnectedSession();
    if (!session?.address) return null;

    if (session.address !== stored.account.address) return null;
    return { account: { ...stored.account, address: session.address }, session: stored };
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
    adapterApiVersion: WALLET_ADAPTER_API_VERSION,
    metadata: {
      id: "my-wallet",
      name: "My Wallet",
      icon: "https://my-wallet.io/logo.png",
      type: "extension",
      homepage: "https://my-wallet.io",
    },
    capabilities: { connect: true, disconnect: true, signTransaction: true },

    async connect(options) {
      // use options.clientId etc.
    },

    async disconnect() { /* ... */ },

    async signTransaction(request) { /* ... */ },

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
| `CONNECTION_REJECTED` | User cancelled the connect prompt |
| `SIGN_REJECTED` | User cancelled or rejected signing |
| `REQUEST_TIMEOUT` | Wallet didn't respond within a reasonable time |
| `NETWORK_MISMATCH` | Wallet returned a different network |
| `UNSUPPORTED_METHOD` | Wallet cannot perform the requested operation |
| `UNKNOWN_ERROR` | Unexpected error not covered above |

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

## Building with AI

::: tip Adapter developer skill — a key differentiator
XRPL Wallet Kit ships a dedicated **adapter developer skill** for Claude Code and Codex. No other XRPL wallet library has an equivalent. The skill encodes the full adapter contract, capability rules, error codes, session restore safety rules, and cleanup requirements — so AI agents produce correct adapters from wallet documentation alone, without missing edge cases.

**[→ Full guide: Building Adapters with AI](/docs/advanced/ai-development)**
:::

Activate the skill at the start of your Claude Code session:

```
/xrpl-wallet-kit-adapter-developer
```

Then describe the wallet's API to the agent. It will scaffold the factory function, set capability flags correctly, map errors to `WalletKitErrorCode`, implement `restoreSession()` with passive-only rules, and generate a test scaffold — all following the adapter contract automatically.
