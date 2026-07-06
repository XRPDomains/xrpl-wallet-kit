# Feature UI Specification — XRPL Wallet Kit

**Author:** Design review  
**Date:** 2026-05-27  
**Reference kits:** RainbowKit 2.x · ConnectKit 1.9 · web3-onboard 2.x  
**Constraint:** Additive only — không sửa HTML của `renderListShell`, `renderConnectShell`, `renderQrShell`. Không thêm class mới vào các section đã có. Toàn bộ CSS mới dùng prefix `xwk-` và dùng token từ `ResolvedTheme`.

---

## Overview — Chiến lược tích hợp

Các feature UI mới chia làm 3 nhóm theo cách tích hợp:

| Feature | Nhóm | Cách tích hợp |
|---------|------|---------------|
| WalletToast | **Standalone DOM** | Class riêng, mount ngoài modal, không liên quan gì đến `WalletModal` |
| Transaction Preview | **New modal view** | Thêm `"preview"` vào `WalletModalView`, thêm method riêng |
| Account Activation Guard | **New modal view** | Thêm `"guard"` vào `WalletModalView`, thêm method riêng |
| Trust Line Warning | **Inline banner** | Inject vào `.xwk-body` của view hiện tại, không tạo view mới |
| Recent Transactions | **Account panel extension** | Thêm section vào cuối `renderPanelContent()` |
| Enhanced Network Badge | **Token extension** | Mở rộng `renderNetworkBadge()` trong `modal.ts` |

**Nguyên tắc CSS:**
- Dùng `${theme.xxx}` token — không hardcode hex mới
- Ngoại lệ: màu status cố định (`#10b981` confirmed, `#ef4444` failed, `#f59e0b` pending) — đây là semantic colors không phụ thuộc theme
- Class mới không override class cũ — chỉ thêm, không sửa

---

## Feature 1 — WalletToast (Transaction Notify)

### Khái niệm
Floating notification card xuất hiện ở góc dưới phải (desktop) / bottom edge (mobile). Mỗi transaction có 1 toast. Toast stack từ dưới lên, tự dismiss sau 5 giây khi confirmed/failed. **Hoàn toàn độc lập với WalletModal.**

### API

```ts
// packages/ui/src/toast.ts — class mới
class WalletToast {
  constructor(options: WalletToastOptions)
  mount(container?: HTMLElement): void   // default: document.body
  destroy(): void
}

interface WalletToastOptions {
  manager: WalletManager;
  theme?: WalletUiTheme;
  themeMode?: WalletUiThemeMode;
  autoDismissMs?: number;          // default 5000
  maxVisible?: number;             // default 3
  position?: "bottom-right" | "bottom-left" | "bottom-center";  // default "bottom-right"
  explorerUrl?: (hash: string) => string;  // custom explorer URL
  language?: WalletUiLocale;
  messages?: WalletUiMessagesInput;
}
```

**Manager events lắng nghe:**
- `tx_submitted` → show toast, state = "pending"
- `tx_confirmed` → update toast → state = "confirmed", bắt đầu đếm autoDismiss
- `tx_failed` → update toast → state = "failed", bắt đầu đếm autoDismiss

### DOM Structure

```html
<!-- Mount point — inject vào body, fixed position -->
<div class="xwk-toast-root" aria-live="polite" aria-label="Transaction notifications">

  <!-- Mỗi toast là 1 item -->
  <div class="xwk-toast xwk-toast--pending" data-hash="ABC123" role="status">
    <div class="xwk-toast-icon">
      <!-- pending: spinner SVG -->
      <svg class="xwk-toast-spinner" ...></svg>
    </div>
    <div class="xwk-toast-body">
      <span class="xwk-toast-label">Transaction submitted</span>
      <span class="xwk-toast-hash">ABC1…23EF</span>
    </div>
    <button class="xwk-toast-dismiss" aria-label="Dismiss">×</button>
  </div>

  <div class="xwk-toast xwk-toast--confirmed" data-hash="DEF456">
    <div class="xwk-toast-icon xwk-toast-icon--confirmed">
      <!-- ✓ check SVG, màu #10b981 -->
    </div>
    <div class="xwk-toast-body">
      <span class="xwk-toast-label">Transaction confirmed</span>
      <span class="xwk-toast-hash">DEF4…56AB</span>
    </div>
    <a class="xwk-toast-link" href="https://..." target="_blank" rel="noopener">
      View <svg ...></svg>
    </a>
    <button class="xwk-toast-dismiss" aria-label="Dismiss">×</button>
  </div>

  <div class="xwk-toast xwk-toast--failed" data-hash="GHI789">
    <div class="xwk-toast-icon xwk-toast-icon--failed">
      <!-- ✕ close SVG, màu #ef4444 -->
    </div>
    <div class="xwk-toast-body">
      <span class="xwk-toast-label">Transaction failed</span>
      <span class="xwk-toast-hash">GHI7…89CD</span>
    </div>
    <button class="xwk-toast-dismiss" aria-label="Dismiss">×</button>
  </div>

</div>
```

