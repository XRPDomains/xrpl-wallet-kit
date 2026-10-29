# GemWallet Adapter

[GemWallet](https://gemwallet.app) connects through its browser extension API. No API key or WalletConnect project ID is required.

| Integration | Value |
|---|---|
| Package | `@xrpl-wallet-kit/adapter-gemwallet` |
| Adapter ID | `gemwallet` |
| Wallet type | Browser extension |
| Client registration | Included in default wallet lists |

## Installation

```sh
npm install @xrpl-wallet-kit/core @xrpl-wallet-kit/adapter-gemwallet xrpl@^4
```

For the Client tab below, install `@xrpl-wallet-kit/client` instead. Enable the GemWallet extension for the dApp's origin.

<div id="quick-start"></div>
<div id="connection-flow"></div>

## Connect

::: code-group

```ts [Client]
import { createWalletKit } from "@xrpl-wallet-kit/client";

const kit = createWalletKit({ network: "mainnet", wallets: ["gemwallet"] });
const { manager } = kit;
const { account } = await kit.connect("gemwallet");
```

```ts [Core]
import { WalletManager } from "@xrpl-wallet-kit/core";
import { createGemWalletAdapter } from "@xrpl-wallet-kit/adapter-gemwallet";

const manager = new WalletManager({
  network: "mainnet",
  adapters: [createGemWalletAdapter()],
});
const { account } = await manager.connect("gemwallet");
```

:::

Start connection from a user action and approve access in the extension.

## Networks

Supports XRPL and Xahau; select the matching chain and network in GemWallet. For Xahau, the full client accepts `network: "xahau-mainnet"` or `"xahau-testnet"` with a positive `preflight.maxFeeDrops`. Core/selective integrations must configure the protocol and chain filter explicitly. See [Xahau Configuration](/docs/configuration/xahau).

## Capabilities

This table describes manager-level operations on XRPL. Xahau signing uses the chain-aware protocol path.

| Operation | Support |
|---|---|
| Connect | Yes |
| Disconnect | Local Kit cleanup; no provider-level disconnect |
| Session restore | XRPL and Xahau, with matching current account/network |
| `signTransaction()` | Yes, if the provider exposes `signTransaction` |
| `signAndSubmit()` | Yes |
| `signMessage()` | Yes; `signature` proof |
| `signIn()` | Not exposed |
| `switchNetwork()` | Not exposed; select in GemWallet and reconnect |
| Payment / NFT transactions | Yes, through `txJson` |
| QR / deep link | No |

## Options

These options apply to `createGemWalletAdapter()`. For custom adapter options with the client, pass a configured adapter through `adapters`.

| Option | Type | Default | Description |
|---|---|---|---|
| `provider` | `GemWalletProvider` | Detected provider | Supply a specific extension provider |
| `supportedChains` | `WalletChainFilter` | XRPL integration | Restrict chains in a protocol-aware integration |
| `xrplMaxFeeDrops` | `string` | `"1000000"` | Fee ceiling for XRPL sign-only; a request ceiling can lower it |
| `maxLastLedgerSequenceExtension` | `number` | `50` | Allowed expiry extension in the external-protocol path |

## Transactions

<!--@include: ../../.vitepress/snippets/adapter-transactions.md#introduction-->

### Payment

::: code-group
<!--@include: ../../.vitepress/snippets/adapter-transactions.md#payment-submit-->
<!--@include: ../../.vitepress/snippets/adapter-transactions.md#payment-sign-only-->
:::

On XRPL, submission maps `Payment` to `sendPayment()` and `TrustSet` to `setTrustline()`, including camelCase field conversion. NFT offers map to their provider methods; other transactions use generic signing. Set `methodHint` only when you need to override detection. On Xahau, Kit prepares and verifies the generic signed transaction before RPC submission.

### NFT Transactions

<!--@include: ../../.vitepress/snippets/adapter-transactions.md#nft-->

For sign-only NFT requests, pass the same `txJson` to `manager.signTransaction()` if `manager.can("signTransaction")` is true.

<div id="message-signing"></div>

## Authentication

```ts
const proof = await manager.signMessage({ message: "Verify wallet ownership" });
console.log(proof.signatureKind); // "signature"
console.log(proof.signature, proof.publicKey);
```

GemWallet returns a compact message signature. Use a server-issued challenge and backend verification for login; see [Message Authentication](/docs/auth/introduction). Native `signIn()` is not exposed.

<div id="session-restore-mobile-return-recovery"></div>

## Sessions and Disconnect

`manager.autoReconnect()` checks that GemWallet still reports the stored account and requested network. On Xahau, the manager also restores the registered protocol context so subsequent signing and submission use the Xahau codec and verification flow. The full client provides this runtime automatically; core/selective integrations must register it.

If GemWallet cannot report its current account or network, reconnect explicitly. A stored session or configured network alone is not sufficient proof for restoration.

`manager.disconnect()` clears Kit's session. It does not revoke the extension's site permissions.

<div id="known-limitations"></div>

## Integration Notes

- Availability and the Installed badge do not mean the wallet is connected. Allow time for extension injection and grant site access.
- Sign-only requires a provider version with `signTransaction`; check `manager.can("signTransaction")` when supplying a custom provider.
- Xahau fees require a positive request or global ceiling; do not treat the XRPL adapter ceiling as a Xahau fee policy.

## Troubleshooting

| Symptom | Action |
|---|---|
| Extension or Installed badge is missing | Enable GemWallet for this site and let detection refresh |
| Network mismatch | Select the requested chain/network in the extension and reconnect |
| Sign-only is unavailable | Update the extension or check your custom provider's methods |
| Wrong specialized transaction method | Use standard `txJson`, or specify an appropriate `methodHint` |

## Related Guides

- [Adapters Overview](/docs/adapters/overview)
- [Xahau Configuration](/docs/configuration/xahau)
- [Message Authentication](/docs/auth/introduction)
