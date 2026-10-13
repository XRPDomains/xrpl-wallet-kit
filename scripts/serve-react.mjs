// Both preview commands use one console and wallet session on port 5173.
import { fileURLToPath } from "node:url";

process.chdir(fileURLToPath(new URL("../", import.meta.url)));
await import("./serve-vanilla.mjs");
