# xrpl-wallet-kit — UI/UX Review

**Reviewer:** Senior Engineer (UI/UX + Accessibility)
**Date:** 2026-05-26
**Scope:** `packages/ui/src/` — modal.ts, button.ts, themes.ts, types.ts (1924 dòng) + Visual review trực tiếp trên `http://127.0.0.1:5173/`

---

## Tổng quan

UI đã đạt chất lượng production về mobile và accessibility cơ bản. Dark theme + Card layout là combo visual đẹp nhất, ngang ngửa Metamask/RainbowKit. Điểm yếu nhất là CSS injection pattern và thiếu backdrop close — cả hai đều fix nhanh.

---

## ✅ Điểm mạnh

### Accessibility — gần đạt chuẩn WCAG 2.1 AA

- `role="dialog"` + `aria-modal="true"` + `aria-label` trên mọi dialog
- Focus trap đầy đủ — Tab/Shift+Tab bị giữ trong modal, không thoát ra ngoài
- `lastFocusedElement` được save trước khi mở và restore khi đóng — đúng pattern
- Escape key đóng modal ở mọi view
- `aria-live="polite"` trên status bar, `role="alert"` khi có lỗi — screen reader sẽ đọc
- `focus-visible` (không phải `focus`) — outline chỉ hiện khi dùng bàn phím
- `aria-hidden="true"` trên tất cả icon SVG decorative
- `prefers-reduced-motion` được xử lý — tắt animation cho user có motion sensitivity

### Mobile — production quality

- Bottom sheet pattern trên ≤640px — đúng pattern iOS/Android
- `env(safe-area-inset-*)` đầy đủ cả 4 cạnh — notch/home indicator safe
- `dvh` thay vì `vh` — không bị keyboard iOS che mất modal
- `overscroll-behavior: contain` — scroll trong modal không leak ra page
- `-webkit-overflow-scrolling: touch` — smooth scroll iOS
- `touch-action: manipulation` — không bị double-tap zoom trên button
- Layout icon grid từ 4 cột → 3 cột trên mobile
- Portrait ngắn (max-height: 560px) có layout riêng tối giản
- QR card scale xuống cho màn 360px

### QR Code — 3 lớp fallback

- Primary: `qr-code-styling` SVG, dots style, errorCorrectionLevel H, rounded corners
- Fallback 1: `qrcode` library → data URL image
- Fallback 2: raw URI text — không bao giờ để trắng
- Dark/light aware (màu QR đổi theo theme)
- Copy URI + deeplink "Open Wallet" khi có deeplink

### Theme system — flexible

- 4 preset: light, dark, xrpl, minimal
- 12 CSS variable override: accent, background, foreground, muted, border, overlay, surface, surfaceHover, shadow, radius, walletRadius, fontFamily
- Auto dark mode via `prefers-color-scheme`
- 4 layout mode: list, card, grid, icon
- 3 text size, 3 modal size

### Error copy text — rõ và thân thiện

| Error code | User thấy |
|---|---|
| CONNECTION_REJECTED | "Connection was rejected in the wallet." |
| REQUEST_TIMEOUT | "Wallet request timed out. Please try again." |
| WALLET_NOT_INSTALLED | "Wallet is not available in this browser." |
| NETWORK_MISMATCH | "Wallet network does not match this dApp." |
| QR rejected | "Connection canceled — The request was rejected in your wallet." |

### Account button — feature set ấn tượng

- XRPDomains identity resolution với avatar, TTL cache 10 phút
- Balance display với "Not activated" state cho unfunded account
- Address gradient avatar (hash-based, 6 palette) khi không có NFT avatar
- Copy address với feedback icon + 1.4s reset
- Explorer link, disconnect
- Panel mode: dropdown hoặc modal full-screen
- 4 variant: default, pill, minimal, outline

---

## ⚠️ Findings

### UI1 — Backdrop click không đóng modal `[Medium]`

**Confirmed bằng visual test:** Click vào overlay bên ngoài modal → modal không đóng. Chỉ có Escape key hoạt động.

