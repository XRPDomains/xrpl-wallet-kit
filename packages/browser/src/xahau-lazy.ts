import { WalletKitError, WalletKitErrorCode } from "@xrpl-wallet-kit/core";
import { createXahauProtocolLoader } from "@xrpl-wallet-kit/xahau/loader";
import type { XahauRpcRequest } from "@xrpl-wallet-kit/xahau";
export { XAHAU_MAINNET, XAHAU_TESTNET, XAHAU_NETWORKS } from "@xrpl-wallet-kit/xahau/loader";

declare const __XWK_BROWSER_VERSION__: string;
const scriptSource = typeof document !== "undefined" ? (document.currentScript as HTMLScriptElement | null)?.src : undefined;
const runtimeUrl = scriptSource ? new URL("xrpl-wallet-kit-xahau.runtime.js", scriptSource) : undefined;

/** IIFE-only loader; ESM consumers continue using the normal client lazy chunk. */
export function createLazyXahauProtocol(options: { readonly request?: XahauRpcRequest } = {}) {
  return createXahauProtocolLoader(options, async () => {
    if (!runtimeUrl || !["https:", "http:"].includes(runtimeUrl.protocol)) {
      throw new WalletKitError(WalletKitErrorCode.INVALID_REQUEST, "Load the browser bundle from a script URL to use Xahau.");
    }
    let module;
    try { module = await import(/* @vite-ignore */ runtimeUrl.href); }
    catch (cause) {
      throw new WalletKitError(WalletKitErrorCode.INVALID_REQUEST, "Unable to load Xahau runtime. Check its URL and CSP.", { cause });
    }
    if (module.browserBundleVersion !== __XWK_BROWSER_VERSION__ || typeof module.createXahauProtocol !== "function") {
      throw new WalletKitError(WalletKitErrorCode.INVALID_REQUEST, "Xahau runtime version mismatch. Use a pinned bundle URL.");
    }
    return module;
  });
}
