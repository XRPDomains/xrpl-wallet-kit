import { defineConfig, transformWithEsbuild } from "vite";
import type { Plugin } from "vite";
import inject from "@rollup/plugin-inject";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const { version } = JSON.parse(readFileSync(resolve(__dirname, "package.json"), "utf8"));

function minifyStandaloneRuntime(): Plugin {
  return {
    name: "minify-standalone-xahau-runtime",
    async generateBundle(_, bundle) {
      // Vite preserves whitespace in ES libraries for tree-shaking. This is a final CDN asset.
      for (const chunk of Object.values(bundle)) {
        if (chunk.type !== "chunk") continue;
        const result = await transformWithEsbuild(chunk.code, chunk.fileName, {
          minify: true, format: "esm", target: "es2020", legalComments: "inline", sourcemap: false
        });
        chunk.code = result.code;
      }
    }
  };
}

export default defineConfig({
  plugins: [minifyStandaloneRuntime()],
  build: {
    outDir: "dist", emptyOutDir: false, minify: false, sourcemap: false,
    lib: { entry: resolve(__dirname, "src/xahau-runtime.ts"), formats: ["es"], fileName: () => "xrpl-wallet-kit-xahau.runtime.js" },
    rollupOptions: {
      plugins: [inject({ Buffer: ["buffer", "Buffer"] })],
      output: { inlineDynamicImports: true, banner: `/*! @xrpl-wallet-kit/browser Xahau runtime v${version} | MIT */` }
    }
  },
  resolve: { alias: { "@xrpl-wallet-kit/core": resolve(__dirname, "src/runtime-core.ts") } },
  define: { __XWK_BROWSER_VERSION__: JSON.stringify(version), "process.env": {} }
});
