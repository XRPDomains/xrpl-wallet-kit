import SignClient from "@walletconnect/sign-client";
import { WalletConnectModal } from "@walletconnect/modal";
import type { SessionTypes, SignClientTypes } from "@walletconnect/types";
import { BaseWalletAdapter, normalizeTxResult, pickPath } from "@xrpl-wallet-kit/core";
import { WALLETCONNECT_ICON } from "./icons";
import { XRPL_WALLETCONNECT_WALLETS } from "./wallets";
import type { WalletConnectWalletConfig } from "./types";
import type {
  ConnectOptions,
  SignAndSubmitRequest,
  SignMessageRequest,
  WalletAdapter,
  WalletCapabilities,
  WalletMetadata,
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
}

export type { WalletConnectWalletConfig } from "./types";

export interface CreateWalletConnectAdaptersConfig extends Omit<WalletConnectAdapterOptions, "id" | "name" | "icon" | "deeplink" | "useModal" | "modalMode"> {
  mode?: "default" | "details";
  wallets?: "all" | string[];
  title?: string;
  icon?: string;
  useModal?: boolean;
  modalMode?: "mobile-only" | "always" | "never";
}

export const WALLETCONNECT_LOGO = WALLETCONNECT_ICON;

const XRPL_NAMESPACE = "xrpl";
const USER_DISCONNECTED = { code: 6000, message: "User disconnected" };
const DEFAULT_REQUEST_TIMEOUT_MS = 120000;

