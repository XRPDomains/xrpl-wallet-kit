# Transaction History & Recent Transactions — Feature Spec

**Date:** 2026-06-25
**Status:** DRAFT — awaiting coder assignment
**Inspired by:** [RainbowKit Recent Transactions](https://rainbowkit.com/docs/recent-transactions)
**Scope:** `@xrpl-wallet-kit/core` + `@xrpl-wallet-kit/ui` + optional React/Vue bindings
**Breaking changes:** None — 100% opt-in via new config flags

---

## 1. Executive Summary

XRPL Wallet Kit đã có hạ tầng transaction tracking đầy đủ ở tầng core:
- `WalletTransaction` type với đủ fields
- `manager.addTransaction()` / `manager.getTransactions()` đã hoạt động
- Events `tx_submitted`, `tx_confirmed`, `tx_failed` đã được emit
- Auto-confirmation polling qua `transactionConfirmation` config
- `explorerTxUrl` đã có trên mỗi `WalletNetwork`

**Những gì còn thiếu** là lớp UX phía trên:
1. Persistence (localStorage, scoped theo account + network)
2. UI hiển thị transaction list trong account panel
3. Pending indicator trên button khi có tx đang chờ
4. Config flag để opt-in (`showRecentTransactions`)
5. Adapter cho React/Vue (headless composable/hook)

Tính năng này được thiết kế **hoàn toàn additive** — app không opt-in thì không bị ảnh hưởng gì.

---

## 2. So sánh với RainbowKit

| Khía cạnh | RainbowKit | XRPL Wallet Kit (proposed) |
|---|---|---|
| Framework | React-only | Framework-agnostic core, bindings optional |
| Đăng ký tx | Thủ công via `useAddRecentTransaction()` hook | **Tự động** từ `signAndSubmit` + thủ công qua `manager.addTransaction()` |
| Confirmation | Số block tùy chỉnh | Polling XRPL node (đã có `transactionConfirmation` config) |
| Storage | localStorage (thủ công) | localStorage **tự động**, scoped by `account + network` |
| Pending indicator | Loading ring quanh avatar | Dot badge màu accent trên button (không cần avatar) |
| Explorer link | Không tích hợp | Tự động từ `network.explorerTxUrl` |
| Max entries | Không có cap | Cấu hình qua `maxRecentTransactions` (default 10) |
| Reset on disconnect | Giữ nguyên | Giữ nguyên (scoped by account address) |
| Headless API | Không | Có — app dùng events để tự build UI |

**Ưu điểm cốt lõi so với RainbowKit:**
- Không cần developer tự gọi `addTransaction` — kit tự bắt từ `signAndSubmit`
- XRPL native: link trực tiếp đến `livenet.xrpl.org/transactions/{hash}`
- Works in plain HTML / jQuery (vì storage + events là vanilla)

---

## 3. Hạ tầng hiện có (KHÔNG cần viết lại)

```
packages/core/src/types.ts
  ✅ WalletTransaction { hash, status, description, submittedAt, confirmedAt, failedAt, metadata, result, error }
  ✅ AddWalletTransactionRequest
  ✅ WalletTransactionStatus = "submitted" | "confirmed" | "failed"
  ✅ WalletManagerEvents: tx_submitted, tx_confirmed, tx_failed

packages/core/src/manager.ts
  ✅ private transactions = new Map<string, WalletTransaction>()
  ✅ addTransaction(request): WalletTransaction
  ✅ getTransactions(): WalletTransaction[]
  ✅ transactionConfirmation: { enabled, attempts, intervalMs, timeoutMs }
  ✅ Auto-confirm sau signAndSubmit

packages/core/src/networks.ts
  ✅ network.explorerTxUrl = "https://livenet.xrpl.org/transactions/{hash}"
  ✅ getExplorerTxUrl(hash, network): string | undefined

packages/ui/src/button.ts
  ✅ Đã lắng nghe tx_submitted → scheduleBalanceRefresh
  ✅ Đã lắng nghe tx_confirmed → resolveBalance
  ✅ Account panel đã có renderPanelContent()
```

---

## 4. Phạm vi tính năng (cần build)

### Phase 1 — Core persistence layer (core package)

**`WalletTransactionStore`** — class mới trong `packages/core/src/`:

```ts
// packages/core/src/tx-store.ts

export interface WalletTransactionStoreOptions {
  /** Số tx tối đa lưu mỗi account. Default: 10 */
  max?: number;
  /** Custom storage backend. Default: localStorage */
  storage?: WalletStorage;
}

export class WalletTransactionStore {
  constructor(options?: WalletTransactionStoreOptions);

  /** Lưu một tx cho account+network hiện tại */
  add(tx: WalletTransaction, accountAddress: string, networkId: string): void;

  /** Cập nhật status của một tx đã lưu */
  update(hash: string, patch: Partial<WalletTransaction>, accountAddress: string, networkId: string): void;

  /** Lấy danh sách tx của account+network, sắp xếp mới nhất trước */
  get(accountAddress: string, networkId: string): WalletTransaction[];

  /** Xóa toàn bộ tx của một account */
  clear(accountAddress: string, networkId?: string): void;
}
```

Storage key format: `xwk_tx:{networkId}:{address}` (ví dụ: `xwk_tx:mainnet:rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh`)

Mỗi entry là JSON array tối đa `max` phần tử, serialize/deserialize toàn bộ.

**Lý do đặt trong core** (không phải ui): App headless muốn persistence mà không cần UI cũng dùng được.

---

### Phase 2 — WalletManager integration (core package)

Thêm vào `WalletManagerConfig`:

```ts
interface WalletManagerConfig {
  // ... existing fields ...

  /**
   * Bật persistence cho recent transactions vào localStorage.
   * Khi bật, addTransaction() sẽ tự động persist và load lại sau khi reload.
   * Default: false
   */
  persistTransactions?: boolean | {
    max?: number;     // Default: 10
    storage?: WalletStorage;
  };
}
```

Khi `persistTransactions` được bật, `WalletManager`:
1. On `connect`: Load transactions từ store cho account hiện tại vào `this.transactions`
2. On `addTransaction()`: Sau khi cập nhật in-memory map, ghi vào store
3. On `disconnect`: Không xóa store (tx lịch sử vẫn giữ)

---

### Phase 3 — UI: Transaction list trong account panel (ui package)

Thêm vào `WalletButtonOptions` và `WalletUiOptions`:

```ts
interface WalletUiOptions {
  // ... existing fields ...

  /**
   * Bật hiển thị recent transactions trong account panel.
   * Yêu cầu manager.persistTransactions hoặc tự push tx qua manager.addTransaction().
   * Default: false
   */
  showRecentTransactions?: boolean;

  /**
   * Tuỳ chỉnh URL explorer cho mỗi tx hash.
   * Nếu không set, dùng network.explorerTxUrl.
   * @param hash - TX hash
   * @param network - Network hiện tại
   */
  transactionExplorerUrl?: (hash: string, network?: WalletNetwork) => string | undefined;

  /**
   * Số tx tối đa hiển thị trong panel. Default: 5
   */
  maxVisibleTransactions?: number;
}
```

**UI Layout** trong `renderPanelContent()`:

```
┌─────────────────────────────────────────┐
│  [Avatar / Art]                         │
│  rHb9CJ...yTh          [Copy] [QR]      │
│  1,234.56 XRP                           │
├─────────────────────────────────────────┤
│  Recent Transactions                    │  ← section header (chỉ hiện khi có tx)
│  ┌────────────────────────────────────┐ │
│  │ ✓  Payment           0.001s ago   │ │  ← confirmed (success color)
│  │    rDest...ABC  •  0.5 XRP    [↗] │ │
│  ├────────────────────────────────────┤ │
│  │ ⟳  NFT Offer          pending     │ │  ← submitted (spinner)
│  │    rDest...ABC              [↗]   │ │
│  ├────────────────────────────────────┤ │
│  │ ✕  Escrow Finish     2 min ago    │ │  ← failed (error color)
│  │    Unknown error            [↗]   │ │
│  └────────────────────────────────────┘ │
├─────────────────────────────────────────┤
│  [View full history on XRPL Explorer]   │  ← link to account explorer
│  [Copy address]  [Explorer]  [Disconnect]│
└─────────────────────────────────────────┘
```

**Chi tiết từng row:**

```
[status-icon]  [description]           [relative-time]   [explorer-link ↗]
               [hash-short] • [amount-or-type]
```

- `status-icon`: `✓` (confirmed, `theme.success`), `⟳` (spinner animate, `theme.accent`), `✕` (failed, `theme.error`)
- `description`: `tx.description` nếu có, fallback `tx.metadata.type` nếu có, fallback `"Transaction"`
- `relative-time`: `"just now"`, `"2 min ago"`, `"1 hr ago"`, `"yesterday"` — i18n-ready
- `explorer-link`: icon `↗` mở `explorerTxUrl` trong tab mới; ẩn nếu hash chưa biết
- `hash-short`: `rHb9...yTh` — 6 chars đầu + `...` + 3 chars cuối của hash
- `amount`: từ `tx.metadata.amount` nếu app set, optional

**Empty state** (đã bật `showRecentTransactions` nhưng chưa có tx):
```
  No recent transactions
```
→ Text nhỏ, màu `theme.muted`, không chiếm nhiều space.

**Placement:** Section nằm giữa balance/address block và actions block, chiều cao co giãn với scroll riêng nếu nhiều hơn `maxVisibleTransactions` (max-height + `overflow-y: auto`).

---

### Phase 4 — Pending indicator trên WalletButton (ui package)

Khi có ít nhất 1 tx đang ở trạng thái `"submitted"`, button hiển thị dấu hiệu pending:

**Option A — Dot badge (recommended):**
```
┌──────────────────────────────────┐
│ [icon●] rHb9...  1,234 XRP   ⌄  │
│        ↑ dot màu accent, blinking│
└──────────────────────────────────┘
```
Dot `●` size 6×6px, `border-radius: 999px`, màu `theme.accent`, animation `pulse` (opacity 1 → 0.3 → 1), positioned `absolute` top-right của wallet icon.

**Option B — Spinner ring:** Thay border của icon bằng dashed/animated ring (phức tạp hơn với CSS animation, khó đồng bộ với custom radius).

**Recommendation: Option A** (dot badge) vì:
- Simpler DOM
- Không conflict với icon border
- Recognizable pattern (giống notification dot)
- Works with bất kỳ icon shape

```ts
// button.ts internal state
private pendingTxCount = 0;

// Listen to events:
manager.on("tx_submitted", () => { this.pendingTxCount++; this.render(); });
manager.on("tx_confirmed", () => { this.pendingTxCount = Math.max(0, this.pendingTxCount - 1); this.render(); });
manager.on("tx_failed", () => { this.pendingTxCount = Math.max(0, this.pendingTxCount - 1); this.render(); });
```

Dot chỉ hiện khi `this.pendingTxCount > 0 && options.showRecentTransactions`.

---

### Phase 5 — i18n (ui package)

Thêm vào `WalletUiMessages` / `DEFAULT_MESSAGES`:

```ts
interface WalletUiMessages {
  // ... existing ...
  recentTransactions?: string;      // "Recent Transactions"
  noRecentTransactions?: string;    // "No recent transactions"
  txStatusPending?: string;         // "Pending"
  txStatusConfirmed?: string;       // "Confirmed"
  txStatusFailed?: string;          // "Failed"
  txJustNow?: string;               // "just now"
  txMinutesAgo?: string;            // "{n} min ago"
  txHoursAgo?: string;              // "{n} hr ago"
  txYesterday?: string;             // "yesterday"
  txDefaultDescription?: string;    // "Transaction"
}
```

---

### Phase 6 — Headless bindings (optional, separate packages)

#### React hook

```ts
// @xrpl-wallet-kit/react (future)

/**
 * Returns recent transactions for the current wallet session.
 * Re-renders automatically on tx_submitted / tx_confirmed / tx_failed.
 */
export function useRecentTransactions(manager: WalletManager): WalletTransaction[];

/**
 * Returns a function to manually register a transaction.
 * Equivalent to manager.addTransaction() but returns void.
 */
export function useAddRecentTransaction(manager: WalletManager): (req: AddWalletTransactionRequest) => void;

/**
 * Returns true if any transaction is in "submitted" state.
 */
export function useHasPendingTransactions(manager: WalletManager): boolean;
```

Implementations đơn giản: subscribe to events trong `useEffect`, store trong `useState`.

#### Vue composable

```ts
// @xrpl-wallet-kit/vue (future)

export function useRecentTransactions(manager: WalletManager): Readonly<Ref<WalletTransaction[]>>;
export function useAddRecentTransaction(manager: WalletManager): (req: AddWalletTransactionRequest) => void;
export function useHasPendingTransactions(manager: WalletManager): Readonly<Ref<boolean>>;
```

---

## 5. Visual Design Reference (từ mockup)

> Mockup interactive đã được duyệt — các thông số dưới đây là **design ground truth** để implement.

### 5.1 Account panel layout

Thứ tự các block trong `renderPanelContent()` (flex column, `align-items: center`, `gap: 9px`):

```
[avatar art]        — 72×72px, circle, surface bg + border
[address chip]      — surface bg, border-radius 11px, font-size 12px, muted color
[balance chip]      — surface bg, border-radius 999px (pill), height 36px, font-size 12px
[tx section]        ← MỚI — chiếm full width, margin-top: 2px
[actions block]     — existing, full width
```

**Tx section không được thêm margin-top riêng** — gap của flex container (`9px`) tự xử lý khoảng cách.

---

### 5.2 Transaction section header + collapse toggle

Header là một hàng `flex`, chứa label, optional count badge, và **toggle button** (chevron) bên phải:

```
[RECENT TRANSACTIONS]  [3]  ──────────  [⌄]
```

```css
.xwk-tx-header {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  color: theme.muted;
  margin-bottom: 5px;           /* chỉ khi expanded */
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;              /* toàn bộ header là hit target */
  user-select: none;
}
.xwk-tx-header:hover { opacity: 0.8; }

/* Count badge — hiện khi collapsed để user thấy có bao nhiêu tx */
.xwk-tx-count {
  font-size: 10px;
  font-weight: 600;
  background: theme.surface;
  border: 1px solid theme.border;
  border-radius: 999px;
  padding: 0 5px;
  line-height: 16px;
  color: theme.muted;
}

/* Chevron toggle */
.xwk-tx-chevron {
  margin-left: auto;
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: theme.muted;
  transition: transform 0.18s ease;
  flex-shrink: 0;
}
/* expanded state — chevron pointing down */
.xwk-tx-chevron.open  { transform: rotate(0deg); }
/* collapsed state — chevron pointing right */
.xwk-tx-chevron.closed { transform: rotate(-90deg); }
```

**Internal state:**

```ts
// packages/ui/src/button.ts
private txSectionOpen = true;   // default: expanded
```

**HTML rendered:**

```ts
private renderTxSection(txs: WalletTransaction[], theme: WalletUiTheme, messages: WalletUiMessages): string {
  const count = txs.length;
  const isOpen = this.txSectionOpen;
  const chevronState = isOpen ? "open" : "closed";

  // Chevron SVG (inline, 10×10 — nhỏ gọn, không dùng icon font để tránh flash)
  const chevron = `<svg class="xwk-tx-chevron ${chevronState}" viewBox="0 0 10 10" width="10" height="10" aria-hidden="true">
    <polyline points="2,3 5,7 8,3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;

  const header = `<div class="xwk-tx-header" role="button" aria-expanded="${isOpen}" data-xwk-tx-toggle tabindex="0">
    ${this.escapeHtml(messages.recentTransactions ?? "Recent Transactions")}
    ${count > 0 ? `<span class="xwk-tx-count">${count}</span>` : ""}
    ${chevron}
  </div>`;

  const body = isOpen ? this.renderTxList(txs, theme, messages) : "";

  return `<div class="xwk-tx-section">${header}${body}</div>`;
}
```

**Event handling** — thêm vào vòng lặp xử lý click trong `button.ts`:

```ts
if (target.closest("[data-xwk-tx-toggle]")) {
  this.txSectionOpen = !this.txSectionOpen;
  this.render();
  return;
}
```

Keyboard: `keydown` trên `[data-xwk-tx-toggle]` với `Enter` hoặc `Space` → toggle (ARIA role="button" + tabindex="0" đã đủ).

**Collapsed state** — header không có `margin-bottom` (set `margin-bottom: 0` khi closed):

```ts
// Trong generateStyles():
`.xwk-tx-header { margin-bottom: ${this.txSectionOpen ? "5px" : "0"}; }`
// Hoặc đơn giản hơn: luôn để margin-bottom: 0, body list tự có padding-top
```

---

### 5.3 Transaction list container

```css
.xwk-tx-list {
  border: 1px solid theme.border;
  border-radius: theme.walletRadius;      /* 10px default */
  max-height: 210px;                      /* ~5 rows × 42px — scroll sau đó */
  overflow-y: auto;
  overflow-x: hidden;
  -webkit-overflow-scrolling: touch;      /* smooth scroll iOS */
}

