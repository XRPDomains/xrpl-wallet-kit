import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { Wallet } from "xrpl";
import { sign } from "ripple-keypairs";
import { encode, encodeForSigning, XrplDefinitions } from "xahau-binary-codec";
import definitionsData from "xahau-binary-codec/dist/enums/definitions.json" with { type: "json" };

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || "playwright");
const wallet = Wallet.generate();
const destination = Wallet.generate().address;
const definitions = new XrplDefinitions(structuredClone(definitionsData));
const assets = new Map();
for (const name of ["xrpl-wallet-kit.iife.min.js", "xrpl-wallet-kit-xahau.runtime.js"]) {
  assets.set(`/assets/${name}`, await readFile(`packages/browser/dist/${name}`));
}
let mode = "normal";
let runtimeRequests = 0;
let signatures = 0;
const server = createServer((req, res) => {
  res.setHeader("cache-control", "no-store");
  const path = new URL(req.url, "http://localhost").pathname;
  if (path === "/nested/page") {
    res.setHeader("content-type", "text/html");
    res.setHeader("content-security-policy", "default-src 'none'; script-src 'self'; connect-src 'self'");
    res.end('<!doctype html><title>Runtime smoke</title><script src="/assets/xrpl-wallet-kit.iife.min.js?version=pinned"></script>');
    return;
  }
  if (path.endsWith("xahau.runtime.js")) {
    runtimeRequests++;
    if (mode === "missing") { res.writeHead(404); res.end(); return; }
    if (mode === "mismatch") {
      res.setHeader("content-type", "text/javascript");
      res.end('export const browserBundleVersion = "wrong"; export function createXahauProtocol() { throw Error("must not execute"); }');
      return;
    }
  }
  const asset = assets.get(path);
  if (!asset) { res.writeHead(404); res.end(); return; }
  res.setHeader("content-type", "text/javascript"); res.end(asset);
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH });
try {
  for (mode of ["normal", "missing", "mismatch"]) {
    runtimeRequests = 0; signatures = 0;
    const context = await browser.newContext();
    try {
      const page = await context.newPage();
      await page.exposeFunction("signFixture", tx => {
        signatures++;
        return encode({ ...tx, TxnSignature: sign(encodeForSigning(tx, definitions), wallet.privateKey) }, definitions);
      });
      await page.goto(`http://127.0.0.1:${server.address().port}/nested/page`, { waitUntil: "networkidle" });
      assert.equal(runtimeRequests, 0, "XRPL-only load must not fetch Xahau");
      const result = await page.evaluate(async ({ address, publicKey, destination }) => {
        const kit = globalThis.XRPLWalletKit;
        const xrpl = kit.createClient({ network: "mainnet", adapters: [] });
        xrpl.destroy();
        let runtime;
        const adapter = { metadata: { id: "fixture", name: "Fixture", type: "web" },
          capabilities: { connect: true, signTransaction: true, details: { supportedChains: { families: ["xahau"] } } },
          connect: async options => { runtime = options.protocolContext; return { account: { address, publicKey, network: options.network } }; },
          signTransaction: async request => {
            const account = { address, publicKey };
            const tx = await runtime.protocol.prepare(request.txJson, account, runtime.network, request);
            const blob = await globalThis.signFixture(tx);
            const verified = runtime.protocol.verify(blob, tx, account, runtime.network, request);
            return { txBlob: verified.txBlob, signed: true };
          }
        };
        const manager = kit.createClient({ network: "xahau-testnet", adapters: [adapter], accountStatus: { enabled: false },
          xahau: { request: async (_network, method) => {
            if (method === "server_info") return { info: { network_id: 21338, validated_ledger: { seq: 100, age: 1 } } };
            if (method === "account_info") return { account_data: { Account: address, Sequence: 1 } };
            if (method === "fee") return { drops: { base_fee: "10", open_ledger_fee: "10" } };
            throw Error(`Unexpected RPC: ${method}`);
          } }
        });
        try {
          await manager.connect("fixture");
          const request = { txJson: { TransactionType: "Invoke", Destination: destination,
            HookParameters: [{ HookParameter: { HookParameterName: "AA", HookParameterValue: "BB" } }] }, maxFeeDrops: "100" };
          const signed = await manager.signTransaction(request);
          await manager.signTransaction(request);
          let sharedError = false;
          try { runtime.protocol.verify("AB", {}, { address }, runtime.network, request); }
          catch (error) { sharedError = error instanceof kit.WalletKitError; }
          return { networkId: runtime.protocol.decode(signed.txBlob).NetworkID,
            hasNft: runtime.protocol.transactionTypes.includes("URITokenBuy"), sharedError };
        } catch (error) { return { error: error.message, code: error.code }; }
        finally { manager.destroy(); }
      }, { address: wallet.address, publicKey: wallet.publicKey, destination });
      assert.equal(runtimeRequests, 1, "One runtime request from the script folder, not the HTML folder");
      if (mode === "normal") {
        assert.deepEqual(result, { networkId: 21338, hasNft: true, sharedError: true });
        assert.equal(signatures, 2);
      } else {
        assert.equal(result.code, "INVALID_REQUEST");
        assert.match(result.error, mode === "missing" ? /Unable to load Xahau/ : /version mismatch/);
        assert.equal(signatures, 0, "Runtime failure must stop before signing");
      }
    } finally { await context.close(); }
  }
  console.log("Browser Xahau runtime: lazy URL, CSP, version guard, shared errors and signed Invoke verified; failure paths never sign.");
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
