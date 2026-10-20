import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const source = ts.transpileModule(readFileSync("website/.vitepress/theme/loadWalletKit.ts", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;

function fixture(outcomes: Array<"ok" | "network" | "invalid">, currentLatest = false) {
  const host: Record<string, any> = {};
  const urls: string[] = [];
  const exports: Record<string, any> = {};
  const sdk = { createGhostsigAdapter() {}, createXyraAdapter() {}, XAHAU_NETWORKS: [{ id: "xahau-mainnet" }] };
  runInNewContext(source, {
    exports, require: () => ({ version: "0.2.0" }), window: host,
    fetch: async () => ({ ok: true, text: async () => currentLatest ? "createGhostsigAdapter createXyraAdapter xahau-mainnet" : "old bundle" }),
    document: {
      createElement: () => ({ remove() {} }),
      head: { appendChild(script: any) {
        urls.push(script.src);
        const outcome = outcomes.shift();
        queueMicrotask(() => {
          if (outcome === "network") script.onerror();
          else {
            host.XRPLWalletKit = outcome === "ok" ? sdk : {};
            script.onload();
          }
        });
      } }
    }
  });
  return { load: exports.loadWalletKit as () => Promise<any>, urls, sdk };
}

test("website uses the pinned release while latest lacks Xyra, then reuses it", async () => {
  const { load, urls, sdk } = fixture(["ok"]);
  assert.equal(await load(), sdk);
  assert.equal(await load(), sdk);
  assert.equal(urls.length, 1);
  assert.match(urls[0], /jsdelivr.*@0\.2\.0\//);
});

test("website loads current latest once for concurrent widgets", async () => {
  const { load, urls, sdk } = fixture(["ok"], true);
  const results = await Promise.all([load(), load()]);
  assert.ok(results.every(result => result === sdk));
  assert.equal(urls.length, 1);
  assert.match(urls[0], /@latest\//);
});

test("website falls back once after a resource error and reuses the fallback", async () => {
  const { load, urls, sdk } = fixture(["network", "ok"]);
  assert.equal(await load(), sdk);
  assert.equal(await load(), sdk);
  assert.equal(urls.length, 2);
  assert.match(urls[1], /^https:\/\/unpkg\.com\/@xrpl-wallet-kit\/browser@0\.2\.0\//);
});

test("website reports the failing URL when both CDNs fail, and permits a later retry", async () => {
  const { load, urls, sdk } = fixture(["network", "network", "ok"]);
  await assert.rejects(load(), /Failed to load XRPL Wallet Kit: https:\/\/unpkg\.com.*Network\/CSP/);
  assert.equal(await load(), sdk);
  assert.equal(urls.length, 3);
});

test("website never executes a second SDK after a feature mismatch", async () => {
  const { load, urls } = fixture(["invalid", "ok"]);
  await assert.rejects(load(), /missing Xyra or Xahau support/);
  await assert.rejects(load(), /Reload the page/);
  assert.equal(urls.length, 1);
});