/* Scrollbar nhỏ gọn — không chiếm layout space */
.xwk-tx-list::-webkit-scrollbar       { width: 4px; }
.xwk-tx-list::-webkit-scrollbar-track { background: transparent; }
.xwk-tx-list::-webkit-scrollbar-thumb { background: theme.border; border-radius: 2px; }
```

Rows xếp thẳng, dùng `border-bottom: 1px solid theme.border` để ngăn cách, row cuối `border-bottom: none`.

**Tính max-height:** Row height ≈ 42px (padding 8px top+bottom + 2 dòng text ≈ 26px). 5 rows × 42px = 210px. Nếu `maxVisibleTransactions` cấu hình được, coder có thể tính động: `maxRows * 42 + 2` (border).

**Height jump:** Panel sẽ thay đổi chiều cao khi collapse/expand section. Đây là trade-off chấp nhận được — QR code view ít dùng, và height jump nhỏ (~210px) không gây mất orientation cho user.

---

### 5.4 Transaction row layout

```css
.xwk-tx-row {
  background: theme.surface;
  padding: 8px 10px;
  display: grid;
  grid-template-columns: 24px 1fr auto;
  align-items: start;
  gap: 7px;
  border-bottom: 1px solid theme.border;
}
.xwk-tx-row:last-child { border-bottom: none; }
.xwk-tx-row:hover { background: theme.surfaceHover; }
```

**Cột 1 — Status icon** (24×24px circle):

| Status | CSS class | Background | Icon color |
|---|---|---|---|
| `confirmed` | `.xwk-tx-icon.ok` | `rgba(theme.success, 0.07)` | `theme.success` |
| `submitted` | `.xwk-tx-icon.wt` | `rgba(theme.accent, 0.08)` | `theme.accent` |
| `failed` | `.xwk-tx-icon.fl` | `rgba(theme.error, 0.07)` | `theme.error` |

Triển khai với CSS variables scoped để dark mode hoạt động:
```css
/* Trong generateStyles(theme): */
--xwk-tx-sb: ${hexToRgba(theme.success, 0.07)};
--xwk-tx-ab: ${hexToRgba(theme.accent, 0.08)};
--xwk-tx-eb: ${hexToRgba(theme.error, 0.07)};
```

Icons (Tabler outline, font-size 11px):
- `confirmed` → `ti-check`
- `submitted` → `ti-refresh` + `animation: xwk-tx-spin 0.75s linear infinite`
- `failed` → `ti-x`

**Cột 2 — Nội dung tx**:
```css
.xwk-tx-desc { font-size: 12px; font-weight: 560; color: theme.foreground; line-height: 1.2; }
.xwk-tx-meta { font-size: 10px; color: theme.muted; margin-top: 1px; }
```

`tx.description` là primary. Fallback priority: `tx.metadata?.type ?? "Transaction"`.
`tx.meta` line: `tx.metadata?.destination ? shortAddr(dest) + " · " + amount : shortHash(tx.hash)`.

**Cột 3 — Right side** (flex column, align-items: flex-end, gap: 2px):
```
[time OR "pending" badge]
[explorer link icon ↗]
```

- Thời gian: font-size 10px, muted color, `relativeTime(tx.confirmedAt ?? tx.submittedAt)`
- "pending" text: font-size 10px, **accent color** (không dùng badge, chỉ text)
- Explorer link: icon `ti-external-link` 11px, muted → accent on hover, `aria-label="View on XRPL Explorer"`, `target="_blank" rel="noopener"`
- Explorer link chỉ render khi `tx.hash` có giá trị

---

### 5.5 Empty state

```css
.xwk-tx-empty {
  text-align: center;
  padding: 13px;
  font-size: 12px;
  color: theme.muted;
  background: theme.surface;
  border-radius: theme.walletRadius;
  border: 1px solid theme.border;
}
```

Text: i18n key `messages.noRecentTransactions` → default `"No recent transactions"`.

**Khi `showRecentTransactions: true` nhưng chưa có tx**: hiện empty state (không ẩn section hoàn toàn). Điều này giúp user biết tính năng đang bật.

---

### 5.6 Pending dot trên WalletButton

```css
/* Wrapper icon đã có position: relative */
.xwk-pending-dot {
  position: absolute;
  top: -2px;
  right: -2px;
  width: 7px;
  height: 7px;
  border-radius: 999px;
  background: theme.accent;
  border: 2px solid theme.surface;   /* tạo gap giữa dot và icon */
  animation: xwk-tx-pulse 1.5s ease-in-out infinite;
}

