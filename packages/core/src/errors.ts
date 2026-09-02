export enum WalletKitErrorCode {
  WALLET_NOT_FOUND = "WALLET_NOT_FOUND",
  WALLET_NOT_INSTALLED = "WALLET_NOT_INSTALLED",
  WALLET_NOT_AVAILABLE = "WALLET_NOT_AVAILABLE",
  CONNECTION_FAILED = "CONNECTION_FAILED",
  CONNECTION_REJECTED = "CONNECTION_REJECTED",
  SIGN_FAILED = "SIGN_FAILED",
  SIGN_REJECTED = "SIGN_REJECTED",
  REQUEST_TIMEOUT = "REQUEST_TIMEOUT",
  UNSUPPORTED_METHOD = "UNSUPPORTED_METHOD",
  INVALID_ADAPTER = "INVALID_ADAPTER",
  NETWORK_MISMATCH = "NETWORK_MISMATCH",
  NETWORK_NOT_SUPPORTED = "NETWORK_NOT_SUPPORTED",
  NOT_CONNECTED = "NOT_CONNECTED",
  ALREADY_CONNECTED = "ALREADY_CONNECTED",
  UNKNOWN_ERROR = "UNKNOWN_ERROR"
}

export enum WalletKitErrorCategory {
  WALLET_UNAVAILABLE = "WALLET_UNAVAILABLE",
  USER_ACTION = "USER_ACTION",
  NETWORK = "NETWORK",
  INVALID_INPUT = "INVALID_INPUT",
  TIMEOUT = "TIMEOUT",
  INTERNAL = "INTERNAL"
}

export const WALLET_KIT_ERROR_CATEGORY_BY_CODE: Record<WalletKitErrorCode, WalletKitErrorCategory> = {
  [WalletKitErrorCode.WALLET_NOT_FOUND]: WalletKitErrorCategory.WALLET_UNAVAILABLE,
  [WalletKitErrorCode.WALLET_NOT_INSTALLED]: WalletKitErrorCategory.WALLET_UNAVAILABLE,
  [WalletKitErrorCode.WALLET_NOT_AVAILABLE]: WalletKitErrorCategory.WALLET_UNAVAILABLE,
  [WalletKitErrorCode.CONNECTION_FAILED]: WalletKitErrorCategory.INTERNAL,
  [WalletKitErrorCode.CONNECTION_REJECTED]: WalletKitErrorCategory.USER_ACTION,
  [WalletKitErrorCode.SIGN_FAILED]: WalletKitErrorCategory.INTERNAL,
  [WalletKitErrorCode.SIGN_REJECTED]: WalletKitErrorCategory.USER_ACTION,
  [WalletKitErrorCode.REQUEST_TIMEOUT]: WalletKitErrorCategory.TIMEOUT,
  [WalletKitErrorCode.UNSUPPORTED_METHOD]: WalletKitErrorCategory.INVALID_INPUT,
  [WalletKitErrorCode.INVALID_ADAPTER]: WalletKitErrorCategory.INVALID_INPUT,
  [WalletKitErrorCode.NETWORK_MISMATCH]: WalletKitErrorCategory.NETWORK,
  [WalletKitErrorCode.NETWORK_NOT_SUPPORTED]: WalletKitErrorCategory.NETWORK,
  [WalletKitErrorCode.NOT_CONNECTED]: WalletKitErrorCategory.USER_ACTION,
  [WalletKitErrorCode.ALREADY_CONNECTED]: WalletKitErrorCategory.USER_ACTION,
  [WalletKitErrorCode.UNKNOWN_ERROR]: WalletKitErrorCategory.INTERNAL
};

export class WalletKitError extends Error {
  readonly code: WalletKitErrorCode;
  readonly category: WalletKitErrorCategory;
  readonly cause?: unknown;
  readonly details?: Record<string, unknown>;

  constructor(code: WalletKitErrorCode, message: string, options: { cause?: unknown; details?: Record<string, unknown>; category?: WalletKitErrorCategory } = {}) {
    super(message);
    this.name = "WalletKitError";
    this.code = code;
    this.category = options.category ?? WALLET_KIT_ERROR_CATEGORY_BY_CODE[code] ?? WalletKitErrorCategory.INTERNAL;
    this.cause = options.cause;
    this.details = options.details;
  }
}

