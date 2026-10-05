# Dependency Security Review - 2026-10-04

## Scope and Results

Historical snapshot. See the [2026-10-05 auth migration](./auth-verifier-migration-2026-10-05.md)
for the next reduction and the reviewed npm fix-availability metadata change.

The root workspace and the separately installed website have independent
lockfiles. Both were audited with development dependencies included.

| Lockfile | Before | After targeted updates |
| --- | --- | --- |
| Root | 24: 1 critical, 12 high, 1 moderate, 10 low | 11: 3 high, 8 low; no critical/moderate |
| Website | 5: 3 high, 2 moderate | 0 |

The root `--omit=dev` audit fell from 14 findings (including 1 critical) to
10 findings: 3 high and 7 low. Residual production dependency exposure remains;
this is not only a development-tool problem.

These are npm package-level counts, including inherited dependency effects.
The root's remaining 11 findings resolve to two leaf advisories. This is **not**
a clean root security audit, and the residual risks are not considered fixed.
Historical v0.1.19 release notes describe the audit at release time; these
follow-up changes have not been published as a new kit version.

## Changes

- Pin Next.js development/test installs to the patched 16.3.8 line instead of
  relying on an automatically resolved broad workspace peer. Public Next.js
  peer compatibility is unchanged. This does not upgrade a consuming dApp's
  Next.js installation or prove that an older app branch is patched.
- Upgrade duplicate-detection tooling to jscpd 5.4.0, removing its old
  fast-glob/micromatch/braces dependency chain. Adapt the report command to the
  new `--exit-code` option; keep the strict duplication threshold separately.
- Refresh compatible patch/minor versions of PostCSS, nanoid, Browserslist,
  baseline-browser-mapping, Babel, esbuild and smol-toml in the root lockfile.
- Keep stable VitePress 1.6.4, but override its Vite dependency in the private
  website to the patched Vite 6.4.3 line. Stable VitePress still declares Vite 5;
  this narrowly scoped major override requires ongoing build/preview testing
  and can be removed when stable VitePress uses a patched Vite natively.
- Refresh website PostCSS/nanoid and the compatible esbuild selected by Vite 6.
  No public package dependency override is imposed on consuming applications.
- No forced major override of wallet SDKs or XRPL signing/crypto packages.

## Unresolved Upstream Risks

Tracked as [P1 issue #48](https://github.com/XRPDomains/xrpl-wallet-kit/issues/48).

### Crossmark SDK

`@crossmarkio/sdk@0.4.0` depends on `@crossmarkio/typings@0.0.6`, which installs
`node-forge`, old `xrpl@2.14.1` and the `@transia/xrpl@2` family. The three high
package findings are `node-forge`, `@crossmarkio/typings` and `@crossmarkio/sdk`.
`node-forge@1.4.0` has no patched npm release for the reviewed RSA verification
advisory. These packages remain installed dependencies of the public Crossmark
adapter and therefore the all-in-one client/browser package chain.

The adapter delegates signing to the SDK/extension and does not implement RSA
verification itself. That is not evidence that the dependency is harmless.
Do not delete SDK dependencies, alias cryptographic implementations or force
XRPL major upgrades just to reduce audit counts. A supported upstream fix or a
separately reviewed protocol migration with compatibility tests is required.

### Legacy Elliptic Consumers

The Crossmark chain and optional `verify-xrpl-signature@9.2.0` peer still use
legacy `ripple-keypairs`/`elliptic` packages. npm propagates the elliptic advisory
through eight low-severity package findings. The auth verifier's default and
injected dependency contracts are not silently changed by this update.
Current direct core XRPL/ripple-keypairs implementations are not downgraded or
replaced with those legacy peers.

Prefer the selective core/client entry and explicitly chosen adapters when an
application does not need Crossmark. Broad client dependencies still install
Crossmark: runtime wallet filtering does not prune installed dependencies.
Inventory the dependencies of the **consumer**, not just this monorepo.

## Regression Policy

`npm run check:security` audits both lockfiles. It prints raw counts and
explicit unresolved warnings. Only the exact node-forge and elliptic advisory
URLs, package names, severities and root scope are temporarily reviewed until
2026-11-04. The website has no exceptions. Unknown advisories, changed severity,
critical findings, expired exceptions, incomplete reports and audit/network
failures, or an available patch for an exempt leaf advisory fail closed.
A policy check passing means no unreviewed findings, not
that dependencies are vulnerability-free.

The Dependency security workflow runs on dependency-related PRs or manual
dispatch and also validates native jscpd, browser build and website build on
Linux. No automatic publication or security-upgrade release is performed.

## Local Validation

- Clean installs succeeded for both lockfiles on Node.js 22.
- All 335 tests passed, including seven audit-policy regression tests.
- Dependency boundaries, strict duplication checks and consumer bundle budgets passed.
- Readable and minified browser builds and their functional smoke tests passed.
  The minified bundle is 596.41 kB gzip, approximately 2.3% larger than before;
  existing budget thresholds were not relaxed.
- The website build passed with Vite 6. The local VitePress preview rendered
  successfully at `http://127.0.0.1:5174/xrpl-wallet-kit/`.
- The security policy passed with explicit unresolved root warnings, not a
  claim of zero vulnerabilities. Live wallet/hardware testing was not performed.

## Primary References

- [Next.js ImageResponse security advisory](https://github.com/advisories/GHSA-vcvr-r3jv-pc5j)
- [node-forge RSA verification advisory](https://github.com/advisories/GHSA-86w9-cpqp-85rv)
- [Elliptic implementation advisory](https://github.com/advisories/GHSA-848j-6mx2-7j84)
- [jscpd 5.4.0 release](https://github.com/kucherenko/jscpd/releases/tag/v5.4.0)

## Follow-Up Acceptance Criteria

- Obtain a supported Crossmark SDK/typings update or a reviewed compatible
  integration replacement that removes both residual advisory chains.
- Migrate or update the optional legacy auth verifier without changing the
  compact-signature versus signed-transaction proof distinction.
- Test provider availability, restore, message proof, submit, rejection,
  cancellation, SSR imports and browser/consumer bundles.
- Remove the two temporary audit exceptions and obtain zero root findings.
