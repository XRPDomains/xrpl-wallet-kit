# Design Critique: XRPL Wallet Kit UI

**Product:** Wallet connection modal + account button for XRPL browser dApps
**Stage:** Pre-launch, production-ready
**Comparison bar:** MetaMask Extension Modal, RainbowKit 2.x, WalletConnect AppKit
**Basis:** Visual tests (list/connect/QR/account states × light/dark/card/icon layouts), iOS Chrome mobile simulation, full source review (modal.ts, button.ts, themes.ts)

---

## Overall Impression

Dark theme + Card layout is genuinely polished — the rounded-corner card grid, deep `#111827` background, and high-contrast `#f8fafc` text hit the same visual tier as RainbowKit. The light theme is competent but forgettable: flat surfaces with no shadow make the modal feel like it sits *on* the page rather than *above* it. The single highest-leverage design improvement is adding a `box-shadow` to the light-mode modal — it would cost one CSS token and elevate the light theme to the same quality level as the dark one.

---

## 1. First Impression (2 seconds)

**What draws the eye first:** The modal title "Connect Wallet" and the wallet list — correct priority, exactly what the user needs to act on.

**Emotional reaction (dark + card):** Modern, trustworthy, slightly premium. Comparable to RainbowKit. Users in the crypto space will recognize this pattern immediately and feel at home.

**Emotional reaction (light + list):** Functional but plain. The flat white modal on a light dApp page has no depth cue to signal "this is a focused overlay." A user unfamiliar with wallet modals might not immediately understand they're in a blocking dialog.

**Is the purpose clear?** Yes — the title, wallet list, and close button communicate the task instantly. No onboarding copy needed.

---

## 2. Usability

| Finding | Severity | Recommendation |
|---------|----------|----------------|
| **Backdrop click closes modal** (UI1 — fixed) | ✅ Fixed | Matches universal modal expectation; correctly implemented. |
| **Connect status text is now contextual** (UI3 — fixed) | ✅ Fixed | "Open your Xaman app and approve" vs generic text — right decision. |
| **No loading skeleton on initial open** | 🟡 Moderate | The wallet list appears immediately but availability badges ("Installed") may flicker in after the async `getWalletAvailability()` call. On slow connections the list jumps. A skeleton shimmer for badge state would eliminate the flash. |
| **QR view "Open Wallet" button invisible when no deeplink** | 🟢 Minor | The button is hidden (not just disabled) when no deeplink is available. Users who look for it won't know it exists for their wallet. Consider showing it as disabled with a tooltip: "Deep link not available for this wallet." |
| **Retry UX in error state uses spinning icon only** | 🟢 Minor | After connection rejection, the retry button shows a spinning icon while retrying but no text change. A brief "Retrying…" label reduces uncertainty. |
| **Group expand requires exact button tap — no chevron affordance** | 🟢 Minor | The wallet group button (e.g., "WalletConnect — 5 wallets") doesn't have a chevron or arrow indicator that it's expandable. Users unfamiliar with the pattern may not know to tap it. Add `›` or a chevron SVG to the right edge. |
| **Back button visually hidden (not removed) in list view** | 🟢 Minor | The back button uses `visibility:hidden; display:inline-flex` to preserve layout space. On mobile this creates a 44×44px invisible tap target in the top-left of the header — can cause accidental taps near the screen edge. Consider `display:none` with a min-width on the title cell instead. |

---

## 3. Visual Hierarchy

**What draws the eye first:** Title → Wallet list items → Close button. This is the correct order for the task.

**Reading flow:**
- **List view:** Clean F-pattern. Logo → name → group label reads naturally in list layout. Card/grid layout shifts to Z-pattern which works well for icon-forward scanning.
- **Connect view:** Center-weighted — spinner → wallet name → status text. Good for a "waiting" state; the eye has nowhere to go which matches the intent.
- **QR view:** Top-to-bottom: QR card → copy action → deeplink action → help text. Logical and unambiguous.

