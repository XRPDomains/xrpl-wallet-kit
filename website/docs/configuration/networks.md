# Networks

XRPL Wallet Kit supports mainnet, testnet, devnet, and custom XRPL networks,
subject to adapter network restrictions. Network presets determine explorer
links, native-asset labels and the modal footer. For Xahau mainnet/testnet integration,
see [Xahau](/docs/configuration/xahau).

## Built-in Networks

```ts
import {
  XRPL_MAINNET,
  XRPL_TESTNET,
  XRPL_DEVNET,
} from "@xrpl-wallet-kit/core";

const manager = new WalletManager({
  adapters: [...],
  network: "mainnet",
});
```

| Constant | Network | WebSocket URL | Browser HTTP RPC |
|---|---|---|---|
| `XRPL_MAINNET` | Mainnet | `wss://xrplcluster.com` | `https://xrpl.ws` |
| `XRPL_TESTNET` | Testnet | `wss://s.altnet.rippletest.net:51233` | `https://s.altnet.rippletest.net:51234` |
| `XRPL_DEVNET` | Devnet | `wss://s.devnet.rippletest.net:51233` | `https://s.devnet.rippletest.net:51234` |

## Custom Network

```ts
const manager = new WalletManager({
  adapters: [...],
  network: "my-network",
  networks: [{
    id: "my-network",
    name: "My XRPL Network",
    family: "xrpl",
    networkType: "MAINNET",        // network classification and footer context
    rpcUrl: "wss://my-xrpl-node.example.com",
    httpRpcUrl: "https://my-xrpl-node.example.com",
    nativeAsset: "XRP",
    nativeAssetDecimals: 6,
    explorerTxUrl: "https://explorer.example.com/tx/{hash}",
    explorerAccountUrl: "https://explorer.example.com/account/{address}",
    walletConnectChainId: "xrpl:0",          // optional, for WalletConnect
  }],
});
```

`httpRpcUrl` is used by browser-side account status and balance lookup. If you enable `showBalance`, use an HTTP JSON-RPC endpoint that sends CORS headers for your dApp origin.

## Network Badge

The modal footer identifies the selected chain and network, for example
`XRPL Wallet Kit · XRPL Mainnet` or `XRPL Wallet Kit · Xahau Mainnet`, without
adding a separate badge above the wallet list. Testnet, Devnet and custom
networks are also identified in the footer; there is no duplicate network badge.

For Xahau with the all-in-one client, use `network: "xahau-mainnet"` or
`"xahau-testnet"`. The client registers presets and the lazy protocol automatically.
Core and selective integrations must register the protocol explicitly; changing
`nativeAsset` to `"XAH"` on an XRPL preset does not enable Xahau signing. See
[Xahau Configuration](/docs/configuration/xahau).

## Switching Networks

The manager only invokes adapters that explicitly advertise `switchNetwork: true`
and rejects targets outside their `supportedChains` and `supportedNetworks` metadata.

```ts
const details = manager.getCapabilityDetails();

if (
  manager.can("switchNetwork") &&
  (!details?.supportedNetworks || details.supportedNetworks.includes("testnet"))
) {
  await manager.switchNetwork("testnet");
}
```

On success, the manager updates and persists the active session, then emits `networkChanged`. `createWalletKit()` also exposes the bound shortcut `kit.switchNetwork()`.

::: info
Network switching remains wallet-dependent. DropFi currently implements the unified API. Wallets without a verified switching method fail with `UNSUPPORTED_METHOD`; reconnect with the intended network instead of mutating session state manually.
:::
