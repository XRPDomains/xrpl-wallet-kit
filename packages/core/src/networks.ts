import type { WalletNetwork, WalletNetworkId } from "./types";

export const XRPL_MAINNET: WalletNetwork = {
  id: "mainnet",
  name: "XRPL Mainnet",
  family: "xrpl",
  networkType: "MAINNET",
  nativeAsset: "XRP",
  nativeAssetDecimals: 6,
  rpcUrl: "wss://xrplcluster.com",
  httpRpcUrl: "https://xrplcluster.com",
  walletConnectChainId: "xrpl:0",
  explorerTxUrl: "https://livenet.xrpl.org/transactions/{hash}",
  explorerAccountUrl: "https://livenet.xrpl.org/accounts/{address}"
};

export const XRPL_TESTNET: WalletNetwork = {
  id: "testnet",
  name: "XRPL Testnet",
  family: "xrpl",
  networkType: "TESTNET",
  nativeAsset: "XRP",
  nativeAssetDecimals: 6,
  rpcUrl: "wss://s.altnet.rippletest.net:51233",
  httpRpcUrl: "https://s.altnet.rippletest.net:51234",
  walletConnectChainId: "xrpl:1",
  explorerTxUrl: "https://testnet.xrpl.org/transactions/{hash}",
  explorerAccountUrl: "https://testnet.xrpl.org/accounts/{address}"
};

export const XRPL_DEVNET: WalletNetwork = {
  id: "devnet",
  name: "XRPL Devnet",
  family: "xrpl",
  networkType: "DEVNET",
  nativeAsset: "XRP",
  nativeAssetDecimals: 6,
  rpcUrl: "wss://s.devnet.rippletest.net:51233",
  httpRpcUrl: "https://s.devnet.rippletest.net:51234",
  walletConnectChainId: "xrpl:2",
  explorerTxUrl: "https://devnet.xrpl.org/transactions/{hash}",
  explorerAccountUrl: "https://devnet.xrpl.org/accounts/{address}"
};

export const DEFAULT_XRPL_NETWORKS = [XRPL_MAINNET, XRPL_TESTNET, XRPL_DEVNET] as const;

export class NetworkRegistry {
  private readonly networks = new Map<WalletNetworkId, WalletNetwork>();

  constructor(networks: readonly WalletNetwork[] = []) {
    networks.forEach((network) => this.register(network));
  }

  register(network: WalletNetwork): this {
    this.networks.set(network.id, network);
    return this;
  }

  resolve(id: WalletNetworkId = "mainnet"): WalletNetwork {
    const network = this.networks.get(id);
    if (!network) throw new Error(`XRPL network is not registered: ${id}`);
    return network;
  }

  list(): WalletNetwork[] {
    return [...this.networks.values()];
  }
}

export function createNetworkRegistry(networks: readonly WalletNetwork[] = DEFAULT_XRPL_NETWORKS): NetworkRegistry {
  return new NetworkRegistry(networks);
}

export function registerNetwork(registry: NetworkRegistry, network: WalletNetwork): NetworkRegistry {
  return registry.register(network);
}

export function resolveNetwork(networks: readonly WalletNetwork[] | NetworkRegistry, id = "mainnet"): WalletNetwork {
  if (networks instanceof NetworkRegistry) return networks.resolve(id);
  return createNetworkRegistry(networks).resolve(id);
}

export function getNativeAsset(network?: WalletNetwork): string {
  return network?.nativeAsset ?? "XRP";
}

export function getHttpRpcUrl(networkOrUrl?: WalletNetwork | string): string | undefined {
  if (!networkOrUrl) return undefined;
  const rpcUrl = typeof networkOrUrl === "string" ? networkOrUrl : networkOrUrl.httpRpcUrl ?? networkOrUrl.rpcUrl;
  if (rpcUrl.startsWith("wss://")) return `https://${rpcUrl.slice(6)}`;
  if (rpcUrl.startsWith("ws://")) return `http://${rpcUrl.slice(5)}`;
  return rpcUrl;
}

export function getExplorerAccountUrl(network: WalletNetwork | undefined, address: string): string | undefined {
  if (!network) return undefined;
  if (network.explorerAccountUrl) return network.explorerAccountUrl.replace("{address}", encodeURIComponent(address));
  if (network.networkType === "TESTNET") return `https://testnet.xrpl.org/accounts/${encodeURIComponent(address)}`;
  if (network.networkType === "DEVNET") return `https://devnet.xrpl.org/accounts/${encodeURIComponent(address)}`;
  if (network.networkType === "MAINNET") return `https://livenet.xrpl.org/accounts/${encodeURIComponent(address)}`;
  return undefined;
}

export function isMainnetNetwork(network?: WalletNetwork): boolean {
  return network?.networkType === "MAINNET" && (network.family ?? "xrpl") === "xrpl" && getNativeAsset(network) === "XRP";
}
