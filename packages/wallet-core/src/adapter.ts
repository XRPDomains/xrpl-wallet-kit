import type { WalletAdapter, WalletMetadata } from "./types";

export abstract class BaseWalletAdapter implements WalletAdapter {
  abstract metadata: WalletMetadata;
  abstract capabilities: WalletAdapter["capabilities"];
  abstract connect(...args: Parameters<WalletAdapter["connect"]>): ReturnType<WalletAdapter["connect"]>;

  async disconnect(): Promise<void> {
    return undefined;
  }

  protected unsupported(method: string): never {
    throw new Error(`${method} is not supported by ${this.metadata.name}`);
  }
}