Đây là UX expectation phổ biến — Metamask, RainbowKit, WalletConnect AppKit đều đóng khi click backdrop. Account panel dropdown có xử lý click-outside đúng, nhưng main modal thì không.

**Fix:**
```ts
// Trong mount(), thêm sau khi append root:
this.root?.addEventListener("click", (event) => {
  if (event.target === this.root) this.close();
});
```

---

### UI2 — CSS inject lại toàn bộ mỗi lần view transition `[Medium]`

Mỗi lần `renderQrShell()` hoặc `renderConnectShell()` được gọi, `root.innerHTML` bị replace hoàn toàn — bao gồm cả `<style>` 7KB (~7000 ký tự CSS). Điều này xảy ra mỗi khi user chọn wallet, QR xuất hiện, retry.

**Fix:** Giữ `<style id="xwk-styles">` inject một lần, chỉ update content bên trong modal.

```ts
// Thay vì inject style trong mỗi renderXxxShell:
private ensureStyles(theme, layout, size, textSize) {
  const id = "xwk-styles";
  if (!document.getElementById(id)) {
    const style = document.createElement("style");
    style.id = id;
    style.textContent = this.renderStyles(theme, layout, size, textSize)
      + this.renderMobileSheetOverrides(theme);
    document.head.appendChild(style);
  }
}
```

---

### UI3 — Connect status text không phân biệt theo loại wallet `[Low]`

Mọi adapter đều hiện: *"Click connect in your [Wallet] popup."*

Thực tế:
- Mobile wallets (Xaman, WalletConnect QR): nên là *"Open your [Wallet] app and approve."*
- Hardware (Ledger): nên là *"Confirm on your Ledger device."*

Adapter có `wallet.type` và `wallet.capabilities.qr` để phân biệt:

```ts
private getConnectStatusText(wallet?: WalletMetadata): string {
  if (wallet?.capabilities?.qr) return `Open your ${wallet.name} app and scan.`;
  if (wallet?.type === "hardware") return `Confirm on your ${wallet.name} device.`;
  return `Click connect in your ${wallet?.name ?? "wallet"} popup.`;
}
```

---

### UI4 — Account panel modal thiếu focus trap `[Low]`

Account panel ở `accountPanelMode: "modal"` có `role="dialog"` + `aria-modal="true"` nhưng không có Tab cycle trap. Tab key thoát ra page background. Modal chính xử lý đúng, account panel bị bỏ sót.

---

### UI5 — "Installed" badge chỉ hiện ở list layout `[Observation — không áp dụng ngay]`

**Confirmed bằng visual test:** Card/icon layout không hiện "Installed" indicator.

**⚠️ Phản biện:** Đây là intentional design decision — "Installed" badge chỉ áp dụng cho layout `"list"` và loại ví Extension/XRPL Snap. Review nhận xét đúng về UX tổng quát, nhưng trái với decision hiện tại đã được chốt. Giữ nguyên hành vi hiện tại; có thể revisit khi cần white-label hoặc public docs yêu cầu rõ hơn.

---

### UI6 — Footer mặc định là "XRPL Wallet Kit" `[Observation — giữ nguyên]`

**Confirmed bằng visual test:** Tất cả các state (list, connect, qr) đều hiện "XRPL Wallet Kit" ở footer.

**⚠️ Phản biện:** Footer `"XRPL Wallet Kit"` là intentional — đây là branding mặc định theo yêu cầu hiện tại của sản phẩm. Reviewer nhìn từ góc SDK generic/white-label là hợp lý, nhưng chưa phù hợp giai đoạn hiện tại. Khi đi public với mô hình white-label thì có thể đổi default thành `""` và để developer tự set.

---

### UI7 — Copy URI không announce cho screen reader `[Low]`

Button text đổi thành "Copied" nhưng không có `aria-live` region thông báo cho screen reader. User mù sẽ không biết copy thành công.

```html
<span aria-live="assertive" class="xwk-sr-only"></span>
```

---

### UI8 — Error text trong connect state màu gray thay vì amber `[Low]`

**Confirmed bằng visual test:** Khi WalletConnect bị reject, error message "Request was rejected in the wallet." hiển thị màu gray muted, không phải amber/orange như code `xwk-error-text` quy định (`color: #b45309`).

