# Creating An Adapter

## Minimal shape

```ts
import { BaseWalletAdapter, createWalletError } from "@xrpl-wallet-kit/core";
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
    return provider.signMessage(request.message);
  }

  async signAndSubmit(request: SignAndSubmitRequest) {
    const provider = this.requireProvider();
    return provider.signAndSubmit(request.txJson);
  }

  async restoreSession(session: WalletSession): Promise<ConnectResult | null> {
    if (!await this.isAvailable()) return null;
    return { account: session.account, session };
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
- `signMessage`: wallet can sign a portable message proof or a non-submitted memo transaction.
- `signAndSubmit`: wallet can sign and submit a transaction.
- `payments`: payment flow is supported and tested.
- `nftOffers`: NFT offer create/accept/cancel is supported and tested.
- `qr` and `deeplink`: adapter emits URI/deeplink flows to the manager/UI.

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
