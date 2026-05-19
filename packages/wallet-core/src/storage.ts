import type { WalletStorage } from "./types";

export class MemoryWalletStorage implements WalletStorage {
  private values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

export function createBrowserWalletStorage(prefix = "xrpname.wallet."): WalletStorage {
  return {
    getItem: (key) => (typeof localStorage === "undefined" ? null : localStorage.getItem(prefix + key)),
    setItem: (key, value) => {
      if (typeof localStorage !== "undefined") localStorage.setItem(prefix + key, value);
    },
    removeItem: (key) => {
      if (typeof localStorage !== "undefined") localStorage.removeItem(prefix + key);
    }
  };
}
