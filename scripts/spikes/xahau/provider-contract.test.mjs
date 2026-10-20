import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import ts from "typescript";

const require = createRequire(import.meta.url);
const gemRoot = dirname(require.resolve("@gemwallet/api"));
const cwd = dirname(fileURLToPath(import.meta.url));

test("released GemWallet 3.8.0 network reply declares chain/network/websocket, not networkID", () => {
  const path = join(gemRoot, "_constants", "payload", "payload.types.d.ts");
  const source = ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true);
  const declaration = source.statements.find(node => ts.isInterfaceDeclaration(node) && node.name.text === "GetNetworkResponse");
  assert.ok(declaration);
  const reply = declaration.heritageClauses[0].types[0].typeArguments[0];
  assert.ok(ts.isTypeLiteralNode(reply));
  const fields = reply.members.map(member => member.name.getText(source));
  assert.deepEqual(fields, ["chain", "network", "websocket"]);
  assert.equal(fields.includes("networkID"), false);
});

test("Xyra 0.3.0 artifact import is not SSR-safe; do not replace the deferred custom boundary", () => {
  assert.throws(() => execFileSync(process.execPath, ["--input-type=module", "-e", "await import('@xyrawallet/sdk')"], { cwd, stdio: "pipe" }),
    error => String(error.stderr).includes("window is not defined"));
});

test("Xyra released runtime accepts explicit Xahau presets before its popup boundary, not the shorthand alias", () => {
  execFileSync(process.execPath, ["--input-type=module", "-e", `
    import assert from 'node:assert/strict';
    globalThis.window = {
      screen: { width: 1280, height: 800 }, addEventListener() {}, removeEventListener() {},
      open() { assert.fail('OFFLINE_POPUP_BOUNDARY'); }
    };
    const { XyraSDK } = await import('@xyrawallet/sdk');
    const sdk = new XyraSDK();
    for (const network of ['xahau-mainnet', 'xahau-testnet']) {
      await assert.rejects(sdk.connect({ network }), /OFFLINE_POPUP_BOUNDARY/);
      await assert.rejects(sdk.sign({ network, transaction: {} }), /OFFLINE_POPUP_BOUNDARY/);
    }
    await assert.rejects(sdk.connect({ network: 'xahau' }), { code: 'INVALID_NETWORK' });
    sdk.destroy();
  `], { cwd, stdio: "pipe" });
});
