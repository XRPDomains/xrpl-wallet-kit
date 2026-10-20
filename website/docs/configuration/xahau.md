# Xahau

Use the same wallet connection and transaction API for Xahau mainnet and testnet.
The all-in-one client registers the network presets, wallet configuration and
Xahau signing runtime; no separate protocol import is needed.

::: info Available from v0.2.0
Use matching Wallet Kit package versions **0.2.0 or later** for Xahau integration
and automatic CDN runtime loading. Earlier releases do not include these features.
:::

## Networks

| Network option | NetworkID | Native asset | Explorer |
|---|---:|---|---|
| `xahau-mainnet` | 21337 | XAH | [Mainnet explorer](https://xahau.xrpl.org/) |
| `xahau-testnet` | 21338 | XAH | [Testnet explorer](https://xahau-testnet.xrpl.org/) |

XAH uses six decimal places: `"1000000"` drops is 1 XAH. Mainnet has no modal
network badge, like XRPL mainnet. Testnet retains the `Xahau Testnet` badge.

## Quick Start

Install the all-in-one client:

```sh
npm install @xrpl-wallet-kit/client
```

```ts
import { createWalletKit } from "@xrpl-wallet-kit/client";

const kit = createWalletKit({
  network: "xahau-mainnet", // or "xahau-testnet"
  xamanClientId: "YOUR_XAMAN_CLIENT_ID",
  preflight: { maxFeeDrops: "50000" },
  connectButton: "#connect-wallet",
});
```

Mount an element with `id="connect-wallet"` for the wallet picker, or call
`await kit.connect("xaman")` from your own button handler. Xaman requires a
client ID; GemWallet and Xyra do not. The modal filters wallets by the configured
network. Creating the kit does not automatically connect or sign.

The fee cap above is an application-selected ceiling, not an expected fee or a
recommended default. Non-XRPL signing requires a positive fee ceiling. Global
and request-level ceilings combine using the lowest limit; disabling application
preflight does not bypass the protocol fee cap.

## Wallets

| Adapter | Client setup on Xahau | Notes |
|---|---|---|
| [Xaman](/docs/adapters/xaman) | Enabled with `xamanClientId` | Approve the selected Xahau network in the wallet |
| [GemWallet](/docs/adapters/gemwallet) | Enabled | Select the matching chain and network in the extension |
| [Xyra](/docs/adapters/xyra) | Enabled | Hosted popup; connect and sign from user actions |
| [Ledger](/docs/adapters/ledger) | Explicit opt-in | Uses the XAH app on the device; support varies by app/version/transaction |

To include Ledger explicitly while keeping the other three wallets:

```ts
const kit = createWalletKit({
  network: "xahau-testnet",
  wallets: ["xaman", "gemwallet", "xyra", "ledger"],
  xamanClientId: "YOUR_XAMAN_CLIENT_ID",
  preflight: { maxFeeDrops: "50000" },
});
```

Ledger connection can request the XAH app directly on the hardware, not Ledger
Live. Do not enable blind signing to bypass unsupported transaction fields.
Use a browser with WebHID or WebUSB for Ledger. For Xyra, allow popups and start
connection and signing from user actions.

## Payment

After connecting, use one of these requests from a transaction button handler.
Replace `<recipient_address>` with the recipient's classic address. Include
`DestinationTag` when required by the recipient.

::: code-group

```ts [Sign Only]
const result = await kit.signTransaction({
  txJson: {
    TransactionType: "Payment",
    Destination: "<recipient_address>",
    Amount: "1000000", // 1 XAH
  },
});
console.log(result.txBlob); // Not broadcast
```

```ts [Sign and Submit]
const result = await kit.signAndSubmit({
  txJson: {
    TransactionType: "Payment",
    Destination: "<recipient_address>",
    Amount: "1000000", // 1 XAH
  },
});
console.log(result.hash, result.status);
```

:::

The runtime prepares Account, NetworkID, Sequence, Fee and expiry, then verifies
the signed blob before any requested RPC submission. A `submitted` result is not
final ledger confirmation. Wait for `tx_confirmed` or look up the transaction
hash. Never automatically retry an uncertain submission.

## Transaction Scope

The runtime supports master-key single-sign for:

- `Payment`, `TrustSet`, `OfferCreate`, `OfferCancel`, `AccountSet`.
- `Invoke`, including `HookParameters` on supported transaction types.
- `URITokenMint`, `URITokenCreateSellOffer`, `URITokenCancelSellOffer`,
  `URITokenBuy`, `URITokenBurn`.

Each wallet must support the transaction type and fields it is asked to approve.
The kit rejects unsupported types and fields rather than dropping them.

### Invoke and Hooks

Use `Invoke` to call an existing Hook. The destination and parameter schema must
match that Hook's contract. Replace the destination and parameters below with
the values required by your application. Parameter names and values use
uppercase, even-length hexadecimal strings.

::: code-group

```ts [Sign Only]
const signed = await kit.signTransaction({
  txJson: {
    TransactionType: "Invoke",
    Destination: "<hook_account_address>",
    HookParameters: [{
      HookParameter: {
        HookParameterName: "617070", // Hex-encoded parameter name
        HookParameterValue: "70696E67", // Hex-encoded value
      },
    }],
  },
});
console.log(signed.txBlob); // Not broadcast; the Hook has not executed
```

```ts [Sign and Submit]
const result = await kit.signAndSubmit({
  txJson: {
    TransactionType: "Invoke",
    Destination: "<hook_account_address>",
    HookParameters: [{
      HookParameter: {
        HookParameterName: "617070", // "app"
        HookParameterValue: "70696E67", // "ping"
      },
    }],
  },
});
console.log(result.hash, result.status);
```

:::

An Invoke does not require a Payment amount. Hook logic determines whether it
updates state, emits transactions or rejects the request; submitting an Invoke
is not a read-only operation. Inspect the validated transaction metadata for
`HookExecutions` and the Hook's return code and return string.

### Payment with Hook Parameters

Attach `HookParameters` to a Payment when a receiving Hook expects payment and
application data together. The account's Hook configuration determines whether
the Payment triggers execution.

```ts
const result = await kit.signAndSubmit({
  txJson: {
    TransactionType: "Payment",
    Destination: "<hook_account_address>",
    Amount: "1000000", // 1 XAH
    HookParameters: [{
      HookParameter: {
        HookParameterName: "617070",
        HookParameterValue: "70696E67",
      },
    }],
  },
});
console.log(result.hash);
```

Installing or changing Hooks through `SetHook` is not supported in this release.

### NFTs / URITokens

Xahau NFT integration here uses URITokens, not XRPL's `NFToken*` offer forms.
For example, buy an existing sell offer using the token's **URITokenID**, not
the transaction hash that created the offer:

```ts
const result = await kit.signAndSubmit({
  txJson: {
    TransactionType: "URITokenBuy",
    URITokenID: "<64_character_hex_token_id>",
    Amount: "1000000", // Offered purchase amount in drops
  },
});
```

Check the token's current offer amount and any designated buyer before signing.
Use `Amount: "0"` only for a matching free offer.

The other URIToken operations use the same signing API:

::: code-group

```ts [Mint]
await kit.signAndSubmit({
  txJson: {
    TransactionType: "URITokenMint",
    URI: "697066733A2F2F6578616D706C65", // "ipfs://example"; replace with your URI
  },
});
```

```ts [Create Sell Offer]
await kit.signAndSubmit({
  txJson: {
    TransactionType: "URITokenCreateSellOffer",
    URITokenID: "<64_character_hex_token_id>",
    Amount: "1000000", // Sell for 1 XAH
  },
});
```

```ts [Cancel Sell Offer]
await kit.signAndSubmit({
  txJson: {
    TransactionType: "URITokenCancelSellOffer",
    URITokenID: "<64_character_hex_token_id>",
  },
});
```

```ts [Burn]
await kit.signAndSubmit({
  txJson: {
    TransactionType: "URITokenBurn",
    URITokenID: "<64_character_hex_token_id>",
  },
});
```

:::

Use uppercase hexadecimal for the URI and token IDs. Burning permanently
destroys the token. To sign without broadcasting, replace `signAndSubmit`
with `signTransaction`.

## Read Hook State

Reading existing Hook state does not require a wallet connection or signature.
Call `account_namespace` on the selected network's HTTP RPC endpoint:

```ts
const response = await fetch("https://xahau.network", { // Mainnet
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    method: "account_namespace",
    params: [{
      account: "<hook_account_address>",
      namespace_id: "<64_character_hex_namespace_id>",
      ledger_index: "validated",
      limit: 10,
    }],
  }),
});
if (!response.ok) throw new Error(`RPC HTTP ${response.status}`);
const { result } = await response.json();
if (result.error) throw new Error(result.error_message ?? result.error);
console.log(result.namespace_entries, result.marker);
```

Pass a returned `marker` in the next request to continue pagination. Interpret
`HookStateKey` and `HookStateData` using the Hook's schema. This reads stored data;
it does not execute the Hook or incur transaction fees. Use an endpoint that
allows your website's origin, or route reads through your backend.

## Connection and Message Signing

Reconnect explicitly after a reload; passive Xahau session restore is not
supported. For a wallet without network switching, disconnect and connect again
with a kit configured for the intended network. Do not relabel an active session.

Raw message signing is exposed by Xaman and GemWallet, not Xyra or Ledger.
Raw signing is not chain-bound authentication. The XRPL auth verifier does not
establish a Xahau login proof; do not use it to authenticate a Xahau session.
Batch, multisign, delegated-key signing and XLS-20 parity are not supported here.

## Browser / CDN

The browser bundle uses the same configuration through
`XRPLWalletKit.createWalletKit()`. On first Xahau transaction preparation or
lookup it automatically imports `xrpl-wallet-kit-xahau.runtime.js` from the
original IIFE script directory. It does not load the runtime just to connect,
and XRPL-only pages do not download it.

- The runtime is already minified, despite having no `.min.js` suffix.
- Self-host the runtime beside `xrpl-wallet-kit.iife.min.js`, or use a
  version-pinned CDN URL. Both files must be the same release.
- Load the IIFE through an external script tag. Allow its hosting origin in
  CSP `script-src`; cross-origin module hosting must allow CORS. No `unsafe-eval`
  is required by the Xahau loader.
- Missing or mismatched runtime assets stop the request before wallet signing.

See the [HTML/CDN guide](/docs/frameworks/legacy-cdn) for the base integration.
ESM clients load their own Xahau chunk without a separate script tag.

## Core / Selective Integration

`@xrpl-wallet-kit/core` and `client/selective` do not automatically register
Xahau. With matching package versions, configure the runtime explicitly:

```ts
import { WalletManager } from "@xrpl-wallet-kit/core";
import { createXahauProtocol, XAHAU_NETWORKS } from "@xrpl-wallet-kit/xahau";
import { createGemWalletAdapter } from "@xrpl-wallet-kit/adapter-gemwallet";

const manager = new WalletManager({
  network: "xahau-testnet",
  networks: [...XAHAU_NETWORKS],
  protocols: [createXahauProtocol()],
  adapters: [createGemWalletAdapter({
    supportedChains: { families: ["xrpl", "xahau"] },
  })],
  preflight: { maxFeeDrops: "50000" },
});
```

Browser RPC endpoints must permit the dApp's origin. If a proxy is required,
the all-in-one client accepts `xahau: { request }`, returning the unwrapped RPC
result from a trusted transport. Allow only configured endpoints; never forward
arbitrary wallet-provided URLs. See [Networks](/docs/configuration/networks)
for the general network configuration API.
