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

Supports the standard XRPL Mainnet and Testnet presets (`mainnet` and `testnet`). Custom network definitions, Devnet, XRPL EVM and Xahau are not supported. Reconnect to change networks.

## Capabilities

| Operation | Support |
|---|---|
| Connect | Yes |
| Disconnect | Yes; clears local session |
| Session restore | No; reconnect from a user action |
| `signTransaction()` | Yes; returns a verified signed blob |
| `signAndSubmit()` | Yes; Clasp signs and broadcasts |
| `signMessage()` | Not exposed |
| `signIn()` | Not exposed |
| `switchNetwork()` | Not exposed; reconnect on the target network |
| Payment / NFT transactions | Generic `txJson`; transaction availability depends on Clasp |
| QR / deep link | No |

## Options

These options apply to `createClaspAdapter()`, not top-level client options. Pass the configured adapter through the client's `adapters` option.

| Option | Type | Default | Description |
|---|---|---|---|
| `maxFeeDrops` | `string` | `"1000000"` for sign-only | Fee ceiling in drops. An explicit adapter/request ceiling also requires `txJson.Fee` for native submission |
| `client` | `ClaspAdapterOptions["client"]` | Kit's Clasp v1 client | Optional SDK-compatible replacement; implement `cancelPendingRequest(reason)` to clean up pending requests |

## Transactions

<!--@include: ../../.vitepress/snippets/adapter-transactions.md#introduction-->

| Kit operation | Clasp method | Result |
|---|---|---|
| `signTransaction()` / `submit: false` | `sign` | Verified `txBlob` and hash; not broadcast |
| `signAndSubmit()` | `sign_and_submit` | Hash and submitted status |

`txJson` is authoritative. Optional `walletPayload` and `methodHint` do not override it.

The examples below use `quotedFeeDrops`: a fresh fee quote in drops for the selected network and transaction, obtained by your dApp before the approval click. `Fee` is the exact fee; `maxFeeDrops` is its ceiling. If no ceiling is configured, Clasp can fill the omitted fee during native submission.

### Payment

::: code-group
<!--@include: ../../.vitepress/snippets/clasp-transactions.md#payment-submit-->
<!--@include: ../../.vitepress/snippets/clasp-transactions.md#payment-sign-only-->
:::

For Clasp-managed submission with a fee ceiling, add an explicit `Fee` to `txJson` at or below the ceiling.

### NFT Transactions

<!--@include: ../../.vitepress/snippets/clasp-transactions.md#nft-->

Use the same explicit `Fee` rule for these submission examples. For sign-only requests, pass the transaction to `manager.signTransaction()`.

## Authentication

Neither `signMessage()` nor native `signIn()` is exposed. Clasp's `sign` method signs a real transaction, not a login message. Connection approval is not a backend login proof; use an authentication-capable adapter and the appropriate [backend verifier](/docs/auth/introduction). Clasp's separate SDK `connect({ challenge })` proof flow is not exposed by Kit.

## Sessions and Disconnect

After reload, reconnect from a user action. `manager.disconnect()` clears Kit's account state and cancels local waiting, not wallet credentials. A cancelled or timed-out connection/sign-only request can be retried explicitly.

Once submission has been requested, local cancellation cannot revoke it. The approval window may remain open; check the ledger before retrying. Kit never automatically replays a submission.

## Integration Notes

- Start on Testnet, and check the validated ledger result before treating any submission as final.
- Use HTTPS or localhost and allow wallet popups. Start connection and approval from user actions.
- The adapter supports generic single-transaction signing, not multisigning or Batch.
- Submission errors preserve `details.hash` when the wallet supplies one. A confirmed ledger failure has `final: true` and `outcomeUnknown: false`; missing confirmation remains uncertain.

## Troubleshooting

| Symptom | Action |
|---|---|
| Popup is blocked | Start the request from a user action and allow popups |
| Clasp is missing from the wallet list | Install the standalone adapter and pass it through `adapters`, not `wallets` |
| Fee ceiling rejects submission | Set a transaction-appropriate `txJson.Fee` at or below the configured ceiling |
| Popup opens but the dApp gets no reply | Use the default COOP policy or `Cross-Origin-Opener-Policy: same-origin-allow-popups`, not `same-origin` |
| Submission outcome is unknown | Check `details.hash` on the ledger before starting another request |

## Related Guides

- [Adapters Overview](/docs/adapters/overview)
- [WalletManager](/docs/api/wallet-manager)
- [NFT Marketplace](/docs/use-cases/nft-marketplace)
- [Clasp developer docs](https://claspwallet.com/developers/)
