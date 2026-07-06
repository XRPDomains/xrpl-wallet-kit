# Feature Implementation Checklist
**Date:** 2026-05-27  
**Reviewed by:** Design/Code review  
**Scope:** Verify code thực tế so với FEATURE_UI_SPEC.md + Implementation Notes của coder

---

## Tổng quan nhanh

| Feature | Trạng thái | Ghi chú |
|---------|-----------|---------|
| WalletToast | ✅ Hoàn chỉnh | 2 deviation nhỏ về animation/shadow |
| Enhanced Network Badge | ✅ Hoàn chỉnh | 1 deviation nhỏ về empty row MAINNET |
| Modal aria-labelledby | ✅ Hoàn chỉnh | Fix WCAG C1 — tất cả 3 shells |
| getExplorerTxUrl | ✅ Hoàn chỉnh | Core + toast dùng đúng |
| transactionPreview type | ✅ Partial | Type xong, UI chưa làm — đúng với deferred |
| Transaction Preview UI | ⏸ Deferred | Theo yêu cầu owner |
| Activation Guard | ⏸ Deferred | Theo yêu cầu owner |
| Trust Line Warning | ⏸ Deferred | Theo yêu cầu owner |
| Recent Transactions | ⏸ Deferred | Theo yêu cầu owner |

---

## Feature 1 — WalletToast ✅

### Checklist từ FEATURE_UI_SPEC.md

| # | Item | File | Kết quả |
|---|------|------|---------|
| 1 | Tạo `packages/ui/src/toast.ts` | `packages/ui/src/toast.ts` | ✅ 217 dòng, đầy đủ |
| 2 | Export từ `packages/ui/src/index.ts` | dòng 7 + 13 | ✅ `export * from "./toast"` + alias `XrplWalletToast` |
| 3 | `createWalletToast()` factory function | `toast.ts` dòng 212–216 | ✅ Có, auto-mount nếu `options.mount` |
| 4 | `WalletToastOptions` interface | `types.ts` dòng 66–69 | ✅ Extends `WalletToastConfig` + `manager` + `mount` |
| 5 | `WalletToastConfig` interface | `types.ts` dòng 55–64 | ✅ Đủ fields: autoDismissMs, maxVisible, position, explorerUrl… |
| 6 | `toast?: boolean \| WalletToastConfig` vào `WalletUiConfig` | `types.ts` dòng 220 | ✅ |
| 7 | Wired vào `createWalletKit()` | `client/src/index.ts` dòng 93–95 | ✅ `resolveToastOptions()` + `toast.mount()` |
| 8 | Lắng nghe `tx_submitted` | `toast.ts` dòng 21–24 | ✅ |
| 9 | Lắng nghe `tx_confirmed` | `toast.ts` dòng 25–30 | ✅ |
| 10 | Lắng nghe `tx_failed` | `toast.ts` dòng 31–43 | ✅ |
| 11 | Lắng nghe `disconnected` → clearAll | `toast.ts` dòng 43 | ✅ |
| 12 | Auto-dismiss configurable | `toast.ts` dòng 88–93 | ✅ `scheduleDismiss()` |
| 13 | `maxVisible` enforced | `toast.ts` dòng 81–85 | ✅ `enforceLimit()` |
| 14 | Explorer link dùng `getExplorerTxUrl()` | `toast.ts` dòng 148–152 | ✅ Fallback custom URL → core |
| 15 | `role="status"` trên mỗi toast | `toast.ts` dòng 134 | ✅ |
| 16 | `aria-live="polite"` trên root | `toast.ts` dòng 51 | ✅ |
| 17 | Mobile responsive (`max-width:480px`) | `renderStyles()` | ✅ + `env(safe-area-inset-bottom)` |
| 18 | `prefers-reduced-motion` | `renderStyles()` | ✅ animation: none |
| 19 | `destroy()` cleanup | `toast.ts` dòng 57–63 | ✅ clearTimers + removeListeners + remove root |

### Deviations so với spec

| # | Spec | Thực tế | Mức độ |
|---|------|---------|--------|
| D1 | Animation enter: `cubic-bezier(0.34, 1.56, 0.64, 1)` spring | `0.18s ease-out` + `translateY(10px→0)` | ⚠️ Minor — bỏ spring bounce, nhẹ nhàng hơn |
| D2 | `box-shadow: ${theme.shadow}` | `box-shadow: none` hardcoded | ⚠️ Minor — xem note về shadow ở cuối |
| D3 | State label: `"pending"` | State tên: `"submitted"` (theo `WalletTransactionStatus` từ core) | ℹ️ OK — nhất quán với core types |
| D4 | Spec có accent bar màu bên trái | Không có accent bar | ⚠️ Minor cosmetic — có thể thêm sau |

