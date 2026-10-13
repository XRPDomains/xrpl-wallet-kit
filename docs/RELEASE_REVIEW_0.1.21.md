# 0.1.21 Pre-Release Review

Reviewed on 2026-10-13 using Open Code Review delegate mode. The OCR CLI selected
files and resolved rules; the host agent reviewed the code. The ordinary OCR
LLM review could not run because no endpoint was configured.

## Findings Addressed

- High: default Ledger multisign passed a prefixed signing preimage to firmware
  that adds its own prefix and signer account. Send ordinary unsigned transaction
  serialization; verify the returned signature against the multisign preimage.
- High: device signatures were not locally verified. Verify single-sign and
  multisign signatures before returning a blob or submitting it.
- High: signing could continue after disconnect or a replacement connection.
  Capture the signing session/device generation and reject stale results before
  submission. Reject late connections and stale account discovery; discovery
  closes only its own temporary transport.
- Medium: broad signing error translation mislabeled RPC errors as device errors.
  Translate only the device signing operation; preserve RPC/validation errors.
- Medium: standalone inner Batch protection only recognized numeric Flags.
  Also reject the SDK object form with `tfInnerBatchTxn: true`.
- Release validation: the website CDN smoke check still assumed URL literals in
  widgets. Check the shared loader URL and both widget calls instead.

The Ledger comparison used xrpl-connect's current adapter implementation and
[error-preservation fix #204](https://github.com/XRPL-Commons/xrpl-connect/commit/dee50719).
Implementations remain aligned with this repository's contracts.

## OCR Coverage

All 16 files selected in the initial OCR delegate preview were reviewed:

- `examples/react/package.json`
- `examples/react/src/main.tsx`
- `examples/vanilla/index.html`
- `examples/vanilla/src/main.ts`
- `packages/adapters/ledger/src/index.ts`
- `packages/core/src/index.ts`
- `packages/core/src/manager.ts`
- `packages/core/src/preflight.ts`
- `packages/core/src/types.ts`
- `scripts/serve-react.mjs`
- `scripts/serve-vanilla.mjs`
- `website/.vitepress/config.ts`
- `examples/shared/BatchPanel.tsx`
- `examples/shared/batch.css`
- `examples/vanilla/src/react-preview.tsx`
- `packages/core/src/batch.ts`

Supplementary review covers the regression tests, release workflow, package and
lockfile version alignment, release smoke checks, and release documentation.
Unrelated user audits, notes and local MCP configuration are excluded.

## Validation Boundaries

Regression tests use mocked RPC/device operations and offline test keys. They do
not establish real-device compatibility for every firmware or transaction type.
Payment was previously confirmed manually by the user. NFT acceptance and
multisign still need physical-device testing. Ledger Batch support is not claimed.

Batch remains experimental and requires explicit adapter opt-in, enabled
BatchV1_1 and fixBatchV1_2 amendments, a compatible xrpl.js SDK and live wallet
acceptance testing. Outer success alone never confirms the Batch's inner results.
