import { createWalletClient, XRPL_TESTNET } from '@xrpl-wallet-kit/client';

globalThis.bundleFixture = createWalletClient({
  networks: [XRPL_TESTNET],
  wallets: ['gemwallet'],
  storage: 'memory'
});
