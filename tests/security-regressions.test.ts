import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sanitizeWalletUrl } from "../packages/core/src/index";

test("wallet URL sanitizer blocks executable schemes and unsafe data payloads", () => {
  for (const value of ["javascript:alert(1)", "vbscript:msgbox(1)", "data:text/html,<svg/onload=alert(1)>", "blob:https://evil.test/id"]) {
    assert.equal(sanitizeWalletUrl(value, { allowDataImage: true }), undefined);
  }
  assert.equal(sanitizeWalletUrl("https://wallet.example/icon.png", { allowDataImage: true }), "https://wallet.example/icon.png");
  assert.equal(sanitizeWalletUrl("xaman://xumm.app/sign/123"), "xaman://xumm.app/sign/123");
});

test("delegated WalletConnect marks the active request before modal teardown", async () => {
  const source = await readFile(new URL("../packages/ui/src/modal.ts", import.meta.url), "utf8");
  const delegatedBranch = source.slice(source.indexOf("if (this.shouldDelegateToWalletConnectModal"), source.indexOf("await this.options.manager.connect(id);", source.indexOf("if (this.shouldDelegateToWalletConnectModal")));
  assert.ok(delegatedBranch.indexOf("this.activeRequestAdapterId = id") < delegatedBranch.indexOf("this.close(false, false, false)"));
});

test("legacy fallback renders caller labels through textContent", async () => {
  const source = await readFile(new URL("../packages/browser/legacy/xrpl-wallet-kit-legacy-bridge.js", import.meta.url), "utf8");
  assert.match(source, /querySelector\('\.xwk-legacy-label'\)\.textContent = label/);
  assert.doesNotMatch(source, /xwk-legacy-label[^\n]+\+ label/);
});