@keyframes xwk-tx-pulse {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.2; }
}
```

Dot render ở HTML của `.xwk-button-icon` (wrapper wallet icon), chỉ khi:
```ts
this.pendingTxCount > 0 && this.options.showRecentTransactions === true
```

`border: 2px solid theme.surface` — dùng `theme.surface` (không phải `theme.background`) vì button dùng surface bg.

---

### 5.7 Keyframes cần thêm vào `button.ts`

```css
@keyframes xwk-tx-spin  { to { transform: rotate(360deg); } }
@keyframes xwk-tx-pulse { 0%,100% { opacity:1; } 50% { opacity:.2; } }
```

Đặt cùng với `@keyframes xwk-action-spin` hiện có trong `button.ts`. Không đặt trong `modal.ts` (modal không dùng feature này).

---

### 5.8 Relative time formatter

```ts
// packages/ui/src/utils.ts — thêm hàm mới

export function formatRelativeTime(timestamp: number, messages: WalletUiMessages): string {
  const diff = Date.now() - timestamp;
  const sec = Math.floor(diff / 1000);
  const min = Math.floor(sec / 60);
  const hr  = Math.floor(min / 60);

  if (sec < 30)  return messages.txJustNow   ?? "just now";
  if (min < 60)  return (messages.txMinutesAgo ?? "{n} min ago").replace("{n}", String(min));
  if (hr  < 24)  return (messages.txHoursAgo   ?? "{n} hr ago").replace("{n}", String(hr));
  return messages.txYesterday ?? "yesterday";
}
```

---

### 5.9 Theme compatibility — đảm bảo đúng với tất cả presets

**Nguyên tắc cốt lõi:** Feature này không hardcode bất kỳ màu nào. Toàn bộ color đi qua `theme.*` tokens được resolve bởi `resolveWalletTheme()` — cùng pipeline với phần còn lại của `button.ts`.

**Màu nào dùng từ token nào:**

| Element | Token | Lý do |
|---|---|---|
| Icon circle bg (confirmed) | `theme.success` + 7% opacity | Match success color của preset |
| Icon circle bg (submitted) | `theme.accent` + 8% opacity | Match accent của preset |
| Icon circle bg (failed) | `theme.error` + 7% opacity | Match error của preset |
| Icon foreground | `theme.success/accent/error` | Same |
| TX row background | `theme.surface` | Consistent với wallet cards |
| TX row hover | `theme.surfaceHover` | Consistent |
| TX list border | `theme.border` | Consistent |
| "pending" text | `theme.accent` | Consistent với accent usage |
| Timestamp text | `theme.muted` | Consistent |
| TX description | `theme.foreground` | Readable on any bg |
| Explorer link | `theme.muted` → `theme.accent` on hover | Standard link pattern |
| Section header text | `theme.muted` | Label convention |
| Chevron | `theme.muted` | Label convention |
| Count badge bg | `theme.surface` | Subtle, non-intrusive |
| Count badge border | `theme.border` | Consistent |
| Pending dot | `theme.accent` | Attention color |
| Pending dot border | `theme.surface` | Separation from icon |
| Empty state bg | `theme.surface` | Consistent |

**Vấn đề `rgba()` từ hex:**

`theme.success` là hex string (e.g. `#059669`). CSS không thể làm `rgba(#059669, 0.07)`. Cần helper:

