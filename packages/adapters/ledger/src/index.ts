import Xrp from "@ledgerhq/hw-app-xrp";
import TransportWebHID from "@ledgerhq/hw-transport-webhid";
import TransportWebUSB from "@ledgerhq/hw-transport-webusb";
import { Client, encode } from "xrpl";
import { BaseWalletAdapter, createWalletError } from "@xrpl-wallet-kit/core";
import type {
  ConnectOptions,
  ConnectResult,
  SignAndSubmitRequest,
  TxResult,
  WalletCapabilities,
  WalletMetadata,
  WalletSession,
  XrplNetwork
} from "@xrpl-wallet-kit/core";

export const LEDGER_ICON =
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmciIHdpZHRoPSIyOCIgaGVpZ2h0PSIyOCIgZmlsbD0ibm9uZSI+PHBhdGggZmlsbD0iIzAwMCIgZD0iTTAgMGgyOHYyOEgweiIvPjxwYXRoIGZpbGw9IiNmZmYiIGZpbGwtcnVsZT0iZXZlbm9kZCIgZD0iTTExLjY1IDQuNEg0LjRWOWgxLjFWNS41bDYuMTUtLjA0VjQuNFptLjA1IDUuOTV2Ny4yNWg0LjZ2LTEuMWgtMy41bC0uMDQtNi4xNUgxMS43Wk00LjQgMjMuNmg3LjI1di0xLjA2TDUuNSAyMi41VjE5SDQuNHY0LjZaTTE2LjM1IDQuNGg3LjI1VjloLTEuMVY1LjVsLTYuMTUtLjA0VjQuNFptNy4yNSAxOS4yaC03LjI1di0xLjA2bDYuMTUtLjA0VjE5aDEuMXY0LjZaIiBjbGlwLXJ1bGU9ImV2ZW5vZGQiLz48L3N2Zz4=";

const DEFAULT_TIMEOUT = 60_000;
const DEFAULT_ACCOUNT_INDEX = 0;
type LedgerTransport = ConstructorParameters<typeof Xrp>[0];

export enum LedgerDeviceState {
  NOT_CONNECTED = "NOT_CONNECTED",
  LOCKED = "LOCKED",
  APP_NOT_OPEN = "APP_NOT_OPEN",
  READY = "READY",
  UNKNOWN = "UNKNOWN"
}

export interface LedgerAdapterOptions {
  connectLedger?: () => Promise<LedgerSession>;
  accountIndex?: number;
  derivationPath?: string;
  preferWebHID?: boolean;
  timeout?: number;
  icon?: string;
}

export interface LedgerSession {
  address: string;
  publicKey?: string;
  derivationPath?: string;
  signTransaction(tx: unknown, submit?: boolean): Promise<LedgerSignResult>;
}

interface LedgerAccount {
  address: string;
  publicKey: string;
  path: string;
  index: number;
}

interface LedgerSignResult {
  hash?: string;
  status?: string;
  txBlob?: string;
  signed?: boolean;
  raw?: unknown;
}

interface LedgerErrorInfo {
  state: LedgerDeviceState;
  message: string;
  rejected: boolean;
  timeout: boolean;
}

export class LedgerAdapter extends BaseWalletAdapter {
  metadata: WalletMetadata;
  capabilities: WalletCapabilities = {
    connect: true,
    disconnect: true,
    signAndSubmit: true
  };

  private session?: LedgerSession;
  private network?: XrplNetwork;
  private transport?: LedgerTransport;
  private xrp?: Xrp;
  private derivationPath: string;

  constructor(private options: LedgerAdapterOptions = {}) {
    super();
    this.derivationPath = options.derivationPath ?? getDerivationPath(options.accountIndex ?? DEFAULT_ACCOUNT_INDEX);
    this.metadata = {
      id: "ledger",
      name: "Ledger",
      type: "hardware",
      group: "Hardware",
      icon: options.icon ?? LEDGER_ICON,
      homepage: "https://www.ledger.com"
    };
  }

  async isAvailable(): Promise<boolean> {
    return getLedgerBrowserSupport().supported;
  }

  async connect(options: ConnectOptions): Promise<ConnectResult> {
    this.network = options.network;
    try {
      this.session = this.options.connectLedger
        ? await this.options.connectLedger()
        : await this.connectDefaultLedger();

      return {
        account: {
          address: this.session.address,
          publicKey: this.session.publicKey,
          network: options.network,
          networkType: options.network?.networkType
        },
        session: {
          adapterId: this.metadata.id,
          wallet: this.metadata,
          account: {
            address: this.session.address,
            publicKey: this.session.publicKey,
            network: options.network,
            networkType: options.network?.networkType
          },
          connectedAt: Date.now(),
          metadata: {
            derivationPath: this.session.derivationPath ?? this.derivationPath
          }
        }
      };
    } catch (error) {
      await this.cleanup();
      throw this.mapConnectionError(error);
    }
  }

