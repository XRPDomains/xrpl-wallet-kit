# XRPL Wallet Kit — Modal & State Transitions Proposal

**For:** Wallet Kit upstream maintainer
**From:** XRPDomains integration team
**Context:** Kit v0.1.0-beta.3 / search-v2.html integration

## Problem

State changes inside the kit feel mechanical:

- Opening the connect modal pops in instantly. Same for closing.
- Switching between **wallet list → connecting → QR** views swaps DOM with `display:none` ↔ `display:block` — no fade, no slide, modal height jumps when a view is taller.
- After picking a wallet, the connect modal closes and the account panel opens in the next frame — two abrupt pops back-to-back.
- The button label flipping from address (`rXY...zT`) to Web3 name (`alice.xrp`) is a hard text swap.
- Copy button flips clipboard icon → check icon with no acknowledgement that something happened.
- Mobile bottom sheet appears with the same modal pop as desktop, not the slide-up users expect from native sheets.

Net effect: the kit looks like a static dialog, not an app surface. End users perceive each step as a small jolt instead of a continuous flow.

## Goals

1. Every state change reads as a single, continuous motion (≤ 320 ms).
2. Modal height never jumps mid-transition.
3. Mobile sheet uses the platform-native slide-up motion.
4. Identity transitions (address ↔ Web3 name) feel like the data resolved, not like the label was replaced.
5. Fully respects `prefers-reduced-motion` — degrades to crossfade only.
6. Configurable: integrators can tune duration or disable transitions entirely.

---

## A. Modal envelope (open / close)

Applies to `.xwk-overlay` (connect modal) and `.xwk-account-overlay` (account panel).

**Open**

| Element | Property | From | To | Duration | Easing |
|---|---|---|---|---|---|
| `.xwk-overlay` | opacity | 0 | 1 | 200 ms | `ease-out` |
| `.xwk-modal` | opacity, transform | 0, `translateY(8px) scale(0.97)` | 1, `translateY(0) scale(1)` | 240 ms | `cubic-bezier(0.22, 1, 0.36, 1)` |

**Close** — same in reverse, 180 ms duration, `cubic-bezier(0.4, 0, 1, 1)` (ease-in). Close needs to be faster than open or it feels sluggish.

**Implementation sketch**

```css
.xwk-overlay {
    opacity: 0;
    transition: opacity 200ms ease-out;
}
.xwk-overlay[data-xwk-state="open"] { opacity: 1; }
.xwk-overlay[data-xwk-state="closing"] {
    opacity: 0;
    transition-duration: 180ms;
    transition-timing-function: cubic-bezier(0.4, 0, 1, 1);
}

.xwk-modal {
    opacity: 0;
    transform: translateY(8px) scale(0.97);
    transform-origin: center bottom;
    transition: opacity 240ms cubic-bezier(0.22, 1, 0.36, 1),
                transform 240ms cubic-bezier(0.22, 1, 0.36, 1);
}
.xwk-overlay[data-xwk-state="open"] .xwk-modal {
    opacity: 1;
    transform: translateY(0) scale(1);
}
```

The lifecycle is: mount with `data-xwk-state="closed"` → next frame set `"open"` → on close set `"closing"` → on `transitionend` remove from DOM.

---

## B. View transitions (list ↔ connect ↔ qr)

Currently `display:none` ↔ `display:block` causes:
- No fade — both views just pop.
- Modal body height jumps because the three views have different intrinsic heights.

**Proposal: stacked layout + crossfade + height auto-animate**

1. Stack views inside `.xwk-body` so they share the same coordinate space. Use `position: relative` on `.xwk-body`, `position: absolute; inset: 0` on inactive views, and `position: relative` on active view (so it claims the height).
2. Crossfade: outgoing view `opacity: 1 → 0` over 140 ms, incoming view `opacity: 0 → 1` over 180 ms with a 60 ms delay so they overlap briefly but the outgoing fades first.
3. Add a 6 px horizontal slide that respects navigation direction (forward / back):
   - **Forward** (list → connect → qr): outgoing translates -6px, incoming starts +6px → 0.
   - **Back** (qr → connect → list, via back button): the reverse.
4. **Height auto-animation**: measure before/after with `getBoundingClientRect()`, set explicit `height` on `.xwk-body` to current value, write new view, measure new height, animate `height` via WAAPI (`element.animate([{height: oldH+'px'}, {height: newH+'px'}], {duration: 240, easing: 'cubic-bezier(0.22,1,0.36,1)'})`), then `height: auto` after.

Alternative for height: CSS Grid template rows trick (`grid-template-rows: 0fr → 1fr`) but WAAPI is more reliable for arbitrary content.

