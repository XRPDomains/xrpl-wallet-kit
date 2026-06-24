import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { extname } from "node:path";

const explicitFiles = process.argv.slice(2);
const files = explicitFiles.length
  ? explicitFiles
  : execFileSync("git", ["diff", "--cached", "--name-only", "--diff-filter=ACMR"], {
      encoding: "utf8"
    })
      .split(/\r?\n/)
      .filter(Boolean);

if (files.length === 0) {
  console.log("check-file-integrity: no files staged");
  process.exit(0);
}

const failures = [];

for (const file of files) {
  if (!existsSync(file)) continue;
  const bytes = readFileSync(file);
  const text = bytes.toString("utf8");
  const extension = extname(file).toLowerCase();

  if (bytes.subarray(Math.max(0, bytes.length - 64)).includes(0)) {
    failures.push(`${file}: null bytes found near file end`);
    continue;
  }

  try {
    if ([".js", ".cjs", ".mjs"].includes(extension)) {
      const result = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
      if (result.status !== 0) {
        throw new Error((result.stderr || result.stdout || "node --check failed").trim());
      }
    } else if (extension === ".json" || extension === ".geojson") {
      JSON.parse(text);
    } else if (extension === ".html" || extension === ".htm") {
      if (!/<\/body>/i.test(text) || !/<\/html>/i.test(text)) {
        throw new Error("missing closing </body> or </html>");
      }
    } else if (extension === ".css") {
      if (!text.trimEnd().endsWith("}")) throw new Error("file does not end with a complete CSS rule");
    } else if ([".ts", ".tsx", ".md", ".markdown"].includes(extension) && bytes.length < 4) {
      throw new Error("file is unexpectedly empty");
    }
  } catch (error) {
    failures.push(`${file}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

if (failures.length) {
  console.error("check-file-integrity failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(`check-file-integrity: all ${files.length} file(s) OK`);
