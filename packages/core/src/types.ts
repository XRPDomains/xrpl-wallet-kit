import type { WalletKitLogger, WalletKitLoggerOptions } from "./logger";

export type WalletNetworkId = "mainnet" | "testnet" | "devnet" | (string & {});
export type WalletNetworkFamily = "xrpl" | (string & {});

export interface WalletNetwork {
  id: WalletNetworkId;
  name: string;
  family?: WalletNetworkFamily;
  networkType: "MAINNET" | "TESTNET" | "DEVNET" | "CUSTOM";
  nativeAsset?: string;
  nativeAssetDecimals?: number;
  rpcUrl: string;
  httpRpcUrl?: string;
  walletConnectChainId: string;
  networkId?: number;
  definitionsUrl?: string;
  explorerTxUrl?: string;
  explorerAccountUrl?: string;
}

export type WalletAdapterType = "mobile" | "extension" | "walletconnect" | "snap" | "hardware" | "embedded";

export interface WalletCapabilities {
  connect: boolean;
  disconnect?: boolean;
  signMessage?: boolean;
  signTransaction?: boolean;
  signAndSubmit?: boolean;
  nftOffers?: boolean;
  payments?: boolean;
  qr?: boolean;
  deeplink?: boolean;
}

export interface WalletMetadata {
  id: string;
  name: string;
  type: WalletAdapterType;
  icon?: string;
  group?: string;
  recommended?: boolean;
  homepage?: string;
  walletConnect?: {
    deeplink?: (uri: string) => string;
  };
}

export type WalletAvailabilityMap = Record<string, boolean>;

export interface WalletAccount {
  address: string;
  publicKey?: string;
  network?: WalletNetwork;
  networkType?: string;
  activationStatus?: "active" | "unfunded" | "unknown";
}

export interface WalletSession {
  adapterId: string;
  wallet?: WalletMetadata;
  account: WalletAccount;
  connectedAt: number;
  expiresAt?: number;
  metadata?: Record<string, unknown>;
}

export type TransactionPayload = Record<string, unknown>;

export interface SignMessageRequest {
  message: string;
  account?: WalletAccount;
}

export interface SignMessageResult {
  signature?: string;
  txBlob?: string;
  raw?: unknown;
}

export interface SignAndSubmitRequest {
  txJson: TransactionPayload;
  methodHint?: "payment" | "createNFTOffer" | "acceptNFTOffer" | "cancelNFTOffer" | "generic";
  walletPayload?: unknown;
  submit?: boolean;
}

export interface TxResult {
  hash?: string;
  status?: string;
  signed?: boolean;
  rejected?: boolean;
  raw?: unknown;
}

export interface ConnectOptions {
  network?: WalletNetwork;
  walletId?: string;
  signal?: AbortSignal;
}

export interface ConnectResult {
  account: WalletAccount;
  session?: WalletSession;
  raw?: unknown;
}

export interface WalletAdapter {
  metadata: WalletMetadata;
  capabilities: WalletCapabilities;
  isAvailable?: () => boolean | Promise<boolean>;
  connect: (options: ConnectOptions) => Promise<ConnectResult>;
  cancelPendingConnection?: () => void | Promise<void>;
  disconnect?: () => Promise<void>;
  restoreSession?: (session: WalletSession) => Promise<ConnectResult | null>;
  canRecoverSession?: (options: ConnectOptions) => boolean | Promise<boolean>;
  recoverSession?: (options: ConnectOptions) => Promise<ConnectResult | null>;
  signMessage?: (request: SignMessageRequest) => Promise<SignMessageResult>;
  signAndSubmit?: (request: SignAndSubmitRequest) => Promise<TxResult>;
}

export type WalletEventName =
  | "connecting"
  | "connected"
  | "disconnected"
  | "error"
  | "qr"
  | "signing"
  | "signed"
  | "rejected"
  | "session_restored"
  | "session_stale"
  | "session_expired";

export interface WalletEvents {
  connecting: { adapterId: string; recovering?: boolean };
  connected: { adapterId: string; account: WalletAccount; session?: WalletSession };
  disconnected: { adapterId?: string };
  error: { adapterId?: string; error: unknown };
  qr: { adapterId: string; uri: string; deeplink?: string };
  signing: { adapterId: string; kind: "message" | "transaction" };
  signed: { adapterId: string; kind: "message" | "transaction"; result: unknown };
  rejected: { adapterId: string; kind?: "message" | "transaction"; error?: unknown };
  session_restored: { adapterId: string; account: WalletAccount; session: WalletSession; stale?: boolean };
  session_stale: { adapterId: string; account?: WalletAccount; session?: WalletSession; reason?: string; attempts?: number };
  session_expired: { adapterId?: string };
}

export type WalletEventHandler<T extends WalletEventName> = (event: WalletEvents[T]) => void;

export interface WalletStorage {
  getItem(key: string): string | null | Promise<string | null>;
  setItem(key: string, value: string): void | Promise<void>;
  removeItem(key: string): void | Promise<void>;
}

export interface StoredWalletSessionEnvelope {
  version: number;
  session: WalletSession;
  updatedAt: number;
}

export interface WalletManagerConfig {
  appName: string;
  appDescription?: string;
  appUrl?: string;
  appIcons?: string[];
  network?: WalletNetworkId;
  networks?: WalletNetwork[];
  adapters?: WalletAdapter[];
  storage?: WalletStorage;
  autoReconnect?: boolean;
  logger?: WalletKitLogger | WalletKitLoggerOptions;
}

export type XrplNetworkId = WalletNetworkId;
export type XrplNetwork = WalletNetwork;
export type XrplTxJson = TransactionPayload;

