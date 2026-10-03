import { createWalletError, isWalletKitError, normalizeWalletError, WalletKitError, WalletKitErrorCode } from "./errors";
import { snapshotPreflightValue, validateTransactionPreflight } from "./preflight";
import { assertWalletRequestActive, WalletRequestTracker } from "./request";
import type { TransactionPreflightContext, TransactionPreflightReport } from "./types";
import { WalletEventEmitter } from "./events";
import { createWalletKitLogger } from "./logger";
import type { WalletKitLogger } from "./logger";
import { DEFAULT_XRPL_NETWORKS, createNetworkRegistry, getHttpRpcUrl } from "./networks";
import { normalizeSignTransactionResult, normalizeTxResult, pickPath } from "./result";
import { MemoryWalletStorage } from "./storage";
import { WalletTransactionStore } from "./tx-store";
import type { AddWalletTransactionRequest, AuthenticateRequest, AuthenticateResult, ConnectOptions, SignatureKind, SignAndSubmitRequest, SignMessageRequest, SignMessageResult, SignTransactionRequest, SignTransactionResult, StoredWalletSessionEnvelope, TransactionPayload, WalletAccount, WalletAdapter, WalletAvailabilityMap, WalletCapabilities, WalletCapabilityDetails, WalletManagerConfig, WalletNetwork, WalletNetworkId, WalletSession, WalletStorage, WalletTransaction } from "./types";

