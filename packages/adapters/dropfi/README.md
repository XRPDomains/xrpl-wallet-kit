# @xrpl-wallet-kit/adapter-dropfi

DropFi adapter for XRPL Wallet Kit.

DropFi is an injected XRPL wallet provider. This adapter detects the provider, normalizes connection state, and maps message signing plus transaction submission into the XRPL Wallet Kit adapter contract.

## Capabilities

- `connect`
- `disconnect`
- `signMessage`
- `signAndSubmit`
- `payments`
- `nftOffers`

## Install

```bash
npm install @xrpl-wallet-kit/adapter-dropfi
```

## Usage

```ts
import { createWalletKit } from "@xrpl-wallet-kit/client";
import { createDropFiAdapter } from "@xrpl-wallet-kit/adapter-dropfi";

const kit = createWalletKit({
  adapters: [createDropFiAdapter()]
});
```

When using `@xrpl-wallet-kit/client` defaults, DropFi is already included.

## Runtime Notes

- The adapter looks for DropFi in this order: an explicit `provider` option, `window.__xwk_dropfi`, `window.dropfi`, then the legacy `window.xrpl` namespace.
- The legacy `window.xrpl` fallback is accepted only when it exposes DropFi-like wallet fields. This avoids treating the standard `xrpl.js` browser global as a wallet provider.
- DropFi's official web injection script exposes `window.xrpl` with `connect`, `disconnect`, `signMessage`, `sendTransaction`, `switchNetwork`, `changeAccount`, `initialize`, and `isConnected`.
- DropFi's official provider state includes `selectedAddress`, `connectedAccounts`, `selectedNetwork`, `network`, and `endpoint`.
- DropFi emits provider events such as `xrpl_selectedAddress`, `xrpl_connectedAccounts`, `xrpl_selectedNetwork`, and `xrpl_disconnect`.
- `connect()` supports provider initialization, passive account reads, and provider-driven connect flows.
- `restoreSession()` is intentionally passive: it reads current provider state and restores only when the passive address matches the stored session address.
- `isConnected() === false` is not treated as final during reload hydration when a matching passive address is already available.
- `disconnect()` is best-effort and bounded by a timeout so stale provider cleanup does not block the app.
- Transaction responses are normalized with `normalizeTxResult()`.

## Message Signing

DropFi `signMessage(message)` signs the exact UTF-8 message string and returns a compact signature result:

```ts
const result = await window.xrpl.signMessage(message);
// { signature: string, publicKey: string }
```

The adapter maps this to:

```ts
{
  signatureKind: "signature",
  proof: result.signature,
  signature: result.signature,
  publicKey: result.publicKey,
  raw: result
}
```

`publicKey` is required. Server-side verification needs the original message string, the returned `signature`, and the returned `publicKey`. The server should convert the UTF-8 message to hex before calling `ripple-keypairs.verify(messageHex, signature, publicKey)`.

Do not treat DropFi like GemWallet's `{ result: { signedMessage } }` shape. If DropFi returns no signature or no public key, the adapter raises `SIGN_REJECTED` so apps do not fall through to another signing method after the user has already seen a wallet prompt.

## Auto Reconnect

DropFi can expose account state through multiple passive surfaces, including `selectedAddress`, connected account arrays, and address getters. The adapter uses those passive address signals to verify a stored session after reload.

Some injected providers report `isConnected() === false` briefly while the extension is hydrating, even though the selected address is already available. For that reason, a matching passive address is the restore authority. A missing or mismatched address still returns `null`.

`restoreSession()` does not call `connect()`, open wallet UI, or request user approval.

## Testing

Pass a mock provider for isolated tests:

```ts
import { assertWalletAdapter } from "@xrpl-wallet-kit/core";
import { createDropFiAdapter } from "@xrpl-wallet-kit/adapter-dropfi";

assertWalletAdapter(createDropFiAdapter({ provider: mockDropFi }));
```

## Links

- DropFi web injection script: https://www.dropfi.app/docs/dropfi-web-injection-script
- DropFi authentication with message hashing: https://www.dropfi.app/docs/authentication-with-message-hashing
- XRPL Wallet Kit: https://github.com/XRPDomains/xrpl-wallet-kit
