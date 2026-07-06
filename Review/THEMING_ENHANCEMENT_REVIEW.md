# Theming Enhancement Review

## Implementation Status - 2026-06-24

Commit: `5d21fba Enhance wallet UI theming`

### Completed

- [x] Added semantic theme tokens to `WalletUiTheme` / `ResolvedWalletUiTheme`:
  - `accentText`
  - `success`
  - `overlayBlur`
  - `spinnerTrail`
  - `headerBackground`
- [x] Added non-breaking theme selection API:
  - `themeName`
  - `customTheme`
  - existing `theme` remains supported as token overrides.
- [x] Added preset theme exports:
  - `lightTheme`
  - `darkTheme`
  - `xrplTheme`
  - `minimalTheme`
  - `midnightTheme`
  - `glassTheme`
  - `roundedTheme`
  - `crispTheme`
  - `softTheme`
- [x] Added `PRESET_THEMES`, `resolveWalletTheme()`, and `walletUiThemes` factories in `packages/ui/src/themes.ts`.
- [x] Wired preset resolution into:
  - `WalletModal`
  - `WalletButtonController`
  - `WalletToast`
  - UI config resolver
  - client toast config forwarding.
- [x] Replaced hardcoded visual state colors with semantic tokens where relevant:
  - accent button text uses `theme.accentText`
  - copied/success state uses `theme.success`
  - error state uses `theme.error`
  - spinner track uses `theme.spinnerTrail`
  - modal/account header uses `theme.headerBackground`
  - overlay uses `theme.overlayBlur` with Safari `-webkit-backdrop-filter`.
- [x] Kept modal/account panel frame stable. No intentional modal width/height/frame redesign was made.
- [x] Added/updated tests for:
  - semantic theme token usage
  - preset resolution before token overrides
  - copied icon using `success`
  - existing modal/button stability coverage remains green.
- [x] Updated docs:
  - `packages/ui/README.md`
  - `website/docs/configuration/theming.md`
  - `website/docs/api/wallet-modal.md`
  - `website/docs/api/wallet-toast.md`
  - `website/docs/configuration/connect-button.md`
  - `website/docs/api/create-wallet-kit.md`
- [x] Updated website Theme Builder:
  - exposes all preset themes
  - exposes new tokens
  - keeps snippets simple by showing `themeName` for presets and only showing `theme` overrides after custom edits.
- [x] Rebuilt browser bundle and copied it to website public assets:
  - `packages/browser/dist/xrpl-wallet-kit.iife.min.js`
  - `website/public/xrpl-wallet-kit.iife.min.js`

### Verified

- [x] `npm.cmd run typecheck`
- [x] `npm.cmd test --silent` / commit hook test run: 154/154 passed
- [x] `npm.cmd run build:browser`
- [x] `npm.cmd --prefix website run build`
- [x] Browser QA:
  - `http://127.0.0.1:5175/xrpl-wallet-kit/docs/configuration/theming.html`
  - `http://127.0.0.1:5175/xrpl-wallet-kit/docs/theme-builder.html`
  - Theme Builder loaded 9 presets.
  - `Midnight` preset applied `themeName: "midnight"` and `overlayBlur: 12`.
  - No console errors observed.

### Deferred / Not Implemented Yet

- [ ] `embedGoogleFonts`
  - Deferred intentionally. It adds network/GDPR/performance implications and should remain opt-in if implemented.
- [ ] `disclaimerText`
  - Deferred intentionally. This is a compliance/content feature, not required for the theming foundation.
- [ ] Dedicated `buttonRadius` token
  - Not added yet. Current implementation continues using existing radius/wallet radius behavior to avoid widening the public API before a concrete need appears.
- [ ] Safari/iOS manual QA for `glassTheme`
  - CSS includes `-webkit-backdrop-filter`, but device/browser manual QA is still recommended before marking this fully complete.

### Reviewer Notes

- The requested theming foundation is implemented as an additive, backward-compatible change.
- Existing integrations using `theme: { accent: "..." }` should continue to work.
- Recommended usage for simple integrations is now `themeName: "midnight"` / `"glass"` / `"rounded"` etc.
- Advanced integrations can layer `customTheme` or `theme` overrides on top of a preset.
- Modal sizing was not changed as part of this work.

---

