# API Documentation

## `WalletManager`

```ts
const manager = new WalletManager({
  appName: "My XRPL dApp",
  network: "mainnet",
  autoReconnect: true,
  storage,
  adapters
});
```

Main methods:

- `register(adapter)`: add a wallet adapter.
- `getWallets()`: return wallet metadata for UI rendering.
- `connect(adapterId)`: connect and persist a session.
- `disconnect()`: disconnect active wallet and clear storage.
- `autoReconnect()`: restore previous session when supported.
- `signMessage({ message })`: sign an application-defined message when the connected wallet supports message signing.
- `signAndSubmit({ txJson, methodHint })`: sign and submit XRPL transaction.
- `on(event, handler)`: subscribe to wallet events.

## `WalletAdapter`

```ts
interface WalletAdapter {
  metadata: WalletMetadata;
  capabilities: WalletCapabilities;
  isAvailable?: () => boolean | Promise<boolean>;
  connect(options: ConnectOptions): Promise<ConnectResult>;
  disconnect?: () => Promise<void>;
  restoreSession?: (session: WalletSession) => Promise<ConnectResult | null>;
  signMessage?: (request: SignMessageRequest) => Promise<SignMessageResult>;
  signAndSubmit?: (request: SignAndSubmitRequest) => Promise<TxResult>;
}
```

Adapters should never call app DOM, show modals, or own business logic. They only talk to wallet providers and return normalized results.

## Network Registry

Built-in networks:

- `mainnet`: `wss://xrplcluster.com`, WalletConnect `xrpl:0`
- `testnet`: `wss://s.altnet.rippletest.net:51233`, WalletConnect `xrpl:1`
- `devnet`: `wss://s.devnet.rippletest.net:51233`, WalletConnect `xrpl:2`

Custom network:

```ts
new WalletManager({
  appName: "Custom",
  network: "sidechain",
  networks: [{
    id: "sidechain",
    name: "XRPL Sidechain",
    networkType: "CUSTOM",
    rpcUrl: "wss://...",
    walletConnectChainId: "xrpl:..."
  }]
});
```

## Result Normalization

`normalizeTxResult(raw)` supports common shapes returned by GemWallet, Crossmark, Xaman, WalletConnect, DropFi, XRPL Snap, and Ledger adapters. It returns:

```ts
type TxResult = {
  hash?: string;
  status?: string;
  signed?: boolean;
  rejected?: boolean;
  raw?: unknown;
};
```
