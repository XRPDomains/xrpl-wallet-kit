import { BaseWalletAdapter, createWalletError, validateMultisignTransaction, WalletKitError, WalletKitErrorCode } from "@xrpl-wallet-kit/core";
import { ensureLedgerXrpApp } from "./device-app";
import type { LedgerAppTransport } from "./device-app";
import type {
  ConnectOptions,
  ConnectResult,
  SignAndSubmitRequest,
  SignTransactionRequest,
  SignTransactionResult,
  TxResult,
  WalletCapabilities,
  WalletMetadata,
  WalletSession,
  XrplNetwork
} from "@xrpl-wallet-kit/core";

export const LEDGER_ICON =
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyOCIgaGVpZ2h0PSIyOCIgZmlsbD0ibm9uZSI+PHBhdGggZmlsbD0iIzAwMCIgZD0iTTAgMGgyOHYyOEgweiIvPjxwYXRoIGZpbGw9IiNmZmYiIGZpbGwtcnVsZT0iZXZlbm9kZCIgZD0iTTExLjY1IDQuNEg0LjRWOWgxLjFWNS41bDYuMTUtLjA0VjQuNFptLjA1IDUuOTV2Ny4yNWg0LjZ2LTEuMWgtMy41bC0uMDQtNi4xNUgxMS43Wk00LjQgMjMuNmg3LjI1di0xLjA2TDUuNSAyMi41VjE5SDQuNHY0LjZaTTE2LjM1IDQuNGg3LjI1VjloLTEuMVY1LjVsLTYuMTUtLjA0VjQuNFptNy4yNSAxOS4yaC03LjI1di0xLjA2bDYuMTUtLjA0VjE5aDEuMXY0LjZaIiBjbGlwLXJ1bGU9ImV2ZW5vZGQiLz48L3N2Zz4=";

const DEFAULT_TIMEOUT = 60_000;
const DEFAULT_ACCOUNT_INDEX = 0;
const FULLY_CANONICAL_SIG = 0x80000000;
type LedgerTransport = LedgerAppTransport;
type LedgerXrpApp = {
  getAddress(path: string, verify: boolean, askChainCode: boolean): Promise<{ address: string; publicKey: string }>;
  signTransaction(path: string, signingBlob: string): Promise<string>;
  getAppConfiguration?(): Promise<{ version: string }>;
};

export enum LedgerDeviceState {
  NOT_CONNECTED = "NOT_CONNECTED",
  LOCKED = "LOCKED",
  APP_NOT_OPEN = "APP_NOT_OPEN",
  OPENING_APP = "OPENING_APP",
  READY = "READY",
  UNKNOWN = "UNKNOWN"
}

export interface LedgerAdapterOptions {
  connectLedger?: () => Promise<LedgerSession>;
  accountIndex?: number;
  derivationPath?: string;
  preferWebHID?: boolean;
  timeout?: number;
  /** Request XRP on the hardware device during explicit connect. Default true. */
  autoOpenApp?: boolean;
  onDeviceState?: (state: LedgerDeviceState) => void;
  icon?: string;
}

