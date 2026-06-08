# Creating An Adapter

## Minimal shape

```ts
import { BaseWalletAdapter, WALLET_ADAPTER_API_VERSION, createWalletError } from "@xrpl-wallet-kit/core";
import type {
  ConnectOptions,
  ConnectResult,
  SignAndSubmitRequest,
  SignMessageRequest,
  WalletCapabilities,
  WalletMetadata,
  WalletSession
} from "@xrpl-wallet-kit/core";

export class MyWalletAdapter extends BaseWalletAdapter {
  adapterApiVersion = WALLET_ADAPTER_API_VERSION;

  metadata: WalletMetadata = {
    id: "mywallet",
    name: "My Wallet",
    type: "extension",
    group: "Extensions",
    icon: MY_WALLET_ICON
  };

  capabilities: WalletCapabilities = {
    connect: true,
    disconnect: true,
    signMessage: true,
    signAndSubmit: true,
    payments: true,
    nftOffers: true
  };

  async isAvailable(): Promise<boolean> {
    return Boolean(this.getProvider());
  }

  async connect(options: ConnectOptions): Promise<ConnectResult> {
    const provider = this.getProvider();
    if (!provider) throw createWalletError.walletNotAvailable(this.metadata.name);

    const address = await provider.connect();
    const account = { address, network: options.network };
    const session: WalletSession = {
      adapterId: this.metadata.id,
      account,
      connectedAt: Date.now()
    };

    return { account, session, raw: { provider: this.metadata.id } };
  }

  async signMessage(request: SignMessageRequest) {
    const provider = this.requireProvider();
    const result = await provider.signMessage(request.message);
    return {
      signatureKind: "signature" as const,
      signature: result.signature,
      publicKey: request.account?.publicKey,
      raw: result
    };
  }

  async signAndSubmit(request: SignAndSubmitRequest) {
    const provider = this.requireProvider();
    return provider.signAndSubmit(request.txJson);
  }

  async restoreSession(session: WalletSession): Promise<ConnectResult | null> {
    if (!await this.isAvailable()) return null;

    const provider = this.getProvider();
    const currentAddress = await provider?.getAddress?.();
    if (!currentAddress || currentAddress !== session.account.address) return null;

    return {
      account: { ...session.account, address: currentAddress },
      session: { ...session, account: { ...session.account, address: currentAddress } },
      raw: { restoredFrom: "passive-address" }
    };
  }

  private getProvider() {
    return typeof window === "undefined" ? undefined : (window as any).mywallet;
  }

  private requireProvider() {
    const provider = this.getProvider();
    if (!provider) throw createWalletError.walletNotAvailable(this.metadata.name);
    return provider;
  }
}
```

## Capability rules

Set a capability to `true` only when the adapter has a working implementation. The UI and app code may use these fields to decide which flows to show.

Important capabilities:

- `connect`: required.
- `disconnect`: provider has a meaningful disconnect/logout/session-clear method.
- `signMessage`: wallet can sign a portable message proof or a non-submitted memo transaction. Return `signatureKind: "signature"` for compact message signatures and `signatureKind: "signedTx"` for signed transaction blobs.
- `signAndSubmit`: wallet can sign and submit a transaction.
- `payments`: payment flow is supported and tested.
- `nftOffers`: NFT offer create/accept/cancel is supported and tested.
- `qr` and `deeplink`: adapter emits URI/deeplink flows to the manager/UI.

## Auto reconnect rules

`restoreSession()` is a passive verification hook. It is called by `WalletManager.autoReconnect()` after reading a stored session. It must prove that the currently available wallet provider still represents the same account as the stored session.

Safe `restoreSession()` behavior:

- read only passive provider state that is already available after reload;
- compare the current wallet address with `session.account.address`;
- return `null` when the wallet is missing, locked, stale, not hydrated, or on a different account;
- avoid throwing for normal stale/unavailable states;
- avoid calling `connect()`, sign-in, QR, deeplink, popup, hardware confirmation, or approval APIs.

Unsafe behavior:

```ts
async restoreSession(session: WalletSession) {
  if (!await this.isAvailable()) return null;
  return { account: session.account, session };
}
```

This only proves that the provider exists. It does not prove that the wallet is still connected to the same account, so new adapters should not use this pattern.

If a wallet has no reliable passive account API, prefer returning `null` from `restoreSession()` or omitting the method. The user can reconnect manually, and the manager will emit stale/expired session events as appropriate.

## Contract validation

Run the shared contract validator in adapter tests:

```ts
import { assertWalletAdapter } from "@xrpl-wallet-kit/core";

assertWalletAdapter(new MyWalletAdapter());
```

Use `validateWalletAdapter(adapter)` when you want a non-throwing result with warnings and errors. The validator checks stable metadata, capability/method consistency, required `connect()`, and safe recovery hook pairing.

## Error rules

Throw normal errors or `createWalletError.*`. The manager normalizes common errors, but adapters should preserve useful detail.

Use these message patterns for predictable UI behavior:

- user cancel/reject: include `rejected`, `cancelled`, `canceled`, `denied`, or `closed`.
- timeout: include `timeout` or `timed out`.
- unavailable: throw `createWalletError.walletNotAvailable(walletName)`.
- unsupported method: call `this.unsupported("methodName")` from `BaseWalletAdapter`.

## Cleanup rules

Use `BaseWalletAdapter.addCleanup()` for event listeners, timers, subscriptions, sockets, or popup handles. `runCleanup()` is called by the base `disconnect()` and should also be used in custom disconnect implementations.

Do not leak:

- WalletConnect listeners or pending promises;
- extension event listeners;
- polling timers;
- Xaman/deeplink popup references;
- hardware transports.

## UI boundary

Adapters must not call business DOM, jQuery, Bootbox, app modals, or framework components. If a wallet returns a QR/deeplink URI, emit it through the manager/event path or adapter callback so UI packages can render it.
