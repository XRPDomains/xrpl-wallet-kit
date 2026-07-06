# Coder Notes — XRPL Wallet Kit

**Cập nhật:** 2026-06-04  
**Ưu tiên:** P1 → P2 → P3 → Perf → New Feature

---

## ✅ Reviewer Update — Modal Tokens & Performance Pass

### Modal/UI token fixes — implemented

- Added semantic `WalletUiTheme.error` and routed modal error text/status color through the theme instead of hardcoded `#b45309` / `#fbbf24`.
- Spinner colors now derive from theme tokens (`theme.muted` / `theme.border`) instead of hardcoded slate values.
- Copy/check success icons in modal and account panel now use `currentColor` plus `theme.accent`.
- Mobile close/back focus ring uses `theme.accent`; footer text increased to `11px`; QR placeholder/loading text uses `theme.muted`.
- Scope guard: these fixes are visual-token only. They must not change modal width, height, frame, body max-height, padding, QR card sizing, or restored modal proportions.

### Host CSS defense / modal motion — implemented with scope limits

- Kit controls reset host button/link styles more defensively: `appearance`, `box-sizing`, `font`, `line-height`, `text-decoration`, `transform`, tap highlight, and stable width/flex behavior.
- Account Panel copy action no longer renders an intermediate `Copying...` state, avoiding double visual jump.
- Subtle motion is limited to modal/account-panel open/close only. Do not animate internal copy/back/QR/list view switches because user testing showed those felt jumpy.

### Performance checklist — implemented / adjusted

- `PERF-2` Ledger: moved `xrpl` out of runtime dependency into peer/dev dependency.
- `PERF-4` WalletConnect SignClient/Modal: `@walletconnect/sign-client` and `@walletconnect/modal` are dynamically imported on demand.
- `PERF-5` UI styles: button/modal/toast styles now use a `document.head` style registry keyed by CSS hash instead of injecting inline `<style>` on every render.
- **WalletConnect icons adjustment:** the earlier PERF icon optimization was partially reverted by design. Built-in WalletConnect list/group profiles **must keep wallet-specific icons** for StaticBit, Bitget Wallet, Joey, Girin, and Bifrost. The generic WalletConnect icon is still lightweight, but profile icons are preserved because UX identity is more important than the small bundle saving here.
- Added a test guard: built-in WalletConnect detail wallets must ship data URL icons and must not fall back to the generic WalletConnect icon.

### Verification run

- `npm.cmd run typecheck` — pass
- `node --import tsx --test tests\core.test.ts` — pass
- Focused UI/core tests — pass
- `npm.cmd run build:browser` — pass
- `node --check packages\browser\dist\xrpl-wallet-kit.iife.min.js` — pass
- Known non-fatal warning remains: Rollup PURE annotation warning from `ox/_esm/core/Base64.js`.

---

## 📊 Trạng thái hiện tại — Round 4 Verification (2026-06-04)

| ID | Item | Trạng thái |
|---|---|---|
| P1-1 | Error color → `theme.error` | ✅ Done |
| P1-2 | Focus ring `renderMobileSheetOverrides()` → `theme.accent` | ✅ Done |
| P2-1 | Spinner colors → `theme.muted` / `theme.border` | ✅ Done |
| P2-2 | Copy icon `#1d9bf0` → `currentColor` + `theme.accent` | ✅ Done (elegant) |
| P3-1 | Footer `10px` → `11px` | ✅ Done |
| P3-2 | QR code `#64748b` → `theme.muted` | ✅ Done |
| PERF-2 | Ledger `xrpl` → peerDependency | ✅ Done |
| PERF-3 | WC icons dynamic import | ⏸ Design decision — giữ static vì UX identity |
| PERF-4 | WC sign-client + modal dynamic import | ✅ Done |
| PERF-5 | CSS inject `document.head` một lần | ✅ Done — `dom.ts` hash-based style registry |
| PERF-1 | README IIFE bundle size warning | ❌ Còn mở |
| Auth | `@xrpl-wallet-kit/auth` package | 🔲 New feature — chưa bắt đầu |

**Còn mở: 1 item nhỏ (PERF-1 README) + 1 new feature (auth)**

