export interface WalletConnectWalletConfig {
  id: string;
  name: string;
  description?: string;
  group?: string;
  icon?: string;
  walletConnect?: { metadataName?: string };
  links?: { universal?: string; native?: string };
  qrMode?: "walletconnect" | "custom";
  useModal?: boolean;
  signMessage?: boolean;
  deeplink?: (uri: string) => string;
}
