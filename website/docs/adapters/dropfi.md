# DropFi Adapter

[DropFi](https://dropfi.app) connects through its browser extension or the injected provider inside the DropFi mobile app's browser. Both use the same adapter.

| Integration | Value |
|---|---|
| Package | `@xrpl-wallet-kit/adapter-dropfi` |
| Adapter ID | `dropfi` |
| Wallet type | Browser extension / mobile in-app browser |
| Client registration | Included in default XRPL wallet lists |

## Installation

```sh
npm install @xrpl-wallet-kit/core @xrpl-wallet-kit/adapter-dropfi xrpl@^4
```

For the Client tab below, install `@xrpl-wallet-kit/client` instead. Mobile users must open the dApp inside DropFi's built-in browser.

<div id="quick-start"></div>
<div id="connection-flow"></div>
<div id="supported-platforms"></div>

## Connect

::: code-group

```ts [Client]
import { createWalletKit } from "@xrpl-wallet-kit/client";

const kit = createWalletKit({ network: "mainnet", wallets: ["dropfi"] });
const { manager } = kit;
const { account } = await kit.connect("dropfi");
```

```ts [Core]
import { WalletManager } from "@xrpl-wallet-kit/core";
import { createDropFiAdapter } from "@xrpl-wallet-kit/adapter-dropfi";

const manager = new WalletManager({
  network: "mainnet",
  adapters: [createDropFiAdapter()],
});
const { account } = await manager.connect("dropfi");
```

:::

Start connect from a user action. The adapter initializes the provider and opens DropFi's approval UI: an extension popup on desktop or an approval sheet in the mobile app.

## Networks

Supports the standard XRPL `mainnet`, `testnet` and `devnet` networks, including `manager.switchNetwork()` when connected. Xahau is not supported by this adapter.

## Capabilities

The extension and mobile in-app provider use the same manager operations.

| Operation | Support |
|---|---|
| Connect | Yes |
| Disconnect | Yes; provider disconnect when available, otherwise local cleanup |
| Session restore | Yes, with a matching passive account |
| `signTransaction()` | Not exposed |
| `signAndSubmit()` | Yes |
| `signMessage()` | Yes; `signature` proof |
| `signIn()` | Not exposed |
| `switchNetwork()` | Yes, for supported XRPL networks |
| Payment / NFT transactions | Yes, through `txJson` |
| QR / deep link | Not exposed; mobile uses the in-app browser |

## Options

These options apply to `createDropFiAdapter()`. Pass a configured adapter through the client's `adapters` option when needed.

| Option | Type | Default | Description |
|---|---|---|---|
| `provider` | `DropFiProvider` | Detected provider | Supply a specific DropFi provider |
| `icon` | `string` | Embedded DropFi icon | Custom icon URL or data URI |

## Transactions

<!--@include: ../../.vitepress/snippets/adapter-transactions.md#introduction-->

### Payment

<!--@include: ../../.vitepress/snippets/adapter-transactions.md#payment-submit-->

DropFi uses `sendTransaction()`. This adapter does not expose sign-only; do not call `manager.signTransaction()` for this wallet.

### NFT Transactions

<!--@include: ../../.vitepress/snippets/adapter-transactions.md#nft-->

<div id="message-signing"></div>

## Authentication

```ts
const proof = await manager.signMessage({ message: "Verify wallet ownership" });
console.log(proof.signatureKind); // "signature"
console.log(proof.signature, proof.publicKey);
```

DropFi returns a compact signature and public key. Missing proof fields are rejected; do not fall through to another signing prompt after approval. Use server-side challenge verification as described in [Message Authentication](/docs/auth/introduction). Native `signIn()` is not exposed.

<div id="session-restore"></div>

## Sessions and Disconnect

`manager.autoReconnect()` initializes passive provider state and restores only a matching current address, without a fresh approval prompt. This applies to the extension and mobile in-app browser.

`manager.disconnect()` clears Kit state and calls the provider's disconnect method when available.

<div id="known-limitations"></div>

## Integration Notes

### Provider Detection

Provider lookup uses `options.provider`, then `window.__xwk_dropfi`, `window.dropfi` and the official `window.xrpl` injection point. The fallback must pass the DropFi feature guard so `xrpl.js` or another wallet is not mistaken for DropFi. Preserve the provider through an alias or pass it explicitly if another script overwrites `window.xrpl`.

### Network Switching

```ts
if (manager.can("switchNetwork", "dropfi")) {
  await manager.switchNetwork("testnet");
}
```

The manager checks network support and updates the active session after switching. Mobile users browsing in external Safari/Chrome will not have the DropFi injected provider.

## Troubleshooting

| Symptom | Action |
|---|---|
| Mobile wallet is not detected | Open the dApp inside DropFi's in-app browser |
| Another wallet takes over `window.xrpl` | Pass the DropFi provider explicitly or preserve its alias |
| Restore fails after reload | Check that the provider has hydrated and still reports the same address |
| Sign-only is unavailable | Use sign-and-submit; sign-only is not exposed by this adapter |

<div id="references"></div>

## Related Guides

- [Adapters Overview](/docs/adapters/overview)
- [Message Authentication](/docs/auth/introduction)
- [DropFi Extension](https://www.dropfi.app/docs/dropfi-extension)
- [DropFi Mobile App](https://www.dropfi.app/docs/dropfi-mobile-app)
- [DropFi Provider API](https://www.dropfi.app/docs/xrpl-injection-api)