---

## 🔴 Cần fix trước release (P1)

### [P1-1] Error color hardcoded trong modal — `packages/ui/src/modal.ts`

**Vấn đề:** `#b45309` (light) và `#fbbf24` (dark) đang hardcode trực tiếp trong CSS template, không thuộc `WalletUiTheme`. Developer không thể override màu lỗi khi dùng custom theme.

**Fix:**

1. Thêm field `error?: string` vào `WalletUiTheme` trong `packages/ui/src/config.ts`
2. Thêm default vào `resolveTheme()`:
   - Light: `error: "#dc2626"`
   - Dark: `error: "#f87171"`
3. Trong `renderStyles()` và `renderMobileSheetOverrides()`, thay:
   ```ts
   // Thay thế:
   const errorColor = this.resolveThemeMode() === "dark" ? "#fbbf24" : "#b45309";
   // Thành:
   const errorColor = theme.error;
   ```
4. Trong CSS template, thay:
   ```
   color:#b45309  →  color:${theme.error}
   background:rgba(180,83,9,.08)  →  background: dùng theme.error với opacity
   border:1px solid rgba(180,83,9,.18)  →  border: dùng theme.error với opacity
   ```

---

### [P1-2] Focus ring close/back bị override sai trong `renderMobileSheetOverrides()`

**Vấn đề:** `renderStyles()` đã dùng `${theme.accent}` đúng cho focus ring. Nhưng `renderMobileSheetOverrides()` override lại bằng `${theme.border}!important` — trên light theme border rất nhạt, contrast focus ring có thể dưới 3:1, vi phạm WCAG 2.2.

**Vị trí:** `renderMobileSheetOverrides()` — dòng có:
```ts
`.xwk-close:focus-visible,.xwk-back:focus-visible{outline:2px solid ${theme.border}!important;outline-offset:0}`
```

**Fix:** Đổi `${theme.border}` → `${theme.accent}`:
```ts
`.xwk-close:focus-visible,.xwk-back:focus-visible{outline:2px solid ${theme.accent}!important;outline-offset:2px}`
```

---

## 🟡 Fix trong sprint tiếp (P2)

### [P2-1] Spinner colors hardcoded — `packages/ui/src/modal.ts`

**Vấn đề:** `spinnerPrimary` và `spinnerSecondary` hardcode `rgba(148,163,184,.58)` và `#cbd5e1`, không follow accent/theme của dApp.

**Fix:** Derive từ `theme.muted` với opacity thay vì hardcode:
```ts
// Thay:
const spinnerPrimary = this.resolveThemeMode() === "dark" ? "rgba(148,163,184,.58)" : "#cbd5e1";
const spinnerSecondary = this.resolveThemeMode() === "dark" ? "rgba(148,163,184,.26)" : "#e5e7eb";

// Thành (dùng theme.muted với opacity):
// Light: theme.muted + opacity 60% và 25%
// Dark: theme.muted + opacity 60% và 25%
// Có thể dùng hex + alpha hoặc CSS color-mix nếu target browser hỗ trợ
```

---

### [P2-2] Copy checkmark icon hardcode màu Twitter blue

**Vị trí:** `packages/ui/src/modal.ts` — hàm `renderCopiedIcon()` (hoặc tương đương):
```ts
`<circle cx="12" cy="12" r="10" fill="#1d9bf0"/>`
```

**Fix:** Đổi `fill="#1d9bf0"` → `fill="${theme.accent}"`:
```ts
`<circle cx="12" cy="12" r="10" fill="${theme.accent}"/>`
```

Lưu ý: cần pass `theme` vào hàm này hoặc dùng CSS `currentColor` thay fill attribute.

---

## 🔵 Nhỏ, làm khi có time (P3)

### [P3-1] Footer font-size 10px dưới minimum

**Vị trí:** `packages/ui/src/modal.ts` — CSS template:
```
.xwk-footer{...font-size:10px...}
```
**Fix:** Đổi `font-size:10px` → `font-size:11px`

---

### [P3-2] QR code container hardcode màu

