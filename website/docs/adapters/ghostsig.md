# GhostSig Adapter

[GhostSig](https://ghostsig.dev/) is a hosted XRPL wallet. The adapter opens a
popup for connection and transaction approval; no browser extension or
WalletConnect project ID is required. Available starting in **v0.1.20** as an
experimental, opt-in adapter.

## Installation

```sh
npm install @xrpl-wallet-kit/core @xrpl-wallet-kit/adapter-ghostsig xrpl@^4
```

## Quick Start

```ts
import { WalletManager } from "@xrpl-wallet-kit/core";
import { createGhostsigAdapter } from "@xrpl-wallet-kit/adapter-ghostsig";

const manager = new WalletManager({
  network: "mainnet",
  adapters: [createGhostsigAdapter()],
});

// Call from a connect button's click handler.
const { account } = await manager.connect("ghostsig");
console.log(account.address);
```

With the all-in-one client:

```ts
import { createWalletClient } from "@xrpl-wallet-kit/client";

const manager = createWalletClient({
  network: "mainnet",
  wallets: ["ghostsig"],
  ghostsig: { timeoutMs: 60000 },
});
```

GhostSig is not included in the default wallet list or `wallets: "all"`.
For plain HTML, the browser bundle exports
`XRPLWalletKit.createGhostsigAdapter(options)`.

## Options

| Option | Type | Default | Description |
|---|---|---|---|
| `timeoutMs` | `number` | `60000` | Timeout for connection and signing requests, in milliseconds |
| `url` | `string` | `https://ghostsig.dev/?connect` | Wallet popup URL; only the GhostSig origin or explicit HTTP localhost development is allowed |

## Capabilities

| Capability | Supported |
|---|:---:|
| connect / disconnect | Yes |
| signTransaction (sign-only) | Yes |
| signAndSubmit | Yes |
| payments / nftOffers | Yes |
| signMessage | No |

Supports the kit's standard mainnet, testnet and devnet configurations.
Custom RPC/network definitions are not supported.

## Integration Notes

- Open connection and signing popups from a user action, using HTTPS or localhost.
- Include an explicit uint32 `SourceTag` in each transaction; `SourceTag: 0` is valid.
- GhostSig does not support message signing for the kit's wallet sign-in flow.
- If your site sets COOP, use `Cross-Origin-Opener-Policy: same-origin-allow-popups` so the wallet can reply.
- If a submit request times out or is cancelled, check its transaction hash before retrying; the transaction may already have been submitted.
