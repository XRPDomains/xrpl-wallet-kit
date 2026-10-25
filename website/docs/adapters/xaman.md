# Xaman Adapter

[Xaman](https://xaman.app) connects a mobile wallet using browser authorization, QR codes and deep links. No browser extension is required.

| Integration | Value |
|---|---|
| Package | `@xrpl-wallet-kit/adapter-xaman` |
| Adapter ID | `xaman` |
| Wallet type | Mobile app |
| Client registration | Included when `xamanClientId` is provided |

## Installation

```sh
npm install @xrpl-wallet-kit/core @xrpl-wallet-kit/adapter-xaman xrpl@^4
```

For the Client tab below, install `@xrpl-wallet-kit/client` instead. Create an API key at [apps.xaman.dev](https://apps.xaman.dev) and allow your dApp's domain.

<div id="quick-start"></div>
<div id="connection-flow"></div>

## Connect

::: code-group

```ts [Client]
import { createWalletKit } from "@xrpl-wallet-kit/client";

const kit = createWalletKit({
  network: "mainnet",
  wallets: ["xaman"],
  xamanClientId: "YOUR_XAMAN_CLIENT_ID",
});
const { manager } = kit;
const { account } = await kit.connect("xaman");
```

```ts [Core]
import { WalletManager } from "@xrpl-wallet-kit/core";
import { createXamanAdapter } from "@xrpl-wallet-kit/adapter-xaman";

const manager = new WalletManager({
  network: "mainnet",
  adapters: [createXamanAdapter({ apiKey: "YOUR_XAMAN_CLIENT_ID" })],
});
const { account } = await manager.connect("xaman");
```

:::

Start connection from a user action. On desktop, approve the browser authorization and scan the QR when shown; on mobile, open Xaman using the deep link. For custom QR UI, listen to manager `qr` events or provide `onQr`.

## Networks

Supports XRPL and Xahau. With the full client, set `network: "xahau-mainnet"` or `"xahau-testnet"` and a positive `preflight.maxFeeDrops`; the client configures the protocol automatically. Core/selective integrations must register the Xahau protocol and adapter chain filter explicitly. See [Xahau Configuration](/docs/configuration/xahau).

## Capabilities

This table describes manager-level operations on XRPL. Xahau connection and signing requirements are documented in the network guide above.

| Operation | Support |
|---|---|
| Connect | Yes |
| Disconnect | Yes; clears the Xaman authorization/session |
| Session restore | Yes, with matching saved SDK account on XRPL |
| `signTransaction()` | Yes, through the declared sign-only fallback |
| `signAndSubmit()` | Yes |
| `signMessage()` | Yes; `signedTx` proof |
| `signIn()` | Not exposed |
| `switchNetwork()` | Not exposed; reconnect for the selected network |
| Payment / NFT transactions | Yes, through `txJson` |
| QR / deep link | Yes |

## Options

These options apply to `createXamanAdapter()`, not directly to `createWalletKit()`.

| Option | Type | Default | Description |
|---|---|---|---|
| `apiKey` | `string` | Required unless `auth` or `sdk` is supplied | Xaman OAuth client/API key; the client helper calls this `xamanClientId` |
| `auth` | `XamanPkceAuth` | Not set | Custom authorization handler |
| `sdk` | `XamanSdkLike` | Not set | Existing Xaman SDK instance |
| `icon` | `string` | Embedded Xaman icon | Custom icon URL or data URI |
| `deeplink` | `(uri: string) => string` | Wallet default | Build a deep link for a payload |
| `onQr` | `(event) => void` | Not set | Receive `{ adapterId, uri, deeplink?, qrPng? }` |
| `recoveryStorage` | `WalletStorage` | Browser storage | Storage for pending mobile-return recovery |
| `supportedChains` | `WalletChainFilter` | XRPL integration | Restrict allowed chains for protocol-aware integrations |
| `maxLastLedgerSequenceExtension` | `number` | `50` | Maximum permitted expiry extension; set `0` for exact preservation |

## Transactions

<!--@include: ../../.vitepress/snippets/adapter-transactions.md#introduction-->

### Payment

::: code-group
<!--@include: ../../.vitepress/snippets/adapter-transactions.md#payment-submit-->
<!--@include: ../../.vitepress/snippets/adapter-transactions.md#payment-sign-only-->
:::

Xaman implements sign-only through `signAndSubmit({ submit: false })` internally. DApps still call the standard `manager.signTransaction()` and receive `txBlob` without submission.

### NFT Transactions

<!--@include: ../../.vitepress/snippets/adapter-transactions.md#nft-->

For sign-only NFT requests, pass the same `txJson` to `manager.signTransaction()`.

<div id="message-signing"></div>

## Authentication

`signMessage()` returns a signed `SignIn` transaction with the message in a Memo, not a compact signature:

```ts
const proof = await manager.signMessage({ message: "Verify wallet ownership" });
console.log(proof.signatureKind); // "signedTx"
console.log(proof.txBlob);
```

Verify the transaction proof on your backend using the [Message Authentication guide](/docs/auth/introduction). The adapter does not expose the separate wallet-native `signIn()` operation.

<div id="session-restore-mobile-return-recovery"></div>

## Sessions and Disconnect

Call `manager.autoReconnect()` on startup to restore a matching XRPL SDK account or complete a pending mobile return. Mobile recovery markers expire after three minutes. Stored network context is not proof that the mobile wallet changed networks; reconnect explicitly on Xahau after reload.

Use `manager.disconnect()` to clear the active session and authorization.

<div id="known-limitations"></div>

## Integration Notes

- Allow browser authorization popups/redirects and register the dApp domain in the Xaman developer portal.
- Xaman may extend a transaction's expiry within `maxLastLedgerSequenceExtension`; other requested transaction fields must remain consistent.
- Message proofs and sign-only transactions must not be submitted as authentication requests.

## Troubleshooting

| Symptom | Action |
|---|---|
| Authorization or QR does not appear | Check `apiKey`/`xamanClientId`, the allowed domain and popup permissions |
| Connection times out | Start a new connection and approve it in Xaman |
| Mobile return cannot recover | Start a fresh connection if the recovery marker expired |
| Wrong chain/network | Select the requested network in Xaman and reconnect |

## Related Guides

- [Adapters Overview](/docs/adapters/overview)
- [Xahau Configuration](/docs/configuration/xahau)
- [Message Authentication](/docs/auth/introduction)