**Date:** 2026-06-24  
**Scope:** `packages/ui/src/themes.ts`, `packages/ui/src/types.ts`, `packages/ui/src/modal.ts`, `packages/ui/src/button.ts`  
**Reference:** ConnectKit theming docs (family.co/docs/connectkit/theming, /colors)

---

## Tổng quan

Hệ thống theming hiện tại có 16 tokens và 2 preset thực sự hoạt động (`light`, `dark`). So với ConnectKit (30+ tokens, 8 preset themes với visual identity riêng biệt), kit còn thiếu nhiều điểm quan trọng ảnh hưởng trực tiếp đến developer experience và độ linh hoạt khi tích hợp vào app thực tế.

Tài liệu này chia cải tiến thành 3 nhóm theo thứ tự ưu tiên thực hiện.

---

## Nhóm 1 — Token mới (Ưu tiên cao, implement nhanh)

### 1.1 `accentText` — **Bắt buộc**

**Vấn đề:** Màu chữ trên nền accent (nút Connect trong `button.ts`) đang hardcode `#fff`. Khi developer set accent màu sáng (vàng `#f59e0b`, lime `#84cc16`, teal nhạt...), chữ trắng trên nền sáng không đọc được — vi phạm WCAG AA contrast ratio.

**Fix:**

```typescript
// packages/ui/src/types.ts
export interface WalletUiTheme {
  accent?: string;
  accentText?: string;   // NEW — text color on accent backgrounds
  // ... rest unchanged
}

// packages/ui/src/themes.ts
export const lightTheme: ResolvedTheme = {
  accent: "#0078ae",
  accentText: "#ffffff",   // NEW
  // ...
};

export const darkTheme: ResolvedTheme = {
  accent: "#4aa3ff",
  accentText: "#ffffff",   // NEW
  // ...
};
```

```typescript
// packages/ui/src/button.ts — tìm chỗ hardcode "#fff" / "white" trên nền accent
// Thay bằng: theme.accentText
```

---

### 1.2 `success` — **Bắt buộc**

**Vấn đề:** Trạng thái thành công (copy address checkmark, connected indicator) hiện không có token riêng — đang dùng `accent` thay thế. Khi dev customize accent thành màu đỏ hoặc cam, trạng thái "copy thành công" cũng hiển thị màu đỏ — gây nhầm lẫn với error state.

**Fix:**

```typescript
// packages/ui/src/types.ts
export interface WalletUiTheme {
  error?: string;
  success?: string;   // NEW — copy checkmark, connected badge
  // ...
}

// packages/ui/src/themes.ts
export const lightTheme: ResolvedTheme = {
  error: "#b45309",
  success: "#059669",   // NEW
  // ...
};

export const darkTheme: ResolvedTheme = {
  error: "#fbbf24",
  success: "#34d399",   // NEW
  // ...
};
```

```typescript
// packages/ui/src/modal.ts — tìm chỗ render copy checkmark / success state
// Thay accent bằng theme.success
```

---

### 1.3 `overlayBlur` — **Ưu tiên cao**

**Vấn đề:** Không có blur effect trên overlay backdrop. Đây là tính năng được nhiều app Web3 yêu cầu nhất cho glassmorphism aesthetic. ConnectKit expose `overlayBlur: number` (px) riêng.

**Fix — thêm vào WalletUiTheme:**

```typescript
// packages/ui/src/types.ts
export interface WalletUiTheme {
  overlayBlur?: number;   // NEW — px value, default 0 (no blur)
  // ...
}

// packages/ui/src/themes.ts
export const lightTheme: ResolvedTheme = {
  overlayBlur: 0,   // NEW — default: no blur
  // ...
};
```

```typescript
// packages/ui/src/modal.ts — trong renderStyles(), tìm .xwk-overlay CSS
// Thêm vào: backdrop-filter: ${theme.overlayBlur > 0 ? `blur(${theme.overlayBlur}px)` : 'none'};
// Cũng cần thêm -webkit-backdrop-filter: ... (Safari compatibility)
```

> **Lưu ý Safari:** `backdrop-filter` cần prefix `-webkit-backdrop-filter` để hoạt động trên Safari iOS/macOS.

---

### 1.4 `spinnerTrail` — Ưu tiên trung

