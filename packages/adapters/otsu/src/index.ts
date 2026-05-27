import { BaseWalletAdapter, WALLET_ADAPTER_API_VERSION, createWalletError, normalizeTxResult } from "@xrpl-wallet-kit/core";
import type {
  ConnectOptions,
  ConnectResult,
  SignAndSubmitRequest,
  SignMessageRequest,
  SignTransactionRequest,
  WalletCapabilities,
  WalletMetadata,
  WalletSession
} from "@xrpl-wallet-kit/core";

/**
 * Placeholder icon (dark "O" on #0f0f23).
 * TODO: Replace with the official Otsu Wallet logo before publishing.
 * Obtain from: https://github.com/RomThpt/otsu-wallet (assets/ folder)
 * and convert to a data:image/png;base64 or data:image/svg+xml;base64 URL.
 */
const OTSU_ICON =
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA0MCA0MCI+PHJlY3Qgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiByeD0iOCIgZmlsbD0iIzBmMGYyMyIvPjx0ZXh0IHg9IjIwIiB5PSIyNyIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZm9udC1mYW1pbHk9InN5c3RlbS11aSxzYW5zLXNlcmlmIiBmb250LXNpemU9IjIyIiBmb250LXdlaWdodD0iNzAwIiBmaWxsPSIjMzhiZGY4Ij5PPC90ZXh0Pjwvc3ZnPg==";

/**
 * Otsu Wallet provider interface injected at window.xrpl by the MV3 extension.
 *
 * The extension injects this object via content script bridging.
 * dApps interact with the wallet through postMessage under the hood.
 */
export interface OtsuProvider {
  /** Identifies this provider as Otsu Wallet */
  isOtsu: true;

  /** Returns true when a dApp connection is already active */
  isConnected(): boolean;

  /**
   * Request a new dApp connection.
   * Opens an extension notification popup for the user to approve scopes.
   * Supported scopes: 'read', 'sign', 'submit', 'switchNetwork'
   */
  connect(params?: { scopes?: string[] }): Promise<{ address: string }>;

  /** Revoke the current dApp permission and close the session */
  disconnect(): Promise<void>;

  /** Return the address of the currently connected account */
  getAddress(): Promise<{ address: string }>;

  /**
   * Return the active network identifier.
   * Known values: 'mainnet' | 'testnet' | 'devnet'
   */
  getNetwork(): Promise<{ network: string }>;

  /** Sign a transaction without submitting it to the ledger */
  signTransaction(tx: Record<string, unknown>): Promise<{ tx_blob: string; hash: string }>;

  /** Sign and submit a transaction to the active network */
  signAndSubmit(tx: Record<string, unknown>): Promise<{ tx_blob: string; hash: string }>;

  /** Sign an arbitrary UTF-8 message */
  signMessage(message: string): Promise<{ signature: string }>;

  /** Register a provider-level event listener */
  on(event: string, callback: (data: unknown) => void): void;

  /** Remove a provider-level event listener */
  off(event: string, callback: (data: unknown) => void): void;
}

declare global {
  interface Window {
    xrpl?: OtsuProvider;
  }
}

export interface OtsuAdapterOptions {
  /** Override the injected provider (useful for testing) */
  provider?: OtsuProvider;

  /**
   * Permission scopes to request from Otsu during connect().
   *
   * Otsu requires all needed scopes to be declared upfront at connection time;
   * it does not support incremental scope elevation per operation. Therefore
   * the default includes 'sign' and 'submit' so that signing flows work without
   * a second popup.
   *
   * If your app only needs read access (e.g. address lookup), you can override
   * this to `["read"]` and Otsu will not request signing permissions.
   *
   * Default: ["read", "sign", "submit", "switchNetwork"]
   */
  scopes?: string[];
}

/**
 * XRPL Wallet Kit adapter for Otsu Wallet.
 *
 * Otsu is an MV3 browser extension wallet for XRPL networks (mainnet, testnet,
 * devnet). It provides granular dApp permission scopes, transaction simulation,
 * and risk scanning before user approval.
 *
 * The extension injects its provider at window.xrpl with isOtsu=true.
 *
 * @example
 * ```ts
 * import { createOtsuAdapter } from "@xrpl-wallet-kit/adapter-otsu";
 *
 * const kit = createWalletKit({
 *   adapters: [createOtsuAdapter()],
 *   // ...
 * });
 * ```
 */
export class OtsuAdapter extends BaseWalletAdapter {
  adapterApiVersion = WALLET_ADAPTER_API_VERSION;

  metadata: WalletMetadata = {
    id: "otsu",
    name: "Otsu Wallet",
    type: "extension",
    group: "Extensions",
    icon: OTSU_ICON,
    homepage: "https://github.com/RomThpt/otsu-wallet"
  };

  capabilities: WalletCapabilities = {
    connect: true,
    disconnect: true,
    signMessage: true,
    signTransaction: true,
    signAndSubmit: true
    // payments and nftOffers are intentionally omitted until confirmed with
    // live Otsu transaction tests. Enable them here once Payment and NFT
    // offer payloads have been validated end-to-end with the extension.
  };

  constructor(private options: OtsuAdapterOptions = {}) {
    super();
  }

  // Availability

  isAvailable(): boolean {
    return Boolean(this.getProvider(false)?.isOtsu);
  }

  // Connection