---

## Feature 2 — Enhanced Network Badge ✅

### Checklist từ FEATURE_UI_SPEC.md

| # | Item | File | Kết quả |
|---|------|------|---------|
| 1 | `resolveNetworkBadgeStyle()` private method | `modal.ts` dòng 592–637 | ✅ |
| 2 | `renderNetworkBadge()` cập nhật | `modal.ts` dòng 583–590 | ✅ |
| 3 | `NetworkBadgeStyle` interface (local) | `modal.ts` dòng 14–20 | ✅ Không export |
| 4 | MAINNET → ẩn badge hoàn toàn | `modal.ts` dòng 584–585 | ✅ Returns `""` |
| 5 | TESTNET → amber `#f59e0b`/`#fbbf24` | `resolveNetworkBadgeStyle()` | ✅ Light/dark aware |
| 6 | DEVNET → sky `#38bdf8`/`#7dd3fc` | `resolveNetworkBadgeStyle()` | ✅ |
| 7 | EVM → violet `#a78bfa`/`#c4b5fd` | `resolveNetworkBadgeStyle()` | ✅ |
| 8 | CUSTOM → theme.muted | `resolveNetworkBadgeStyle()` | ✅ Dùng theme tokens |
| 9 | Dot `<span class="xwk-network-dot">` | `modal.ts` dòng 589 | ✅ + CSS class defined |
| 10 | EVM detection | dòng 600–602 | ✅ Mạnh hơn spec: check `family`, `id`, `name` |

### Deviations so với spec

| # | Spec | Thực tế | Mức độ |
|---|------|---------|--------|
| D1 | MAINNET trả về `<div class="xwk-network-row"></div>` (empty row giữ chỗ 22px) | Trả về `""` — không render row element | ⚠️ Minor — có thể gây layout shift khi switch network |
| D2 | `textColor` EVM dark: `#a78bfa` | `#c4b5fd` (sáng hơn — contrast tốt hơn) | ✅ Better |

---

## Accessibility Fix — aria-labelledby ✅

| Shell | Trước | Sau | Line |
|-------|-------|-----|------|
| List shell | `aria-label="..."` | `aria-labelledby="xwk-title"` + `id="xwk-title"` | 581 |
| QR shell | `aria-label="..."` | `aria-labelledby="xwk-title"` + `id="xwk-title"` | 681 |
| Connect shell | `aria-label="..."` | `aria-labelledby="xwk-title"` + `id="xwk-title"` | 705 |

✅ **Fix đúng** — `role="dialog"` + `aria-modal="true"` + `aria-labelledby` = WCAG 2.1 AA compliant

---

## getExplorerTxUrl (core) ✅

| Item | File | Kết quả |
|------|------|---------|
| Function `getExplorerTxUrl(network, hash)` | `core/src/networks.ts` dòng 104–110 | ✅ |
| Hỗ trợ `{hash}` template | dòng 107–108 | ✅ |
| `encodeURIComponent(hash)` | dòng 106 | ✅ |
| Fallback URL không có template | dòng 109 | ✅ append `/hash` |
| Guard `!network?.explorerTxUrl` | dòng 105 | ✅ Returns undefined safely |
| Dùng trong `toast.ts` | `toast.ts` dòng 1 + 151 | ✅ Import + call đúng |

---

## transactionPreview type — Partial ✅ (đúng với deferred)

| Item | File | Kết quả |
|------|------|---------|
| `WalletTransactionPreview` interface | `types.ts` dòng 185–189 | ✅ |
| `WalletTransactionPreviewResolver` type | `types.ts` dòng 191 | ✅ |
| `transactionPreview?` trong `WalletUiOptions` | `types.ts` dòng 51 | ✅ |
| `transactionPreview?` trong `WalletUiConfig` | `types.ts` dòng 219 | ✅ |
| Pass qua `config.ts` → `modal.options` | `config.ts` dòng 17 + 33 | ✅ |
| Modal **dùng** transactionPreview | `modal.ts` | ❌ Stored nhưng không gọi — đúng vì deferred |
| `WalletModalView = "list"\|"connect"\|"qr"\|"preview"` | `modal.ts` dòng 12 | ❌ Chưa có `"preview"` — đúng vì deferred |

