# Docs Site — Design Brief

> **For**: Team docs / external design contractor
> **From**: XRPDomains FE team
> **Goal**: Build the docs site UI with visual continuity to the XRPDomains v3 app — same vibe, NOT a 1:1 copy. Docs needs reading-optimised UX (long prose, code blocks, dual light/dark mode).

---

## 1. Context & vibe

XRPDomains v3 is an XRPL identity dApp (search, mint, manage domain NFTs). The current UI follows a **sophisticated dark crypto** style — technical-feeling but polished, drawing on the visual language of Stripe Dashboard, Vercel, Linear.

The docs site should **borrow the vibe**, not replicate the chrome:

- **Tech-forward minimal**: no decorative noise, focus on content (prose + code).
- **Soft and sophisticated**, never loud — accent colours used sparingly, dark mode uses *soft midnight* rather than pure black.
- **Reading-friendly**: generous line-height, no gradient overload, no excessive shadows or glow.
- **Light mode is a first-class citizen** — devs read docs in daylight; light mode must be as polished as dark.

---

## 2. Color palette

### Dark mode (primary)

| Token | Value | Use |
|---|---|---|
| `--bg` | `#0e111a` | Page background |
| `--surface` | `#1c2434` | Cards, sidebar, code-block bg |
| `--surface-elev` | `rgba(255,255,255,0.04)` | Hover / raised state |
| `--border` | `rgba(255,255,255,0.06)` | Subtle dividers |
| `--ink` | `#e8eaf0` | Primary text |
| `--ink-soft` | `rgba(255,255,255,0.7)` | Body prose |
| `--mute` | `rgba(255,255,255,0.45)` | Captions, meta |
| `--accent` | `#25aae1` | Primary CTA, links, active state |
| `--accent-soft` | `#5dc8f0` | Hover, secondary accent |
| `--warn` | `#fbbf24` | Warning callout |
| `--success` | `#34d399` | Success callout |
| `--danger` | `#f87171` | Error callout |

### Light mode

| Token | Value | Use |
|---|---|---|
| `--bg` | `#fafbfc` | Page bg |
| `--surface` | `#ffffff` | Cards |
| `--surface-elev` | `#f3f5f8` | Code-block bg |
| `--border` | `rgba(15,23,42,0.08)` | Dividers |
| `--ink` | `#0f172a` | Primary text |
| `--ink-soft` | `#334155` | Body prose |
| `--mute` | `#64748b` | Captions |
| `--accent` | `#0284c7` | Slightly darker cyan for contrast (WCAG AA on light bg) |
| `--accent-soft` | `#0ea5e9` | Hover, secondary |

---

## 3. Typography

```
Body:     'Plus Jakarta Sans', system-ui, sans-serif      400 / 500 / 600 / 700
Heading:  'JetBrains Mono', monospace                     500 / 700 — UPPERCASE with letter-spacing 0.08em for h2/h3
Code:     'JetBrains Mono', monospace                     400 / 500 (inline + block)
```

Sizing scale (16px base):

- **h1** — 32-40px sans, weight 700
- **h2** — 22-26px mono, uppercase, letter-spacing 0.08em, accent color
- **h3** — 16-18px mono, uppercase, letter-spacing 0.06em
- **body** — 15-16px sans, line-height 1.7
- **inline code** — 13.5px mono, padding 2-3px 6px, `--surface-elev` bg, border-radius 4px
- **caption / meta** — 12-13px sans, `--mute` color

---

## 4. Component style

### Cards / panels
- `border-radius: 14px`
- Subtle border + 1px highlight inset, no heavy drop shadow
- Hover: `translateY(-1px)` + accent border tint

### Pills / badges
- `border-radius: 999px`, padding `4px 12px`
- Mono font 11px, uppercase
- Variants:
  - **default** — border + faint bg
  - **accent** — cyan fill
  - **beta** — warm violet
  - **new** — green