```ts
// packages/ui/src/utils.ts
export function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
```

Dùng trong `generateStyles(theme)`:

```ts
const txSucBg = hexToRgba(theme.success, 0.07);
const txAccBg = hexToRgba(theme.accent,  0.08);
const txErrBg = hexToRgba(theme.error,   0.07);
// Sau đó inject vào CSS template string:
`.xwk-tx-icon.ok   { background: ${txSucBg}; color: ${theme.success}; }`
`.xwk-tx-icon.wait { background: ${txAccBg}; color: ${theme.accent};  }`
`.xwk-tx-icon.fail { background: ${txErrBg}; color: ${theme.error};   }`
```

**Xác nhận từng preset:**

| `themeName` | accent | success | error | Ghi chú |
|---|---|---|---|---|
| `default/light` | `#0078ae` | `#059669` | `#b45309` | baseline |
| `dark` | `#4aa3ff` | `#34d399` | `#fbbf24` | tự động qua darkTheme |
| `xrpl` | `#00a9d4` | `#059669` | `#b45309` | XRPL brand — OK |
| `minimal` | `#0078ae` | `#059669` | `#b45309` | flat, no shadow — OK |
| `midnight` | `#60a5fa` | `#34d399` | `#fb923c` | deep dark — icon bg sẽ subtle trên dark surface |
| `glass` | `#60a5fa` | `#34d399` | `#fb923c` | semi-transparent bg — cần verify icon bg đủ contrast |
| `rounded` | `#0284c7` | `#059669` | `#b45309` | rounded radius — OK |
| `crisp` | `#1e293b` | `#059669` | `#b45309` | dark accent — pending dot và icon OK |
| `soft` | `#6366f1` | `#059669` | `#b45309` | pastel — icon bg subtle, đẹp |

