import Xrp from "@ledgerhq/hw-app-xrp";
import TransportWebHID from "@ledgerhq/hw-transport-webhid";
import TransportWebUSB from "@ledgerhq/hw-transport-webusb";
import { Client, encode } from "xrpl";
import { BaseWalletAdapter, normalizeTxResult } from "@xrpname/wallet-core";
import type { ConnectOptions, SignAndSubmitRequest, WalletCapabilities, WalletMetadata, XrplNetwork } from "@xrpname/wallet-core";

export const LEDGER_ICON = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyOCIgaGVpZ2h0PSIyOCIgZmlsbD0ibm9uZSI+PHBhdGggZmlsbD0iIzAwMCIgZD0iTTAgMGgyOHYyOEgweiIvPjxwYXRoIGZpbGw9IiNmZmYiIGZpbGwtcnVsZT0iZXZlbm9kZCIgZD0iTTExLjY1IDQuNEg0LjRWOWgxLjFWNS41bDYuMTUtLjA0VjQuNFptLjA1IDUuOTV2Ny4yNWg0LjZ2LTEuMWgtMy41bC0uMDQtNi4xNUgxMS43Wk00LjQgMjMuNmg3LjI1di0xLjA2TDUuNSAyMi41VjE5SDQuNHY0LjZaTTE2LjM1IDQuNGg3LjI1VjloLTEuMVY1LjVsLTYuMTUtLjA0VjQuNFptNy4yNSAxOS4yaC03LjI1di0xLjA2bDYuMTUtLjA0VjE5aDEuMXY0LjZaIiBjbGlwLXJ1bGU9ImV2ZW5vZGQiLz48L3N2Zz4=";

interface LedgerTransportLike {
  close(): Promise<void>;
}

export interface LedgerSession {
  address: string;
  publicKey?: string;
  signTransaction(tx: unknown, submit?: boolean): Promise<unknown>;
}

export interface LedgerAdapterOptions {
  connectLedger?: () => Promise<LedgerSession>;
  accountIndex?: number;
  derivationPath?: string;
  preferWebHID?: boolean;
  timeout?: number;
  icon?: string;
}

export class LedgerAdapter extends BaseWalletAdapter {
  metadata: WalletMetadata;
  capabilities: WalletCapabilities = { connect: true, disconnect: true, signAndSubmit: true };
  private session?: LedgerSession;
  private network?: XrplNetwork;
  private transport?: LedgerTransportLike;
  private xrp?: Xrp;
  private derivationPath: string;

  constructor(private options: LedgerAdapterOptions = {}) {
    super();
    this.derivationPath = options.derivationPath ?? `44'/144'/${options.accountIndex ?? 0}'/0/0`;
    this.metadata = {
      id: "ledger",
      name: "Ledger",
      type: "hardware",
      group: "Hardware",
      icon: options.icon ?? LEDGER_ICON
    };
  }

  async isAvailable(): Promise<boolean> {
    return typeof navigator !== "undefined" && ("hid" in navigator || "usb" in navigator);
  }

  async connect(options: ConnectOptions) {
    this.network = options.network;
    this.session = this.options.connectLedger ? await this.options.connectLedger() : await this.connectDefaultLedger();
    return { account: { address: this.session.address, publicKey: this.session.publicKey, network: options.network, networkType: options.network?.networkType } };
  }

  async disconnect(): Promise<void> {
    await this.transport?.close();
    this.transport = undefined;
    this.xrp = undefined;
    this.session = undefined;
  }

  async signAndSubmit(request: SignAndSubmitRequest) {
    if (!this.session) throw new Error("Ledger is not connected");
    return normalizeTxResult(await this.session.signTransaction(request.txJson, request.submit));
  }

  private async connectDefaultLedger(): Promise<LedgerSession> {
    this.transport = await this.createTransport();
    this.xrp = new Xrp(this.transport as ConstructorParameters<typeof Xrp>[0]);
    const account = await this.withTimeout(this.xrp.getAddress(this.derivationPath, false, false), "Ledger connection timeout");
    if (!account.address) throw new Error("Ledger did not return an XRPL address");
    return {
      address: account.address,
      publicKey: account.publicKey,
      signTransaction: (tx, submit) => this.signWithDefaultLedger(tx, submit)
    };
  }

  private async signWithDefaultLedger(tx: unknown, submit = true): Promise<unknown> {
    if (!this.xrp || !this.session) throw new Error("Ledger is not connected");
    if (!this.network) throw new Error("XRPL network is required for Ledger signing");

    const client = new Client(this.network.rpcUrl);
    await client.connect();
    try {
      const txJson = tx as Record<string, unknown>;
      const prepared = await client.autofill({ ...txJson, Account: typeof txJson.Account === "string" ? txJson.Account : this.session.address } as Parameters<Client["autofill"]>[0]);
      const txForSigning = { ...prepared };
      delete (txForSigning as { TxnSignature?: unknown }).TxnSignature;
      delete (txForSigning as { Signers?: unknown }).Signers;
      txForSigning.SigningPubKey = (this.session.publicKey ?? (await this.xrp.getAddress(this.derivationPath, false, false)).publicKey).toUpperCase();

      const signingBlob = encode(txForSigning).toUpperCase();
      const signature = await this.withTimeout(this.xrp.signTransaction(this.derivationPath, signingBlob), "Ledger signing timeout");
      const signedTx = { ...txForSigning, TxnSignature: signature.toUpperCase() };
      const tx_blob = encode(signedTx);

      if (!submit) return { tx_blob, signed: true };
      const result = await client.submitAndWait(tx_blob);
      return { hash: result.result.hash, tx_blob, raw: result };
    } finally {
      await client.disconnect();
    }
  }

  private async createTransport(): Promise<LedgerTransportLike> {
    const hasWebHid = typeof navigator !== "undefined" && "hid" in navigator;
    const hasWebUsb = typeof navigator !== "undefined" && "usb" in navigator;
    if (this.options.preferWebHID !== false && hasWebHid) {
      try {
        return await TransportWebHID.create() as LedgerTransportLike;
      } catch {
        if (hasWebUsb) return await TransportWebUSB.create() as LedgerTransportLike;
        throw new Error("Ledger WebHID transport failed");
      }
    }
    if (hasWebUsb) return await TransportWebUSB.create() as LedgerTransportLike;
    if (hasWebHid) return await TransportWebHID.create() as LedgerTransportLike;
    throw new Error("This browser does not support Ledger WebHID/WebUSB transport");
  }

  private async withTimeout<T>(promise: Promise<T>, message: string): Promise<T> {
    const timeout = this.options.timeout ?? 60000;
    return Promise.race([
      promise,
      new Promise<T>((_, reject) => setTimeout(() => reject(new Error(message)), timeout))
    ]);
  }
}

export function createLedgerAdapter(options?: LedgerAdapterOptions) { return new LedgerAdapter(options); }
