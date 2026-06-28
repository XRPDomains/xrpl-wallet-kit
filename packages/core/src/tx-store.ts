import { createBrowserWalletStorage } from "./storage";
import type { WalletStorage, WalletTransaction } from "./types";

const DEFAULT_MAX_TRANSACTIONS = 10;
const DEFAULT_STALE_SUBMITTED_MS = 10 * 60 * 1000;

export interface WalletTransactionStoreOptions {
  max?: number;
  staleSubmittedMs?: number;
  storage?: WalletStorage;
  now?: () => number;
}

export class WalletTransactionStore {
  private readonly max: number;
  private readonly staleSubmittedMs: number;
  private readonly storage: WalletStorage;
  private readonly now: () => number;

  constructor(options: WalletTransactionStoreOptions = {}) {
    this.max = Math.max(1, Math.floor(options.max ?? DEFAULT_MAX_TRANSACTIONS));
    this.staleSubmittedMs = Math.max(0, options.staleSubmittedMs ?? DEFAULT_STALE_SUBMITTED_MS);
    this.storage = options.storage ?? createBrowserWalletStorage("");
    this.now = options.now ?? Date.now;
  }

  async get(accountAddress: string, networkId: string): Promise<WalletTransaction[]> {
    const transactions = this.normalize(await this.readList(this.key(networkId, accountAddress)));
    const now = this.now();
    let changed = false;
    const normalized = transactions.map((transaction) => {
      if (
        transaction.status === "submitted"
        && this.staleSubmittedMs > 0
        && now - transaction.submittedAt > this.staleSubmittedMs
      ) {
        changed = true;
        return { ...transaction, status: "unknown" as const };
      }
      return transaction;
    });
    if (changed) await this.writeList(this.key(networkId, accountAddress), normalized);
    return normalized;
  }

  async add(accountAddress: string, networkId: string, transaction: WalletTransaction): Promise<void> {
    const key = this.key(networkId, accountAddress);
    const current = await this.readList(key);
    const withoutDuplicate = current.filter((item) => item.hash !== transaction.hash);
    const next = this.normalize([transaction, ...withoutDuplicate]).slice(0, this.max);
    await this.writeList(key, next);
    await this.addIndex(accountAddress, networkId);
  }

  async clear(accountAddress: string, networkId?: string): Promise<void> {
    if (networkId) {
      await this.storage.removeItem(this.key(networkId, accountAddress));
      return;
    }
    const index = await this.readIndex(accountAddress);
    await Promise.all(index.map((id) => this.storage.removeItem(this.key(id, accountAddress))));
    await this.storage.removeItem(this.indexKey(accountAddress));
  }

  private normalize(transactions: WalletTransaction[]): WalletTransaction[] {
    return transactions
      .filter((transaction) => typeof transaction.hash === "string" && transaction.hash.length > 0)
      .sort((a, b) => this.timestamp(b) - this.timestamp(a));
  }

  private timestamp(transaction: WalletTransaction): number {
    return transaction.confirmedAt ?? transaction.failedAt ?? transaction.submittedAt ?? 0;
  }

  private async readList(key: string): Promise<WalletTransaction[]> {
    try {
      const raw = await this.storage.getItem(key);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as unknown;
      return Array.isArray(parsed) ? parsed.filter(this.isStoredTransaction) : [];
    } catch {
      return [];
    }
  }

  private async writeList(key: string, transactions: WalletTransaction[]): Promise<void> {
    await this.storage.setItem(key, JSON.stringify(transactions.slice(0, this.max)));
  }

  private async addIndex(accountAddress: string, networkId: string): Promise<void> {
    const current = await this.readIndex(accountAddress);
    if (current.includes(networkId)) return;
    await this.storage.setItem(this.indexKey(accountAddress), JSON.stringify([...current, networkId]));
  }

  private async readIndex(accountAddress: string): Promise<string[]> {
    try {
      const raw = await this.storage.getItem(this.indexKey(accountAddress));
      if (!raw) return [];
      const parsed = JSON.parse(raw) as unknown;
      return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string") : [];
    } catch {
      return [];
    }
  }

  private isStoredTransaction(value: unknown): value is WalletTransaction {
    if (!value || typeof value !== "object") return false;
    const transaction = value as Partial<WalletTransaction>;
    return typeof transaction.hash === "string"
      && typeof transaction.status === "string"
      && typeof transaction.submittedAt === "number";
  }

  private key(networkId: string, accountAddress: string): string {
    return `xwk_tx:${networkId}:${accountAddress}`;
  }

  private indexKey(accountAddress: string): string {
    return `xwk_tx_index:${accountAddress}`;
  }
}
