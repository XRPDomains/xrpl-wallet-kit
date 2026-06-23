---
title: Building Adapters with AI
description: XRPL Wallet Kit ships an adapter developer skill — a structured prompt that gives Claude Code, Codex, or any AI coding agent the full adapter contract, rules, and workflow to build correct adapters from wallet documentation alone.
---

# Building Adapters with AI

XRPL Wallet Kit includes an **adapter developer skill** — a knowledge file that gives Claude Code, Codex, or any compatible AI agent everything it needs to produce a correct, contract-compliant adapter from wallet documentation alone. No hand-holding required.

::: tip The only XRPL wallet library with a dedicated AI skill
xrpl-connect and other XRPL wallet libraries have no equivalent. The XRPL Wallet Kit skill encodes the adapter contract, capability rules, error codes, session restore safety rules, cleanup requirements, and a pre-PR checklist. An AI that has read the skill cannot accidentally skip any of them.
:::

## What the skill contains

The skill is a single `SKILL.md` file at:

```
skills/xrpl-wallet-kit-adapter-developer/SKILL.md
```

It is written to be agent-readable — structured prose that any coding AI can follow without requiring specific tool support. It covers:

- The full `WalletAdapter` interface — every required and optional method with semantics
- **Capability rules** — when `signMessage`, `signTransaction`, `signAndSubmit`, `payments`, `nftOffers` may be set to `true`
- **Error mapping** — which `WalletKitErrorCode` applies to each failure case
- **Session restore rules** — when `recoverSession()` is safe to implement vs when to return `null`
- **Cleanup requirements** — WalletConnect proposals, focus/visibility listeners, deeplink timers, storage markers
- **Transaction normalization** — how to handle `hash`, `txHash`, `tx_hash`, `transactionHash`, nested response shapes
- **Hard rules** — no business logic, no UI code, no secrets inside adapters
- Validation commands to run before every commit

Plus companion reference files:

| File | Contents |
|---|---|
| `references/adapter-checklist.md` | Pre-PR review checklist (20+ items) |
| `references/walletconnect-wallet.md` | How to add a WalletConnect wallet definition |
| `references/hardware-adapters.md` | Ledger / WebHID / WebUSB notes |
| `references/scaffold.md` | Steps for creating a new official monorepo package |
| `references/test-template.md` | Node test runner scaffold for adapter tests |
| `templates/adapter-package/` | Copy-paste starter package |

---

## Activating the skill

### Claude Code

```
/xrpl-wallet-kit-adapter-developer
```

Run this slash command at the start of your session. The skill is pre-installed in the monorepo at `skills/xrpl-wallet-kit-adapter-developer/`. Claude Code reads `SKILL.md` and follows the workflow automatically.

### Codex (OpenAI)

Pass the skill as a context file:

```bash
codex --context skills/xrpl-wallet-kit-adapter-developer/SKILL.md \
  "Build a wallet adapter for MyWallet using the docs at..."
```

### Other AI agents

Any agent that can read a markdown file can use the skill. Point it at `SKILL.md` directly or paste the contents as system context.

---

## Workflow: building an adapter with AI

Follow this sequence for best results:

**Step 1 — Gather the wallet's documentation**

Collect the wallet's injected API docs, SDK README, or provider reference. A URL, a pasted README, or a screenshot all work. The more complete the docs, the better the output.

**Step 2 — Activate the skill**

```
/xrpl-wallet-kit-adapter-developer
```

**Step 3 — Describe the wallet to the agent**

Give the AI a prompt like:

> Build a WalletAdapter for MyWallet using this documentation:
>
> The wallet injects `window.myWallet` with:
> - `connect()` → `{ address, publicKey }`
> - `disconnect()`
> - `signTransaction(tx)` → `{ blob }`
> - `signMessage(msg)` → `{ signature, publicKey }`
>
> It is a browser extension. Use the adapter skill rules.

**Step 4 — Review the output**

The AI should produce:

- A factory function `createMyWalletAdapter(options)`
- Accurate capability flags (e.g. `signMessage: true` only because it is implemented)
- `WalletKitError` with the correct error code for every failure path
- `isAvailable()` that reads `window.myWallet` without throwing
- `recoverSession()` that reads passive provider state only — no `connect()` call inside it

**Step 5 — Run validation**

```powershell
npm.cmd run typecheck
npm.cmd test
npm.cmd run build:browser
```

**Step 6 — Manual smoke test**

The skill's checklist prompts you to verify:
- Wallet not installed → correct error
- Connect prompt → user approves + user cancels
- Sign request → user approves + user rejects
- Session restore after page reload
- Disconnect clears session cleanly

---

## Example prompts

These prompts work well with Claude Code after activating the skill:

**New browser extension:**
> "Build an adapter for OtsuWallet. It injects `window.xrpl` with `isOtsu === true`. Methods: `connect()`, `signTransaction(tx)`, `signMessage(msg)`. Type is `extension`. Use the adapter skill."

**WalletConnect wallet definition:**
> "Add BitgetWallet to the WalletConnect adapter's wallet list. The wallet supports EIP-155 and XRPL chains. AppStore ID: 1639703499, Play Store package: com.bitget.wallet. Icon URL: [url]. Use the walletconnect-wallet reference from the skill."

**Mobile deeplink wallet:**
> "Build a mobile deeplink adapter for WalletX. It uses a custom URI scheme `walletx://`. QR code flow on desktop, deeplink on mobile. Add `recoverSession()` using the pageshow/visibility return pattern for mobile. Use the adapter skill rules for mobile flows."

**Reviewing a contribution:**
> "Review this adapter PR against the XRPL Wallet Kit adapter contract. Check capabilities, error codes, cleanup, and `recoverSession()` correctness. Use the adapter checklist from the skill."

---

## What the skill prevents

When the skill is active, the AI automatically refuses to:

| Anti-pattern | What the skill enforces instead |
|---|---|
| Hardcode `projectId` or API keys | Always require caller injection via options |
| Add `signAuthPayload` to the adapter | Belongs in the app layer, never the SDK |
| Inject modals, alerts, or React | Adapters are pure TypeScript with no UI |
| Set `signMessage: true` before implementing it | Capabilities must match actual method implementations |
| Return `null` silently on user cancel | Must throw `WalletKitErrorCode.SIGN_REJECTED` |
| Skip WalletConnect proposal cleanup | Must call `clearStaleProposals()` + `disconnectStale()` |
| Call `connect()` inside `recoverSession()` | `recoverSession()` is passive-only |
| Submit a transaction inside `signTransaction()` | Must sign only, never submit |

---

## Why this matters: XRPL Wallet Kit vs alternatives

| | XRPL Wallet Kit | xrpl-connect |
|---|:---:|:---:|
| **Adapter developer skill** | ✅ Ships in repo | ❌ None |
| **Typed `WalletAdapter` contract** | ✅ Full interface + validator | ⚠️ Loose convention |
| **`WalletKitErrorCode` enum** | ✅ Structured error codes | ❌ Free-form strings |
| **AI workflow guide** | ✅ `SKILL.md` + references | ❌ None |
| **Pre-PR checklist** | ✅ 20+ item checklist | ❌ None |
| **Test scaffold** | ✅ Node test template | ❌ None |
| **Copy-paste starter package** | ✅ `templates/adapter-package/` | ❌ Manual |
| **Runtime contract validator** | ✅ `assertWalletAdapter()` | ❌ None |
| **Framework-agnostic** | ✅ No React required | ⚠️ React-centric |

Building an adapter for a new wallet typically takes **under 2 hours** with the skill active, from reading the wallet docs to passing `npm run typecheck && npm test`.

---

## Extending the skill

If you are building adapters outside this monorepo, you can still use the skill by pointing your AI at the `SKILL.md` file. The skill is self-contained and does not require any other files to follow the adapter contract.

For contributions to the official adapter set, read the scaffold guide:

```
skills/xrpl-wallet-kit-adapter-developer/references/scaffold.md
```

It walks through creating a new package under `packages/adapters/<id>/`, wiring it into `packages/client/`, and registering it in the browser bundle.