### CSS

```css
/* Container */
.xwk-toast-root {
  bottom: 24px;
  display: flex;
  flex-direction: column-reverse;  /* mới nhất ở dưới cùng */
  font-family: ${theme.fontFamily};
  gap: 10px;
  pointer-events: none;
  position: fixed;
  right: 24px;
  z-index: 2147483646;  /* 1 dưới modal overlay */
}

/* Mỗi toast card */
.xwk-toast {
  align-items: center;
  animation: xwk-toast-in 0.22s cubic-bezier(0.34, 1.56, 0.64, 1) both;
  background: ${theme.background};
  border: 1px solid ${theme.border};
  border-radius: ${theme.radius};
  box-shadow: ${theme.shadow}, 0 0 0 1px ${theme.border};
  box-sizing: border-box;
  color: ${theme.foreground};
  display: flex;
  gap: 12px;
  max-width: 360px;
  min-width: 280px;
  padding: 14px 16px;
  pointer-events: all;
}

/* Trạng thái dismissing */
.xwk-toast--out {
  animation: xwk-toast-out 0.18s ease both;
}

/* Icon container */
.xwk-toast-icon {
  align-items: center;
  border-radius: 999px;
  display: flex;
  flex: 0 0 28px;
  height: 28px;
  justify-content: center;
  width: 28px;
}

/* Spinner (pending) */
.xwk-toast-spinner {
  animation: xwk-spin 0.9s linear infinite;
  color: ${theme.accent};
  height: 20px;
  width: 20px;
}

/* Confirmed */
.xwk-toast-icon--confirmed {
  background: rgba(16, 185, 129, 0.10);
  color: #10b981;
}

/* Failed */
.xwk-toast-icon--failed {
  background: rgba(239, 68, 68, 0.10);
  color: #ef4444;
}

/* Body */
.xwk-toast-body {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.xwk-toast-label {
  color: ${theme.foreground};
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
}

.xwk-toast-hash {
  color: ${theme.muted};
  font-family: ui-monospace, "Cascadia Code", monospace;
  font-size: 11px;
}

/* "View" explorer link */
.xwk-toast-link {
  align-items: center;
  border-radius: 6px;
  color: ${theme.accent};
  display: inline-flex;
  flex: 0 0 auto;
  font-size: 12px;
  font-weight: 500;
  gap: 4px;
  padding: 4px 8px;
  text-decoration: none;
  white-space: nowrap;
}
.xwk-toast-link:hover { text-decoration: underline; }

/* Dismiss button */
.xwk-toast-dismiss {
  background: none;
  border: none;
  border-radius: 6px;
  color: ${theme.muted};
  cursor: pointer;
  flex: 0 0 auto;
  font-size: 18px;
  height: 28px;
  line-height: 1;
  padding: 0;
  width: 28px;
}
.xwk-toast-dismiss:hover { color: ${theme.foreground}; }

/* Animations */
@keyframes xwk-toast-in {
  from { opacity: 0; transform: translateY(16px) scale(0.96); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes xwk-toast-out {
  from { opacity: 1; transform: translateY(0) scale(1); }
  to   { opacity: 0; transform: translateY(8px) scale(0.96); }
}

/* Mobile: bottom full-width */
@media (max-width: 480px) {
  .xwk-toast-root {
    bottom: max(12px, env(safe-area-inset-bottom));
    left: 12px;
    right: 12px;
  }
  .xwk-toast {
    max-width: 100%;
    min-width: 0;
    width: 100%;
  }
}

/* prefers-reduced-motion */
@media (prefers-reduced-motion: reduce) {
  .xwk-toast, .xwk-toast--out { animation: none; }
  .xwk-toast-spinner { animation: none; }
}
```

### Integration

```ts
// Sử dụng
const toast = new WalletToast({ manager, themeMode: "dark" });
toast.mount(); // gắn vào document.body

// Nội bộ WalletToast lắng nghe:
manager.on("tx_submitted", ({ hash, transaction }) => this.addToast(hash, transaction));
manager.on("tx_confirmed", ({ hash })              => this.updateToast(hash, "confirmed"));
manager.on("tx_failed",    ({ hash })              => this.updateToast(hash, "failed"));
manager.on("disconnected", ()                      => this.clearAll());
```

---

## Feature 2 — Transaction Preview Panel

### Khái niệm
Khi dApp cung cấp callback `transactionPreview`, modal sẽ hiện một view "Review Transaction" trước khi chuyển sang connect/qr. User thấy tóm tắt + chi tiết giao dịch trước khi ký. **Không sửa bất kỳ view nào đang có.**

### API thêm vào WalletUiConfig / WalletUiOptions

```ts
interface WalletUiConfig {
  // ... existing fields ...
  transactionPreview?: TransactionPreviewFn;
}

type TransactionPreviewFn = (txJson: TransactionPayload) => Promise<TransactionPreviewResult> | TransactionPreviewResult;

interface TransactionPreviewResult {
  summary: string;              // "Send 10 XRP to rXXX…"
  details?: TransactionDetail[]; // danh sách chi tiết
  estimatedFee?: string;         // "~0.000012 XRP"
  warning?: string;              // optional amber warning text
}

interface TransactionDetail {
  label: string;   // "Recipient", "Amount", "Memo"
  value: string;   // human-readable value
}
```

