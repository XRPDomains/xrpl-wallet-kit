import { ClaspError, type ClaspConnect, type ClaspErrorCode } from "clasp-connect";
import { WalletKitError, WalletKitErrorCode } from "@xrpl-wallet-kit/core";

export type ClaspClient = Pick<ClaspConnect, "connect" | "sign" | "signAndSubmit"> & {
  cancelPendingRequest?: (reason?: unknown) => void;
};

const origin = "https://claspwallet.com";
const errorCodes = new Set<ClaspErrorCode>(["user_rejected", "unsupported_tx", "unsupported_message",
  "wrong_wallet", "network_unavailable", "tx_failed", "not_confirmed", "bad_request", "timeout", "busy", "popup_blocked"]);

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Clasp v1 transport with local cancellation, which clasp-connect 0.4.0 does not expose. */
export function createClaspClient(): ClaspClient {
  let windowName = "clasp-kit-" + crypto.randomUUID();
  let cancel: ((reason?: unknown) => void) | undefined;

  function request<T>(method: "connect" | "sign" | "sign_and_submit", params: unknown): Promise<T> {
    if (cancel) return Promise.reject(new ClaspError("busy", "A Clasp request is already active."));
    return new Promise<T>((resolve, reject) => {
      const id = crypto.randomUUID();
      let popup: Window | null = null;
      let sent = false;
      let settled = false;
      let poll: ReturnType<typeof setInterval> | undefined;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const finish = (error?: unknown, result?: T, stopped = false) => {
        if (settled) return;
        settled = true;
        window.removeEventListener("message", onMessage);
        if (poll !== undefined) clearInterval(poll);
        if (timer !== undefined) clearTimeout(timer);
        cancel = undefined;
        if (stopped) {
          // Never navigate or close an approval that may already be submitting.
          if (method === "sign_and_submit" && sent) windowName = "clasp-kit-" + crypto.randomUUID();
          else { try { popup?.close(); } catch { /* Local cleanup must still complete. */ } }
        }
        if (error !== undefined) reject(error);
        else resolve(result as T);
      };
      const onMessage = (event: MessageEvent<unknown>) => {
        if (!popup || event.origin !== origin || event.source !== popup || !record(event.data)) return;
        const data = event.data;
        if (data.v !== 1) return;
        if (data.clasp === "ready") {
          if (!sent) {
            try {
              popup.postMessage({ clasp: "request", v: 1, id, method, params }, origin);
              sent = true;
            } catch (error) { finish(error, undefined, true); }
          }
          return;
        }
        if (data.clasp !== "response" || data.id !== id) return;
        if (data.ok === true && record(data.result)) finish(undefined, data.result as T);
        else if (data.ok === false && record(data.error) && typeof data.error.message === "string" &&
          errorCodes.has(data.error.code as ClaspErrorCode)) {
          finish(new ClaspError(data.error.code as ClaspErrorCode, data.error.message, data.error));
        } else finish(new Error("Invalid Clasp response."), undefined, true);
      };
      const stop = (reason?: unknown) => finish(new WalletKitError(
        reason instanceof WalletKitError ? reason.code : WalletKitErrorCode.REQUEST_CANCELLED,
        reason instanceof WalletKitError ? reason.message : "Clasp request cancelled.",
        { cause: reason, details: { outcomeUnknown: method === "sign_and_submit" && sent } }), undefined, true);
      cancel = stop;
      try {
        window.addEventListener("message", onMessage);
        popup = window.open(origin + "/connect/", windowName, "width=420,height=680,popup=yes");
        if (!popup) { finish(new ClaspError("popup_blocked", "Clasp popup blocked.")); return; }
        poll = setInterval(() => {
          if (popup?.closed) {
            finish(new ClaspError(method === "sign_and_submit" && sent ? "not_confirmed" : "user_rejected",
              "Clasp window closed."), undefined, true);
          }
        }, 300);
        timer = setTimeout(() => stop(new WalletKitError(WalletKitErrorCode.REQUEST_TIMEOUT,
          "Clasp request timed out.")), 300_000);
      } catch (error) { finish(error, undefined, true); }
    });
  }

  return {
    connect: params => request("connect", params ?? {}),
    sign: params => request("sign", params),
    signAndSubmit: params => request("sign_and_submit", params),
    cancelPendingRequest: reason => cancel?.(reason)
  };
}
