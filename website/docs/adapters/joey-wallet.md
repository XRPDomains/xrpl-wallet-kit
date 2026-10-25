# Joey Wallet Adapter

[Joey Wallet](https://joeywallet.xyz/) connects directly to the browser extension through its official SDK. This adapter uses `joey-wallet`; the separate `joey` entry connects through WalletConnect.

| Integration | Value |
|---|---|
| Package | `@xrpl-wallet-kit/adapter-joey-wallet` |
| Adapter ID | `joey-wallet` |
| Wallet type | Browser extension |
| Client registration | Opt-in; excluded from default lists and `wallets: "all"` |

## Installation

```sh
npm install @xrpl-wallet-kit/core @xrpl-wallet-kit/adapter-joey-wallet xrpl@^4
```

For the Client tab below, install `@xrpl-wallet-kit/client` instead. Enable the Joey Wallet extension for the dApp.

## Connect

::: code-group

```ts [Client]
import { createWalletKit } from "@xrpl-wallet-kit/client";

const kit = createWalletKit({ network: "mainnet", wallets: ["joey-wallet"] });
const { manager } = kit;
const { account } = await kit.connect("joey-wallet");
```

```ts [Core]
import { WalletManager } from "@xrpl-wallet-kit/core";
import { createJoeyWalletAdapter } from "@xrpl-wallet-kit/adapter-joey-wallet";

const manager = new WalletManager({
  network: "mainnet",
  adapters: [createJoeyWalletAdapter({
    onDisconnected: () => manager.emitDisconnected("joey-wallet"),
  })],
});
const { account } = await manager.connect("joey-wallet");
```

:::

Call connect from a user action. The client wires disconnection events automatically; core integrations should provide `onDisconnected` so revoked access or account/network changes invalidate the manager session.

## Networks

Supports the standard XRPL Mainnet, Testnet and Devnet presets (`mainnet`, `testnet`, `devnet`). Select the same network in Joey and the dApp. Custom RPC/network definitions and Xahau are not supported by this adapter.

## Capabilities

This table describes the native extension adapter, not the Joey WalletConnect entry.

| Operation | Support |
|---|---|
| Connect | Yes |
| Disconnect | Yes |
| Session restore | Yes, for an existing grant on the same network |
| `signTransaction()` | Yes |
| `signAndSubmit()` | Yes |
| `signMessage()` | Not exposed |
| `signIn()` | Yes; CAIP-122 or Ledger transaction challenge |
| `switchNetwork()` | Not exposed; select in Joey and reconnect |
| Payment / NFT transactions | Through generic `txJson` signing |
| QR / deep link | No; use the WalletConnect entry for that flow |

## Options

These options apply to `createJoeyWalletAdapter()`. Pass a configured adapter through the client's `adapters` option when custom options are needed.

| Option | Type | Default | Description |
|---|---|---|---|
| `provider` | `JoeyInjectedProvider` | Detected Joey provider | Supply a specific provider |
| `maxFeeDrops` | `string` | `"1000000"` | Adapter fee ceiling; a request can lower it |
| `onDisconnected` | `() => void` | Not set | Invalidate the manager session after access, account or network changes |

## Transactions

<!--@include: ../../.vitepress/snippets/adapter-transactions.md#introduction-->

### Payment

::: code-group
<!--@include: ../../.vitepress/snippets/adapter-transactions.md#payment-submit-->
<!--@include: ../../.vitepress/snippets/adapter-transactions.md#payment-sign-only-->
:::

The adapter verifies the returned blob, signer, transaction hash, requested fields and fee ceiling.

<div id="nft-offers"></div>

### NFT Transactions

<!--@include: ../../.vitepress/snippets/adapter-transactions.md#nft-->

For sign-only NFT requests, pass the same `txJson` to `manager.signTransaction()`. Generic signing does not enable Batch, bulk signing or multisigning in this adapter.

<div id="native-sign-in"></div>

## Authentication

Obtain `nonceFromServer` from your backend, then use the separate native `signIn()` API, not `signMessage()`:

```ts
const proof = await manager.signIn({
  nonce: nonceFromServer,
  statement: "Sign in to My dApp",
});
// Send proof to your backend before establishing a login session.
```

Joey returns a CAIP-122 message signature for software accounts or a transaction challenge for Ledger accounts. Verify the actual proof with `verifyWalletSignIn()` and atomically consume the nonce on the server. See [Wallet-Native Sign In](/docs/auth/native-sign-in). Arbitrary `signMessage()` remains unsupported; do not substitute one API for the other.

## Sessions and Disconnect

`manager.autoReconnect()` reads already granted accounts and the current network without an approval popup. It restores only a matching account/network. Account changes, network changes and revoked access require reconnecting.

`manager.disconnect()` clears the Kit session and calls Joey's disconnect API.

## Integration Notes

### Wallet Standard Discovery

If you also enable Wallet Standard discovery, exclude the native Joey entry from discovery to avoid duplicate listings:

```ts
import { startWalletStandardDiscovery } from "@xrpl-wallet-kit/core";

startWalletStandardDiscovery(manager, {
  resolveId: wallet => wallet.name === "Joey" ? null
    : `standard-${wallet.name.toLowerCase().replace(/[^a-z0-9-]/g, "-")}`,
});
```

This display-name filter controls listing only; it is not wallet authentication. Use `joey-wallet` for the extension and `joey` for [WalletConnect](/docs/adapters/walletconnect).

## Troubleshooting

| Symptom | Action |
|---|---|
| Joey is not in the wallet list | Add `"joey-wallet"` explicitly to `wallets` |
| Network mismatch | Select the matching standard XRPL network in Joey and reconnect |
| Two Joey entries appear | Distinguish native/WalletConnect entries or filter Wallet Standard discovery |
| Message signing is unavailable | Use native `signIn()` for login; arbitrary `signMessage()` is not exposed |

## Related Guides

- [Adapters Overview](/docs/adapters/overview)
- [Wallet-Native Sign In](/docs/auth/native-sign-in)
- [WalletConnect](/docs/adapters/walletconnect)
- [Joey Extension API](https://joeywallet.xyz/docs/browser-extension)
