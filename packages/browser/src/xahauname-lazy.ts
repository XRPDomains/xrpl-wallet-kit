type XahauNameSdk = Pick<typeof import("@xahauname/sdk"), "XahauNameClient" | "resolveNetworkConfig">;

declare const __XWK_BROWSER_VERSION__: string;
const scriptSource = typeof document !== "undefined" ? (document.currentScript as HTMLScriptElement | null)?.src : undefined;
const runtimeUrl = scriptSource ? new URL("xrpl-wallet-kit-xahauname.runtime.js", scriptSource) : undefined;
let pending: Promise<XahauNameSdk> | undefined;

export function loadXahauNameSdk(): Promise<XahauNameSdk> {
  if (pending) return pending;
  pending = (async () => {
    if (!runtimeUrl || !["https:", "http:"].includes(runtimeUrl.protocol)) {
      throw new Error("Load the browser bundle from a script URL to use XahauName.");
    }
    const sdk = await import(/* @vite-ignore */ runtimeUrl.href);
    if (sdk.browserBundleVersion !== __XWK_BROWSER_VERSION__ || typeof sdk.XahauNameClient !== "function" || typeof sdk.resolveNetworkConfig !== "function") {
      throw new Error("XahauName runtime version mismatch. Use matching bundle assets.");
    }
    return sdk as XahauNameSdk;
  })().catch(error => { pending = undefined; throw error; });
  return pending;
}
