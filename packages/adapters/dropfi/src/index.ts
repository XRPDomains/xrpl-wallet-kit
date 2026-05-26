import { BaseWalletAdapter, normalizeTxResult } from "@xrpl-wallet-kit/core";
import type { ConnectOptions, SignAndSubmitRequest, SignMessageRequest, WalletCapabilities, WalletMetadata, WalletSession } from "@xrpl-wallet-kit/core";
export const DROPFI_ICON = "data:image/png;base64,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";


export interface DropFiProvider {
  isDropFi?: boolean;
  selectedAddress?: string;
  connectedAccounts?: string[];
  accounts?: string[];
  network?: string | { network?: string; networkId?: string; id?: string };
  endpoint?: string;
  isConnected?: () => boolean | Promise<boolean>;
  connect?: (data?: unknown) => Promise<boolean | string | DropFiState | { address?: string; selectedAddress?: string; connectedAccounts?: string[]; accounts?: string[] }>;
  disconnect?(address?: string): Promise<void>;
  initialize?(): Promise<DropFiState | null>;
  getAddress?: () => string | null | Promise<string | null>;
  getAccounts?: () => string[] | { accounts?: string[] } | Promise<string[] | { accounts?: string[] }>;
  signMessage?: (message: string) => Promise<string>;
  sendTransaction?: (tx: unknown) => Promise<string>;
}

export interface DropFiState {
  selectedAddress?: string;
  connectedAccounts?: string[];
  accounts?: string[];
  network?: string | { network?: string; networkId?: string; id?: string };
  endpoint?: string;
}

export interface DropFiAdapterOptions {
  provider?: DropFiProvider;
  icon?: string;
}

export class DropFiAdapter extends BaseWalletAdapter {
  metadata: WalletMetadata;
  capabilities: WalletCapabilities = { connect: true, disconnect: true, signMessage: true, signAndSubmit: true, payments: true, nftOffers: true };
  private activeAddress?: string;

  constructor(private options: DropFiAdapterOptions = {}) {
    super();
    this.metadata = {
      id: "dropfi",
      name: "DropFi",
      type: "extension",
      group: "Extensions",
      icon: options.icon ?? DROPFI_ICON
    };
  }

  isAvailable(): boolean {
    const provider = this.provider(false);
    return Boolean(provider && (provider.isDropFi || provider.connect || provider.getAddress || provider.selectedAddress || provider.connectedAccounts?.length || provider.accounts?.length));
  }

  async connect(options: ConnectOptions) {
    const provider = this.provider();
    const state = await this.initialize(provider);
    const connected = await this.resolveConnected(provider, state);
    if (!connected) throw new Error("DropFi connection was rejected");

    const address = await this.resolveAddress(provider, connected, state);
    if (!address) throw new Error("DropFi did not return an XRPL address");
    this.activeAddress = address;

    return { account: { address, network: options.network, networkType: options.network?.networkType }, raw: { connected, address } };
  }

  async restoreSession(session: WalletSession) {
    const provider = this.provider(false);
    if (!provider) return null;
    if (!this.isAvailable()) return null;
    if (typeof provider.isConnected === "function") {
      try {
        if (!await provider.isConnected()) return null;
      } catch {
        return null;
      }
    }

    const address = await this.resolvePassiveAddress(provider);
    if (!address || address !== session.account.address) return null;

    this.activeAddress = address;
    return {
      account: { ...session.account, address },
      session: { ...session, account: { ...session.account, address } },
      raw: { address }
    };
  }

  async disconnect(): Promise<void> {
    const provider = this.provider(false);
    if (!provider?.disconnect) {
      this.activeAddress = undefined;
      return;
    }

    const address = this.activeAddress ?? provider.selectedAddress ?? provider.connectedAccounts?.[0] ?? provider.accounts?.[0];
    try {
      await this.withTimeout(provider.disconnect(address), 1500);
    } finally {
      this.activeAddress = undefined;
    }
  }

  async signMessage(request: SignMessageRequest) {
    const provider = this.provider();
    if (!provider.signMessage) throw new Error("DropFi provider is missing signMessage()");
    const signature = await provider.signMessage(request.message);
    return { signature, raw: signature };
  }

  async signAndSubmit(request: SignAndSubmitRequest) {
    const provider = this.provider();
    if (!provider.sendTransaction) throw new Error("DropFi provider is missing sendTransaction()");
    return normalizeTxResult(await provider.sendTransaction(request.txJson));
  }

  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T | undefined> {
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

  private provider(required?: true): DropFiProvider;
  private provider(required: false): DropFiProvider | undefined;
  private provider(required = true): DropFiProvider | undefined {
    const provider = this.options.provider ?? (globalThis as unknown as { xrpl?: DropFiProvider }).xrpl;
    if (!provider && required) throw new Error("Please install DropFi Wallet");
    return provider;
  }

  private async initialize(provider: DropFiProvider): Promise<DropFiState | null> {
    if (!provider.initialize) return null;
    try {
      return await provider.initialize();
    } catch {
      return null;
    }
  }

  private async resolveAddress(
    provider: DropFiProvider,
    connected: boolean | string | DropFiState | { address?: string; selectedAddress?: string; connectedAccounts?: string[]; accounts?: string[] },
    state: DropFiState | null
  ): Promise<string | undefined> {
    if (typeof connected === "string") return connected;
    if (connected && typeof connected === "object") {
      const result = connected as DropFiState & { address?: string };
      if (result.address) return result.address;
      if (result.selectedAddress) return result.selectedAddress;
      if (result.connectedAccounts?.[0]) return result.connectedAccounts[0];
      if (result.accounts?.[0]) return result.accounts[0];
    }
    if (typeof provider.getAddress === "function") {
      const address = await provider.getAddress();
      if (address) return address;
    }
    if (typeof provider.getAccounts === "function") {
      const accounts = await provider.getAccounts();
      const first = Array.isArray(accounts) ? accounts[0] : accounts.accounts?.[0];
      if (first) return first;
    }

    return provider.selectedAddress
      ?? provider.connectedAccounts?.[0]
      ?? provider.accounts?.[0]
      ?? state?.selectedAddress
      ?? state?.connectedAccounts?.[0]
      ?? state?.accounts?.[0];
  }

  private async resolvePassiveAddress(provider: DropFiProvider): Promise<string | undefined> {
    if (typeof provider.getAddress === "function") {
      try {
        const address = await provider.getAddress();
        if (address) return address;
      } catch {
        return undefined;
      }
    }

    return provider.selectedAddress
      ?? provider.connectedAccounts?.[0]
      ?? provider.accounts?.[0];
  }

  private async resolveConnected(provider: DropFiProvider, state: DropFiState | null) {
    if (typeof provider.isConnected === "function" && await provider.isConnected()) return true;
    const existingAddress = await this.resolveAddress(provider, true, state);
    if (existingAddress) return true;
    if (typeof provider.connect === "function") return provider.connect();
    return false;
  }
}

export function createDropFiAdapter(options?: DropFiAdapterOptions) { return new DropFiAdapter(options); }

