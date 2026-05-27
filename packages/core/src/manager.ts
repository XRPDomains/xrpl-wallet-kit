import { createWalletError, isWalletKitError, normalizeWalletError } from "./errors";
import { WalletEventEmitter } from "./events";
import { createWalletKitLogger } from "./logger";
import type { WalletKitLogger } from "./logger";
import { DEFAULT_XRPL_NETWORKS, createNetworkRegistry, getHttpRpcUrl } from "./networks";
import { normalizeTxResult, pickPath } from "./result";
import { MemoryWalletStorage } from "./storage";
import type { ConnectOptions, SignAndSubmitRequest, SignMessageRequest, SignTransactionRequest, SignTransactionResult, StoredWalletSessionEnvelope, WalletAccount, WalletAdapter, WalletAvailabilityMap, WalletCapabilities, WalletManagerConfig, WalletNetwork, WalletSession, WalletStorage } from "./types";

const SESSION_KEY = "session";
export const WALLET_STORAGE_VERSION = 1;
const RECOVER_SESSION_RETRY_DELAYS_MS = [0, 700, 1600, 3000];
const DEFAULT_ACCOUNT_STATUS_TIMEOUT_MS = 2500;

export class WalletManager extends WalletEventEmitter {
  readonly adapters = new Map<string, WalletAdapter>();
  readonly networks: WalletNetwork[];
  readonly networkRegistry: ReturnType<typeof createNetworkRegistry>;
  readonly storage: WalletStorage;
  readonly logger: WalletKitLogger;
  private activeSession: WalletSession | null = null;
  private activeAdapterId: string | null = null;
  private pendingAdapterId: string | null = null;
  private pendingAbortController?: AbortController;
  private autoReconnectPromise?: Promise<WalletSession | null>;

  constructor(private config: WalletManagerConfig) {
    super();
    this.networkRegistry = createNetworkRegistry([...DEFAULT_XRPL_NETWORKS, ...(config.networks ?? [])]);
    this.networks = this.networkRegistry.list();
    this.storage = config.storage ?? new MemoryWalletStorage();
    this.logger = createWalletKitLogger(config.logger);
    config.adapters?.forEach((adapter) => this.register(adapter));
  }

  register(adapter: WalletAdapter): this {
    this.adapters.set(adapter.metadata.id, adapter);
    this.logger.debug(`Registered adapter ${adapter.metadata.id}`);
    return this;
  }

  getWallets() {
    return [...this.adapters.values()].map((adapter) => adapter.metadata);
  }

  async getWalletAvailability(): Promise<WalletAvailabilityMap> {
    const entries = await Promise.all([...this.adapters.values()].map(async (adapter) => {
      if (!adapter.isAvailable) return [adapter.metadata.id, false] as const;
      try {
        return [adapter.metadata.id, Boolean(await adapter.isAvailable())] as const;
      } catch (error) {
        this.logger.warn(`Availability check failed for ${adapter.metadata.id}`, error);
        return [adapter.metadata.id, false] as const;
      }
    }));

    return Object.fromEntries(entries);
  }

  async getAvailableWallets(): Promise<WalletAdapter[]> {
    const results = await Promise.all([...this.adapters.values()].map(async (adapter) => {
      if (!adapter.isAvailable) return null;
      try {
        return await adapter.isAvailable() ? adapter : null;
      } catch (error) {
        this.logger.warn(`Availability check failed for ${adapter.metadata.id}`, error);
        return null;
      }
    }));

    return results.filter((adapter): adapter is WalletAdapter => Boolean(adapter));
  }

  getAdapter(adapterId?: string): WalletAdapter | undefined {
    return this.adapters.get(adapterId ?? this.activeAdapterId ?? "");
  }

  getAccount(): WalletAccount | null {
    return this.activeSession?.account ?? null;
  }

  getSession(): WalletSession | null {
    return this.activeSession;
  }

  getCapabilities(adapterId?: string): WalletCapabilities | undefined {
    return this.getAdapter(adapterId)?.capabilities;
  }

  can(capability: keyof WalletCapabilities, adapterId?: string): boolean {
    return Boolean(this.getCapabilities(adapterId)?.[capability]);
  }

