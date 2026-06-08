# Wallet Adapter Contract v1

This document defines the stable adapter surface for XRPL Wallet Kit v1. Third-party adapters should treat this as the compatibility contract.

## Version

Core exports:

```ts
export const WALLET_ADAPTER_API_VERSION = "1.1";
```

Adapters may declare:

```ts
adapterApiVersion = WALLET_ADAPTER_API_VERSION;
```

Patch and minor releases in the `1.x` line should remain compatible with this contract. Breaking adapter changes require a future major contract version.

## Required Shape

```ts
interface WalletAdapter {
  adapterApiVersion?: "1.1" | (string & {});
  metadata: WalletMetadata;
  capabilities: WalletCapabilities;

  isAvailable?: () => boolean | Promise<boolean>;
  connect: (options: ConnectOptions) => Promise<ConnectResult>;
  disconnect?: () => Promise<void>;

  restoreSession?: (session: WalletSession) => Promise<ConnectResult | null>;
  canRecoverSession?: (options: ConnectOptions) => boolean | Promise<boolean>;
  recoverSession?: (options: ConnectOptions) => Promise<ConnectResult | null>;
  cancelPendingConnection?: () => void | Promise<void>;

  signMessage?: (request: SignMessageRequest) => Promise<SignMessageResult>;
  signTransaction?: (request: SignTransactionRequest) => Promise<SignTransactionResult>;
  signAndSubmit?: (request: SignAndSubmitRequest) => Promise<TxResult>;
}
```

## Message Signing Result Shape

`signMessage()` must identify what kind of proof it returns. Auth and server verification code should branch on `signatureKind`, not guess from field names.

```ts
type SignatureKind = "signature" | "signedTx";

interface SignMessageResult {
  signatureKind: SignatureKind;
  signature?: string;
  txBlob?: string;
  publicKey?: string;
  raw?: unknown;
}
```

- Use `signatureKind: "signature"` when the wallet returns a compact message signature. Include `publicKey` when the wallet exposes it; otherwise server code may need ledger lookup or wallet-specific verification.
- Use `signatureKind: "signedTx"` when the wallet returns a signed XRPL transaction blob, such as a Xaman `SignIn` payload or a non-submitted memo transaction. Put the blob in `txBlob`; do not also copy it into `signature`.
- Existing `signature` and `txBlob` fields remain for compatibility, but `signatureKind` is the source of truth for new adapters.

## Required Fields

- `metadata.id`: stable lowercase id, using letters, numbers, and hyphens only.
- `metadata.name`: display name.
- `metadata.type`: one of `mobile`, `extension`, `walletconnect`, `snap`, `hardware`, `embedded`.
- `capabilities.connect`: must be `true` for registered adapters.
- `connect(options)`: must return a normalized `ConnectResult` with an XRPL account address.

## Optional Fields

- `metadata.icon`: strongly recommended. UI packages use it for wallet lists, buttons, loading panels, and account panels.
- `metadata.group`, `metadata.homepage`, `metadata.walletConnect`: useful for UI grouping and deeplink behavior.
- `restoreSession()`: for stored session restore. This is a passive verification hook, not a second connect flow.
- `canRecoverSession()` and `recoverSession()`: for redirect/deeplink return recovery. `recoverSession()` must be gated by `canRecoverSession()`.
- `cancelPendingConnection()`: for clearing pending proposals, popups, deeplinks, timers, and temporary markers.

## Capability Rules

Capabilities must describe implemented behavior, not planned behavior.

- `disconnect: true` requires `disconnect()`.
- `signMessage: true` requires `signMessage()`.
- `signTransaction: true` requires `signTransaction()` and must sign without submitting to the network.
- `signAndSubmit: true` requires `signAndSubmit()`.
- `payments` and `nftOffers` should be enabled only after real wallet testing.
- `qr` and `deeplink` should be enabled only when the adapter can emit or produce usable QR/deeplink data.

## Transaction Method Hints

`SignAndSubmitRequest` and `SignTransactionRequest` include an optional `methodHint`:

```ts
type WalletMethodHint =
  | "payment"
  | "createNFTOffer"
  | "acceptNFTOffer"
  | "cancelNFTOffer"
  | "burnNFT"
  | "generic";
```

The hint describes the dApp's intended operation. It is not a security boundary and adapters must still validate the supplied `txJson`.

Valid values:

- `payment`: XRPL `Payment` flow. Some wallet SDKs expose a payment-specific API, so adapters may map XRPL PascalCase fields such as `Amount`, `Destination`, `DestinationTag`, and `Memos` into the provider's native payload format.
- `createNFTOffer`: XRPL `NFTokenCreateOffer` flow.
- `acceptNFTOffer`: XRPL `NFTokenAcceptOffer` flow.
- `cancelNFTOffer`: XRPL `NFTokenCancelOffer` flow.
- `burnNFT`: XRPL `NFTokenBurn` flow.
- `generic`: fallback for any other transaction type.

Adapter guidance:

- Prefer passing standard XRPL `txJson` through unchanged when the wallet accepts XRPL transaction JSON.
- Use `walletPayload` only for provider-specific payloads that cannot be represented by standard XRPL JSON.
- If an adapter must transform fields for a wallet SDK, document that transformation in the adapter README and cover it with tests.
- Do not infer NFT/payment behavior from UI labels. Use `methodHint` plus `txJson.TransactionType`.
- If the wallet has different UI or approval behavior per method, document it. For example, a wallet may show a dedicated Payment screen for `payment` but a generic transaction review for NFT offers.