Cần kiểm tra lại: class `xwk-error-text` có được apply đúng lên element `xwk-connect-status` không, hay bị override bởi specificity khác.

---

### UI9 — WalletConnect Default mode mở 2 lớp modal `[Documentation — không phải bug]`

Ở mode `walletConnectUiMode: "default"` (default), WalletConnect AppKit modal mở trên top của kit's own modal. User thấy 2 layer overlay. Khi đóng AppKit modal, kit interpret là "rejected" và hiện error state.

**⚠️ Phản biện:** Đây là expected behavior — mode `"default"` dùng WalletConnect AppKit modal gốc (branded, đầy đủ tính năng). Mode `"list"` và `"group"` mới dùng custom QR của kit. Không cần fix code, chỉ cần **document rõ sự khác biệt**:

| Mode | Hành vi |
|---|---|
| `"default"` | Dùng WalletConnect AppKit modal — full branded WC UI |
| `"list"` | Hiện từng WC wallet riêng lẻ, dùng kit's own QR/connect shell |
| `"group"` | Gom WC wallets thành 1 entry group, dùng kit's own QR/connect shell |

---

## 📊 Điểm tổng

| Hạng mục | Điểm | Ghi chú |
|---|---|---|
| Accessibility | 9.5/10 | ~~Focus trap thiếu~~ đã fix UI1+UI4; screen reader announce UI7 đã fix |
| Mobile UX | 9.5/10 | Bottom sheet, safe area, dvh — xuất sắc |
| Visual design | 8.5/10 | Dark+Card combo rất đẹp; light mode thiếu shadow để phân tách modal |
| Copy text & Error UX | 9/10 | ~~Error text màu sai~~ UI8 fixed; ~~generic status~~ UI3 fixed với 5 case |
| Theme & Layout flexibility | 9/10 | 4 layout, 3 theme preset, 12 token — tốt nhất thị trường XRPL |
| Performance | 6.5/10 | CSS re-inject 7KB mỗi view transition (UI2 — còn tồn đọng) |

---

## 🎯 Verification — Fix pass 1

| # | Finding | Status | Chi tiết |
|---|---------|--------|----------|
| UI1 | Backdrop click đóng modal | ✅ Fixed | `mount()` line 240-243: `root.addEventListener("click", e => { if (e.target === this.root) this.close() })` |
| UI2 | Cache CSS style tag | ❌ Not fixed | `renderQrShell()` và `renderConnectShell()` vẫn inject `<style>7KB</style>` vào `root.innerHTML` mỗi lần transition |
| UI3 | Connect status text theo wallet type | ✅ Fixed | `getConnectStatusText()` line 620-632: 5 case — hardware, walletconnect/group, mobile/qr/deeplink, snap, default extension |
| UI4 | Focus trap cho account panel modal | ✅ Fixed | `handleDocumentKeyDown()` trong button.ts line 189-214: full Tab cycle trap; `getAccountPanelFocusableElements()` scope đúng vào `.xwk-account-panel-modal`; auto-focus khi open |
| UI7 | Screen reader announce copy success | ✅ Fixed | `updateQrCopyButton()` line 223-225 update `data-xwk-copy-live`; live region `aria-live="assertive"` có trong `renderQrShell()` HTML |
| UI8 | Error text màu amber | ✅ Fixed | `renderMobileSheetOverrides()` line 659: `const errorColor = dark ? "#fbbf24" : "#b45309"` — dark mode dùng amber sáng hơn; selector `.xwk-connect-status.xwk-error-text{color:${errorColor}!important}` ghi đè specificity |

**Kết quả: 5/6 fixed. Còn UI2 (CSS performance) chưa được xử lý.**

> **Không áp dụng ngay:** UI5 (Installed badge card/icon — intentional decision), UI6 (Footer branding — intentional), UI9 (WC 2 lớp modal — cần document, không fix code).

---

## Visual test log