**Vị trí:** CSS template:
```
.xwk-qr-code{...color:#64748b...}
```
**Fix:** Đổi `color:#64748b` → `color:${theme.muted}`

---

## ⚡ Performance (làm song song hoặc sau v0.1.0)

### [PERF-1] README thiếu cảnh báo bundle size — `README.md`

Thêm note rõ ràng về IIFE bundle:
```md
> ⚠️ **Bundle size:** The IIFE bundle is **528 KB gzip** because it includes
> all adapters. For production apps using a bundler (Vite, webpack), import
> from individual packages instead — a typical app with 2 adapters is ~33 KB gzip.
```

---

### [PERF-2] Ledger adapter: `xrpl` nên là peerDependency — `packages/adapters/ledger/package.json`

**Vấn đề:** `xrpl` hiện là `dependency` → app dùng ledger sẽ bundle `xrpl` 2 lần nếu app cũng import `xrpl` riêng.

**Fix:**
```json
// Chuyển xrpl từ dependencies sang peerDependencies:
"peerDependencies": {
  "xrpl": ">=4.0.0"
},
"peerDependenciesMeta": {
  "xrpl": { "optional": false }
}
```

---

### [PERF-3] WalletConnect icons — dynamic import — `packages/adapters/walletconnect/src/index.ts`

**Vấn đề:** `import { WALLETCONNECT_ICON } from "./icons"` là static — 22 KB gzip (6 icons base64) load ngay khi WC adapter import.

**Fix:** Chuyển sang dynamic import, chỉ load khi modal mở lần đầu:
```ts
// Xóa static import ở đầu file
// Trong hàm khởi tạo wallet list hoặc getWalletConfigs():
const { WALLETCONNECT_ICON, BITGET_ICON, ... } = await import("./icons.js");
```

---

### [PERF-4] WalletConnect sign-client — dynamic import — `packages/adapters/walletconnect/src/index.ts`

**Vấn đề:** `import SignClient from "@walletconnect/sign-client"` static — 16.5 KB gzip load ngay cả khi user không dùng WC.

**Fix:** Chuyển sang dynamic import trong `connect()` hoặc `preInitialize()`:
```ts
// Xóa static import
// Trong preInitialize() hoặc lần connect() đầu tiên:
const SignClient = (await import("@walletconnect/sign-client")).default;
```

---

### [PERF-5] CSS style injection — inject vào `document.head` một lần — `packages/ui/src/modal.ts`

**Vấn đề:** `<style>` tag được inject vào `root.innerHTML` mỗi lần render — browser phải parse lại CSSOM mỗi lần open/switch view.

**Fix:** Inject một lần vào `document.head` với ID cố định:
```ts
private ensureStyles(theme, layout, size, textSize) {
  const styleKey = `${layout}|${size}|${textSize}|${this.resolveThemeMode()}|...`;
  if (styleKey === this.cachedStyleKey) return;
  
  let el = document.getElementById("xwk-styles");
  if (!el) {
    el = document.createElement("style");
    el.id = "xwk-styles";
    document.head.appendChild(el);
  }
  el.textContent = this.renderStyles(theme, layout, size, textSize) + 
                   this.renderMobileSheetOverrides(theme);
  this.cachedStyleKey = styleKey;
}
```
Gọi `ensureStyles()` thay vì nhúng `<style>` trong `innerHTML`.

---

## 🔍 Audit Round 5 — 2026-06-18 (sau thay đổi lớn)

Full audit report: `Review/WALLET_KIT_AUDIT_2026-06-18.md`

### Packages mới được tạo (ngoài spec ban đầu)
- `packages/react/` — React bindings (WalletKitProvider, hooks, WalletButton) ✅ đúng architecture
- `packages/next/` — Next.js App Router wrapper ("use client" boundary) ⚠️ thiếu exports
- `packages/adapters/otsu/` — Otsu Wallet extension adapter ✅

### Core — mới
- `WalletManager.authenticate()` + `normalizeSignMessageResult()` — ✅ implemented
- `AuthenticateRequest` + `AuthenticateResult` types — ✅ nhưng overlap với SIGN_IN_SPEC (xem W5)

### Issues cần fix

