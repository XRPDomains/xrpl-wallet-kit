import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const source = ts.transpileModule(readFileSync("website/.vitepress/theme/loadWalletKit.ts", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;

const releaseVersion = JSON.parse(readFileSync("packages/browser/package.json", "utf8")).version;

function fixture(outcomes: Array<"ok" | "network" | "invalid">) {
  const host: Record<string, any> = {};
  const urls: string[] = [];
  const exports: Record<string, any> = {};
  const sdk = { createGhostsigAdapter() {}, createJoeyWalletAdapter() {}, createXyraAdapter() {}, XAHAU_NETWORKS: [{ id: "xahau-mainnet" }] };
  runInNewContext(source, {
    exports, require: () => ({ version: releaseVersion }), window: host,
    fetch: async () => { throw new Error("The pinned loader must not probe @latest"); },
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

test("website uses and reuses the pinned release without probing latest", async () => {
  const { load, urls, sdk } = fixture(["ok"]);
  assert.equal(await load(), sdk);
  assert.equal(await load(), sdk);
  assert.equal(urls.length, 1);
  assert.equal(urls[0], `https://cdn.jsdelivr.net/npm/@xrpl-wallet-kit/browser@${releaseVersion}/dist/xrpl-wallet-kit.iife.min.js`);
});

test("website loads the pinned release once for concurrent widgets", async () => {
  const { load, urls, sdk } = fixture(["ok"]);
  const results = await Promise.all([load(), load()]);
  assert.ok(results.every(result => result === sdk));
  assert.equal(urls.length, 1);
  assert.ok(urls[0].includes(`@${releaseVersion}/`));
});

test("website falls back once after a resource error and reuses the fallback", async () => {
  const { load, urls, sdk } = fixture(["network", "ok"]);
  assert.equal(await load(), sdk);
  assert.equal(await load(), sdk);
  assert.equal(urls.length, 2);
  assert.equal(urls[1], `https://unpkg.com/@xrpl-wallet-kit/browser@${releaseVersion}/dist/xrpl-wallet-kit.iife.min.js`);
});

test("website reports the failing URL when both CDNs fail, and permits a later retry", async () => {
  const { load, urls, sdk } = fixture(["network", "network", "ok"]);
  await assert.rejects(load(), /Failed to load XRPL Wallet Kit: https:\/\/unpkg\.com.*Network\/CSP/);
  assert.equal(await load(), sdk);
  assert.equal(urls.length, 3);
});

test("website never executes a second SDK after a feature mismatch", async () => {
  const { load, urls } = fixture(["invalid", "ok"]);
  await assert.rejects(load(), /missing current wallet or chain support/);
  await assert.rejects(load(), /Reload the page/);
  assert.equal(urls.length, 1);
});
