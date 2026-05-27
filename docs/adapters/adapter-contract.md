# Wallet Adapter Contract v1

This document defines the stable adapter surface for XRPL Wallet Kit v1. Third-party adapters should treat this as the compatibility contract.

## Version

Core exports:

```ts
export const WALLET_ADAPTER_API_VERSION = "1.0";
```

Adapters may declare:

```ts
adapterApiVersion = WALLET_ADAPTER_API_VERSION;
```

Patch and minor releases in the `1.x` line should remain compatible with this contract. Breaking adapter changes require a future major contract version.

## Required Shape

```ts
interface WalletAdapter {
  adapterApiVersion?: "1.0" | (string & {});
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

## Required Fields

- `metadata.id`: stable lowercase id, using letters, numbers, and hyphens only.
- `metadata.name`: display name.
- `metadata.type`: one of `mobile`, `extension`, `walletconnect`, `snap`, `hardware`, `embedded`.
- `capabilities.connect`: must be `true` for registered adapters.
- `connect(options)`: must return a normalized `ConnectResult` with an XRPL account address.

## Optional Fields

- `metadata.icon`: strongly recommended. UI packages use it for wallet lists, buttons, loading panels, and account panels.
- `metadata.group`, `metadata.homepage`, `metadata.walletConnect`: useful for UI grouping and deeplink behavior.
- `restoreSession()`: for stored session restore.
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
