import type { WalletAdapter, WalletMetadata } from "./types";
import { createWalletError } from "./errors";

export abstract class BaseWalletAdapter implements WalletAdapter {
  abstract metadata: WalletMetadata;
  abstract capabilities: WalletAdapter["capabilities"];
  abstract connect(...args: Parameters<WalletAdapter["connect"]>): ReturnType<WalletAdapter["connect"]>;
  private cleanupHandlers: Array<() => void | Promise<void>> = [];

  async disconnect(): Promise<void> {
    await this.runCleanup();
  }

  protected unsupported(method: string): never {
    throw createWalletError.unsupportedMethod(method, this.metadata.name);
  }

  protected addCleanup(handler: () => void | Promise<void>): () => void {
    this.cleanupHandlers.push(handler);
    return () => {
      this.cleanupHandlers = this.cleanupHandlers.filter((item) => item !== handler);
    };
  }

  protected async runCleanup(): Promise<void> {
    const handlers = [...this.cleanupHandlers].reverse();
    this.cleanupHandlers = [];
    for (const handler of handlers) {
      await handler();
    }
  }
}