**Vấn đề:** Màu track của spinner loading hardcode `rgba(0,0,0,.08)` (light) và `rgba(255,255,255,.08)` (dark) trực tiếp trong CSS string của `modal.ts`. Không customize được.

**Fix:**

```typescript
// packages/ui/src/types.ts
export interface WalletUiTheme {
  spinnerTrail?: string;   // NEW — spinner track background
  // ...
}

// packages/ui/src/themes.ts
lightTheme.spinnerTrail = "rgba(0,0,0,.08)";    // NEW
darkTheme.spinnerTrail  = "rgba(255,255,255,.08)"; // NEW
```

```typescript
// packages/ui/src/modal.ts — tìm spinnerSecondary
// Thay hardcode bằng: const spinnerSecondary = theme.spinnerTrail
```

---

### 1.5 `headerBackground` — Ưu tiên trung

**Vấn đề:** Header modal (title + close button row) luôn kế thừa `background`. Không thể tách header ra màu riêng — ví dụ header trong suốt + body solid, hoặc header gradient.

**Fix:**

```typescript
// packages/ui/src/types.ts
export interface WalletUiTheme {
  headerBackground?: string;   // NEW — falls back to background if not set
  // ...
}
```

```typescript
// packages/ui/src/modal.ts — trong .xwk-header CSS
// Thay background: inherit → background: ${theme.headerBackground ?? theme.background}
```

---

## Nhóm 2 — Preset Themes (Ưu tiên cao, effort trung bình)

### Vấn đề hiện tại

`WalletUiThemeName` trong `types.ts` khai báo `"default" | "minimal" | "rounded" | "compact"` nhưng `themes.ts` chỉ export `light`, `dark`, `xrpl` (trivial — chỉ đổi accent), `minimal` (trivial — chỉ đổi radius nhỏ). Type và implementation không khớp, không có theme nào có visual identity rõ ràng.

### Themes đề xuất thêm

**Quy tắc thiết kế:** Mỗi preset phải có ít nhất 3 điểm khác biệt rõ ràng về visual (màu sắc, hình dạng, shadow/blur, font). Không phải chỉ đổi accent.

---

#### Theme: `midnight`

Dark-first theme dành cho crypto/DeFi apps. Deep navy background, accent xanh lạnh, overlay có blur.

```typescript
export const midnightTheme: ResolvedTheme = {
  accent:           "#3b82f6",
  accentText:       "#ffffff",
  background:       "#0f1629",
  foreground:       "#e2e8f0",
  error:            "#f87171",
  success:          "#34d399",
  muted:            "#64748b",
  border:           "#1e2d4a",
  overlay:          "rgba(2,6,23,.80)",
  overlayBlur:      12,
  surface:          "#1a2540",
  surfaceHover:     "#1e2d4a",
  fallbackIconBackground: "rgba(255,255,255,.10)",
  fallbackIconColor: "#e2e8f0",
  shadow:           "0 8px 40px rgba(0,0,0,.40)",
  radius:           "16px",
  walletRadius:     "12px",
  spinnerTrail:     "rgba(255,255,255,.08)",
  fontFamily:       "'Space Grotesk', Inter, system-ui, sans-serif",
  headerBackground: "#0f1629",
};
```

---

#### Theme: `glass`

Semi-transparent modal, heavy backdrop blur. Phù hợp khi app có background ảnh hoặc gradient.

```typescript
export const glassTheme: ResolvedTheme = {
  accent:           "#6366f1",
  accentText:       "#ffffff",
  background:       "rgba(255,255,255,0.65)",
  foreground:       "#1e293b",
  error:            "#ef4444",
  success:          "#10b981",
  muted:            "#64748b",
  border:           "rgba(255,255,255,0.50)",
  overlay:          "rgba(15,23,42,.30)",
  overlayBlur:      20,
  surface:          "rgba(255,255,255,0.45)",
  surfaceHover:     "rgba(255,255,255,0.60)",
  fallbackIconBackground: "rgba(99,102,241,.15)",
  fallbackIconColor: "#6366f1",
  shadow:           "0 8px 40px rgba(99,102,241,.15), 0 0 0 1px rgba(255,255,255,.30)",
  radius:           "20px",
  walletRadius:     "14px",
  spinnerTrail:     "rgba(99,102,241,.15)",
  fontFamily:       "'Outfit', Inter, system-ui, sans-serif",
  headerBackground: "rgba(255,255,255,0.40)",
};
```

