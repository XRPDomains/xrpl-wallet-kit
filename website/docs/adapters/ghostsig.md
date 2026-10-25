# GhostSig Adapter

[GhostSig](https://ghostsig.dev/) opens a hosted wallet popup for connection and transaction approval. No extension, API key or WalletConnect project ID is required.

| Integration | Value |
|---|---|
| Package | `@xrpl-wallet-kit/adapter-ghostsig` |
| Adapter ID | `ghostsig` |
| Wallet type | Hosted web / popup |
| Client registration | Opt-in; excluded from default lists and `wallets: "all"` |

## Installation

```sh
npm install @xrpl-wallet-kit/core @xrpl-wallet-kit/adapter-ghostsig xrpl@^4
```

For the Client tab below, install `@xrpl-wallet-kit/client` instead.

<div id="quick-start"></div>

## Connect

::: code-group

```ts [Client]
import { createWalletKit } from "@xrpl-wallet-kit/client";

const kit = createWalletKit({ network: "mainnet", wallets: ["ghostsig"] });
const { manager } = kit;
const { account } = await kit.connect("ghostsig");
```

```ts [Core]
import { WalletManager } from "@xrpl-wallet-kit/core";
import { createGhostsigAdapter } from "@xrpl-wallet-kit/adapter-ghostsig";

const manager = new WalletManager({
  network: "mainnet",
  adapters: [createGhostsigAdapter()],
});
const { account } = await manager.connect("ghostsig");
```

:::

Connect and sign from user actions so the browser can open GhostSig's approval popup.

## Networks

Supports the standard XRPL Mainnet, Testnet and Devnet presets (`mainnet`, `testnet`, `devnet`). Custom RPC/network definitions and Xahau are not supported by this adapter.

## Capabilities

This table describes manager-level operations available through the adapter.

| Operation | Support |
|---|---|
| Connect | Yes |
| Disconnect | Yes; local session/popup cleanup |
| Session restore | Cached account state only; not fresh authentication |
| `signTransaction()` | Yes |
| `signAndSubmit()` | Yes |
| `signMessage()` | Not exposed |
| `signIn()` | Not exposed |
| `switchNetwork()` | Not exposed |
| Payment / NFT transactions | Yes, through `txJson` |
| QR / deep link | No |

## Options

These options apply to `createGhostsigAdapter()`. The full client also accepts them under `ghostsig`.

| Option | Type | Default | Description |
|---|---|---|---|
| `timeoutMs` | `number` | `60000` | Connection and signing timeout in milliseconds |
| `url` | `string` | `https://ghostsig.dev/?connect` | Wallet popup URL; restricted to the GhostSig origin or explicit HTTP localhost development |

## Transactions

<!--@include: ../../.vitepress/snippets/adapter-transactions.md#introduction-->

### Payment

::: code-group
<!--@include: ../../.vitepress/snippets/adapter-transactions.md#payment-submit-->
<!--@include: ../../.vitepress/snippets/adapter-transactions.md#payment-sign-only-->
:::

If `SourceTag` is omitted or `undefined`, the adapter adds `SourceTag: 0` to a copy used for dispatch and verification. It does not mutate your `txJson`. Explicit tags must be uint32. `SourceTag` never replaces a recipient's `DestinationTag`.

### NFT Transactions

<!--@include: ../../.vitepress/snippets/adapter-transactions.md#nft-->

For sign-only NFT requests, pass the same `txJson` to `manager.signTransaction()`.

## Authentication

Neither arbitrary `signMessage()` nor wallet-native `signIn()` is exposed. A cached account or successful popup connection is not a backend login proof. Choose an adapter with the authentication method your application requires.

## Sessions and Disconnect

`manager.autoReconnect()` can restore cached, unexpired account/key state without a popup. This is not fresh wallet authentication; the next signed result must verify the account and key.

`manager.disconnect()` clears local account state and pending popup work. It does not erase wallet credentials.

## Integration Notes

- Use HTTPS or localhost and allow popups. The requested window is 560 x 720 px and resizable; browsers may adjust it or use a tab on mobile.
- If setting COOP, use `Cross-Origin-Opener-Policy: same-origin-allow-popups` so the wallet can reply.
- After a timeout/cancellation following submit dispatch, check the transaction hash before retrying; the transaction may already have been broadcast.

## Troubleshooting

| Symptom | Action |
|---|---|
| GhostSig is not in the wallet list | Add `"ghostsig"` explicitly to `wallets` |
| Popup is blocked | Start the request from a user action and allow popups |
| Popup approves but the page gets no reply | Check COOP and popup permissions |
| Submission outcome is unknown | Check the hash on the ledger before starting another request |

## Related Guides

- [Adapters Overview](/docs/adapters/overview)
- [NFT Marketplace](/docs/use-cases/nft-marketplace)
- [GhostSig](https://ghostsig.dev/)