export function isWalletKitError(error: unknown): error is WalletKitError {
  return error instanceof WalletKitError;
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

export const createWalletError = {
  walletNotFound: (adapterId: string) => new WalletKitError(
    WalletKitErrorCode.WALLET_NOT_FOUND,
    `Wallet adapter is not registered: ${adapterId}`,
    { details: { adapterId } }
  ),
  walletNotInstalled: (walletName: string, cause?: unknown) => new WalletKitError(
    WalletKitErrorCode.WALLET_NOT_INSTALLED,
    `${walletName} is not installed`,
    { cause, details: { walletName } }
  ),
  walletNotAvailable: (walletName: string, cause?: unknown) => new WalletKitError(
    WalletKitErrorCode.WALLET_NOT_AVAILABLE,
    `${walletName} provider is not available`,
    { cause, details: { walletName } }
  ),
  connectionFailed: (walletName: string, cause?: unknown) => new WalletKitError(
    WalletKitErrorCode.CONNECTION_FAILED,
    `Failed to connect ${walletName}: ${getErrorMessage(cause)}`,
    { cause, details: { walletName } }
  ),
  connectionRejected: (walletName: string, cause?: unknown) => new WalletKitError(
    WalletKitErrorCode.CONNECTION_REJECTED,
    `${walletName} connection was rejected`,
    { cause, details: { walletName } }
  ),
  signFailed: (cause?: unknown) => new WalletKitError(
    WalletKitErrorCode.SIGN_FAILED,
    `Failed to sign request: ${getErrorMessage(cause)}`,
    { cause }
  ),
  signRejected: (cause?: unknown) => new WalletKitError(
    WalletKitErrorCode.SIGN_REJECTED,
    "Signing request was rejected",
    { cause }
  ),
  requestTimeout: (message: string, cause?: unknown) => new WalletKitError(
    WalletKitErrorCode.REQUEST_TIMEOUT,
    message,
    { cause }
  ),
  unsupportedMethod: (method: string, walletName?: string) => new WalletKitError(
    WalletKitErrorCode.UNSUPPORTED_METHOD,
    walletName ? `${method} is not supported by ${walletName}` : `${method} is not supported`,
    { details: { method, walletName } }
  ),
  invalidAdapter: (adapterId: string, issues: string[]) => new WalletKitError(
    WalletKitErrorCode.INVALID_ADAPTER,
    `Wallet adapter is invalid: ${adapterId}`,
    { details: { adapterId, issues } }
  ),
  networkMismatch: (walletName: string, expected?: string, actual?: string, cause?: unknown) => new WalletKitError(
    WalletKitErrorCode.NETWORK_MISMATCH,
    `${walletName} is connected to ${actual ?? "an unknown network"} but the app requested ${expected ?? "a different network"}`,
    { cause, details: { walletName, expected, actual } }
  ),
  networkNotSupported: (walletName: string, network?: string, cause?: unknown) => new WalletKitError(
    WalletKitErrorCode.NETWORK_NOT_SUPPORTED,
    `${walletName} does not support ${network ?? "the requested network"}`,
    { cause, details: { walletName, network } }
  ),
  notConnected: () => new WalletKitError(
    WalletKitErrorCode.NOT_CONNECTED,
    "No wallet is connected"
  ),
  alreadyConnected: (walletName: string) => new WalletKitError(
    WalletKitErrorCode.ALREADY_CONNECTED,
    `Already connected to ${walletName}`,
    { details: { walletName } }
  ),
  unknown: (cause?: unknown) => new WalletKitError(
    WalletKitErrorCode.UNKNOWN_ERROR,
    getErrorMessage(cause),
    { cause }
  )
};

export function normalizeWalletError(error: unknown): WalletKitError {
  if (isWalletKitError(error)) return error;
  const message = getErrorMessage(error).toLowerCase();

  if (/reject|denied|cancelled|canceled|closed/i.test(message)) {
    return createWalletError.signRejected(error);
  }
  if (/timeout|timed out/i.test(message)) {
    return createWalletError.requestTimeout(getErrorMessage(error), error);
  }
  if (/not installed|install .*wallet|provider is not available|not available/i.test(message)) {
    return createWalletError.walletNotAvailable("Wallet", error);
  }

  return createWalletError.unknown(error);
}
