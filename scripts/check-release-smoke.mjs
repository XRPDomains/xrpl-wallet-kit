import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import { constants } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

const root = process.cwd();
const rootPackage = await readJson("package.json");
const workspaceVersion = rootPackage.version;

assert.match(workspaceVersion, /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/, "root package version must be semver");

const publishablePackages = await findPackageJsons(join(root, "packages"));
const workspacePackages = new Map();

for (const packagePath of publishablePackages) {
  const pkg = await readJson(relative(root, packagePath));
  if (typeof pkg.name === "string" && pkg.name.startsWith("@xrpl-wallet-kit/")) {
    workspacePackages.set(pkg.name, { pkg, packagePath });
  }
}

for (const [packageName, { pkg, packagePath }] of workspacePackages) {
  const packageDir = dirname(packagePath);
  assert.equal(pkg.version, workspaceVersion, `${packageName} version must match root ${workspaceVersion}`);
  assert.equal(pkg.license, "MIT", `${packageName} must declare MIT license`);
  assert.ok(pkg.main, `${packageName} must declare main`);
  assert.ok(pkg.types, `${packageName} must declare types`);
  assert.ok(Array.isArray(pkg.files) && pkg.files.includes("dist"), `${packageName} must publish dist`);
  assert.ok(Array.isArray(pkg.files) && pkg.files.includes("README.md"), `${packageName} must publish README.md`);
  await assertExists(join(packageDir, "README.md"), `${packageName} must include README.md`);

  for (const dependencyField of ["dependencies", "optionalDependencies"]) {
    const dependencies = pkg[dependencyField] ?? {};
    for (const [dependencyName, dependencyVersion] of Object.entries(dependencies)) {
      if (workspacePackages.has(dependencyName)) {
        assert.equal(
          dependencyVersion,
          workspaceVersion,
          `${packageName} ${dependencyField}.${dependencyName} must match ${workspaceVersion}`
        );
      }
    }
  }
}

const browserPackage = await readJson("packages/browser/package.json");
assert.equal(browserPackage.version, workspaceVersion, "@xrpl-wallet-kit/browser version must match root");

for (const bundleName of ["xrpl-wallet-kit.iife.js", "xrpl-wallet-kit.iife.min.js"]) {
  const bundlePath = `packages/browser/dist/${bundleName}`;
  const bundle = await readFile(resolve(root, bundlePath), "utf8");
  assert.ok(
    bundle.startsWith(`/*! @xrpl-wallet-kit/browser v${workspaceVersion}`),
    `${bundlePath} must start with the current version banner`
  );
  assert.ok(bundle.includes("XRPLWalletKit"), `${bundlePath} must expose XRPLWalletKit`);
  assert.doesNotMatch(bundle, /broken\s*—\s*truncated|truncated mid-string/i, `${bundlePath} must not contain truncation markers`);
}

const websitePackage = await readJson("website/package.json");
assert.equal(websitePackage.version, workspaceVersion, "website package version must match root");

const vitepressConfig = await readFile(resolve(root, "website/.vitepress/config.ts"), "utf8");
assert.ok(vitepressConfig.includes(`text: "v${workspaceVersion}"`), "website nav version must match root");

for (const widgetPath of [
  "website/.vitepress/theme/components/PlaygroundWidget.vue",
  "website/.vitepress/theme/components/ThemeBuilderWidget.vue"
]) {
  const widget = await readFile(resolve(root, widgetPath), "utf8");
  assert.ok(
    widget.includes(`const KIT_BUNDLE_VERSION = '${workspaceVersion}'`),
    `${widgetPath} KIT_BUNDLE_VERSION must match root`
  );
  assert.match(
    widget,
    /xrpl-wallet-kit\.iife\.min\.js\?v=\$\{KIT_BUNDLE_VERSION\}/,
    `${widgetPath} must load the website bundle through KIT_BUNDLE_VERSION`
  );
}

console.log(`release smoke passed for v${workspaceVersion}`);

async function readJson(path) {
  return JSON.parse(await readFile(resolve(root, path), "utf8"));
}

async function assertExists(path, message) {
  try {
    await access(path, constants.F_OK);
  } catch {
    assert.fail(message);
  }
}

async function findPackageJsons(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const matches = [];

  for (const entry of entries) {
    const entryPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "dist") continue;
      matches.push(...await findPackageJsons(entryPath));
    } else if (entry.isFile() && entry.name === "package.json") {
      matches.push(entryPath);
    }
  }

  return matches;
}
