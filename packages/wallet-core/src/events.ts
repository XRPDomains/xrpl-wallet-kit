import type { WalletEventHandler, WalletEventName, WalletEvents } from "./types";

export class WalletEventEmitter {
  private listeners = new Map<WalletEventName, Set<(event: unknown) => void>>();

  on<T extends WalletEventName>(eventName: T, handler: WalletEventHandler<T>): () => void {
    const bucket = this.listeners.get(eventName) ?? new Set<(event: unknown) => void>();
    bucket.add(handler as (event: unknown) => void);
    this.listeners.set(eventName, bucket);
    return () => this.off(eventName, handler);
  }

  off<T extends WalletEventName>(eventName: T, handler: WalletEventHandler<T>): void {
    this.listeners.get(eventName)?.delete(handler as (event: unknown) => void);
  }

  emit<T extends WalletEventName>(eventName: T, event: WalletEvents[T]): void {
    this.listeners.get(eventName)?.forEach((handler) => handler(event));
  }
}
