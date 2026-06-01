import { Buffer } from "buffer";

if (typeof globalThis !== "undefined") {
  const global = globalThis as typeof globalThis & { Buffer?: typeof Buffer; __xwk_buffer_ready__?: true };
  global.__xwk_buffer_ready__ = true;
  if (!global.Buffer) {
    global.Buffer = Buffer;
  }
}
