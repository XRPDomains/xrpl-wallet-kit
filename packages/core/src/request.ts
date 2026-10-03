import { isWalletKitError, normalizeWalletError, WalletKitError, WalletKitErrorCode } from "./errors";
import type { WalletRequest, WalletRequestKind, WalletRequestOptions, WalletRequestProgress, WalletRequestState } from "./types";

function cancellationError(signal?: AbortSignal): WalletKitError {
  if (isWalletKitError(signal?.reason)) return signal.reason;
  return new WalletKitError(WalletKitErrorCode.REQUEST_CANCELLED, "Wallet request was cancelled.");
}

export function assertWalletRequestActive(signal?: AbortSignal): void {
  if (signal?.aborted) throw cancellationError(signal);
}

/** Local cancellation only. Invoke lazily and synchronously to preserve user activation. */
export function waitForWalletRequest<T>(
  operation: () => Promise<T>,
  options: Pick<WalletRequestOptions, "signal" | "timeoutMs"> = {},
  onStop?: (error: WalletKitError) => void
): Promise<T> {
  const { signal, timeoutMs } = options;
  if (timeoutMs !== undefined && (!Number.isFinite(timeoutMs) || timeoutMs <= 0 || timeoutMs > 0x7fffffff)) {
    return Promise.reject(new WalletKitError(WalletKitErrorCode.INVALID_REQUEST, "timeoutMs must be between 0 and 2147483647 milliseconds, excluding zero."));
  }
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const cleanup = () => { if (timer !== undefined) clearTimeout(timer); signal?.removeEventListener("abort", abort); };
    const stop = (error: WalletKitError) => {
      if (settled) return;
      settled = true; cleanup();
      try { onStop?.(error); } catch { /* Cancellation still settles if provider cleanup fails. */ }
      reject(error);
    };
    const abort = () => stop(cancellationError(signal));
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) { abort(); return; }
    if (timeoutMs !== undefined) timer = setTimeout(() => stop(new WalletKitError(WalletKitErrorCode.REQUEST_TIMEOUT, "Wallet request timed out.")), timeoutMs);
    try {
      Promise.resolve(operation()).then(value => {
        if (settled) return;
        settled = true; cleanup(); resolve(value);
      }, error => { if (!settled) { settled = true; cleanup(); reject(error); } });
    } catch (error) { settled = true; cleanup(); reject(error); }
  });
}

export interface WalletRequestControl {
  requestId: string;
  signal: AbortSignal;
  progress: (progress: WalletRequestProgress) => void;
}

interface Entry { request: WalletRequest; controller: AbortController; dispatched: boolean; done: boolean; }

/** Bounded in-memory diagnostics; never stores transaction payloads or signing proofs. */
export class WalletRequestTracker {
  private history = new Map<string, WalletRequest>();
  private active = new Map<string, Entry>();
  private sequence = 0;
  constructor(private notify: (request: WalletRequest) => void) {}

  get(id: string): WalletRequest | undefined { return this.history.get(id); }
  pending(): WalletRequest[] { return [...this.active.values()].map(entry => entry.request); }

  cancel(id: string): boolean {
    const entry = this.active.get(id);
    if (!entry) return false;
    this.stop(entry, new WalletKitError(WalletKitErrorCode.REQUEST_CANCELLED, "Wallet request was cancelled."));
    return true;
  }
  cancelAll(exceptId?: string): void {
    for (const id of [...this.active.keys()]) if (id !== exceptId) this.cancel(id);
  }
  cancelSigning(): void {
    for (const [id, entry] of this.active) if (entry.request.kind !== "connect") this.cancel(id);
  }

