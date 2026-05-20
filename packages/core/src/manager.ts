import { WalletEventEmitter } from "./events";
import { DEFAULT_XRPL_NETWORKS, resolveNetwork } from "./networks";
import { normalizeTxResult } from "./result";
import { MemoryWalletStorage } from "./storage";
import type { ConnectOptions, SignAndSubmitRequest, SignMessageRequest, WalletAccount, WalletAdapter, WalletAvailabilityMap, WalletManagerConfig, WalletNetwork, WalletSession, WalletStorage } from "./types";

const SESSION_KEY = "session";

export class WalletManager extends WalletEventEmitter {
  readonly adapters = new Map<string, WalletAdapter>();
  readonly networks: WalletNetwork[];
  readonly storage: WalletStorage;
  private activeSession: WalletSession | null = null;
  private activeAdapterId: string | null = null;

  constructor(private config: WalletManagerConfig) {
    super();
    this.networks = [...DEFAULT_XRPL_NETWORKS, ...(config.networks ?? [])];
    this.storage = config.storage ?? new MemoryWalletStorage();
    config.adapters?.forEach((adapter) => this.register(adapter));
  }

  register(adapter: WalletAdapter): this {
    this.adapters.set(adapter.metadata.id, adapter);
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
      } catch {
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

  getNetwork(id = this.config.network ?? "mainnet"): WalletNetwork {
    return resolveNetwork(this.networks, id);
  }

  async autoReconnect(): Promise<WalletSession | null> {
    if (!this.config.autoReconnect) return null;
    const serialized = await this.storage.getItem(SESSION_KEY);
    if (!serialized) return null;
    const session = JSON.parse(serialized) as WalletSession;
    const adapter = this.adapters.get(session.adapterId);
    if (!adapter?.restoreSession) return null;
    const restored = await adapter.restoreSession(session);
    if (!restored?.session) return null;
    const enrichedSession = this.withWalletMetadata(restored.session, adapter);
    this.setSession(enrichedSession);
    this.emit("session_restored", { adapterId: enrichedSession.adapterId, account: enrichedSession.account, session: enrichedSession });
    return enrichedSession;
  }

  async connect(adapterId: string, options: ConnectOptions = {}): Promise<WalletSession> {
    const adapter = this.requireAdapter(adapterId);
    const network = options.network ?? this.getNetwork();
    try {
      this.emit("connecting", { adapterId });
      const result = await adapter.connect({ ...options, network, walletId: adapterId });
      const session = this.withWalletMetadata(result.session ?? { adapterId, account: { ...result.account, network }, connectedAt: Date.now() }, adapter);
      this.setSession(session);
      await this.storage.setItem(SESSION_KEY, JSON.stringify(session));
      this.emit("connected", { adapterId, account: session.account, session });
      return session;
    } catch (error) {
      this.emit("error", { adapterId, error });
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    const adapterId = this.activeAdapterId ?? undefined;
    await this.getAdapter()?.disconnect?.();
    this.activeAdapterId = null;
    this.activeSession = null;
    await this.storage.removeItem(SESSION_KEY);
    this.emit("disconnected", { adapterId });
  }

  async signMessage(request: SignMessageRequest) {
    const adapter = this.requireActiveAdapter("signMessage");
    try {
      this.emit("signing", { adapterId: adapter.metadata.id, kind: "message" });
      const result = await adapter.signMessage!({ ...request, account: request.account ?? this.getAccount() ?? undefined });
      this.emit("signed", { adapterId: adapter.metadata.id, kind: "message", result });
      return result;
    } catch (error) {
      this.emit("rejected", { adapterId: adapter.metadata.id, kind: "message", error });
      throw error;
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
      this.emit("rejected", { adapterId: adapter.metadata.id, kind: "transaction", error });
      throw error;
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
      wallet: session.wallet ?? adapter.metadata
    };
  }

  private requireAdapter(adapterId: string): WalletAdapter {
    const adapter = this.adapters.get(adapterId);
    if (!adapter) throw new Error(`Wallet adapter is not registered: ${adapterId}`);
    return adapter;
  }

  private requireActiveAdapter(method: keyof WalletAdapter): WalletAdapter {
    const adapter = this.getAdapter();
    if (!adapter) throw new Error("No wallet is connected");
    if (typeof adapter[method] !== "function") throw new Error(`${method} is not supported by ${adapter.metadata.name}`);
    return adapter;
  }
}
