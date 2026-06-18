import type SignClient from "@walletconnect/sign-client";
import type { WalletConnectModal } from "@walletconnect/modal";
import type { SessionTypes, SignClientTypes } from "@walletconnect/types";
import { BaseWalletAdapter, createBrowserWalletStorage, normalizeTxResult, pickPath, utf8ToHex } from "@xrpl-wallet-kit/core";
import { WALLETCONNECT_ICON as WALLETCONNECT_PNG_ICON } from "./icons";
import { XRPL_WALLETCONNECT_WALLETS } from "./wallets";
import type { WalletConnectWalletConfig } from "./types";
import type {
  ConnectOptions,
  ConnectResult,
  SignAndSubmitRequest,
  SignMessageRequest,
  SignTransactionRequest,
  WalletAdapter,
  WalletCapabilities,
  WalletMetadata,
  WalletStorage,
  WalletSession,
  XrplNetwork
} from "@xrpl-wallet-kit/core";

export enum XRPLWalletConnectMethod {
  SIGN_TRANSACTION = "xrpl_signTransaction",
  SIGN_TRANSACTION_FOR = "xrpl_signTransactionFor",
  SIGN_MESSAGE = "xrpl_signMessage"
}

export interface WalletConnectAdapterOptions {
  id?: string;
  name?: string;
  icon?: string;
  projectId: string;
  signClient?: SignClient;
  metadata?: SignClientTypes.Metadata;
  deeplink?: (uri: string) => string;
  onQr?: (event: { adapterId: string; uri: string; deeplink?: string }) => void;
  useModal?: boolean;
  modalMode?: "mobile-only" | "always" | "never";
  themeMode?: "dark" | "light";
  signMessage?: boolean;
  signMessageDestination?: string;
  requestTimeoutMs?: number;
  signRequestTimeoutMs?: number;
  recoveryStorage?: WalletStorage;
  onDebug?: (event: WalletConnectDebugEvent) => void;
}

export type { WalletConnectWalletConfig } from "./types";

export interface WalletConnectDebugEvent {
  adapterId: string;
  step: string;
  mode?: "modal" | "custom";
  detail?: Record<string, unknown>;
}

export interface CreateWalletConnectAdaptersConfig extends Omit<WalletConnectAdapterOptions, "id" | "name" | "icon" | "deeplink" | "useModal" | "modalMode"> {
  mode?: "default" | "details";
  wallets?: "all" | string[];
  title?: string;
  icon?: string;
  useModal?: boolean;
  modalMode?: "mobile-only" | "always" | "never";
}

export const WALLETCONNECT_ICON = WALLETCONNECT_PNG_ICON;

const XRPL_NAMESPACE = "xrpl";
const USER_DISCONNECTED = { code: 6000, message: "User disconnected" };
const DEFAULT_REQUEST_TIMEOUT_MS = 120000;
const DEFAULT_SIGN_REQUEST_TIMEOUT_MS = 45000;
const PENDING_RECOVERY_TTL_MS = 180000;
const WALLETCONNECT_REQUEST_TIMEOUT_CODE = "WALLETCONNECT_REQUEST_TIMEOUT";

function isMobile(): boolean {
  if (typeof navigator === "undefined") return false;
  const userAgent = navigator.userAgent;
  const platform = navigator.platform;
  const maxTouchPoints = navigator.maxTouchPoints ?? 0;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent)
    || (platform === "MacIntel" && maxTouchPoints > 1)
    || (typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches);
}

function defaultMetadata(): SignClientTypes.Metadata {
  return {
    name: "XRPL Wallet Kit",
    description: "XRPL wallet connection",
    url: typeof window !== "undefined" ? window.location.origin : "https://xrpl.org",
    icons: ["https://xrpl.org/favicon.ico"]
  };
}

export class WalletConnectXrplAdapter extends BaseWalletAdapter {
  metadata: WalletMetadata;
  capabilities: WalletCapabilities;

  private client?: SignClient;
  private session?: SessionTypes.Struct;
  private activeNetwork?: XrplNetwork;
  private initializationPromise?: Promise<SignClient>;
  private pendingConnection?: { uri: string; approval: () => Promise<SessionTypes.Struct>; existingTopics: Set<string> };
  private connectPromise?: Promise<SessionTypes.Struct>;
  private pendingAbortController?: AbortController;
  private modal?: WalletConnectModal;
  private recoveryStorage: WalletStorage;