---

## Deferred Features — Xác nhận KHÔNG implement ✅

| Feature | Kiểm tra | Kết quả |
|---------|---------|---------|
| Transaction Preview UI | grep `"preview"` trong `modal.ts` | ❌ Không có — đúng |
| `showPreview()` method | grep trong `modal.ts` | ❌ Không có — đúng |
| Activation Guard `"guard"` view | grep `"guard"` trong `modal.ts` | ❌ Không có — đúng |
| `handleConnected` check activationStatus | `modal.ts` dòng 526–531 | ❌ Chỉ `close()` — đúng |
| Trust Line `setTrustLineWarning()` | grep trong `modal.ts` | ❌ Không có — đúng |
| Recent Transactions `renderTransactions()` | grep trong `button.ts` | ❌ Không có — đúng |
| `tx_*` event listeners trong `button.ts` | grep trong `button.ts` | ❌ Không có — đúng |

---

## Bugs phát hiện thêm

### BUG-1 · Shadow bị override trong config.ts ⚠️

**Mô tả:** `themes.ts` đã fix `lightTheme.shadow = "0 8px 40px rgba(15,23,42,.12)..."` nhưng `config.ts` luôn set `shadow: "none"` trong default theme object ở 3 chỗ (dòng 42, 61, 112). Vì `resolveTheme()` trong modal.ts spread `this.options.theme` lên trên `lightTheme`, nên shadow từ `themes.ts` bị **ghi đè thành "none"** với mọi user không tự set shadow.

**File bị ảnh hưởng:** `packages/ui/src/config.ts` + `packages/ui/src/toast.ts`

**Fix:** Xóa `shadow: "none"` khỏi default object trong `config.ts` — để theme token tự nhiên được kế thừa từ `lightTheme`/`darkTheme`. Tương tự với `toast.ts` dòng 145 (`box-shadow:none`).

```ts
// config.ts — XÓA dòng shadow: "none" khỏi default theme objects
theme: {
  accent: "#0078ae",
  radius: "14px",
  walletRadius: "10px",
  fontFamily: defaultFontFamily,
  // shadow: "none",   ← XÓA dòng này
  ...(overrides.theme ?? {}),
  ...(customTheme ?? {})
}
```

### BUG-2 · MAINNET không render `.xwk-network-row` ⚠️ 

**Mô tả:** Khi network là MAINNET, `renderNetworkBadge()` trả về `""`. CSS `.xwk-network-row { min-height: 22px }` không được áp dụng → không có 22px placeholder → layout shift khi user switch sang TESTNET (badge xuất hiện đẩy content xuống).

**Fix nhỏ:**
```ts
private renderNetworkBadge() {
  const network = this.options.manager.getNetwork();
  if (!network || network.networkType === "MAINNET")
    return '<div class="xwk-network-row"></div>';  // ← giữ chỗ
  // ...
}
```

---

## Tóm tắt hành động cho coder

### Cần sửa trước beta release

| # | File | Fix |
|---|------|-----|
| F1 | `packages/ui/src/config.ts` dòng 42, 61, 112 | Xóa `shadow: "none"` khỏi 3 default theme objects |
| F2 | `packages/ui/src/modal.ts` dòng 583–585 | `renderNetworkBadge()` MAINNET trả về row div thay vì `""` |

### Có thể cải thiện sau

| # | File | Cải thiện |
|---|------|-----------|
| I1 | `toast.ts` renderStyles | Thay `box-shadow:none` thành `box-shadow:${theme.shadow}` |
| I2 | `toast.ts` animation | Thêm spring: `cubic-bezier(0.34,1.56,0.64,1)` thay `ease-out` |
| I3 | `toast.ts` | Thêm left accent bar theo màu status (cosmetic) |

### Khi sẵn sàng implement deferred

Dùng `FEATURE_UI_SPEC.md` — các checklist section đã có đủ từng bước:
- **Transaction Preview:** thêm `"preview"` vào `WalletModalView`, `showPreview()`, `renderPreviewShell()`
- **Activation Guard:** thêm `"guard"` vào `WalletModalView`, check trong `handleConnected()`
- **Trust Line Warning:** thêm `setTrustLineWarning()`, `renderTrustLineBanner()` vào `modal.ts`
- **Recent Transactions:** thêm `renderTransactions()`, `formatTimeAgo()`, tx listeners vào `button.ts`

