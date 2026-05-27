import { Xumm } from "xumm";
import { BaseWalletAdapter, createBrowserWalletStorage, normalizeTxResult } from "@xrpl-wallet-kit/core";
import type { ConnectOptions, ConnectResult, SignAndSubmitRequest, SignMessageRequest, WalletCapabilities, WalletMetadata, WalletSession, WalletStorage } from "@xrpl-wallet-kit/core";

export const XAMAN_ICON = "data:image/png;base64,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";

const XAMAN_PENDING_RECOVERY_TTL_MS = 180000;

export interface XamanPkceAuth {
  authorize(): Promise<XamanAuthResult | undefined | Error>;
  logout?: () => Promise<void> | void;
}

export interface XamanAuthResult {
  me?: { sub?: string; account?: string; networkType?: string; networkEndpoint?: string };
  sdk?: XamanSdkLike;
}

export interface XamanSdkLike {
  user?: {
    account?: Promise<string | undefined> | string;
    networkType?: Promise<string | undefined> | string;
    networkEndpoint?: Promise<string | undefined> | string;
  };
  state?: { account?: string; signedIn?: boolean };
  payload: {
    createAndSubscribe(payload: unknown, handler?: (event: unknown) => unknown): Promise<XamanPayloadSubscription>;
    get(uuid: string): Promise<XamanPayloadResult | null>;
  };
  logout?: () => Promise<void> | void;
}

export interface XamanPayloadSubscription {
  created: {
    uuid: string;
    pushed?: boolean;
    next?: { always?: string; no_push_msg_received?: string };
    refs?: { qr_png?: string; qr_matrix?: string; websocket_status?: string };
  };
  resolved?: Promise<unknown>;
}

export interface XamanPayloadResult {
  meta?: { signed?: boolean; cancelled?: boolean; expired?: boolean };
  response?: { hex?: string | null; txid?: string | null; account?: string | null };
}

export interface XamanPayloadEvent {
  signed?: boolean;
  expired?: boolean;
  cancelled?: boolean;
  opened?: boolean;
  payload_uuidv4?: string;
}

export interface XamanAdapterOptions {
  apiKey?: string;
  auth?: XamanPkceAuth;
  sdk?: XamanSdkLike;
  icon?: string;
  deeplink?: (uri: string) => string;
  onQr?: (event: { adapterId: string; uri: string; deeplink?: string; qrPng?: string }) => void;
  recoveryStorage?: WalletStorage;
}

export class XamanAdapter extends BaseWalletAdapter {
  metadata: WalletMetadata;
  capabilities: WalletCapabilities = { connect: true, signMessage: true, signAndSubmit: true, qr: true, deeplink: true, nftOffers: true, payments: true };
  private sdk?: XamanSdkLike;
  private auth?: XamanPkceAuth;
  private recoveryStorage: WalletStorage;

  constructor(private options: XamanAdapterOptions) {
    super();
    this.sdk = options.sdk;
    this.auth = options.auth;
    this.recoveryStorage = options.recoveryStorage ?? createBrowserWalletStorage("");
    this.metadata = {
      id: "xaman",
      name: "Xaman",
      type: "mobile",
      group: "Recommended",
      recommended: true,
      icon: options.icon ?? XAMAN_ICON
    };
  }

  async isAvailable(): Promise<boolean> {
    return Boolean(this.options.apiKey || this.auth || this.sdk);
  }

  async connect(options: ConnectOptions) {
    await this.setPendingRecoveryMarker();
    try {
      const result = await this.authorize();
      if (result instanceof Error) throw result;
      const connectResult = await this.createConnectResultFromAuth(result, options);
      this.clearPendingRecoveryMarker();
      return connectResult;
    } catch (error) {
      this.clearPendingRecoveryMarker();
      throw error;
    }
  }

  async restoreSession(session: WalletSession) {
    if (!this.sdk && this.options.apiKey) {
      this.sdk = new Xumm(this.options.apiKey) as unknown as XamanSdkLike;
      this.auth = this.sdk as unknown as XamanPkceAuth;
    }
    const state = await this.checkXamanState({ network: session.account.network });
    const account = state?.account?.address ? { ...session.account, ...state.account } : session.account;
    return { account, session: { ...session, account }, raw: state?.raw ?? null };
  }

  async canRecoverSession(): Promise<boolean> {
    return this.hasPendingRecoveryMarker();
  }

  async recoverSession(options: ConnectOptions): Promise<ConnectResult | null> {
    if (!await this.hasPendingRecoveryMarker()) return null;
    try {
      const result = await this.authorize();
      if (!result || result instanceof Error) {
        this.clearPendingRecoveryMarker();
        return null;
      }
      const connectResult = await this.createConnectResultFromAuth(result, options);
      this.clearPendingRecoveryMarker();
      return connectResult;
    } catch {
      this.clearPendingRecoveryMarker();
      return null;
    }
  }

  cancelPendingConnection(): void {
    this.clearPendingRecoveryMarker();
  }

  async disconnect(): Promise<void> {
    try {
      const logoutTargets = [this.sdk, this.auth].filter(
        (target, index, targets): target is XamanSdkLike | XamanPkceAuth => Boolean(target) && targets.indexOf(target) === index
      );

      for (const target of logoutTargets) {
        await target.logout?.();
      }
    } finally {
      this.clearPendingRecoveryMarker();
      this.clearPkceStorage();
      this.sdk = undefined;
      this.auth = this.options.auth;
      await this.runCleanup();
    }
  }

