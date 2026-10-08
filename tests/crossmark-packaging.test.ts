import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { checkCrossmarkArtifact, checkCrossmarkRuntime } from "../scripts/prepare-crossmark-package.mjs";

function metadata(imports: Array<{ path: string; external: boolean }> = []) {
  const inputs: Record<string, object> = { "packages/adapters/crossmark/dist/index.js": {}, "node_modules/@crossmarkio/sdk/pack/umd/index.js": {} };
  return { inputs,
    outputs: { "index.js": { imports } } };
}

test("Crossmark manifest keeps SDK/typings out of runtime dependencies", () => {
  const manifest = JSON.parse(readFileSync("packages/adapters/crossmark/package.json", "utf8"));
  assert.deepEqual(Object.keys(manifest.dependencies), ["@xrpl-wallet-kit/core"]);
  assert.equal(manifest.devDependencies["@crossmarkio/sdk"], "0.4.0");
  assert.ok(manifest.scripts.prepack);
  assert.ok(manifest.files.includes("THIRD_PARTY_NOTICES.md"));
});

test("Crossmark artifact guard accepts only core declaration/runtime imports", () => {
  checkCrossmarkArtifact('import { BaseWalletAdapter } from "@xrpl-wallet-kit/core";', metadata([{ path: "@xrpl-wallet-kit/core", external: true }]));
  for (const declarations of [
    'import type { Sdk } from "@crossmarkio/sdk";',
    'export type { Response } from "@crossmarkio/typings";',
    'type Legacy = import("xrpl").Transaction;',
    '/// <reference types="node-forge" />\nexport {};'
  ]) assert.throws(() => checkCrossmarkArtifact(declarations, metadata()), /declarations/);
  assert.throws(() => checkCrossmarkArtifact("export {};", metadata([{ path: "@crossmarkio/sdk", external: true }])), /runtime dependency/);
});

test("Crossmark artifact guard rejects legacy ledger/crypto bundle inputs", () => {
  for (const input of ["node_modules/node-forge/index.js", "node_modules/elliptic/index.js", "node_modules/@crossmarkio/typings/index.js", "node_modules/xrpl/index.js", "node_modules/@crossmarkio/sdk/node_modules/node-forge/index.js", "node_modules\\@crossmarkio\\sdk\\node_modules\\elliptic\\index.js"]) {
    const result = metadata(); result.inputs[input] = {};
    assert.throws(() => checkCrossmarkArtifact("export {};", result), /bundled Crossmark dependency/);
  }
});

test("Crossmark runtime guard rejects unprepared imports without executing code", () => {
  checkCrossmarkRuntime('import { BaseWalletAdapter } from "@xrpl-wallet-kit/core"; export class Adapter extends BaseWalletAdapter {}');
  for (const runtime of ['import sdk from "@crossmarkio/sdk";', 'const sdk = require("@crossmarkio/sdk");', 'const sdk = import("@crossmarkio/sdk");']) {
    assert.throws(() => checkCrossmarkRuntime(runtime), /runtime dependency/);
  }
});
