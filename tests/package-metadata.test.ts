import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

function packageFiles(): string[] {
  const roots = ["packages", "packages/adapters"];
  return roots.flatMap((root) => readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(root, entry.name, "package.json"))
    .filter((file) => {
      try {
        readFileSync(file);
        return true;
      } catch {
        return false;
      }
    }));
}

test("publishable packages declare sideEffects metadata", () => {
  for (const file of packageFiles()) {
    const manifest = JSON.parse(readFileSync(file, "utf8")) as { name?: string; sideEffects?: unknown };
    assert.notEqual(manifest.sideEffects, undefined, `${manifest.name ?? file} must declare sideEffects`);
  }
});

test("selective client output does not import first-party adapters", () => {
  const output = readFileSync("packages/client/dist/selective.js", "utf8");
  assert.doesNotMatch(output, /@xrpl-wallet-kit\/adapter-/);
});
