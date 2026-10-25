# Xyra Adapter

[Xyra](https://www.xyra.now/) opens a hosted wallet popup for connection and transaction approval. No browser extension or WalletConnect project ID is required.

| Integration | Value |
|---|---|
| Package | `@xrpl-wallet-kit/adapter-xyra` |
| Adapter ID | `xyra` |
| Wallet type | Hosted web / popup |
| Client registration | Opt-in on XRPL; included by default on Xahau |

## Installation

```sh
npm install @xrpl-wallet-kit/core @xrpl-wallet-kit/adapter-xyra xrpl@^4
```

For the Client tab below, install `@xrpl-wallet-kit/client` instead.

<div id="quick-start"></div>

## Connect

::: code-group

```ts [Client]
import { createWalletKit } from "@xrpl-wallet-kit/client";

const kit = createWalletKit({ network: "mainnet", wallets: ["xyra"] });
const { manager } = kit;
const { account } = await kit.connect("xyra");
```

```ts [Core]
import { WalletManager } from "@xrpl-wallet-kit/core";
import { createXyraAdapter } from "@xrpl-wallet-kit/adapter-xyra";

const manager = new WalletManager({
  network: "mainnet",
  adapters: [createXyraAdapter()],
});
const { account } = await manager.connect("xyra");
```

:::

Call connect and each signing request from a user action. The selective client also accepts an explicitly configured adapter through `adapters`.

## Networks

Supports standard XRPL Mainnet/Testnet and Xahau Mainnet/Testnet. The default XRPL adapter does not accept Devnet or custom RPC definitions. For Xahau, the full client accepts `network: "xahau-mainnet"` or `"xahau-testnet"` with a positive `preflight.maxFeeDrops`; core/selective integrations must register the protocol and adapter chain filter. See [Xahau Configuration](/docs/configuration/xahau).

## Capabilities

This table describes manager-level operations. Payment/NFT requests use generic signing rather than dedicated `payments`/`nftOffers` capability flags.

| Operation | Support |
|---|---|
| Connect | Yes |
| Disconnect | Yes; local session/popup cleanup |
| Session restore | No; reconnect from a user action |
| `signTransaction()` | Yes |
| `signAndSubmit()` | Yes |
| `signMessage()` | Not exposed |
| `signIn()` | Not exposed |
| `switchNetwork()` | Not exposed |
| Payment / NFT transactions | Through generic `txJson` signing |
| QR / deep link | No |

## Options

These options apply to `createXyraAdapter()`. Pass a configured adapter through the client's `adapters` option when custom options are needed.

| Option | Type | Default | Description |
|---|---|---|---|
| `timeoutMs` | `number` | `60000` | Connection and signing timeout in milliseconds |
| `maxFeeDrops` | `string` | `"1000000"` | XRPL transaction fee ceiling |
| `supportedChains` | `WalletChainFilter` | XRPL Mainnet/Testnet | Restrict chains in a protocol-aware integration |

## Transactions

<!--@include: ../../.vitepress/snippets/adapter-transactions.md#introduction-->

### Payment

::: code-group
<!--@include: ../../.vitepress/snippets/adapter-transactions.md#payment-submit-->
<!--@include: ../../.vitepress/snippets/adapter-transactions.md#payment-sign-only-->
:::

The adapter verifies the signed result before returning it or submitting it. A configured/request fee ceiling can reject a signed transaction with excessive fees.

### NFT Transactions

<!--@include: ../../.vitepress/snippets/adapter-transactions.md#nft-->

For sign-only NFT requests, pass the same `txJson` to `manager.signTransaction()`. Do not infer Batch support from generic transaction signing.

## Authentication

Neither arbitrary `signMessage()` nor wallet-native `signIn()` is exposed. Connection approval is not a backend login proof; choose an authentication-capable adapter when your application needs one.

## Sessions and Disconnect

Xyra does not expose passive session restore. After reload, reconnect from a user action. `manager.disconnect()` clears local state and pending popup work, not wallet credentials.

<div id="browser-requirements"></div>

## Integration Notes

- Use HTTPS or localhost and allow popups for connection and signing.
- Preserve the requesting origin with `Referrer-Policy: strict-origin-when-cross-origin` or `origin`; avoid `no-referrer`, `noopener` and `noreferrer` for the wallet popup.
- If setting COOP, use `Cross-Origin-Opener-Policy: same-origin-allow-popups`. Allow `data:` in CSP `img-src` for the embedded icon.
- Transaction JSON is sent in the popup URL. Do not put secrets in transaction metadata.
- Check a transaction's hash before retrying a submission with an unknown outcome.

## Troubleshooting

| Symptom | Action |
|---|---|
| Xyra is missing on XRPL | Add `"xyra"` explicitly to `wallets` |
| Popup is blocked | Start the request from a user action and allow popups |
| Wallet cannot identify the dApp origin | Check referrer and opener policies |
| Fee limit is rejected on Xahau | Configure a positive global/request fee ceiling as shown in the Xahau guide |

## Related Guides

- [Adapters Overview](/docs/adapters/overview)
- [Xahau Configuration](/docs/configuration/xahau)
- [Xyra Developer Documentation](https://www.xyra.now/developers)
