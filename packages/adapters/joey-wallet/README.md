# Joey Wallet Adapter

Native Joey Wallet browser extension integration, using `@joeywallet/wallet-sdk`.
Adapter ID: `joey-wallet` (distinct from WalletConnect's `joey`).

Supports XRPL mainnet/testnet/devnet connection, passive granted-account restore,
sign-only, sign-and-submit and native `signIn()` (CAIP-122 or Ledger challenge).
Does not expose Xahau, arbitrary message signing, Batch,
bulk signing or multisigning.

```ts
import { createJoeyWalletAdapter } from "@xrpl-wallet-kit/adapter-joey-wallet";

const adapter = createJoeyWalletAdapter({
  maxFeeDrops: "50000",
  onDisconnected: () => manager.emitDisconnected("joey-wallet"),
});
```

See the website adapter guide for connection, Payment and NFT offer examples.