  async connect(options: ConnectOptions): Promise<ConnectResult> {
    if (options.signal?.aborted) {
      throw createWalletError.connectionRejected(this.metadata.name, new Error("Connection canceled before start"));
    }

    const provider = this.requireProvider();

    let response: { address: string };
    try {
      response = await provider.connect({
        scopes: this.options.scopes ?? ["read", "sign", "submit", "switchNetwork"]
      });
    } catch (error) {
      throw this.mapConnectError(error);
    }

    const { address } = response;
    if (!address) throw new Error("Otsu Wallet did not return an XRPL address");

    // Resolve networkType from the provider's active network
    const networkType = await this.resolveNetworkType(provider);

    return {
      account: {
        address,
        network: options.network,
        networkType: options.network?.networkType ?? networkType
      },
      raw: response
    };
  }

  async disconnect(): Promise<void> {
    try {
      await this.getProvider(false)?.disconnect();
    } finally {
      await this.runCleanup();
    }
  }

  async restoreSession(session: WalletSession): Promise<ConnectResult | null> {
    const provider = this.getProvider(false);
    if (!provider?.isOtsu) return null;

    // Only restore if the extension still reports an active connection
    if (!provider.isConnected()) return null;

    try {
      const { address } = await provider.getAddress();
      const restoredAddress = address ?? session.account.address;
      return {
        account: { ...session.account, address: restoredAddress },
        session: { ...session, account: { ...session.account, address: restoredAddress } },
        raw: { address }
      };
    } catch {
      // If getAddress fails the session cannot be safely restored
      return null;
    }
  }

  // Signing

  async signMessage(request: SignMessageRequest) {
    const provider = this.requireProvider();
    let result: { signature: string };
    try {
      result = await provider.signMessage(request.message);
    } catch (error) {
      throw this.mapSignError(error);
    }
    return { signature: result.signature, raw: result };
  }

  async signTransaction(request: SignTransactionRequest) {
    const provider = this.requireProvider();
    let result: { tx_blob: string; hash: string };
    try {
      result = await provider.signTransaction(request.txJson as Record<string, unknown>);
    } catch (error) {
      throw this.mapSignError(error);
    }
    // Expose both camelCase (txBlob) and snake_case (tx_blob) for compatibility
    return { txBlob: result.tx_blob, tx_blob: result.tx_blob, hash: result.hash, raw: result };
  }

  async signAndSubmit(request: SignAndSubmitRequest) {
    // When the caller explicitly opts out of network submission, use the
    // sign-only path so the transaction blob is returned without broadcasting.
    if (request.submit === false) {
      return this.signTransaction(request);
    }

    const provider = this.requireProvider();
    let raw: unknown;
    try {
      raw = await provider.signAndSubmit(request.txJson as Record<string, unknown>);
    } catch (error) {
      throw this.mapSignError(error);
    }
    return normalizeTxResult(raw);
  }

  // Private helpers

  private getProvider(required: true): OtsuProvider;
  private getProvider(required: false): OtsuProvider | undefined;
  private getProvider(required = true): OtsuProvider | undefined {
    const provider = this.options.provider ?? (typeof window !== "undefined" ? window.xrpl : undefined);
    if (required && (!provider || !provider.isOtsu)) {
      throw createWalletError.walletNotAvailable(this.metadata.name);
    }
    return provider?.isOtsu ? provider : undefined;
  }

  private requireProvider(): OtsuProvider {
    return this.getProvider(true);
  }

  /**
   * Query the provider's current network and return a normalized networkType
   * string ('MAINNET' | 'TESTNET' | 'DEVNET').
   * Falls back to 'MAINNET' when the query fails or the value is unrecognised.
   */
  private async resolveNetworkType(provider: OtsuProvider): Promise<string | undefined> {
    try {
      const { network } = await provider.getNetwork();
      const lower = (network ?? "").toLowerCase();
      if (lower === "mainnet" || lower.includes("main")) return "MAINNET";
      if (lower === "testnet" || lower.includes("test")) return "TESTNET";
      if (lower === "devnet" || lower.includes("dev")) return "DEVNET";
    } catch {
      // Non-fatal; caller falls back to options.network.
    }
    return undefined;
  }

  /**
   * Map a raw provider error thrown during connect() into a typed WalletError.
   */
  private mapConnectError(error: unknown): Error {
    const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
    if (message.includes("reject") || message.includes("denied") || message.includes("cancelled") || message.includes("canceled")) {
      return createWalletError.connectionRejected(this.metadata.name);
    }
    if (message.includes("not installed") || message.includes("not found")) {
      return createWalletError.walletNotAvailable(this.metadata.name);
    }
    return createWalletError.connectionFailed(
      this.metadata.name,
      error instanceof Error ? error : new Error(String(error))
    );
  }

  /**
   * Map a raw provider error thrown during sign operations into a typed WalletError.
   */
  private mapSignError(error: unknown): Error {
    const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
    if (message.includes("reject") || message.includes("denied") || message.includes("cancelled") || message.includes("canceled")) {
      return createWalletError.signRejected(error instanceof Error ? error : new Error(String(error)));
    }
    if (message.includes("timeout") || message.includes("timed out")) {
      return createWalletError.requestTimeout("Otsu Wallet: signing timed out. Please try again.", error);
    }
    return createWalletError.signFailed(
      error instanceof Error ? error : new Error(String(error))
    );
  }
}

export function createOtsuAdapter(options?: OtsuAdapterOptions): OtsuAdapter {
  return new OtsuAdapter(options);
}
