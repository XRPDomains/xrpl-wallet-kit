import { mkdtemp, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";

const reactVersion = process.env.REACT_VERSION ?? "18";
const directory = await mkdtemp(join(tmpdir(), `xwk-react-${reactVersion}-`));
const packs = resolve(".packs");
const tarballs = (await readdir(packs)).filter((file) => file.endsWith(".tgz")).map((file) => `file:${join(packs, file)}`);
const commandOptions = (cwd) => ({ cwd, stdio: "inherit", shell: process.platform === "win32" });

await writeFile(join(directory, "package.json"), JSON.stringify({ private: true, type: "module" }));
execFileSync("npm", ["install", "--ignore-scripts", `react@${reactVersion}`, `react-dom@${reactVersion}`, `@types/react@${reactVersion}`, "typescript@5.5", ...tarballs], commandOptions(directory));
await writeFile(join(directory, "tsconfig.json"), JSON.stringify({ compilerOptions: { strict: true, jsx: "react-jsx", module: "NodeNext", moduleResolution: "NodeNext", target: "ES2022", skipLibCheck: false }, include: ["consumer.tsx"] }));
await writeFile(join(directory, "consumer.tsx"), `import { createRef } from "react";\nimport { WalletButton, type WalletButtonHandle } from "@xrpl-wallet-kit/react";\nimport { WalletButton as NextWalletButton } from "@xrpl-wallet-kit/next";\nconst ref = createRef<WalletButtonHandle>();\nvoid <WalletButton ref={ref} className="slot" aria-label="Wallet" data-testid="wallet" />;\nvoid <NextWalletButton style={{ display: "inline-flex" }} />;\n`);
execFileSync(join(directory, "node_modules", ".bin", process.platform === "win32" ? "tsc.cmd" : "tsc"), ["--noEmit"], commandOptions(directory));