| State | Theme | Layout | Network | Kết quả |
|---|---|---|---|---|
| List idle | Light | List | Mainnet | ✅ Clean, badges đúng |
| List idle | Dark | Card | Mainnet | ✅ Rất đẹp, dark polished |
| List idle | Dark | Icon | Testnet | ✅ Compact, Testnet badge amber |
| Connecting | Light | List | Mainnet | ✅ Spinner mượt |
| Error (WC rejected) | Light | List | Mainnet | ⚠️ Error text gray thay vì amber *(fix đã apply, cần re-test)* |
| Backdrop click | Dark | Icon | Testnet | ✅ Modal đóng đúng (UI1 re-confirmed) |
| WC Default mode | Light | List | Mainnet | ℹ️ AppKit modal mở riêng (2 lớp) |

---

## 📱 Mobile simulation test (Chrome + iOS UA injection)

**Thiết bị mô phỏng:** iPhone 14 Pro profile — iOS 17.4 Safari UA, touch maxPoints=5
**Phương pháp:** CSS bottom-sheet override + Chrome viewport, không phải WebKit thật

### Kết quả

| Test case | Kết quả | Chi tiết |
|---|---|---|
| Bottom sheet layout | ✅ Pass | Modal anchor bottom, `border-bottom-left-radius: 0px`, `border-top-left-radius: 14px` — đúng |
| Backdrop click (UI1) | ✅ Pass | Click overlay đóng modal — confirmed lại lần 2 |
| Connect status text (UI3) | ✅ Pass | "Open your WalletConnect app and approve." — đúng theo wallet type |
| Dark theme bottom sheet | ✅ Pass | Card layout + dark + bottom sheet — render hoàn hảo |
| QR view bottom sheet | ✅ Pass | QR dots render, Copy URI + Open Wallet buttons, help text đúng |
| QR card dimensions | ✅ Pass | `min(332px, 100%)` — 332×388px, không overflow |
| Screen reader live region (UI7) | ✅ Pass | `aria-live="assertive"` + `data-xwk-copy-live` tồn tại và đúng |
| Touch target sizes | ✅ Pass | Tất cả button ≥ 44px height (Close: 44px, wallet buttons: 111px) |
| overscroll-behavior | ✅ Pass | `contain` trên cả overlay và body — scroll không leak ra page |
| Body scroll | ✅ Pass | `overflow: auto`, content fit trong viewport, không overflow trên 812px |
| Font size / iOS zoom risk | ✅ Pass | Không có `<input>` trong modal → Safari auto-zoom không trigger |

### Findings mới từ mobile test

**M1 — Không có `overscroll-behavior: contain` trên `document.body` khi modal mở `[Low]`**

Modal inject `overscroll-behavior: contain` đúng vào overlay và body của modal, nhưng scroll của `document.body` phía sau không bị lock hoàn toàn. Trên iOS Safari thật, user vẫn có thể kéo bounce scroll page phía dưới qua vùng overlay mờ. Kit đã có `lockPageScroll()` nhưng cần verify nó có set `document.body { overflow: hidden }` không hay chỉ dùng padding-right trick.

**M2 — Font sizes dưới 16px trong modal text `[Observation — không phải bug]`**

Body text: 14px, wallet name: 15px, group label: 11-12px, footer: 10px. Tất cả đều dưới 16px nhưng **không gây Safari zoom** vì không có `<input>` hay `<textarea>` trong modal. Nếu sau này thêm search/filter input vào wallet list, cần đảm bảo font-size ≥ 16px để tránh Safari auto-zoom.

### Cần test trên hardware thật (Chrome không simulate được)

| Item | Lý do cần hardware |
|---|---|
| `-webkit-overflow-scrolling: touch` momentum | Chrome bỏ qua property này |
| `dvh` vs `vh` khi iOS keyboard xuất hiện | Chrome không có iOS virtual keyboard behavior |
| Safe-area-inset rendering trên notch thật | `env(safe-area-inset-*)` Chrome emulate 0px |
| Bottom sheet swipe-to-dismiss (nếu có) | Touch gesture thật |
| Scroll momentum trong wallet list | WebKit scroll physics khác Chrome |

---

## ♿ WCAG 2.1 AA Accessibility Audit

