import { createXahauProtocolLoader } from "./lazy-loader";
import type { WalletProtocol } from "@xrpl-wallet-kit/core";
import type { XahauRpcRequest } from "./index";
export { XAHAU_MAINNET, XAHAU_TESTNET, XAHAU_NETWORKS } from "./networks";

/**
 * Keep codec/definitions out of the initial ESM client chunk.
 * verify/encode/decode are synchronous and require a completed runtime load via
 * prepare/submit/lookupTransaction. Adapters should always await prepare first.
 */
export function createLazyXahauProtocol(options: { readonly request?: XahauRpcRequest } = {}): WalletProtocol {
  return createXahauProtocolLoader(options, () => import("./index"));
}
