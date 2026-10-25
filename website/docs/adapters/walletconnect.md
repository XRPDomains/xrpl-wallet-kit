# WalletConnect Adapter

[WalletConnect](https://walletconnect.com) connects compatible XRPL wallets using WalletConnect v2, QR codes and wallet deep links. Choose a generic WalletConnect entry or separate entries for supported wallet configurations.

| Integration | Value |
|---|---|
| Package | `@xrpl-wallet-kit/adapter-walletconnect` |
| Adapter ID | `walletconnect`; detail entries use wallet-specific IDs |
| Wallet type | WalletConnect protocol |
| Client registration | Included when `walletConnectProjectId` is provided |

## Installation

```sh
npm install @xrpl-wallet-kit/core @xrpl-wallet-kit/adapter-walletconnect xrpl@^4
```

For the Client tab below, install `@xrpl-wallet-kit/client` instead. Obtain a project ID from [WalletConnect Cloud](https://cloud.walletconnect.com).

<div id="quick-start"></div>
<div id="connection-flow"></div>

## Connect

::: code-group

```ts [Client]
import { createWalletKit } from "@xrpl-wallet-kit/client";

const kit = createWalletKit({
  network: "mainnet",
  wallets: ["walletconnect"],
  walletConnectProjectId: "YOUR_WALLETCONNECT_PROJECT_ID",
});
const { manager } = kit;
const { account } = await kit.connect("walletconnect");
```

```ts [Core]
import { WalletManager } from "@xrpl-wallet-kit/core";
import { createWalletConnectAdapter } from "@xrpl-wallet-kit/adapter-walletconnect";

const manager = new WalletManager({
  network: "mainnet",
  adapters: [createWalletConnectAdapter({
    projectId: "YOUR_WALLETCONNECT_PROJECT_ID",
    metadata: {
      name: "My dApp", description: "My XRPL dApp",
      url: "https://my-dapp.example", icons: [],
    },
  })],
});
const { account } = await manager.connect("walletconnect");
```

:::

Start connection from a user action. The default factory uses AppKit's QR modal on desktop and mobile. Approve the dApp and requested network in the chosen wallet.

## Networks

The standard XRPL presets use `xrpl:0` (Mainnet), `xrpl:1` (Testnet) and `xrpl:2` (Devnet). The wallet must approve the requested chain and methods. Custom network definitions need a valid `walletConnectChainId`. Xahau is not supported by this adapter.

## Capabilities

These are adapter operations; actual signing support also depends on the connected wallet and approved session.

| Operation | Support |
|---|---|
| Connect | Yes |
| Disconnect | Yes |
| Session restore | Generic entry only, with an active stored session; detail entries reconnect explicitly |
| `signTransaction()` | Yes, if the wallet returns a signed blob without submitting |
| `signAndSubmit()` | Yes |
| `signMessage()` | Enabled by default; `signedTx` proof, wallet support required |
| `signIn()` | Not exposed |
| `switchNetwork()` | Not exposed; reconnect for the requested chain |
| Payment / NFT transactions | Generic `txJson`; connected wallet dependent |
| QR / deep link | Yes; depends on modal mode and wallet configuration |

## Options

These options apply to `createWalletConnectAdapter()`. The client helper exposes `walletConnectProjectId`, app metadata and `ui.walletConnect`; supply configured `adapters` for lower-level control.

| Option | Type | Default | Description |
|---|---|---|---|
| `projectId` | `string` | Required | WalletConnect project ID |
| `useModal` | `boolean` | `true` | Use AppKit's built-in modal |
| `modalMode` | `"always"`, `"mobile-only"` or `"never"` | `"always"` | Where AppKit is shown; custom QR is used otherwise |
| `metadata` | `SignClientTypes.Metadata` | Not set | dApp name, description, URL and icons |
| `themeMode` | `"light"` or `"dark"` | AppKit default | AppKit appearance |
| `signMessage` | `boolean` | `true` | Enable Kit's message-proof signing operation |
| `signMessageDestination` | `string` | Connected account | Destination for the sign-only message-proof Payment |
| `deeplink` | `(uri: string) => string` | Wallet-specific | Build a wallet deep link |
| `onQr` | `(event) => void` | Not set | Receive the URI for custom QR UI |
| `id` / `name` | `string` | `walletconnect` / `WalletConnect` | Adapter identity/display name |
| `icon` | `string` | Embedded WalletConnect icon | Custom icon URL or data URI |
| `requestTimeoutMs` | `number` | `120000` | Connection handshake timeout |
| `signRequestTimeoutMs` | `number` | Request/adapter policy | Override signing timeout |
| `signClient` | `SignClient` | Created on demand | Existing WalletConnect client |
| `recoveryStorage` | `WalletStorage` | Browser storage | Pending recovery markers |
| `onDebug` | `(event: WalletConnectDebugEvent) => void` | Not set | Optional adapter diagnostics |

Defaults above describe the singular factory; detail-mode entries can select their own modal/deep-link defaults.

## Transactions

<!--@include: ../../.vitepress/snippets/adapter-transactions.md#introduction-->

### Payment

::: code-group
<!--@include: ../../.vitepress/snippets/adapter-transactions.md#payment-submit-->
<!--@include: ../../.vitepress/snippets/adapter-transactions.md#payment-sign-only-->
:::

Requests use `xrpl_signTransaction`. Sign-only must return a signed blob and must not broadcast. A wallet that cannot fulfill this contract cannot supply Kit's portable message-proof flow either.

### NFT Transactions

<!--@include: ../../.vitepress/snippets/adapter-transactions.md#nft-->

For sign-only NFT requests, pass the same `txJson` to `manager.signTransaction()` when the connected wallet supports it.

<div id="message-signing"></div>

## Authentication

```ts
const proof = await manager.signMessage({ message: "Verify wallet ownership" });
console.log(proof.signatureKind); // "signedTx"
console.log(proof.txBlob);
```

Kit's portable flow signs a 1-drop Payment with the message in a Memo, without submitting it. It returns a transaction proof, not a compact signature; see [Message Authentication](/docs/auth/introduction). Set `signMessage: false` to disable this capability. Native `signIn()` is not exposed; never broadcast the authentication transaction.

<div id="session-restore-mobile-return-recovery"></div>

## Sessions and Disconnect

`manager.autoReconnect()` can restore a generic WalletConnect entry from a still-valid stored SignClient session. Detail entries require an explicit connection; they do not background-restore after reload.

`manager.disconnect()` closes the active pairing/session and clears Kit state. After a request-time stale pairing/proposal error, reconnect explicitly; do not automatically replay a signing/submission request with an unknown outcome.

<div id="known-limitations"></div>

## Integration Notes

### Modal and Custom QR

| `modalMode` | Desktop | Mobile |
|---|---|---|
| `"always"` | AppKit | AppKit |
| `"mobile-only"` | Custom QR event | AppKit |
| `"never"` | Custom QR event | Custom QR event |

For custom QR, set `useModal: false`, `modalMode: "never"` and handle `onQr` or manager `qr` events. The built-in Kit modal can render these events; custom UIs must render the returned URI themselves.

<div id="multi-wallet-setup"></div>
<div id="supported-wallets-details-mode"></div>

### Wallet Detail Entries

```ts
import { createWalletConnectAdapters } from "@xrpl-wallet-kit/adapter-walletconnect";

const adapters = createWalletConnectAdapters({
  projectId: "YOUR_WALLETCONNECT_PROJECT_ID",
  mode: "details", // "default" creates one generic entry
  wallets: ["bitget", "girin"], // or "all"
});
```

| Wallet | Detail ID |
|---|---|
| Bitget Wallet | `bitget` |
| Joey Wallet | `joey` |
| Girin Wallet | `girin` |
| Bifrost Wallet | `bifrost` |
| StaticBit | `staticbit` |

Joey's native extension is the separate [Joey Wallet adapter](/docs/adapters/joey-wallet), ID `joey-wallet`.

<div id="namespace-details"></div>

### Session Methods

The adapter proposes `xrpl_signTransaction`, `xrpl_signTransactionFor` and `xrpl_signMessage` through optional namespaces. Approval of a session does not prove support for every optional method. Kit's `signMessage()` flow above still requires sign-only transaction support rather than assuming a raw native message signature.

## Troubleshooting

| Symptom | Action |
|---|---|
| QR/URI expires | Start a fresh connection and approve it before expiry |
| Session does not restore | Check expiry; detail-mode entries intentionally require reconnecting |
| Wrong network | Connect to the requested chain and select it in the wallet |
| Stale pairing/proposal/key error | Reconnect after cleanup; check any dispatched transaction before retrying |
| Sign-only does not return a blob | Use a wallet supporting the required sign-only contract |

## Related Guides

- [Adapters Overview](/docs/adapters/overview)
- [Message Authentication](/docs/auth/introduction)
- [Joey Wallet Extension](/docs/adapters/joey-wallet)
- [WalletConnect Cloud](https://cloud.walletconnect.com)