Không có preset nào cần special-case. `glass` cần manual QA vì `theme.surface` có thể gần transparent — icon circle bg (7% opacity trên transparent surface) có thể không đủ contrast. Nếu cần, `glass` theme nên set `surface` đủ đặc để icon readable.

**Không thêm CSS `@media (prefers-color-scheme: dark)` mới.** Dark mode handling hoàn toàn qua `resolveWalletTheme()` → `themeMode` → token resolution. Feature không cần quan tâm đến OS dark mode trực tiếp.

---

## 6. Vị trí đặt feature trong codebase

```
packages/
  core/
    src/
      tx-store.ts          ← MỚI: WalletTransactionStore class
      manager.ts           ← SỬA: thêm persistTransactions config, wire tx-store
      types.ts             ← SỬA: thêm persistTransactions vào WalletManagerConfig
  ui/
    src/
      button.ts            ← SỬA: thêm showRecentTransactions, pendingTxCount, renderTxList()
      types.ts             ← SỬA: thêm WalletUiOptions fields mới
      messages.ts          ← SỬA: thêm tx-related message keys
website/
  docs/
    advanced/
      transaction-history.md  ← MỚI: trang docs
    api/
      wallet-manager.md    ← CẬP NHẬT: thêm persistTransactions vào API table
```

Không đụng đến:
- `modal.ts` (Connect Wallet modal, không liên quan)
- `adapters/*` (adapter layer không biết về UI state)
- `browser/` (IIFE bundle tự pick up qua client package)

---

## 7. TypeScript Interface đầy đủ

### Thêm vào `WalletManagerConfig`

```ts
export interface WalletManagerConfig {
  // ... existing ...

  /**
   * Persist recent transactions to localStorage, keyed by account address + network.
   * When enabled, getTransactions() rehydrates from storage after page reload.
   *
   * Pass `true` for defaults, or an object to customize.
   *
   * Default: false (in-memory only)
   */
  persistTransactions?: boolean | {
    /** Max transactions stored per account per network. Default: 10 */
    max?: number;
    /** Override storage backend (default: window.localStorage). */
    storage?: WalletStorage;
  };
}
```

