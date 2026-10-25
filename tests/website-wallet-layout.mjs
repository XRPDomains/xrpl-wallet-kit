import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? "playwright");
const base = process.env.WEBSITE_URL ?? "http://127.0.0.1:5176/xrpl-wallet-kit/";
const bundle = await readFile(new URL("../packages/browser/dist/xrpl-wallet-kit.iife.min.js", import.meta.url));
const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH });
try {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    const page = await browser.newPage({ viewport });
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.route("**/xrpl-wallet-kit.iife.min.js", route => route.fulfill({ contentType: "application/javascript", body: bundle }));
    await page.goto(new URL("docs/theme-builder", base).href);
    await page.locator('.tb-root [data-wallet-id="joey-wallet"]').waitFor();
    const joey = page.locator(".tb-wallet-option").filter({ hasText: "Joey Wallet" }).locator("input");
    assert.equal(await joey.isChecked(), true);
    const layout = page.locator(".tb-section").filter({ has: page.getByText("Layout", { exact: true }) }).locator("select");
    assert.deepEqual(await layout.locator("option").evaluateAll(options => options.map(option => option.value)), ["auto", "list", "card", "icon"]);
    assert.equal(await layout.inputValue(), "auto");
    assert.match(await page.locator(".tb-code").textContent(), /layout: "auto"/);
    assert.match(await page.locator(".tb-code").textContent(), /"joey-wallet"/);
    await page.locator(".tb-root .xwk-layout-card").waitFor();
    await joey.uncheck();
    await page.waitForFunction(() => !document.querySelector('.tb-root [data-wallet-id="joey-wallet"]'));
    await joey.check();
    await page.locator('.tb-root [data-wallet-id="joey-wallet"]').waitFor();
    await page.locator(".tb-root").evaluate(root => { root.scrollTop = 0; });
    await page.waitForFunction(() => {
      const modal = document.querySelector(".tb-root .xwk-modal");
      const overlay = modal?.closest(".xwk-overlay");
      return modal && overlay && getComputedStyle(modal).opacity === "1" && getComputedStyle(overlay).opacity === "1";
    });
    await page.screenshot({ path: `tmp/theme-builder-auto-${viewport.width}.png`, fullPage: true });
    await page.locator("#tb-chain").selectOption("xahau");
    await page.locator(".tb-root .xwk-layout-list").waitFor();
    assert.equal(await page.locator('.tb-root [data-wallet-id="joey-wallet"]').count(), 0);
    await page.goto(new URL("docs/playground", base).href);
    await page.locator(".pg-code").waitFor();
    const choices = page.locator(".pg-chips").first().locator("button");
    assert.deepEqual(await choices.allTextContents().then(values => values.map(value => value.trim())), ["Auto", "List", "Card", "Icon"]);
    assert.equal(await choices.first().getAttribute("class"), "pg-chip active");
    assert.match(await page.locator(".pg-code").textContent(), /layout: "auto"/);
    assert.deepEqual(errors, []);
    console.log(`${viewport.width}px: Joey selection/preview, adaptive layout, Xahau filtering and Playground controls passed`);
    await page.close();
  }
} finally {
  await browser.close();
}
