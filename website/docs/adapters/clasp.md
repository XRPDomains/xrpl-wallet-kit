# Clasp Adapter

[Clasp](https://claspwallet.com/) is a passkey-based web wallet that opens its own approval window. No extension or WalletConnect project ID is required.

| Integration | Value |
|---|---|
| Package | `@xrpl-wallet-kit/adapter-clasp` |
| Adapter ID | `clasp` |
| Wallet type | Hosted web / popup |
| Client registration | Opt-in through `adapters`; excluded from the built-in wallet list |

## Installation

```sh
npm install @xrpl-wallet-kit/core @xrpl-wallet-kit/adapter-clasp xrpl@^4
```

For the Client example, also install `@xrpl-wallet-kit/client`.

## Connect

::: code-group

```ts [Client]
import { createWalletKit } from "@xrpl-wallet-kit/client";
import { createClaspAdapter } from "@xrpl-wallet-kit/adapter-clasp";

const kit = createWalletKit({ network: "testnet", adapters: [createClaspAdapter()] });
const { manager } = kit;
const { account } = await kit.connect("clasp");
```

```ts [Core]
import { WalletManager } from "@xrpl-wallet-kit/core";
import { createClaspAdapter } from "@xrpl-wallet-kit/adapter-clasp";

const manager = new WalletManager({ network: "testnet", adapters: [createClaspAdapter()] });
const { account } = await manager.connect("clasp");
```

:::

Connect and sign from a user action so the browser can open the wallet popup. Passing `adapters` to the client replaces its built-in adapter list.

## Networks

XRPL Mainnet and Testnet (`mainnet` and `testnet`). XRPL Devnet, XRPL EVM and Xahau are not supported.

## Capabilities

| Operation | Support |
|---|---|
| Connect | Yes |
| Disconnect | Yes; clears local session |
| Session restore | Not exposed |
| `signTransaction()` | Yes; returns a verified signed blob |
| `signAndSubmit()` | Yes; Clasp signs and broadcasts |
| `signMessage()` | Not exposed |
| `signIn()` | Not exposed |
| `switchNetwork()` | Not exposed; reconnect on the target network |
| Payment / NFT transactions | Generic `txJson`; transaction availability depends on Clasp |
| QR / deep link | No |

## Options

| Option | Default | Description |
|---|---|---|
| `maxFeeDrops` | `"1000000"` | Default sign-only fee ceiling in drops |
| `client` | Official Clasp SDK client | Optional application-supplied SDK client |

## Transactions

<!--@include: ../../.vitepress/snippets/adapter-transactions.md#introduction-->

### Payment

::: code-group
<!--@include: ../../.vitepress/snippets/adapter-transactions.md#payment-submit-->
<!--@include: ../../.vitepress/snippets/adapter-transactions.md#payment-sign-only-->
:::

For Clasp-managed submission with a fee ceiling, add an explicit `Fee` to `txJson` at or below the ceiling.

### NFT Transactions

<!--@include: ../../.vitepress/snippets/adapter-transactions.md#nft-->

Use the same explicit `Fee` rule for these submission examples. For sign-only requests, pass the transaction to `manager.signTransaction()`.

## Authentication

The passkey authorizes actions inside Clasp. A connected wallet is not proof of login to your dApp backend; the adapter does not expose `signMessage()` or `signIn()`.

## Sessions and Disconnect

Reconnect explicitly after reload. Disconnect clears Kit state, but the SDK may reuse the Clasp window for another request.

## Integration Notes

- Start on Testnet, and check the validated ledger result before treating any submission as final.
- Do not retry automatically after a submission with an unknown outcome.

## Troubleshooting

| Symptom | Action |
|---|---|
| Popup is blocked | Start the request from a user action and allow popups |
| Popup opens but the dApp gets no reply | Check the Cross-Origin-Opener-Policy requirements in the Clasp developer docs |

## Related Guides

- [Adapters Overview](/docs/adapters/overview)
- [Clasp developer docs](https://claspwallet.com/developers/)