### Thêm vào `WalletUiOptions`

```ts
export interface WalletUiOptions {
  // ... existing ...

  /**
   * Show recent transactions section in the account panel.
   * Also shows a pending dot on WalletButton when any tx is in "submitted" state.
   *
   * Transactions are sourced from manager.getTransactions().
   * Enable manager.persistTransactions to survive page reloads.
   *
   * Default: false
   */
  showRecentTransactions?: boolean;

  /**
   * Max number of transactions to show in the panel. Default: 5
   */
  maxVisibleTransactions?: number;

  /**
   * Override the block explorer URL for transaction links.
   * Defaults to network.explorerTxUrl.
   */
  transactionExplorerUrl?: (hash: string, network?: WalletNetwork) => string | undefined;
}
```

### Thêm vào `WalletButtonOptions`

```ts
export interface WalletButtonOptions {
  // ... existing ...
  showRecentTransactions?: boolean;
  maxVisibleTransactions?: number;
  transactionExplorerUrl?: (hash: string, network?: WalletNetwork) => string | undefined;
}
```

---

## 8. Usage Examples

### Minimal opt-in

```ts
import { WalletManager } from "@xrpl-wallet-kit/core";
import { WalletButton } from "@xrpl-wallet-kit/ui";

const manager = new WalletManager({
  adapters: [...],
  networks: [XRPL_MAINNET],
  persistTransactions: true,  // ← persist to localStorage
});

const button = new WalletButton({
  manager,
  mount: "#wallet",
  showRecentTransactions: true, // ← show in panel + pending dot
});
```

### Tự đăng ký transaction sau khi sign

```ts
// App tự call signTransaction rồi submit
const result = await manager.signTransaction({ txJson: myTx });
const submitResult = await xrplClient.submit(result.txBlob);

// Đăng ký với kit
manager.addTransaction({
  hash: submitResult.result.tx_json.hash,
  description: "Payment to Bob",
  metadata: {
    amount: "10",
    currency: "XRP",
    destination: "rBob..."
  }
});
// Kit sẽ tự poll confirmation và emit tx_confirmed khi xong
```

### createWalletKit (all-in-one)

