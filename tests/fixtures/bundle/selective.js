import { createWalletClient, XRPL_TESTNET } from '@xrpl-wallet-kit/client/selective';
import { createGemWalletAdapter } from '@xrpl-wallet-kit/adapter-gemwallet';

globalThis.bundleFixture = createWalletClient({
  networks: [XRPL_TESTNET],
  adapters: [createGemWalletAdapter()],
  storage: 'memory'
});