### Cách kích hoạt

```ts
// Trong WalletModal — không sửa connect() hay qr flow hiện tại
// Thêm method mới:
async showPreview(txJson: TransactionPayload, onConfirm: () => void, onCancel: () => void): Promise<void> {
  const result = await this.options.transactionPreview?.(txJson);
  if (!result) { onConfirm(); return; } // không có preview → bỏ qua
  this.previewResult = result;
  this.previewConfirm = onConfirm;
  this.previewCancel = onCancel;
  this.mount("preview");
}
```

**Thêm `"preview"` vào type:**
```ts
type WalletModalView = "list" | "connect" | "qr" | "preview";
```

### DOM Structure (renderPreviewShell)

```html
<!-- Thêm trong renderShell() HTML string, sau .xwk-qr: -->
<div class="xwk-preview xwk-hidden">

  <!-- Summary card — giống QR card layout nhưng nhỏ hơn -->
  <div class="xwk-preview-card">
    <div class="xwk-preview-summary">
      <!-- icon wallet hiện tại -->
      <div class="xwk-preview-wallet-icon">
        <img src="{walletIcon}" alt="" />
      </div>
      <p class="xwk-preview-summary-text">{summary}</p>
    </div>

    <!-- optional warning banner -->
    <div class="xwk-preview-warning xwk-hidden">
      <!-- SVG warning icon --> ⚠ {warning}
    </div>

    <!-- Detail list -->
    <dl class="xwk-preview-details">
      <div class="xwk-preview-detail-row">
        <dt class="xwk-preview-dt">{label}</dt>
        <dd class="xwk-preview-dd">{value}</dd>
      </div>
      <!-- repeat per detail -->
    </dl>

    <!-- Fee row — nếu có estimatedFee -->
    <div class="xwk-preview-fee">
      <span>Network fee</span>
      <span>{estimatedFee}</span>
    </div>
  </div>

  <!-- Action buttons -->
  <div class="xwk-preview-actions">
    <button class="xwk-action" data-xwk-preview-cancel>Cancel</button>
    <button class="xwk-action xwk-preview-confirm-btn" data-xwk-preview-confirm>
      Confirm
    </button>
  </div>

</div>
```

**CSS show/hide (thêm vào renderStyles):**
```css
.xwk-overlay[data-xwk-view="preview"] .xwk-preview { display: block; }
.xwk-overlay[data-xwk-view="preview"] .xwk-list,
.xwk-overlay[data-xwk-view="preview"] .xwk-connect,
.xwk-overlay[data-xwk-view="preview"] .xwk-qr { display: none; }
```

### CSS

```css
/* Preview card — giống xwk-qr-card */
.xwk-preview {
  padding: 6px 0 4px;
  text-align: left;
}

.xwk-preview-card {
  background: ${theme.surface};
  border: 1px solid ${theme.border};
  border-radius: 14px;
  box-sizing: border-box;
  margin-bottom: 12px;
  overflow: hidden;
  padding: 0;
}

/* Summary block — top của card, hơi đậm hơn */
.xwk-preview-summary {
  align-items: center;
  border-bottom: 1px solid ${theme.border};
  display: flex;
  gap: 14px;
  padding: 16px 18px;
}

.xwk-preview-wallet-icon img,
.xwk-preview-wallet-icon .xwk-icon-fallback {
  border-radius: 12px;
  flex: 0 0 40px;
  height: 40px;
  width: 40px;
}

.xwk-preview-summary-text {
  color: ${theme.foreground};
  font-size: 14px;
  font-weight: 500;
  line-height: 1.4;
  margin: 0;
}

/* Warning banner — amber, chỉ hiện khi có warning */
.xwk-preview-warning {
  align-items: flex-start;
  background: ${dark ? "rgba(245,158,11,.08)" : "#fffbeb"};
  border-bottom: 1px solid ${dark ? "rgba(245,158,11,.16)" : "#fde68a"};
  color: ${dark ? "#fbbf24" : "#92400e"};
  display: flex;
  font-size: 13px;
  gap: 8px;
  line-height: 1.4;
  padding: 10px 18px;
}

/* Detail list */
.xwk-preview-details {
  display: grid;
  gap: 0;
  margin: 0;
  padding: 0;
}

.xwk-preview-detail-row {
  align-items: center;
  border-bottom: 1px solid ${theme.border};
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 11px 18px;
}
.xwk-preview-detail-row:last-child {
  border-bottom: none;
}

.xwk-preview-dt {
  color: ${theme.muted};
  font-size: 13px;
  font-weight: 400;
}

.xwk-preview-dd {
  color: ${theme.foreground};
  font-size: 13px;
  font-weight: 500;
  margin: 0;
  max-width: 60%;
  overflow: hidden;
  text-align: right;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Fee row — subtle, bottom of card */
.xwk-preview-fee {
  align-items: center;
  border-top: 1px solid ${theme.border};
  color: ${theme.muted};
  display: flex;
  font-size: 12px;
  justify-content: space-between;
  padding: 10px 18px;
}
.xwk-preview-fee span:last-child {
  color: ${theme.foreground};
  font-weight: 500;
}

/* Action buttons — 2 columns */
.xwk-preview-actions {
  display: grid;
  gap: 10px;
  grid-template-columns: 1fr 1fr;
  margin-top: 4px;
}

/* Confirm button — accent color */
.xwk-preview-confirm-btn {
  background: ${theme.accent};
  border-color: transparent;
  color: #fff;
}
.xwk-preview-confirm-btn:hover {
  background: ${theme.accent};
  filter: brightness(1.08);
}
```