  async signMessage(request: SignMessageRequest) {
    const payload = {
      txjson: {
        TransactionType: "SignIn",
        Memos: [{ Memo: { MemoData: this.toHex(request.message) } }]
      },
      options: { submit: false }
    };

    const result = await this.createAndResolvePayload(payload);
    if (!result?.meta?.signed) return { raw: result };

    return { signature: result.response?.hex ?? undefined, txBlob: result.response?.hex ?? undefined, raw: result };
  }

  async signAndSubmit(request: SignAndSubmitRequest) {
    const result = await this.createAndResolvePayload({
      txjson: request.txJson,
      options: { submit: request.submit ?? true }
    });

    return normalizeTxResult({
      hash: result?.response?.txid ?? undefined,
      signed: result?.meta?.signed,
      rejected: result?.meta?.cancelled,
      raw: result
    });
  }

  async checkXamanState(options: ConnectOptions = {}) {
    if (!this.sdk?.state?.signedIn && !this.sdk?.state?.account) return null;
    const accountAddress = await this.resolveSdkValue(this.sdk.user?.account) ?? this.sdk.state.account;
    if (!accountAddress) return null;
    return {
      account: {
        address: accountAddress,
        network: options.network,
        networkType: await this.resolveSdkValue(this.sdk.user?.networkType)
      },
      raw: this.sdk.state
    };
  }

  private requireSdk(): XamanSdkLike {
    if (!this.sdk) throw new Error("Xaman SDK is not available. Connect Xaman first.");
    return this.sdk;
  }

  private async authorize(): Promise<XamanAuthResult | Error> {
    if (!this.auth) {
      if (!this.options.apiKey) throw new Error("Xaman apiKey is required when auth is not injected");
      this.sdk = new Xumm(this.options.apiKey) as unknown as XamanSdkLike;
      this.auth = this.sdk as unknown as XamanPkceAuth;
    }

    const result = await this.auth.authorize();
    if (!result) throw new Error("Xaman authorization was cancelled");
    return result;
  }

  private async createConnectResultFromAuth(result: XamanAuthResult, options: ConnectOptions): Promise<ConnectResult> {
    this.sdk = result.sdk ?? this.sdk;
    const accountAddress = result.me?.sub ?? result.me?.account ?? await this.resolveSdkValue(this.sdk?.user?.account) ?? this.sdk?.state?.account;
    if (!accountAddress) throw new Error("Xaman did not return an XRPL account");

    const networkType = result.me?.networkType ?? await this.resolveSdkValue(this.sdk?.user?.networkType);
    const account = { address: accountAddress, network: options.network, networkType };

    return {
      account,
      session: {
        adapterId: this.metadata.id,
        account,
        connectedAt: Date.now(),
        metadata: { networkEndpoint: result.me?.networkEndpoint ?? await this.resolveSdkValue(this.sdk?.user?.networkEndpoint) }
      } satisfies WalletSession,
      raw: result
    };
  }

  private async createAndResolvePayload(payload: unknown): Promise<XamanPayloadResult | null> {
    const sdk = this.requireSdk();
    const subscription = await sdk.payload.createAndSubscribe(payload, (event) => {
      const payloadEvent = this.resolvePayloadEvent(event);
      if (
        typeof payloadEvent.signed === "boolean"
        || payloadEvent.expired
        || payloadEvent.cancelled
      ) {
        return payloadEvent;
      }
      return undefined;
    });

    this.emitPayloadQr(subscription.created);
    await subscription.resolved;

    const result = await sdk.payload.get(subscription.created.uuid);
    if (result?.meta?.cancelled || result?.meta?.expired) {
      throw new Error("Xaman request was rejected or expired");
    }
    return result;
  }

  private resolvePayloadEvent(event: unknown): XamanPayloadEvent {
    const eventWithData = event as { data?: XamanPayloadEvent };
    return eventWithData.data ?? event as XamanPayloadEvent;
  }

  private emitPayloadQr(created: XamanPayloadSubscription["created"]): void {
    const uri = created.next?.always ?? created.refs?.qr_png;
    if (!uri) return;
    this.options.onQr?.({
      adapterId: this.metadata.id,
      uri,
      deeplink: this.options.deeplink?.(uri) ?? created.next?.always,
      qrPng: created.refs?.qr_png
    });
  }

  private async resolveSdkValue<T>(value: Promise<T> | T | undefined): Promise<T | undefined> {
    return value instanceof Promise ? value : value;
  }

  private toHex(value: string): string {
    const encoder = new TextEncoder();
    return [...encoder.encode(value)].map((byte) => byte.toString(16).padStart(2, "0")).join("").toUpperCase();
  }

  private clearPkceStorage(): void {
    if (typeof window === "undefined") return;
    try {
      window.localStorage?.removeItem("XummPkceJwt");
    } catch {
      // Ignore storage restrictions in embedded browsers.
    }
  }

  private getPendingRecoveryKey(): string {
    return `xwk.xaman.pending.${this.options.apiKey ?? "injected"}`;
  }

  private async setPendingRecoveryMarker(): Promise<void> {
    try {
      await this.recoveryStorage.setItem(this.getPendingRecoveryKey(), String(Date.now()));
    } catch {
      // Ignore storage restrictions in embedded browsers.
    }
  }

  private async hasPendingRecoveryMarker(): Promise<boolean> {
    try {
      const value = await this.recoveryStorage.getItem(this.getPendingRecoveryKey());
      if (!value) return false;
      const timestamp = Number(value);
      if (!Number.isFinite(timestamp) || Date.now() - timestamp > XAMAN_PENDING_RECOVERY_TTL_MS) {
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
      // Ignore storage restrictions in embedded browsers.
    }
  }
}

export function createXamanAdapter(options: XamanAdapterOptions) { return new XamanAdapter(options); }