  async restoreSession(_session: WalletSession): Promise<ConnectResult | null> {
    // Hardware wallets should not be restored as connected without a fresh device prompt.
    return null;
  }

  async disconnect(): Promise<void> {
    await this.cleanup();
    this.session = undefined;
    this.network = undefined;
  }

  async signAndSubmit(request: SignAndSubmitRequest): Promise<TxResult> {
    if (!this.session) throw createWalletError.notConnected();
    try {
      const result = await this.session.signTransaction(request.txJson, request.submit ?? true);
      return {
        hash: result.hash,
        status: result.status,
        signed: result.signed ?? Boolean(result.hash || result.txBlob),
        raw: {
          txBlob: result.txBlob,
          ...asRecord(result.raw ?? result)
        }
      };
    } catch (error) {
      throw this.mapSigningError(error);
    }
  }

  async getAccounts(count = 5, startIndex = 0): Promise<LedgerAccount[]> {
    const cleanupAfter = !this.transport;
    try {
      if (!this.transport || !this.xrp) {
        this.transport = await this.createTransport();
        this.xrp = new Xrp(this.transport);
      }

      const accounts: LedgerAccount[] = [];
      for (let index = startIndex; index < startIndex + count; index += 1) {
        const path = getDerivationPath(index);
        const account = await this.withTimeout(
          this.xrp.getAddress(path, false, false),
          "Ledger account lookup timeout. Please check your Ledger device."
        );
        accounts.push({
          address: account.address,
          publicKey: account.publicKey,
          path,
          index
        });
      }
      return accounts;
    } catch (error) {
      throw this.mapConnectionError(error);
    } finally {
      if (cleanupAfter) await this.cleanup();
    }
  }

  private async connectDefaultLedger(): Promise<LedgerSession> {
    const support = getLedgerBrowserSupport();
    if (!support.supported) {
      throw createWalletError.walletNotAvailable("Ledger", new Error(support.message));
    }

    this.transport = await this.createTransport();
    this.xrp = new Xrp(this.transport);
    const account = await this.withTimeout(
      this.xrp.getAddress(this.derivationPath, false, false),
      "Ledger connection timeout. Please check your Ledger device."
    );

    if (!account.address) throw new Error("Ledger did not return an XRPL address");

    return {
      address: account.address,
      publicKey: account.publicKey,
      derivationPath: this.derivationPath,
      signTransaction: (tx, submit) => this.signWithDefaultLedger(tx, submit)
    };
  }

  private async signWithDefaultLedger(tx: unknown, submit = true): Promise<LedgerSignResult> {
    if (!this.xrp || !this.session) throw createWalletError.notConnected();
    if (!this.network) throw createWalletError.connectionFailed(this.metadata.name, new Error("XRPL network is required for Ledger signing"));

    const client = new Client(this.network.rpcUrl);
    await client.connect();
    try {
      const txJson = asRecord(tx);
      const prepared = await client.autofill({
        ...txJson,
        Account: typeof txJson.Account === "string" ? txJson.Account : this.session.address
      } as Parameters<Client["autofill"]>[0]);

      const txForSigning = { ...prepared } as Record<string, unknown>;
      delete txForSigning.TxnSignature;
      delete txForSigning.Signers;

      const publicKey = this.session.publicKey ?? (await this.xrp.getAddress(this.derivationPath, false, false)).publicKey;
      txForSigning.SigningPubKey = publicKey.toUpperCase();

      const signingBlob = encode(txForSigning as unknown as Parameters<typeof encode>[0]).toUpperCase();
      const signature = await this.withTimeout(
        this.xrp.signTransaction(this.derivationPath, signingBlob),
        "Ledger signing timeout. Please confirm the transaction on your Ledger device."
      );

      if (!signature) throw new Error("Ledger did not return a transaction signature");

      const signedTx = {
        ...txForSigning,
        TxnSignature: signature.toUpperCase()
      };
      const txBlob = encode(signedTx as Parameters<typeof encode>[0]);

      if (!submit) {
        return {
          txBlob,
          signed: true,
          raw: { txBlob, signedTx }
        };
      }

      const response = await client.submitAndWait(txBlob);
      const hash = response.result.hash;
      const status = response.result.meta && typeof response.result.meta === "object"
        ? (response.result.meta as { TransactionResult?: string }).TransactionResult
        : undefined;

      return {
        hash,
        status,
        txBlob,
        signed: true,
        raw: response
      };
    } finally {
      await client.disconnect();
    }
  }