### Header state khi view = "preview"
- Back button: **hiện** (click → `onCancel()` + về list)
- Title: "Review Transaction"
- Close button: hiện (click → `onCancel()` + `close()`)

---

## Feature 3 — Account Activation Guard

### Khái niệm
Sau khi kết nối thành công, nếu `session.account.activationStatus === "unfunded"`, modal chuyển sang view `"guard"` thay vì đóng. User thấy cảnh báo + receive QR + hướng dẫn nạp XRP. Có thể dismiss để tiếp tục bình thường. **Không sửa connected flow hiện tại.**

### Trigger

```ts
// Trong WalletModal.handleConnected() — thêm điều kiện:
private handleConnected(adapterId: string): void {
  const session = this.options.manager.getSession();
  if (session?.account.activationStatus === "unfunded" && this.options.showActivationGuard !== false) {
    this.mount("guard");
    return;
  }
  this.close(); // behavior hiện tại
}
```

**Config option mới:**
```ts
interface WalletUiConfig {
  showActivationGuard?: boolean;   // default true
  activationGuardXrpAmount?: number;  // default 10 (XRP cần để activate)
  getXrpUrl?: string;              // default "https://xrpl.org/buy-xrp.html"
}
```

**Thêm `"guard"` vào type:**
```ts
type WalletModalView = "list" | "connect" | "qr" | "preview" | "guard";
```

### DOM Structure (renderGuardShell)

```html
<div class="xwk-guard xwk-hidden">

  <!-- Warning illustration -->
  <div class="xwk-guard-hero">
    <!-- SVG: shield with exclamation mark, amber, 52px -->
    <svg class="xwk-guard-icon" width="52" height="52" viewBox="0 0 52 52" ...>
      <!-- shield path fill: amber at 15% opacity, stroke: amber -->
      <!-- exclamation mark: amber -->
    </svg>
  </div>

  <h3 class="xwk-guard-title">Account Not Activated</h3>

  <p class="xwk-guard-body">
    Add at least {amount} XRP to this address to activate your account and start transacting on XRPL.
  </p>

  <!-- QR code — nhỏ hơn QR chính: 180px -->
  <div class="xwk-guard-qr" aria-hidden="true">
    <!-- qr-code-styling render ở đây, light/dark aware -->
  </div>
  <span class="xwk-sr-only">QR code showing your receive address — use the Copy Address button to copy it.</span>

  <!-- Address row -->
  <div class="xwk-guard-address">
    <span class="xwk-guard-address-text">{truncated address}</span>
    <button class="xwk-action xwk-guard-copy" data-xwk-guard-copy aria-label="Copy address">
      <!-- copy icon SVG -->
      Copy
    </button>
  </div>

  <!-- Actions -->
  <div class="xwk-guard-actions">
    <a class="xwk-action" href="{getXrpUrl}" target="_blank" rel="noopener"
       data-xwk-guard-external>
      Get XRP
      <!-- external link icon SVG -->
    </a>
    <button class="xwk-action" data-xwk-guard-continue>
      Continue anyway
    </button>
  </div>

</div>
```

**CSS show/hide:**
```css
.xwk-overlay[data-xwk-view="guard"] .xwk-guard { display: block; }
.xwk-overlay[data-xwk-view="guard"] .xwk-list,
.xwk-overlay[data-xwk-view="guard"] .xwk-connect,
.xwk-overlay[data-xwk-view="guard"] .xwk-qr,
.xwk-overlay[data-xwk-view="guard"] .xwk-preview { display: none; }
```

### CSS

