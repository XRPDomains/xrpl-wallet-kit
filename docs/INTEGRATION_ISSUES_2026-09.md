# Integration issues found in 0.1.14

Found while wiring the kit into **x402gate** (a hosted x402 payment gateway) for
dashboard wallet sign-in: connect a wallet, sign a challenge, edit project
config. Everything at **0.1.14** from npm, in a Next.js 16 / Turbopack app.

Two of these block a clean install or build outright, so anyone starting a React
or Next app with the kit meets them in the first ten minutes. None are deep —
the largest fix is a few lines.

| # | Issue | Package | Blast radius | Severity |
| --- | --- | --- | --- | --- |
| 1 | `dist` imports `./locales.js` when `locales` is a directory | `ui`, so also `react` and `next` | Every strict-ESM bundler; build fails outright | Blocker |
| 2 | `loadPeer` uses `await import(variable)` | `auth/verifiers` | Any bundled server; throws "Install ripple-keypairs…" with the peers installed | Blocker, workaround exists |
| 3 | `peerOptional ripple-keypairs@^2.0.0`, npm latest is `3.1.0` | `auth` | `npm install` fails ERESOLVE on a clean tree | High |
| 4 | `signTransaction` loses the signed blob on Xaman | `core` + `adapter-xaman` | Sign-without-submit returns `txBlob: undefined` | High |

Suggested order: **1 → 2 → 3 → 4.**

Items 1 and 3 are what a newcomer hits before writing a line of their own code,
so they cost the most goodwill per line of fix. Item 2 blocks server-side
signature verification, which is the reason `auth` exists. Item 4 is the
narrowest, but it decides whether the kit can serve x402 payments at all — and
that is the use case with a clock on it, since agent credit lines are settling
on XRPL now.

Nothing here is on fire: each had a workaround we could live with. But 1 and 2
both present as *"the library is broken"* rather than *"you configured it
wrong"*, which is the expensive kind of first impression.

---

## 1. `ui` imports `./locales.js`, but `locales` is a directory

**Package:** `@xrpl-wallet-kit/ui@0.1.14` — and therefore `react` and `next`,
which pull it in for the modal.

Five published files open with the same broken specifier:

```js
// dist/config.js line 1 — same in button.js, modal.js, toast.js, index.js
import { resolveWalletUiMessages } from "./locales.js";
```

But the published tree has `locales` as a **directory**:

```
dist/locales/index.js
dist/locales/en-US.js
dist/locales/vi-VN.js
dist/locales/types.js
```

Node's ESM resolver has no directory-index resolution — unlike CommonJS,
`./locales` never falls back to `./locales/index.js`, and `./locales.js` names a
file that does not exist. Any strict-ESM bundler refuses it.

**Repro:** install `@xrpl-wallet-kit/react` in a Next.js 16 app, render
`WalletKitProvider`, build.

```
Error: Turbopack build failed with 5 errors:
Error: Module not found: Can't resolve './locales.js'   × 5
```

**Root cause** looks like `scripts/fix-esm-extensions.mjs`: it appends `.js` to
extensionless relative imports, which is right for a file and wrong for a
directory. The source presumably says `from "./locales"`, and the rewrite should
ask whether the target resolves to a directory:

```js
// in fix-esm-extensions.mjs, when rewriting a relative specifier
const asFile = path.resolve(dir, spec + ".js");
const asDir  = path.resolve(dir, spec, "index.js");
return fs.existsSync(asFile) ? spec + ".js"
     : fs.existsSync(asDir)  ? spec + "/index.js"
     : spec;   // leave it alone rather than invent a path
```

**Worth adding a guard.** This class of bug is invisible to `tsc` and to any
test that imports from source rather than `dist`. A smoke test that does
`await import('./dist/index.js')` in plain Node, run in CI before publish, would
have caught it — `smoke:browser` exists but appears to test the bundled browser
build, not the ESM entry points.

**Consumer workaround:** stop using `react`/`next`/`ui` and drive
`WalletManager` from `core` directly, rendering your own wallet buttons. Fine if
your buttons belong in your own design system anyway, but it is not a fix, and
it is not available to someone who wants the kit's modal.