const SESSION_KEY = "session";
export const WALLET_STORAGE_VERSION = 1;
const RECOVER_SESSION_RETRY_DELAYS_MS = [0, 700, 1600, 3000];
const DEFAULT_AUTO_RECONNECT_RESTORE_TIMEOUT_MS = 3000;
const DEFAULT_PENDING_RETURN_RECOVERY_TIMEOUT_MS = 10000;
const DEFAULT_AVAILABILITY_CHECK_TIMEOUT_MS = 1000;
const DEFAULT_ACCOUNT_STATUS_TIMEOUT_MS = 2500;
const DEFAULT_AUTHENTICATE_EXPIRES_IN_SECONDS = 3600;
const DEFAULT_TX_CONFIRMATION_ATTEMPTS = 6;
const DEFAULT_TX_CONFIRMATION_INTERVAL_MS = 2500;
const DEFAULT_TX_CONFIRMATION_TIMEOUT_MS = 4000;

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
  private pendingConnectionRequestId?: string;
  private requestTracker = new WalletRequestTracker(request => {
    try { this.emit("request_changed", { request }); }
    catch (error) { this.logger.warn("Request observer failed", error); }
  });
  private lifecycleVersion = 0;
  private destroyed = false;
  private sessionMutation: Promise<void> = Promise.resolve();
  private autoReconnectPromise?: Promise<WalletSession | null>;
  private transactions = new Map<string, WalletTransaction>();
  private pendingConfirmations = new Map<string, AbortController>();
  private transactionStore?: WalletTransactionStore;

  constructor(private config: WalletManagerConfig) {
    super();
    this.networkRegistry = createNetworkRegistry([...DEFAULT_XRPL_NETWORKS, ...(config.networks ?? [])]);
    this.networks = this.networkRegistry.list();
    this.storage = config.storage ?? new MemoryWalletStorage();
    this.logger = createWalletKitLogger(config.logger);
    if (config.persistTransactions) {
      const persistOptions = typeof config.persistTransactions === "object" ? config.persistTransactions : {};
      this.transactionStore = new WalletTransactionStore({
        ...persistOptions,
        storage: persistOptions.storage ?? this.storage
      });
    }
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
        const availability = await this.withTimeout(Promise.resolve(adapter.isAvailable()), DEFAULT_AVAILABILITY_CHECK_TIMEOUT_MS);
        if (availability.timedOut) {
          this.logger.warn(`Availability check timed out for ${adapter.metadata.id}`);
          return [adapter.metadata.id, false] as const;
        }
        return [adapter.metadata.id, Boolean(availability.value)] as const;
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
        const availability = await this.withTimeout(Promise.resolve(adapter.isAvailable()), DEFAULT_AVAILABILITY_CHECK_TIMEOUT_MS);
        if (availability.timedOut) {
          this.logger.warn(`Availability check timed out for ${adapter.metadata.id}`);
          return null;
        }
        return availability.value ? adapter : null;
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

  getCapabilityDetails(adapterId?: string): WalletCapabilityDetails | undefined {
    return this.getCapabilities(adapterId)?.details;
  }

  can(capability: keyof WalletCapabilities, adapterId?: string): boolean {
    return Boolean(this.getCapabilities(adapterId)?.[capability]);
  }

  getNetwork(id = this.config.network ?? "mainnet"): WalletNetwork {
    return this.networkRegistry.resolve(id);
  }

  async switchNetwork(networkOrId: WalletNetwork | WalletNetworkId): Promise<WalletNetwork> {
    const adapter = this.requireActiveAdapter("switchNetwork");
    const network = typeof networkOrId === "string" ? this.getNetwork(networkOrId) : networkOrId;
    const supportedNetworks = adapter.capabilities.details?.supportedNetworks;
    if (supportedNetworks?.length && !supportedNetworks.includes(network.id)) {
      throw createWalletError.unsupportedMethod(`switchNetwork(${network.id})`, adapter.metadata.name);
    }

    const result = await adapter.switchNetwork!(network);
    const selectedNetwork = result?.network ?? network;
    if (selectedNetwork.id !== network.id) {
      throw createWalletError.networkMismatch(adapter.metadata.name, String(network.id), String(selectedNetwork.id));
    }
    this.emitNetworkChanged(adapter.metadata.id, selectedNetwork);
    await this.sessionMutation;
    return selectedNetwork;
  }

  async autoReconnect(): Promise<WalletSession | null> {
    if (this.destroyed) return null;
    if (!this.config.autoReconnect) return null;
    if (this.autoReconnectPromise) return this.autoReconnectPromise;
    const pending = this.runAutoReconnect(this.lifecycleVersion).finally(() => {
      if (this.autoReconnectPromise === pending) this.autoReconnectPromise = undefined;
    });
    this.autoReconnectPromise = pending;
    return this.autoReconnectPromise;
  }

  private async runAutoReconnect(version: number): Promise<WalletSession | null> {
    const serialized = await this.storage.getItem(SESSION_KEY);
    if (version !== this.lifecycleVersion) return null;
    if (!serialized) return this.recoverPendingReturnSession(version);
    const session = this.parseStoredSession(serialized);
    if (!session) {
      await this.mutateStoredSession(() => this.storage.removeItem(SESSION_KEY));
      if (version !== this.lifecycleVersion) return null;
      this.emit("session_expired", {});
      return null;
    }
    const adapter = this.adapters.get(session.adapterId);
    if (!adapter) {
      await this.mutateStoredSession(() => this.storage.removeItem(SESSION_KEY));
      if (version !== this.lifecycleVersion) return null;
      this.emit("session_expired", { adapterId: session.adapterId });
      return null;
    }
    try {
      if (adapter.restoreSession) {
        const restoredResult = await this.withTimeout(adapter.restoreSession(session), DEFAULT_AUTO_RECONNECT_RESTORE_TIMEOUT_MS);
        if (version !== this.lifecycleVersion) return null;
        if (restoredResult.timedOut) {
          await this.clearStoredSessionAsStale(session, "restore_timeout", version);
          if (version !== this.lifecycleVersion) return null;
          return null;
        }
        const restored = restoredResult.value;
        if (!restored?.session) {
          await this.clearStoredSessionAsStale(session, "restore_unavailable", version);
          if (version !== this.lifecycleVersion) return null;
          return null;
        }
        this.assertSessionNetwork(adapter, restored.session, this.getNetwork(), "restoreSession");
        const enrichedSession = await this.enrichSession(this.withWalletMetadata(restored.session, adapter));
        if (version !== this.lifecycleVersion) return null;
        this.setSession(enrichedSession);
        await this.loadPersistedTransactions(enrichedSession);
        if (version !== this.lifecycleVersion) return null;
        this.emit("session_restored", { adapterId: enrichedSession.adapterId, account: enrichedSession.account, session: enrichedSession });
        if (version !== this.lifecycleVersion) return null;
        this.emit("connected", { adapterId: enrichedSession.adapterId, account: enrichedSession.account, session: enrichedSession });
        return enrichedSession;
      }

      if (adapter.isAvailable) {
        const availability = await this.withTimeout(Promise.resolve(adapter.isAvailable()), DEFAULT_AUTO_RECONNECT_RESTORE_TIMEOUT_MS);
        if (version !== this.lifecycleVersion) return null;
        if (availability.timedOut) {
          await this.clearStoredSessionAsStale(session, "availability_timeout", version);
          if (version !== this.lifecycleVersion) return null;
          return null;
        }
        if (!availability.value) {
          await this.clearStoredSessionAsStale(session, "adapter_unavailable", version);
          if (version !== this.lifecycleVersion) return null;
          return null;
        }
      }

      if (session.expiresAt && session.expiresAt <= Date.now()) {
        await this.clearStoredSessionAsStale(session, "session_expired", version);
        if (version !== this.lifecycleVersion) return null;
        return null;
      }

      const enrichedSession = await this.enrichSession(this.withWalletMetadata(session, adapter));
      if (version !== this.lifecycleVersion) return null;
      this.assertSessionNetwork(adapter, enrichedSession, this.getNetwork(), "autoReconnect");
      this.setSession(enrichedSession);
      await this.loadPersistedTransactions(enrichedSession);
      if (version !== this.lifecycleVersion) return null;
      this.emit("session_restored", { adapterId: enrichedSession.adapterId, account: enrichedSession.account, session: enrichedSession, stale: true });
      if (version !== this.lifecycleVersion) return null;
      this.emit("connected", { adapterId: enrichedSession.adapterId, account: enrichedSession.account, session: enrichedSession });
      return enrichedSession;
    } catch (error) {
      if (version !== this.lifecycleVersion) return null;
      this.logger.warn("Auto reconnect failed", error);
      await this.mutateStoredSession(() => this.storage.removeItem(SESSION_KEY));
      if (version !== this.lifecycleVersion) return null;
      this.emit("session_expired", { adapterId: session.adapterId });
      return null;
    }
  }

  private async recoverPendingReturnSession(version: number): Promise<WalletSession | null> {
    const network = this.getNetwork();
    const adaptersWithRecovery = [...this.adapters.values()].filter((adapter) => adapter.recoverSession);
    const recoverableAdapters: WalletAdapter[] = [];
    for (const adapter of adaptersWithRecovery) {
      try {
        if (adapter.canRecoverSession) {
          const canRecover = await adapter.canRecoverSession({ network, walletId: adapter.metadata.id });
          if (version !== this.lifecycleVersion) return null;
          if (!canRecover) continue;
        }
        if (version !== this.lifecycleVersion) return null;
        recoverableAdapters.push(adapter);
      } catch (error) {
        if (version !== this.lifecycleVersion) return null;
        this.logger.warn(`Session recovery availability check failed for ${adapter.metadata.id}`, error);
      }
    }
    if (!recoverableAdapters.length) return null;

    const announcedAdapters = new Set<string>();

    const recoveryRetryDelaysMs = this.config.recoveryRetryDelaysMs ?? RECOVER_SESSION_RETRY_DELAYS_MS;
    const recoveryDeadline = Date.now() + DEFAULT_PENDING_RETURN_RECOVERY_TIMEOUT_MS;
    let timedOut = false;
    for (const delayMs of recoveryRetryDelaysMs) {
      const remainingBeforeDelay = recoveryDeadline - Date.now();
      if (remainingBeforeDelay <= 0) {
        timedOut = true;
        break;
      }
      if (delayMs > 0) await this.delay(Math.min(delayMs, remainingBeforeDelay));
      if (version !== this.lifecycleVersion) return null;
      for (const adapter of recoverableAdapters) {
        const remaining = recoveryDeadline - Date.now();
        if (remaining <= 0) {
          timedOut = true;
          break;
        }
        try {
          if (!announcedAdapters.has(adapter.metadata.id)) {
            announcedAdapters.add(adapter.metadata.id);
            this.emit("connecting", { adapterId: adapter.metadata.id, recovering: true });
          }
          const recovery = await this.withTimeout(adapter.recoverSession?.({ network, walletId: adapter.metadata.id }), remaining);
          if (version !== this.lifecycleVersion) return null;
          if (recovery.timedOut) {
            timedOut = true;
            this.logger.warn(`Session recovery timed out for ${adapter.metadata.id}`);
            break;
          }
          const recovered = recovery.value;
          if (!recovered?.session) continue;
          this.assertSessionNetwork(adapter, recovered.session, network, "recoverSession");
          const enrichedSession = await this.enrichSession(this.withWalletMetadata(recovered.session, adapter));
          if (version !== this.lifecycleVersion) return null;
          this.setSession(enrichedSession);
          await this.saveSession(enrichedSession);
          if (version !== this.lifecycleVersion) return null;
          await this.loadPersistedTransactions(enrichedSession);
          if (version !== this.lifecycleVersion) return null;
          this.emit("session_restored", { adapterId: enrichedSession.adapterId, account: enrichedSession.account, session: enrichedSession });
          if (version !== this.lifecycleVersion) return null;
          this.emit("connected", { adapterId: enrichedSession.adapterId, account: enrichedSession.account, session: enrichedSession });
          return enrichedSession;
        } catch (error) {
          if (version !== this.lifecycleVersion) return null;
          this.logger.warn(`Session recovery failed for ${adapter.metadata.id}`, error);
        }
      }
      if (timedOut) break;
    }

    recoverableAdapters.forEach((adapter) => {
      this.emit("session_stale", { adapterId: adapter.metadata.id, reason: timedOut ? "recover_timeout" : "recover_unavailable", attempts: recoveryRetryDelaysMs.length });
      void adapter.cancelPendingConnection?.();
    });
    return null;
  }

  private async clearStoredSessionAsStale(session: WalletSession, reason: string, version: number): Promise<void> {
    await this.mutateStoredSession(() => this.storage.removeItem(SESSION_KEY));
    if (version !== this.lifecycleVersion) return;
    this.emit("session_stale", { adapterId: session.adapterId, account: session.account, session, reason });
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  getPendingRequests() { return this.requestTracker.pending(); }
  getRequest(requestId: string) { return this.requestTracker.get(requestId); }
  cancelRequest(requestId: string): boolean { return this.requestTracker.cancel(requestId); }

  async connect(adapterId: string, options: ConnectOptions = {}): Promise<WalletSession> {
    if (this.destroyed) throw new WalletKitError(WalletKitErrorCode.REQUEST_CANCELLED, "Wallet manager was destroyed.");
    return this.requestTracker.run(adapterId, "connect", options, {}, control => {
      control.progress({ state: "opened" });
      assertWalletRequestActive(control.signal);
      return this.connectCore(adapterId, { ...options, signal: control.signal, requestId: control.requestId, onRequestProgress: control.progress });
    }, () => ({ state: "connected" }));
  }

  private async connectCore(adapterId: string, options: ConnectOptions): Promise<WalletSession> {
    this.invalidateRestoration();
    const adapter = this.requireAdapter(adapterId);
    const network = options.network ?? this.getNetwork();
    const controller = new AbortController();
    let candidate: WalletSession | undefined;
    let connected = false;
    const abortFromCaller = () => {
      controller.abort();
      if (this.pendingAbortController === controller) void this.cancelPendingConnection();
      if (candidate && !connected && this.activeSession === candidate) {
        this.activeSession = null; this.activeAdapterId = null;
        void this.mutateStoredSession(() => this.activeSession ? Promise.resolve() : this.storage.removeItem(SESSION_KEY))
          .catch(error => this.logger.warn("Cancelled connection persistence cleanup failed", error));
      }
    };
    options.signal?.addEventListener("abort", abortFromCaller, { once: true });
    if (options.signal?.aborted) controller.abort();
    const assertPending = () => {
      if (controller.signal.aborted || this.pendingAbortController !== controller) {
        throw new Error("Wallet connection was cancelled");
      }
    };
    try {
      await this.cancelPendingConnection();
      if (this.activeAdapterId && this.activeAdapterId !== adapterId) {
        await this.disconnectCore(options.requestId);
      }
      this.pendingAdapterId = adapterId;
      this.pendingAbortController = controller;
      this.pendingConnectionRequestId = options.requestId;
      this.emit("connecting", { adapterId });
      if (adapter.isAvailable && !await this.isAdapterAvailable(adapter)) {
        throw createWalletError.walletNotAvailable(adapter.metadata.name);
      }
      assertPending();
      const signal = controller.signal;
      const result = await adapter.connect({ ...options, network, walletId: adapterId, signal });
      assertPending();
      this.assertAccountNetwork(adapter, result.account, network, "connect");
      const session = await this.enrichSession(this.withWalletMetadata(result.session ?? { adapterId, account: { ...result.account, network }, connectedAt: Date.now() }, adapter));
      assertPending();
      candidate = session;
      this.setSession(session);
      await this.saveSession(session);
      assertPending();
      await this.loadPersistedTransactions(session);
      assertPending();
      connected = true;
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
      options.signal?.removeEventListener("abort", abortFromCaller);
      if (this.pendingAbortController === controller) {
        this.pendingAdapterId = null;
        this.pendingAbortController = undefined;
        this.pendingConnectionRequestId = undefined;
      }
    }
  }

  async cancelPendingConnection(exceptAdapterId?: string): Promise<void> {
    const pendingAdapterId = this.pendingAdapterId;
    if (!pendingAdapterId || pendingAdapterId === exceptAdapterId) return;
    const requestId = this.pendingConnectionRequestId;
    const controller = this.pendingAbortController;
    this.pendingAbortController = undefined;
    this.pendingConnectionRequestId = undefined;
    this.pendingAdapterId = null;
    controller?.abort();
    if (requestId) this.requestTracker.cancel(requestId);
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
    return this.disconnectCore();
  }

  private async disconnectCore(exceptRequestId?: string): Promise<void> {
    this.requestTracker.cancelAll(exceptRequestId);
    this.invalidateRestoration();
    this.cancelTransactionConfirmations();
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
      this.cancelTransactionConfirmations();
      this.transactions.clear();
      await this.mutateStoredSession(() => this.storage.removeItem(SESSION_KEY));
      this.emit("disconnected", { adapterId });
    }
  }

  async signMessage(request: SignMessageRequest) {
    if (this.destroyed) throw new WalletKitError(WalletKitErrorCode.REQUEST_CANCELLED, "Wallet manager was destroyed.");
    const adapter = this.requireActiveAdapter("signMessage");
    try {
      const account = request.account ?? this.getAccount() ?? undefined;
      const result = await this.requestTracker.run(adapter.metadata.id, "sign-message", request,
        { account: account?.address, networkId: account?.network?.id }, async control => {
          control.progress({ state: "opened" });
          this.emit("signing", { adapterId: adapter.metadata.id, kind: "message" });
          assertWalletRequestActive(control.signal);
          return this.normalizeSignMessageResult(adapter.metadata.id,
            await adapter.signMessage!({ ...request, account, signal: control.signal, requestId: control.requestId, onRequestProgress: control.progress }));
        }, () => ({ state: "signed" }));
      if (!this.destroyed) this.emit("signed", { adapterId: adapter.metadata.id, kind: "message", result });
      return result;
    } catch (error) {
      const normalized = normalizeWalletError(error);
      this.emit("rejected", { adapterId: adapter.metadata.id, kind: "message", error: normalized });
      throw normalized;
    }
  }

  async authenticate(request: AuthenticateRequest): Promise<AuthenticateResult> {
    const account = request.account ?? this.getAccount();
    if (!account) throw createWalletError.notConnected();

    const issuedAt = new Date();
    const expiresAt = new Date(issuedAt.getTime() + (request.expiresIn ?? DEFAULT_AUTHENTICATE_EXPIRES_IN_SECONDS) * 1000);
    const message = [
      request.statement,
      "",
      `Address: ${account.address}`,
      `Issued At: ${issuedAt.toISOString()}`,
      `Expires At: ${expiresAt.toISOString()}`
    ].join("\n");
    const result = await this.signMessage({ message, account, signal: request.signal, timeoutMs: request.timeoutMs,
      requestId: request.requestId, onRequestProgress: request.onRequestProgress });

    return {
      address: account.address,
      message,
      signatureKind: result.signatureKind,
      proof: result.proof ?? (result.signatureKind === "signature" ? result.signature : result.txBlob) ?? "",
      signature: result.signature,
      txBlob: result.txBlob,
      publicKey: result.publicKey,
      issuedAt: issuedAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
      statement: request.statement,
      raw: result.raw
    };
  }

  private normalizeSignMessageResult(adapterId: string, result: SignMessageResult): SignMessageResult {
    const normalized = (() => {
      if (result.signatureKind === "signature" || result.signatureKind === "signedTx") return result;

      const legacy = result as SignMessageResult & { signatureKind?: SignatureKind };
      const inferredKind: SignatureKind = legacy.txBlob ? "signedTx" : "signature";
      this.logger.warn(
        `Adapter "${adapterId}" returned SignMessageResult without signatureKind. ` +
        `Inferred "${inferredKind}" for backward compatibility; update the adapter before using auth verification.`
      );
      return { ...legacy, signatureKind: inferredKind };
    })();

    if (normalized.signatureKind === "signature" && !this.hasProofValue(normalized.signature)) {
      throw createWalletError.signRejected(new Error(`Adapter "${adapterId}" did not return a message signature.`));
    }
    if (normalized.signatureKind === "signedTx" && !this.hasProofValue(normalized.txBlob)) {
      throw createWalletError.signRejected(new Error(`Adapter "${adapterId}" did not return a signed transaction proof.`));
    }
    const proof = normalized.signatureKind === "signature" ? normalized.signature : normalized.txBlob;
    return { ...normalized, proof };
  }

  private hasProofValue(value: unknown): value is string {
    return typeof value === "string" && value.trim().length > 0;
  }

  async preflightTransaction(
    request: SignTransactionRequest | SignAndSubmitRequest,
    mode: TransactionPreflightContext["mode"] = "sign-only"
  ): Promise<TransactionPreflightReport> {
    return (await this.evaluatePreflight(request, mode)).report;
  }

  private async evaluatePreflight(request: SignTransactionRequest | SignAndSubmitRequest, mode: TransactionPreflightContext["mode"]) {
    const override = request.preflight;
    const enabled = override !== false && (override !== undefined || this.config.preflight !== undefined);
    const session = this.activeSession;
    const version = this.lifecycleVersion;
    const address = session?.account.address;
    const networkId = session?.account.network?.id;
    const assertCurrent = () => {
      if (enabled && (this.activeSession !== session || version !== this.lifecycleVersion
        || this.getAccount()?.address !== address || this.getAccount()?.network?.id !== networkId)) {
        throw new WalletKitError(WalletKitErrorCode.PREFLIGHT_FAILED, "Wallet session changed during preflight.", {
          details: { issues: [{ code: "SESSION_CHANGED", severity: "error", message: "Repeat preflight for the current account and network." }] }
        });
      }
    };
    if (!enabled) return { report: { enabled: false, allowed: true, issues: [] } as TransactionPreflightReport, txJson: request.txJson, assertCurrent };
    if (!session) throw createWalletError.notConnected();
    const policy = { ...this.config.preflight, ...(override || {}) };
    let context: TransactionPreflightContext;
    try {
      context = snapshotPreflightValue({ txJson: request.txJson as Record<string, unknown>, account: session.account, network: session.account.network ?? this.getNetwork(), mode });
    } catch (cause) {
      throw new WalletKitError(WalletKitErrorCode.PREFLIGHT_FAILED, "Transaction preflight input could not be copied.", { cause });
    }
    const report = await validateTransactionPreflight(context, policy);
    if (request.walletPayload !== undefined) {
      report.issues = [...report.issues, { code: "WALLET_PAYLOAD_NOT_VALIDATED", severity: "error", message: "Use txJson without walletPayload when preflight is enabled." }];
      report.allowed = false;
    }
    assertCurrent();
    return { report: snapshotPreflightValue(report), txJson: context.txJson as TransactionPayload, assertCurrent };
  }

  private async prepareTransaction<T extends SignTransactionRequest | SignAndSubmitRequest>(request: T, mode: TransactionPreflightContext["mode"]) {
    const { preflight, signal, timeoutMs, requestId, onRequestProgress, ...input } = request;
    const enabled = preflight !== false && (preflight !== undefined || this.config.preflight !== undefined);
    // Capture every provider field before awaiting application checks.
    let providerRequest = input;
    if (enabled) {
      try { providerRequest = structuredClone(input); }
      catch (cause) { throw new WalletKitError(WalletKitErrorCode.PREFLIGHT_FAILED, "Transaction input could not be copied.", { cause }); }
    }
    const result = await this.evaluatePreflight({ ...providerRequest, preflight }, mode);
    if (result.report.enabled) {
      this.emit("transaction_preflight", { adapterId: this.activeAdapterId!, mode, report: result.report });
      result.assertCurrent();
      if (!result.report.allowed) {
        throw new WalletKitError(WalletKitErrorCode.PREFLIGHT_FAILED, "Transaction was blocked by preflight policy.", {
          details: { issues: result.report.issues }
        });
      }
    }
    return {
      request: { ...providerRequest, signal, timeoutMs, requestId, onRequestProgress, txJson: result.report.enabled ? structuredClone(result.txJson) : result.txJson } as T,
      assertCurrent: result.assertCurrent
    };
  }

  private needsPreflight(request: SignTransactionRequest | SignAndSubmitRequest): boolean {
    return request.preflight !== false && (request.preflight !== undefined || this.config.preflight !== undefined);
  }

  async signAndSubmit<TTransaction extends TransactionPayload = TransactionPayload>(request: SignAndSubmitRequest<TTransaction>) {
    if (this.destroyed) throw new WalletKitError(WalletKitErrorCode.REQUEST_CANCELLED, "Wallet manager was destroyed.");
    const adapter = this.requireActiveAdapter("signAndSubmit");
    const submit = request.submit !== false;
    if (request.submit === false && typeof adapter.signTransaction !== "function"
      && !adapter.capabilities.details?.transactionModes?.includes("sign-only")) {
      throw createWalletError.unsupportedMethod("signTransaction", adapter.metadata.name);
    }
    try {
      const account = this.getAccount();
      const result = await this.requestTracker.run(adapter.metadata.id, submit ? "sign-and-submit" : "sign-only", request,
        { account: account?.address, networkId: account?.network?.id }, async control => {
          const controlled = { ...request, signal: control.signal, requestId: control.requestId, onRequestProgress: control.progress };
          const prepared = this.needsPreflight(controlled)
            ? await this.prepareTransaction(controlled, submit ? "sign-and-submit" : "sign-only")
            : { request: controlled, assertCurrent: () => undefined };
          assertWalletRequestActive(control.signal);
          control.progress({ state: "opened" });
          this.emit("signing", { adapterId: adapter.metadata.id, kind: "transaction" });
          prepared.assertCurrent(); assertWalletRequestActive(control.signal);
          return normalizeTxResult(await adapter.signAndSubmit!(prepared.request));
        }, result => ({ state: submit ? "submitted" : "signed", hash: result.hash }));
      if (this.destroyed) return result;
      this.emit("signed", { adapterId: adapter.metadata.id, kind: "transaction", result });
      if (result.hash && submit && !this.destroyed) {
        this.addTransaction({
          hash: result.hash,
          status: "submitted",
          adapterId: adapter.metadata.id,
          account: account ?? undefined,
          result
        });
      }
      return result;
    } catch (error) {
      const normalized = normalizeWalletError(error);
      this.emit("rejected", { adapterId: adapter.metadata.id, kind: "transaction", error: normalized });
      throw normalized;
    }
  }

  addTransaction(request: AddWalletTransactionRequest): WalletTransaction {
    const existing = this.transactions.get(request.hash);
    const status = request.status ?? existing?.status ?? "submitted";
    const transaction: WalletTransaction = {
      ...existing,
      hash: request.hash,
      status,
      adapterId: request.adapterId ?? existing?.adapterId ?? this.activeAdapterId ?? undefined,
      account: request.account ?? existing?.account ?? this.getAccount() ?? undefined,
      description: request.description ?? existing?.description,
      submittedAt: request.submittedAt ?? existing?.submittedAt ?? Date.now(),
      confirmedAt: request.confirmedAt ?? existing?.confirmedAt,
      failedAt: request.failedAt ?? existing?.failedAt,
      result: request.result ?? existing?.result,
      error: request.error ?? existing?.error,
      metadata: request.metadata ?? existing?.metadata
    };
    this.transactions.set(transaction.hash, transaction);
    void this.persistTransaction(transaction).catch((error) => {
      this.logger.debug(`Transaction persistence failed for ${transaction.hash}`, error);
    });

    if (status === "confirmed") {
      this.emit("tx_confirmed", { adapterId: transaction.adapterId, account: transaction.account, hash: transaction.hash, result: transaction.result, transaction });
    } else if (status === "failed") {
      this.emit("tx_failed", { adapterId: transaction.adapterId, account: transaction.account, hash: transaction.hash, error: transaction.error ?? new Error("Transaction failed"), transaction });
    } else if (status === "submitted") {
      this.emit("tx_submitted", { adapterId: transaction.adapterId, account: transaction.account, hash: transaction.hash, transaction });
      this.confirmTransaction(transaction);
    }

    return transaction;
  }

  getTransactions(): WalletTransaction[] {
    return [...this.transactions.values()];
  }

  async signTransaction<TTransaction extends TransactionPayload = TransactionPayload>(request: SignTransactionRequest<TTransaction>): Promise<SignTransactionResult> {
    if (this.destroyed) throw new WalletKitError(WalletKitErrorCode.REQUEST_CANCELLED, "Wallet manager was destroyed.");
    const adapter = this.getAdapter();
    if (!adapter) throw createWalletError.notConnected();
    const supportsSignOnlyFallback = typeof adapter.signAndSubmit === "function"
      && adapter.capabilities.details?.transactionModes?.includes("sign-only");
    if (typeof adapter.signTransaction !== "function" && !supportsSignOnlyFallback) {
      throw createWalletError.unsupportedMethod("signTransaction", adapter.metadata.name);
    }

    try {
      const account = this.getAccount();
      const result = await this.requestTracker.run(adapter.metadata.id, "sign-only", request,
        { account: account?.address, networkId: account?.network?.id }, async control => {
          const controlled = { ...request, signal: control.signal, requestId: control.requestId, onRequestProgress: control.progress };
          const prepared = this.needsPreflight(controlled)
            ? await this.prepareTransaction(controlled, "sign-only") : { request: controlled, assertCurrent: () => undefined };
          assertWalletRequestActive(control.signal);
          control.progress({ state: "opened" });
          this.emit("signing", { adapterId: adapter.metadata.id, kind: "transaction" });
          prepared.assertCurrent(); assertWalletRequestActive(control.signal);
          const raw = typeof adapter.signTransaction === "function" ? await adapter.signTransaction(prepared.request)
            : await adapter.signAndSubmit!({ ...prepared.request, submit: false });
          return normalizeSignTransactionResult(raw);
        }, () => ({ state: "signed" }));
      if (!this.destroyed) this.emit("signed", { adapterId: adapter.metadata.id, kind: "transaction", result });
      return result;
    } catch (error) {
      const normalized = normalizeWalletError(error);
      this.emit("rejected", { adapterId: adapter.metadata.id, kind: "transaction", error: normalized });
      throw normalized;
    }
  }

  emitAccountChanged(adapterId: string, account: WalletAccount): void {
    if (this.destroyed) return;
    if (this.activeSession?.adapterId === adapterId && this.activeSession.account.address !== account.address) this.requestTracker.cancelSigning();
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
      void this.loadPersistedTransactions(this.activeSession);
    }
    this.emit("accountChanged", { adapterId, account, previousAccount });
  }

  emitNetworkChanged(adapterId: string, network?: WalletNetwork): void {
    if (this.destroyed) return;
    if (this.activeSession?.adapterId === adapterId && this.activeSession.account.network?.id !== network?.id) this.requestTracker.cancelSigning();
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
      void this.loadPersistedTransactions(this.activeSession);
    }
    this.emit("networkChanged", { adapterId, network, previousNetwork });
  }

  emitQr(adapterId: string, uri: string, deeplink?: string): void {
    this.emit("qr", { adapterId, uri, deeplink });
  }

  destroy(): void {
    this.destroyed = true;
    this.requestTracker.cancelAll();
    this.invalidateRestoration();
    this.cancelTransactionConfirmations();
    void this.cancelPendingConnection();
    this.removeAllListeners();
  }

  private invalidateRestoration(): void {
    this.lifecycleVersion += 1;
    this.autoReconnectPromise = undefined;
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

  private confirmTransaction(transaction: WalletTransaction): void {
    if (this.config.transactionConfirmation?.enabled === false) return;
    if (this.pendingConfirmations.has(transaction.hash)) return;
    const rpcUrl = transaction.account?.network ? getHttpRpcUrl(transaction.account.network) : undefined;
    if (!rpcUrl || typeof fetch !== "function") return;

    const controller = typeof AbortController !== "undefined" ? new AbortController() : undefined;
    if (controller) this.pendingConfirmations.set(transaction.hash, controller);
    void this.runTransactionConfirmation(transaction, rpcUrl, controller).finally(() => {
      this.pendingConfirmations.delete(transaction.hash);
    });
  }

  private async runTransactionConfirmation(transaction: WalletTransaction, rpcUrl: string, controller?: AbortController): Promise<void> {
    const attempts = Math.max(1, this.config.transactionConfirmation?.attempts ?? DEFAULT_TX_CONFIRMATION_ATTEMPTS);
    const intervalMs = Math.max(0, this.config.transactionConfirmation?.intervalMs ?? DEFAULT_TX_CONFIRMATION_INTERVAL_MS);
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      if (controller?.signal.aborted) return;
      if (attempt > 0 && intervalMs > 0) await this.delay(intervalMs);
      if (controller?.signal.aborted) return;
      try {
        const result = await this.lookupTransaction(transaction.hash, rpcUrl, controller?.signal);
        if (controller?.signal.aborted) return;
        if (!result || !result.validated) continue;
        if (result.transactionResult === "tesSUCCESS") {
          this.addTransaction({
            ...transaction,
            status: "confirmed",
            confirmedAt: Date.now(),
            result: result.raw
          });
          return;
        }
        if (!result.transactionResult) continue;
        this.addTransaction({
          ...transaction,
          status: "failed",
          failedAt: Date.now(),
          result: result.raw,
          error: new Error(result.transactionResult ?? "Transaction failed")
        });
        return;
      } catch (error) {
        if (controller?.signal.aborted) return;
        this.logger.debug(`Transaction confirmation lookup failed for ${transaction.hash}`, error);
      }
    }
  }

  private async lookupTransaction(hash: string, rpcUrl: string, signal?: AbortSignal): Promise<{ validated: boolean; transactionResult?: string; raw: unknown } | null> {
    const response = await this.fetchJsonRpc(rpcUrl, {
      method: "tx",
      params: [{ transaction: hash, binary: false }]
    }, signal, this.config.transactionConfirmation?.timeoutMs ?? DEFAULT_TX_CONFIRMATION_TIMEOUT_MS);
    const result = response.result as Record<string, unknown> | undefined;
    if (!result || result.error === "txnNotFound") return null;
    const validated = result.validated === true;
    const meta = result.meta ?? result.metaData ?? result.metadata;
    const transactionResult = pickPath({ meta, result }, [
      "meta.TransactionResult",
      "meta.transaction_result",
      "metaData.TransactionResult",
      "metadata.TransactionResult",
      "result.meta.TransactionResult",
      "result.metaData.TransactionResult"
    ]);
    return {
      validated,
      transactionResult: typeof transactionResult === "string" ? transactionResult : undefined,
      raw: response
    };
  }

  private async loadPersistedTransactions(session: WalletSession): Promise<void> {
    if (!this.transactionStore) return;
    const address = session.account.address;
    if (!address) return;
    const transactions = await this.transactionStore.get(address, this.transactionNetworkId(session.account));
    if (this.activeSession !== session) return;
    this.transactions.clear();
    transactions.forEach((transaction) => this.transactions.set(transaction.hash, transaction));
    transactions.forEach((transaction) => {
      if (transaction.status === "submitted") this.confirmTransaction(transaction);
    });
  }

  private async persistTransaction(transaction: WalletTransaction): Promise<void> {
    if (!this.transactionStore) return;
    const account = transaction.account ?? this.getAccount() ?? undefined;
    if (!account?.address) return;
    await this.transactionStore.add(account.address, this.transactionNetworkId(account), {
      ...transaction,
      account
    });
  }

  private transactionNetworkId(account?: WalletAccount): string {
    return account?.network?.id ?? account?.network?.networkType ?? this.config.network ?? "mainnet";
  }

  private async fetchJsonRpc(rpcUrl: string, body: unknown, signal: AbortSignal | undefined, timeoutMs: number): Promise<Record<string, unknown>> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let timeoutController: AbortController | undefined;
    let requestSignal = signal;
    if (typeof AbortController !== "undefined" && timeoutMs > 0) {
      timeoutController = new AbortController();
      requestSignal = timeoutController.signal;
      if (signal) {
        signal.addEventListener("abort", () => timeoutController?.abort(), { once: true });
      }
      timer = setTimeout(() => timeoutController?.abort(), timeoutMs);
    }
    try {
      const response = await fetch(rpcUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
        signal: requestSignal
      });
      return await response.json() as Record<string, unknown>;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  private cancelTransactionConfirmations(): void {
    this.pendingConfirmations.forEach((controller) => controller.abort());
    this.pendingConfirmations.clear();
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

  private mutateStoredSession(operation: () => void | Promise<void>): Promise<void> {
    const pending = this.sessionMutation.catch(() => undefined).then(operation);
    this.sessionMutation = pending;
    return pending;
  }

  private async saveSession(session: WalletSession): Promise<void> {
    const envelope: StoredWalletSessionEnvelope = {
      version: WALLET_STORAGE_VERSION,
      session,
      updatedAt: Date.now()
    };
    await this.mutateStoredSession(() => this.storage.setItem(SESSION_KEY, JSON.stringify(envelope)));
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

  private async isAdapterAvailable(adapter: WalletAdapter): Promise<boolean> {
    if (!adapter.isAvailable) return true;
    const availability = await this.withTimeout(Promise.resolve(adapter.isAvailable()), DEFAULT_AVAILABILITY_CHECK_TIMEOUT_MS);
    if (availability.timedOut) {
      this.logger.warn(`Availability check timed out for ${adapter.metadata.id}`);
      return false;
    }
    return Boolean(availability.value);
  }

  private assertSessionNetwork(adapter: WalletAdapter, session: WalletSession, expected: WalletNetwork, source: string): void {
    this.assertAccountNetwork(adapter, session.account, expected, source);
  }

  private assertAccountNetwork(adapter: WalletAdapter, account: WalletAccount, expected: WalletNetwork, source: string): void {
    const actualNetwork = account.network;
    const actualId = actualNetwork?.id;
    const actualType = actualNetwork?.networkType ?? account.networkType;
    const expectedId = expected.id;
    const expectedType = expected.networkType;

    if (actualId && actualId !== expectedId) {
      throw createWalletError.networkMismatch(adapter.metadata.name, String(expectedId), String(actualId), new Error(`${source} returned a different network id`));
    }
    if (actualType && actualType !== expectedType) {
      throw createWalletError.networkMismatch(adapter.metadata.name, expectedType, actualType, new Error(`${source} returned a different network type`));
    }
  }

  private normalizeConnectionError(adapter: WalletAdapter, error: unknown) {
    if (isWalletKitError(error)) return error;
    const message = error instanceof Error ? error.message : String(error);
    if (/reject|denied|cancelled|canceled|closed/i.test(message)) {
      return createWalletError.connectionRejected(adapter.metadata.name, error);
    }
    if (/timeout|timed out/i.test(message)) {
      return createWalletError.requestTimeout(message, error);
    }
    return createWalletError.connectionFailed(adapter.metadata.name, error);
  }
}