  constructor(private options: WalletConnectAdapterOptions) {
    super();
    if (!options.projectId) {
      throw new Error("WalletConnect projectId is required");
    }

    this.client = options.signClient;
    this.recoveryStorage = options.recoveryStorage ?? createBrowserWalletStorage("");
    this.capabilities = {
      connect: true,
      disconnect: true,
      signMessage: options.signMessage ?? true,
      signTransaction: true,
      signAndSubmit: true,
      qr: !(options.useModal && (options.modalMode ?? "mobile-only") === "always"),
      deeplink: true,
      nftOffers: true,
      payments: true
    };
    this.metadata = {
      id: options.id ?? "walletconnect",
      name: options.name ?? "WalletConnect",
      type: "walletconnect",
      group: "WalletConnect",
      icon: options.icon ?? WALLETCONNECT_ICON,
      walletConnect: { deeplink: options.deeplink }
    };
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async preInitialize(network?: XrplNetwork): Promise<void> {
    if (this.pendingConnection) return;

    try {
      const client = await this.getClient();
      const resolvedNetwork = this.requireNetwork(network);
      const existingTopics = this.getSessionTopics(client);
      const result = await client.connect({
        requiredNamespaces: this.createRequiredNamespaces(resolvedNetwork),
        optionalNamespaces: this.createOptionalNamespaces(resolvedNetwork)
      });

      if (!result.uri) {
        throw new Error("Failed to generate WalletConnect URI during pre-initialization");
      }

      this.pendingConnection = { uri: result.uri, approval: result.approval, existingTopics };
      this.options.onQr?.({
        adapterId: this.metadata.id,
        uri: result.uri,
        deeplink: this.options.deeplink?.(result.uri)
      });
    } catch {
      this.pendingConnection = undefined;
      this.initializationPromise = undefined;
    }
  }

  async connect(options: ConnectOptions) {
    const network = this.requireNetwork(options.network);
    this.activeNetwork = network;

    const client = await this.getClient();
    const shouldUseModal = this.shouldUseModal();

    if (!this.session) {
      if (!this.connectPromise) {
        await this.setPendingRecoveryMarker();
        this.pendingAbortController = new AbortController();
        const signal = options.signal
          ? this.combineSignals(options.signal, this.pendingAbortController.signal)
          : this.pendingAbortController.signal;
        this.connectPromise = (shouldUseModal
          ? this.connectWithModal(client, network, signal)
          : this.connectWithCustomQr(client, network, signal)
        ).finally(() => {
          this.connectPromise = undefined;
          this.pendingAbortController = undefined;
        });
      }
      this.session = await this.connectPromise;
    }
    this.clearPendingRecoveryMarker();

    const address = this.extractAddress(this.session, network);
    const account = { address, network, networkType: network.networkType };
    this.setupEventListeners();

    return {
      account,
      session: {
        adapterId: this.metadata.id,
        account,
        connectedAt: Date.now(),
        expiresAt: this.session.expiry ? this.session.expiry * 1000 : undefined,
        metadata: { topic: this.session.topic, walletConnectPeerName: this.getSessionPeerName(this.session) }
      } satisfies WalletSession,
      raw: this.session
    };
  }

  cancelPendingConnection(): void {
    this.pendingAbortController?.abort();
    this.pendingAbortController = undefined;
    this.pendingConnection = undefined;
    this.connectPromise = undefined;
    this.modal?.closeModal();
    this.removeWalletConnectModalElements();
    this.clearPendingRecoveryMarker();
  }


  async restoreSession(session: WalletSession) {
    const network = this.requireNetwork(session.account.network as XrplNetwork | undefined);
    const client = await this.getClient();
    const topic = typeof session.metadata?.topic === "string" ? session.metadata.topic : undefined;
    const restoredSession = this.findStoredWalletConnectSession(client, topic, network, session.account.address);
    if (!restoredSession) return null;
    if (restoredSession.expiry && restoredSession.expiry * 1000 <= Date.now()) return null;

    this.session = restoredSession;
    this.activeNetwork = network;
    this.setupEventListeners();
    const address = this.extractAddress(restoredSession, network);
    const account = { ...session.account, address, network, networkType: network.networkType };
    return {
      account,
      session: {
        ...session,
        account,
        expiresAt: restoredSession.expiry ? restoredSession.expiry * 1000 : session.expiresAt,
        metadata: { ...session.metadata, topic: restoredSession.topic, walletConnectPeerName: this.getSessionPeerName(restoredSession) }
      },
      raw: restoredSession
    };
  }

  async recoverSession(options: ConnectOptions): Promise<ConnectResult | null> {
    const network = this.requireNetwork(options.network);
    if (!await this.canRecoverSession()) return null;

    const client = await this.getClient();
    const recoveredSession = this.findLatestStoredWalletConnectSession(client, network);
    this.debug("recover_session_check", "modal", {
      sessions: client.session.getAll().length,
      recovered: Boolean(recoveredSession),
      network: network.id
    });
    if (!recoveredSession) return null;
    this.clearPendingRecoveryMarker();

    this.session = recoveredSession;
    this.activeNetwork = network;
    this.setupEventListeners();

    const address = this.extractAddress(recoveredSession, network);
    const account = { address, network, networkType: network.networkType };
    return {
      account,
      session: {
        adapterId: this.metadata.id,
        account,
        connectedAt: Date.now(),
        expiresAt: recoveredSession.expiry ? recoveredSession.expiry * 1000 : undefined,
        metadata: { topic: recoveredSession.topic, walletConnectPeerName: this.getSessionPeerName(recoveredSession), recoveredFrom: "walletconnect_signclient" }
      },
      raw: recoveredSession
    };
  }

  async canRecoverSession(): Promise<boolean> {
    return this.shouldRecoverWithoutStoredSession() && await this.hasPendingRecoveryMarker();
  }

  async disconnect(): Promise<void> {
    if (!this.client || !this.session) return;

    try {
      await this.client.disconnect({
        topic: this.session.topic,
        reason: USER_DISCONNECTED
      });
    } finally {
      this.cleanup();
    }
  }

  async signAndSubmit(request: SignAndSubmitRequest) {
    const network = this.requireNetwork(this.activeNetwork);
    await this.ensureReadySession(network);
    const result = await this.requestSignTransaction(network, this.sanitizeWalletConnectPayload(request.txJson), request.submit ?? true);

    return normalizeTxResult((result as { tx_json?: unknown }).tx_json ?? result);
  }

  async signTransaction(request: SignTransactionRequest) {
    const network = this.requireNetwork(this.activeNetwork);
    await this.ensureReadySession(network);
    const result = await this.requestSignOnlyTransaction(network, this.sanitizeWalletConnectPayload(request.txJson));
    const txBlob = await this.resolveTxBlobProof(result);

    return {
      txBlob,
      signed: true,
      raw: result
    };
  }

  async signMessage(request: SignMessageRequest) {
    if (!this.capabilities.signMessage) {
      throw new Error(`${this.metadata.name} does not support portable WalletConnect message signing`);
    }

    const network = this.requireNetwork(this.activeNetwork);
    await this.ensureReadySession(network, request.account?.address);
    const result = await this.signMessageWithPaymentTransaction(network, request);
    const txBlob = await this.resolveTxBlobProof(result);
    return {
      signatureKind: "signedTx" as const,
      proof: txBlob,
      txBlob,
      raw: result
    };
  }

  getSignMessageRequestPreview(request: SignMessageRequest) {
    const network = this.requireNetwork(this.activeNetwork);
    const method = this.sessionSupportsMethod(XRPLWalletConnectMethod.SIGN_MESSAGE)
      ? XRPLWalletConnectMethod.SIGN_MESSAGE
      : XRPLWalletConnectMethod.SIGN_TRANSACTION;
    const params = method === XRPLWalletConnectMethod.SIGN_MESSAGE
      ? {
        message: request.message,
        account: request.account?.address
      }
      : {
        tx_json: this.createSignMessagePaymentTx(request),
        submit: false
      };

    return {
      chainId: this.requireWalletConnectChainId(network),
      topic: this.session?.topic,
      request: {
        method,
        params
      }
    };
  }

  getDeepLinkURI(uri: string): string {
    return this.options.deeplink?.(uri) ?? uri;
  }


  private findStoredWalletConnectSession(client: SignClient, topic: string | undefined, network: XrplNetwork, address: string): SessionTypes.Struct | undefined {
    if (!this.hasSessionStore(client)) return undefined;
    if (topic) {
      try {
        const stored = client.session.get(topic);
        if (this.sessionMatchesWalletProfile(stored) && this.sessionHasNetworkAccount(stored, network, address)) return stored;
      } catch {
        // Fall back to address lookup below.
      }
    }

    const sessions = client.session.getAll();
    return sessions.find((storedSession) => {
      if (!this.sessionMatchesWalletProfile(storedSession)) return false;
      const accounts = storedSession.namespaces[XRPL_NAMESPACE]?.accounts ?? [];
      const chainId = this.requireWalletConnectChainId(network);
      return accounts.some((account) => account === `${chainId}:${address}` || account.endsWith(`:${address}`));
    });
  }

  private findLatestStoredWalletConnectSession(client: SignClient, network: XrplNetwork): SessionTypes.Struct | undefined {
    if (!this.hasSessionStore(client)) return undefined;
    const sessions = client.session.getAll()
      .filter((storedSession) => {
        if (storedSession.expiry && storedSession.expiry * 1000 <= Date.now()) return false;
        if (!this.sessionMatchesWalletProfile(storedSession)) return false;
        return this.sessionHasNetworkAccount(storedSession, network);
      })
      .sort((a, b) => (b.expiry ?? 0) - (a.expiry ?? 0));
    return sessions[0];
  }

  private findLatestStoredWalletConnectSessionForAddress(client: SignClient, network: XrplNetwork, address?: string): SessionTypes.Struct | undefined {
    if (!this.hasSessionStore(client)) return undefined;
    const sessions = client.session.getAll()
      .filter((storedSession) => {
        if (storedSession.expiry && storedSession.expiry * 1000 <= Date.now()) return false;
        if (!this.sessionMatchesWalletProfile(storedSession)) return false;
        return this.sessionHasNetworkAccount(storedSession, network, address);
      })
      .sort((a, b) => (b.expiry ?? 0) - (a.expiry ?? 0));
    return sessions[0];
  }

  private shouldRecoverWithoutStoredSession(): boolean {
    return this.metadata.type === "walletconnect";
  }

  private async getClient(): Promise<SignClient> {
    if (this.client) return this.client;
    if (!this.initializationPromise) {
      this.initializationPromise = import("@walletconnect/sign-client").then(({ default: SignClient }) => SignClient.init({
        projectId: this.options.projectId,
        metadata: this.options.metadata ?? defaultMetadata()
      }));
    }
    this.client = await this.initializationPromise;
    return this.client;
  }

  private async initializeModal(): Promise<WalletConnectModal> {
    if (this.modal) return this.modal;
    const { WalletConnectModal } = await import("@walletconnect/modal");
    this.modal = new WalletConnectModal({
      projectId: this.options.projectId,
      chains: ["xrpl:0", "xrpl:1", "xrpl:2"],
      themeMode: this.options.themeMode ?? "dark",
      themeVariables: {
        "--wcm-z-index": "2147483647"
      },
      enableExplorer: true
    });
    return this.modal;
  }

  private async connectWithModal(client: SignClient, network: XrplNetwork, signal?: AbortSignal): Promise<SessionTypes.Struct> {
    const modal = await this.initializeModal();
    let connection = this.pendingConnection;
    if (!connection) {
      const existingTopics = this.getSessionTopics(client);
      this.debug("connect_modal_start", "modal", { network: network.id, existingTopics: existingTopics.size, mobile: isMobile(), reusedPending: false });
      const result = await client.connect({
        requiredNamespaces: this.createRequiredNamespaces(network),
        optionalNamespaces: this.createOptionalNamespaces(network)
      });
      connection = { uri: result.uri ?? "", approval: result.approval, existingTopics };
    } else {
      this.debug("connect_modal_start", "modal", { network: network.id, existingTopics: connection.existingTopics.size, mobile: isMobile(), reusedPending: true });
    }
    this.pendingConnection = undefined;

    this.throwIfAborted(signal);
    if (!connection.uri) throw new Error("WalletConnect did not return a connection URI");
    let didOpen = false;
    let rejectModalClose: ((error: Error) => void) | undefined;
    const modalClosed = new Promise<never>((_, reject) => {
      rejectModalClose = reject;
    });
    const unsubscribe = modal.subscribeModal((state) => {
      if (state.open) {
        didOpen = true;
        this.debug("modal_open", "modal");
        return;
      }
      if (didOpen) {
        this.debug("modal_close", "modal");
        rejectModalClose?.(new Error("WalletConnect modal closed"));
      }
    });
    await modal.openModal({ uri: connection.uri });
    this.debug("modal_uri_ready", "modal", { uriLength: connection.uri.length });

    try {
      const approvalOrRecoveredSession = this.waitForApprovalOrRecoveredSession(client, network, connection.approval, connection.existingTopics, {
        rejectOnApprovalError: !isMobile(),
        pollIntervalMs: isMobile() ? 500 : 1000,
        mode: "modal",
        signal
      });

      if (isMobile()) {
        // On iOS/Safari and in-app browsers the WalletConnect modal can close when the
        // browser is backgrounded for a wallet deeplink. Keep listening for the session
        // when the page returns instead of treating modal close as cancellation.
        return await approvalOrRecoveredSession;
      }

      return await Promise.race([approvalOrRecoveredSession, modalClosed]);
    } finally {
      this.debug("connect_modal_cleanup", "modal");
      unsubscribe();
      modal.closeModal();
      this.removeWalletConnectModalElements();
    }
  }

  private async connectWithCustomQr(client: SignClient, network: XrplNetwork, signal?: AbortSignal): Promise<SessionTypes.Struct> {
    let connection = this.pendingConnection;

    if (!connection) {
      const existingTopics = this.getSessionTopics(client);
      this.debug("connect_custom_start", "custom", { network: network.id, existingTopics: existingTopics.size });
      const result = await client.connect({
        requiredNamespaces: this.createRequiredNamespaces(network),
        optionalNamespaces: this.createOptionalNamespaces(network)
      });
      this.throwIfAborted(signal);
      if (!result.uri) throw new Error("WalletConnect did not return a connection URI");
      connection = { uri: result.uri, approval: result.approval, existingTopics };
    }

    this.throwIfAborted(signal);
    this.pendingConnection = undefined;
    this.debug("custom_uri_ready", "custom", { uriLength: connection.uri.length });
    this.options.onQr?.({
      adapterId: this.metadata.id,
      uri: connection.uri,
      deeplink: this.options.deeplink?.(connection.uri)
    });

    return this.waitForApprovalOrRecoveredSession(client, network, connection.approval, connection.existingTopics, {
      rejectOnApprovalError: true,
      pollIntervalMs: 1000,
      mode: "custom",
      signal
    });
  }

  private waitForApprovalOrRecoveredSession(
    client: SignClient,
    network: XrplNetwork,
    approval: () => Promise<SessionTypes.Struct>,
    existingTopics: Set<string>,
    options: { rejectOnApprovalError: boolean; pollIntervalMs: number; mode: "modal" | "custom"; signal?: AbortSignal }
  ): Promise<SessionTypes.Struct> {
    return new Promise((resolve, reject) => {
      let settled = false;
      let timer: ReturnType<typeof setInterval> | undefined;
      let timeoutTimer: ReturnType<typeof setTimeout> | undefined;
      let checkCount = 0;

      const cleanup = () => {
        if (timer) clearInterval(timer);
        if (timeoutTimer) clearTimeout(timeoutTimer);
        if (typeof window !== "undefined") {
          window.removeEventListener("focus", check);
          window.removeEventListener("pageshow", check);
          document.removeEventListener("visibilitychange", check);
        }
      };
      const settle = (callback: () => void) => {
        if (settled) return;
        settled = true;
        cleanup();
        callback();
      };
      const abort = () => settle(() => reject(new Error("WalletConnect connection was cancelled")));
      const check = () => {
        if (options.signal?.aborted) {
          abort();
          return;
        }
        checkCount += 1;
        const sessions = client.session.getAll();
        const recovered = this.findNewWalletConnectSession(client, network, existingTopics);
        if (checkCount <= 12 || recovered) {
          const xrplAccounts = sessions
            .flatMap((session) => session.namespaces[XRPL_NAMESPACE]?.accounts ?? [])
            .filter((account) => account.startsWith(`${this.requireWalletConnectChainId(network)}:`));
          this.debug("session_poll", options.mode, {
            checkCount,
            sessions: sessions.length,
            topics: sessions.map((session) => session.topic).slice(-5),
            xrplAccounts: xrplAccounts.slice(-5),
            existingTopics: existingTopics.size,
            recovered: Boolean(recovered),
            visibilityState: typeof document !== "undefined" ? document.visibilityState : undefined
          });
        }
        if (recovered) {
          settle(() => {
            this.debug("session_recovered", options.mode, { topic: recovered.topic, expiry: recovered.expiry });
            resolve(recovered);
          });
        }
      };

      approval()
        .then((session) => settle(() => {
          this.debug("approval_resolved", options.mode, { topic: session.topic, expiry: session.expiry });
          resolve(session);
        }))
        .catch((error) => {
          this.debug("approval_rejected", options.mode, {
            message: error instanceof Error ? error.message : String(error),
            rejectOnApprovalError: options.rejectOnApprovalError
          });
          check();
          if (!settled) {
            if (!options.rejectOnApprovalError) return;
            setTimeout(() => {
              check();
              if (!settled) settle(() => reject(error));
            }, 1500);
          }
        });

      if (typeof window !== "undefined") {
        window.addEventListener("focus", check);
        window.addEventListener("pageshow", check);
        document.addEventListener("visibilitychange", check);
      }
      options.signal?.addEventListener("abort", abort, { once: true });
      timer = setInterval(check, options.pollIntervalMs);
      timeoutTimer = setTimeout(() => {
        check();
        if (!settled) {
          settle(() => {
            this.debug("connection_timeout", options.mode, { checkCount });
            reject(new Error("WalletConnect connection timed out. Please try again."));
          });
        }
      }, this.options.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS);
      check();
    });
  }

  private getSessionTopics(client: SignClient): Set<string> {
    return new Set(client.session.getAll().map((session) => session.topic));
  }

  private findNewWalletConnectSession(client: SignClient, network: XrplNetwork, existingTopics: Set<string>): SessionTypes.Struct | undefined {
    return client.session.getAll().find((storedSession) => {
      if (existingTopics.has(storedSession.topic)) return false;
      if (storedSession.expiry && storedSession.expiry * 1000 <= Date.now()) return false;
      return this.sessionHasNetworkAccount(storedSession, network);
    });
  }

  private debug(step: string, mode?: "modal" | "custom", detail?: Record<string, unknown>): void {
    this.options.onDebug?.({
      adapterId: this.metadata.id,
      step,
      mode,
      detail
    });
  }

  private throwIfAborted(signal?: AbortSignal): void {
    if (signal?.aborted) throw new Error("WalletConnect connection was cancelled");
  }

  private combineSignals(first: AbortSignal, second: AbortSignal): AbortSignal {
    const controller = new AbortController();
    const abort = () => controller.abort();
    if (first.aborted || second.aborted) {
      controller.abort();
      return controller.signal;
    }
    first.addEventListener("abort", abort, { once: true });
    second.addEventListener("abort", abort, { once: true });
    return controller.signal;
  }

  private sessionHasNetworkAccount(session: SessionTypes.Struct, network: XrplNetwork, address?: string): boolean {
    const accounts = session.namespaces[XRPL_NAMESPACE]?.accounts ?? [];
    const chainId = this.requireWalletConnectChainId(network);
    return accounts.some((account) => {
      if (!account.startsWith(`${chainId}:`)) return false;
      return !address || account === `${chainId}:${address}` || account.endsWith(`:${address}`);
    });
  }

  private sessionMatchesWalletProfile(session: SessionTypes.Struct): boolean {
    if (this.metadata.id === "walletconnect") return true;
    const peerName = this.normalizeWalletName(this.getSessionPeerName(session));
    if (!peerName) return true;
    const expectedName = this.normalizeWalletName(this.options.name ?? this.metadata.name);
    if (!expectedName) return true;
    return peerName === expectedName || peerName.includes(expectedName) || expectedName.includes(peerName);
  }

  private getSessionPeerName(session: SessionTypes.Struct): string | undefined {
    const peerSession = session as SessionTypes.Struct & { peer?: { metadata?: { name?: string } } };
    return peerSession.peer?.metadata?.name;
  }

  private normalizeWalletName(value?: string): string {
    return (value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "");
  }

  private createRequiredNamespaces(network: XrplNetwork) {
    const chainId = this.requireWalletConnectChainId(network);
    return {
      [XRPL_NAMESPACE]: {
        chains: [chainId],
        methods: [
          XRPLWalletConnectMethod.SIGN_TRANSACTION
        ],
        events: []
      }
    };
  }

  private createOptionalNamespaces(network: XrplNetwork) {
    const chainId = this.requireWalletConnectChainId(network);
    return {
      [XRPL_NAMESPACE]: {
        chains: [chainId],
        methods: [
          XRPLWalletConnectMethod.SIGN_TRANSACTION_FOR
        ],
        events: []
      }
    };
  }

  private async signMessageWithWalletConnectMethod(network: XrplNetwork, request: SignMessageRequest) {
    if (!this.client || !this.session) throw new Error("WalletConnect session not found");
    return this.withRequestTimeout(this.client.request({
      chainId: this.requireWalletConnectChainId(network),
      topic: this.session.topic,
      request: {
        method: XRPLWalletConnectMethod.SIGN_MESSAGE,
        params: {
          message: request.message,
          account: request.account?.address,
          address: request.account?.address,
          from: request.account?.address
        }
      }
    }), XRPLWalletConnectMethod.SIGN_MESSAGE, this.getSignOnlyRequestTimeoutMs());
  }

  private signatureResponsePaths(): string[] {
    return [
      "signature",
      "signedMessage",
      "signed_message",
      "result.signature",
      "result.signedMessage",
      "result.signed_message",
      "response.signature",
      "response.signedMessage",
      "response.signed_message",
      "response.data.signature",
      "response.data.signedMessage",
      "response.data.signed_message"
    ];
  }

  private publicKeyResponsePaths(): string[] {
    return [
      "publicKey",
      "public_key",
      "result.publicKey",
      "result.public_key",
      "response.publicKey",
      "response.public_key",
      "response.data.publicKey",
      "response.data.public_key"
    ];
  }

  private txBlobResponsePaths(): string[] {
    return [
      "tx_blob",
      "txBlob",
      "txJson",
      "tx_json",
      "hex",
      "signedTransaction",
      "signed_transaction",
      "result.tx_blob",
      "result.txBlob",
      "result.hex",
      "result.signedTransaction",
      "result.signed_transaction",
      "response.tx_blob",
      "response.txBlob",
      "response.hex",
      "response.signedTransaction",
      "response.signed_transaction",
      "response.data.tx_blob",
      "response.data.txBlob",
      "response.data.hex",
      "response.data.signedTransaction",
      "response.data.signed_transaction",
      "response.data.resp.tx_blob",
      "response.data.resp.txBlob",
      "response.data.resp.hex",
      "response.data.resp.signedTransaction",
      "response.data.resp.signed_transaction"
    ];
  }

  private pickString(source: unknown, paths: string[]): string | undefined {
    const value = pickPath(source, paths);
    return typeof value === "string" && value.trim() ? value : undefined;
  }

  private async resolveTxBlobProof(result: unknown): Promise<string | undefined> {
    const direct = this.pickString(result, this.txBlobResponsePaths());
    if (direct) return direct;

    const txJson = pickPath(result, [
      "tx_json",
      "txJson",
      "transaction",
      "result.tx_json",
      "result.txJson",
      "result.transaction",
      "response.tx_json",
      "response.txJson",
      "response.transaction",
      "response.data.tx_json",
      "response.data.txJson",
      "response.data.transaction",
      "response.data.resp.tx_json",
      "response.data.resp.txJson",
      "response.data.resp.transaction"
    ]);
    if (!txJson || typeof txJson !== "object") return undefined;
    if (!this.looksSignedTxJson(txJson)) return undefined;

    try {
      const { encode } = await import("xrpl");
      return encode(txJson as Parameters<typeof encode>[0]);
    } catch (error) {
      this.debug("encode_signed_tx_json_failed", "modal", {
        wallet: this.metadata.id,
        error: error instanceof Error ? error.message : String(error)
      });
      return undefined;
    }
  }

  private looksSignedTxJson(value: unknown): boolean {
    if (!value || typeof value !== "object") return false;
    const tx = value as Record<string, unknown>;
    return typeof tx.TransactionType === "string"
      && typeof tx.Account === "string"
      && typeof tx.SigningPubKey === "string"
      && typeof tx.TxnSignature === "string";
  }

  private async signMessageWithPaymentTransaction(network: XrplNetwork, request: SignMessageRequest) {
    return this.requestSignTransaction(network, this.createSignMessagePaymentTx(request), false);
  }

  private createSignMessagePaymentTx(request: SignMessageRequest) {
    const account = request.account?.address ?? this.extractAddress(this.requireSession(), this.requireNetwork(this.activeNetwork));
    const destination = this.options.signMessageDestination ?? account;
    return {
      TransactionType: "Payment",
      Account: account,
      Destination: destination,
      Amount: "1",
      Fee: "15",
      Memos: [{ Memo: { MemoData: utf8ToHex(request.message) } }]
    };
  }

  private sanitizeWalletConnectPayload(value: unknown): unknown {
    if (Array.isArray(value)) {
      return value
        .map((item) => this.sanitizeWalletConnectPayload(item))
        .filter((item) => item !== undefined);
    }
    if (!value || typeof value !== "object") return value;

    const output: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      if (item === undefined || item === null) continue;
      const sanitized = this.sanitizeWalletConnectPayload(item);
      if (sanitized !== undefined) output[key] = sanitized;
    }
    return output;
  }

