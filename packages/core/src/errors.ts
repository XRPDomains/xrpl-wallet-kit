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
  NOT_CONNECTED = "NOT_CONNECTED",
  ALREADY_CONNECTED = "ALREADY_CONNECTED",
  UNKNOWN_ERROR = "UNKNOWN_ERROR"
}

export class WalletKitError extends Error {
  readonly code: WalletKitErrorCode;
  readonly cause?: unknown;
  readonly details?: Record<string, unknown>;

  constructor(code: WalletKitErrorCode, message: string, options: { cause?: unknown; details?: Record<string, unknown> } = {}) {
    super(message);
    this.name = "WalletKitError";
    this.code = code;
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
