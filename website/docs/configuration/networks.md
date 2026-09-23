# Networks

XRPL Wallet Kit supports mainnet, testnet, devnet, and any custom XRPL network. The active network is shown as a badge in the modal and used by adapters when resolving explorer links.

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
    networkType: "MAINNET",        // used for network badge color
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

The modal displays a colored network badge when the connected network is not mainnet:

- **Mainnet** — no badge (clean UI)
- **Testnet** — yellow badge: `TESTNET`
- **Devnet** — orange badge: `DEVNET`
- **Custom** — shows the `id` value

## Switching Networks

Since `0.1.17`, the manager exposes a unified network-switching API. It only invokes adapters that explicitly advertise `switchNetwork: true` and rejects targets outside the adapter's `supportedNetworks` metadata.

```ts
const details = manager.getCapabilityDetails();

if (
  manager.can("switchNetwork") &&
  details?.supportedNetworks?.includes("testnet")
) {
  await manager.switchNetwork("testnet");
}
```

On success, the manager updates and persists the active session, then emits `networkChanged`. `createWalletKit()` also exposes the bound shortcut `kit.switchNetwork()`.

::: info
Network switching remains wallet-dependent. DropFi currently implements the unified API. Wallets without a verified switching method fail with `UNSUPPORTED_METHOD`; reconnect with the intended network instead of mutating session state manually.
:::