### Code blocks
- Bg: `--surface-elev` (slightly darker than card surface)
- Border: 1px `--border`
- Border-radius: 10px
- Padding: 16-20px
- Font: JetBrains Mono 13.5px, line-height 1.6
- Syntax highlighting palettes:
  - **Dark**: Tokyo Night or One Dark Pro
  - **Light**: GitHub Light or One Light
- Copy button top-right, ghost style (visible on hover only — pill outline)
- Optional file-label tab at top (e.g. `search.js · v3/js/`)

### Callouts (info / warning / success / error)
- Left border 3px in accent color
- Bg: 8-12% tint of accent color
- Icon on the left (single emoji or Font Awesome)
- Padding 14px 18px

### Sidebar TOC
- Width 240px
- Border-right `--border`
- Active item: cyan text + 2px left border accent
- Hover: `--surface-elev` bg
- Sticky scroll

### Inline links
- Cyan accent + dotted underline 1px (only solid on hover)
- Do NOT use box-shadow underline

### Tables
- Header bg: `--surface-elev`
- Border: 1px `--border`, `border-collapse: separate; border-spacing: 0;`
- Row hover: faint `--surface-elev`
- Mono font for cells containing numeric, hash, or identifier values

---

## 5. Motion & animation

- **Standard easing**: `cubic-bezier(0.22, 1, 0.36, 1)` — snappy yet smooth
- **Duration**: 140-180ms for hover; 240-320ms for state change (modal open, accordion)
- **Restraint**: animate only `color` / `background` / `transform` — never `height`/`width` (use `max-height` clamps for collapses)
- **Spin**: loading icons at 0.7-0.85s, ease-in-out

---

## 6. Light / dark mode toggle

- Toggle top-right header, icon swap `fa-moon` ↔ `fa-sun`
- Switch via CSS variables — no page reload
- Respect `prefers-color-scheme` by default; user choice overrides via `localStorage`

---

## 7. What NOT to copy (v3-specific, not suited for docs)

- ❌ Heavy glass effect (backdrop-blur, gradient overlay) — too much visual noise for docs
- ❌ Three.js particle background — distracting while reading code
- ❌ Cyan glow halo on CTAs — too showy for doc CTAs
- ❌ Step-indicator 3-card grid — docs do not need it
- ❌ Currency pill `·` divider pattern — docs have no currency
- ❌ Confetti / celebration animations — wrong tone for docs

---

## 8. Inspiration references

- [Stripe Docs](https://stripe.com/docs) — code block design, sidebar, inline-code style
- [Linear Docs](https://linear.app/docs) — minimal dark mode, mono accents
- [Vercel Docs](https://vercel.com/docs) — light/dark parity, callout design
- [Mintlify](https://mintlify.com) — typography hierarchy, pill badges
- [Tailwind Docs](https://tailwindcss.com/docs) — light-mode warmth, code-block UX

XRPDomains v3 screenshots will be provided separately (register card, mydomains grid, subdomain modal) so the team can feel the vibe — **pixel-matching is not required**.

---

## 9. Deliverables expected

- Design tokens file (CSS variables and/or Figma styles)
- Complete light + dark themes
- Component library covering:
  - Headings h1–h4
  - Paragraph / lead / blockquote
  - Code block (with copy button, optional file label)
  - Inline code
  - Tables
  - Callouts (4 variants: info, warning, success, error)
  - Pill / badge
  - Buttons (primary, secondary, ghost)
  - Sidebar nav
- One sample page: ~1500-word tutorial with 3-4 code blocks, 2 callouts, 1 table — to verify reading experience

---

## 10. Quick acceptance criteria

- Lighthouse a11y score ≥ 95 on both themes
- Body text contrast ratio ≥ 4.5:1 (WCAG AA) on both themes
- Code blocks horizontally scrollable on narrow viewports — no overflow
- Theme toggle persists across sessions
- Reading width capped at ~720px for prose; full width for code/tables only when needed
