import { WalletManager, createBrowserWalletStorage } from "@xrpl-wallet-kit/core";
import { createGemWalletAdapter } from "@xrpl-wallet-kit/adapter-gemwallet";
import { createCrossmarkAdapter } from "@xrpl-wallet-kit/adapter-crossmark";
import { WalletKitProvider, useWalletKit } from "@xrpl-wallet-kit/react";

const manager = new WalletManager({
  appName: "XRPL React dApp",
  network: "mainnet",
  autoReconnect: true,
  storage: createBrowserWalletStorage(),
  adapters: [createGemWalletAdapter(), createCrossmarkAdapter()]
});

function ConnectButton() {
  const { account, wallets, connect, disconnect } = useWalletKit();
  if (account) return <button onClick={disconnect}>{account.address}</button>;
  return <div>{wallets.map((wallet) => <button key={wallet.id} onClick={() => connect(wallet.id)}>{wallet.name}</button>)}</div>;
}

export default function App() {
  return <WalletKitProvider manager={manager}><ConnectButton /></WalletKitProvider>;
}