  private async requestSignTransaction(network: XrplNetwork, txJson: unknown, submit: boolean) {
    if (!this.client || !this.session) throw new Error("WalletConnect session not found");
    const params: Record<string, unknown> = { tx_json: txJson };
    if (!submit) params.submit = false;
    return this.withRequestTimeout(this.client.request({
      chainId: this.requireWalletConnectChainId(network),
      topic: this.session.topic,
      request: {
        method: XRPLWalletConnectMethod.SIGN_TRANSACTION,
        params
      }
    }), XRPLWalletConnectMethod.SIGN_TRANSACTION, this.getTransactionRequestTimeoutMs(submit));
  }

  private async requestSignOnlyTransaction(network: XrplNetwork, txJson: unknown) {
    if (!this.client || !this.session) throw new Error("WalletConnect session not found");
    const method = this.sessionSupportsMethod(XRPLWalletConnectMethod.SIGN_TRANSACTION_FOR)
      ? XRPLWalletConnectMethod.SIGN_TRANSACTION_FOR
      : XRPLWalletConnectMethod.SIGN_TRANSACTION;
    return this.withRequestTimeout(this.client.request({
      chainId: this.requireWalletConnectChainId(network),
      topic: this.session.topic,
      request: {
        method,
        params: {
          tx_json: txJson,
          submit: false
        }
      }
    }), method, this.getSignOnlyRequestTimeoutMs());
  }

