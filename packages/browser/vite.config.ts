import { defineConfig } from "vite";
import type { Plugin } from "vite";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function emitLegacyBridge(): Plugin {
  return {
    name: "emit-legacy-bridge",
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: "xrpl-wallet-kit-legacy-bridge.js",
        source: readFileSync(resolve(__dirname, "legacy/xrpl-wallet-kit-legacy-bridge.js"), "utf8")
      });
    }
  };
}

export default defineConfig(({ mode }) => {
  const minified = mode === "minified";

  return {
    plugins: [emitLegacyBridge()],
    build: {
      outDir: "dist",
      emptyOutDir: !minified,
      minify: minified ? "esbuild" : false,
      sourcemap: false,
      lib: {
        entry: resolve(__dirname, "src/index.ts"),
        name: "XRPLWalletKit",
        formats: ["iife"],
        fileName: () => minified ? "xrpl-wallet-kit.iife.min.js" : "xrpl-wallet-kit.iife.js"
      },
      rollupOptions: {
        output: {
          extend: true
        }
      }
    },
    define: {
      "process.env": {}
    }
  };
});