```ts
// pseudocode inside WalletModal.switchView(direction: 'forward'|'back')
const body = this.bodyEl;
const prevH = body.getBoundingClientRect().height;
body.style.height = `${prevH}px`;

// swap data-xwk-view attribute
this.overlayEl.dataset.xwkView = nextView;

requestAnimationFrame(() => {
    const nextH = body.scrollHeight;
    body.animate(
        [{ height: `${prevH}px` }, { height: `${nextH}px` }],
        { duration: 240, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }
    ).onfinish = () => { body.style.height = ''; };
});
```

---

## C. Modal-to-modal handoff

After a successful connect, the kit currently:
1. Closes `.xwk-overlay` (connect modal).
2. Renders `.xwk-account-overlay` (account panel) in the same tick.

These look like two flashes. Better: **sequence them**.

1. Close connect modal (180 ms close animation).
2. Wait 120 ms (perceptual gap so the user registers "modal closed").
3. Open account panel (240 ms open animation).

For an even nicer handoff: animate the wallet icon from its position in the connect modal to its position in the account panel button, using FLIP. Optional / nice-to-have.

---

## D. Identity update on connect button

When the kit resolves a Web3 name after connect (e.g. `rXY...zT` → `alice.xrp`):

**Current:** instant text replacement, visually jarring.

**Proposal:**
- While the name is resolving, show a 12 px wide skeleton shimmer at the end of the address (or wrap the address itself in a shimmer).
- On resolve, crossfade: outgoing label `opacity 1 → 0, translateY(0 → -4px)` over 140 ms, incoming `opacity 0 → 1, translateY(4px → 0)` over 180 ms with 60 ms delay.

```css
.xwk-button-label {
    transition: opacity 140ms ease-out, transform 180ms cubic-bezier(0.22, 1, 0.36, 1);
}
.xwk-button-label[data-xwk-changing="out"] {
    opacity: 0;
    transform: translateY(-4px);
}
.xwk-button-label[data-xwk-changing="in"] {
    opacity: 0;
    transform: translateY(4px);
    transition-duration: 0ms;
}
.xwk-button-label[data-xwk-changing="in"][data-xwk-frame="active"] {
    opacity: 1;
    transform: translateY(0);
    transition: opacity 180ms ease-out 60ms,
                transform 180ms cubic-bezier(0.22, 1, 0.36, 1) 60ms;
}
```

---

## E. Action button states (copy, disconnect, view-explorer)

**Copy address feedback**

- Icon swap from clipboard → check: crossfade 180 ms instead of instant.
- Brief background pulse on the action row for 600 ms (subtle accent-tinted overlay fading from 0.18 to 0 alpha).

```css
@keyframes xwk-copy-pulse {
    0%   { background-color: rgba(93, 200, 240, 0.14); }
    100% { background-color: transparent; }
}
.xwk-account-panel-actions button[data-xwk-just-copied] {
    animation: xwk-copy-pulse 600ms ease-out;
}
.xwk-copied-icon {
    opacity: 0;
    transition: opacity 180ms ease-out;
}
.xwk-copied-icon[data-xwk-visible] { opacity: 1; }
```

**Hover** — kit already has `transition: background-color .16s ease`, good.

**Pressed / active** — add `transform: scale(0.98)` on `:active` with 80 ms snap-back. Don't add this on touch devices (`@media (hover: hover)` only) since touch already gives haptic feedback.

---

## F. Connecting view (spinner + wallet icon)

When the user picks a wallet and the connect view appears:

1. Wallet icon: scale-in from `0.85 → 1` over 220 ms with `cubic-bezier(0.34, 1.56, 0.64, 1)` (subtle overshoot).
2. Spinner ring: starts spinning immediately but fades in from `opacity: 0 → 1` over 160 ms.
3. Status text underneath ("Confirm in your wallet…") fades in 200 ms after the icon settles.

This gives a sense of "the kit is preparing", instead of three elements appearing at once.

---

## G. Mobile bottom sheet

On `@media (max-width: 640px)` the kit already promotes the modal to a bottom-anchored sheet. Currently it still fades in / out — which on mobile reads as a "popup" instead of a sheet.

**Proposal: slide-up motion.**

| State | Transform | Opacity | Duration | Easing |
|---|---|---|---|---|
| closed | `translateY(100%)` | 1 (slides under overlay) | — | — |
| opening → open | `translateY(0)` | 1 | 320 ms | `cubic-bezier(0.32, 0.72, 0, 1)` (iOS sheet curve) |
| closing | `translateY(100%)` | 1 | 240 ms | `cubic-bezier(0.4, 0, 1, 1)` |