```css
.xwk-guard {
  padding: 12px 0 8px;
  text-align: center;
}

/* Hero icon */
.xwk-guard-hero {
  display: flex;
  justify-content: center;
  margin-bottom: 14px;
}

.xwk-guard-icon {
  /* màu amber context — dùng currentColor với color set sẵn */
  color: ${dark ? "#fbbf24" : "#d97706"};
}

.xwk-guard-title {
  color: ${theme.foreground};
  font-size: 16px;
  font-weight: 600;
  margin: 0 0 10px;
}

.xwk-guard-body {
  color: ${theme.muted};
  font-size: 14px;
  line-height: 1.5;
  margin: 0 auto 18px;
  max-width: 300px;
}

/* QR code */
.xwk-guard-qr {
  background: transparent;
  border-radius: 12px;
  height: 180px;
  margin: 0 auto 12px;
  width: 180px;
}

/* Address display */
.xwk-guard-address {
  align-items: center;
  background: ${theme.surface};
  border: 1px solid ${theme.border};
  border-radius: ${theme.walletRadius};
  display: flex;
  gap: 8px;
  justify-content: space-between;
  margin: 0 auto 14px;
  max-width: 340px;
  padding: 10px 12px;
}

.xwk-guard-address-text {
  color: ${theme.foreground};
  font-family: ui-monospace, "Cascadia Code", monospace;
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.xwk-guard-copy {
  flex: 0 0 auto;
  font-size: 12px;
  min-height: 32px;
  padding: 0 10px;
}

/* Action row — 2 buttons */
.xwk-guard-actions {
  display: grid;
  gap: 10px;
  grid-template-columns: 1fr 1fr;
  margin: 0 auto;
  max-width: 360px;
}
```

### Header state khi view = "guard"
- Back button: **ẩn** (không thể back sau khi connected)
- Title: "Account Not Activated"
- Close button: hiện → `close()` (user tiếp tục, app đã có session)

### Continue flow
- Click "Continue anyway" → `this.close()` — modal đóng, session đã set, app hoạt động bình thường
- Click "Get XRP" → external link, modal **không đóng** (user quay lại sau)
- `close()` khi ở guard view không `cancelPendingConnection()` — session đã connected

---

## Feature 4 — Trust Line Warning Banner

### Khái niệm
Khi dApp phát hiện trust line thiếu (trước khi gọi `signAndSubmit`), hiện một **amber banner** ở đầu `.xwk-body` trong view `"connect"` hoặc `"qr"`. Không tạo view mới — là overlay inline bên trong view hiện tại.

### API thêm vào WalletModal

```ts
// Thêm method public:
setTrustLineWarning(token: string, issuer: string): void {
  this.trustLineWarning = { token, issuer };
  this.updateBodyBanner(); // re-render banner nếu modal đang mở
}

clearTrustLineWarning(): void {
  this.trustLineWarning = undefined;
  this.updateBodyBanner();
}
```

**Dùng từ dApp:**
```ts
// Trước khi sign, dApp kiểm tra trust line
modal.setTrustLineWarning("USDT", "rhub...");
await manager.signAndSubmit({ txJson: { ... } });
modal.clearTrustLineWarning();
```

**Auto-clear:** khi modal close → `clearTrustLineWarning()` trong `close()`.

### DOM Structure

```html
<!-- Inject vào đầu .xwk-body, trước .xwk-connect / .xwk-qr content -->
<!-- Chỉ hiện khi trustLineWarning !== undefined -->

<div class="xwk-trustline-banner" role="alert" aria-live="assertive">
  <svg class="xwk-trustline-icon" width="16" height="16" viewBox="0 0 24 24"
       fill="none" aria-hidden="true">
    <!-- warning triangle path -->
    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
          stroke="currentColor" stroke-width="2" stroke-linejoin="round" fill="none"/>
    <line x1="12" y1="9" x2="12" y2="13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    <line x1="12" y1="17" x2="12.01" y2="17" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
  </svg>
  <div class="xwk-trustline-content">
    <span class="xwk-trustline-title">Trust line required for {token}</span>
    <span class="xwk-trustline-detail">
      Issuer: {issuer_truncated} —
      <a class="xwk-trustline-link" href="https://xrpl.org/trust-lines-and-issuing.html"
         target="_blank" rel="noopener">Learn more ↗</a>
    </span>
  </div>
</div>
```

### CSS

```css
.xwk-trustline-banner {
  align-items: flex-start;
  background: ${dark ? "rgba(245,158,11,.08)" : "#fffbeb"};
  border: 1px solid ${dark ? "rgba(245,158,11,.20)" : "#fde68a"};
  border-radius: 10px;
  box-sizing: border-box;
  color: ${dark ? "#fbbf24" : "#92400e"};
  display: flex;
  font-size: 13px;
  gap: 10px;
  line-height: 1.4;
  margin-bottom: 12px;
  padding: 11px 14px;
}

.xwk-trustline-icon {
  flex: 0 0 16px;
  margin-top: 1px;
}

.xwk-trustline-content {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.xwk-trustline-title {
  font-weight: 500;
}

.xwk-trustline-detail {
  font-size: 12px;
  opacity: 0.8;
}

.xwk-trustline-link {
  color: inherit;
  font-weight: 500;
}
.xwk-trustline-link:hover { text-decoration: underline; }
```

### Integration

