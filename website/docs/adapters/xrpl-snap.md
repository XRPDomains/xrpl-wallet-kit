# XRPL Snap Adapter

[XRPL Snap](https://snaps.metamask.io) connects XRPL accounts through MetaMask's Snaps APIs. The wallet appears as MetaMask in the connect UI.

| Integration | Value |
|---|---|
| Package | `@xrpl-wallet-kit/adapter-xrpl-snap` |
| Adapter ID | `xrplsnap` |
| Wallet type | MetaMask Snap |
| Client registration | Included in default XRPL wallet lists; `xrpl-snap` is a client alias |

<div id="requirements"></div>

## Installation

```sh
npm install @xrpl-wallet-kit/core @xrpl-wallet-kit/adapter-xrpl-snap xrpl@^4
```

For the Client tab below, install `@xrpl-wallet-kit/client` instead. MetaMask must expose Snaps APIs such as `wallet_getSnaps` and `wallet_requestSnaps`.

<div id="quick-start"></div>
<div id="connection-flow"></div>

## Connect

::: code-group

```ts [Client]
import { createWalletKit } from "@xrpl-wallet-kit/client";

const kit = createWalletKit({ network: "mainnet", wallets: ["xrplsnap"] });
const { manager } = kit;
const { account } = await kit.connect("xrplsnap");
```

```ts [Core]
import { WalletManager } from "@xrpl-wallet-kit/core";
import { createXrplSnapAdapter } from "@xrpl-wallet-kit/adapter-xrpl-snap";

const manager = new WalletManager({
  network: "mainnet",
  adapters: [createXrplSnapAdapter()],
});
const { account } = await manager.connect("xrplsnap");
```

:::

Start connection from a user action. MetaMask requests permission to install the Snap if needed, then returns the selected account. The adapter prefers a detected MetaMask provider over another extension occupying `window.ethereum`.

## Networks

XRPL `mainnet`, `testnet` and `devnet` map to Snap chain IDs 0, 1 and 2. Network selection/verification depends on the installed Snap's network methods. Xahau is not supported by this adapter.

## Capabilities

This table describes Kit's Snap integration, not all possible methods of custom Snaps.

| Operation | Support |
|---|---|
| Connect | Yes |
| Disconnect | Local Kit cleanup; no provider-level disconnect |
| Session restore | Cached account with an available Snaps provider; not fresh account verification |
| `signTransaction()` | Not exposed |
| `signAndSubmit()` | Yes |
| `signMessage()` | Yes; `signedTx` proof |
| `signIn()` | Not exposed |
| `switchNetwork()` | Not exposed as a manager operation |
| Payment / NFT transactions | Generic `txJson`; installed Snap dependent |
| QR / deep link | No |

## Options

These options apply to `createXrplSnapAdapter()`. Pass a configured adapter through the client's `adapters` option when needed.

| Option | Type | Default | Description |
|---|---|---|---|
| `ethereum` | `Eip1193Provider` | Detected MetaMask provider | Supply a specific Snaps-capable provider |
| `snapId` | `string` | `"npm:xrpl-snap"` | Snap to install and invoke |
| `icon` | `string` | Embedded MetaMask icon | Custom icon URL or data URI |
| `signMessageDestination` | `string` | Connected account | Destination of the sign-only message-proof Payment |
| `signMessageMethods` | `string[]` | `xrpl_signMessage`, `xrpl_sign`, `xrpl_signTransaction`, `npm:xrpl-snap` | Signing methods tried in order |
| `providerDiscoveryTimeoutMs` | `number` | `1000` | Time to wait for provider discovery |
| `snapRequestRetryDelaysMs` | `number[]` | `[120, 350, 800]` | Retry delays for Snap keyring hydration errors only |

## Transactions

<!--@include: ../../.vitepress/snippets/adapter-transactions.md#introduction-->

### Payment

<!--@include: ../../.vitepress/snippets/adapter-transactions.md#payment-submit-->

Submission uses the Snap's `xrpl_signAndSubmit` method. The adapter does not expose generic `manager.signTransaction()`; message-proof signing does not make transaction sign-only generally available.

### NFT Transactions

<!--@include: ../../.vitepress/snippets/adapter-transactions.md#nft-->

The installed Snap must understand the requested transaction type and fields. Do not infer universal amendment or Batch support.

<div id="message-signing"></div>

## Authentication

```ts
const proof = await manager.signMessage({ message: "Verify wallet ownership" });
console.log(proof.signatureKind); // "signedTx"
console.log(proof.txBlob);
```

Kit builds a 1-drop Payment containing the message in a Memo and asks the Snap to sign without submitting. This is a signed transaction proof, not a compact signature. Use [Message Authentication](/docs/auth/introduction) for server verification. Native `signIn()` is not exposed; never broadcast the authentication transaction.

<div id="session-restore-mobile-return-recovery"></div>

## Sessions and Disconnect

`manager.autoReconnect()` restores cached account metadata only when a Snaps-capable MetaMask provider is available. This path does not freshly verify the cached account against a passive Snap account query; it must not establish a backend login session.

`manager.disconnect()` clears Kit state, not MetaMask/Snap site permissions.

<div id="known-limitations"></div>

## Integration Notes

- Provider discovery considers `window.ethereum.providers` and EIP-6963 announcements before falling back to `window.ethereum`.
- When another extension overrides MetaMask, pass the intended `ethereum` provider explicitly.
- Generic submission and message-proof methods depend on the installed Snap. Keep `signMessageMethods` aligned with the Snap you select.

## Troubleshooting

| Symptom | Action |
|---|---|
| MetaMask is not detected | Enable a Snaps-capable MetaMask provider for the site |
| `wallet_requestSnaps` is unavailable | The active provider/environment does not support Snaps; select the correct provider |
| Installation is rejected | Retry only after the user chooses to grant Snap permissions |
| Signing method is missing | Check the installed Snap's supported methods and your `signMessageMethods` |
| Snap network cannot be verified | Check its network API support and the network selected in the wallet |

## Related Guides

- [Adapters Overview](/docs/adapters/overview)
- [Message Authentication](/docs/auth/introduction)
- [MetaMask Snaps](https://snaps.metamask.io)
