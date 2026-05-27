# @xrpl-wallet-kit/adapter-otsu

Otsu Wallet adapter for [XRPL Wallet Kit](https://github.com/XRPDomains/xrpl-wallet-kit).

Otsu is an MV3 browser extension wallet for the XRP Ledger. It supports mainnet, testnet, and devnet, and provides granular dApp permission scopes plus transaction simulation with risk scanning before user approval.

- **Extension inject:** `window.xrpl` with `isOtsu = true`
- **Networks:** mainnet · testnet · devnet
- **Capabilities:** connect · disconnect · signMessage · signTransaction · signAndSubmit

## Installation

```bash
npm install @xrpl-wallet-kit/adapter-otsu
```

## Usage

### With `createWalletKit` (recommended)

```ts
import { createWalletKit } from "@xrpl-wallet-kit/client";
import { createOtsuAdapter } from "@xrpl-wallet-kit/adapter-otsu";

const kit = createWalletKit({
  adapters: [createOtsuAdapter()],
  modal: true,
  connectButton: "#connect-btn",
});
```

### With `WalletManager` directly

```ts
import { WalletManager } from "@xrpl-wallet-kit/core";
import { createOtsuAdapter } from "@xrpl-wallet-kit/adapter-otsu";

const manager = new WalletManager({
  adapters: [createOtsuAdapter()],
});

const result = await manager.connect("otsu");
console.log("Connected:", result.account.address);
```

### Auto-reconnect

```ts
const kit = createWalletKit({
  adapters: [createOtsuAdapter()],
  autoReconnect: true,
  storage: "localStorage",
});
```

`restoreSession` checks `provider.isConnected()` before attempting to restore; a disconnected or locked extension will cleanly return `null`.

## Provider injection

The adapter reads `window.xrpl.isOtsu`. No npm SDK dependency is required.

```ts
// Type declaration included in the package:
declare global {
  interface Window {
    xrpl?: OtsuProvider;
  }
}
```

## Testing

Pass a mock provider via `options.provider`:

```ts
import { OtsuAdapter, OtsuProvider } from "@xrpl-wallet-kit/adapter-otsu";
import { assertWalletAdapter } from "@xrpl-wallet-kit/core";

const mock: OtsuProvider = {
  isOtsu: true,
  isConnected: () => false,
  connect: async () => ({ address: "rTest..." }),
  disconnect: async () => {},
  getAddress: async () => ({ address: "rTest..." }),
  getNetwork: async () => ({ network: "testnet" }),
  signTransaction: async (tx) => ({ tx_blob: "BLOB", hash: "HASH" }),
  signAndSubmit: async (tx) => ({ tx_blob: "BLOB", hash: "HASH" }),
  signMessage: async (msg) => ({ signature: "SIG" }),
  on: () => {},
  off: () => {},
};

const adapter = new OtsuAdapter({ provider: mock });
assertWalletAdapter(adapter); // throws if contract is violated
```

## Wire-up (coder leader)

> **Note:** This package is a standalone adapter. Wiring it into `@xrpl-wallet-kit/client` and `@xrpl-wallet-kit/browser` is the responsibility of the project maintainer.

Steps:
1. Add `{ "path": "./packages/adapters/otsu" }` to root `tsconfig.json` references.
2. Import `createOtsuAdapter` in `packages/client/src/index.ts` and add it to `createDefaultAdapters()`.
3. Add `"otsu"` to the `WalletKitAdapterId` union in `client/src/index.ts`.
4. Run `npm run build && npm run typecheck` from the repo root.

## Wallet homepage

https://github.com/RomThpt/otsu-wallet

## License

MIT