Overlay still fades 200 ms / 180 ms.

Also: on mobile, swipe-down-to-dismiss is a strong native expectation. Optional but worth considering: listen for `touchmove` on the sheet header, follow finger Y, snap back if released above 25% of sheet height, dismiss if below.

---

## H. Error & status messages

Currently `.xwk-status.xwk-error` appears via class toggle. Add:
- `opacity: 0 → 1` + `translateY(-4px) → 0` over 200 ms when shown.
- Optional 1-frame shake (3 px) for input validation errors only — not for connection errors (those are not the user's fault).

---

## I. Reduced motion

All proposals above must collapse gracefully when `prefers-reduced-motion: reduce`:

```css
@media (prefers-reduced-motion: reduce) {
    .xwk-overlay,
    .xwk-modal,
    .xwk-account-overlay,
    .xwk-account-panel,
    .xwk-button-label,
    .xwk-copied-icon {
        transition-duration: 1ms !important;
        animation-duration: 1ms !important;
    }
}
```

Crossfade still happens (1 ms is effectively instant but keeps the JS lifecycle intact), no scale / translate / slide.

---

## J. Proposed config API

Add to `WalletUiOptions`:

```ts
interface WalletUiTransitions {
    /** Enable all transitions. Default: true. */
    enabled?: boolean;
    /** Override durations (ms) — partial; unspecified keys keep defaults. */
    duration?: {
        modalOpen?: number;    // default 240
        modalClose?: number;   // default 180
        viewSwitch?: number;   // default 240
        identityFade?: number; // default 180
        sheetOpen?: number;    // default 320
        sheetClose?: number;   // default 240
    };
    /** Disable specific behaviors. */
    disable?: {
        heightAutoAnimate?: boolean;
        modalToModalGap?: boolean;
        identityCrossfade?: boolean;
        sheetSlide?: boolean;
        copyPulse?: boolean;
    };
}

interface WalletUiOptions {
    // ... existing ...
    transitions?: WalletUiTransitions;
}
```

Behaviour: `transitions.enabled === false` reduces everything to the current instant behaviour (escape hatch for integrators with their own motion system).

---

## K. Acceptance checklist

The coder can self-verify with:

1. **Open connect modal** — overlay fades in 200 ms, modal lifts-and-scales in 240 ms. Subjectively feels like one motion, not two.
2. **Pick a wallet (list → connect)** — wallet list view fades out and slides left 6 px while connect view fades in and slides in from right 6 px. Modal body height animates between the two view heights — no jump.
3. **Back to list (connect → list)** — same as above but reversed direction.
4. **Successful connect** — connect modal closes (180 ms), 120 ms pause, account panel opens (240 ms). User reads it as "the kit moved me to my account", not "two popups".
5. **Identity resolves after connect** — address crossfades to Web3 name (180 ms) instead of flicker-replacing.
6. **Copy address** — clipboard icon crossfades to check icon, action row gets a 600 ms accent pulse.
7. **Close account panel** — reverses cleanly in 180 ms.
8. **Mobile: open connect** — sheet slides up from bottom in 320 ms with iOS curve. Close: slides down 240 ms.
9. **Reduced motion** — everything collapses to ~instant crossfades; no scale, no slide.
10. **`transitions.enabled: false`** — identical behaviour to today (instant pops). For integrators with their own motion layer.

---

## L. Implementation cost estimate

- Section A (modal envelope): ~2 hours including state attribute lifecycle.
- Section B (view crossfade + height): ~4 hours, WAAPI height animator is the longest part.
- Section C (modal-to-modal sequencing): ~1 hour (just a setTimeout chain).
- Section D (identity crossfade): ~1.5 hours.
- Section E (action button micro-feedback): ~1 hour.
- Section F (connecting reveal): ~30 minutes.
- Section G (mobile sheet slide + optional swipe-down): ~2 hours core, +2 hours swipe-down.
- Section H (error reveal): ~30 minutes.
- Section I (reduced-motion guard): ~30 minutes.
- Section J (config API): ~1 hour wiring + types.

**Total: ~14 hours for the full pass, ~8 hours for the minimum viable subset (A + B + C + D + G).**

---

## M. References / inspiration

Patterns to look at while implementing:

- **iOS sheets** — `cubic-bezier(0.32, 0.72, 0, 1)` is the textbook iOS sheet easing.
- **Stripe Checkout modal** — modal lift + crossfade between steps is the gold standard for crypto-adjacent flows.
- **Linear app navigation** — view crossfades with 6 px directional slide.
- **WalletConnect v2 reference modal** — bottom sheet swipe-down implementation.

Happy to review a draft PR or discuss any section.