---

## 2. The signature verifier cannot load its peers under a bundler

**Package:** `@xrpl-wallet-kit/auth@0.1.14`, `verifiers/xrpl.ts`.

`createXrplSignatureVerifier` resolves its three crypto peers lazily:

```js
async function loadPeer(name, options) {
  try {
    if (options.dependencies?.loadPeer) return await options.dependencies.loadPeer(name);
    const mod = await import(name);        // ← name is a runtime variable
    …
  } catch (error) {
    const peerError = new Error(PEER_ERROR);   // "Install ripple-keypairs, …"
```

A bundler cannot follow `import(name)` when `name` is a variable, so the module
is never included in the build and the import throws at runtime. The `catch`
then reports it as a missing install.

**The error is the worst part.** With all three peers correctly installed, you
get:

```
[auth/verify] verifier error
  Install ripple-keypairs, verify-xrpl-signature, and xrpl to use @xrpl-wallet-kit/auth/verifiers.
```

That message sends you to check `package.json`, then `node_modules`, then your
lockfile — all of which are fine. Nothing points at bundling. We only found it
by logging the caught error at the call site.

**Repro:** call `createXrplSignatureVerifier({ nodeUrl }).verify(…)` from a
Next.js route handler with `ripple-keypairs`, `verify-xrpl-signature` and `xrpl`
all installed.

**Fix:** import the peers statically and let the bundler see them. They are
optional peers, so the whole block still needs to degrade when they are absent —
but that decision belongs at module load, not inside a dynamic specifier:

```js
// top of verifiers/xrpl.ts — static specifiers, so bundlers include them
import * as rippleKeypairs from "ripple-keypairs";
import * as verifyXrplSignature from "verify-xrpl-signature";
import * as xrpl from "xrpl";
```

If the lazy shape has to stay so the peers remain genuinely optional, a `switch`
over literal specifiers keeps them statically analysable:

```js
switch (name) {
  case "ripple-keypairs":        return await import("ripple-keypairs");
  case "verify-xrpl-signature":  return await import("verify-xrpl-signature");
  case "xrpl":                   return await import("xrpl");
}
```

Either way, the `catch` should keep the original error as `cause` rather than
replacing it with advice that is wrong in this case.

**Consumer workaround:** `options.dependencies` already exists and does the job —
import the three modules yourself and pass them in. It works, and it is arguably
the more explicit style, but it should not be the only way to make the
documented entry point run in a bundled server.

---

## 3. `ripple-keypairs` peer range is a major version behind

**Package:** `@xrpl-wallet-kit/auth@0.1.14`.

`auth` declares `peerOptional ripple-keypairs@^2.0.0`. npm's `latest` is
**3.1.0**. So the obvious install order fails:

```
$ npm install @xrpl-wallet-kit/auth ripple-keypairs verify-xrpl-signature

npm error While resolving: @xrpl-wallet-kit/auth@0.1.14
npm error Found: ripple-keypairs@3.1.0
npm error Could not resolve dependency:
npm error peerOptional ripple-keypairs@"^2.0.0" from @xrpl-wallet-kit/auth@0.1.14
npm error Conflicting peer dependency: ripple-keypairs@2.0.0
```

The two functions the verifier actually calls,
`verify(messageHex, signature, publicKey)` and `deriveAddress(publicKey)`, have
the same signatures across 1.x, 2.x and 3.x, so this looks like a range that
simply was not revisited rather than a real incompatibility.

**Fix:** widen it.

```json
"peerDependenciesMeta": { "ripple-keypairs": { "optional": true } },
"peerDependencies": { "ripple-keypairs": "^2.0.0 || ^3.0.0" }
```

Worth a quick check of the other peer ranges at the same time — `xrpl` is
declared `^4.0.0 || ^5.0.0`, which is current, but the same drift will happen
again.

**One adjacent note:** `verify-xrpl-signature@9.2.0` depends on
`ripple-keypairs@^1.1.4` as an ordinary dependency, not a peer, so npm nests it
and it does not actually conflict. It appears in the error output above and is
easy to misread as part of the problem. It is not.

