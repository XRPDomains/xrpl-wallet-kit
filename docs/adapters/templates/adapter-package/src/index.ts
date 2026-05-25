import { BaseWalletAdapter, createWalletError } from "@xrpl-wallet-kit/core";
import type {
  ConnectOptions,
  ConnectResult,
  SignAndSubmitRequest,
  SignMessageRequest,
  WalletCapabilities,
  WalletMetadata,
  WalletSession
} from "@xrpl-wallet-kit/core";

const MY_WALLET_ICON = "";

interface MyWalletProvider {
  connect(): Promise<string>;
  disconnect?: () => Promise<void>;
  signMessage?: (message: string) => Promise<{ signature?: string; raw?: unknown }>;
  signAndSubmit?: (txJson: Record<string, unknown>) => Promise<{ hash?: string; status?: string; raw?: unknown }>;
}

export interface MyWalletAdapterOptions {
  provider?: MyWalletProvider;
  icon?: string;
}

export class MyWalletAdapter extends BaseWalletAdapter {
  metadata: WalletMetadata;
  capabilities: WalletCapabilities = {
    connect: true,
    disconnect: true,
    signMessage: true,
    signAndSubmit: true,
    payments: true,
    nftOffers: true
  };

  constructor(private options: MyWalletAdapterOptions = {}) {
    super();
    this.metadata = {
      id: "mywallet",
      name: "My Wallet",
      type: "extension",
      group: "Extensions",
      icon: options.icon ?? MY_WALLET_ICON
    };
  }

  async isAvailable(): Promise<boolean> {
    return Boolean(this.getProvider());
  }

  async connect(options: ConnectOptions): Promise<ConnectResult> {
    const provider = this.requireProvider();
    const address = await provider.connect();
    const account = { address, network: options.network };
    const session: WalletSession = {
      adapterId: this.metadata.id,
      account,
      connectedAt: Date.now()
    };
    return { account, session };
  }

  async disconnect(): Promise<void> {
    try {
      await this.getProvider()?.disconnect?.();
    } finally {
      await this.runCleanup();
    }
  }

  async restoreSession(session: WalletSession): Promise<ConnectResult | null> {
    if (!await this.isAvailable()) return null;
    return { account: session.account, session };
  }

  async signMessage(request: SignMessageRequest) {
    const provider = this.requireProvider();
    if (!provider.signMessage) this.unsupported("signMessage");
    return provider.signMessage(request.message);
  }

  async signAndSubmit(request: SignAndSubmitRequest) {
    const provider = this.requireProvider();
    if (!provider.signAndSubmit) this.unsupported("signAndSubmit");
    return provider.signAndSubmit(request.txJson);
  }

  private getProvider(): MyWalletProvider | undefined {
    if (this.options.provider) return this.options.provider;
    if (typeof window === "undefined") return undefined;
    return (window as typeof window & { mywallet?: MyWalletProvider }).mywallet;
  }

  private requireProvider(): MyWalletProvider {
    const provider = this.getProvider();
    if (!provider) throw createWalletError.walletNotAvailable(this.metadata.name);
    return provider;
  }
}

export function createMyWalletAdapter(options?: MyWalletAdapterOptions) {
  return new MyWalletAdapter(options);
}
