# XRPL Wallet Kit — Claude Code Project Guide

## Project overview

Framework-agnostic wallet adapter toolkit for XRPL browser dApps. Headless TypeScript core with optional prebuilt UI. No React required; also supports plain HTML, jQuery, and legacy apps via IIFE bundle.

## Monorepo layout

```
packages/
  core/           @xrpl-wallet-kit/core       — headless core, WalletManager, types, errors, storage, networks
  ui/             @xrpl-wallet-kit/ui          — DOM-based headless modal, connect button (no framework)
  client/         @xrpl-wallet-kit/client      — all-in-one convenience package (createWalletKit, createWalletClient)
  browser/        @xrpl-wallet-kit/browser     — IIFE bundle for plain HTML / legacy sites, Buffer polyfill
  adapters/
    xaman/        @xrpl-wallet-kit/adapter-xaman
    gemwallet/    @xrpl-wallet-kit/adapter-gemwallet
    crossmark/    @xrpl-wallet-kit/adapter-crossmark
    dropfi/       @xrpl-wallet-kit/adapter-dropfi
    walletconnect/ @xrpl-wallet-kit/adapter-walletconnect
    xrpl-snap/    @xrpl-wallet-kit/adapter-xrpl-snap
    ledger/       @xrpl-wallet-kit/adapter-ledger
examples/
  vanilla/        Vite vanilla-TS preview app
  html-jquery/    Plain HTML / jQuery example
docs/
  adapters/       Adapter contract, guides, testing checklist, templates
  UI_CONFIG_EN.md / UI_CONFIG_VI.md
  HTML_LEGACY_INTEGRATION_EN.md / _VI.md
skills/
  xrpl-wallet-kit-adapter-developer/   Adapter dev skill (read SKILL.md for workflow)
tests/
  core.test.ts    Core unit tests (Node test runner + tsx)
```

## Key commands

```powershell
npm.cmd run build            # build all packages
npm.cmd run build:browser    # build IIFE bundle (packages/browser)
npm.cmd run typecheck        # tsc --noEmit across all packages
npm.cmd test                 # Node test runner — tests/core.test.ts
npm.cmd run check:quality    # knip + jscpd + dependency-cruiser
npm.cmd run dev:vanilla      # start Vite preview at http://127.0.0.1:5173/
npm.cmd run dev:html-jquery  # start HTML/jQuery preview at http://127.0.0.1:5175/
```

Run all checks before any commit or PR:

```powershell
npm.cmd run typecheck && npm.cmd test && npm.cmd run build:browser
```

## Adapter development

When creating, reviewing, or modifying a wallet adapter, read the adapter skill first:

```
skills/xrpl-wallet-kit-adapter-developer/SKILL.md
```

Quick reference files in the skill:

- `references/adapter-checklist.md` — pre-PR review checklist
- `references/walletconnect-wallet.md` — how to add a WalletConnect wallet config
- `references/hardware-adapters.md` — Ledger/hardware-specific notes
- `references/scaffold.md` — steps for a new official monorepo adapter package
- `references/test-template.md` — Node test runner adapter test scaffold
- `templates/adapter-package/` — copy this to `packages/adapters/<id>/` to start a new package

Adapter contract doc: `docs/adapters/adapter-contract.md`
Adapter template: `docs/adapters/templates/adapter-package/src/index.ts`

## Hard rules (do not break)

- **No private keys, seeds, secrets, or WalletConnect projectId in SDK or adapter code.**
- **No business/app API calls inside adapters** — XRPDomains, setPrimary, signAuthPayload, isVerify, etc. belong only in the app layer.
- **No DOM modals, jQuery, React, Next, or framework code inside adapters.**
- **Do not add set-primary, default-domain, or identity verification logic to the SDK.**
- **Do not hardcode WalletConnect projectId** — always require caller injection.
- **`PROJECT_MEMORY.md` is local-only** — do not commit it.
- **`docs/` is blank on GitHub** (only `.gitkeep`) — public docs will be added separately.
- WalletConnect required namespaces only declare `xrpl_signTransaction` — intentional design for broad wallet compatibility.
- WalletConnect detail adapters (Bitget, Joey, Girin, etc.) do not background-recover - intentional. However, request-time stale WalletConnect proposal/key/pairing errors are not intentional UX; adapters should best-effort clear stale sessions/pairings and return a reconnect-friendly error before sending another request.

## Package architecture

```
core ← (no deps on ui, adapters, or framework)
ui   ← core only
adapters/* ← core only (never ui)
client ← core + ui + all adapters
browser ← client + Buffer polyfill + IIFE bundle
```

Never add ui or adapter cross-imports to `core`. Never add business logic to adapters or core.

## Session storage

Sessions are stored as a versioned envelope:

```ts
{ version: 1, session: WalletSession, updatedAt: number }
```

Legacy unversioned sessions (`{ adapterId, account, connectedAt }`) are auto-migrated on read. Do not break this path when modifying `parseStoredSession`.

## WalletConnect namespace

XRPL chain ID: `xrpl:0` (mainnet). Required method: `xrpl_signTransaction`. Optional methods for future consideration: `xrpl_signMessage`, `xrpl_signTransactionFor`.

