import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";
import ts from "typescript";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packageRoot = join(root, "packages/adapters/crossmark");
const sdkLicenseHash = "3972dc9744f6499f0f9b2dbf76696f2ae7ad8af9b23dde66d6af86c9dfb36986";

export function checkCrossmarkArtifact(declarations, metafile) {
  const source = ts.createSourceFile("index.d.ts", declarations, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const imports = [...source.referencedFiles, ...source.typeReferenceDirectives].map(reference => reference.fileName);
  function visit(node) {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      imports.push(node.moduleSpecifier.text);
    }
    if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument) && ts.isStringLiteral(node.argument.literal)) {
      imports.push(node.argument.literal.text);
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  if (source.parseDiagnostics.length || imports.some(specifier => specifier !== "@xrpl-wallet-kit/core")) {
    throw new Error("Crossmark declarations must be self-contained except for Wallet Kit core.");
  }
  for (const input of Object.keys(metafile.inputs)) {
    const dependencies = `/${input.replaceAll("\\", "/")}`.split("/node_modules/").slice(1);
    if (dependencies.some(path => !path.startsWith("@crossmarkio/sdk/"))) {
      throw new Error(`Unexpected bundled Crossmark dependency: ${input}`);
    }
  }
  for (const output of Object.values(metafile.outputs)) {
    for (const imported of output.imports) {
      if (imported.external && imported.path !== "@xrpl-wallet-kit/core") {
        throw new Error(`Unresolved Crossmark runtime dependency: ${imported.path}`);
      }
    }
  }
}

export function checkCrossmarkRuntime(runtime) {
  const source = ts.createSourceFile("index.js", runtime, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  function visit(node) {
    let specifier;
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      specifier = node.moduleSpecifier.text;
    }
    if (ts.isCallExpression(node) && node.arguments.length && ts.isStringLiteral(node.arguments[0]) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword || ts.isIdentifier(node.expression) && node.expression.text === "require")) {
      specifier = node.arguments[0].text;
    }
    if (specifier !== undefined && specifier !== "@xrpl-wallet-kit/core") throw new Error(`Unresolved Crossmark runtime dependency: ${specifier}`);
    ts.forEachChild(node, visit);
  }
  if (source.parseDiagnostics.length) throw new Error("Malformed Crossmark runtime output.");
  visit(source);
}

export async function prepareCrossmarkPackage() {
  const require = createRequire(join(packageRoot, "package.json"));
  const sdkRoot = resolve(dirname(require.resolve("@crossmarkio/sdk")), "../..");
  const sdkManifest = JSON.parse(await readFile(join(sdkRoot, "package.json"), "utf8"));
  const sdkLicense = await readFile(join(sdkRoot, "LICENSE"));
  if (sdkManifest.version !== "0.4.0" || createHash("sha256").update(sdkLicense).digest("hex") !== sdkLicenseHash) {
    throw new Error("Crossmark SDK version/license changed; review notices before preparing the package.");
  }
  const declarations = await readFile(join(packageRoot, "dist/index.d.ts"), "utf8");
  const result = await build({
    absWorkingDir: root,
    entryPoints: [join(packageRoot, "dist/index.js")],
    outfile: join(packageRoot, "dist/index.js"),
    allowOverwrite: true,
    bundle: true,
    format: "esm",
    platform: "browser",
    target: "es2022",
    external: ["@xrpl-wallet-kit/core"],
    sourcemap: "external",
    legalComments: "inline",
    metafile: true,
    write: false
  });
  checkCrossmarkArtifact(declarations, result.metafile);
  for (const output of result.outputFiles) if (output.path.endsWith(".js")) checkCrossmarkRuntime(output.text);
  // Verify before writing: a failed preparation must not replace the existing output.
  for (const output of result.outputFiles) await writeFile(output.path, output.contents);
  await mkdir(join(packageRoot, "dist/licenses"), { recursive: true });
  await writeFile(join(packageRoot, "dist/licenses/CROSSMARK-LICENSE.txt"), sdkLicense);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await prepareCrossmarkPackage();
  console.log("Crossmark runtime packaged; SDK license preserved. Consumer verification remains required.");
}