  private sessionSupportsMethod(method: XRPLWalletConnectMethod): boolean {
    const namespace = this.session?.namespaces[XRPL_NAMESPACE];
    return Boolean(namespace?.methods?.includes(method));
  }

  private isInvalidWalletConnectMethodError(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error);
    return /missing or invalid.*request\(\).*method|method.*not.*supported|unsupported.*method/i.test(message);
  }

  private requireSession(): SessionTypes.Struct {
    if (!this.session) throw new Error("WalletConnect session not found");
    return this.session;
  }

  private getSignOnlyRequestTimeoutMs(): number {
    return this.options.signRequestTimeoutMs ?? DEFAULT_SIGN_REQUEST_TIMEOUT_MS;
  }

  private getTransactionRequestTimeoutMs(submit: boolean): number {
    return submit
      ? this.options.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS
      : this.options.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
  }

  private async withRequestTimeout<T>(request: Promise<T>, method: XRPLWalletConnectMethod, timeoutMs: number): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    this.debug("request_start", "custom", {
      method,
      topic: this.session?.topic,
      wallet: this.metadata.id,
      timeoutMs
    });
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        this.debug("request_timeout", "custom", {
          method,
          topic: this.session?.topic,
          wallet: this.metadata.id,
          timeoutMs
        });
        const timeoutDetail = method === XRPLWalletConnectMethod.SIGN_TRANSACTION
          ? "The wallet may have submitted the transaction but did not return a response to the dApp."
          : "The wallet did not return a response to the dApp.";
        const error = new Error(`WalletConnect request timed out after ${timeoutMs}ms: ${method}. ${timeoutDetail}`);
        (error as Error & { code?: string }).code = WALLETCONNECT_REQUEST_TIMEOUT_CODE;
        reject(error);
      }, timeoutMs);
    });

    try {
      const result = await Promise.race([request, timeout]);
      this.debug("request_resolved", "custom", { method, wallet: this.metadata.id });
      return result;
    } catch (error) {
      this.debug("request_rejected", "custom", {
        method,
        wallet: this.metadata.id,
        message: error instanceof Error ? error.message : String(error)
      });
      if (this.isStaleWalletConnectRequestError(error)) {
        await this.handleStaleWalletConnectRequest(method, error);
      }
      throw error;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  private async handleStaleWalletConnectRequest(method: XRPLWalletConnectMethod, error: unknown): Promise<never> {
    const topic = this.session?.topic;
    this.debug("request_stale_session_cleanup", "custom", {
      method,
      wallet: this.metadata.id,
      topic,
      message: error instanceof Error ? error.message : String(error)
    });
    await this.clearStaleWalletConnectState(topic);
    throw new Error(`${this.metadata.name} WalletConnect session is stale. Please reconnect your wallet and try again.`);
  }

  private isStaleWalletConnectRequestError(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error);
    return /no matching key|proposal.*expired|proposal.*not found|pairing.*not found|session.*not found|missing.*key|keychain/i.test(message);
  }

  private async clearStaleWalletConnectState(topic?: string): Promise<void> {
    const client = this.client;
    if (client && topic) {
      try {
        await client.disconnect({ topic, reason: USER_DISCONNECTED });
      } catch {
        // Stale WalletConnect state often cannot be disconnected cleanly.
      }
    }
    await this.clearWalletConnectPairings();
    this.cleanup();
  }

  private async clearWalletConnectPairings(): Promise<void> {
    const pairing = (this.client as unknown as {
      core?: {
        pairing?: {
          getPairings?: () => Array<{ topic?: string }>;
          disconnect?: (params: { topic: string }) => Promise<void>;
        };
      };
    } | undefined)?.core?.pairing;
    if (!pairing?.getPairings || !pairing.disconnect) return;
    const pairings = pairing.getPairings();
    for (const item of pairings) {
      if (!item.topic) continue;
      try {
        await pairing.disconnect({ topic: item.topic });
      } catch {
        // Pairing cleanup is best-effort and should not mask the reconnect guidance.
      }
    }
  }

  private shouldUseModal(): boolean {
    if (!this.options.useModal || this.options.modalMode === "never") return false;
    const mode = this.options.modalMode ?? "mobile-only";
    return mode === "always" || (mode === "mobile-only" && isMobile());
  }

  private extractAddress(session: SessionTypes.Struct, network: XrplNetwork): string {
    const account = session.namespaces.xrpl?.accounts?.[0];
    if (!account) throw new Error("WalletConnect XRPL account not found in session");

    const parts = account.split(":");
    const chainId = this.requireWalletConnectChainId(network);
    return parts[2] ?? account.replace(`${chainId}:`, "");
  }

  private setupEventListeners(): void {
    if (!this.client) return;
    void this.runCleanup();
    const onSessionDelete = (event?: { topic?: string }) => {
      if (!event?.topic || event.topic === this.session?.topic) this.cleanup();
    };
    const onSessionExpire = (event?: { topic?: string }) => {
      if (!event?.topic || event.topic === this.session?.topic) this.cleanup();
    };
    const onSessionUpdate = (event?: { topic?: string; params?: { namespaces?: SessionTypes.Namespaces } }) => {
      if (!this.client || !event?.topic || event.topic !== this.session?.topic) return;
      try {
        this.session = this.client.session.get(event.topic);
        this.debug("session_update", "custom", { topic: event.topic });
      } catch {
        if (event.params?.namespaces && this.session) {
          this.session = { ...this.session, namespaces: event.params.namespaces };
          this.debug("session_update_snapshot", "custom", { topic: event.topic });
        }
      }
    };
    this.client.on("session_delete", onSessionDelete);
    this.client.on("session_expire", onSessionExpire);
    this.client.on("session_update", onSessionUpdate);
    this.addCleanup(() => {
      this.client?.off("session_delete", onSessionDelete);
      this.client?.off("session_expire", onSessionExpire);
      this.client?.off("session_update", onSessionUpdate);
    });
  }

  private async ensureReadySession(network: XrplNetwork, address?: string): Promise<void> {
    const client = await this.getClient();
    if (!this.hasSessionStore(client)) {
      if (this.session && this.sessionHasNetworkAccount(this.session, network, address)) {
        this.activeNetwork = network;
        return;
      }
      throw new Error("WalletConnect session not found");
    }
    const currentTopic = this.session?.topic;
    let refreshed: SessionTypes.Struct | undefined;
    if (currentTopic) {
      try {
        const stored = client.session.get(currentTopic);
        if (this.sessionHasNetworkAccount(stored, network, address)) refreshed = stored;
      } catch {
        refreshed = undefined;
      }
    }
    refreshed ??= this.findLatestStoredWalletConnectSessionForAddress(client, network, address);
    if (!refreshed) {
      this.debug("request_session_missing", "custom", {
        wallet: this.metadata.id,
        previousTopic: currentTopic,
        sessions: client.session.getAll().length
      });
      throw new Error("WalletConnect session not found");
    }
    if (refreshed.expiry && refreshed.expiry * 1000 <= Date.now()) {
      this.debug("request_session_expired", "custom", { wallet: this.metadata.id, topic: refreshed.topic });
      throw new Error("WalletConnect session expired");
    }
    if (this.isSessionPairingStale(refreshed)) {
      this.debug("request_session_stale_pairing", "custom", {
        wallet: this.metadata.id,
        topic: refreshed.topic,
        pairingTopic: refreshed.pairingTopic
      });
      this.session = refreshed;
      await this.handleStaleWalletConnectRequest(XRPLWalletConnectMethod.SIGN_TRANSACTION, new Error("WalletConnect session pairing not found"));
    }
    if (refreshed.topic !== this.session?.topic) {
      this.debug("request_session_refreshed", "custom", {
        wallet: this.metadata.id,
        previousTopic: currentTopic,
        topic: refreshed.topic
      });
    }
    this.session = refreshed;
    this.activeNetwork = network;
  }

  private hasSessionStore(client: SignClient): boolean {
    const session = (client as unknown as { session?: { getAll?: unknown; get?: unknown } }).session;
    return typeof session?.getAll === "function" && typeof session.get === "function";
  }

  private isSessionPairingStale(session: SessionTypes.Struct): boolean {
    const pairingTopic = session.pairingTopic;
    if (!pairingTopic) return false;
    const pairing = (this.client as unknown as {
      core?: {
        pairing?: {
          getPairings?: () => Array<{ topic?: string }>;
        };
      };
    } | undefined)?.core?.pairing;
    if (!pairing?.getPairings) return false;
    try {
      return !pairing.getPairings().some((item) => item.topic === pairingTopic);
    } catch {
      return false;
    }
  }

  private cleanup(): void {
    void this.runCleanup();
    this.modal?.closeModal();
    this.removeWalletConnectModalElements();
    this.modal = undefined;
    this.session = undefined;
    this.activeNetwork = undefined;
    this.pendingConnection = undefined;
    this.connectPromise = undefined;
    this.pendingAbortController = undefined;
    this.initializationPromise = undefined;
    this.clearPendingRecoveryMarker();
  }

  private getPendingRecoveryKey(): string {
    return `xwk.walletconnect.pending.${this.options.projectId}.${this.metadata.id}`;
  }

  private async setPendingRecoveryMarker(): Promise<void> {
    if (!this.shouldRecoverWithoutStoredSession()) return;
    try {
      await this.recoveryStorage.setItem(this.getPendingRecoveryKey(), String(Date.now()));
    } catch {
      // Storage can be restricted in embedded browsers.
    }
  }

  private async hasPendingRecoveryMarker(): Promise<boolean> {
    try {
      const value = await this.recoveryStorage.getItem(this.getPendingRecoveryKey());
      if (!value) return false;
      const timestamp = Number(value);
      if (!Number.isFinite(timestamp) || Date.now() - timestamp > PENDING_RECOVERY_TTL_MS) {
        this.clearPendingRecoveryMarker();
        return false;
      }
      return true;
    } catch {
      return false;
    }
  }

  private clearPendingRecoveryMarker(): void {
    try {
      void this.recoveryStorage.removeItem(this.getPendingRecoveryKey());
    } catch {
      // Storage can be restricted in embedded browsers.
    }
  }

  private requireNetwork(network?: XrplNetwork): XrplNetwork {
    if (!network) throw new Error("XRPL network is required for WalletConnect");
    return network;
  }

  private requireWalletConnectChainId(network: XrplNetwork): string {
    if (!network.walletConnectChainId) {
      throw new Error(`WalletConnect requires walletConnectChainId for network ${network.id}`);
    }
    return network.walletConnectChainId;
  }

  private removeWalletConnectModalElements(): void {
    if (typeof document === "undefined") return;
    window.setTimeout(() => {
      document.querySelectorAll("wcm-modal").forEach((element) => element.remove());
    }, 0);
  }
}

