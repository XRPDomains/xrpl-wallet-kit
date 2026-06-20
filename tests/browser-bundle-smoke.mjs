import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { TextDecoder, TextEncoder } from "node:util";
import vm from "node:vm";

const bundlePath = resolve("packages/browser/dist/xrpl-wallet-kit.iife.js");
const code = await readFile(bundlePath, "utf8");

class SmokeWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;
  readyState = SmokeWebSocket.CLOSED;
  addEventListener() {}
  removeEventListener() {}
  close() {}
  send() {}
}

class SmokeHTMLElement {}
class SmokeCSSStyleSheet {
  replaceSync() {}
}

const context = {
  console,
  setTimeout,
  clearTimeout,
  setInterval,
  clearInterval,
  TextDecoder,
  TextEncoder,
  WebSocket: SmokeWebSocket,
  HTMLElement: SmokeHTMLElement,
  CSSStyleSheet: SmokeCSSStyleSheet,
  customElements: {
    define() {},
    get() {
      return undefined;
    }
  },
  navigator: {
    userAgent: "XRPL Wallet Kit Smoke Test",
    platform: "Win32",
    maxTouchPoints: 0
  },
  location: {
    origin: "https://example.test",
    hostname: "example.test",
    protocol: "https:"
  },
  document: {
    createElement: () => ({ style: {}, setAttribute() {}, appendChild() {}, remove() {} }),
    createTreeWalker: () => ({
      nextNode: () => null,
      currentNode: null
    }),
    head: { appendChild() {} },
    body: { appendChild() {} },
    querySelectorAll: () => [],
    addEventListener() {},
    removeEventListener() {},
    visibilityState: "visible"
  },
  addEventListener() {},
  removeEventListener() {},
  matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} })
};
context.window = context;
context.self = context;
context.globalThis = context;

vm.createContext(context);
vm.runInContext(code, context, { filename: bundlePath });

assert.equal(context.__xwk_buffer_ready__, true);
assert.equal(typeof context.Buffer, "function");
assert.equal(typeof context.XRPLWalletKit, "object");
assert.equal(typeof context.XRPLWalletKit.create, "function");
assert.equal(typeof context.XRPLWalletKit.createClient, "function");
assert.equal(context.XRPLWalletKit.WalletButton, context.XRPLWalletKit.WalletButtonController);
assert.equal(typeof context.XRPLWalletKit.WalletButton, "function");
