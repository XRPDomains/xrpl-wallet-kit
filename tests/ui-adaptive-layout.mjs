import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? "playwright");
const bundle = await readFile(new URL("../packages/browser/dist/xrpl-wallet-kit.iife.min.js", import.meta.url), "utf8");
const server = createServer((_request, response) => {
  response.setHeader("Content-Type", "text/html");
  response.end("<!doctype html><html><body></body></html>");
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH });
try {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.addScriptTag({ content: bundle });
  await page.evaluate(() => {
    const kit = window.XRPLWalletKit;
    const instance = kit.createWalletKit({ network: "mainnet", accountStatus: { enabled: false }, ui: { walletList: { layout: "auto" } }, adapters: Array.from({ length: 10 }, (_, index) => ({
      metadata: { id: `wallet-${index}`, name: `Wallet ${index}`, type: "extension" },
      capabilities: { connect: true }, isAvailable: async () => true,
      connect: async () => { throw Error("No signing in layout tests"); },
    })) });
    window.fixture = instance;
  });
  for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 700 }]) {
    await page.setViewportSize(viewport);
    await page.evaluate(() => window.fixture.modal.open());
    await page.locator(".xwk-layout-card").waitFor();
    const snapshot = () => page.locator(".xwk-modal").evaluate(modal => {
      const grid = modal.querySelector(".xwk-grid");
      const wallet = grid.querySelector("button");
      return { columns: getComputedStyle(grid).gridTemplateColumns, height: wallet.offsetHeight, width: wallet.offsetWidth, html: grid.innerHTML };
    });
    const auto = await snapshot();
    assert.equal(auto.columns.split(" ").length, 3);
    await page.locator('[data-wallet-id="wallet-0"]').focus();
    await page.evaluate(() => window.fixture.modal.updateOptions({ walletList: { layout: "card" } }));
    assert.deepEqual(await snapshot(), auto);
    assert.equal(await page.evaluate(() => document.activeElement?.dataset.walletId), "wallet-0");
    await page.evaluate(() => window.fixture.modal.updateOptions({ walletList: { layout: "list" } }));
    await page.locator(".xwk-layout-list").waitFor();
    await page.evaluate(() => window.fixture.modal.updateOptions({ walletList: { layout: "auto", wallets: ["wallet-0", "wallet-1"] } }));
    await page.waitForTimeout(100);
    assert.equal(await page.locator(".xwk-layout-list").count(), 1);
    await page.evaluate(() => window.fixture.modal.close(false, false, false));
    await page.evaluate(() => window.fixture.modal.updateOptions({ walletList: { layout: "auto" } }));
  }
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.evaluate(() => {
    window.fixture.modal.updateOptions({ walletList: { layout: "auto", wallets: ["wallet-0", "wallet-1", "wallet-2", "wallet-3"] } });
    window.fixture.modal.open();
  });
  await page.locator(".xwk-layout-list").waitFor();
  await page.setViewportSize({ width: 390, height: 350 });
  await page.locator(".xwk-layout-card").waitFor();
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.locator(".xwk-layout-list").waitFor();
  await page.evaluate(() => { window.fixture.modal.destroy(); window.fixture.manager.destroy(); });
  await page.setViewportSize({ width: 390, height: 700 });
  assert.equal(await page.locator(".xwk-overlay").count(), 0);
  assert.deepEqual(errors, []);
  console.log("Adaptive/native Card parity, fixed layouts, focus, filtering, resize and teardown passed.");
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
