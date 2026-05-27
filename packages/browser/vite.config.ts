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

function exposeBufferBeforeAdapters(): Plugin {
  return {
    name: "expose-buffer-before-adapters",
    enforce: "post",
    generateBundle(_options, bundle) {
      for (const asset of Object.values(bundle)) {
        if (asset.type !== "chunk") continue;
        if (asset.code.includes("__xwk_buffer_ready__")) continue;
        const minifiedBufferEnd = asset.code.match(/\}\}\)\(([$A-Za-z_][$\w]*)\),ve\.WalletKitErrorCode=/);
        if (minifiedBufferEnd) {
          const bufferVar = minifiedBufferEnd[1];
          asset.code = asset.code.replace(
            minifiedBufferEnd[0],
            `}})(${bufferVar}),typeof globalThis<"u"&&(globalThis.__xwk_buffer_ready__=!0,globalThis.Buffer||(globalThis.Buffer=${bufferVar}.Buffer)),ve.WalletKitErrorCode=`
          );
          continue;
        }
        if (asset.code.includes("  })(buffer);\n")) {
          asset.code = asset.code.replace(
            "  })(buffer);\n",
            `  })(buffer);\n  typeof globalThis !== "undefined" && (globalThis.__xwk_buffer_ready__ = true, globalThis.Buffer || (globalThis.Buffer = buffer.Buffer));\n`
          );
        }
      }
    }
  };
}

export default defineConfig(({ mode }) => {
  const minified = mode === "minified";

  return {
    plugins: [exposeBufferBeforeAdapters(), emitLegacyBridge()],
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
