# Dependency Security Follow-Up - 2026-10-06

Tracking: [P1 issue #48](https://github.com/XRPDomains/xrpl-wallet-kit/issues/48).
This is a local working-tree update, not a release or deployed website change.

## New Findings and Fixes

- Updated source-map-js from 1.2.1 to 1.2.2 in root and website lockfiles.
  This resolves the indexed source-map offset denial-of-service advisory
  [GHSA-68fv-2mgg-jv7q](https://github.com/advisories/GHSA-68fv-2mgg-jv7q).
- Updated the website's Vue family from 3.5.38 to 3.5.43, including matching
  compiler, runtime, shared and server-renderer packages. The stable patch line
  fixes the SSR attribute-name carriage-return XSS advisory
  [GHSA-g2v6-rqmx-r4w6](https://github.com/advisories/GHSA-g2v6-rqmx-r4w6),
  patched in 3.5.42 and later stable 3.5.x releases.
- npm repaired an incomplete website @types/unist lock entry and deduplicated
  its 3.0.3 copies. Vue's compiler dependency resolution also refreshed Babel
  parser/types and sourcemap-codec. No public package manifests or wallet SDK
  dependencies were changed, and no new audit exception was added.

## Verified Results

Audit includes development dependencies and both independent lockfiles.

| Scope | Before targeted fixes | After targeted fixes |
| --- | --- | --- |
| Root | 11: 4 high, 7 low | 10: 3 high, 7 low |
| Website | 3: source-map-js plus two inherited Vue/SSR high findings | 0 |

The website's pre-fix source-map-js finding was caught by the first policy run;
a subsequent raw audit after fixing it showed the remaining two Vue findings.

`npm run check:security` passes with only the two existing root exceptions.
This does not mean the root is vulnerability-free. Exceptions still expire
on 2026-11-04; no deadline or severity policy was relaxed.

Focused checks passed:

- source-map-js 1.2.2 mapping round-trip in both installations;
- PostCSS source-map generation in both installations;
- Vue template compilation with a source map;
- Vue 3.5.43 SSR rendering and rejection of an attribute name containing CR;
- lockfile diff whitespace checks.

Installs used --ignore-scripts. No full test suite, website/browser build,
package publication, or deployment was performed. Build/preview compatibility
still needs checking before publishing these dependency changes.

## Remaining Upstream Risks

npm registry checks still report @crossmarkio/sdk 0.4.0 and
@crossmarkio/typings 0.0.6. Their installed chains carry node-forge 1.4.0 and
legacy elliptic 6.6.1. Both reviewed advisories still lack a patched release:

- [node-forge RSA verification](https://github.com/advisories/GHSA-86w9-cpqp-85rv)
- [elliptic risky implementation](https://github.com/advisories/GHSA-848j-6mx2-7j84)

Auth has already migrated to modern xrpl/ripple-keypairs peers in the workspace;
the remaining legacy chains are not evidence that the modern auth verifier
still loads verify-xrpl-signature. Published 0.1.19 consumers do not receive that
migration until a new release is published.

Keep issue #48 open. A supported upstream Crossmark update or a separately
reviewed compatible protocol migration is required; do not force crypto major
overrides, delete SDK dependencies or suppress the findings to claim zero.

## 2026-10-08 Packaging Follow-Up (Local Only)

The Crossmark adapter now keeps SDK 0.4.0 as a pinned development dependency
and prepares its existing runtime inside the adapter artifact at build/prepack
time. Its published dependency manifest lists only Wallet Kit core; the public
declarations use the kit's own provider interface, not upstream SDK types.
The lockfile still retains the legacy dependency tree as development tooling.

Preparation checks declaration imports, runtime imports and bundle inputs,
and preserves the exact installed SDK license after checking its SHA-256.
Release smoke checks now reject unprepared Crossmark output. The SDK manifest
says MIT while its LICENSE contains GPLv3; THIRD_PARTY_NOTICES records this
without claiming redistribution clearance or resolving the upstream intent.

Four focused packaging-guard tests and the preparation script syntax check
passed. No bundle, tarball, consumer install, new audit, or release smoke run
was performed. The audit counts above are the October 6 snapshot, not a new
measurement. Issue #48 remains open pending isolated packed-consumer checks,
license clarification/review, and an explicit release. Packaging isolation is
not an upstream crypto patch and does not resolve development audit findings.

## 0.1.20 Release Verification (2026-10-08)

At the maintainer's explicit release request, prepared core/Crossmark tarballs
were installed into a separate production-only consumer with install scripts
disabled. Its audit reported zero vulnerabilities; installed packages did not
include @crossmarkio/sdk, @crossmarkio/typings, @transia/xrpl, node-forge or
elliptic. SSR import and strict NodeNext declaration consumption passed.

The browser build and release smoke checks passed. A fresh policy audit still
reported 10 root findings (3 high, 7 low) in development tooling and zero in
the website. Existing exceptions and their 2026-11-04 deadline are retained.
Closing #48 for this scoped consumer packaging remediation does not claim
upstream cryptography is patched, dev tooling is clean, or the upstream license
discrepancy is resolved. Exact shipped license text and notices are retained.