**Emphasis issues:**

- **Footer "XRPL Wallet Kit" is almost invisible** — 10px / weight 300 / muted color. This is intentional branding but at this size and weight it reads as a legal disclaimer rather than a brand mark. If the footer serves a purpose (branding or "powered by" trust signal), it should be at least 12px / weight 400. If it doesn't, removing it recovers 36px of vertical space — meaningful on 667px-height iPhones.

- **Network badge is excellent** — Amber "TESTNET" pill in the top-right of the list view is immediately visible and distinctive. High severity, correctly emphasized. ✅

- **Installed badge competes with wallet name in list layout** — The grey "Installed" pill on the right side of each wallet row is visually correct (muted, secondary) but on narrow screens (375px) it can cause the wallet name to truncate aggressively (`text-overflow:ellipsis`) before the badge. On a 375px screen "MetaMask" stays full, but longer names like "XRPL Ledger Nano" truncate to "XRPL Ledger…" The badge adds value but name truncation is a higher priority.

- **Group label (11px muted)** — The secondary line under wallet name in card/grid layout (`wallet.group` or `wallet.type`) at 11px is borderline unreadable, especially on non-Retina screens. This information (e.g., "Extension", "Mobile") is useful for user decision-making. Consider 12px minimum.

---

## 4. Consistency

| Element | Issue | Recommendation |
|---------|-------|----------------|
| **Light vs dark modal elevation** | Light modal has `box-shadow:none` (hardcoded in lightTheme); dark modal also `none` but dark background handles depth via contrast. Light theme modal floats flat on the page — no visual separation from background content. | Add `shadow: "0 8px 40px rgba(15,23,42,.12)"` to lightTheme default. Let developers override via the `shadow` theme token (already in the API). |
| **Border radius token used inconsistently on mobile** | `renderMobileSheetOverrides()` overrides border-radius with `!important` for the bottom-sheet. This bypasses the `radius` design token set by the developer. A white-label developer who sets `radius: "20px"` will get 14px on mobile (kit default). | Pass the theme's `radius` into `renderMobileSheetOverrides()` instead of hardcoding. |
| **Wallet button border-radius is 16px hardcoded** | `.xwk-wallet { border-radius: 16px }` is in `renderStyles()` as a literal, not using `walletRadius` token. The `walletRadius` token only applies to `.xwk-action` buttons. | Apply `${theme.walletRadius}` to `.xwk-wallet` for consistent token usage. |
| **Connect view icon border-radius (16px) vs list icon (12px)** | List view wallet icons use `border-radius:12px`, connect view uses `border-radius:16px`. These are different states of the same wallet — visual inconsistency when transitioning between states. | Unify to a single `iconRadius` value or align both to `walletRadius`. |
| **Spinner color differs between themes** | Light spinner uses `#cbd5e1` (barely visible at 1.48:1 on white — purely decorative). Dark uses `#94a3b8` (6.92:1 — clearly visible). The loading state communicates differently across themes. | Not a hard bug (spinner is decorative, text communicates state) but worth noting for visual consistency. |
| **Action button min-height 46px vs wallet button min-height 64px+** | The QR action buttons (Copy URI, Open Wallet) are 46px while the wallet list buttons are 64–100px. The height jump between views is jarring. Consider 52px for action buttons to reduce the contrast. |

---

## 5. Accessibility

(Full detail in `ACCESSIBILITY_AUDIT.md`. Summary for critique context:)

- **Color contrast:** All major text pairs pass WCAG AA. Single failure: "Installed" badge text `#6b7280` on `#f0f1f3` = 4.28:1 (needs 4.5:1). Fix: darken to `#5c6878`. ← **Only change needed for full AA compliance.**
- **Touch targets:** All buttons ≥44px. ✅
- **Text readability:** Footer at 10px/weight-300 passes contrast numerically but fails real-world readability. Group labels at 11px are at the minimum floor.
- **Focus states:** `focus-visible` implemented correctly — ring only on keyboard, not mouse. ✅
- **Screen reader:** All critical paths announced correctly. Minor gap: QR code container has no descriptive label guiding blind users to the Copy URI fallback.

