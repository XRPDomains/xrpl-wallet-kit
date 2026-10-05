import { WalletKitError, WalletKitErrorCode, createWalletError } from "@xrpl-wallet-kit/core";
import type { WalletRequestOptions } from "@xrpl-wallet-kit/core";

export function resolveGhostsigUrl(value = "https://ghostsig.dev/?connect"): URL {
  let url: URL;
  try { url = new URL(value); }
  catch (cause) { throw new WalletKitError(WalletKitErrorCode.INVALID_REQUEST, "Invalid GhostSig URL.", { cause }); }
  if (url.username || url.password || !(url.origin === "https://ghostsig.dev" ||
    (url.protocol === "http:" && url.hostname === "localhost"))) {
    throw new WalletKitError(WalletKitErrorCode.INVALID_REQUEST, "GhostSig requires https://ghostsig.dev or explicit http://localhost development.");
  }
  return url;
}

export class GhostsigPopup {
  private stop?: () => void;
  get pending(): boolean { return Boolean(this.stop); }

  cancel(): void { this.stop?.(); }

  request(url: URL, network: string, method: "connect" | "sign", params: Record<string, unknown>, options: WalletRequestOptions): Promise<unknown> {
    if (this.stop) return Promise.reject(new WalletKitError(WalletKitErrorCode.INVALID_REQUEST, "A GhostSig popup request is already pending."));
    const timeout = options.timeoutMs ?? 60_000;
    if (!Number.isFinite(timeout) || timeout <= 0 || timeout > 0x7fffffff) return Promise.reject(new WalletKitError(WalletKitErrorCode.INVALID_REQUEST, "Invalid GhostSig timeoutMs."));
    if (options.signal?.aborted) return Promise.reject(new WalletKitError(WalletKitErrorCode.REQUEST_CANCELLED, "GhostSig request cancelled."));
    if (typeof window === "undefined" || typeof window.open !== "function") return Promise.reject(createWalletError.walletNotAvailable("GhostSig"));
    if (!globalThis.crypto?.getRandomValues) return Promise.reject(new WalletKitError(WalletKitErrorCode.INVALID_REQUEST, "GhostSig requires secure randomness."));
    const id = Array.from(globalThis.crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2, "0")).join("");
    const win = window;
    let popup: Window | null;
    try { popup = win.open(url.href, `ghostsig-${id}`, "popup=yes,width=420,height=720,resizable=yes,scrollbars=yes"); }
    catch { popup = null; }
    if (!popup || popup.closed) return Promise.reject(createWalletError.walletNotAvailable("GhostSig", new Error("Popup blocked.")));
    const opened = popup;
    const request = { ghostsig: 1, id, type: "request", method, chain: "xrpl", network, params };

    return new Promise((resolve, reject) => {
      let done = false;
      let posted = false;
      let providerHash: string | undefined;
      let poll: ReturnType<typeof setInterval>;
      let ready: ReturnType<typeof setTimeout>;
      let timer: ReturnType<typeof setTimeout>;
      const finish = (error?: unknown, result?: unknown) => {
        if (done) return;
        done = true;
        win.removeEventListener("message", message);
        options.signal?.removeEventListener("abort", abort);
        clearInterval(poll); clearTimeout(ready); clearTimeout(timer);
        this.stop = undefined;
        try { opened.close(); } catch { /* COOP may sever access to the popup. */ }
        if (error) reject(error); else resolve(result);
      };
      const interrupted = (code: WalletKitErrorCode, text: string) => new WalletKitError(code, text, {
        details: { providerHash, outcomeUnknown: method === "sign" && params.submit === true && posted }
      });
      const abort = () => finish(interrupted(WalletKitErrorCode.REQUEST_CANCELLED, "GhostSig request cancelled."));
      const message = (event: MessageEvent) => {
        if (event.source !== opened || event.origin !== url.origin) return;
        const data = event.data;
        if (!data || typeof data !== "object" || data.ghostsig !== 1) return;
        if (data.type === "ready") {
          if (posted) return;
          posted = true;
          try { opened.postMessage(request, url.origin); }
          catch (cause) { finish(method === "connect" ? createWalletError.connectionFailed("GhostSig", cause) : createWalletError.signFailed(cause)); }
          return;
        }
        if (!posted || data.id !== id) return;
        if (data.type === "result") finish(undefined, data.result);
        else if (data.type === "signed" && typeof data.hash === "string" && /^[0-9a-f]{64}$/i.test(data.hash)) {
          providerHash = data.hash;
          try { options.onRequestProgress?.({ state: "signed", providerRequestId: id, hash: providerHash }); }
          catch (cause) { finish(cause); }
        } else if (data.type === "error") {
          const text = typeof data.error?.message === "string" ? data.error.message : "GhostSig refused the request.";
          const cause = new WalletKitError(WalletKitErrorCode.SIGN_FAILED, text, { details: { providerHash, outcomeUnknown: method === "sign" && params.submit === true } });
          finish(data.error?.code === -4 ? method === "connect" ? createWalletError.connectionRejected("GhostSig", cause) : createWalletError.signRejected(cause)
            : method === "connect" ? createWalletError.connectionFailed("GhostSig", cause) : createWalletError.signFailed(cause));
        }
      };
      this.stop = abort;
      win.addEventListener("message", message);
      options.signal?.addEventListener("abort", abort, { once: true });
      poll = setInterval(() => {
        try {
          if (opened.closed) finish(interrupted(method === "connect" ? WalletKitErrorCode.CONNECTION_REJECTED : WalletKitErrorCode.SIGN_REJECTED, "GhostSig popup closed before replying."));
        } catch { finish(interrupted(WalletKitErrorCode.REQUEST_CANCELLED, "GhostSig popup became inaccessible.")); }
      }, 100);
      ready = setTimeout(() => {
        if (!posted) finish(interrupted(WalletKitErrorCode.REQUEST_TIMEOUT, "GhostSig popup did not become ready. Check COOP same-origin-allow-popups."));
      }, Math.min(timeout, 10_000));
      timer = setTimeout(() => finish(interrupted(WalletKitErrorCode.REQUEST_TIMEOUT, "GhostSig request timed out.")), timeout);
      if (options.signal?.aborted) abort();
    });
  }
}
