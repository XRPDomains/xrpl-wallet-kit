import { WalletKitError, WalletKitErrorCode } from "@xrpl-wallet-kit/core";
import type { WalletProtocol } from "@xrpl-wallet-kit/core";
import type { XahauRpcRequest } from "./index";
import { XAHAU_NETWORKS, XAHAU_TRANSACTION_TYPES } from "./networks";
export { XAHAU_MAINNET, XAHAU_TESTNET, XAHAU_NETWORKS } from "./networks";

export function createXahauProtocolLoader(options: { readonly request?: XahauRpcRequest },
  loadModule: () => Promise<{ createXahauProtocol: (options: { readonly request?: XahauRpcRequest }) => WalletProtocol }>): WalletProtocol {
  let runtime: WalletProtocol | undefined;
  let loading: Promise<WalletProtocol> | undefined;
  const load = () => loading ??= loadModule().then(module => {
    runtime = module.createXahauProtocol(options);
    return runtime;
  }).catch(error => { loading = undefined; throw error; });
  const loaded = () => {
    if (!runtime) throw new WalletKitError(WalletKitErrorCode.INVALID_REQUEST, "Prepare a Xahau transaction before using its synchronous codec.");
    return runtime;
  };
  return {
    family: "xahau", networks: XAHAU_NETWORKS, transactionTypes: XAHAU_TRANSACTION_TYPES,
    prepare: async (...args) => (await load()).prepare(...args),
    submit: async (...args) => (await load()).submit(...args),
    verifyAndSubmit: async (blob, expected, account, network, policy, assertCurrent) => {
      const protocol = await load();
      if (protocol.verifyAndSubmit) return protocol.verifyAndSubmit(blob, expected, account, network, policy, assertCurrent);
      assertCurrent();
      const verified = protocol.verify(blob, expected, account, network, policy);
      await protocol.prepare(expected, account, network, policy);
      assertCurrent();
      return { ...await protocol.submit(verified.txBlob, network, policy), txBlob: verified.txBlob };
    },
    lookupTransaction: async (...args) => (await load()).lookupTransaction!(...args),
    verify: (...args) => loaded().verify(...args), encode: (...args) => loaded().encode(...args), decode: (...args) => loaded().decode(...args)
  };
}