function isMobile(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
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
  private modal?: WalletConnectModal;

  constructor(private options: WalletConnectAdapterOptions) {
    super();
    if (!options.projectId) {
      throw new Error("WalletConnect projectId is required");
    }

    this.client = options.signClient;
    this.capabilities = {
      connect: true,
      disconnect: true,
      signMessage: options.signMessage ?? true,
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
        requiredNamespaces: this.createRequiredNamespaces(resolvedNetwork)
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
      if (shouldUseModal) {
        this.session = await this.connectWithModal(client, network);
      } else {
        this.session = await this.connectWithCustomQr(client, network);
      }
    }

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
        metadata: { topic: this.session.topic }
      } satisfies WalletSession,
      raw: this.session
    };
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
        metadata: { ...session.metadata, topic: restoredSession.topic }
      },
      raw: restoredSession
    };
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
    if (!this.client || !this.session) {
      throw new Error("WalletConnect session not found");
    }

    const network = this.requireNetwork(this.activeNetwork);
    const result = await this.requestSignTransaction(network, request.txJson, request.submit ?? true);

    return normalizeTxResult((result as { tx_json?: unknown }).tx_json ?? result);
  }

  async signMessage(request: SignMessageRequest) {
    if (!this.client || !this.session) {
      throw new Error("WalletConnect session not found");
    }
    if (!this.capabilities.signMessage) {
      throw new Error(`${this.metadata.name} does not support portable WalletConnect message signing`);
    }

    const network = this.requireNetwork(this.activeNetwork);
    const shouldTrySignMessage = this.sessionSupportsMethod(XRPLWalletConnectMethod.SIGN_MESSAGE);
    const result = shouldTrySignMessage
      ? await this.signMessageWithWalletConnectMethod(network, request).catch((error) => {
        if (!this.isInvalidWalletConnectMethodError(error)) throw error;
        return this.signMessageWithPaymentTransaction(network, request);
      })
      : await this.signMessageWithPaymentTransaction(network, request);

    const signature = pickPath(result, ["signature", "signedMessage", "tx_blob", "txBlob", "result.signature", "result.signedMessage", "result.tx_blob", "response.signature", "response.signedMessage", "response.hex"]);
    return {
      signature: typeof signature === "string" ? signature : undefined,
      txBlob: typeof signature === "string" ? signature : undefined,
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
      chainId: network.walletConnectChainId,
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
    if (topic) {
      try {
        return client.session.get(topic);
      } catch {
        return undefined;
      }
    }

    const sessions = client.session.getAll();
    return sessions.find((storedSession) => {
      const accounts = storedSession.namespaces[XRPL_NAMESPACE]?.accounts ?? [];
      return accounts.some((account) => account === `${network.walletConnectChainId}:${address}` || account.endsWith(`:${address}`));
    });
  }
  private async getClient(): Promise<SignClient> {
    if (this.client) return this.client;
    if (!this.initializationPromise) {
      this.initializationPromise = SignClient.init({
        projectId: this.options.projectId,
        metadata: this.options.metadata ?? defaultMetadata()
      });
    }
    this.client = await this.initializationPromise;
    return this.client;
  }

  private async initializeModal(): Promise<WalletConnectModal> {
    if (this.modal) return this.modal;
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

  private async connectWithModal(client: SignClient, network: XrplNetwork): Promise<SessionTypes.Struct> {
    const modal = await this.initializeModal();
    const existingTopics = this.getSessionTopics(client);
    const { uri, approval } = await client.connect({
      requiredNamespaces: this.createRequiredNamespaces(network)
    });

    if (!uri) throw new Error("WalletConnect did not return a connection URI");
    let didOpen = false;
    let rejectModalClose: ((error: Error) => void) | undefined;
    const modalClosed = new Promise<never>((_, reject) => {
      rejectModalClose = reject;
    });
    const unsubscribe = modal.subscribeModal((state) => {
      if (state.open) {
        didOpen = true;
        return;
      }
      if (didOpen) {
        rejectModalClose?.(new Error("WalletConnect modal closed"));
      }
    });
    await modal.openModal({ uri });

    try {
      return await Promise.race([this.waitForApprovalOrRecoveredSession(client, network, approval, existingTopics), modalClosed]);
    } finally {
      unsubscribe();
      modal.closeModal();
      this.removeWalletConnectModalElements();
    }
  }

  private async connectWithCustomQr(client: SignClient, network: XrplNetwork): Promise<SessionTypes.Struct> {
    let connection = this.pendingConnection;

    if (!connection) {
      const existingTopics = this.getSessionTopics(client);
      const result = await client.connect({
        requiredNamespaces: this.createRequiredNamespaces(network)
      });
      if (!result.uri) throw new Error("WalletConnect did not return a connection URI");
      connection = { uri: result.uri, approval: result.approval, existingTopics };
    }

    this.pendingConnection = undefined;
    this.options.onQr?.({
      adapterId: this.metadata.id,
      uri: connection.uri,
      deeplink: this.options.deeplink?.(connection.uri)
    });

    return this.waitForApprovalOrRecoveredSession(client, network, connection.approval, connection.existingTopics);
  }

  private waitForApprovalOrRecoveredSession(
    client: SignClient,
    network: XrplNetwork,
    approval: () => Promise<SessionTypes.Struct>,
    existingTopics: Set<string>
  ): Promise<SessionTypes.Struct> {
    return new Promise((resolve, reject) => {
      let settled = false;
      let timer: ReturnType<typeof setInterval> | undefined;

      const cleanup = () => {
        if (timer) clearInterval(timer);
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
      const check = () => {
        const recovered = this.findNewWalletConnectSession(client, network, existingTopics);
        if (recovered) {
          settle(() => resolve(recovered));
        }
      };

      approval()
        .then((session) => settle(() => resolve(session)))
        .catch((error) => {
          check();
          if (!settled) {
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
      timer = setInterval(check, 1000);
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

  private sessionHasNetworkAccount(session: SessionTypes.Struct, network: XrplNetwork): boolean {
    const accounts = session.namespaces[XRPL_NAMESPACE]?.accounts ?? [];
    return accounts.some((account) => account.startsWith(`${network.walletConnectChainId}:`));
  }

  private createRequiredNamespaces(network: XrplNetwork) {
    return {
      [XRPL_NAMESPACE]: {
        chains: [network.walletConnectChainId],
        methods: [
          XRPLWalletConnectMethod.SIGN_TRANSACTION
        ],
        events: []
      }
    };
  }

  private async signMessageWithWalletConnectMethod(network: XrplNetwork, request: SignMessageRequest) {
    if (!this.client || !this.session) throw new Error("WalletConnect session not found");
    return this.withRequestTimeout(this.client.request({
      chainId: network.walletConnectChainId,
      topic: this.session.topic,
      request: {
        method: XRPLWalletConnectMethod.SIGN_MESSAGE,
        params: {
          message: request.message,
          account: request.account?.address
        }
      }
    }), XRPLWalletConnectMethod.SIGN_MESSAGE);
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
      Memos: [{ Memo: { MemoData: this.toHex(request.message) } }]
    };
  }

  private async requestSignTransaction(network: XrplNetwork, txJson: unknown, submit: boolean) {
    if (!this.client || !this.session) throw new Error("WalletConnect session not found");
    return this.withRequestTimeout(this.client.request({
      chainId: network.walletConnectChainId,
      topic: this.session.topic,
      request: {
        method: XRPLWalletConnectMethod.SIGN_TRANSACTION,
        params: {
          tx_json: txJson,
          ...(submit ? { autofill: true } : {}),
          submit
        }
      }
    }), XRPLWalletConnectMethod.SIGN_TRANSACTION);
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

  private toHex(value: string): string {
    const encoder = new TextEncoder();
    return [...encoder.encode(value)].map((byte) => byte.toString(16).padStart(2, "0")).join("").toUpperCase();
  }

  private async withRequestTimeout<T>(request: Promise<T>, method: XRPLWalletConnectMethod): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeoutMs = this.options.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        reject(new Error(`WalletConnect request timed out after ${timeoutMs}ms: ${method}. The wallet may have submitted the transaction but did not return a response to the dApp.`));
      }, timeoutMs);
    });

    try {
      return await Promise.race([request, timeout]);
    } finally {
      if (timer) clearTimeout(timer);
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
    return parts[2] ?? account.replace(`${network.walletConnectChainId}:`, "");
  }

  private setupEventListeners(): void {
    if (!this.client) return;
    void this.runCleanup();
    const onSessionDelete = () => this.cleanup();
    const onSessionExpire = () => this.cleanup();
    this.client.on("session_delete", onSessionDelete);
    this.client.on("session_expire", onSessionExpire);
    this.addCleanup(() => {
      this.client?.off("session_delete", onSessionDelete);
      this.client?.off("session_expire", onSessionExpire);
    });
  }

  private cleanup(): void {
    void this.runCleanup();
    this.modal?.closeModal();
    this.removeWalletConnectModalElements();
    this.modal = undefined;
    this.session = undefined;
    this.activeNetwork = undefined;
    this.pendingConnection = undefined;
    this.initializationPromise = undefined;
  }

  private requireNetwork(network?: XrplNetwork): XrplNetwork {
    if (!network) throw new Error("XRPL network is required for WalletConnect");
    return network;
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
    icons: [WALLETCONNECT_LOGO]
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
    signMessage: config.signMessage ?? wallet.signMessage ?? true,
    useModal: config.useModal ?? wallet.useModal ?? false,
    modalMode: config.modalMode ?? (wallet.useModal ? "mobile-only" : "never")
  }));
}

export * from "./icons";
export * from "./wallets";

