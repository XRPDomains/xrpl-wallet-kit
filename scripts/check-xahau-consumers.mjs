import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import assert from "node:assert/strict";
import { build, preview } from "vite";
import inject from "@rollup/plugin-inject";
import { createRequire } from "node:module";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const fixture = resolve(root, "tmp/xahau-consumer-smoke");
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || "playwright");
const expression = `const protocol = createXahauProtocol();
const tx = { TransactionType: "Invoke", Account: "rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh", NetworkID: 21338,
  HookParameters: [{ HookParameter: { HookParameterName: "AA", HookParameterValue: "BB" } }] };
const decoded = protocol.decode(protocol.encode(tx));
if (decoded.NetworkID !== 21338 || decoded.HookParameters[0].HookParameter.HookParameterValue !== "BB") throw new Error("Codec lost chain fields");`;
await mkdir(resolve(fixture, "vite"), { recursive: true });
await writeFile(resolve(fixture, "vite/index.html"), '<div id="result"></div><script type="module" src="/main.js"></script>');
await writeFile(resolve(fixture, "vite/main.js"), `import { Buffer } from "buffer"; globalThis.Buffer = Buffer;
const { createXahauProtocol } = await import("@xrpl-wallet-kit/xahau");
${expression}
document.getElementById("result").textContent = "xahau-vite-ok";`);
await build({ configFile: false, root: resolve(fixture, "vite"), logLevel: "warn",
  plugins: [inject({ Buffer: ["buffer", "Buffer"] })], build: { target: "es2022" } });
const server = await preview({ configFile: false, root: resolve(fixture, "vite"), server: { host: "127.0.0.1" }, preview: { host: "127.0.0.1", port: 0 } });
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(server.resolvedUrls.local[0]);
  await page.locator("#result").filter({ hasText: "xahau-vite-ok" }).waitFor();
  assert.deepEqual(errors, []);
  console.log("Vite production browser: passed (Invoke + HookParameters codec)");
} finally { await browser.close(); await new Promise(resolve => server.httpServer.close(resolve)); }

const nextRoot = resolve(fixture, "next");
await mkdir(resolve(nextRoot, "app"), { recursive: true });
await writeFile(resolve(nextRoot, "package.json"), JSON.stringify({ name: "xahau-next-smoke", private: true }));
await writeFile(resolve(nextRoot, "next.config.mjs"), `export default { experimental: { cpus: 1 }, poweredByHeader: false };`);
await writeFile(resolve(nextRoot, "app/layout.jsx"), 'export default function Layout({children}) { return <html><body>{children}</body></html>; }');
await writeFile(resolve(nextRoot, "app/page.jsx"), `import { createXahauProtocol } from "@xrpl-wallet-kit/xahau";
${expression}
export default function Page() { return <main>xahau-next-ssr-ok:{decoded.NetworkID}</main>; }`);
await new Promise((resolve, reject) => {
  const child = spawn(process.execPath, [require.resolve("next/dist/bin/next"), "build", "--webpack"], {
    cwd: nextRoot, stdio: "inherit", env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" }
  });
  child.on("error", reject);
  child.on("exit", code => code === 0 ? resolve() : reject(new Error(`Next build exited ${code}`)));
});
console.log("Next production SSR/prerender: passed (Invoke + HookParameters codec)");
assert.match(await readFile(resolve(nextRoot, ".next/server/app/index.html"), "utf8"), /xahau-next-ssr-ok:.*21338/);
