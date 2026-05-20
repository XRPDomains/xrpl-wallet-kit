import { createServer, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

const env = loadEnv("development", process.cwd(), "VITE_");
const defineEnv = Object.fromEntries(
  Object.entries(env).map(([key, value]) => [`import.meta.env.${key}`, JSON.stringify(value)])
);

const server = await createServer({
  root: "examples/react",
  envDir: process.cwd(),
  define: defineEnv,
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 5174,
    strictPort: true
  },
  clearScreen: false
});

await server.listen();
server.printUrls();

process.on("SIGINT", async () => {
  await server.close();
  process.exit(0);
});
