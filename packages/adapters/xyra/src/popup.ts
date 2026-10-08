import { WalletKitError, WalletKitErrorCode, createWalletError } from "@xrpl-wallet-kit/core";
import type { WalletRequestOptions } from "@xrpl-wallet-kit/core";

export const XYRA_ORIGIN = "https://wallet.xyra.now";

export class XyraPopup {
  private stop?: () => void;
  get pending() { return Boolean(this.stop); }
  cancel() { this.stop?.(); }

  request(path: "connect" | "sign", params: Record<string, string>, options: WalletRequestOptions): Promise<Record<string, unknown>> {
    const failure = (message: string) => new WalletKitError(WalletKitErrorCode.INVALID_REQUEST, message);
    if (this.pending) return Promise.reject(failure("A Xyra popup request is already pending."));
    const timeout = options.timeoutMs ?? 60_000;
    if (!Number.isFinite(timeout) || timeout <= 0 || timeout > 0x7fffffff) return Promise.reject(failure("Invalid Xyra timeoutMs."));
    if (options.signal?.aborted) return Promise.reject(new WalletKitError(WalletKitErrorCode.REQUEST_CANCELLED, "Xyra request cancelled."));
    if (typeof window === "undefined" || !window.open) return Promise.reject(createWalletError.walletNotAvailable("Xyra"));
    if (!globalThis.crypto?.getRandomValues) return Promise.reject(failure("Xyra requires secure randomness."));
    const id = Array.from(crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2, "0")).join("");
    const url = new URL(`/${path}`, XYRA_ORIGIN);
    Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
    const win = window;
    let popup: Window | null;
    try { popup = win.open(url.href, `xyra-${id}`, "popup=yes,width=420,height=720,resizable=yes,scrollbars=yes"); }
    catch { popup = null; }
    if (!popup || popup.closed) return Promise.reject(createWalletError.walletNotAvailable("Xyra", new Error("Popup blocked.")));
    const opened = popup;
    const expectedType = path === "connect" ? "CONNECT_RESPONSE" : "SIGN_RESPONSE";

    return new Promise((resolve, reject) => {
      let done = false;
      let poll: ReturnType<typeof setInterval>;
      let timer: ReturnType<typeof setTimeout>;
      let submitTimer: ReturnType<typeof setTimeout> | undefined;
      const finish = (error?: unknown, result?: Record<string, unknown>) => {
        if (done) return;
        done = true;
        win.removeEventListener("message", message);
        options.signal?.removeEventListener("abort", abort);
        clearInterval(poll); clearTimeout(timer); clearTimeout(submitTimer);
        this.stop = undefined;
        try { opened.close(); } catch { /* COOP may sever access. */ }
        if (error) reject(error); else resolve(result!);
      };
      const interrupted = (code: WalletKitErrorCode, message: string) => new WalletKitError(code, message, {
        details: { outcomeUnknown: path === "sign" && params.submit === "true" }
      });
      const abort = () => finish(interrupted(WalletKitErrorCode.REQUEST_CANCELLED, "Xyra request cancelled."));
      // Xyra has no echoed request ID: correlate with a fresh window, exact origin/type and one pending request.
      const message = (event: MessageEvent) => {
        if (event.source !== opened || event.origin !== XYRA_ORIGIN) return;
        const data = event.data;
        if (!data || typeof data !== "object" || Array.isArray(data) || data.type !== expectedType) return;
        if (data.error || (path === "connect" ? data.address === "" : data.tx_blob === "")) {
          const cause = new Error("Xyra request rejected or cancelled.");
          finish(path === "connect" ? createWalletError.connectionRejected("Xyra", cause) : createWalletError.signRejected(cause));
        } else finish(undefined, data);
      };
      this.stop = abort;
      win.addEventListener("message", message);
      options.signal?.addEventListener("abort", abort, { once: true });
      poll = setInterval(() => {
        try {
          if (opened.closed) finish(interrupted(path === "connect" ? WalletKitErrorCode.CONNECTION_REJECTED : WalletKitErrorCode.SIGN_REJECTED, "Xyra popup closed before replying."));
        } catch { finish(interrupted(WalletKitErrorCode.REQUEST_CANCELLED, "Xyra popup became inaccessible.")); }
      }, 100);
      timer = setTimeout(() => finish(interrupted(WalletKitErrorCode.REQUEST_TIMEOUT, "Xyra request timed out. Check referrer policy and COOP.")), timeout);
      if (path === "sign" && params.submit === "true") {
        // Match the official SDK's explicit submit message as well as its URL flag.
        submitTimer = setTimeout(() => {
          try { opened.postMessage({ type: "SIGN", network: params.network, tx: params.tx, submit: true }, XYRA_ORIGIN); }
          catch (cause) { finish(createWalletError.signFailed(cause)); }
        }, 500);
      }
      if (options.signal?.aborted) abort();
    });
  }
}
