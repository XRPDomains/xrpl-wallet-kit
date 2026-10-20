import { sameValue as isDeepStrictEqual } from "./portable.mjs";
import { WalletKitError, WalletKitErrorCode } from "../../../packages/core/src/errors.ts";
import { prepareIntent, verifySignedBlob } from "./boundary.mjs";
import { checkPreparedFee } from "./rpc-policy.mjs";

const error = (code, message) => new WalletKitError(code, message);

// Private orchestration experiment. Dispatch and local session state are injected;
// this does not call a wallet SDK, normalize provider replies or submit anything.
export async function signOnly({ runtime, definitions, input, policy, getSession, dispatch, reader, signal, timeoutMs = 120000 }) {
  if (!Number.isInteger(timeoutMs) || timeoutMs <= 0 || timeoutMs > 300000 || typeof reader !== "function") {
    throw error(WalletKitErrorCode.INVALID_REQUEST, "Explicit M0 reader and bounded timeout required");
  }
  const frozenPolicy = structuredClone(policy);
  const intent = prepareIntent(runtime, definitions, input, frozenPolicy);
  const snapshot = structuredClone(getSession());
  if (!snapshot || typeof snapshot.adapterId !== "string" || !snapshot.adapterId ||
      !Number.isSafeInteger(snapshot.revision) || snapshot.revision < 0 || snapshot.family !== "xahau" ||
      snapshot.account !== frozenPolicy.account || snapshot.networkId !== frozenPolicy.networkId) {
    throw error(WalletKitErrorCode.NETWORK_MISMATCH, "Verified Xahau session required");
  }
  const controller = new AbortController();
  const cancel = () => controller.abort(error(WalletKitErrorCode.REQUEST_CANCELLED, "M0 signing cancelled; discard any late wallet reply"));
  if (signal?.aborted) cancel();
  else signal?.addEventListener("abort", cancel, { once: true });
  const timer = setTimeout(() => controller.abort(error(WalletKitErrorCode.REQUEST_TIMEOUT, "M0 signing timed out; discard any late wallet reply")), timeoutMs);
  const assertCurrent = () => {
    if (controller.signal.aborted) throw controller.signal.reason;
    if (!isDeepStrictEqual(getSession(), snapshot)) {
      throw error(WalletKitErrorCode.REQUEST_CANCELLED, "Session changed while signing; discard the result");
    }
  };
  const guarded = async action => {
    assertCurrent();
    let onAbort;
    const aborted = new Promise((_, reject) => {
      onAbort = () => reject(controller.signal.reason);
      controller.signal.addEventListener("abort", onAbort, { once: true });
    });
    try {
      const result = await Promise.race([aborted, Promise.resolve().then(() => {
        assertCurrent();
        return action();
      })]);
      assertCurrent();
      return result;
    } finally {
      controller.signal.removeEventListener("abort", onAbort);
    }
  };
  const checkedReader = (method, params) => guarded(() => reader(method, params));
  try {
    await guarded(() => checkPreparedFee(runtime, definitions, intent, frozenPolicy, checkedReader));
    const result = await guarded(() => dispatch({ txJson: structuredClone(intent), submit: false, signal: controller.signal }));
    const verified = verifySignedBlob(runtime, definitions, result?.txBlob, intent, frozenPolicy, result?.hash);
    // Approval can outlive ledger expiry, account sequence or fee conditions.
    await guarded(() => checkPreparedFee(runtime, definitions, intent, frozenPolicy, checkedReader));
    assertCurrent();
    return verified;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", cancel);
  }
}