```ts
// Trong renderConnectShell() và renderQrShell() — KHÔNG sửa HTML đã có
// Thêm method helper:
private renderTrustLineBanner(): string {
  if (!this.trustLineWarning) return "";
  const { token, issuer } = this.trustLineWarning;
  const short = issuer.slice(0, 8) + "…" + issuer.slice(-4);
  return `<div class="xwk-trustline-banner" role="alert">...</div>`;
}

// Gọi ở đầu body trong connect/qr shell:
// `.xwk-body`'s first child = renderTrustLineBanner() + ... existing content
```

---

## Feature 5 — Recent Transactions (Account Panel)

### Khái niệm
Thêm section "Recent" ở cuối `renderPanelContent()` trong `button.ts`. Hiện tối đa 5 giao dịch gần nhất với status, description, time ago, và explorer link. Panel có `overflow-y: auto` để scroll nếu cần. **Không sửa cấu trúc HTML đã có.**

### Config option

```ts
interface WalletButtonOptions {
  // ... existing ...
  showTransactions?: boolean;        // default true
  maxTransactions?: number;          // default 5
  transactionExplorerUrl?: (hash: string, network?: WalletNetwork) => string;
}
```

### Thêm vào renderPanelContent()

```ts
// Cuối renderPanelContent() — sau actions, trước đóng string:
const transactions = this.renderTransactions(session);
return `...existing...${actions}${transactions}`;
```

### DOM Structure (renderTransactions)

```html
<!-- Chỉ render khi options.showTransactions !== false && transactions.length > 0 -->

<div class="xwk-account-txs">

  <!-- Header -->
  <div class="xwk-account-txs-header">
    <span class="xwk-account-txs-title">Recent</span>
    <button class="xwk-account-txs-clear" data-xwk-clear-txs aria-label="Clear transaction history">
      Clear
    </button>
  </div>

  <!-- Transaction list -->
  <ul class="xwk-account-txs-list" aria-label="Recent transactions">

    <!-- submitted -->
    <li class="xwk-account-tx" data-status="submitted">
      <span class="xwk-tx-dot xwk-tx-dot--submitted" aria-hidden="true"></span>
      <span class="xwk-tx-desc">{description || truncated hash}</span>
      <span class="xwk-tx-time">{timeAgo}</span>
      <!-- no explorer link for pending -->
    </li>

    <!-- confirmed -->
    <li class="xwk-account-tx" data-status="confirmed">
      <span class="xwk-tx-dot xwk-tx-dot--confirmed" aria-hidden="true"></span>
      <span class="xwk-tx-desc">{description || truncated hash}</span>
      <span class="xwk-tx-time">{timeAgo}</span>
      <a class="xwk-tx-explorer" href="{explorerUrl}" target="_blank"
         rel="noopener" aria-label="View on explorer">
        <!-- external-link SVG 12px -->
      </a>
    </li>

    <!-- failed -->
    <li class="xwk-account-tx" data-status="failed">
      <span class="xwk-tx-dot xwk-tx-dot--failed" aria-hidden="true"></span>
      <span class="xwk-tx-desc">{description || truncated hash}</span>
      <span class="xwk-tx-time">{timeAgo}</span>
    </li>

  </ul>
</div>
```

### CSS (thêm vào renderStyles của button.ts)

```css
/* Separator + container */
.xwk-account-txs {
  border-top: 1px solid ${theme.border};
  margin-top: 6px;
  padding-top: 10px;
}

/* Header */
.xwk-account-txs-header {
  align-items: center;
  display: flex;
  justify-content: space-between;
  margin-bottom: 6px;
  padding: 0 18px;
}

.xwk-account-txs-title {
  color: ${theme.muted};
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.xwk-account-txs-clear {
  background: none;
  border: none;
  color: ${theme.muted};
  cursor: pointer;
  font-size: 11px;
  padding: 2px 4px;
}
.xwk-account-txs-clear:hover { color: ${theme.foreground}; }

/* List */
.xwk-account-txs-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

/* Each transaction row */
.xwk-account-tx {
  align-items: center;
  border-radius: 8px;
  display: flex;
  gap: 8px;
  min-height: 36px;
  padding: 6px 18px;
}
.xwk-account-tx:hover { background: ${theme.surfaceHover}; }

/* Status dot */
.xwk-tx-dot {
  border-radius: 999px;
  flex: 0 0 7px;
  height: 7px;
  width: 7px;
}
.xwk-tx-dot--submitted { background: ${theme.accent}; opacity: 0.7; }
.xwk-tx-dot--confirmed { background: #10b981; }
.xwk-tx-dot--failed    { background: #ef4444; }

/* Spinner for submitted — animated dot */
.xwk-tx-dot--submitted {
  animation: xwk-pulse 1.5s ease-in-out infinite;
}
@keyframes xwk-pulse {
  0%, 100% { opacity: 0.7; }
  50%       { opacity: 1; }
}

/* Description */
.xwk-tx-desc {
  color: ${theme.foreground};
  flex: 1 1 auto;
  font-family: ui-monospace, "Cascadia Code", monospace;
  font-size: 11.5px;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
/* Nếu có description text thì dùng regular font */
.xwk-account-tx[data-has-desc="true"] .xwk-tx-desc {
  font-family: inherit;
  font-size: 12.5px;
}

/* Timestamp */
.xwk-tx-time {
  color: ${theme.muted};
  flex: 0 0 auto;
  font-size: 11px;
  white-space: nowrap;
}

/* Explorer link */
.xwk-tx-explorer {
  color: ${theme.muted};
  display: inline-flex;
  flex: 0 0 auto;
  padding: 2px;
}
.xwk-tx-explorer:hover { color: ${theme.accent}; }
```

