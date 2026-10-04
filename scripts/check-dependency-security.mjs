import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { evaluateDependencyAudit } from "./dependency-audit-policy.mjs";

const exceptions = JSON.parse(readFileSync(resolve("scripts/dependency-audit-exceptions.json"), "utf8"));
for (const [scope, cwd] of [["root", process.cwd()], ["website", resolve("website")]]) {
  const result = spawnSync("npm", ["audit", "--include=dev", "--json"], {
    cwd, encoding: "utf8", shell: process.platform === "win32", timeout: 120_000, maxBuffer: 10 * 1024 * 1024
  });
  if (result.error || result.signal || ![0, 1].includes(result.status)) {
    throw new Error(`Cannot complete ${scope} npm audit.`, { cause: result.error });
  }
  const checked = evaluateDependencyAudit(JSON.parse(result.stdout), exceptions, scope);
  console.log(`${scope}: raw npm audit counts ${JSON.stringify(checked.counts)}`);
  for (const finding of checked.known) {
    console.warn(`UNRESOLVED ${finding.severity}: ${finding.name} ${finding.url}; review by ${finding.exception.expires}; ${finding.exception.issue}`);
  }
}
console.log("Dependency audit policy check complete. Known exceptions remain unresolved; this is not a clean security audit.");
