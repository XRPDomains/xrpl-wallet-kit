import { WalletManager, createBrowserWalletStorage } from "@xrpname/wallet-core";
import { createGemWalletAdapter } from "@xrpname/wallet-adapter-gemwallet";
import { createCrossmarkAdapter } from "@xrpname/wallet-adapter-crossmark";
import { XrplWalletProvider, useXrplWallet } from "@xrpname/wallet-react";

const manager = new WalletManager({
  appName: "XRPL React dApp",
  network: "mainnet",
  autoReconnect: true,
  storage: createBrowserWalletStorage(),
  adapters: [createGemWalletAdapter(), createCrossmarkAdapter()]
});

function ConnectButton() {
  const { account, wallets, connect, disconnect } = useXrplWallet();
  if (account) return <button onClick={disconnect}>{account.address}</button>;
  return <div>{wallets.map((wallet) => <button key={wallet.id} onClick={() => connect(wallet.id)}>{wallet.name}</button>)}</div>;
}

export default function App() {
  return <XrplWalletProvider manager={manager}><ConnectButton /></XrplWalletProvider>;
}