  getNetwork(id = this.config.network ?? "mainnet"): WalletNetwork {
    return this.networkRegistry.resolve(id);
  }

  async autoReconnect(): Promise<WalletSession | null> {
    if (!this.config.autoReconnect) return null;
    if (this.autoReconnectPromise) return this.autoReconnectPromise;
    this.autoReconnectPromise = this.runAutoReconnect().finally(() => {
      this.autoReconnectPromise = undefined;
    });
    return this.autoReconnectPromise;
  }

  private async runAutoReconnect(): Promise<WalletSession | null> {
    const serialized = await this.storage.getItem(SESSION_KEY);
    if (!serialized) return this.recoverPendingReturnSession();
    const session = this.parseStoredSession(serialized);
    if (!session) {
      await this.storage.removeItem(SESSION_KEY);
      this.emit("session_expired", {});
      return null;
    }
    const adapter = this.adapters.get(session.adapterId);
    if (!adapter) {
      await this.storage.removeItem(SESSION_KEY);
      this.emit("session_expired", { adapterId: session.adapterId });
      return null;
    }
    try {
      if (adapter.restoreSession) {
        const restored = await adapter.restoreSession(session);
        if (!restored?.session) {
          this.emit("session_stale", { adapterId: session.adapterId, account: session.account, session, reason: "restore_unavailable" });
          return null;
        }
        const enrichedSession = await this.enrichSession(this.withWalletMetadata(restored.session, adapter));
        this.setSession(enrichedSession);
        this.emit("session_restored", { adapterId: enrichedSession.adapterId, account: enrichedSession.account, session: enrichedSession });
        return enrichedSession;
      }

      if (adapter.isAvailable && !await adapter.isAvailable()) {
        this.emit("session_stale", { adapterId: session.adapterId, account: session.account, session, reason: "adapter_unavailable" });
        return null;
      }

      const enrichedSession = await this.enrichSession(this.withWalletMetadata(session, adapter));
      this.setSession(enrichedSession);
      this.emit("session_restored", { adapterId: enrichedSession.adapterId, account: enrichedSession.account, session: enrichedSession, stale: true });
      return enrichedSession;
    } catch (error) {
      this.logger.warn("Auto reconnect failed", error);
      await this.storage.removeItem(SESSION_KEY);
      this.emit("session_expired", { adapterId: session.adapterId });
      return null;
    }
  }