  run<T>(
    adapterId: string, kind: WalletRequestKind, input: WalletRequestOptions,
    identity: { account?: string; networkId?: WalletRequest["networkId"] },
    operation: (control: WalletRequestControl) => Promise<T>,
    complete: (result: T) => { state: "connected" | "signed" | "submitted"; hash?: string }
  ): Promise<T> {
    const options = { signal: input.signal, timeoutMs: input.timeoutMs, requestId: input.requestId, onRequestProgress: input.onRequestProgress };
    const id = options.requestId ?? globalThis.crypto?.randomUUID?.() ?? `wallet-request-${Date.now()}-${++this.sequence}`;
    if (typeof id !== "string" || !id || id.length > 200 || this.history.has(id)) return Promise.reject(new WalletKitError(WalletKitErrorCode.INVALID_REQUEST, "requestId must be non-empty, at most 200 characters and unique within this manager."));
    const startedAt = Date.now();
    const entry: Entry = { controller: new AbortController(), dispatched: false, done: false,
      request: Object.freeze({ id, adapterId, kind, state: "pending", pending: true, startedAt, updatedAt: startedAt, outcomeUnknown: false, ...identity }) };
    this.active.set(id, entry);
    this.history.set(id, entry.request);
    const fromCaller = () => this.stop(entry, cancellationError(options.signal));
    options.signal?.addEventListener("abort", fromCaller, { once: true });
    if (options.signal?.aborted) fromCaller();
    this.notify(entry.request);
    const progress = (update: WalletRequestProgress) => {
      if (entry.done) return;
      if (update.state === "expired") {
        this.update(entry, { providerRequestId: update.providerRequestId ?? entry.request.providerRequestId, hash: update.hash ?? entry.request.hash });
        this.stop(entry, new WalletKitError(WalletKitErrorCode.REQUEST_EXPIRED, "Wallet request expired.")); return;
      }
      const rank = { pending: 0, opened: 1, signed: 2, submitted: 3 };
      if (!(update.state in rank)) return;
      if (update.state === "opened") entry.dispatched = true;
      this.update(entry, { state: rank[update.state] < (rank[entry.request.state as keyof typeof rank] ?? 0) ? entry.request.state : update.state,
        providerRequestId: update.providerRequestId ?? entry.request.providerRequestId,
        hash: update.hash ?? entry.request.hash });
      try { options.onRequestProgress?.(update); } catch { /* Observers cannot change the provider outcome. */ }
    };
    return waitForWalletRequest(() => operation({ signal: entry.controller.signal, requestId: id, progress }),
      { signal: entry.controller.signal, timeoutMs: options.timeoutMs }, error => this.stop(entry, error))
      .then(result => {
        assertWalletRequestActive(entry.controller.signal);
        const outcome = complete(result);
        entry.done = true; this.active.delete(id);
        if (outcome.state === "submitted") this.update(entry, { state: "signed", pending: false, hash: outcome.hash });
        this.update(entry, { ...outcome, pending: false });
        return result;
      }).catch(error => {
        const normalized = normalizeWalletError(error);
        if (!entry.done) this.stop(entry, normalized);
        throw new WalletKitError(normalized.code, normalized.message, { cause: normalized,
          details: { ...normalized.details, requestId: id, outcomeUnknown: entry.request.outcomeUnknown, hash: entry.request.hash, providerRequestId: entry.request.providerRequestId } });
      }).finally(() => { options.signal?.removeEventListener("abort", fromCaller); this.prune(); });
  }

  private stop(entry: Entry, error: WalletKitError): void {
    if (entry.done) return;
    entry.done = true; this.active.delete(entry.request.id);
    const state: WalletRequestState = error.code === WalletKitErrorCode.REQUEST_TIMEOUT || error.code === WalletKitErrorCode.REQUEST_EXPIRED
      ? "expired" : error.code === WalletKitErrorCode.REQUEST_CANCELLED || error.code === WalletKitErrorCode.SIGN_REJECTED
        || error.code === WalletKitErrorCode.CONNECTION_REJECTED || /reject|cancel|denied|closed/i.test(error.message) ? "cancelled" : "failed";
    this.update(entry, { state, pending: false, outcomeUnknown: entry.dispatched && entry.request.kind === "sign-and-submit" });
    entry.controller.abort(error);
  }
  private update(entry: Entry, patch: Partial<WalletRequest>): void {
    entry.request = Object.freeze({ ...entry.request, ...patch, updatedAt: Date.now() });
    this.history.set(entry.request.id, entry.request);
    this.notify(entry.request);
  }
  private prune(): void {
    let terminal = [...this.history.values()].filter(request => !request.pending).length;
    for (const [id, request] of this.history) if (terminal > 100 && !request.pending) { this.history.delete(id); terminal--; }
  }
}
