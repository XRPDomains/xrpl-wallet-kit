export type WalletKitLogLevel = "debug" | "info" | "warn" | "error" | "silent";

export interface WalletKitLogger {
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}

export interface WalletKitLoggerOptions {
  level?: WalletKitLogLevel;
  prefix?: string;
}

const levels: Record<Exclude<WalletKitLogLevel, "silent">, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40
};

export class ConsoleWalletKitLogger implements WalletKitLogger {
  private readonly level: WalletKitLogLevel;
  private readonly prefix: string;

  constructor(options: WalletKitLoggerOptions = {}) {
    this.level = options.level ?? "warn";
    this.prefix = options.prefix ?? "[XRPL Wallet Kit]";
  }

  debug(message: string, ...args: unknown[]): void {
    this.write("debug", message, args);
  }

  info(message: string, ...args: unknown[]): void {
    this.write("info", message, args);
  }

  warn(message: string, ...args: unknown[]): void {
    this.write("warn", message, args);
  }

  error(message: string, ...args: unknown[]): void {
    this.write("error", message, args);
  }

  private write(level: Exclude<WalletKitLogLevel, "silent">, message: string, args: unknown[]): void {
    if (this.level === "silent" || levels[level] < levels[this.level]) return;
    const target = console[level] as (message?: unknown, ...optionalParams: unknown[]) => void;
    target(`${this.prefix} ${message}`, ...args);
  }
}

export function createWalletKitLogger(logger?: WalletKitLogger | WalletKitLoggerOptions): WalletKitLogger {
  if (logger && "debug" in logger && "info" in logger && "warn" in logger && "error" in logger) {
    return logger;
  }
  return new ConsoleWalletKitLogger(logger);
}