Per-adapter examples:

- GemWallet payment APIs expect camelCase payment payloads, so the adapter maps XRPL `Payment` `txJson` into the provider's shape for `methodHint: "payment"`.
- Wallets that accept standard XRPL JSON, such as Xaman or WalletConnect wallets, can usually use `txJson` directly.

## Auto Reconnect And `restoreSession()`

`WalletManager.autoReconnect()` owns session storage, stale-session cleanup, and event emission. Core does not know how a wallet extension, mobile SDK, WalletConnect client, snap, or hardware device proves that a previously stored session is still usable.

Adapters own that proof through `restoreSession(session)`.

`restoreSession()` must:

- be passive-only;
- never open a popup, QR panel, deeplink, sign-in request, connect request, hardware prompt, or transaction approval;
- read current wallet/provider state that already exists after page reload;
- return a normalized `ConnectResult` only when the current wallet account still matches the stored `session.account.address`;
- return `null` for normal stale, locked, unavailable, mismatched, or not-yet-hydrated sessions;
- avoid throwing for normal stale/unavailable sessions; reserve throws for real integration bugs;
- keep provider-specific details under `raw`.

Do not blindly return the stored session just because the provider exists. Local storage proves that the dApp once had a session; it does not prove that the wallet extension is still connected to the same account.

For injected extension adapters, prefer a passive address source such as `getAddress()`, `selectedAddress`, `accounts[0]`, `sync.getAddress()`, or the SDK session snapshot. If an extension has both `isConnected()` and a passive address, treat the address match as the stronger signal when the SDK is known to report `isConnected() === false` during reload hydration. Document that behavior in the adapter README and cover it with tests.

For wallets without a reliable passive account API, do not implement `restoreSession()` or return `null`. Core may support legacy fallback behavior for older adapters without this hook, but new adapters should implement explicit restore semantics instead of reviving stored sessions blindly.

`recoverSession()` is different from `restoreSession()`: it is for mobile/deeplink/redirect returns where a pending external connection may have completed while the dApp was away. It may read temporary recovery markers, but it must still avoid app-specific UI and must be cancellable through `cancelPendingConnection()`.

## Manager Events

Manager events use one stable event envelope per event name. Do not infer event shape from thrown errors or provider-specific raw payloads.

Common events:

```ts
manager.on("connected", ({ adapterId, account, session }) => {});
manager.on("disconnected", ({ adapterId }) => {});
manager.on("error", ({ adapterId, error }) => {});
manager.on("rejected", ({ adapterId, kind, error }) => {});
manager.on("session_restored", ({ adapterId, account, session, stale }) => {});
manager.on("session_stale", ({ adapterId, account, session, reason, attempts }) => {});
manager.on("session_expired", ({ adapterId }) => {});
manager.on("tx_submitted", ({ adapterId, account, hash, result, transaction }) => {});
manager.on("tx_confirmed", ({ adapterId, account, hash, result, transaction }) => {});
manager.on("tx_failed", ({ adapterId, account, hash, error, transaction }) => {});
```

### Error Event Shape

The `error` event shape is:

```ts
{
  adapterId?: string;
  error: unknown;
}
```

Handle errors defensively:

```ts
import { getErrorMessage, isWalletKitError } from "@xrpl-wallet-kit/core";

manager.on("error", ({ adapterId, error }) => {
  const message = getErrorMessage(error);
  if (isWalletKitError(error)) {
    console.log(error.code, adapterId, message);
    return;
  }
  console.log(adapterId, message);
});
```

Do not expect `{ message }` at the top level. The message is under `error.message` when the payload is an `Error` or `WalletKitError`.

### `session_restored` And `stale`

`session_restored` means the manager has set an active session after reading stored state or recovering a pending return flow.

When `stale: true` is present, the manager restored through the legacy fallback path for an adapter that does not implement `restoreSession()`. It means the restored session was not actively re-verified by an adapter-specific passive account check. It does not automatically mean the session is invalid, and the manager does not emit `disconnected` after this event.

Recommended app behavior:

- Treat `session_restored` without `stale` as a verified restore.
- Treat `session_restored` with `stale: true` as a soft-warning state if the app requires strict account proof.
- Do not blindly call `manager.disconnect()` unless the dApp policy requires fresh verification before use.
- Prefer implementing adapter `restoreSession()` so future restores are verified and `stale: true` is not needed.

`session_stale` is different: restore or recovery was attempted but unavailable, mismatched, or inconclusive. The stored session is not promoted to active session in that case.

## Validation Helper

Core exports:

```ts
validateWalletAdapter(adapter);
assertWalletAdapter(adapter);
```

Use this in adapter package tests:

```ts
import { assertWalletAdapter } from "@xrpl-wallet-kit/core";
import { createMyWalletAdapter } from "../src";

assertWalletAdapter(createMyWalletAdapter());
```

`validateWalletAdapter()` returns warnings and errors. Warnings do not block registration, but errors mean the adapter does not satisfy contract v1.

## Boundary Rules

Adapters must not:

- render DOM or framework UI directly;
- call app-specific business APIs;
- hardcode private keys, seeds, secrets, API keys, or WalletConnect project IDs;
- silently mutate XRPL transaction payloads except for documented provider requirements;
- leave pending listeners, timers, popups, transports, or WalletConnect proposals after cancel/disconnect.

UI packages should only depend on adapter metadata, capabilities, manager events, and normalized results.