export interface LedgerSession {
  address: string;
  publicKey?: string;
  derivationPath?: string;
  appVersion?: string;
  signTransaction(tx: unknown, submit?: boolean): Promise<LedgerSignResult>;
  signMultisignTransaction?(tx: unknown): Promise<LedgerSignResult>;
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
    signTransaction: true,
    signAndSubmit: true
  };

  private session?: LedgerSession;
  private network?: XrplNetwork;
  private transport?: LedgerTransport;
  private xrp?: LedgerXrpApp;
  private derivationPath: string;
  private connectionGeneration = 0;
  private connectionAbort?: AbortController;

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
    this.connectionAbort?.abort();
    const controller = new AbortController();
    this.connectionAbort = controller;
    const abort = () => controller.abort();
    options.signal?.addEventListener("abort", abort, { once: true });
    if (options.signal?.aborted) controller.abort();
    const generation = ++this.connectionGeneration;
    this.network = options.network;
    try {
      if (controller.signal.aborted) throw new WalletKitError(WalletKitErrorCode.REQUEST_CANCELLED, "Ledger connection cancelled.");
      const session = this.options.connectLedger
        ? await this.options.connectLedger()
        : await this.connectDefaultLedger(generation, { ...options, signal: controller.signal });
      if (generation !== this.connectionGeneration || controller.signal.aborted) throw createWalletError.notConnected();
      this.session = session;

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
            derivationPath: this.session.derivationPath ?? this.derivationPath,
            appVersion: this.session.appVersion
          }
        }
      };
    } catch (error) {
      if (generation === this.connectionGeneration) await this.cleanup();
      throw this.mapConnectionError(error);
    } finally {
      options.signal?.removeEventListener("abort", abort);
      if (this.connectionAbort === controller) this.connectionAbort = undefined;
    }
  }

  async restoreSession(_session: WalletSession): Promise<ConnectResult | null> {
    // Hardware wallets should not be restored as connected without a fresh device prompt.
    return null;
  }

  async disconnect(): Promise<void> {
    this.connectionAbort?.abort();
    this.connectionGeneration++;
    this.session = undefined;
    this.network = undefined;
    await this.cleanup();
  }

  async signAndSubmit(request: SignAndSubmitRequest): Promise<TxResult> {
    if (!this.session) throw createWalletError.notConnected();
    if (this.isMultisignTransaction(request.txJson)) {
      throw createWalletError.unsupportedMethod("multisign submission", this.metadata.name);
    }
    // RPC and validation errors must not be translated into device errors.
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
  }

  async signTransaction(request: SignTransactionRequest): Promise<SignTransactionResult> {
    if (!this.session) throw createWalletError.notConnected();
    const multisign = this.isMultisignTransaction(request.txJson);
    const result = multisign
      ? await this.signMultisignTransaction(request.txJson)
      : await this.session.signTransaction(request.txJson, false);
    return {
      txBlob: result.txBlob,
      signed: result.signed ?? Boolean(result.txBlob),
      raw: result.raw ?? result
    };
  }

  async getAccounts(count = 5, startIndex = 0): Promise<LedgerAccount[]> {
    if (!Number.isSafeInteger(count) || count < 0 || !Number.isSafeInteger(startIndex) || startIndex < 0 || startIndex + count > 0x80000000) {
      throw new WalletKitError(WalletKitErrorCode.INVALID_REQUEST, "Ledger account range must contain valid non-negative BIP44 indexes");
    }
    if (count === 0) return [];
    const generation = this.connectionGeneration;
    let ownedTransport: LedgerTransport | undefined;
    let xrp = this.xrp;
    try {
      if (!xrp) {
        const Xrp = await loadLedgerXrpApp();
        ownedTransport = await this.createTransport();
        xrp = new Xrp(ownedTransport);
      }

      const accounts: LedgerAccount[] = [];
      for (let index = startIndex; index < startIndex + count; index += 1) {
        if (generation !== this.connectionGeneration) throw createWalletError.notConnected();
        const path = getDerivationPath(index);
        const account = await this.withTimeout(
          xrp.getAddress(path, false, false),
          "Ledger account lookup timeout. Please check your Ledger device."
        );
        if (generation !== this.connectionGeneration) throw createWalletError.notConnected();
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
      await ownedTransport?.close().catch(() => {});
    }
  }

  private async connectDefaultLedger(generation: number, options: ConnectOptions): Promise<LedgerSession> {
    const support = getLedgerBrowserSupport();
    if (!support.supported) {
      throw createWalletError.walletNotAvailable("Ledger", new Error(support.message));
    }

    let transport = await this.createTransport();
    try {
      const assertCurrent = () => {
        if (generation !== this.connectionGeneration || options.signal?.aborted) throw createWalletError.notConnected();
      };
      assertCurrent();
      if (this.options.autoOpenApp !== false) {
        transport = await ensureLedgerXrpApp(transport, {
          signal: options.signal, timeoutMs: options.timeoutMs ?? this.options.timeout ?? DEFAULT_TIMEOUT, assertCurrent,
          onOpening: () => {
            this.options.onDeviceState?.(LedgerDeviceState.OPENING_APP);
            options.onRequestProgress?.({ state: "opened" });
          },
          onTransport: next => { transport = next; },
          reopen: previous => this.reopenSameDevice(previous)
        });
      }
      assertCurrent();
      const Xrp = await loadLedgerXrpApp();
      const xrp = new Xrp(transport);
      const account = await this.withTimeout(
        xrp.getAddress(this.derivationPath, false, false),
        "Ledger connection timeout. Please check your Ledger device."
      );

      if (!account.address) throw new Error("Ledger did not return an XRPL address");

      // App version is diagnostic only; older apps may not implement this APDU.
      let appVersion: string | undefined;
      try {
        if (xrp.getAppConfiguration) {
          appVersion = (await this.withTimeout(xrp.getAppConfiguration(), "Ledger app version lookup timeout")).version;
        }
      } catch {
        appVersion = undefined;
      }

      if (generation !== this.connectionGeneration) throw createWalletError.notConnected();
      await this.cleanup();
      if (generation !== this.connectionGeneration) throw createWalletError.notConnected();
      this.transport = transport;
      this.xrp = xrp;
      this.options.onDeviceState?.(LedgerDeviceState.READY);
      return {
        address: account.address,
        publicKey: account.publicKey,
        derivationPath: this.derivationPath,
        appVersion,
        signTransaction: (tx, submit) => this.signWithDefaultLedger(tx, submit),
        signMultisignTransaction: (tx) => this.signMultisignWithDefaultLedger(tx)
      };
    } catch (error) {
      void transport.close().catch(() => {});
      throw error;
    }
  }

  private async reopenSameDevice(previous: LedgerTransport): Promise<LedgerTransport> {
    const native = previous as LedgerTransport & { device?: unknown; constructor: { open?: (device: unknown) => Promise<LedgerTransport> } };
    if (!native.device || !native.constructor.open) throw new Error("Open XRP on your Ledger device and select it again in the browser.");
    return native.constructor.open(native.device);
  }

  private async signWithDefaultLedger(tx: unknown, submit = true): Promise<LedgerSignResult> {
    if (!this.xrp || !this.session) throw createWalletError.notConnected();
    if (!this.network) throw createWalletError.connectionFailed(this.metadata.name, new Error("XRPL network is required for Ledger signing"));
    if (this.isMultisignTransaction(tx)) {
      throw createWalletError.unsupportedMethod("XRPL multisigning through the single-sign path", this.metadata.name);
    }

    const session = this.session;
    const device = this.xrp;
    const network = this.network;
    const generation = this.connectionGeneration;
    const assertCurrent = () => {
      if (generation !== this.connectionGeneration || this.session !== session || this.xrp !== device) {
        throw createWalletError.notConnected();
      }
    };
    const { Client, encode, encodeForSigning, verifyKeypairSignature } = await import("xrpl");
    const client = new Client(network.rpcUrl);
    try {
      assertCurrent();
      await client.connect();
      const txJson = asRecord(tx);
      if (txJson.TxnSignature !== undefined || txJson.Signers !== undefined) {
        throw new WalletKitError(WalletKitErrorCode.INVALID_REQUEST, "Ledger signing requires an unsigned transaction");
      }
      const prepared = await client.autofill({
        ...txJson,
        Account: typeof txJson.Account === "string" ? txJson.Account : session.address
      } as any) as unknown as Record<string, unknown>;

      const txForSigning = { ...prepared } as Record<string, unknown>;
      delete txForSigning.TxnSignature;
      delete txForSigning.Signers;
      // XRP app 2.3.2 rejects an explicit Flags field without this signature bit.
      txForSigning.Flags = (Number(prepared.Flags ?? 0) | FULLY_CANONICAL_SIG) >>> 0;

      assertCurrent();
      const publicKey = session.publicKey ?? (await device.getAddress(this.derivationPath, false, false)).publicKey;
      txForSigning.SigningPubKey = publicKey.toUpperCase();

      const signingBlob = encode(txForSigning as never).toUpperCase();
      assertCurrent();
      const signature = await this.signOnDevice(txForSigning, signingBlob,
        "Ledger signing timeout. Please confirm the transaction on your Ledger device.");

      assertCurrent();
      this.verifyDeviceSignature(encodeForSigning(txForSigning as never), signature, publicKey, verifyKeypairSignature);

      const signedTx = {
        ...txForSigning,
        TxnSignature: signature.toUpperCase()
      };
      const txBlob = encode(signedTx as never);

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
      await client.disconnect().catch(() => {});
    }
  }

  private async signMultisignTransaction(tx: unknown): Promise<LedgerSignResult> {
    if (!this.session) throw createWalletError.notConnected();
    if (this.session.signMultisignTransaction) return this.session.signMultisignTransaction(tx);
    throw createWalletError.unsupportedMethod("XRPL multisigning for injected Ledger sessions", this.metadata.name);
  }

  private async signMultisignWithDefaultLedger(tx: unknown): Promise<LedgerSignResult> {
    if (!this.xrp || !this.session) throw createWalletError.notConnected();
    if (!this.network) throw createWalletError.connectionFailed(this.metadata.name, new Error("XRPL network is required for Ledger signing"));

    const session = this.session;
    const device = this.xrp;
    const generation = this.connectionGeneration;
    const assertCurrent = () => {
      if (generation !== this.connectionGeneration || this.session !== session || this.xrp !== device) {
        throw createWalletError.notConnected();
      }
    };
    const { encode, encodeForMultiSigning, verifyKeypairSignature } = await import("xrpl");
    const prepared = await validateMultisignTransaction(asRecord(tx));

    assertCurrent();
    const publicKey = (session.publicKey ?? (await device.getAddress(this.derivationPath, false, false)).publicKey).toUpperCase();
    // The XRP app adds the multisign prefix and signer AccountID itself.
    const signingBlob = encode(prepared as never).toUpperCase();
    assertCurrent();
    const signature = await this.signOnDevice(prepared, signingBlob,
      "Ledger multisigning timeout. Please confirm the transaction on your Ledger device.");
    assertCurrent();
    this.verifyDeviceSignature(encodeForMultiSigning(prepared as never, session.address), signature, publicKey, verifyKeypairSignature);

    const signer = { Signer: { Account: session.address, SigningPubKey: publicKey, TxnSignature: signature.toUpperCase() } };
    const signedTx = { ...prepared, Signers: [signer] };
    const txBlob = encode(signedTx as never);
    return { txBlob, signed: true, raw: { txBlob, signedTx, signer } };
  }

  private verifyDeviceSignature(preimage: string, signature: string, publicKey: string,
    verify: (message: string, signature: string, publicKey: string) => boolean): void {
    let valid = false;
    try {
      valid = Boolean(signature) && verify(preimage, signature, publicKey);
    } catch {
      valid = false;
    }
    if (!valid) throw createWalletError.signFailed(new Error("Ledger returned an invalid transaction signature"));
  }

  private async signOnDevice(tx: Record<string, unknown>, signingBlob: string, timeoutMessage: string): Promise<string> {
    if (!this.xrp) throw createWalletError.notConnected();
    try {
      return await this.withTimeout(this.xrp.signTransaction(this.derivationPath, signingBlob), timeoutMessage);
    } catch (error) {
      const mapped = this.mapSigningError(error);
      if (!(mapped instanceof WalletKitError)) throw mapped;
      throw new WalletKitError(mapped.code, mapped.message, {
        cause: error,
        category: mapped.category,
        details: {
          ...mapped.details,
          stage: "device-signing",
          ledgerStatusCode: getLedgerStatusCode(error),
          appVersion: this.session?.appVersion,
          derivationPath: this.derivationPath,
          network: this.network?.id,
          preparedTransaction: { ...tx },
          submitAttempted: false
        }
      });
    }
  }

  private async createTransport(): Promise<LedgerTransport> {
    const support = getLedgerBrowserSupport();
    if (!support.supported) throw createWalletError.walletNotAvailable("Ledger", new Error(support.message));

    if (this.options.preferWebHID !== false && support.webHID) {
      try {
        return await createWebHIDTransport();
      } catch (error) {
        if (!support.webUSB) throw error;
      }
    }

    if (support.webUSB) {
      try {
        return await createWebUSBTransport();
      } catch (error) {
        if (!support.webHID || this.options.preferWebHID !== false) throw error;
      }
    }

    if (support.webHID) return createWebHIDTransport();
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

  private isMultisignTransaction(tx: unknown): boolean {
    const txJson = asRecord(tx);
    return txJson.SigningPubKey === "" || Array.isArray(txJson.Signers);
  }
}

export function createLedgerAdapter(options?: LedgerAdapterOptions) {
  return new LedgerAdapter(options);
}

async function loadLedgerXrpApp(): Promise<new (transport: LedgerTransport) => LedgerXrpApp> {
  const module = await import("@ledgerhq/hw-app-xrp");
  return module.default as unknown as new (transport: LedgerTransport) => LedgerXrpApp;
}

async function createWebHIDTransport(): Promise<LedgerTransport> {
  const module = await import("@ledgerhq/hw-transport-webhid");
  return module.default.create() as Promise<LedgerTransport>;
}

async function createWebUSBTransport(): Promise<LedgerTransport> {
  const module = await import("@ledgerhq/hw-transport-webusb");
  return module.default.create() as Promise<LedgerTransport>;
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
    return { state: LedgerDeviceState.APP_NOT_OPEN, message: /connect again|select.*again/.test(lower)
      ? message : "Please open the XRP app on your Ledger device.", rejected: false, timeout: false };
  }
  if (/no device|device.*not found|disconnected|cannot open device|transport/i.test(message)) {
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
