import { defineConfig } from "vite";
import inject from "@rollup/plugin-inject";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const { version } = JSON.parse(readFileSync(resolve(__dirname, "package.json"), "utf8"));
export default defineConfig({
  build: {
    outDir: "dist", emptyOutDir: false, minify: "esbuild", sourcemap: false,
    lib: { entry: resolve(__dirname, "src/xahau-runtime.ts"), formats: ["es"], fileName: () => "xrpl-wallet-kit-xahau.runtime.js" },
    rollupOptions: {
      plugins: [inject({ Buffer: ["buffer", "Buffer"] })],
      output: { inlineDynamicImports: true, banner: `/*! @xrpl-wallet-kit/browser Xahau runtime v${version} | MIT */` }
    }
  },
  resolve: { alias: { "@xrpl-wallet-kit/core": resolve(__dirname, "src/runtime-core.ts") } },
  define: { __XWK_BROWSER_VERSION__: JSON.stringify(version), "process.env": {} }
});
