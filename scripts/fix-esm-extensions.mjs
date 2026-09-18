import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const packagesRoot = join(root, "packages");
const moduleFiles = [];

function walk(directory) {
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    const stats = statSync(path);
    if (stats.isDirectory()) {
      walk(path);
      continue;
    }
    if (stats.isFile() && (path.endsWith(".js") || path.endsWith(".d.ts"))) {
      moduleFiles.push(path);
    }
  }
}

function hasKnownExtension(specifier) {
  return Boolean(extname(specifier));
}

function addJsExtension(specifier, importer) {
  if (!specifier.startsWith(".") || hasKnownExtension(specifier)) {
    return specifier;
  }
  const target = resolve(dirname(importer), specifier);
  if (existsSync(join(target, "index.js")) || existsSync(join(target, "index.d.ts"))) {
    return `${specifier}/index.js`;
  }
  return `${specifier}.js`;
}

walk(packagesRoot);

for (const file of moduleFiles) {
  if (!file.includes(`${join("dist")}`) && !file.includes(`${join("dist", "")}`)) {
    continue;
  }

  const before = readFileSync(file, "utf8");
  const after = before
    .replace(/(\bfrom\s*["'])(\.{1,2}\/[^"']+)(["'])/g, (_match, prefix, specifier, suffix) => {
      return `${prefix}${addJsExtension(specifier, file)}${suffix}`;
    })
    .replace(/(\bimport\s*\(\s*["'])(\.{1,2}\/[^"']+)(["']\s*\))/g, (_match, prefix, specifier, suffix) => {
      return `${prefix}${addJsExtension(specifier, file)}${suffix}`;
    })
    .replace(/(\bimport\s*["'])(\.{1,2}\/[^"']+)(["'])/g, (_match, prefix, specifier, suffix) => {
      return `${prefix}${addJsExtension(specifier, file)}${suffix}`;
    });

  if (after !== before) {
    writeFileSync(file, after);
  }
}
