import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? "playwright");
const url = process.env.THEME_BUILDER_URL ?? "http://127.0.0.1:5174/xrpl-wallet-kit/docs/theme-builder.html";
const output = join(tmpdir(), "xwk-theme-builder-regression");
await mkdir(output, { recursive: true });
const bundle = await readFile(new URL("../packages/browser/dist/xrpl-wallet-kit.iife.min.js", import.meta.url), "utf8");
const instrumentation = `
(() => {
  const kit = window.XRPLWalletKit;
  window.__auditManagers = [];
  window.__auditAdapterCount = 0;
  const Manager = kit.WalletManager;
  if (${process.env.TEST_LEGACY_PANEL === "1"}) {
    const Button = kit.WalletButtonController;
    kit.WalletButtonController = class extends Button {
      constructor(options) { const { accountPanelMount, ...legacy } = options; super(legacy); }
    };
  }
  kit.WalletManager = class extends Manager {
    constructor(options) {
      super({ ...options, accountStatus: { enabled: false } });
      window.__auditManagers.push(this);
    }
  };
  const original = kit.createGemWalletAdapter;
  kit.createGemWalletAdapter = (...args) => {
    window.__auditAdapterCount += 1;
    const adapter = original(...args);
    adapter.isAvailable = async () => true;
    adapter.connect = async options => ({ account: { address: 'rAuditPreview', network: options.network } });
    adapter.disconnect = async () => {};
    return adapter;
  };
})();`;
const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || undefined });
try {
  for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 1000 }]) {
    const page = await browser.newPage({ viewport });
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.route("**/xrpl-wallet-kit.iife.min.js", route => route.fulfill({ contentType: "application/javascript", body: bundle + instrumentation }));
    await page.goto(url);
    await page.locator(".tb-connect-slot [data-xwk-wallet-button]").waitFor();
    await page.locator(".tb-root .xwk-modal").waitFor();
    assert.equal(await page.locator(".tb-back-btn").isVisible(), true);
    assert.equal(await page.evaluate(() => window.__auditManagers.length), 1);
    await page.screenshot({ path: join(output, `${viewport.width}-light.png`), fullPage: true });
    await page.evaluate(() => {
      const overlay = document.createElement("div");
      overlay.id = "audit-unrelated-overlay"; overlay.className = "xwk-overlay"; overlay.style.display = "none";
      document.body.appendChild(overlay);
      const style = document.createElement("style"); style.id = "audit-unrelated-style"; style.dataset.xwkStyle = "audit";
      document.head.appendChild(style);
    });
    if (viewport.width < 900) await page.getByRole("tab", { name: "Display", exact: true }).click();
    await page.locator(".tb-chip").filter({ hasText: /^Dark$/ }).click();
    await page.waitForFunction(() => document.querySelector(".tb-root .xwk-modal")?.textContent.includes("Xaman"));
    assert.equal(await page.evaluate(() => window.__auditManagers.length), 1);
    assert.equal(await page.evaluate(() => window.__auditAdapterCount), 1);
    assert.equal(await page.locator("#audit-unrelated-overlay").count(), 1);
    assert.equal(await page.locator("#audit-unrelated-style").count(), 1);
    await page.locator(".tb-root").evaluate(el => { el.scrollTop = 0; });
    await page.screenshot({ path: join(output, `${viewport.width}-dark.png`), fullPage: true });
    await page.evaluate(() => window.__auditManagers[0].connect("gemwallet"));
    await page.waitForFunction(() => document.querySelector(".tb-connect-slot")?.textContent.includes("rAudit"));
    await page.locator(".tb-connect-slot [data-xwk-wallet-button]").click();
    await page.locator(".tb-root .xwk-account-panel-modal").waitFor();
    assert.equal(await page.locator("body > .xwk-account-portal").count(), 0);
    if (viewport.width < 900) await page.getByRole("tab", { name: "Colors", exact: true }).click();
    const colors = page.locator(".tb-group-colors");
    if (!await colors.locator("input[type=color]").first().isVisible()) await colors.locator(".tb-group-hd").click();
    await colors.locator("input[type=color]").first().fill("#d92955");
    await page.waitForFunction(() => document.querySelector(".tb-connect-slot")?.textContent.includes("rAudit"));
    assert.equal(await page.evaluate(() => window.__auditManagers[0].getSession().account.address), "rAuditPreview");
    assert.equal(await page.evaluate(() => window.__auditManagers.length), 1);
    if (viewport.width < 900) await page.getByRole("tab", { name: "Wallets", exact: true }).click();
    await page.locator(".tb-wallet-option").filter({ hasText: "GemWallet" }).locator("input").uncheck();
    await page.waitForFunction(() => window.__auditManagers[0].getSession() === null);
    await page.locator(".tb-root .xwk-modal").waitFor();
    assert.equal(await page.locator(".tb-root .xwk-modal [data-wallet-id=gemwallet]").count(), 0);
    assert.equal(errors.length, 0, errors.join("\n"));
    await page.locator(".tb-back-btn").click();
    await page.waitForFunction(() => !document.querySelector(".tb-root"));
    assert.equal(await page.locator(".xwk-account-portal").count(), 0);
    console.log(JSON.stringify({ viewport, errors, passed: true }));
    await page.close();
  }
  console.log(`Screenshots: ${output}`);
} finally { await browser.close(); }