  private async recoverPendingReturnSession(): Promise<WalletSession | null> {
    const network = this.getNetwork();
    const adaptersWithRecovery = [...this.adapters.values()].filter((adapter) => adapter.recoverSession);
    const recoverableAdapters: WalletAdapter[] = [];
    for (const adapter of adaptersWithRecovery) {
      try {
        if (adapter.canRecoverSession && !await adapter.canRecoverSession({ network, walletId: adapter.metadata.id })) continue;
        recoverableAdapters.push(adapter);
      } catch (error) {
        this.logger.warn(`Session recovery availability check failed for ${adapter.metadata.id}`, error);
      }
    }
    if (!recoverableAdapters.length) return null;

    const announcedAdapters = new Set<string>();

    for (const delayMs of RECOVER_SESSION_RETRY_DELAYS_MS) {
      if (delayMs > 0) await this.delay(delayMs);
      for (const adapter of recoverableAdapters) {
        try {
          if (!announcedAdapters.has(adapter.metadata.id)) {
            announcedAdapters.add(adapter.metadata.id);
            this.emit("connecting", { adapterId: adapter.metadata.id, recovering: true });
          }
          const recovered = await adapter.recoverSession?.({ network, walletId: adapter.metadata.id });
          if (!recovered?.session) continue;
          const enrichedSession = await this.enrichSession(this.withWalletMetadata(recovered.session, adapter));
          this.setSession(enrichedSession);
          await this.saveSession(enrichedSession);
          this.emit("session_restored", { adapterId: enrichedSession.adapterId, account: enrichedSession.account, session: enrichedSession });
          return enrichedSession;
        } catch (error) {
          this.logger.warn(`Session recovery failed for ${adapter.metadata.id}`, error);
        }
      }
    }

    recoverableAdapters.forEach((adapter) => {
      this.emit("session_stale", { adapterId: adapter.metadata.id, reason: "recover_unavailable", attempts: RECOVER_SESSION_RETRY_DELAYS_MS.length });
      void adapter.cancelPendingConnection?.();
    });
    return null;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async connect(adapterId: string, options: ConnectOptions = {}): Promise<WalletSession> {
    const adapter = this.requireAdapter(adapterId);
    const network = options.network ?? this.getNetwork();
    try {
      await this.cancelPendingConnection(adapterId);
      if (this.activeAdapterId && this.activeAdapterId !== adapterId) {
        await this.disconnect();
      }
      this.pendingAdapterId = adapterId;
      this.pendingAbortController = new AbortController();
      this.emit("connecting", { adapterId });
      if (adapter.isAvailable && !await adapter.isAvailable()) {
        throw createWalletError.walletNotAvailable(adapter.metadata.name);
      }
      const signal = options.signal ?? this.pendingAbortController.signal;
      const result = await adapter.connect({ ...options, network, walletId: adapterId, signal });
      if (signal.aborted || this.pendingAdapterId !== adapterId) {
        throw new Error("Wallet connection was cancelled");
      }
      const session = await this.enrichSession(this.withWalletMetadata(result.session ?? { adapterId, account: { ...result.account, network }, connectedAt: Date.now() }, adapter));
      this.setSession(session);
      await this.saveSession(session);
      this.emit("connected", { adapterId, account: session.account, session });
      return session;
    } catch (error) {
      if (this.isCancellationError(error)) {
        this.emit("session_stale", { adapterId, reason: "connection_cancelled" });
        throw error;
      }
      const normalized = this.normalizeConnectionError(adapter, error);
      this.emit("error", { adapterId, error: normalized });
      throw normalized;
    } finally {
      if (this.pendingAdapterId === adapterId) {
        this.pendingAdapterId = null;
        this.pendingAbortController = undefined;
      }
    }
  }

  async cancelPendingConnection(exceptAdapterId?: string): Promise<void> {
    const pendingAdapterId = this.pendingAdapterId;
    if (!pendingAdapterId || pendingAdapterId === exceptAdapterId) return;
    this.pendingAbortController?.abort();
    this.pendingAbortController = undefined;
    this.pendingAdapterId = null;
    try {
      await this.adapters.get(pendingAdapterId)?.cancelPendingConnection?.();
    } catch (error) {
      this.logger.warn(`Cancel pending connection failed for ${pendingAdapterId}`, error);
    }
    this.emit("session_stale", { adapterId: pendingAdapterId, reason: "connection_cancelled" });
  }

  private isCancellationError(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error);
    return /connection was cancelled|connection was canceled|aborted/i.test(message);
  }

  async disconnect(): Promise<void> {
    const adapterId = this.activeAdapterId ?? undefined;
    const adapter = this.getAdapter();
    try {
      await this.cancelPendingConnection();
      const disconnected = await this.withTimeout(adapter?.disconnect?.(), 2000);
      if (adapter?.disconnect && disconnected.timedOut) {
        this.emit("session_stale", { adapterId: adapter.metadata.id, reason: "disconnect_timeout" });
        await adapter.cancelPendingConnection?.();
      }
    } catch (error) {
      this.logger.warn("Adapter disconnect failed", error);
      try {
        await adapter?.cancelPendingConnection?.();
      } catch (cleanupError) {
        this.logger.warn("Adapter disconnect cleanup failed", cleanupError);
      }
    } finally {
      this.activeAdapterId = null;
      this.activeSession = null;
      await this.storage.removeItem(SESSION_KEY);
      this.emit("disconnected", { adapterId });
    }
  }

  async signMessage(request: SignMessageRequest) {
    const adapter = this.requireActiveAdapter("signMessage");
    try {
      this.emit("signing", { adapterId: adapter.metadata.id, kind: "message" });
      const result = await adapter.signMessage!({ ...request, account: request.account ?? this.getAccount() ?? undefined });
      this.emit("signed", { adapterId: adapter.metadata.id, kind: "message", result });
      return result;
    } catch (error) {
      const normalized = normalizeWalletError(error);
      this.emit("rejected", { adapterId: adapter.metadata.id, kind: "message", error: normalized });
      throw normalized;
    }
  }

