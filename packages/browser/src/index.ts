import { Buffer } from "buffer";
export * from "@xrpl-wallet-kit/client";
export { createWalletKit as create, createWalletClient as createClient } from "@xrpl-wallet-kit/client";
export type { CreateWalletKitOptions, CreateWalletClientOptions } from "@xrpl-wallet-kit/client";

if (typeof globalThis !== "undefined" && !("Buffer" in globalThis)) {
  (globalThis as typeof globalThis & { Buffer: typeof Buffer }).Buffer = Buffer;
}
