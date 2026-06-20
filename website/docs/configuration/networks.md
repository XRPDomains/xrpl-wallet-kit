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
  network: XRPL_MAINNET,
});
```

| Constant | Network | WebSocket URL |
|---|---|---|
| `XRPL_MAINNET` | Mainnet | `wss://xrplcluster.com` |
| `XRPL_TESTNET` | Testnet | `wss://s.altnet.rippletest.net:51233` |
| `XRPL_DEVNET` | Devnet | `wss://s.devnet.rippletest.net:51233` |

## Custom Network

```ts
const manager = new WalletManager({
  adapters: [...],
  network: {
    id: "my-network",
    networkType: "MAINNET",        // used for network badge color
    url: "wss://my-xrpl-node.example.com",
    nativeAsset: "XRP",
    nativeAssetDecimals: 6,
    explorerUrl: "https://livenet.xrpl.org", // optional
    walletConnectChainId: "xrpl:0",          // optional, for WalletConnect
  },
});
```

## Network Badge

The modal displays a colored network badge when the connected network is not mainnet:

- **Mainnet** — no badge (clean UI)
- **Testnet** — yellow badge: `TESTNET`
- **Devnet** — orange badge: `DEVNET`
- **Custom** — shows the `id` value

## Switching Networks

Networks are set at manager construction time. To support network switching, destroy and recreate the manager with the new network config, or implement a custom network switcher in your app layer.

::: info
Network switching mid-session is wallet-dependent. Some wallets (e.g., Xaman) manage their own active network. Others (e.g., GemWallet) follow the user's extension setting.
:::