## Versioning

All packages are currently at `0.1.0`. Adapter API contract version: `WALLET_ADAPTER_API_VERSION = "1.0"`. Any breaking interface change requires discussion first.

## Environment setup

Copy `.env.example` to `.env.local` and set:

```
VITE_WALLETCONNECT_PROJECT_ID=<your WC project ID>
VITE_XAMAN_CLIENT_ID=<your Xaman client ID>
```

Empty keys intentionally disable those adapters in examples.

---

## Cowork agent editing rules (MANDATORY)

These rules exist because Claude Cowork sessions hit two recurring failure modes
that silently corrupt files:

1. **Stale context** — an earlier read of a file is cached in the agent's
   working memory; another agent / formatter / the user edits the file; the
   agent then writes based on the stale view, clobbering or duplicating content.
2. **Truncated writes** — large file rewrites via the Write tool occasionally
   land with the tail cut off (10–50 lines missing, sometimes with a string of
   null bytes appended). Symptom is usually a "SyntaxError: Unexpected end of
   input" at the end of the file, or HTML/JS that ends mid-statement.

### Re-read before every edit

- Before every `str_replace` / `Write` / `Edit` call, re-read the target file
  from disk if any of the following are true:
  * a `system-reminder` says the file was modified
  * another agent or skill ran since the last read
  * more than ~15 turns have passed since the last read
- After ANY successful write to a file, treat earlier views of that file as
  invalid. Re-read before the next edit to the same file.

### Prefer surgical edits over full rewrites

- Default to `str_replace` on the smallest unique block.
- Files > 300 lines: edits MUST be incremental, block-by-block. No full rewrite
  unless explicitly requested by the user.
- Files > 1000 lines: never reproduce the file verbatim in output. Multiple
  small `str_replace` calls beat one full write.
- When a write IS necessary on a large file, write via `bash` heredoc to
  `/tmp/<name>` then `cp` into place — this avoids the Write tool's intermittent
  tail truncation:
  ```bash
  cat > /tmp/foo.js <<'EOF'
  ...file contents...
  EOF
  cp /tmp/foo.js /path/to/foo.js
  ```

### `str_replace` correctness

- `old_str` must match raw file bytes exactly: whitespace, indentation, line
  endings. If a `str_replace` fails to match, RE-READ the file and copy the
  exact current text. Never guess or retry with the same string.
- Never include line-number prefixes or display artifacts in `old_str`.
- For files with mixed CRLF/LF, do not silently convert line endings.

### Verify after every write

After writing or editing, run a lightweight integrity check on the affected
file. The check depends on file type:

| File type     | Verify command                                              |
|---------------|-------------------------------------------------------------|
| `.js` / `.cjs`| `node --check <file>` (exit 0)                              |
| `.ts` / `.tsx`| `tsc --noEmit <file>` or full `npm run typecheck`           |
| `.json`       | `python3 -c "import json; json.load(open('<f>'))"`          |
| `.html`       | `grep -c '</body>' <file>` (≥ 1) AND `grep -c '</html>'`    |
| `.css`        | tail char check: file must end with `}` or media query close|
| `.md`         | size check + tail line not ending mid-sentence              |

After a batch of edits, run the project-level check:
- Wallet kit: `npm.cmd run typecheck && npm.cmd test`
- Apps: project-specific (`npm run check` if defined)

A truncated/corrupted file must be caught at write time, never committed.

### Cloud-synced folders (OneDrive, iCloud, Dropbox)

Folders under `C:\Users\<user>\OneDrive\…` may contain **cloud-only stubs**:
the file appears to exist (size, name) but the bytes are not local. Symptoms:
- `cat` returns nothing or an error
- `node --check` reports unexpected EOF mid-file
- bash mount reads an old snapshot while Windows-side has fresh content
- Mount-side `cp` writes silently land in the cloud-only proxy and never
  reach the cloud version

Mitigations:
- Trigger a download by reading the file through the Read tool (it forces
  OneDrive to materialize the bytes).
- For build artifacts that need to be copied across folders, copy via
  PowerShell `Copy-Item -Force` on the Windows side (not via bash mount).
- For files > 1 MB on OneDrive paths, expect mount-side reads to lag minutes
  behind Windows-side reality. Verify with `Get-Item <path> | Select Length`
  on the Windows side when in doubt.

### Do NOT use `AskUserQuestion`

There is a known hang bug on Windows (claude-code issue #26940) where the
`AskUserQuestion` tool freezes the session. Ask questions as **plain text
only** — list options inline, let the user reply naturally.

### Patch-based delegation for large refactors

For edits touching files > 300 lines OR multi-file refactors, prefer generating
a unified-diff patch (`diff -u`) that another tool (Codex / a separate harness)
can apply, rather than rewriting in-session. The Cowork agent focuses on
reasoning + design; large file mutation is delegated where mistakes are cheaper
to recover.

### Pre-commit safety net

Even with all the rules above, model drift in long sessions is real. The hard
guard is a pre-commit hook that re-runs the per-file integrity check on every
staged file. See `scripts/check-file-integrity.sh` for the implementation and
`.husky/pre-commit` for the wiring.
