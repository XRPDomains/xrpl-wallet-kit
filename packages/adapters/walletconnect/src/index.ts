import SignClient from "@walletconnect/sign-client";
import { WalletConnectModal } from "@walletconnect/modal";
import type { SessionTypes, SignClientTypes } from "@walletconnect/types";
import { BaseWalletAdapter, normalizeTxResult, pickPath } from "@xrpl-wallet-kit/core";
import { WALLETCONNECT_ICON } from "./icons";
import { XRPL_WALLETCONNECT_WALLETS } from "./wallets";
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
}

export interface WalletConnectWalletConfig {
  id: string;
  name: string;
  description?: string;
  group?: string;
  icon?: string;
  walletConnect?: { metadataName?: string };
  links?: { universal?: string; native?: string };
  qrMode?: "walletconnect" | "custom";
  useModal?: boolean;
  deeplink?: (uri: string) => string;
}

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
const XRPL_EVENTS = ["chainChanged", "accountsChanged"];
const USER_DISCONNECTED = { code: 6000, message: "User disconnected" };

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
  private pendingConnection?: { uri: string; approval: () => Promise<SessionTypes.Struct> };
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
      signMessage: true,
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
      const result = await client.connect({
        requiredNamespaces: this.createRequiredNamespaces(resolvedNetwork)
      });

      if (!result.uri) {
        throw new Error("Failed to generate WalletConnect URI during pre-initialization");
      }

      this.pendingConnection = { uri: result.uri, approval: result.approval };
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
    const result = await this.client.request({
      chainId: network.walletConnectChainId,
      topic: this.session.topic,
      request: {
        method: XRPLWalletConnectMethod.SIGN_TRANSACTION,
        params: {
          tx_json: request.txJson,
          autofill: true,
          submit: request.submit ?? true
        }
      }
    });

    return normalizeTxResult((result as { tx_json?: unknown }).tx_json ?? result);
  }

  async signMessage(request: SignMessageRequest) {
    if (!this.client || !this.session) {
      throw new Error("WalletConnect session not found");
    }

    const network = this.requireNetwork(this.activeNetwork);
    const result = await this.client.request({
      chainId: network.walletConnectChainId,
      topic: this.session.topic,
      request: {
        method: XRPLWalletConnectMethod.SIGN_MESSAGE,
        params: {
          message: request.message,
          account: request.account?.address
        }
      }
    });

    const signature = pickPath(result, ["signature", "signedMessage", "result.signature", "result.signedMessage", "response.signature", "response.signedMessage"]);
    return {
      signature: typeof signature === "string" ? signature : undefined,
      raw: result
    };
  }

  getDeepLinkURI(uri: string): string {
    return this.options.deeplink?.(uri) ?? uri;
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
      return await Promise.race([approval(), modalClosed]);
    } finally {
      unsubscribe();
      modal.closeModal();
      this.removeWalletConnectModalElements();
    }
  }

  private async connectWithCustomQr(client: SignClient, network: XrplNetwork): Promise<SessionTypes.Struct> {
    let connection = this.pendingConnection;

    if (!connection) {
      const result = await client.connect({
        requiredNamespaces: this.createRequiredNamespaces(network)
      });
      if (!result.uri) throw new Error("WalletConnect did not return a connection URI");
      connection = { uri: result.uri, approval: result.approval };
    }

    this.pendingConnection = undefined;
    this.options.onQr?.({
      adapterId: this.metadata.id,
      uri: connection.uri,
      deeplink: this.options.deeplink?.(connection.uri)
    });

    return connection.approval();
  }

  private createRequiredNamespaces(network: XrplNetwork) {
    return {
      [XRPL_NAMESPACE]: {
        chains: [network.walletConnectChainId],
        methods: [
          XRPLWalletConnectMethod.SIGN_TRANSACTION,
          XRPLWalletConnectMethod.SIGN_TRANSACTION_FOR,
          XRPLWalletConnectMethod.SIGN_MESSAGE
        ],
        events: XRPL_EVENTS
      }
    };
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
    this.client.on("session_delete", () => this.cleanup());
    this.client.on("session_expire", () => this.cleanup());
  }

  private cleanup(): void {
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
    useModal: config.useModal ?? wallet.useModal ?? false,
    modalMode: config.modalMode ?? (wallet.useModal ? "mobile-only" : "never")
  }));
}

export * from "./icons";
export * from "./wallets";

