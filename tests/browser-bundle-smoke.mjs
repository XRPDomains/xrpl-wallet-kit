import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { TextDecoder, TextEncoder } from "node:util";
import vm from "node:vm";
import { Wallet } from "xrpl";

const bundlePath = resolve(process.argv[2] ?? "packages/browser/dist/xrpl-wallet-kit.iife.js");
const code = await readFile(bundlePath, "utf8");

for (const expectedText of ["Connect Wallet", "Copy address", "Disconnect", "Recent transactions"]) {
  assert.ok(code.includes(expectedText), `browser bundle should include UI text: ${expectedText}`);
}
assert.doesNotMatch(code, /broken\s*—\s*truncated|truncated mid-string/i);

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
  structuredClone,
  Event,
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
assert.equal(typeof context.XRPLWalletKit.startWalletStandardDiscovery, "function");
assert.equal(typeof context.XRPLWalletKit.createWalletStandardWallet, "function");
assert.equal(typeof context.XRPLWalletKit.WalletStandardAdapter, "function");
assert.equal(typeof context.XRPLWalletKit.combineMultisignContributions, "function");
assert.equal(typeof context.XRPLWalletKit.submitMultisignTransaction, "function");
const multisignOwner = Wallet.generate();
const multisignWallet = Wallet.generate();
const preparedMultisign = {
  TransactionType: "Payment", Account: multisignOwner.classicAddress,
  Destination: multisignWallet.classicAddress, Amount: "1", Fee: "20",
  Sequence: 1, LastLedgerSequence: 100, SigningPubKey: ""
};
const multisignResult = await context.XRPLWalletKit.combineMultisignContributions(
  preparedMultisign, [multisignWallet.sign(preparedMultisign, true).tx_blob],
  { account: multisignOwner.classicAddress, quorum: 1, baseFeeDrops: "10",
    signers: [{ account: multisignWallet.classicAddress, weight: 1, publicKeys: [multisignWallet.publicKey] }] }
);
assert.equal(multisignResult.quorumMet, true);
assert.equal(multisignResult.feeSufficient, true);
assert.equal(multisignResult.signerAccounts[0], multisignWallet.classicAddress);
vm.runInContext(`{
  const kit = new XRPLWalletKit.WalletManager({ logger: { level: "silent" } });
  const network = { id: "testnet", name: "Testnet", networkType: "TESTNET", rpcUrl: "wss://example.invalid", walletConnectChainId: "xrpl:1" };
  const wallet = XRPLWalletKit.createWalletStandardWallet({
    metadata: { id: "smoke-standard", name: "Smoke Standard", type: "extension" },
    capabilities: { connect: true },
    connect: async () => { throw new Error("Discovery must not prompt"); }
  }, { networks: [network], icon: "data:image/png;base64,YQ==" });
  const discovery = XRPLWalletKit.startWalletStandardDiscovery(kit, {
    registry: { get: () => [wallet], on: () => () => {} }
  });
  if (kit.getWallets().length !== 1) throw new Error("Browser discovery failed");
  discovery.dispose();
  if (kit.getWallets().length !== 0) throw new Error("Browser discovery cleanup failed");
  kit.destroy();
}`, context);
assert.equal(context.XRPLWalletKit.WalletButton, context.XRPLWalletKit.WalletButtonController);
assert.equal(typeof context.XRPLWalletKit.WalletButton, "function");
