import type { WalletNetwork } from "./types";

export const XRPL_MAINNET: WalletNetwork = {
  id: "mainnet",
  name: "XRPL Mainnet",
  networkType: "MAINNET",
  rpcUrl: "wss://xrplcluster.com",
  walletConnectChainId: "xrpl:0",
  explorerTxUrl: "https://livenet.xrpl.org/transactions/{hash}"
};

export const XRPL_TESTNET: WalletNetwork = {
  id: "testnet",
  name: "XRPL Testnet",
  networkType: "TESTNET",
  rpcUrl: "wss://s.altnet.rippletest.net:51233",
  walletConnectChainId: "xrpl:1",
  explorerTxUrl: "https://testnet.xrpl.org/transactions/{hash}"
};

export const XRPL_DEVNET: WalletNetwork = {
  id: "devnet",
  name: "XRPL Devnet",
  networkType: "DEVNET",
  rpcUrl: "wss://s.devnet.rippletest.net:51233",
  walletConnectChainId: "xrpl:2",
  explorerTxUrl: "https://devnet.xrpl.org/transactions/{hash}"
};

export const DEFAULT_XRPL_NETWORKS = [XRPL_MAINNET, XRPL_TESTNET, XRPL_DEVNET] as const;

export function resolveNetwork(networks: readonly WalletNetwork[], id = "mainnet"): WalletNetwork {
  const network = networks.find((item) => item.id === id);
  if (!network) throw new Error(`XRPL network is not registered: ${id}`);
  return network;
}
