import type { WalletConnectWalletConfig } from "./types";
import { BIFROST_ICON, BITGET_ICON, GIRIN_ICON, JOEY_ICON, STATICBIT_ICON } from "./icons";

export const walletConnectDeeplinks = {
  bifrost: (uri: string) => `https://app.bifrostwallet.com/wc?uri=${encodeURIComponent(uri)}`,
  joey: (uri: string) => `joey://settings/wc?uri=${encodeURIComponent(uri)}`,
  bitget: (uri: string) => `bitkeep://bkconnect?action=dapp&uri=${encodeURIComponent(uri)}`
};

export const XRPL_WALLETCONNECT_WALLETS: WalletConnectWalletConfig[] = [
  {
    id: "staticbit",
    name: "StaticBit",
    description: "Connect StaticBit through WalletConnect.",
    group: "WalletConnect",
    walletConnect: { metadataName: "StaticBit" },
    links: { universal: "https://staticbit.app/wc" },
    qrMode: "walletconnect",
    useModal: false,
    signMessage: false,
    icon: STATICBIT_ICON
  },
  {
    id: "bitget",
    name: "Bitget Wallet",
    description: "Connect Bitget Wallet through WalletConnect.",
    group: "WalletConnect",
    walletConnect: { metadataName: "Bitget Wallet" },
    links: {
      universal: "https://bkcode.vip/",
      native: "bitkeep://wc"
    },
    qrMode: "walletconnect",
    useModal: false,
    signMessage: false,
    deeplink: walletConnectDeeplinks.bitget,
    icon: BITGET_ICON
  },
  {
    id: "joey",
    name: "Joey",
    description: "Connect Joey Wallet through WalletConnect.",
    group: "WalletConnect",
    walletConnect: { metadataName: "Joey" },
    links: {
      universal: "https://joeywallet.xyz/wc",
      native: "joey://wc"
    },
    qrMode: "walletconnect",
    useModal: false,
    signMessage: true,
    deeplink: walletConnectDeeplinks.joey,
    icon: JOEY_ICON
  },
  {
    id: "girin",
    name: "Girin Wallet",
    description: "Connect Girin Wallet through WalletConnect.",
    group: "WalletConnect",
    walletConnect: { metadataName: "Girin Wallet" },
    links: {
      universal: "https://girin.app/wc",
      native: "girin://wc"
    },
    qrMode: "walletconnect",
    useModal: false,
    signMessage: false,
    icon: GIRIN_ICON
  },
  {
    id: "bifrost",
    name: "Bifrost Wallet",
    description: "Connect Bifrost Wallet through WalletConnect.",
    group: "WalletConnect",
    walletConnect: { metadataName: "Bifrost Wallet" },
    links: {
      universal: "https://app.bifrostwallet.com/wc",
      native: "bifrostwallet://wc"
    },
    qrMode: "walletconnect",
    useModal: false,
    signMessage: true,
    deeplink: walletConnectDeeplinks.bifrost,
    icon: BIFROST_ICON
  }
];