> **Lưu ý:** `glassTheme` phụ thuộc vào `overlayBlur`. Cần implement xong 1.3 trước khi dùng theme này.

---

#### Theme: `rounded`

Mọi thứ đều có border-radius lớn, button dạng pill. Thân thiện, phù hợp consumer apps.

```typescript
export const roundedTheme: ResolvedTheme = {
  ...lightTheme,
  accent:       "#7c3aed",
  accentText:   "#ffffff",
  success:      "#059669",
  border:       "#f3e8ff",
  surface:      "#faf5ff",
  surfaceHover: "#f5f0ff",
  shadow:       "0 12px 48px rgba(124,58,237,.14), 0 0 0 1px rgba(124,58,237,.08)",
  radius:       "24px",
  walletRadius: "16px",
  fontFamily:   "'DM Sans', Inter, system-ui, sans-serif",
};
```

> Button trong `button.ts` cũng cần dùng `walletRadius` (hoặc `radius`) cho border-radius. Hiện button có thể đang dùng giá trị riêng — cần verify.

---

#### Theme: `crisp`

Sharp corners, heavy borders, no shadow. Fintech / developer tool aesthetic.

```typescript
export const crispTheme: ResolvedTheme = {
  ...lightTheme,
  accent:       "#111827",
  accentText:   "#ffffff",
  success:      "#16a34a",
  border:       "#111827",
  surface:      "#f9fafb",
  surfaceHover: "#f3f4f6",
  shadow:       "none",
  radius:       "4px",
  walletRadius: "4px",
  fontFamily:   "'DM Mono', 'Courier New', monospace",
};
```

---

#### Theme: `soft`

Pastel surfaces, gentle palette. Phù hợp lifestyle apps, NFT marketplaces pastel style.

```typescript
export const softTheme: ResolvedTheme = {
  ...lightTheme,
  accent:           "#7c3aed",
  accentText:       "#ffffff",
  success:          "#059669",
  background:       "#faf5ff",
  border:           "#e9d5ff",
  surface:          "#f3e8ff",
  surfaceHover:     "#ede9fe",
  shadow:           "0 4px 24px rgba(124,58,237,.08)",
  radius:           "16px",
  walletRadius:     "12px",
  fontFamily:       "'Plus Jakarta Sans', Inter, system-ui, sans-serif",
};
```

---

### Wiring preset themes

Sau khi thêm các theme objects, cần wire `themeName` prop vào `modal.ts` và `button.ts`:

```typescript
// packages/ui/src/themes.ts — thêm map
export const PRESET_THEMES: Record<string, ResolvedTheme> = {
  default:  lightTheme,
  dark:     darkTheme,
  midnight: midnightTheme,
  glass:    glassTheme,
  rounded:  roundedTheme,
  crisp:    crispTheme,
  soft:     softTheme,
};

// packages/ui/src/types.ts — cập nhật type
export type WalletUiThemeName =
  | "default" | "dark"
  | "midnight" | "glass" | "rounded" | "crisp" | "soft"
  | (string & {});
```

```typescript
// packages/ui/src/modal.ts — resolveTheme()
private resolveTheme(): Required<WalletUiTheme> {
  const mode = this.resolveThemeMode();
  // Nếu có themeName → dùng preset
  if (this.options.themeName && PRESET_THEMES[this.options.themeName]) {
    const preset = PRESET_THEMES[this.options.themeName];
    return { ...preset, ...this.options.theme };  // user overrides on top
  }
  // Fallback: light/dark theo mode
  const base = mode === "dark" ? darkTheme : lightTheme;
  return { ...base, ...this.options.theme };
}
```

---

## Nhóm 3 — Features bổ sung (Ưu tiên thấp)

### 3.1 `embedGoogleFonts: boolean`

ConnectKit auto-inject `<link>` Google Fonts khi bật. Cho phép preset themes load font riêng (Space Grotesk, Outfit, DM Sans...) mà không cần dev tự thêm vào HTML.

```typescript
// packages/ui/src/types.ts — trong WalletUiOptions
embedGoogleFonts?: boolean;   // default false — opt-in để tránh GDPR issues
```