---

*Verified từ source code thực tế — không phải từ declaration trong FEATURE_UI_SPEC.md*

---

---

# REVIEW_UI.md — Verification Checklist

**Scope:** Kiểm tra toàn bộ findings trong `REVIEW_UI.md` so với source code hiện tại  
**Ngày verify:** 2026-05-27

---

## Tổng quan REVIEW_UI

| ID | Mô tả | Mức | Trạng thái |
|----|-------|-----|------------|
| UI1 | Backdrop click không đóng modal | 🔴 High | ✅ FIXED |
| UI2 | CSS 7KB re-inject mỗi lần re-render | 🟡 Medium | ❌ OPEN |
| UI3 | Connect status text thiếu context | 🟡 Medium | ✅ FIXED |
| UI4 | Focus trap account panel | 🔴 High | ✅ FIXED |
| UI7 | Screen reader không đọc được địa chỉ copy | 🟡 Medium | ✅ FIXED |
| UI8 | Error text màu đỏ không tương phản | 🟡 Medium | ✅ FIXED |
| M1 | Mobile: scroll lock bị mất | 🔴 High | ✅ FIXED |
| A1 | Badge text contrast thấp | 🔴 High | ✅ FIXED |
| A2 | QR: thiếu sr-only hint | 🟡 Medium | ✅ FIXED |
| A3 | "+N more" thiếu aria-label | 🟡 Medium | ✅ FIXED |
| A4 | Spinner thiếu aria-hidden | 🟡 Medium | ✅ FIXED |
| A5 | Dialog thiếu aria-labelledby | 🔴 High | ✅ FIXED |
| A6 | Footer font-weight 300 quá nhạt | 🟢 Low | ✅ FIXED |
| D1 | walletRadius hardcoded 16px | 🟡 Medium | ✅ FIXED |
| D2 | groupFontSize 11px quá nhỏ | 🟢 Low | ✅ FIXED |
| D3 | connect-icon border-radius hardcoded | 🟢 Low | ⚠️ OPEN |

**Kết quả: 14/16 findings đã fix — 1 medium còn mở (UI2), 1 low còn mở (D3)**

---

## UI Findings (modal.ts)

### UI1 — Backdrop click đóng modal ✅ FIXED

**Finding gốc:** Click vào backdrop (overlay ngoài modal) không đóng modal.

**Evidence từ source:**
```ts
// modal.ts dòng 262
if (event.target === this.root) this.close();
```
`mousedown` listener check `event.target === this.root` (overlay element) → gọi `close()` đúng.

✅ **Đã fix** — logic đúng, không leak event.

---

### UI2 — CSS 7KB re-inject mỗi re-render ❌ STILL OPEN

**Finding gốc:** Mỗi lần `render()` / `renderQrShell()` / `renderConnectShell()` gọi, toàn bộ CSS ~7KB được inject lại vào `root.innerHTML`. Trong một session với 10 lần switch view, DOM parse 7KB CSS 10 lần. Với nhiều dialogs/toasts cùng lúc gây memory bloat.

**Evidence từ source:**
```ts
// modal.ts — 3 shell renderers vẫn dùng pattern:
// renderListShell():   `<style>${this.renderStyles()}</style><div role="dialog"...`
// renderQrShell():     `<style>${this.renderStyles()}</style><div role="dialog"...`
// renderConnectShell(): `<style>${this.renderStyles()}</style><div role="dialog"...`
```
Cả 3 shell renderers (dòng 259, 681, 705) inject `<style>` inline trong `root.innerHTML`.

❌ **Chưa fix** — CSS vẫn re-inject mỗi lần thay đổi view.

**Fix đề xuất:**
```ts
// Inject CSS một lần vào <head> hoặc lưu style element riêng:
private mountStyles(): void {
  if (document.getElementById("xwk-modal-styles")) return;
  const style = document.createElement("style");
  style.id = "xwk-modal-styles";
  style.textContent = this.renderStyles();
  document.head.appendChild(style);
}
// Gọi mountStyles() trong open(), không inline vào innerHTML
```

---

### UI3 — Connect status text có context ✅ FIXED

