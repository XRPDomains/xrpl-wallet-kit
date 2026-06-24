import { createReadStream, existsSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "vite";

const bundlePath = resolve(__dirname, "../../packages/browser/dist/xrpl-wallet-kit.iife.js");
const minifiedBundlePath = resolve(__dirname, "../../packages/browser/dist/xrpl-wallet-kit.iife.min.js");

export default defineConfig({
  plugins: [
    {
      name: "serve-xrpl-wallet-kit-browser-bundle",
      configureServer(server) {
        server.middlewares.use("/xrpl-wallet-kit.iife.js", (_request, response, next) => {
          if (!existsSync(bundlePath)) {
            next();
            return;
          }
          response.setHeader("Content-Type", "application/javascript; charset=utf-8");
          createReadStream(bundlePath).pipe(response);
        });
        server.middlewares.use("/xrpl-wallet-kit.iife.min.js", (_request, response, next) => {
          if (!existsSync(minifiedBundlePath)) {
            next();
            return;
          }
          response.setHeader("Content-Type", "application/javascript; charset=utf-8");
          createReadStream(minifiedBundlePath).pipe(response);
        });
      }
    }
  ]
});
