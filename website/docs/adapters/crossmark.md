# Crossmark Adapter

[Crossmark](https://crossmark.io) connects through its browser extension SDK for account approval, message signing and transaction submission.

| Integration | Value |
|---|---|
| Package | `@xrpl-wallet-kit/adapter-crossmark` |
| Adapter ID | `crossmark` |
| Wallet type | Browser extension |
| Client registration | Included in default XRPL wallet lists |

## Installation

```sh
npm install @xrpl-wallet-kit/core @xrpl-wallet-kit/adapter-crossmark xrpl@^4
```

For the Client tab below, install `@xrpl-wallet-kit/client` instead. Enable the Crossmark extension for the dApp.

<div id="quick-start"></div>
<div id="connection-flow"></div>

## Connect

::: code-group

```ts [Client]
import { createWalletKit } from "@xrpl-wallet-kit/client";

const kit = createWalletKit({ network: "mainnet", wallets: ["crossmark"] });
const { manager } = kit;
const { account } = await kit.connect("crossmark");
```

```ts [Core]
import { WalletManager } from "@xrpl-wallet-kit/core";
import { createCrossmarkAdapter } from "@xrpl-wallet-kit/adapter-crossmark";

const manager = new WalletManager({
  network: "mainnet",
  adapters: [createCrossmarkAdapter()],
});
const { account } = await manager.connect("crossmark");
```

:::

Call connect from a user action. Crossmark prompts for approval using a fresh random connection challenge; this is not your application's login challenge.

## Networks

This adapter targets XRPL. Select the network expected by the dApp in Crossmark. Xahau is not supported by this adapter.

## Capabilities

This table describes manager-level operations, not every method the wallet may expose outside Kit.

| Operation | Support |
|---|---|
| Connect | Yes |
| Disconnect | Local Kit cleanup; no provider-level disconnect |
| Session restore | Yes, with a matching passive account |
| `signTransaction()` | Not exposed |
| `signAndSubmit()` | Yes |
| `signMessage()` | Yes; `signature` proof |
| `signIn()` | Not exposed |
| `switchNetwork()` | Not exposed |
| Payment / NFT transactions | Yes, through `txJson` |
| QR / deep link | No |

## Options

These options apply to `createCrossmarkAdapter()`. Pass a configured adapter through the client's `adapters` option when needed.

| Option | Type | Default | Description |
|---|---|---|---|
| `provider` | `CrossmarkProvider` | Bundled SDK | Supply a compatible Crossmark SDK/provider |

## Transactions

<!--@include: ../../.vitepress/snippets/adapter-transactions.md#introduction-->

### Payment

<!--@include: ../../.vitepress/snippets/adapter-transactions.md#payment-submit-->

Crossmark uses `signAndSubmitAndWait()`. This adapter does not expose a sign-only operation; do not use `manager.signTransaction()` for this wallet.

### NFT Transactions

<!--@include: ../../.vitepress/snippets/adapter-transactions.md#nft-->

<div id="message-signing"></div>

## Authentication

```ts
const proof = await manager.signMessage({ message: "Verify wallet ownership" });
console.log(proof.signatureKind); // "signature"
console.log(proof.signature, proof.publicKey);
```

The adapter sends the UTF-8 message as hex to Crossmark and returns the compact proof. Verify it on your backend; see [Message Authentication](/docs/auth/introduction). Crossmark's provider method named `signInAndWait` does not mean Kit exposes native `manager.signIn()`.

<div id="session-restore-mobile-return-recovery"></div>

## Sessions and Disconnect

`manager.autoReconnect()` restores only when the passive SDK address matches the stored address. It does not open a signing popup.

`manager.disconnect()` clears the Kit session; extension site permissions remain managed by Crossmark.

<div id="known-limitations"></div>

## Integration Notes

- Connection and message signing both require Crossmark approval; keep connection and backend authentication as separate application steps.
- Signature response shapes vary by SDK version; consume Kit's normalized proof fields rather than raw provider paths.
- Generic transaction signing does not imply Batch support.

## Troubleshooting

| Symptom | Action |
|---|---|
| Extension is not detected | Enable Crossmark for the current domain and allow extension injection |
| `signInAndWait` is unavailable | Update the extension/SDK or inspect your injected `provider` |
| No message proof after approval | Check SDK compatibility; redact sensitive data before reporting a provider response |
| Sign-only fails | Use sign-and-submit; sign-only is not exposed by this adapter |

## Related Guides

- [Adapters Overview](/docs/adapters/overview)
- [Message Authentication](/docs/auth/introduction)
- [NFT Marketplace](/docs/use-cases/nft-marketplace)
