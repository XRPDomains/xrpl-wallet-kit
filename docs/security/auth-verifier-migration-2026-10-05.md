# Auth Verifier Security Migration - 2026-10-05

Follow-up to [issue #48](https://github.com/XRPDomains/xrpl-wallet-kit/issues/48).
This is an unreleased change, not an update to installed npm 0.1.19 packages.

## Changes and Compatibility

- Remove the default `verify-xrpl-signature@9.2.0` import and optional/dev peer.
  Signed transaction verification uses the maintained XRPL codec and
  ripple-keypairs 2/3 peers already supported by auth. No crypto major override.
- Preserve `signature` versus `signedTx` routing, message hashing for compact
  proofs, Account/memo binding and signer-derived address binding.
- Preserve explicit `dependencies.verifyXrplSignature` injection. Require an
  affirmative validity result; ambiguous objects no longer authenticate.
- Preserve the default first-multisigner identity policy. This is not a ledger
  quorum or RegularKey/delegation authorization check. Custom network
  definitions and authorization policies need a reviewed injected verifier.
- Malformed/unsigned transaction blobs and malformed or invalid UTF-8 first
  memos return false. Missing peers remain actionable errors.
- Standard dApps do not need a proof-format or API change. Custom peer loaders
  now load `xrpl` and `ripple-keypairs`, not the old verifier. After upgrading,
  remove the old dependency if no other code uses it; regenerate consumer locks.

## Remaining Dependency Exposure

Root findings fall from 11 to 10 (3 high, 7 low), not to zero. Crossmark SDK
0.4.0 / typings 0.0.6 remain the latest registry releases checked today. Their
node-forge and legacy XRPL/elliptic chains remain unresolved; the adapter's SDK
transport is not replaced or disabled. Website findings remain zero.

The compatible Crossmark nested ripple-keypairs update from 1.3.1 to 1.4.0 is
applied. npm reports `fixAvailable: true` for elliptic, but ripple-keypairs 1.4.0
still depends on elliptic ^6.5.4; latest elliptic 6.6.1 is within the advisory's
affected `<=6.6.1` range. Audit-fix dry-run does not remove the advisory.
The compatible modern ripple-keypairs 2.0.0 to 2.1.0 lockfile update is also
applied; auth's public supported peer range remains 2/3.

The existing expiring exception now records this exact reviewed boolean and
advisory range with a reason. Unknown/critical findings, concrete fix targets,
changed affected ranges under that review and expiry still fail. This does not
assert there is a patched elliptic release or hide raw finding counts.

## Validation Scope

Regression tests use real Ed25519 and secp256k1 signed transactions and compact
proofs, first-multisigner proofs, wrong keys/accounts, changed message/memo,
malformed/unsigned blobs, injected validity results and modern peer loading.
No ledger transactions are submitted. Live Crossmark and hardware checks are
not claimed; issue #48 stays open until the remaining upstream chains are fixed.

Local validation: all 345 tests passed, typecheck and dependency boundaries
passed, strict duplication and consumer bundle budget checks passed, and the
website build passed. Readable and minified browser functional smoke tests
passed; no npm publication is part of this change.

## References

- [XRPL binary serialization and signatures](https://xrpl.org/docs/references/protocol/binary-format)
- [XRPL.js signing implementation](https://github.com/XRPLF/xrpl.js/blob/main/packages/xrpl/src/Wallet/signer.ts)
- [Elliptic advisory](https://github.com/advisories/GHSA-848j-6mx2-7j84)
