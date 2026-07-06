# UI Mockups — XRPL Wallet Kit Feature UI

> 6 file SVG minh họa thiết kế cho các feature trong `FEATURE_UI_SPEC.md`.  
> Mở trực tiếp bằng trình duyệt hoặc Figma (File → Import).

---

## 01 · Wallet Toast Notifications
**File:** `01-wallet-toast.svg`  
**Feature:** P1-2 · `packages/ui/src/toast.ts` (standalone)

| Trạng thái | Màu accent bar | Hiệu ứng icon | Auto-dismiss |
|---|---|---|---|
| Pending | `#3b82f6` xanh | Spinner `rotate(360deg) 1s linear infinite` | Manual only |
| Confirmed | `#10b981` xanh lá | Check `scale(0→1) pulse 300ms ease-out` | 6 000 ms |
| Failed | `#ef4444` đỏ | Shake `translateX ±6px 0.4s ease-in-out` | 10 000 ms |

**Animation enter/exit:**
- Enter: `translateX(110%) → 0` · 280ms · `cubic-bezier(0.34, 1.56, 0.64, 1)` (spring bounce)
- Exit: `translateX(0) → 110%) + opacity 1→0` · 220ms · `ease-in`
- Stack: max 3 toasts · gap 10px · `position: fixed` bottom-right · `z-index: 9999`
- Touch: swipe-right dismiss (velocity > 200px/s)
- A11y: `role="status" aria-live="polite"` · pending dùng `aria-live="assertive"`

---

## 02 · Transaction Preview Panel
**File:** `02-tx-preview.svg`  
**Feature:** P2-5 · View state `"preview"` trong `WalletModal`

**Layout:** Modal overlay (300×430px) · blur backdrop `blur(8px)`

**Sections:**
1. **Header** — "Review Transaction" + close button
2. **Wallet row** — adapter logo + name ("Signing via Xaman")
3. **Amount card** — số XRP lớn + USD equivalent (async fetch)
4. **Detail rows** — To / Amount / Memo / Fee / Network
5. **Action buttons** — Cancel (muted) + Confirm (gradient glow)

**Hiệu ứng:**
- Modal open: `scale(0.95→1) + translateY(8px→0)` · 250ms spring · overlay `fadeIn` 200ms
- Amount USD: skeleton shimmer trong khi fetch rate
- Confirm loading: spinner icon + "Waiting for wallet…" + disable cả 2 buttons
- Close: reverse 180ms `ease-in`

---

## 03 · Activation Guard Panel
**File:** `03-activation-guard.svg`  
**Feature:** P3-7 · View state `"guard"` trong `WalletModal`

**Trigger:** `manager.on("connected")` → `account.activated === false`

**Layout:**
1. **Shield icon** — amber glow `0 0 20px #f59e0b 0.4` · pulse `scale(1→1.05) 2s ease infinite`
2. **Warning text** — "Account Not Activated" + mô tả 10 XRP reserve
3. **QR code** — địa chỉ nhận · white background · `fadeIn 400ms delay 150ms`
4. **Address row** — truncated monospace + copy button
5. **Buttons** — "Get XRP" (amber outline) + "Continue anyway" (muted)

**Callbacks:** `onGetXrp()` mở onramp link · `onSkip()` emit `"activation_skipped"` · `onActivated()` khi balance ≥ 10 XRP

---

## 04 · Trust Line Warning Banner
**File:** `04-trustline-warning.svg`  
**Feature:** P3-8 · Inject additive vào modal body

**Cách tích hợp:** KHÔNG thêm view state mới. Banner class `.xwk-tlb` inject vào đầu `renderShell()` body.

**Hiệu ứng:**
- Animate: `max-height: 0 → 56px` · 200ms `ease-out` (slideDown)
- Nền: `#2d1f00` · border-bottom `#92400e`
- Dismiss: nút X nhỏ → `sessionStorage.setItem('xwk-tlb-hide', '1')`
- "Set up →" link → mở TrustSet guide hoặc inline flow

**Prop:** `trustLineRequired?: { currency: string; issuer: string; label?: string }`

---

## 05 · Recent Transactions
**File:** `05-recent-txs.svg`  
**Feature:** P2-4 · Append additive vào `renderPanelContent()` trong `button.ts`

**Layout section:**
- Header "RECENT" (11px muted caps)
- Max 5 rows, scroll container nếu nhiều hơn
- Mỗi row: status dot · tx type · địa chỉ + thời gian · amount ± · status label

**Status dots:**
| Trạng thái | Màu | Hiệu ứng |
|---|---|---|
| Pending | `#3b82f6` | Blink pulse 1.5s `opacity 1↔0.3` |
| Confirmed | `#10b981` | Static |
| Failed | `#ef4444` | Static |

**Interaction:** tap row → `window.open(getExplorerTxUrl(hash))` · hover: bg `#1e2d47`

**Prop:** `recentTxs?: TxResult[]`

---

## 06 · Enhanced Network Badge
**File:** `06-network-badge.svg`  
**Feature:** P3-9 · Improve `renderButton()` trong `button.ts`

**Logic:** `isMainnet(network) === true` → **không hiện badge** (reduce noise)

| Network | Màu dot | Label | Kiểu badge |
|---|---|---|---|
| Mainnet | — | — | Ẩn hoàn toàn |
| Testnet | `#f59e0b` | TESTNET | Amber fill |
| Devnet | `#38bdf8` | DEVNET | Sky blue |
| XRPL EVM | `#a78bfa` | EVM | Violet |
| Custom RPC | `#94a3b8` | CUSTOM | Grey outline |

**Hiệu ứng:**
- Badge appear: `scale(0→1)` 200ms spring
- Network switch: `fadeOut 150ms` → swap → `fadeIn 150ms`
- Dot pulse (testnet/devnet): `opacity 1→0.4→1` 2s `ease-in-out infinite`
- Hover tooltip: full network name + rpcUrl · `fadeIn 120ms delay 400ms`

**WCAG 2.1 AA contrast:** Amber 5.01:1 ✓ · Sky 4.82:1 ✓ · Violet 4.54:1 ✓ · Grey 4.51:1 ✓

---

*Tất cả màu sắc dùng CSS token `${theme.xxx}` — không hardcode. Xem `FEATURE_UI_SPEC.md` để biết chi tiết implementation.*