export function createWalletConnectMetadata(metadata: SignClientTypes.Metadata): SignClientTypes.Metadata {
  return {
    ...metadata,
    icons: [WALLETCONNECT_ICON]
  };
}

export function createWalletConnectAdapter(options: WalletConnectAdapterOptions) {
  return new WalletConnectXrplAdapter(options);
}

export function createWalletConnectAdapters(config: CreateWalletConnectAdaptersConfig): WalletAdapter[] {
  const mode = config.mode ?? "default";

  if (mode === "default") {
    return [
      createWalletConnectAdapter({
        ...config,
        id: "walletconnect",
        name: config.title ?? "WalletConnect",
        icon: config.icon ?? WALLETCONNECT_ICON,
        signMessage: config.signMessage ?? true,
        useModal: config.useModal ?? true,
        modalMode: config.modalMode ?? "always"
      })
    ];
  }

  const registry = config.wallets === "all" || !config.wallets
    ? XRPL_WALLETCONNECT_WALLETS
    : config.wallets
      .map((id) => XRPL_WALLETCONNECT_WALLETS.find((wallet) => wallet.id === id))
      .filter((wallet): wallet is WalletConnectWalletConfig => Boolean(wallet));

  return registry.map((wallet) => createWalletConnectAdapter({
    ...config,
    id: wallet.id,
    name: wallet.name,
    icon: wallet.icon,
    deeplink: wallet.deeplink,
    signMessage: config.signMessage ?? wallet.signMessage ?? false,
    useModal: config.useModal ?? wallet.useModal ?? false,
    modalMode: config.modalMode ?? (wallet.useModal ? "mobile-only" : "never")
  }));
}

export { BIFROST_ICON, BITGET_ICON, GIRIN_ICON, JOEY_ICON, STATICBIT_ICON } from "./icons";
export * from "./wallets";

