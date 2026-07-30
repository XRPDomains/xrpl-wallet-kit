import { defineConfig } from "vite";
import type { Plugin } from "vite";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const packageJson = JSON.parse(readFileSync(resolve(__dirname, "package.json"), "utf8")) as { version: string };
const bundleBanner = `/*! @xrpl-wallet-kit/browser v${packageJson.version} | MIT | https://github.com/XRPDomains/xrpl-wallet-kit */`;

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

function prependBundleBanner(): Plugin {
  return {
    name: "prepend-bundle-banner",
    generateBundle(_, bundle) {
      for (const asset of Object.values(bundle)) {
        if (asset.type !== "chunk") continue;
        const code = asset.code.replace(bundleBanner, "").trimStart();
        asset.code = `${bundleBanner}\n${code}`;
      }
    }
  };
}

export default defineConfig(({ mode }) => {
  const minified = mode === "minified";

  return {
    plugins: [emitLegacyBridge(), prependBundleBanner()],
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
    resolve: {
      alias: {
        "@xrpl-wallet-kit/client": resolve(__dirname, "../client/src/index.ts"),
        "@xrpl-wallet-kit/core": resolve(__dirname, "../core/src/index.ts"),
        "@xrpl-wallet-kit/ui": resolve(__dirname, "../ui/src/index.ts"),
        "@xrpl-wallet-kit/adapter-crossmark": resolve(__dirname, "../adapters/crossmark/src/index.ts"),
        "@xrpl-wallet-kit/adapter-dropfi": resolve(__dirname, "../adapters/dropfi/src/index.ts"),
        "@xrpl-wallet-kit/adapter-gemwallet": resolve(__dirname, "../adapters/gemwallet/src/index.ts"),
        "@xrpl-wallet-kit/adapter-ledger": resolve(__dirname, "../adapters/ledger/src/index.ts"),
        "@xrpl-wallet-kit/adapter-walletconnect": resolve(__dirname, "../adapters/walletconnect/src/index.ts"),
        "@xrpl-wallet-kit/adapter-xaman": resolve(__dirname, "../adapters/xaman/src/index.ts"),
        "@xrpl-wallet-kit/adapter-xrpl-snap": resolve(__dirname, "../adapters/xrpl-snap/src/index.ts")
      }
    },
    define: {
      "process.env": {}
    }
  };
});