**Standard:** WCAG 2.1 AA | **Date:** 2026-05-27
**Method:** Static code analysis + automated contrast verification (Python WCAG formula)

**Kết quả: 0 Critical — 1 Major — 6 Minor. Near-AA compliant.**

### Contrast check (tính bằng WCAG relative luminance)

| Element | FG | BG | Ratio | Pass AA? |
|---------|----|----|-------|----------|
| Body text (light) | `#111827` | `#ffffff` | 17.74:1 | ✅ |
| Muted text (light) | `#64748b` | `#ffffff` | 4.76:1 | ✅ |
| Muted text on surface (light) | `#64748b` | `#f8fafc` | 4.55:1 | ✅ |
| Accent / focus ring (light) | `#0078ae` | `#ffffff` | 4.89:1 | ✅ |
| **Installed badge text (light)** ⚠️ | `#6b7280` | `#f0f1f3` | **4.28:1** | ❌ Major |
| Error amber (light) | `#b45309` | `#ffffff` | 5.02:1 | ✅ |
| Network badge (light) | `#92400e` | `#fef3c7` | 6.37:1 | ✅ |
| Body text (dark) | `#f8fafc` | `#111827` | 16.96:1 | ✅ |
| Muted text (dark) | `#94a3b8` | `#111827` | 6.92:1 | ✅ |
| Accent / focus ring (dark) | `#4aa3ff` | `#111827` | 6.74:1 | ✅ |
| Error amber (dark) | `#fbbf24` | `#111827` | 10.63:1 | ✅ |

### Accessibility findings mới (từ audit pass 2)

**A1 — Badge text contrast fails AA (light) `[Major]`**
`#6b7280` trên `#f0f1f3` = 4.28:1, thiếu 0.22:1 để đạt 4.5:1.
**Fix:** Đổi `badgeColor` thành `#5c6878` → 5.01:1 ✅

```ts
// modal.ts renderStyles()
const badgeColor = dark ? "#cbd5e1" : "#5c6878"; // thay #6b7280
```

**A2 — QR code không có accessible text alternative `[Minor]`**
QR SVG/canvas không có `aria-label`. Screen reader user không scan được QR nhưng cần biết phải dùng "Copy URI" button.
**Fix:** Thêm `aria-hidden="true"` lên QR container + 1 `<span class="xwk-sr-only">` gợi ý Copy URI bên cạnh.

**A3 — Group preview "+N" thiếu context cho screen reader `[Minor]`**
`<span class="xwk-mini-more">+2</span>` được đọc là "plus 2" — không rõ 2 cái gì.
**Fix:**
```ts
`<span class="xwk-mini-more" aria-label="+${overflow} more wallets">+${overflow}</span>`
```

**A4 — Connect spinner không có `aria-hidden` `[Minor]`**
`<div class="xwk-spinner">` bao gồm decorative animation + wallet icon `alt=""`. `<p role="status">` đã đảm nhận communication — spinner nên bị ẩn khỏi screen reader.
**Fix:** Thêm `aria-hidden="true"` vào `<div class="xwk-spinner">`.

**A5 — Dialog nên dùng `aria-labelledby` thay `aria-label` `[Minor]`**
`aria-label="Connect Wallet"` hardcode không tự cập nhật khi title đổi (Connect → WalletConnect → tên wallet). Visible `.xwk-title` luôn đúng nhưng ARIA label bị lệch.
**Fix:** Thêm `id="xwk-title"` vào `<h2 class="xwk-title">`, thay `aria-label` → `aria-labelledby="xwk-title"`.

**A6 — Footer `font-weight:300` tại 10px `[Minor]`**
Weight 300 ở cỡ chữ nhỏ nhất trong component làm giảm perceived contrast dưới giá trị đo được.
**Fix:** Đổi `font-weight:300` → `font-weight:400` trong `.xwk-footer`.

### Confirmed passes — không cần action

