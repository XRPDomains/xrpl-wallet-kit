# Privy Adapter

Privy adds native embedded XRPL wallets and email or social sign-in to a dApp.

| Integration | Value |
|---|---|
| Package | `@xrpl-wallet-kit/adapter-privy` |
| Adapter ID | `privy` |
| Wallet type | Embedded |
| Client registration | Opt-in through `adapters` |

## Installation

```sh
npm install @xrpl-wallet-kit/core @xrpl-wallet-kit/adapter-privy xrpl@^4
```

Install `@xrpl-wallet-kit/client` for the Client example.

## Connect

Allow the app's origin and callback URL in Privy Dashboard. Serve the same app on the callback route and restore the same selected network when returning from OAuth. Initialize on the client.

::: code-group

```ts [Client]
import { createWalletKit } from "@xrpl-wallet-kit/client";
import { createPrivyAdapter } from "@xrpl-wallet-kit/adapter-privy";

const kit = createWalletKit({
  network: "testnet",
  autoReconnect: true,
  adapters: [createPrivyAdapter({
    appId: import.meta.env.VITE_PRIVY_APP_ID,
    clientId: import.meta.env.VITE_PRIVY_CLIENT_ID || undefined,
    redirectUri: new URL("/wallet/privy", location.origin).href
  })]
});
const { manager } = kit;
kit.button.mount("#connect-wallet");
```

```ts [Core]
import { WalletManager } from "@xrpl-wallet-kit/core";
import { createPrivyAdapter } from "@xrpl-wallet-kit/adapter-privy";

const adapter = createPrivyAdapter({
  appId: import.meta.env.VITE_PRIVY_APP_ID,
  redirectUri: new URL("/wallet/privy", location.origin).href
});
const manager = new WalletManager({ network: "testnet", adapters: [adapter] });
// Mount WalletModal, or register your own adapter.onInteraction() handler.
```

:::

Use the Kit button or modal to initiate login. Passing `adapters` to the Client replaces its built-in adapter list.

## Networks

Supports the standard XRPL Mainnet and Testnet presets. Reconnect on the target network when switching. Devnet and Xahau are outside the adapter's scope.

## Capabilities

| Operation | Support |
|---|---|
| Connect | Email OTP or dashboard-enabled Google/X OAuth |
| Disconnect | Logs out of Privy |
| Session restore | Matches the saved Privy wallet, user and XRPL address |
| `signTransaction()` | Yes, after user approval |
| `signAndSubmit()` | Yes, after user approval |
| `signMessage()` | Unavailable |
| `signIn()` | Unavailable |
| `switchNetwork()` | Reconnect on the target network |
| Payment / NFT transactions | Standard single-sign XRPL transaction JSON, subject to ledger requirements |
| QR / deep link | Unavailable |

## Options

| Option | Type | Default | Description |
|---|---|---|---|
| `appId` | `string` | Required | Public Privy application ID |
| `clientId` | `string` | App default | Public Privy client ID |
| `redirectUri` | `string` | Required | Absolute same-origin OAuth callback URL |
| `onDisconnected` | `() => void` | Optional | Observe a provider-initiated logout |

## Transactions

Use `txJson` and show the Kit modal during transaction review. The configured request fee ceiling applies to the prepared transaction. Check the result status and verify the ledger before treating a payment as successful or retrying an uncertain submission.

### Payment

::: code-group
<!--@include: ../../.vitepress/snippets/adapter-transactions.md#payment-submit-->
<!--@include: ../../.vitepress/snippets/adapter-transactions.md#payment-sign-only-->
:::

### NFT Transactions

<!--@include: ../../.vitepress/snippets/adapter-transactions.md#nft-->

## Authentication

Enable Email, Google or X in Privy Dashboard. If Email is the only supported enabled method, the Kit opens its email form directly. Google and X use OAuth redirects. Apps that require CAPTCHA need a different integration until the Kit supports that prompt.

## Sessions and Disconnect

Refresh restores the same eligible wallet on the configured network. Call `manager.disconnect()` to clear the Kit session and log out of Privy.

## Integration Notes

In React, provide a manager with Privy already registered to `WalletKitProvider` and render the Kit button. Headless clients must subscribe to `adapter.onInteraction()`, render the full reviewed transaction and explicitly collect the user's approval. The frontend uses public configuration only.

## Troubleshooting

If a method is missing, check that it is enabled in Privy Dashboard and reopen the picker. Verify the exact hostname, origin and callback URL if OAuth does not return. If Payment fails because the account does not exist on-ledger, fund it on the selected network first.

## Related Guides

- [React](/docs/frameworks/react)
- [Adapter package README](https://github.com/XRPDomains/xrpl-wallet-kit/tree/main/packages/adapters/privy)