```ts
const kit = createWalletKit({
  adapters: [...],
  networks: [XRPL_MAINNET],
  persistTransactions: { max: 15 },
  ui: {
    themeName: "midnight",
    showRecentTransactions: true,
    maxVisibleTransactions: 5,
    transactionExplorerUrl: (hash) =>
      `https://bithomp.com/explorer/${hash}`,
  },
});
```

### React hook (Phase 6)

```tsx
function MyDApp() {
  const { manager } = useWalletKit();
  const txs = useRecentTransactions(manager);
  const hasPending = useHasPendingTransactions(manager);

  return (
    <div>
      {hasPending && <LoadingSpinner />}
      <ul>
        {txs.map(tx => (
          <li key={tx.hash} style={{ color: tx.status === "confirmed" ? "green" : "red" }}>
            {tx.description ?? tx.hash.slice(0, 8)} — {tx.status}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

### Headless (không dùng UI package)

```ts
// App tự build UI, chỉ dùng core events
manager.on("tx_submitted", ({ transaction }) => {
  myApp.showTxPending(transaction.hash, transaction.description);
});
manager.on("tx_confirmed", ({ hash }) => {
  myApp.markTxConfirmed(hash);
});
manager.on("tx_failed", ({ hash, error }) => {
  myApp.markTxFailed(hash, error);
});
```

---

## 9. Storage Strategy

### Key schema

```
localStorage key: "xwk_tx:{networkId}:{address}"
value: JSON string of WalletTransaction[]
```

Ví dụ: `"xwk_tx:mainnet:rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh"`

### Rotation

- Max `N` entries (default 10) — khi thêm tx mới vượt max, xóa entry cũ nhất (`submittedAt` nhỏ nhất)
- Chỉ persist `"confirmed"` và `"failed"` (tx `"submitted"` đang chạy có thể mất nếu trang reload — dự định: reload → rehydrate + mark stale submitted as `failed` nếu quá `staleTxTimeoutMs`)

### Stale tx handling khi reload

Khi load từ storage, nếu một tx có `status: "submitted"` và `submittedAt < Date.now() - staleTxTimeoutMs` (default 10 phút), tự động đánh dấu `failed` với `error: "Timed out — page was reloaded"`. Không emit event `tx_failed` để tránh confusion.

### Privacy note cho docs

Transactions được lưu ở client-side (localStorage), chỉ có hash và metadata do app cung cấp. Không có private key hay tx content được lưu.

---

## 10. Phân tích Ưu / Nhược điểm

### Ưu điểm

**Developer experience:**
- Zero config cho happy path: `persistTransactions: true` + `showRecentTransactions: true` là xong
- Không cần tự gọi `addTransaction` sau `signAndSubmit` — kit tự bắt
- API `manager.addTransaction()` đã stable, không thay đổi
- Works với mọi framework vì event-based core

**User experience:**
- Người dùng thấy ngay lịch sử giao dịch trong account panel, không cần mở block explorer
- Pending dot trên button giúp biết giao dịch đang chờ confirm
- Tự động link đến XRPL Explorer (hoặc Bithomp tùy config)
- Lịch sử tồn tại qua refresh (với `persistTransactions`)

**Architecture:**
- 100% additive — zero impact cho app không opt-in
- Không thêm dependency mới
- Reuse event system hiện có (`tx_submitted/confirmed/failed`)
- Reuse `explorerTxUrl` từ network config
- Core persistence layer (`tx-store.ts`) usable headless

### Nhược điểm / Đánh đổi

**1. localStorage coupling**

*Vấn đề:* `WalletTransactionStore` mặc định dùng `localStorage` — không tồn tại trong SSR (Next.js server side), Web Workers, hay môi trường không có `window`.

*Mitigations:*
- Wrap trong `try/catch`, graceful degrade về in-memory nếu storage không available
- SSR-safe: chỉ khởi tạo store ở client (đã có pattern tương tự trong `session-storage.ts`)
- Doc rõ: persistent chỉ hoạt động ở browser

**2. Tx list trong panel tăng chiều cao**

*Vấn đề:* Nếu hiển thị 5 tx + actions, panel có thể quá dài trên mobile.

*Mitigations:*
- `max-height` + `overflow-y: auto` cho tx section (scroll riêng)
- `maxVisibleTransactions` default = 5, có thể giảm xuống 3 nếu mode dropdown
- Empty state không chiếm nhiều space

**3. Stale "submitted" tx sau reload**

*Vấn đề:* Nếu app reload giữa chừng khi tx đang chờ confirm, tx bị mark failed dù thực ra có thể đã confirm.

*Mitigations:*
- Sau khi rehydrate, kit có thể ping `transactionConfirmation` flow cho các submitted tx → tự update status (cần implement)
- Hoặc hiển thị `"unknown"` status thay vì `failed` cho stale tx
- **Chọn Phase 1b:** rehydrate → resume confirmation polling cho tx vẫn trong `"submitted"` state (phức tạp hơn nhưng UX tốt hơn)

**4. Hash không có cho signTransaction (sign-only)**

*Vấn đề:* `signTransaction` không submit → không có `hash`. App phải tự submit rồi gọi `addTransaction(hash)`.

*Giải pháp:* Document rõ. `signAndSubmit` path tự động có hash. `signTransaction` path cần manual registration — tương tự RainbowKit.

**5. Phase 6 (React/Vue bindings) phụ thuộc package framework**

*Vấn đề:* React và Vue hooks thuộc separate packages, cần release cycle riêng.

*Mitigations:*
- Phase 1-4 (core + UI) có thể ship độc lập, hoàn toàn functional
- Developer dùng React có thể tự viết hook đơn giản dựa trên events (20 lines) trước khi có official package
- Phase 6 là "nice to have", không block Phase 1-4

---

## 11. Implementation Phases & Effort Estimate

### Phase 1 — Core persistence (3-4 ngày)

| Task | File | Effort |
|---|---|---|
| Viết `WalletTransactionStore` | `packages/core/src/tx-store.ts` | 1 ngày |
| Wire vào `WalletManager` | `packages/core/src/manager.ts` | 0.5 ngày |
| Thêm `persistTransactions` vào `WalletManagerConfig` | `packages/core/src/types.ts` | 0.5 ngày |
| Unit tests | `tests/tx-store.test.ts` | 1 ngày |
| Export từ `packages/core/src/index.ts` | - | 0.25 ngày |

**Deliverable:** `manager.persistTransactions = true` → tx tồn tại qua reload. No UI change.

### Phase 2 — UI: Transaction list (3-4 ngày)

| Task | File | Effort |
|---|---|---|
| Thêm `showRecentTransactions` vào `WalletUiOptions` | `packages/ui/src/types.ts` | 0.25 ngày |
| `renderTxList()` trong account panel | `packages/ui/src/button.ts` | 1.5 ngày |
| CSS cho tx rows | `packages/ui/src/button.ts` (styles) | 0.5 ngày |
| i18n message keys | `packages/ui/src/messages.ts` | 0.5 ngày |
| Relative time formatter | `packages/ui/src/utils.ts` | 0.5 ngày |
| Tests (UI style assertions) | `tests/ui-button-tx.test.ts` | 0.75 ngày |

**Deliverable:** Tx list hiển thị trong account panel.

### Phase 3 — Pending dot indicator (1 ngày)

| Task | File | Effort |
|---|---|---|
| `pendingTxCount` state + event listeners | `packages/ui/src/button.ts` | 0.5 ngày |
| CSS dot badge animation | `packages/ui/src/button.ts` (styles) | 0.25 ngày |
| Test | `tests/` | 0.25 ngày |

**Deliverable:** Dot xuất hiện khi có tx pending, biến mất khi confirm/fail.

### Phase 4 — docs (1 ngày)

| Task | File | Effort |
|---|---|---|
| Trang docs | `website/docs/advanced/transaction-history.md` | 0.75 ngày |
| Cập nhật sidebar | `website/.vitepress/config.ts` | 0.1 ngày |
| Cập nhật API Reference | `website/docs/api/wallet-manager.md` | 0.15 ngày |

### Phase 5 — React/Vue hooks (2-3 ngày, future sprint)

Tách sang sprint riêng, không block Phase 1-4.

**Tổng Phase 1-4: ~8-10 ngày dev**

---

## 12. Open Questions — RESOLVED

**Q1: Auto-capture từ `signAndSubmit`?**
→ ✅ **RESOLVED.** `manager.ts:375` đã tự gọi `addTransaction` sau `signAndSubmit`. Không cần thêm logic.

**Q2: `description` và `amount` lấy từ đâu?**
→ ✅ **RESOLVED.** Kit không parse `txJson`. App truyền qua `metadata: { amount, currency, destination }`. Document trong docs.

**Q3: Rehydrated `submitted` tx sau retry window → pending/unknown/failed?**
→ ✅ **RESOLVED: `unknown`.** Dùng `?` icon, muted color, giữ explorer link. Không mark `failed` sớm.

**Q4: Inline hay sub-panel riêng?**
→ ✅ **RESOLVED: Inline section** trong main Account Panel — đã test live trên Chrome (2026-06-25). Sub-panel (cách coder implement ban đầu với "≡ 2" pill badge) bị reject vì: (1) badge không discoverable, (2) thêm 1 click, (3) sub-panel quá nhiều empty space do fixed modal height. Height jump khi collapse/expand là acceptable — QR code view ít dùng, pattern tương tự.

**Q5: `maxVisibleTransactions` default = 3 hay 5 trên mobile?**
→ ✅ **RESOLVED: 5 cho mọi viewport.** List dùng `max-height: 210px` + internal scroll — không resize modal frame. Không cần split desktop/mobile.

**Q6: WalletInline có transaction section không?**
→ ✅ **RESOLVED: Out of scope Phase 1-4.** Future sprint.

---

## 13. Không nên làm (out of scope)

- **Fetch transaction list từ XRPL API** — ngoài scope của kit (kit không query ledger trừ confirmation). App dùng `xrpl.js` để fetch full history.
- **Transaction filters** (by type, date range) — over-engineering cho v0.1.
- **Undo / cancel transaction** — không có trên XRPL.
- **Push notifications** — ngoài scope browser wallet kit.
- **Multi-account tx merging** — scope creep, giữ scoping đơn giản (1 account = 1 list).

---

## 14. Checklist pre-PR

- [ ] `WalletTransactionStore` có unit test cho add/get/clear/max rotation
- [ ] SSR-safe: `typeof window === "undefined"` guard trong tx-store
- [ ] `showRecentTransactions: false` (default) → zero DOM change, zero perf impact
- [ ] Tx rows accessible: role="list", mỗi row role="listitem", link có aria-label
- [ ] CSS không conflict với existing `.xwk-account-panel-actions` styles
- [ ] `npm run typecheck` pass
- [ ] `npm test` pass
- [ ] `npm run build:browser` pass (IIFE bundle size delta check)
- [ ] Docs trang `/docs/advanced/transaction-history` added to sidebar

---

*Spec này ready để giao cho coder. Phase 1-3 có thể triển khai theo thứ tự, Phase 4 (docs) sau cùng. Phase 5 (React/Vue hooks) tách sprint.*

---

## 15. Coder Notes for Reviewer Alignment

Status: direction approved, but UI should ship as a compact MVP first.

Recommended implementation stance:

- Keep the feature opt-in. Defaults must not change Account Panel DOM or WalletButton visuals.
- Build core persistence first. `WalletTransactionStore` belongs in `@xrpl-wallet-kit/core`, keyed by `networkId + account address`.
- Do not fetch full ledger history in the kit. The kit should track transactions it submits or transactions the app registers through `manager.addTransaction()`.
- Do not parse transaction descriptions/amounts aggressively from `txJson` in the first pass. Prefer app-supplied `transaction.description` and `transaction.metadata`.
- Rehydrated `submitted` transactions should resume best-effort confirmation polling when possible. If confirmation is inconclusive, prefer a neutral pending/unknown display with an explorer link instead of marking failed too early.
- Account Panel UI must stay stable. Recent transactions need a bounded internal scroll area and must not resize the modal/panel frame.
- Keep the row layout quiet and compact:
  - row 1: status icon, description, compact `View` link
  - row 2: shortened hash and relative time
  - metadata such as amount/destination is optional and should be omitted or truncated when long
- Use inline SVG icons, not text glyphs, for status and explorer actions so rendering matches existing modal/button controls.
- All visual colors must use existing theme tokens: `success`, `accent`, `error`, `muted`, `surface`, `surfaceHover`, `border`, `foreground`.
- Pending dot on WalletButton is approved, but only when `showRecentTransactions` is enabled. Use a small dot on the wallet icon, not an animated ring.
- `WalletInline` transaction UI is out of scope for the first implementation.
- React/Vue hooks are useful but should remain a later phase after core + vanilla UI are stable.

Suggested implementation order:

1. Core `WalletTransactionStore` + tests.
2. `WalletManagerConfig.persistTransactions` wiring + tests.
3. Compact Account Panel transaction section + i18n + accessibility tests.
4. WalletButton pending dot + tests.
5. Website docs and API reference updates.

Reviewer decisions:

- Rehydrated old `submitted` transactions after the retry window should display as `unknown`, not `failed`. Use a `?` status icon, muted color, and keep the explorer link visible so the user can verify externally. Marking as `failed` too early is misleading when the transaction may have confirmed after reload.
- `txSectionOpen` should default to `true` whenever `showRecentTransactions` is enabled. Do not make expansion conditional on pending transactions in the first implementation.
- Keep a single `maxVisibleTransactions` default of `5` across desktop and mobile. The list must use max-height plus internal scroll, so mobile does not need a separate default of `3`.

**Architecture decision — 2026-06-25, after live Chrome test:**

The sub-panel navigation approach (pill badge "≡ 2" → separate "Recent transactions" view) implemented in the first pass is **rejected**. Reasons observed in live test:

1. The "≡ 2" pill next to the balance chip is not discoverable — users have no reason to click it.
2. Extra click required: open panel → spot badge → click → see list. The most common use case ("did my tx confirm?") requires two interactions instead of zero.
3. Sub-panel body has a large empty area below the tx rows because the modal has a fixed height (~527px) and only 2 rows of content were present.
4. The badge shows count only, not status urgency — "2" could mean 2 confirmed (fine) or 1 pending (needs attention). There is no visual differentiation.

**Confirmed direction: Option B — inline section inside the main Account Panel body**, with:
- `max-height: 210px` + `overflow-y: auto` on the list container (max ~5 rows, then scroll)
- Collapse/expand toggle (chevron) on the section header
- `txSectionOpen = true` by default
- Minor height jump on collapse/expand is accepted — QR code view is rarely triggered, same trade-off applies
- The "≡ 2" pill badge entry point should be removed entirely
- Pending dot on WalletButton remains as the out-of-panel urgency signal
