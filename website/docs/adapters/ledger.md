# Ledger Adapter

[Ledger](https://www.ledger.com) connects to the hardware device through WebHID or WebUSB. Transaction approval happens on the device; private keys do not leave it.

| Integration | Value |
|---|---|
| Package | `@xrpl-wallet-kit/adapter-ledger` |
| Adapter ID | `ledger` |
| Wallet type | Hardware wallet |
| Client registration | Included on XRPL; explicit opt-in on Xahau |

## Installation

```sh
npm install @xrpl-wallet-kit/core @xrpl-wallet-kit/adapter-ledger xrpl@^4
```

For the Client tab below, install `@xrpl-wallet-kit/client` instead. Use a browser with WebHID or WebUSB, connect/unlock the device and install the chain's device app.

<div id="quick-start"></div>
<div id="connection-flow"></div>

## Connect

::: code-group

```ts [Client]
import { createWalletKit } from "@xrpl-wallet-kit/client";

const kit = createWalletKit({ network: "mainnet", wallets: ["ledger"] });
const { manager } = kit;
const { account } = await kit.connect("ledger");
```

```ts [Core]
import { WalletManager } from "@xrpl-wallet-kit/core";
import { createLedgerAdapter } from "@xrpl-wallet-kit/adapter-ledger";

const manager = new WalletManager({
  network: "mainnet",
  adapters: [createLedgerAdapter({ accountIndex: 0 })],
});
const { account } = await manager.connect("ledger");
```

:::

Start connection from a user action and select the device in the browser picker. With `autoOpenApp`, Kit requests the chain's app on the hardware and reads the address/public key once it is ready. It does not launch Ledger Live desktop or approve transactions for the user.

## Networks

XRPL uses the XRP device app. Xahau uses the XAH device app and is opt-in: configure `network: "xahau-mainnet"` or `"xahau-testnet"`, include `"ledger"` explicitly in `wallets`, and set a positive `preflight.maxFeeDrops` with the full client. Core/selective integrations must register the protocol and chain filter. See [Xahau Configuration](/docs/configuration/xahau).

Connection success does not establish support for every transaction type or field. Keep the device app up to date and do not enable blind signing to bypass unsupported fields.

## Capabilities

Operations below depend on the connected device app supporting the transaction being signed.

| Operation | Support |
|---|---|
| Connect | Yes |
| Disconnect | Yes; closes device/session resources |
| Session restore | No; fresh device connection required |
| `signTransaction()` | Yes |
| `signAndSubmit()` | Yes |
| `signMessage()` | Not exposed |
| `signIn()` | Not exposed by the direct Ledger adapter |
| `switchNetwork()` | Not exposed; reconnect for the selected network |
| Payment / NFT transactions | Generic `txJson`; device app/version dependent |
| QR / deep link | No |

## Options

These options apply to `createLedgerAdapter()`. Pass a configured adapter through the client's `adapters` option for custom device/account handling.

| Option | Type | Default | Description |
|---|---|---|---|
| `accountIndex` | `number` | `0` | Account in `44'/144'/<index>'/0/0` |
| `derivationPath` | `string` | `44'/144'/0'/0/0` | Full path; overrides `accountIndex` |
| `preferWebHID` | `boolean` | `true` | Prefer WebHID, fall back to WebUSB |
| `timeout` | `number` | `60000` | Device operation timeout in milliseconds |
| `autoOpenApp` | `boolean` | `true` | Request the selected chain's app on the device |
| `deviceApp` | `"XRP"` or `"XAH"` | Selected chain's app | Explicit device app override; must be compatible with the selected chain |
| `onDeviceState` | `(state: LedgerDeviceState) => void` | Not set | Observe device states such as `OPENING_APP` and `READY` |
| `connectLedger` | `() => Promise<LedgerSession>` | Built-in connection | Custom device/account connection flow |
| `supportedChains` | `WalletChainFilter` | XRPL integration | Restrict chains in a protocol-aware integration |
| `icon` | `string` | Embedded Ledger icon | Custom icon URL or data URI |

## Transactions

<!--@include: ../../.vitepress/snippets/adapter-transactions.md#introduction-->

### Payment

::: code-group
<!--@include: ../../.vitepress/snippets/adapter-transactions.md#payment-submit-->
<!--@include: ../../.vitepress/snippets/adapter-transactions.md#payment-sign-only-->
:::

The default path fills required transaction fields using the selected network, requests device approval and verifies the returned signature. XRPL single-sign requests include the canonical-signature flag for compatibility with the XRP app.

### NFT Transactions

<!--@include: ../../.vitepress/snippets/adapter-transactions.md#nft-->

Use a current device app that can display the requested NFT transaction. For sign-only NFT requests, pass the same `txJson` to `manager.signTransaction()`.

<div id="message-signing"></div>

## Authentication

The direct Ledger adapter does not expose arbitrary `signMessage()` or native `signIn()`. Joey Wallet's Ledger-backed sign-in challenge belongs to the [Joey Wallet adapter](/docs/adapters/joey-wallet), not this adapter. Do not submit a Payment as a substitute login proof.

<div id="session-restore-mobile-return-recovery"></div>

## Sessions and Disconnect

Passive restore returns no session. After reload, reconnect and select the device again. `manager.disconnect()` closes the active transport and clears local session state.

<div id="known-limitations"></div>

## Integration Notes

### Device App Selection

`autoOpenApp: false` keeps manual app selection. If switching apps resets USB or requires browser permission again, open the requested XRP/XAH app on the hardware and select the device again. A custom `connectLedger` implementation owns its device-opening behavior. Only one transport should use the device at a time.

### Multiple Accounts

```ts
import { LedgerAdapter } from "@xrpl-wallet-kit/adapter-ledger";

const ledger = new LedgerAdapter();
const accounts = await ledger.getAccounts(5);
console.log(accounts); // address, publicKey, path, index
```

Use `accountIndex` or `derivationPath` when creating the adapter for the selected account.

### Multisigning

Sign-only multisign requests require a fully prepared source `Account`, `Sequence`/ticket, `Fee`, `LastLedgerSequence` and network fields, with `SigningPubKey: ""` and no `Signers`/`TxnSignature`. The default multisign path preserves those exact fields without autofill. Custom sessions must implement `signMultisignTransaction`. Use [Core Multisign Coordination](/docs/configuration/multisign) for submission; the adapter does not expose multisign submission. Generic signing does not imply [Batch compatibility](/docs/configuration/batch#wallet-compatibility).

## Troubleshooting

| Symptom | Action |
|---|---|
| Device is not detected | Check USB connection, unlock the device and use a browser with WebHID/WebUSB |
| Requested app does not open | Open XRP for XRPL or XAH for Xahau on the device, then reconnect |
| Device is busy | Close other applications or transports using it |
| Transaction fields/type are unsupported | Update the device app and confirm support; do not bypass with blind signing |
| Device approval times out | Approve on the device or configure a suitable `timeout` |

## Related Guides

- [Adapters Overview](/docs/adapters/overview)
- [Xahau Configuration](/docs/configuration/xahau)
- [Multisigning](/docs/configuration/multisign)
- [Batch](/docs/configuration/batch)
