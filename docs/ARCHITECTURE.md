# Architecture Notes

## Lessons From XRPDomains `appv5.html`

The legacy app proved these flows are required:

- Xaman auth uses PKCE and payload subscription.
- WalletConnect wallets share one XRPL namespace and QR/deeplink UX.
- GemWallet exposes high-level helpers for payment and NFT offers.
- Crossmark, DropFi, XRPL Snap, and Ledger can sign generic XRPL tx payloads.
- UI state needs separate list, QR, loading, rejected, and connected states.

## Package Boundaries

`wallet-core` owns contracts and orchestration. It does not import React, DOM, QR, WalletConnect SDK, GemWallet SDK, or app APIs.

Adapter packages own wallet-provider integration. They may read browser wallet globals as a fallback, but they must also accept injected providers for testing.

`wallet-ui` owns only generic wallet selection UI. It consumes `WalletManager` and events.

React and Next packages are thin integration layers over the same manager.

## Adapter Extension

```ts
class MyWalletAdapter implements WalletAdapter {
  metadata = { id: "mywallet", name: "MyWallet", type: "extension" };
  capabilities = { connect: true, signAndSubmit: true };

  async connect({ network }) {
    const account = await provider.connect();
    return { account: { address: account.address, network } };
  }

  async signAndSubmit({ txJson }) {
    return normalizeTxResult(await provider.signAndSubmit(txJson));
  }
}
```

Register it:

```ts
manager.register(new MyWalletAdapter());
```
