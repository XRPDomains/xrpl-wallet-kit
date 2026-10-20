import type { WalletNetwork } from "@xrpl-wallet-kit/core";

export const XAHAU_MAINNET: WalletNetwork = { id: "xahau-mainnet", family: "xahau", name: "Xahau Mainnet", networkType: "MAINNET", networkId: 21337, nativeAsset: "XAH", nativeAssetDecimals: 6,
  rpcUrl: "wss://xahau.network", httpRpcUrl: "https://xahau.network", explorerTxUrl: "https://xahau.xrpl.org/transactions/{hash}", explorerAccountUrl: "https://xahau.xrpl.org/accounts/{address}",
  providerHints: { xaman: "XAHAU", xyra: "xahau-mainnet", gemwallet: { chain: "XAHAU", network: "Mainnet" }, ledgerApp: "XAH" } };
export const XAHAU_TESTNET: WalletNetwork = { ...XAHAU_MAINNET, id: "xahau-testnet", name: "Xahau Testnet", networkType: "TESTNET", networkId: 21338,
  rpcUrl: "wss://xahau-test.net", httpRpcUrl: "https://xahau-test.net", explorerTxUrl: "https://xahau-testnet.xrpl.org/transactions/{hash}", explorerAccountUrl: "https://xahau-testnet.xrpl.org/accounts/{address}",
  providerHints: { xaman: "XAHAUTESTNET", xyra: "xahau-testnet", gemwallet: { chain: "XAHAU", network: "Testnet" }, ledgerApp: "XAH" } };
export const XAHAU_NETWORKS: readonly WalletNetwork[] = [XAHAU_MAINNET, XAHAU_TESTNET];
export const XAHAU_TRANSACTION_TYPES = ["Payment", "Invoke", "TrustSet", "OfferCreate", "OfferCancel", "AccountSet",
  "URITokenMint", "URITokenBurn", "URITokenBuy", "URITokenCreateSellOffer", "URITokenCancelSellOffer"];