| ID | Severity | Mô tả | File |
|---|---|---|---|
| C1 | 🔴 Critical | Không có tests cho authenticate(), OtsuAdapter, react package — test runner pass silently | `tests/` |
| C2 | 🔴 Critical | `WalletKitProvider` gọi `createWalletModal()` trong render body — vi phạm React rules | `packages/react/src/index.tsx` |
| W1 | 🟡 Warning | `WalletAdapterApiVersion` type thiếu `"1.1"` | `packages/core/src/types.ts` |
| W2 | 🟡 Warning | `packages/next` chỉ export 2 items — Next.js consumer cần tất cả hooks | `packages/next/src/index.ts` |
| W3 | 🟡 Warning | `window.xrpl` global type conflict: Otsu vs GemWallet merge issue | `packages/adapters/otsu/src/index.ts` |
| W4 | 🟡 Warning | `dev:react` script trong root package.json nhưng không có examples/react/ | `package.json` |
| W5 | 🟡 Warning | `AuthenticateResult` (core) overlap với `WalletAuthVerifyParams` (auth spec) — quyết định trước Phase 2 | SIGN_IN_SPEC |
| N2 | 🔵 Note | OtsuAdapter.restoreSession: fallback im lặng nếu getAddress() trả empty string | `packages/adapters/otsu/src/index.ts` |

### Trạng thái prerequisites cho packages/auth
Core plumbing ✅ sẵn sàng. Bắt đầu được nhưng phải resolve W5 tại Phase 2.

---

## 🆕 New Feature — `@xrpl-wallet-kit/auth`

**Spec đầy đủ:** `Review/SIGN_IN_SPEC.md` (status: ✅ Ready for Implementation)

Tóm tắt nhanh các điểm quan trọng nhất:

**1. Naming — BẮT BUỘC:**
- Không dùng tên chain trong generic types: `WalletAuthAdapter`, `createWalletAuth`, `SignatureVerifier`
- Chỉ concrete implementation mới được: `createXrplSignatureVerifier()`

**2. Package structure:**
```
packages/auth/src/
  index.ts         ← client-safe (không import ripple-keypairs)
  types.ts
  auth.ts          ← createWalletAuth()
  message.ts       ← formatAuthMessage(), parseAuthMessage(), validateAuthMessage()
  nonce.ts         ← generateNonce()
  verifiers/
    xrpl.ts        ← createXrplSignatureVerifier() — server-only
```

**3. `ripple-keypairs` config — quan trọng:**
```json
"peerDependencies": { "ripple-keypairs": "^2.0.0" },
"peerDependenciesMeta": { "ripple-keypairs": { "optional": true } },
"devDependencies": { "ripple-keypairs": "^2.0.0" }
```
Nếu server gọi verifier mà chưa cài peer → throw lỗi rõ.

**4. XRPL verifier — lưu ý kỹ:**
- `account_data.RegularKey` là **địa chỉ account khác**, KHÔNG phải signing public key
- Chỉ dùng `account_data.PublicKey` cho ledger lookup fallback
- Ưu tiên nhận `publicKey` từ wallet sign result qua `WalletAuthVerifyParams.publicKey`

**5. Cần test thực tế:**
Mỗi wallet hash message theo cách khác nhau. Phải test với ít nhất GemWallet và Crossmark trên testnet trước khi merge. Ghi kết quả vào `docs/adapters/signing-compat.md`.

---

## 📋 Backlog (không block beta)

| ID | Mô tả | File |
|---|---|---|
| L4 | `validateWalletAdapter()` nên warn khi `payments`/`nftOffers` declared nhưng methods thiếu | `packages/core/src/adapter.ts` |
| L5 | `autoOpen()` alias — document rõ hoặc deprecate | `packages/ui/src/button.ts` |
| C6 | Ledger transport keep-alive — document behavior trong adapter guide | `docs/adapters/ledger.md` |
| M9 | `themeName` preset (`"dark"`, `"light"`, `"auto"`) | Đợi presets được define |

---

*Generated: 2026-06-04 | Ref: VERIFICATION_CHECKLIST_R2.md, PERFORMANCE_CHECKLIST.md, SIGN_IN_SPEC.md*
