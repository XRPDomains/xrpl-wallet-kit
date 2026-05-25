import { createWalletError, isWalletKitError, normalizeWalletError } from "./errors";
import { WalletEventEmitter } from "./events";
import { createWalletKitLogger } from "./logger";
import type { WalletKitLogger } from "./logger";
import { DEFAULT_XRPL_NETWORKS, createNetworkRegistry } from "./networks";
import { normalizeTxResult } from "./result";
import { MemoryWalletStorage } from "./storage";
import type { ConnectOptions, SignAndSubmitRequest, SignMessageRequest, StoredWalletSessionEnvelope, WalletAccount, WalletAdapter, WalletAvailabilityMap, WalletCapabilities, WalletManagerConfig, WalletNetwork, WalletSession, WalletStorage } from "./types";

const SESSION_KEY = "session";
export const WALLET_STORAGE_VERSION = 1;

export class WalletManager extends WalletEventEmitter {
  readonly adapters = new Map<string, WalletAdapter>();
  readonly networks: WalletNetwork[];
  readonly networkRegistry: ReturnType<typeof createNetworkRegistry>;
  readonly storage: WalletStorage;
  readonly logger: WalletKitLogger;
  private activeSession: WalletSession | null = null;
  private activeAdapterId: string | null = null;

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
    const serialized = await this.storage.getItem(SESSION_KEY);
    if (!serialized) return null;
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
        const enrichedSession = this.withWalletMetadata(restored.session, adapter);
        this.setSession(enrichedSession);
        this.emit("session_restored", { adapterId: enrichedSession.adapterId, account: enrichedSession.account, session: enrichedSession });
        return enrichedSession;
      }

      if (adapter.isAvailable && !await adapter.isAvailable()) {
        this.emit("session_stale", { adapterId: session.adapterId, account: session.account, session, reason: "adapter_unavailable" });
        return null;
      }

      const enrichedSession = this.withWalletMetadata(session, adapter);
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

  async connect(adapterId: string, options: ConnectOptions = {}): Promise<WalletSession> {
    const adapter = this.requireAdapter(adapterId);
    const network = options.network ?? this.getNetwork();
    try {
      this.emit("connecting", { adapterId });
      if (this.activeAdapterId && this.activeAdapterId !== adapterId) {
        throw createWalletError.alreadyConnected(this.getAdapter(this.activeAdapterId)?.metadata.name ?? this.activeAdapterId);
      }
      if (adapter.isAvailable && !await adapter.isAvailable()) {
        throw createWalletError.walletNotAvailable(adapter.metadata.name);
      }
      const result = await adapter.connect({ ...options, network, walletId: adapterId });
      const session = this.withWalletMetadata(result.session ?? { adapterId, account: { ...result.account, network }, connectedAt: Date.now() }, adapter);
      this.setSession(session);
      await this.saveSession(session);
      this.emit("connected", { adapterId, account: session.account, session });
      return session;
    } catch (error) {
      const normalized = this.normalizeConnectionError(adapter, error);
      this.emit("error", { adapterId, error: normalized });
      throw normalized;
    }
  }

  async disconnect(): Promise<void> {
    const adapterId = this.activeAdapterId ?? undefined;
    try {
      await this.withTimeout(this.getAdapter()?.disconnect?.(), 2000);
    } catch (error) {
      this.logger.warn("Adapter disconnect failed", error);
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

  emitQr(adapterId: string, uri: string, deeplink?: string): void {
    this.emit("qr", { adapterId, uri, deeplink });
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
        return parsed.version === WALLET_STORAGE_VERSION ? parsed.session ?? null : null;
      }
      if ("adapterId" in parsed && "account" in parsed && "connectedAt" in parsed) {
        return parsed as WalletSession;
      }
      return null;
    } catch (error) {
      this.logger.warn("Failed to parse stored wallet session", error);
      return null;
    }
  }

  private async withTimeout<T>(promise: Promise<T> | undefined, timeoutMs: number): Promise<T | undefined> {
    if (!promise) return undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<undefined>((resolve) => {
      timer = setTimeout(() => resolve(undefined), timeoutMs);
    });
    try {
      return await Promise.race([promise, timeout]);
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