  async signAndSubmit(request: SignAndSubmitRequest) {
    const adapter = this.requireActiveAdapter("signAndSubmit");
    try {
      this.emit("signing", { adapterId: adapter.metadata.id, kind: "transaction" });
      const result = normalizeTxResult(await adapter.signAndSubmit!(request));
      this.emit("signed", { adapterId: adapter.metadata.id, kind: "transaction", result });
      return result;
    } catch (error) {
      const normalized = normalizeWalletError(error);
      this.emit("rejected", { adapterId: adapter.metadata.id, kind: "transaction", error: normalized });
      throw normalized;
    }
  }

  async signTransaction(request: SignTransactionRequest): Promise<SignTransactionResult> {
    const adapter = this.getAdapter();
    if (!adapter) throw createWalletError.notConnected();
    if (typeof adapter.signTransaction !== "function" && typeof adapter.signAndSubmit !== "function") {
      throw createWalletError.unsupportedMethod("signTransaction", adapter.metadata.name);
    }

    try {
      this.emit("signing", { adapterId: adapter.metadata.id, kind: "transaction" });
      const raw = typeof adapter.signTransaction === "function"
        ? await adapter.signTransaction(request)
        : await adapter.signAndSubmit!({ ...request, submit: false });
      const result = normalizeSignTransactionResult(raw);
      this.emit("signed", { adapterId: adapter.metadata.id, kind: "transaction", result });
      return result;
    } catch (error) {
      const normalized = normalizeWalletError(error);
      this.emit("rejected", { adapterId: adapter.metadata.id, kind: "transaction", error: normalized });
      throw normalized;
    }
  }

  emitAccountChanged(adapterId: string, account: WalletAccount): void {
    const previousAccount = this.activeSession?.account;
    if (this.activeSession?.adapterId === adapterId) {
      this.activeSession = {
        ...this.activeSession,
        account: {
          ...this.activeSession.account,
          ...account
        }
      };
      void this.saveSession(this.activeSession);
    }
    this.emit("accountChanged", { adapterId, account, previousAccount });
  }

  emitNetworkChanged(adapterId: string, network?: WalletNetwork): void {
    const previousNetwork = this.activeSession?.account.network;
    if (this.activeSession?.adapterId === adapterId) {
      this.activeSession = {
        ...this.activeSession,
        account: {
          ...this.activeSession.account,
          network
        }
      };
      void this.saveSession(this.activeSession);
    }
    this.emit("networkChanged", { adapterId, network, previousNetwork });
  }

  emitQr(adapterId: string, uri: string, deeplink?: string): void {
    this.emit("qr", { adapterId, uri, deeplink });
  }

  destroy(): void {
    void this.cancelPendingConnection();
    this.removeAllListeners();
  }

  private setSession(session: WalletSession): void {
    this.activeAdapterId = session.adapterId;
    this.activeSession = session;
  }

  private withWalletMetadata(session: WalletSession, adapter: WalletAdapter): WalletSession {
    return {
      ...session,
      wallet: session.wallet ?? adapter.metadata,
      account: {
        ...session.account,
        network: session.account.network ?? this.getNetwork()
      }
    };
  }

  private async enrichSession(session: WalletSession): Promise<WalletSession> {
    const account = await this.resolveActivationStatus(session.account);
    return {
      ...session,
      account
    };
  }

