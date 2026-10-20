# Xyra Adapter

[Xyra](https://www.xyra.now/) is a hosted wallet. The adapter opens a popup for
connection and transaction approval; no browser extension or WalletConnect
project ID is required. XRPL mainnet and testnet are supported.

## Installation

For Xahau mainnet/testnet support in v0.2.0+, see the
[Xahau guide](/docs/configuration/xahau). The examples below target XRPL.

```sh
npm install @xrpl-wallet-kit/core @xrpl-wallet-kit/adapter-xyra xrpl@^4
```

## Quick Start

```ts
import { WalletManager } from "@xrpl-wallet-kit/core";
import { createXyraAdapter } from "@xrpl-wallet-kit/adapter-xyra";

const manager = new WalletManager({
  network: "mainnet", // or "testnet"
  adapters: [createXyraAdapter()],
});

// Call from a connect button's click handler.
const { account } = await manager.connect("xyra");
console.log(account.address);
```

With the selective client:

```ts
import { createWalletClient } from "@xrpl-wallet-kit/client/selective";
import { createXyraAdapter } from "@xrpl-wallet-kit/adapter-xyra";

const manager = createWalletClient({
  network: "mainnet",
  adapters: [createXyraAdapter()],
});
```

Add the adapter explicitly when using core or the selective client.

Since v0.2.0, the full client also accepts `wallets: ["xyra"]`, and the browser
bundle exports `XRPLWalletKit.createXyraAdapter()`. Xyra remains opt-in for XRPL
and is included by default when configuring Xahau.

## Options

| Option | Type | Default | Description |
|---|---|---|---|
| `timeoutMs` | `number` | `60000` | Connection and signing timeout, in milliseconds |
| `maxFeeDrops` | `string` | `"1000000"` | Maximum accepted XRPL transaction fee, in drops (1 XRP by default) |

Use a fee ceiling suitable for your application. The adapter rejects a signed
transaction whose fee exceeds the configured ceiling.

## Capabilities

| Capability | Supported |
|---|:---:|
| connect / disconnect | Yes |
| signTransaction (sign-only) | Yes |
| signAndSubmit | Yes |
| signMessage | No |
| passive session restore | No |

The default adapter accepts standard XRPL mainnet/testnet, not devnet or custom
RPC definitions. Transactions use the generic `txJson` API; dedicated
`payments` and `nftOffers` capability flags are not advertised. Do not infer
Batch support from generic transaction signing.

## Transactions

Use `manager` and the connected `account` from Quick Start. Run each request
from its own button click and replace the recipient address before signing.

::: code-group

```ts [Sign Only]
const result = await manager.signTransaction({
  txJson: {
    TransactionType: "Payment",
    Account: account.address,
    Destination: "<recipient_address>",
    Amount: "1000000", // 1 XRP in drops
  },
});
console.log(result.txBlob); // Verified signed transaction; not submitted
```

```ts [Sign and Submit]
const result = await manager.signAndSubmit({
  txJson: {
    TransactionType: "Payment",
    Account: account.address,
    Destination: "<recipient_address>",
    Amount: "1000000", // 1 XRP in drops
  },
  submit: true,
});
console.log(result.hash, result.status);
```

:::

Include `DestinationTag` if the recipient requires one. Submission on mainnet
spends real funds and network fees. A preliminary `submitted` result is not
ledger confirmation; wait for `tx_confirmed` or check the hash on the ledger.
If submission times out, check the hash before retrying.

## Browser Requirements

- Use HTTPS or localhost and allow popups. Connect and sign from user actions.
- Preserve the requesting origin with `Referrer-Policy: strict-origin-when-cross-origin`
  or `origin`; avoid `no-referrer`, `noopener` and `noreferrer` for the wallet popup.
- If setting COOP, use `Cross-Origin-Opener-Policy: same-origin-allow-popups`.
- Allow `data:` in CSP `img-src` for the embedded wallet icon.
- Reconnect after a page reload; disconnect clears local state, not wallet credentials.

Transaction JSON is sent in the popup URL; do not include secrets in transaction
metadata. See [Xyra's developer documentation](https://www.xyra.now/developers)
for the wallet protocol.
