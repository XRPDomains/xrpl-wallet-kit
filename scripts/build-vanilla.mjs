/**
 * build-vanilla.mjs
 *
 * Production build for examples/vanilla.
 * Mirrors serve-vanilla.mjs but calls vite.build() instead of createServer().
 *
 * Usage:
 *   node scripts/build-vanilla.mjs
 *
 * Output: examples/vanilla/dist/
 *
 * Before running, set env vars in .env.local (copy from .env.example):
 *   VITE_WALLETCONNECT_PROJECT_ID=your_project_id
 *   VITE_XAMAN_CLIENT_ID=your_xaman_client_id
 */

import { build, loadEnv } from "vite";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

// Load env from project root (same as serve-vanilla.mjs)
const env = loadEnv("production", root, "VITE_");

// Inject env as compile-time constants (Vite processes import.meta.env.*)
const defineEnv = Object.fromEntries(
  Object.entries(env).map(([key, value]) => [
    `import.meta.env.${key}`,
    JSON.stringify(value),
  ])
);

console.log("Building examples/vanilla for production...");
console.log(
  "WalletConnect project ID:",
  env.VITE_WALLETCONNECT_PROJECT_ID ? "set ✓" : "NOT SET (WalletConnect disabled)"
);
console.log(
  "Xaman client ID:",
  env.VITE_XAMAN_CLIENT_ID ? "set ✓" : "NOT SET (Xaman disabled)"
);
console.log("");

await build({
  root: resolve(root, "examples/vanilla"),
  envDir: root,
  define: defineEnv,
  build: {
    outDir: "dist",
    emptyOutDir: true,
    // Inline assets smaller than 4KB into JS (avoids extra HTTP requests on IIS)
    assetsInlineLimit: 4096,
  },
});

console.log("\nBuild complete → examples/vanilla/dist/");
console.log("Next: run scripts/deploy-vanilla-iis.ps1 to copy to IIS server.");