### Utility: timeAgo()

```ts
// Thêm helper vào button.ts
private formatTimeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  if (diff < 60_000) return `${Math.round(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.round(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.round(diff / 3_600_000)}h ago`;
  return `${Math.round(diff / 86_400_000)}d ago`;
}
```

### Re-render khi transactions thay đổi

```ts
// Trong WalletButtonController constructor — thêm listener:
this.offEvents.push(options.manager.on("tx_submitted", () => this.render()));
this.offEvents.push(options.manager.on("tx_confirmed", () => this.render()));
this.offEvents.push(options.manager.on("tx_failed",    () => this.render()));
```

---

## Feature 6 — Enhanced Network Badge

### Khái niệm
Mở rộng `renderNetworkBadge()` trong `modal.ts`. Thêm màu-coded dot cho từng network type, và hỗ trợ XRPL EVM Sidechain với badge màu tím riêng. **Không thay đổi class hay layout — chỉ thêm dot và logic màu.**

### Color system

| Network type | `family` | Badge text | Dot color | Badge bg |
|-------------|---------|------------|-----------|---------|
| MAINNET | `xrpl` | Ẩn (không hiện badge) | — | — |
| TESTNET | `xrpl` | TESTNET | `#f59e0b` amber | Hiện tại ✅ |
| DEVNET | `xrpl` | DEVNET | `#38bdf8` sky blue | `#f0f9ff` / `rgba(56,189,248,.1)` |
| bất kỳ | `evm` hoặc có "evm" | XRPL EVM | `#a78bfa` violet | `#f5f3ff` / `rgba(167,139,250,.1)` |
| CUSTOM | bất kỳ | CUSTOM | `${theme.muted}` | `${theme.surface}` |

### Thay đổi renderNetworkBadge() — không thay đổi HTML class, chỉ thêm dot

```ts
private renderNetworkBadge(): string {
  const network = this.getNetwork();
  if (!network || network.networkType === "MAINNET") return '<div class="xwk-network-row"></div>';

  const { dotColor, badgeBg, badgeBorder, textColor, label } = this.resolveNetworkBadgeStyle(network);
  
  // Inline style cho badge — override các token cụ thể mà không tạo class mới
  const badgeStyle = `background:${badgeBg};border-color:${badgeBorder};color:${textColor}`;
  
  const dot = `<span style="background:${dotColor};border-radius:999px;display:inline-block;height:6px;margin-right:5px;width:6px;" aria-hidden="true"></span>`;
  
  return `<div class="xwk-network-row">
    <span class="xwk-network-badge" style="${badgeStyle}">${dot}${this.escapeHtml(label)}</span>
  </div>`;
}

private resolveNetworkBadgeStyle(network: WalletNetwork): NetworkBadgeStyle {
  const dark = this.resolveThemeMode() === "dark";
  const family = network.family ?? "xrpl";
  const isEvm = family === "evm" || network.id.includes("evm");

  if (isEvm) return {
    label:       "XRPL EVM",
    dotColor:    "#a78bfa",
    badgeBg:     dark ? "rgba(167,139,250,.10)" : "#f5f3ff",
    badgeBorder: dark ? "rgba(167,139,250,.20)" : "#ddd6fe",
    textColor:   dark ? "#a78bfa" : "#6d28d9",
  };

  if (network.networkType === "DEVNET") return {
    label:       "DEVNET",
    dotColor:    "#38bdf8",
    badgeBg:     dark ? "rgba(56,189,248,.10)" : "#f0f9ff",
    badgeBorder: dark ? "rgba(56,189,248,.20)" : "#bae6fd",
    textColor:   dark ? "#38bdf8" : "#0369a1",
  };

  if (network.networkType === "TESTNET") return {
    label:       "TESTNET",
    dotColor:    dark ? "#fbbf24" : "#f59e0b",
    badgeBg:     dark ? "rgba(245,158,11,.12)" : "#fef3c7",
    badgeBorder: dark ? "rgba(245,158,11,.20)" : "#fde68a",
    textColor:   dark ? "#fbbf24" : "#92400e",
  };

  // CUSTOM network
  const theme = this.resolveTheme();
  return {
    label:       (network.name ?? "CUSTOM").toUpperCase().slice(0, 10),
    dotColor:    theme.muted,
    badgeBg:     theme.surface,
    badgeBorder: theme.border,
    textColor:   theme.muted,
  };
}
```

---

## CSS Token Reference

Tất cả component trên dùng các token này từ `ResolvedTheme` — không thêm token mới:

| Token | Dùng cho |
|-------|---------|
| `theme.background` | Toast background, modal background |
| `theme.surface` | Card backgrounds, guard address row |
| `theme.surfaceHover` | Tx row hover |
| `theme.foreground` | Titles, primary text |
| `theme.muted` | Secondary text, timestamps, placeholders |
| `theme.border` | Dividers, card borders |
| `theme.accent` | Confirm button, focus ring, pending dot |
| `theme.shadow` | Toast shadow |
| `theme.radius` | Toast corner radius |
| `theme.walletRadius` | Guard address row, action buttons |
| `theme.fontFamily` | Toast root font |

**Semantic colors (cố định, không theo theme):**
- `#10b981` — confirmed (green, passes 4.5:1 on both themes)
- `#ef4444` — failed (red)
- `#f59e0b` / `#fbbf24` — pending/warning amber (light/dark)
- `#38bdf8` — devnet sky blue
- `#a78bfa` — evm violet

---

## Integration Checklist

### Implementation Notes - 2026-05-27
- Enhanced Network Badge: implemented as default behavior in `packages/ui/src/modal.ts`; no `networkBadge` config added. MAINNET remains hidden; TESTNET/DEVNET/EVM/CUSTOM receive styled badges.
- WalletToast: implemented as standalone `packages/ui/src/toast.ts`, exported from UI package and wired into `createWalletKit()` through opt-in `ui.toast`. Supported shapes: `toast: true` for defaults, `toast: false`/omitted for disabled, or `toast: { position, maxVisible, autoDismissMs, explorerUrl }` for advanced control.
- WalletToast explorer links now use `getExplorerTxUrl()` from core. Transaction confirmation is best-effort only: confirmed/failed toasts are emitted when short polling can validate a result, otherwise submitted toasts remain visible with a concise `View` explorer link.
- Modal accessibility cleanup added `aria-labelledby="xwk-title"` to list/connect/QR shells without changing modal frame sizing.
- Deferred by owner request: Transaction Preview panel, Account Activation Guard, Trust Line Warning, and Recent Transactions UI. Do not implement these until explicitly requested.
- Modal sizing guardrail: the implemented items did not change modal width/height/frame, QR card sizing, or modal body sizing.

Mỗi feature cần làm khi implement:

### WalletToast
- [x] Tạo `packages/ui/src/toast.ts`
- [x] Export từ `packages/ui/src/index.ts`
- [x] Add `createWalletToast()` factory function
- [x] Thêm vào `WalletToastOptions` interface vào `types.ts`
- [x] Docs trong `UI_CONFIG_EN.md`

### Transaction Preview
- [ ] Thêm `"preview"` vào `WalletModalView`
- [x] Thêm `transactionPreview?: TransactionPreviewFn` vào `WalletUiConfig`
- [ ] Render preview panel trong modal
- [ ] Thêm `renderPreviewShell()` + `renderPreviewCard()` methods
- [ ] Thêm CSS vào `renderStyles()` — chỉ 2 dòng show/hide
- [ ] Thêm event binding cho `[data-xwk-preview-confirm]` và `[data-xwk-preview-cancel]`
- [ ] Không sửa renderListShell / renderConnectShell / renderQrShell

### Account Activation Guard
- [ ] Thêm `"guard"` vào `WalletModalView`
- [ ] Thêm `showActivationGuard?: boolean`, `activationGuardXrpAmount?: number`, `getXrpUrl?: string` vào `WalletUiConfig`
- [ ] Thêm `renderGuardShell()` method
- [ ] Sửa `handleConnected()` — thêm 3 dòng check activationStatus
- [ ] Thêm CSS show/hide
- [ ] QR render: reuse `renderQrCode()` helper đã có với size nhỏ hơn

### Trust Line Warning
- [ ] Thêm `setTrustLineWarning()` + `clearTrustLineWarning()` public methods vào `WalletModal`
- [ ] Thêm `renderTrustLineBanner()` private method
- [ ] Thêm `clearTrustLineWarning()` call vào `close()`
- [ ] Inject banner output vào đầu `.xwk-body` content trong connect/qr shells
- [ ] Export method types

### Recent Transactions
- [ ] Thêm `showTransactions?: boolean`, `maxTransactions?: number` vào `WalletButtonOptions`
- [ ] Thêm `renderTransactions()` private method vào `WalletButtonController`
- [ ] Thêm `formatTimeAgo()` helper
- [ ] Thêm 3 event listeners (`tx_*`) vào constructor
- [ ] Add `[data-xwk-clear-txs]` handler vào `createRoot()`
- [ ] Thêm CSS vào `renderStyles()` của `button.ts`

### Enhanced Network Badge
- [x] Thêm `resolveNetworkBadgeStyle()` private method
- [x] Sửa `renderNetworkBadge()` — chỉ thêm dot + dynamic style
- [x] Thêm type `NetworkBadgeStyle` (local, không cần export)
- [ ] Test: MAINNET (no badge), TESTNET (amber), DEVNET (blue), EVM (violet), CUSTOM (grey)