  private async createTransport(): Promise<LedgerTransport> {
    const support = getLedgerBrowserSupport();
    if (!support.supported) throw createWalletError.walletNotAvailable("Ledger", new Error(support.message));

    if (this.options.preferWebHID !== false && support.webHID) {
      try {
        return await TransportWebHID.create() as LedgerTransport;
      } catch (error) {
        if (!support.webUSB) throw error;
      }
    }

    if (support.webUSB) {
      try {
        return await TransportWebUSB.create() as LedgerTransport;
      } catch (error) {
        if (!support.webHID || this.options.preferWebHID !== false) throw error;
      }
    }

    if (support.webHID) return TransportWebHID.create() as Promise<LedgerTransport>;
    throw createWalletError.walletNotAvailable("Ledger", new Error("No compatible Ledger transport is available"));
  }

  private async cleanup(): Promise<void> {
    const transport = this.transport;
    this.transport = undefined;
    this.xrp = undefined;
    if (!transport) return;
    try {
      await transport.close();
    } catch {
      // Closing a Ledger transport is best-effort; stale transport errors should not block disconnect.
    }
  }

  private mapConnectionError(error: unknown): Error {
    if (isWalletKitErrorLike(error)) return error;
    const parsed = parseLedgerError(error);
    if (parsed.timeout) return createWalletError.requestTimeout(parsed.message, error);
    if (parsed.rejected) return createWalletError.connectionRejected(this.metadata.name, error);
    if (parsed.state === LedgerDeviceState.NOT_CONNECTED) {
      return createWalletError.walletNotAvailable(this.metadata.name, new Error(parsed.message));
    }
    return createWalletError.connectionFailed(this.metadata.name, new Error(parsed.message));
  }

  private mapSigningError(error: unknown): Error {
    if (isWalletKitErrorLike(error)) return error;
    const parsed = parseLedgerError(error);
    if (parsed.timeout) return createWalletError.requestTimeout(parsed.message, error);
    if (parsed.rejected) return createWalletError.signRejected(error);
    return createWalletError.signFailed(new Error(parsed.message));
  }

  private async withTimeout<T>(promise: Promise<T>, message: string): Promise<T> {
    const timeout = this.options.timeout ?? DEFAULT_TIMEOUT;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        promise,
        new Promise<T>((_, reject) => {
          timer = setTimeout(() => reject(new Error(message)), timeout);
        })
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}

export function createLedgerAdapter(options?: LedgerAdapterOptions) {
  return new LedgerAdapter(options);
}

function getDerivationPath(accountIndex: number): string {
  return `44'/144'/${accountIndex}'/0/0`;
}

function getLedgerBrowserSupport(): { supported: boolean; webHID: boolean; webUSB: boolean; message: string } {
  const webHID = typeof navigator !== "undefined" && "hid" in navigator;
  const webUSB = typeof navigator !== "undefined" && "usb" in navigator;
  return {
    supported: webHID || webUSB,
    webHID,
    webUSB,
    message: webHID || webUSB ? "Ledger transport is supported" : "This browser does not support Ledger WebHID/WebUSB transport"
  };
}

function parseLedgerError(error: unknown): LedgerErrorInfo {
  const message = getLedgerErrorMessage(error);
  const statusCode = getLedgerStatusCode(error);
  const lower = message.toLowerCase();

  if (statusCode === 0x6985 || /reject|denied|cancelled|canceled|closed|access denied/.test(lower)) {
    return { state: LedgerDeviceState.READY, message: message || "Ledger request was rejected", rejected: true, timeout: false };
  }
  if (/timeout|timed out/.test(lower)) {
    return { state: LedgerDeviceState.UNKNOWN, message: message || "Ledger request timed out", rejected: false, timeout: true };
  }
  if (statusCode === 0x6804 || /locked|pin/.test(lower)) {
    return { state: LedgerDeviceState.LOCKED, message: "Ledger is locked. Please unlock your Ledger device.", rejected: false, timeout: false };
  }
  if ([0x6e00, 0x6511, 0x650f].includes(statusCode ?? 0) || /app.*open|xrp.*app|cla_not_supported/.test(lower)) {
    return { state: LedgerDeviceState.APP_NOT_OPEN, message: "Please open the XRP app on your Ledger device.", rejected: false, timeout: false };
  }
  if (/no device|not found|disconnected|cannot open device|transport/i.test(message)) {
    return { state: LedgerDeviceState.NOT_CONNECTED, message: "Ledger device not found. Please connect and unlock your Ledger device.", rejected: false, timeout: false };
  }

  return { state: LedgerDeviceState.UNKNOWN, message: message || "Unknown Ledger error", rejected: false, timeout: false };
}

function getLedgerErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function getLedgerStatusCode(error: unknown): number | undefined {
  if (!error || typeof error !== "object") return undefined;
  const value = (error as { statusCode?: unknown; status?: unknown }).statusCode ?? (error as { statusCode?: unknown; status?: unknown }).status;
  return typeof value === "number" ? value : undefined;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function isWalletKitErrorLike(error: unknown): error is Error {
  return error instanceof Error && error.name === "WalletKitError";
}