---

## 6. What Works Well

- **Dark + Card combo** is production-quality. Comparable to RainbowKit 2.x in visual polish. The `#111827` base with `#1f2937` surface cards and high-contrast text creates genuine depth without shadows.

- **Bottom sheet on mobile** is done right — `dvh` (not `vh`), `env(safe-area-inset-*)` all 4 sides, `overscroll-behavior:contain`, iOS momentum scroll. This level of mobile detail is rare in wallet kit UIs.

- **QR code rendering** with 3-layer fallback (qr-code-styling → qrcode library → raw URI) and dark/light color awareness is robust. The dots style with rounded corners looks premium.

- **Error copy is specific and actionable** — "Connection was rejected in the wallet." tells the user exactly what happened. Most wallet UIs show "Error: -32000" in this state.

- **Connect status text is now context-aware** — Hardware wallets get "Confirm on your Ledger device", mobile wallets get "Open your Xaman app and approve." This is a significant UX improvement over the generic "Click connect in your wallet popup" baseline.

- **`prefers-reduced-motion` support** — Fully implemented, all CSS transitions disabled. This is WCAG AA + Apple HIG compliant and frequently skipped by competitors.

- **Account button identity resolution** — XRP Domains avatar, hash-based gradient fallback, balance with "Not activated" state, copy feedback with 1.4s reset. This is a complete, production-grade component.

- **Theme system flexibility** — 12 CSS token overrides, 4 layout modes, 4 presets. The API surface is well-designed for white-labeling without requiring fork/rebuild.

---

## Priority Recommendations

**1. Add box-shadow to light theme default** — The single change with the biggest visual impact. One line in `themes.ts`:
```ts
// lightTheme
shadow: "0 8px 40px rgba(15,23,42,.12), 0 0 0 1px rgba(15,23,42,.04)"
```
This makes the light modal visually comparable to the dark version, and is fully overridable via the `shadow` token.

**2. Fix badge text contrast (A1 — WCAG compliance)** — Required for full AA. One variable in `renderStyles()`:
```ts
const badgeColor = dark ? "#cbd5e1" : "#5c6878"; // was #6b7280 (4.28:1 → 5.01:1)
```

**3. Apply `walletRadius` token to wallet list buttons** — Currently `border-radius:16px` hardcoded on `.xwk-wallet`. Pass `${theme.walletRadius}` instead. Ensures white-label `radius` token flows through consistently.

**4. Increase group label font-size to 12px minimum** — `groupFontSize` currently starts at 11px (`textSize:"sm"` default). `12px` is the practical floor for secondary text on non-Retina screens:
```ts
const groupFontSize = textSize === "lg" ? "13px" : "12px"; // was "11px"
```

**5. Add chevron to wallet group button** — Visual affordance for "this is expandable." A 16×16px right-chevron SVG in muted color, aligned to the right side of the group row, reduces discovery friction significantly. Low effort, high clarity gain.

**6. Skeleton / stable badge state on open** — Prevent the Installed badge flicker. Two options: (a) render badge hidden and fade-in after `getWalletAvailability()` resolves, or (b) reserve badge space with a ghost placeholder during loading. Option (a) is simpler.

---

## Score vs Peers

| Dimension | XRPL Wallet Kit | RainbowKit 2.x | WalletConnect AppKit |
|-----------|----------------|----------------|----------------------|
| Visual polish (dark) | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| Visual polish (light) | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| Mobile UX | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| Theme flexibility | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ |
| Error UX | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ |
| Accessibility | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ |
| Loading states | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| Account panel | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ |

> **Verdict:** Dark theme is already best-in-class for the XRPL ecosystem. Light theme needs the shadow fix to reach parity with EVM competitors. Fixes 1–4 above would bring the overall design to release quality across all combinations.
