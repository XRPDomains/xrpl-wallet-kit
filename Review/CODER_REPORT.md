# XRPL Wallet Kit — Coder Report

_Prepared by Redstone · 2026-06-23_

---

## Bug 1 — `mount` option silently dropped in `WalletModal` constructor

**Severity:** High — `mount` option is documented in `WalletUiOptions` but has zero effect at runtime.

### Root cause

`config.ts` — `resolveWalletUiOptions()` has a deliberate return type that omits `mount`:

```ts
// config.ts line 4
export function resolveWalletUiOptions(
  overrides: (WalletUiConfig & Partial<Omit<WalletUiOptions, "manager" | "mount">>)
): Partial<Omit<WalletUiOptions, "manager" | "mount">>
```

The constructor in `modal.ts` spreads the result, which never includes `mount`:

```ts
// modal.ts line 59
this.options = { manager: options.manager, ...resolveWalletUiOptions(options) };
//                                         ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
//                     spread never carries `mount` — it's excluded from the return type
```

At render time, `mount` is always `undefined`:

```ts
// modal.ts line 325
(this.options.mount ?? document.body).appendChild(this.root);
//  ^^^^^^^^^^^^^^^^^^^ always undefined → always appends to document.body
```

### Fix

Add `mount` explicitly before the spread, same pattern as `manager`:

```ts
// modal.ts line 59
this.options = {
  manager: options.manager,
  mount: options.mount,          // ← add this line
  ...resolveWalletUiOptions(options),
};
```

No change needed in `config.ts` — keeping `mount` out of `resolveWalletUiOptions` is correct (it's an instance concern, not a config concern).

---

## Bug 2 — Internal navigation re-mounts overlay to `document.body`, bypassing custom container

**Severity:** Medium — affects any app that provides `mount` option (including the Theme Builder preview).

### Root cause

`modal.ts` private `mount(view)` is called on **every internal navigation** — list → connect → QR → back. Each call:

1. Closes current overlay (`this.close(false, false, false)`)
2. Calls `removeExistingOverlays()`
3. Creates a brand-new `div.xwk-overlay` element
4. Appends it via `(this.options.mount ?? document.body).appendChild(this.root)`

Because of **Bug 1**, `this.options.mount` is always `undefined` at step 4, so every navigation re-appends to `document.body` regardless of what the caller passed.

### Trigger sequence

```
User opens modal  →  open() → mount("list")          → .xwk-overlay in body
User clicks wallet →  ensureMounted("connect")         → new .xwk-overlay in body
User clicks Back  →  handleBack() → showList()
                   → mount("list")                     → new .xwk-overlay in body
```

Any workaround that relocates the overlay to a custom container (e.g. via MutationObserver) gets undone on the very next navigation step.

### Fix

Fixing Bug 1 (preserving `options.mount` in `this.options`) is sufficient — `mount(view)` on line 325 will then correctly append to the caller-provided element on every internal navigation.

No logic change needed in the navigation flow itself.

---

## Feature Request — `WalletInline` component (inline/block display mode)

**Priority:** Medium — low effort once the SDK is stable, unlocks important use cases.

### Problem

Currently the kit only exposes `WalletModal` (popup overlay, `position: fixed`, backdrop, scroll-lock). There is no way to render the wallet selection UI as a regular block element embedded inside a page section.

### Use cases

- Dedicated "Connect Wallet" onboarding page — modal popup adds unnecessary friction
- Multi-step form flow — wallet selection is one step among many, not an interrupt
- Sidebar / drawer panels in dApps
- Documentation/demo previews (e.g. the Theme Builder)
- Any mobile-first app that wants a bottom-sheet wired into their own scroll container

### Proposed API

New class `WalletInline` exported from `@xrpl-wallet-kit/ui`:

```ts
import { WalletInline } from '@xrpl-wallet-kit/ui'

const inline = new WalletInline({
  manager,                    // same WalletManager as today
  themeMode: 'dark',
  theme: { accent: '#4aa3ff' },
  layout: 'grid',
})

inline.mount('#wallet-section')  // renders directly into the element, no overlay
inline.destroy()
```

### What changes vs `WalletModal`

| Concern | `WalletModal` | `WalletInline` |
|---|---|---|
| Positioning | `position: fixed; inset: 0` | Normal document flow (`position: static`) |
| Backdrop | Full-screen overlay | None |
| Scroll-lock | Yes (`lockPageScroll`) | No |
| Close button / Escape | Yes | No (caller controls lifetime) |
| Mount target | `document.body` (default) | Caller-provided element (required) |
| `open()` / `close()` | Yes | Not needed — renders on `mount()` |

### Implementation notes

- Most rendering logic (`renderShell`, `renderWalletList`, `renderWalletConnect`, `bind`) can be extracted into a shared base class or utility module
- `WalletInline` reuses all adapter, theme, and i18n plumbing unchanged
- `WalletButton` / `WalletManager` integration: caller listens to `inline.on('connect', …)` rather than opening/closing a modal
- Only `WalletModal`-specific concerns to remove: backdrop click handler, `lockPageScroll`/`unlockPageScroll`, Escape key handler, close animation, `isOpen()` guard

### Suggested export path

```ts
// @xrpl-wallet-kit/ui
export { WalletModal }   // existing
export { WalletInline }  // new

// @xrpl-wallet-kit/client / createWalletKit
// add inlineModal?: WalletInlineOptions as optional config key
```

---

_End of report. Questions or discussion → open a GitHub issue or ping Redstone._