```typescript
// packages/ui/src/modal.ts — trong constructor hoặc ensureStyles()
if (this.options.embedGoogleFonts) {
  const fonts: Record<string, string> = {
    midnight: "Space+Grotesk:wght@400;500;600",
    glass:    "Outfit:wght@400;500;600",
    rounded:  "DM+Sans:wght@400;500;600",
    soft:     "Plus+Jakarta+Sans:wght@400;500;600",
    crisp:    "DM+Mono:wght@400;500",
  };
  const preset = this.options.themeName;
  const fontQuery = preset && fonts[preset];
  if (fontQuery && !document.querySelector(`[data-xwk-font="${preset}"]`)) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = `https://fonts.googleapis.com/css2?family=${fontQuery}&display=swap`;
    link.dataset.xwkFont = preset;
    document.head.appendChild(link);
  }
}
```

---

### 3.2 `disclaimerText: string`

ConnectKit cho phép hiển thị "By connecting your wallet you agree to Terms..." trong modal trước khi user kết nối. Hữu ích cho compliance.

```typescript
// packages/ui/src/types.ts — trong WalletUiOptions
disclaimerText?: string;   // shown in modal footer before connection
```

Render trong phần `.xwk-footer` của modal list view — chỉ hiển thị khi chưa có session.

---

### 3.3 API tách `theme` và `customTheme`

ConnectKit dùng `theme="midnight"` cho preset và `customTheme={{...}}` riêng cho overrides. Cách này rõ hơn — người dùng biết mình đang override preset chứ không phải tạo theme từ đầu.

Hiện tại kit dùng `theme?: WalletUiTheme` cho cả hai việc. Không cần breaking change — chỉ thêm alias:

```typescript
// packages/ui/src/types.ts
export interface WalletUiOptions {
  themeName?: WalletUiThemeName;
  theme?: WalletUiTheme;          // existing — base token overrides
  customTheme?: WalletUiTheme;    // NEW alias — same behavior, clearer intent
}
```

---

## Checklist thực hiện

```
Nhóm 1 — Tokens mới
[ ] Thêm accentText vào WalletUiTheme + lightTheme + darkTheme
[ ] Thay hardcode #fff (accent button text) bằng theme.accentText trong button.ts
[ ] Thêm success vào WalletUiTheme + lightTheme + darkTheme
[ ] Thay accent bằng theme.success ở copy checkmark / success states trong modal.ts
[ ] Thêm overlayBlur vào WalletUiTheme + lightTheme (default: 0)
[ ] Thêm backdrop-filter + -webkit-backdrop-filter vào .xwk-overlay CSS
[ ] Thêm spinnerTrail vào WalletUiTheme + themes
[ ] Thay hardcode spinnerSecondary bằng theme.spinnerTrail
[ ] Thêm headerBackground vào WalletUiTheme + themes
[ ] Áp dụng headerBackground vào .xwk-header CSS

Nhóm 2 — Preset themes
[ ] Thêm 5 objects: midnightTheme, glassTheme, roundedTheme, crispTheme, softTheme
[ ] Export PRESET_THEMES map từ themes.ts
[ ] Cập nhật WalletUiThemeName type
[ ] Cập nhật resolveTheme() trong modal.ts để look up PRESET_THEMES
[ ] Cập nhật resolveTheme() trong button.ts tương tự
[ ] Verify button border-radius dùng walletRadius (hoặc thêm buttonRadius token nếu cần)
[ ] Test từng preset ở cả light và dark mode

Nhóm 3 — Features bổ sung (có thể làm sau)
[ ] embedGoogleFonts option
[ ] disclaimerText option
[ ] customTheme alias (non-breaking)
```

---

## Lưu ý quan trọng

**Backward compatibility:** Tất cả tokens mới phải optional (`?`) với fallback rõ ràng. Không được break existing `theme: { accent: "..." }` usage.

**glassTheme và Safari:** `backdrop-filter` không hoạt động nếu phần tử cha có `overflow: hidden` mà không có `-webkit-backdrop-filter`. Cần test kỹ trên Safari iOS.

**midnightTheme font:** Space Grotesk không phải system font — nếu không bật `embedGoogleFonts` thì fallback về Inter. Ghi rõ trong docs.

**overlayBlur performance:** `backdrop-filter` nặng trên mobile CPU yếu (mid-range Android). Nên document rằng giá trị > 20px có thể gây lag trên low-end devices. Default 0 là safe.
