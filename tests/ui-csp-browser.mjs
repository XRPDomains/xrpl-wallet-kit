import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { createServer } from "vite";
import { createServer as createSocketServer } from "node:net";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? "playwright");
const root = resolve(".");
const reservation = createSocketServer();
await new Promise(resolve => reservation.listen(0, "127.0.0.1", resolve));
const port = reservation.address().port;
await new Promise(resolve => reservation.close(resolve));
const server = await createServer({ configFile: false, root, cacheDir: "tmp/csp-vite-cache", server: { host: "127.0.0.1", port, strictPort: true },
  optimizeDeps: { entries: ["tests/fixtures/csp.html"], include: ["vue", "qrcode", "qr-code-styling"] },
  resolve: { alias: { "@xrpl-wallet-kit/core": resolve("packages/core/src/index.ts"), "@xrpl-wallet-kit/ui": resolve("packages/ui/src/index.ts") } },
  plugins: [{ name: "enforced-csp", configureServer(server) {
    server.middlewares.use((request, response, next) => {
      // Vite's dev client is permitted; literal inline styles are not.
      response.setHeader("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'nonce-test-nonce'; style-src-attr 'none'; img-src 'self' data: blob:; connect-src 'self' ws:; font-src 'none'");
      next();
    });
  } }] });
let browser;
try {
  await server.listen();
  const address = server.httpServer.address();
  browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  const url = `http://127.0.0.1:${address.port}/tests/fixtures/csp.html`;
  await page.goto(`${url}?nonce=test-nonce`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForFunction(() => Boolean(window.fixture));
  await page.evaluate(() => window.fixture.modal.open());
  await page.locator(".xwk-modal").waitFor();
  assert.equal(await page.locator(".xwk-overlay").evaluate(element => getComputedStyle(element).position), "fixed");
  await page.locator('[data-wallet-id="mock"]').focus();
  await page.evaluate(() => window.fixture.manager.register({ metadata: { id: "late", name: "Late wallet", type: "extension" }, capabilities: { connect: true }, isAvailable: async () => true, connect: async () => { throw Error("not used"); } }));
  await page.locator('[data-wallet-id="late"]').waitFor();
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("data-wallet-id")), "mock");
  await page.evaluate(() => window.fixture.qr());
  await page.waitForFunction(() => Boolean(document.querySelector(".xwk-qr-code canvas, .xwk-qr-code img, .xwk-qr-code svg")));
  await page.evaluate(() => window.fixture.modal.close(false, false, false));
  await page.evaluate(() => window.fixture.manager.connect("mock"));
  await page.locator("#button button[data-xwk-wallet-button]").click();
  await page.locator(".xwk-account-panel").waitFor();
  await page.evaluate(() => {
    window.vueFixture = window.fixture.mountVue();
  });
  await page.locator("#vue button").waitFor();
  assert.equal(await page.locator("#vue output").textContent(), "disconnected");
  await page.evaluate(() => window.vueFixture.manager.emit("connecting", { adapterId: "mock" }));
  await page.waitForFunction(() => document.querySelector("#vue output")?.textContent === "connecting");
  await page.evaluate(() => {
    window.vueFixture.dispose();
    if (window.vueFixture.manager.isDestroyed) throw Error("Vue unmount destroyed caller-owned manager");
    window.vueFixture.manager.destroy();
  });
  assert.deepEqual(await page.evaluate(() => window.fixture.violations), []);
  assert.deepEqual(errors, []);
  await page.evaluate(() => { window.fixture.button.destroy(); window.fixture.modal.destroy(); window.fixture.manager.destroy(); });
  // A missing or wrong nonce must actually fail, not pass a mock DOM test.
  for (const nonce of ["", "wrong"]) {
    await page.goto(`${url}?nonce=${nonce}`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForFunction(() => Boolean(window.fixture));
    await page.evaluate(() => window.fixture.modal.open());
    assert.notEqual(await page.locator(".xwk-overlay").evaluate(element => getComputedStyle(element).position), "fixed");
  }
  console.log("CSP modal, QR, account panel, Vue mount/unmount, focus preservation and negative controls passed.");
} finally {
  await browser?.close();
  await server.close();
}
