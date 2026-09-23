import { Buffer as BrowserBuffer } from "buffer";

if (typeof globalThis !== "undefined") {
  const global = globalThis as typeof globalThis & { Buffer?: typeof BrowserBuffer; __xwk_buffer_ready__?: true };
  global.__xwk_buffer_ready__ = true;
  if (!global.Buffer) {
    global.Buffer = BrowserBuffer;
  }
}

export * from "@xrpl-wallet-kit/client";
export { createWalletKit as create, createWalletClient as createClient } from "@xrpl-wallet-kit/client";
export type { CreateWalletKitOptions, CreateWalletClientOptions } from "@xrpl-wallet-kit/client";