**Consumer workaround:** pin `ripple-keypairs@^2.0.0` to satisfy the declared
range.

---

## 4. `signTransaction` drops the signed blob on Xaman

**Packages:** `@xrpl-wallet-kit/core@0.1.14` (`manager.ts`) and
`@xrpl-wallet-kit/adapter-xaman@0.1.14`.

The manager already does the right thing for adapters that only declare
`signAndSubmit` — it falls back and asks them not to submit:

```js
// manager.ts:510
const raw = typeof adapter.signTransaction === "function"
  ? await adapter.signTransaction(request)
  : await adapter.signAndSubmit({ ...request, submit: false });
const result = normalizeSignTransactionResult(raw);
```

The blob is then lost in normalisation. `normalizeSignTransactionResult`
(`manager.ts:861`) searches these paths:

```
txBlob · tx_blob · result.txBlob · result.tx_blob
response.txBlob · response.tx_blob · raw.txBlob · raw.tx_blob · tx_json · result.tx_json
```

Xaman's blob arrives at **`raw.response.hex`**, which is not among them. The
adapter's `signAndSubmit` returns
`normalizeTxResult({ hash, signed, rejected, raw: result })`, so the payload sits
in `raw` untouched — present, findable, and never looked at. `signTransaction`
therefore returns `txBlob: undefined` for the kit's most widely used wallet.

The same adapter's `signMessage` already gets this right
(`adapter-xaman/src/index.ts:183`):

```js
proof: result.response?.hex ?? undefined,
txBlob: result.response?.hex ?? undefined,
```

so the inconsistency is within one file.

**Two candidate fixes.** The adapter one is more correct — an adapter knows its
own response shape, and the core normaliser should not need to learn every
wallet's quirks:

```js
// (a) adapter-xaman, in signAndSubmit
if (request.submit === false) {
  return { ...normalizeTxResult({ … }), txBlob: result?.response?.hex };
}
```

```js
// (b) core/manager.ts:861 — defensive, also helps any wallet with a nested shape
"raw.response.hex", "response.hex",
```

Doing both is defensible: (a) fixes the cause, (b) makes the normaliser
forgiving.

**Why this one matters commercially.** x402 needs a signed blob that has *not*
been submitted — the blob goes to the facilitator, which verifies the terms and
settles. A wallet that can only sign-and-submit cannot participate. Xaman
supports sign-without-submit perfectly well; only this normalisation step hides
it. Until it is fixed, the kit cannot be the wallet layer for an x402 checkout.

---

## What gets simpler downstream

x402gate ships today with three workarounds in place. Each is a few lines, and
each is a place where the kit is not being used the way it is meant to be.

| Issue | What x402gate does instead | After the fix |
| --- | --- | --- |
| 1 | Drives `WalletManager` from `core`, skipping `react`/`next`/`ui` | Optional. Our buttons stay ours either way; the kit's modal becomes available to people who want it |
| 2 | Imports the three crypto peers and passes `options.dependencies` | Delete the injection block in `api/auth/verify/route.ts` |
| 3 | Pins `ripple-keypairs@^2.0.0` | Drop the pin |
| 4 | Checkout calls the Xaman payload API directly, bypassing the kit | Route the human checkout through `manager.signTransaction()` — and get GemWallet, Crossmark, Ledger and WalletConnect as payment methods for free |

Item 4 is the one that changes what the product can do rather than how tidy it
is. Right now a person paying an x402 endpoint must use Xaman, because that is
the only wallet we have a blob path for. Fix the normalisation and every wallet
the kit supports becomes a way to pay — a desktop user with a browser extension
would not need to reach for their phone.

Dashboard sign-in is already on the kit and working: connect a wallet, sign a
challenge, server verifies and mints the session. Thirteen checks cover the
sign-in gates, including replay of a captured signature and a signature minted
for a different domain.

The kit does the hard parts well — the adapter abstraction, the SIWE-style
message format, and a verifier that checks real crypto rather than trusting the
client. All four items here are packaging and plumbing, not design.
