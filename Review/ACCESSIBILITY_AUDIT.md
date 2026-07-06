# Accessibility Audit: XRPL Wallet Kit UI

**Standard:** WCAG 2.1 AA
**Date:** 2026-05-27
**Scope:** `packages/ui/src/modal.ts`, `button.ts`, `themes.ts` — all views (list, connect, qr) + account panel
**Method:** Static code analysis + automated contrast verification (Python wcag formula) + prior visual simulation (Chrome/iOS UA)

---

## Summary

**Issues found: 7 | 🔴 Critical: 0 | 🟡 Major: 1 | 🟢 Minor: 6**

The modal's core accessibility foundations are **production-grade**: focus trap, escape handling, ARIA semantics, aria-live regions, prefers-reduced-motion, and focus-visible are all correctly implemented. The sole major gap is a marginal contrast failure on the "Installed" badge text in light mode. The minor findings are polish-level improvements that don't block users.

---

## Findings

### Perceivable

| # | Issue | WCAG | Severity | Recommendation |
|---|-------|------|----------|----------------|
| A1 | **Badge text fails AA contrast (light mode)** — `#6b7280` on `#f0f1f3` = **4.28:1** (need 4.5:1). Affects "Installed" badge on list layout. | 1.4.3 | 🟡 Major | Darken badge text to `#5c6878` → 5.01:1. One CSS variable change in `renderStyles()`. |
| A2 | **Badge dot fails non-text contrast (light mode)** — `::before` dot `#9ca3af` on `#f0f1f3` = **2.25:1** (need 3:1 for graphical objects). | 1.4.11 | 🟢 Minor | Dot is decorative (text "Installed" carries the meaning). Add `aria-hidden="true"` to `::before` (not addressable in CSS), OR darken dot to `#768497` (3.08:1). Since dot is purely decorative alongside text, lowest priority. |
| A3 | **Footer font-weight:300 at 10px** — Very thin weight at the smallest size in the component. Light theme muted (#64748b on #fff = 4.76:1 passes) but weight 300 significantly reduces perceived contrast below the measured ratio. | 1.4.3 (best practice) | 🟢 Minor | Change `font-weight:300` → `font-weight:400` in `.xwk-footer`. Keeps same size, removes thin-weight readability issue. |
| A4 | **QR code has no accessible text alternative for screen readers** — The rendered QR SVG/canvas has no `aria-label` or `aria-describedby`. A blind user cannot scan a QR code, so they need a clear affordance to the URI copy path. | 1.1.1 | 🟢 Minor | Wrap QR container with `aria-hidden="true"` and ensure the "Copy URI" button has a visible label (already does). Additionally, add an `aria-description` or visually-hidden `<span>` near the QR: *"QR code — use the Copy URI button below to connect."* |

### Operable

| # | Issue | WCAG | Severity | Recommendation |
|---|-------|------|----------|----------------|
| B1 | **Group preview "+N" span lacks context for screen readers** — `<span class="xwk-mini-more">+2</span>` is read as "plus 2" with no information about what the 2 represents. | 2.4.6 (Headings/Labels) | 🟢 Minor | Add `aria-label="+2 more wallets"` to the `xwk-mini-more` span in `renderWalletGroup()`. |
| B2 | **Connect view spinner div has no `aria-hidden`** — `<div class="xwk-spinner">` wraps the decorative animation + wallet icon (`alt=""`). The `<p role="status" aria-live="polite">` already handles the ARIA announcement; the spinner content is redundant for screen readers and may cause double-reading on some combinations. | 4.1.2 | 🟢 Minor | Add `aria-hidden="true"` to `<div class="xwk-spinner">`. The status `<p>` already owns the communication. |

### Robust

| # | Issue | WCAG | Severity | Recommendation |
|---|-------|------|----------|----------------|
| C1 | **Dialog uses `aria-label` instead of `aria-labelledby`** — The overlay has `aria-label="Connect Wallet"` hardcoded. When the title changes to "WalletConnect" or a wallet name during connect/QR views, the `aria-label` does not update automatically. The visible `.xwk-title` element does update correctly. | 4.1.2 | 🟢 Minor | Replace `aria-label` with `aria-labelledby="xwk-title-id"`. Add `id="xwk-title-id"` to the `.xwk-title` `<h2>` element. The ARIA label then always matches the visible heading — no manual sync needed. |

---

## Color Contrast Check

All values measured with WCAG relative luminance formula.

### Light Theme (`#ffffff` / `#f8fafc` background)

| Element | Foreground | Background | Ratio | Required | Pass? |
|---------|-----------|------------|-------|----------|-------|
| Body text | `#111827` | `#ffffff` | **17.74:1** | 4.5:1 | ✅ |
| Muted text (status, footer, help) | `#64748b` | `#ffffff` | **4.76:1** | 4.5:1 | ✅ |
| Muted text on surface | `#64748b` | `#f8fafc` | **4.55:1** | 4.5:1 | ✅ |
| Wallet name | `#333333` | `#f8fafc` | **12.08:1** | 4.5:1 | ✅ |
| Accent / focus ring | `#0078ae` | `#ffffff` | **4.89:1** | 4.5:1 | ✅ |
| **Installed badge text** ⚠️ | `#6b7280` | `#f0f1f3` | **4.28:1** | 4.5:1 | ❌ |
| Badge dot (decorative) | `#9ca3af` | `#f0f1f3` | **2.25:1** | 3:1 (non-text) | ❌ |
| Error amber text | `#b45309` | `#ffffff` | **5.02:1** | 4.5:1 | ✅ |
| Network badge text | `#92400e` | `#fef3c7` | **6.37:1** | 4.5:1 | ✅ |
| Focus ring on surface | `#0078ae` | `#f8fafc` | **4.67:1** | 3:1 (UI component) | ✅ |
| Close/back btn hover | `#111827` | `#f1f5f9` | **16.19:1** | 4.5:1 | ✅ |
| QR loading text | `#64748b` | `#f8fafc` | **4.55:1** | 4.5:1 | ✅ |
| Spinner animation (decorative) | `#cbd5e1` | `#ffffff` | **1.48:1** | — (decorative) | N/A |

### Dark Theme (`#111827` / `#1f2937` background)

| Element | Foreground | Background | Ratio | Required | Pass? |
|---------|-----------|------------|-------|----------|-------|
| Body text | `#f8fafc` | `#111827` | **16.96:1** | 4.5:1 | ✅ |
| Muted text | `#94a3b8` | `#111827` | **6.92:1** | 4.5:1 | ✅ |
| Muted text on surface | `#94a3b8` | `#1f2937` | **5.72:1** | 4.5:1 | ✅ |
| Wallet name | `#f8fafc` | `#1f2937` | **14.03:1** | 4.5:1 | ✅ |
| Accent / focus ring | `#4aa3ff` | `#111827` | **6.74:1** | 4.5:1 | ✅ |
| Badge text | `#cbd5e1` | `#1f2937` | **9.89:1** | 4.5:1 | ✅ |
| Error amber | `#fbbf24` | `#111827` | **10.63:1** | 4.5:1 | ✅ |
| Network badge | `#fbbf24` | `#111827` | **10.63:1** | 4.5:1 | ✅ |

---

## Keyboard Navigation

| Element | Tab Reachable | Enter/Space | Escape | Arrow Keys | Pass? |
|---------|--------------|-------------|--------|------------|-------|
| Close (×) button | ✅ | Closes modal | Closes modal | — | ✅ |
| Back (←) button | ✅ | Returns to list | Closes modal | — | ✅ |
| Wallet list buttons | ✅ | Initiates connect | Closes modal | — | ✅ |
| Group expand button | ✅ | Expands group | Closes modal | — | ✅ |
| Copy URI button | ✅ | Copies + announces | Closes modal | — | ✅ |
| Open Wallet button | ✅ | Opens deeplink | Closes modal | — | ✅ |
| Retry button | ✅ | Retries connection | Closes modal | — | ✅ |
| Focus trap (Tab) | Contained in modal | — | — | — | ✅ |
| Focus trap (Shift+Tab) | Contained in modal | — | — | — | ✅ |
| Account panel (modal mode) | ✅ Tab cycle trapped | — | Closes panel | — | ✅ |

---

## Screen Reader Behavior

| Element | What SR Announces | Issue |
|---------|-------------------|-------|
| Modal open | `"Connect Wallet, dialog"` (from `role="dialog" aria-label`) | Correct but see C1 — label doesn't update with title |
| Wallet button | `"GemWallet, Extension, button"` | ✅ Clear and complete |
| Installed badge (installed) | `"GemWallet, Extension, Installed, button"` | ✅ Correct |
| Installed badge (not installed) | Invisible (`visibility:hidden`) — SR skips | ✅ Correct |
| Group button | `"WalletConnect, 5 wallets, plus 2, button"` | ⚠️ "+2" needs context (B1) |
| Connect status | Polite announcement via `aria-live="polite"` | ✅ |
| Error state | Immediate via `role="alert"` | ✅ |
| Copy URI success | Assertive via `aria-live="assertive"` data-attribute | ✅ |
| Close button | `"Close, button"` (from button + content) | ✅ |
| Back button | `"Back, button"` | ✅ |
| QR code container | Nothing announced (no label) | ⚠️ Needs hint toward Copy URI (A4) |
| Connect spinner | Animation + icon, both decorative — may be partially read | ⚠️ Add aria-hidden (B2) |
| Decorative SVGs | All `aria-hidden="true"` — skipped | ✅ |
| `prefers-reduced-motion` | Animations disabled, no SR impact | ✅ |

---

## Priority Fixes

**1. 🟡 A1 — Badge text contrast (light mode)** — Fix: 1 line in `renderStyles()`:

```ts
// current
const badgeColor = dark ? "#cbd5e1" : "#6b7280";  // 4.28:1 ❌
// fix
const badgeColor = dark ? "#cbd5e1" : "#5c6878";  // 5.01:1 ✅
```

**2. 🟢 C1 — `aria-labelledby` on dialog** — Sync ARIA label with visible title automatically:

```ts
// In renderListShell / renderConnectShell / renderQrShell HTML:
// Add id to title element:
<h2 id="xwk-title" class="xwk-title">Connect Wallet</h2>

// Change dialog element:
// Before: aria-label="Connect Wallet"
// After:  aria-labelledby="xwk-title"
```

**3. 🟢 B1 — Group "+N" aria-label**:

```ts
// In renderWalletGroup():
// Before:
`<span class="xwk-mini-more">+${overflow}</span>`
// After:
`<span class="xwk-mini-more" aria-label="+${overflow} more wallets">+${overflow}</span>`
```

**4. 🟢 B2 — Spinner aria-hidden**:

```ts
// In renderConnectShell() HTML string:
// Before: <div class="xwk-spinner">
// After:  <div class="xwk-spinner" aria-hidden="true">
```

**5. 🟢 A4 — QR accessible hint**:

```ts
// In renderQrShell() HTML:
// Before: <div class="xwk-qr-code" ...>
// After:  <div class="xwk-qr-code" aria-hidden="true" ...>
// Add near QR card (visually hidden):
`<span class="xwk-sr-only">QR code — use the Copy URI button below if you cannot scan.</span>`
```

**6. 🟢 A3 — Footer font-weight**:

```ts
// In renderStyles() CSS string, xwk-footer rule:
// Before: font-weight:300
// After:  font-weight:400
```

---

## Confirmed Passes — No Action Needed

| Feature | WCAG Criterion | Status |
|---------|---------------|--------|
| `role="dialog"` + `aria-modal="true"` on overlay | 4.1.2 | ✅ |
| Focus trap (Tab + Shift+Tab) in main modal | 2.1.1, 2.4.3 | ✅ |
| Focus trap in account panel modal mode | 2.1.1 | ✅ |
| `lastFocusedElement` saved + restored on close | 2.4.3 | ✅ |
| `focusInitialElement()` on modal open | 2.4.3 | ✅ |
| Escape closes modal from any view | 2.1.1 | ✅ |
| `focus-visible` only (not `focus`) — keyboard ring only | 2.4.7 | ✅ |
| `outline:2px solid accent` focus indicator | 2.4.7 | ✅ |
| `aria-live="polite"` on connect status | 4.1.3 | ✅ |
| `role="alert"` on error states | 4.1.3 | ✅ |
| `aria-live="assertive"` on copy success | 4.1.3 | ✅ |
| `aria-hidden="true"` on all decorative SVGs | 1.1.1 | ✅ |
| `prefers-reduced-motion` — disables all transitions | 2.3.3 | ✅ |
| Touch targets ≥44px (close, wallet, action buttons) | 2.5.5 | ✅ |
| `touch-action:manipulation` — no double-tap delay | 2.5.5 | ✅ |
| Network badge uses text + color (not color alone) | 1.4.1 | ✅ |
| Error state uses text + amber color | 1.4.1 | ✅ |
| `env(safe-area-inset-*)` — safe area compliance | — | ✅ |
| Body scroll locked while modal open | 2.1.1 | ✅ |
| Descriptive error copy text (5 error types) | 3.3.1 | ✅ |
| Context-aware connect status text (UI3) | 3.3.2 | ✅ |
| All wallet name text (not icon alone) in buttons | 2.4.6 | ✅ |
| `overscroll-behavior:contain` — no scroll bleed | — | ✅ |

---

## Overall Score

| Criterion | Score | Notes |
|-----------|-------|-------|
| Dialog + ARIA semantics | 9/10 | Fix C1 (aria-labelledby) for perfect score |
| Focus management | 10/10 | Trap, restore, initial focus — all correct |
| Color contrast | 8.5/10 | Badge text (A1) is the only substantive fail |
| Keyboard navigation | 10/10 | Full keyboard operability across all views |
| Screen reader experience | 8.5/10 | B1 and B2 minor gaps; all critical paths announced correctly |
| Touch + mobile a11y | 10/10 | 44px targets, safe areas, no double-tap |
| Motion sensitivity | 10/10 | prefers-reduced-motion fully handled |
| **Overall WCAG 2.1 AA** | **≈ AA compliant** | 1 minor text contrast failure to fix for full compliance |

> **Verdict:** The kit is **near-AA compliant**. Fix A1 (badge contrast) to achieve full WCAG 2.1 AA. All other findings are enhancements — the product is already more accessible than most wallet connection UIs in the ecosystem.