**Finding gốc:** Khi đang connecting, text chỉ hiện "Connecting..." không rõ đang dùng wallet nào.

**Evidence từ source:**
```ts
// modal.ts dòng 708–720 — getConnectStatusText() 5 cases:
// hardware:      "Open your hardware wallet..."
// walletconnect: "Scan with ${walletName}..."
// mobile-qr:     "Open ${walletName} on your phone..."
// snap:          "Approve in MetaMask Snaps..."
// default:       "Opening ${walletName}..."
```
5 cases đầy đủ, mỗi case có tên wallet cụ thể.

✅ **Đã fix** — text giờ context-aware với loại wallet.

---

### UI4 — Focus trap account panel ✅ FIXED

**Finding gốc:** Khi account panel mở theo mode `"modal"`, Tab key escape ra ngoài thay vì cycle trong panel.

**Evidence từ source:**
```ts
// button.ts dòng 196 — handleDocumentKeyDown():
const focusable = this.getAccountPanelFocusableElements();
// Tab forward → focus element kế tiếp, nếu cuối → quay về đầu
// Tab+Shift → cycle ngược
// Escape → đóng panel

// button.ts dòng 469 — getAccountPanelFocusableElements():
return Array.from(
  this.accountPanel?.querySelectorAll<HTMLElement>(
    '.xwk-account-panel-modal [tabindex]:not([tabindex="-1"]), ...'
  ) ?? []
);
```
✅ **Đã fix** — focus trap đầy đủ với cycle cả forward lẫn reverse, auto-focus on open.

---

### UI7 — Screen reader copy feedback ✅ FIXED

**Finding gốc:** Khi copy địa chỉ, không có thông báo cho screen reader.

**Evidence từ source:**
```ts
// modal.ts dòng 681 (renderQrShell):
// <span class="xwk-sr-only" aria-live="assertive" data-xwk-copy-live></span>
```
`data-xwk-copy-live` là live region `assertive` — sau khi copy, text được set vào span → screen reader đọc ngay.

✅ **Đã fix** — aria-live assertive đúng pattern.

---

### UI8 — Error text màu amber thay đỏ ✅ FIXED

**Finding gốc:** Error text màu đỏ `#ef4444` không đủ contrast trên nền trắng/xanh của connect shell.

**Evidence từ source:**
```ts
// modal.ts dòng 748:
const errorColor = dark ? "#fbbf24" : "#b45309";
```
- Dark mode: `#fbbf24` (amber-400) → contrast tốt trên dark background
- Light mode: `#b45309` (amber-700) → contrast ~5.4:1 trên white background (WCAG AA pass)

✅ **Đã fix** — amber thay đỏ, đủ contrast cả hai mode.

---

## Mobile Finding

### M1 — lockPageScroll ✅ FIXED

**Finding gốc:** Khi modal mở trên mobile, background vẫn scroll được, gây UX kém.

**Evidence từ source:**
```ts
// packages/ui/src/dom.ts
export function lockPageScroll(): void {
  savedScrollY = window.scrollY;
  document.body.style.overflow = "hidden";
  document.body.style.position = "fixed";
  document.body.style.top = `-${savedScrollY}px`;
  document.body.style.width = "100%";
  if (scrollbarWidth > 0)
    document.body.style.paddingRight = `${scrollbarWidth}px`;
}
export function unlockPageScroll(): void {
  document.body.style.overflow = "";
  document.body.style.position = "";
  document.body.style.top = "";
  document.body.style.width = "";
  document.body.style.paddingRight = "";
  window.scrollTo(0, savedScrollY);
}
```
Full implementation: save scroll position, `overflow:hidden` + `position:fixed` trick, scrollbar compensation, restore on unlock.

✅ **Đã fix** — iOS Safari compatible pattern.

---

## Accessibility Findings (a11y)

### A1 — Badge text contrast ✅ FIXED

**Finding gốc:** Network badge text `#6b7280` (gray-500) trên nền light mode có contrast ~4.5:1 — cận AA, không đủ cho small text.

**Evidence từ source:**
```ts
// modal.ts dòng 737:
const badgeColor = dark ? "#cbd5e1" : "#5c6878";
```
`#5c6878` trên white background → contrast ~5.01:1 → WCAG AA ✅ (cần ≥4.5:1 cho normal text).

✅ **Đã fix** — contrast vượt ngưỡng AA.

---