  private async resolveActivationStatus(account: WalletAccount): Promise<WalletAccount> {
    if (this.config.accountStatus?.enabled === false || account.activationStatus) return account;
    const rpcUrl = account.network?.httpRpcUrl ? getHttpRpcUrl(account.network) : undefined;
    if (!rpcUrl || typeof fetch !== "function") return account;

    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const controller = typeof AbortController !== "undefined" ? new AbortController() : undefined;
      if (controller) {
        timer = setTimeout(() => controller.abort(), this.config.accountStatus?.timeoutMs ?? DEFAULT_ACCOUNT_STATUS_TIMEOUT_MS);
      }
      const response = await fetch(rpcUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          method: "account_info",
          params: [{ account: account.address, ledger_index: "current" }]
        }),
        signal: controller?.signal
      });
      if (timer) clearTimeout(timer);
      const body = await response.json() as {
        result?: {
          account_data?: unknown;
          error?: string;
        };
      };
      if (body.result?.account_data) return { ...account, activationStatus: "active" };
      if (body.result?.error === "actNotFound") return { ...account, activationStatus: "unfunded" };
      return { ...account, activationStatus: "unknown" };
    } catch (error) {
      this.logger.debug("Account activation status lookup failed", error);
      return { ...account, activationStatus: "unknown" };
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  private requireAdapter(adapterId: string): WalletAdapter {
    const adapter = this.adapters.get(adapterId);
    if (!adapter) throw createWalletError.walletNotFound(adapterId);
    return adapter;
  }

  private requireActiveAdapter(method: keyof WalletAdapter): WalletAdapter {
    const adapter = this.getAdapter();
    if (!adapter) throw createWalletError.notConnected();
    if (typeof adapter[method] !== "function") throw createWalletError.unsupportedMethod(String(method), adapter.metadata.name);
    return adapter;
  }

  private async saveSession(session: WalletSession): Promise<void> {
    const envelope: StoredWalletSessionEnvelope = {
      version: WALLET_STORAGE_VERSION,
      session,
      updatedAt: Date.now()
    };
    await this.storage.setItem(SESSION_KEY, JSON.stringify(envelope));
  }

  private parseStoredSession(serialized: string): WalletSession | null {
    try {
      const parsed = JSON.parse(serialized) as Partial<StoredWalletSessionEnvelope> | WalletSession;
      if ("version" in parsed && "session" in parsed) {
        if (parsed.version !== WALLET_STORAGE_VERSION) return null;
        return this.isValidStoredSession(parsed.session) ? parsed.session : null;
      }
      if (this.isValidStoredSession(parsed)) {
        return parsed as WalletSession;
      }
      return null;
    } catch (error) {
      this.logger.warn("Failed to parse stored wallet session", error);
      return null;
    }
  }

  private isValidStoredSession(value: unknown): value is WalletSession {
    if (!value || typeof value !== "object") return false;
    const session = value as Partial<WalletSession>;
    return typeof session.adapterId === "string"
      && typeof session.connectedAt === "number"
      && Boolean(session.account)
      && typeof session.account === "object"
      && typeof (session.account as Partial<WalletAccount>).address === "string";
  }

  private async withTimeout<T>(promise: Promise<T> | undefined, timeoutMs: number): Promise<{ timedOut: boolean; value?: T }> {
    if (!promise) return { timedOut: false };
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<{ timedOut: true }>((resolve) => {
      timer = setTimeout(() => resolve({ timedOut: true }), timeoutMs);
    });
    try {
      return await Promise.race([
        promise.then((value) => ({ timedOut: false, value })),
        timeout
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  private normalizeConnectionError(adapter: WalletAdapter, error: unknown) {
    if (isWalletKitError(error)) return error;
    const message = error instanceof Error ? error.message : String(error);
    if (/reject|denied|cancelled|canceled|closed/i.test(message)) {
      return createWalletError.connectionRejected(adapter.metadata.name, error);
    }
    return createWalletError.connectionFailed(adapter.metadata.name, error);
  }
}

function normalizeSignTransactionResult(raw: unknown): SignTransactionResult {
  const txBlob = pickPath(raw, [
    "txBlob",
    "tx_blob",
    "result.txBlob",
    "result.tx_blob",
    "response.txBlob",
    "response.tx_blob",
    "raw.txBlob",
    "raw.tx_blob",
    "tx_json",
    "result.tx_json"
  ]);
  const signed = pickPath(raw, ["signed", "result.signed"]);
  const rejected = pickPath(raw, ["rejected", "result.rejected"]);
  return {
    txBlob: typeof txBlob === "string" ? txBlob : undefined,
    signed: typeof signed === "boolean" ? signed : Boolean(txBlob),
    rejected: typeof rejected === "boolean" ? rejected : undefined,
    raw
  };
}