| Feature | WCAG | Status |
|---------|------|--------|
| Focus trap (Tab + Shift+Tab) modal chính | 2.1.1 | ✅ |
| Focus trap account panel modal mode | 2.1.1 | ✅ |
| `lastFocusedElement` restored khi đóng | 2.4.3 | ✅ |
| Escape đóng modal từ mọi view | 2.1.1 | ✅ |
| `focus-visible` (ring keyboard-only) | 2.4.7 | ✅ |
| `aria-live="polite"` connect status | 4.1.3 | ✅ |
| `role="alert"` error states | 4.1.3 | ✅ |
| `aria-live="assertive"` copy success | 4.1.3 | ✅ |
| `aria-hidden="true"` decorative SVGs | 1.1.1 | ✅ |
| `prefers-reduced-motion` | 2.3.3 | ✅ |
| Touch targets ≥ 44px | 2.5.5 | ✅ |
| Network badge: text + màu (không color-only) | 1.4.1 | ✅ |
| Error state: text + amber (không color-only) | 1.4.1 | ✅ |

---

## 🎨 Design Critique

**Basis:** Visual tests × 7 state/theme/layout combo + mobile sim + code analysis
**Comparison:** MetaMask, RainbowKit 2.x, WalletConnect AppKit

### Overall impression

Dark + Card là **best-in-class cho XRPL ecosystem**, ngang RainbowKit. Light theme competent nhưng flat — modal trắng không có depth cue. Fix duy nhất tạo impact lớn nhất: thêm `box-shadow` vào light theme.

### Usability gaps

| Finding | Severity | Fix |
|---------|----------|-----|
| Installed badge flicker khi modal mở (async availability check) | 🟡 Moderate | Skeleton/stable badge state — fade-in sau khi `getWalletAvailability()` resolve |
| Group button không có chevron — user không biết có thể expand | 🟢 Minor | Thêm `›` hoặc chevron SVG 16×16px bên phải row |
| Back button ẩn bằng `visibility:hidden` tạo 44×44px invisible tap target trên mobile | 🟢 Minor | Dùng `display:none` + min-width trên title cell thay vì visibility trick |
| "Open Wallet" button bị hidden (không chỉ disabled) khi không có deeplink | 🟢 Minor | Show disabled + tooltip "Deep link not available" thay vì ẩn hẳn |

### Visual hierarchy gaps

- **Footer 10px / weight-300** gần như invisible — nếu là branding thì cần ≥ 12px/400; nếu không cần thì xóa để lấy lại 36px vertical space trên 667px iPhone
- **Group label 11px** quá nhỏ trên non-Retina — `groupFontSize` nên là `"12px"` minimum

### Consistency gaps — token issues

| Element | Vấn đề | Fix |
|---------|--------|-----|
| `lightTheme.shadow: "none"` | Modal không nổi lên khỏi page background | `shadow: "0 8px 40px rgba(15,23,42,.12)"` trong lightTheme |
| `renderMobileSheetOverrides()` dùng `!important` bỏ qua `radius` token | Developer set `radius:"20px"` nhưng mobile sheet vẫn dùng kit default | Pass `theme.radius` vào hàm này |
| `.xwk-wallet { border-radius: 16px }` hardcode | `walletRadius` token không áp dụng cho wallet list button | Dùng `${theme.walletRadius}` |
| List view icon `border-radius:12px` ≠ Connect view `border-radius:16px` | Cùng wallet, 2 state, 2 border-radius — visual inconsistency khi transition | Thống nhất 1 giá trị |

### Priority fixes cho coder

```ts
// 1. Light theme shadow — themes.ts
shadow: "0 8px 40px rgba(15,23,42,.12), 0 0 0 1px rgba(15,23,42,.04)"

// 2. Badge contrast — modal.ts renderStyles()
const badgeColor = dark ? "#cbd5e1" : "#5c6878"; // 4.28:1 → 5.01:1 ✅

// 3. Wallet button radius token — modal.ts renderStyles()
// .xwk-wallet { border-radius: ${theme.walletRadius} }  ← thay 16px hardcode

// 4. Group label font size — modal.ts renderStyles()
const groupFontSize = textSize === "lg" ? "13px" : "12px"; // thay "11px"
```

### So sánh với peers

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

> Dark theme đã best-in-class cho XRPL ecosystem. Fix light theme shadow + 3 token issues là đủ để đạt release quality trên tất cả combination.