### A2 — QR sr-only hint ✅ FIXED

**Finding gốc:** QR code view thiếu text hướng dẫn cho screen reader (chỉ có image, không có mô tả).

**Evidence từ source:**
```ts
// modal.ts — renderQrShell() dùng messages.qrSrHint
// locales có key "qrSrHint" → sr-only span dưới QR image
```
✅ **Đã fix** — sr-only text được inject qua `messages.qrSrHint`.

---

### A3 — "+N more" aria-label ✅ FIXED

**Finding gốc:** Nút "+3 more" trong group không có aria-label → screen reader đọc "+3" không có nghĩa.

**Evidence từ source:**
```ts
// modal.ts dòng 775:
aria-label="${messages.moreWallets(overflow)}"
```
`messages.moreWallets(n)` trả về string kiểu `"3 more wallets"` → đủ context cho screen reader.

✅ **Đã fix** — aria-label dynamic theo số lượng.

---

### A4 — Spinner aria-hidden ✅ FIXED

**Finding gốc:** CSS spinner không có `aria-hidden="true"` → screen reader cố đọc decorative element.

**Evidence từ source:**
```ts
// modal.ts dòng 581 (list shell): <div class="xwk-spinner" aria-hidden="true">
// modal.ts dòng 705 (connect shell): <div class="xwk-spinner" aria-hidden="true">
```
✅ **Đã fix** — cả 2 vị trí có `aria-hidden="true"`.

---

### A5 — aria-labelledby ✅ FIXED

*Đã verify ở section Accessibility Fix trên — confirmed ở cả 3 shells.*

✅ FIXED (dòng 581, 681, 705).

---

### A6 — Footer font-weight ✅ FIXED

**Finding gốc:** Footer text `font-weight: 300` quá nhạt, khó đọc — đặc biệt trên màn hình có PPI thấp.

**Evidence từ source:**
```ts
// modal.ts renderStyles() — CSS:
.xwk-footer { font-weight: 400 }
```
✅ **Đã fix** — 300 → 400 (regular weight).

---

## Design Critique Findings

### D1 — walletRadius token trong CSS ✅ FIXED

**Finding gốc:** `.xwk-wallet { border-radius: 16px }` hardcoded, không dùng `theme.walletRadius` token.

**Evidence từ source:**
```ts
// modal.ts renderStyles() dòng 745:
.xwk-wallet{border-radius:${theme.walletRadius}}
```
✅ **Đã fix** — dùng token đúng.

---

### D2 — groupFontSize tăng lên 12px ✅ FIXED

**Finding gốc:** Group label font-size 11px quá nhỏ, không đọc được tốt.

**Evidence từ source:**
```ts
// modal.ts dòng 734:
const groupFontSize = textSize === "lg" ? "13px" : "12px";
```
✅ **Đã fix** — 11px → 12px (default) / 13px (large).

---

### D3 — connect-icon border-radius hardcoded ⚠️ OPEN

**Finding gốc:** `.xwk-connect-icon img { border-radius: 16px }` hardcoded, nên dùng `theme.walletRadius`.

**Evidence từ source:**
```ts
// modal.ts renderStyles() — grep kết quả:
.xwk-connect-icon img{border-radius:16px}
```
Vẫn hardcoded `16px` — không dùng `${theme.walletRadius}`.

⚠️ **Chưa fix** — low priority cosmetic issue.

**Fix một dòng:**
```ts
// Đổi:
.xwk-connect-icon img{border-radius:16px}
// Thành:
.xwk-connect-icon img{border-radius:${theme.walletRadius}}
```

---

## Cập nhật Tóm tắt hành động

### Bổ sung vào danh sách cần sửa (từ REVIEW_UI)

| # | File | Finding | Fix |
|---|------|---------|-----|
| F3 | `packages/ui/src/modal.ts` | UI2: CSS 7KB re-inject | Tách `<style>` ra khỏi `root.innerHTML`, inject 1 lần vào `<head>` |
| F4 | `packages/ui/src/modal.ts` | D3: connect-icon border-radius | `.xwk-connect-icon img{border-radius:${theme.walletRadius}}` |

**F3 (UI2) ưu tiên cao hơn F4 (D3) — F3 ảnh hưởng performance, F4 chỉ là cosmetic.**

---

*REVIEW_UI.md verification hoàn tất — verified từ source code thực tế bằng grep/read*
