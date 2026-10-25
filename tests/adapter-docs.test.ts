import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

const root = resolve("website");
const directory = resolve(root, "docs/adapters");
const headings = ["Installation", "Connect", "Networks", "Capabilities", "Options", "Transactions", "Authentication", "Sessions and Disconnect", "Integration Notes", "Troubleshooting", "Related Guides"];
const operations = ["Connect", "Disconnect", "Session restore", "`signTransaction()`", "`signAndSubmit()`", "`signMessage()`", "`signIn()`", "`switchNetwork()`", "Payment / NFT transactions", "QR / deep link"];
const signOnly = new Set(["xaman", "gemwallet", "joey-wallet", "ghostsig", "xyra", "ledger", "walletconnect"]);

for (const name of readdirSync(directory).filter(name => name.endsWith(".md") && name !== "overview.md")) {
  test(`adapter guide contract: ${name}`, () => {
    const file = resolve(directory, name);
    const source = readFileSync(file, "utf8");
    assert.match(source, /^# .+ Adapter\r?\n/);
    assert.deepEqual([...source.matchAll(/^## (.+)$/gm)].map(match => match[1].trim()), headings);
    for (const field of ["Package", "Adapter ID", "Wallet type", "Client registration"]) assert.ok(source.includes(`| ${field} |`), `${name}: ${field}`);
    const capabilities = source.split("## Capabilities")[1].split("## Options")[0];
    assert.deepEqual([...capabilities.matchAll(/^\| ([^|]+) \|/gm)].map(match => match[1].trim()).filter(row => row !== "Operation"), operations);
    assert.ok(source.includes("```ts [Client]") && source.includes("```ts [Core]"));
    assert.ok(source.includes("### Payment") && source.includes("### NFT Transactions"));
    assert.ok(source.includes("#payment-submit-->") && source.includes("#nft-->"));
    assert.equal(source.includes("#payment-sign-only-->"), signOnly.has(name.replace(/\.md$/, "")));
    let expanded = source;
    for (const include of source.matchAll(/<!--@include: (.+?)#([\w-]+)-->/g)) {
      const snippet = readFileSync(resolve(dirname(file), include[1]), "utf8");
      const start = `<!-- #region ${include[2]} -->`;
      const end = `<!-- #endregion ${include[2]} -->`;
      assert.ok(snippet.includes(start) && snippet.includes(end), `${name}: missing include region ${include[2]}`);
      expanded = expanded.replace(include[0], snippet.split(start)[1].split(end)[0]);
    }
    assert.equal((expanded.match(/^```/gm) ?? []).length % 2, 0, `${name}: unbalanced code fences`);
    assert.equal((expanded.match(/^::: code-group/gm) ?? []).length, (expanded.match(/^:::$/gm) ?? []).length, `${name}: unbalanced code groups`);
    for (const link of expanded.matchAll(/\]\((\/[^)]+)\)/g)) {
      const path = link[1].split("#")[0].replace(/\.html$/, "");
      assert.ok(existsSync(resolve(root, `.${path}.md`)) || existsSync(resolve(root, `.${path}/index.md`)), `${name}: broken link ${link[1]}`);
    }
  });
}
