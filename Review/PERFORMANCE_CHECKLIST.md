# XRPL Wallet Kit — Performance Checklist

**Phạm vi:** Tốc độ load, thời gian phản hồi tương tác người dùng, tài nguyên nặng  
**Ngày kiểm tra:** 2026-05-28  
**Dựa trên:** phân tích static bundle, đọc source code, đo gzip dist files

---

## Tóm tắt nhanh (Executive Summary)

| Hạng mục | Đo được | Ngưỡng tốt | Trạng thái |
|---|---|---|---|
| IIFE bundle (gzip) | **528 KB** | ≤ 150 KB | 🔴 CRITICAL |
| WalletConnect icons.js (gzip) | 22 KB | ≤ 5 KB | 🟡 CẦN XEM |
| Hai thư viện QR song song | 14 KB + qrcode | 1 thư viện | 🟡 CẦN XEM |
| CSS inline injection | ~4 KB per open | Cached ✅ | 🟢 ĐÃ FIX |
| Modal CSS cache | cachedStyleKey | Cache hit OK | 🟢 ĐÃ FIX |
| getWalletAvailability() | Promise.all() | Parallel OK | 🟢 TỐT |
| Memory cleanup destroy() | Listeners removed | Full cleanup | 🟢 ĐÃ FIX |
| Ledger adapter + xrpl lib | ~600 KB raw deps | Tree-shaken | 🟡 CẦN XEM |
| sideEffects: false (core) | Có | Có | 🟢 TỐT |

---

## P1 — Bundle Size (IIFE) 🔴 CRITICAL

### Đo được

| File | Raw | Gzip |
|---|---|---|
| `xrpl-wallet-kit.iife.min.js` | 1.66 MB | **528 KB** |
| `xrpl-wallet-kit.iife.js` (dev) | 3.05 MB | 684 KB |

### Vấn đề

IIFE bundle đóng gói **tất cả** adapters + UI + core + WalletConnect sign-client vào một file duy nhất, kể cả các adapters người dùng không sử dụng (Xaman, Ledger, GemWallet, Crossmark, Dropfi, Otsu, xrpl-snap, WalletConnect). Đây là antipattern cho performance.

**So sánh quy tắc ngành:**
- Web Almanac 2023: median JS truyền qua network trên mobile = 209 KB gzip
- Google CWV: TBT (Total Blocking Time) bắt đầu bị ảnh hưởng ở 300 KB+ gzip JS
- 528 KB đồng nghĩa với **2–4 giây parse/execute** trên thiết bị trung bình

### Nguyên nhân chính

```
IIFE = core (manager.js 5.7KB) 
     + ui (modal.js 11.9KB + button.js 8.5KB + toast.js 3.4KB + icons 3.2KB)
     + ALL adapters (xaman 10KB + crossmark 9.7KB + gemwallet 5KB + ...)
     + @walletconnect/sign-client (16.5KB gzip RIÊNG PHẦN)
     + @walletconnect/modal CDN chunk (~64KB gzip)
     + QR libraries (qr-code-styling 14KB + qrcode fallback)
     + Buffer polyfill
```

### Khuyến nghị

**Ngắn hạn (trước v0.1.0 release):**
- [ ] Thêm hướng dẫn rõ trong README: dự án lớn nên dùng ESM qua bundler, không dùng IIFE
- [ ] Ghi rõ "IIFE bundle = all-in-one, phù hợp quick test / legacy HTML. Production nên import từng adapter"

**Trung hạn (v0.2.0):**
- [ ] Tách IIFE thành `xrpl-wallet-kit-core.iife.js` (~30 KB) + `xrpl-wallet-kit-adapters/{name}.iife.js` (mỗi adapter riêng)
- [ ] Target budget: core IIFE ≤ 50 KB gzip, mỗi adapter IIFE ≤ 15 KB gzip

**ESM path (ưu tiên):**  
Khi dùng qua bundler (Vite/webpack), các adapters không import đều bị tree-shake. Người dùng ESM không bị ảnh hưởng bởi vấn đề này.

```
Ví dụ: App chỉ dùng Xaman + GemWallet
ESM bundle ≈ core (5.7KB) + xaman (10KB) + gemwallet (5KB) + ui modal (11.9KB) ≈ 33 KB gzip ✅
```

---

## P2 — Icon Loading Strategy 🟡 CẦN XEM

### Đo được

| Nguồn | Kích thước |
|---|---|
| `walletconnect/src/icons.ts` | 29.9 KB source → 22.1 KB gzip dist |
| Crossmark icon (base64 SVG/PNG) | ~11.3 KB ký tự trong source |
| Mỗi adapter khác | 1–2 KB icon base64 |

### Vấn đề

Tất cả 8 adapters **nhúng icon trực tiếp** vào source code dưới dạng base64 data URL. WalletConnect có tới 6 icons (WALLETCONNECT, BITGET, JOEY, GIRIN, BIFROST, STATICBIT) nhúng trong `icons.ts`, chiếm 22 KB gzip chỉ để hiển thị logo trong dropdown.

Icons không được lazy-load — toàn bộ blob base64 parse ngay khi module import.

### Khuyến nghị

**Ngắn hạn:** Không cần thay đổi ngay — base64 icons tránh thêm HTTP request, phù hợp cho SDK lib.

**Trung hạn:**
- [ ] WalletConnect icons: chuyển sang `import()` dynamic cho icons.ts khi modal mở lần đầu  
  ```ts
  // Thay vì import icons từ đầu:
  const { WALLETCONNECT_ICON, BITGET_ICON } = await import("./icons.js");
  ```
- [ ] Xem xét lưu icon URL bên ngoài và lazy-fetch (trade-off: thêm network request, nhưng giảm bundle)
- [ ] Với các icon lớn (>5 KB), ưu tiên SVG inline hơn PNG base64

---

## P3 — Hai thư viện QR song song 🟡 CẦN XEM

### Đo được

| Thư viện | Gzip | Mục đích |
|---|---|---|
| `qr-code-styling` | **14 KB** | Primary — styled SVG QR |
| `qrcode` | ~8–10 KB (browser entry) | Fallback — data URL canvas |

### Vấn đề

Cả hai thư viện đều được bundle vào `modal.js`. Trong trường hợp thông thường (qr-code-styling hoạt động), `qrcode` không được dùng nhưng vẫn tải. Với IIFE bundle, cả hai đều có mặt.

Tổng overhead ước tính: ~22–24 KB gzip cho toàn bộ QR infrastructure, trong khi chỉ cần ~14 KB nếu qr-code-styling đủ tin cậy.

### Khuyến nghị

- [ ] Đánh giá tần suất fallback thực tế: nếu `qr-code-styling` không bao giờ fail trong thực tế, xem xét bỏ fallback `qrcode`
- [ ] Nếu giữ fallback: dynamic import thư viện fallback chỉ khi cần:
  ```ts
  // Chỉ import qrcode khi qr-code-styling bị lỗi:
  const QRCode = await import("qrcode");
  ```
- [ ] Ưu tiên: không blocking, làm sau khi codebase ổn định

---

## P4 — Modal Open Latency 🟢 CƠ BẢN TỐT

### Đo được / Phân tích

**CSS Generation (đã fix ✅):**
- `renderStyles()` tạo ~4 KB CSS string từ template literal lớn
- Cache key = `${layout}|${size}|${textSize}|${themeMode}|${JSON.stringify(theme)}`  
- Sau lần đầu: cache hit → return ngay, không tính toán lại ✅

**Wallet Availability (tốt ✅):**
- `getWalletAvailability()` dùng `Promise.all()` → kiểm tra tất cả adapters song song
- Không bị chặn bởi adapter chậm

**DOM Injection:**
- `modal.open()` inject HTML vào DOM root element
- Style inject inline `<style>` tag (không phải `<link>`) — không cache được ở browser level nhưng cache ở JS memory ✅

**Checklist hiện tại:**
- [x] CSS generation cached by composite key
- [x] Availability check parallel (Promise.all)
- [x] destroy() removes all event listeners → không rò bộ nhớ
- [ ] Chưa đo Time-to-Interactive thực tế trên thiết bị (cần Lighthouse / Chrome DevTools trace)

### Khuyến nghị

- [ ] **Đo baseline** bằng Lighthouse CI hoặc Web Vitals: modal.open() → first paint → interactive
- [ ] Target: modal hiện thị ≤ 100ms sau `open()` call trên desktop, ≤ 300ms trên mid-range mobile
- [ ] Kiểm tra `getWalletAvailability()` blocking render: nếu một adapter `isAvailable()` có side effect chậm, nó vẫn delay toàn bộ list render dù dùng Promise.all (không phải race)

---

## P5 — Interaction Responsiveness 🟢 TỐT

### Phân tích

**Touch & click:**
- CSS đã có `touch-action: manipulation` trên `.xwk-wallet`, `.xwk-action`, `.xwk-close`
- `transition: background-color .16s ease` — animation ngắn, không block
- `prefers-reduced-motion` media query có mặt: animation tắt cho người dùng cần ✅

**Focus management:**
- `aria-modal="true"` + `tabindex="-1"` trên section ✅
- `focus-visible` styles cho keyboard navigation ✅

**Spinner loading:**
- Spinner CSS animation (xwk-spin keyframe) chạy ngay khi connect
- Không dùng JavaScript animation → không block main thread ✅

**Checklist:**
- [x] touch-action: manipulation trên tất cả interactive elements
- [x] prefers-reduced-motion
- [x] CSS animation thay JS animation
- [x] aria-live="polite" cho status updates
- [ ] Chưa test trên thiết bị thực (Android Chrome, Safari iOS)

---

## P6 — WalletConnect Network Requests 🟡 CẦN THEO DÕI

### Phân tích

Khi user chọn WalletConnect flow:
1. `preInitialize()` khởi tạo `SignClient` → kết nối WebSocket đến WalletConnect relay server
2. `connect()` → yêu cầu session → nhận WC URI
3. Render QR code từ URI

**Điểm cần chú ý:**
- WalletConnect relay: `wss://relay.walletconnect.com` — độ trễ phụ thuộc geography
- QR URI chỉ valid trong thời gian giới hạn → timeout nếu user không scan kịp
- `preInitialize()` đã có guard `if (this.pendingConnection) return` → không double-init ✅

**@walletconnect/sign-client gzip:** 16.5 KB — tải ngay khi import WC adapter

### Khuyến nghị

- [ ] Cân nhắc lazy-load WC adapter: chỉ import `@walletconnect/sign-client` khi user click WalletConnect button (dynamic import)
  ```ts
  // Trong adapter connect():
  const { default: SignClient } = await import("@walletconnect/sign-client");
  ```
- [ ] Đo WC URI time-to-appear: từ lúc user click → QR hiện = mục tiêu ≤ 2 giây

---

## P7 — Ledger Adapter Heavy Dependencies 🟡 CẦN XEM

### Đo được

Ledger `package.json` dependencies:
```
@ledgerhq/hw-app-xrp
@ledgerhq/hw-transport
@ledgerhq/hw-transport-webhid
@ledgerhq/hw-transport-webusb
buffer (polyfill)
xrpl  ← ⚠️ thư viện nặng
```

Ledger dist gzip: 3.6 KB (rất nhỏ) nhưng **kéo theo `xrpl` và `@ledgerhq/*`** — tổng dependency tree có thể lên tới 400–600 KB raw khi bundle.

### Khuyến nghị

- [ ] Kiểm tra xem `xrpl` trong Ledger adapter có thực sự cần thiết không, hay chỉ dùng một vài utility (binary encoding, codec) → có thể thay bằng `ripple-binary-codec` nhỏ hơn
- [ ] Nếu giữ: đảm bảo `xrpl` là `peerDependency` để bundler có thể deduplicate khi app cũng dùng `xrpl`
- [ ] Cân nhắc lazy import Ledger transport:
  ```ts
  const TransportWebHID = await import("@ledgerhq/hw-transport-webhid");
  ```

---

## P8 — CSS Injection Strategy 🟡 THÔNG TIN

### Hiện tại

CSS được inject dưới dạng `<style>` tag inline bên trong `.innerHTML` của modal root, mỗi lần `open()` hoặc `renderModal...()` gọi đến:

```ts
this.root.innerHTML = `<style>${this.renderStyles(...)}</style><section ...>`;
```

**Ưu:** Không cần external CSS file, không request thêm, hoạt động trong Shadow DOM / isolated scope.

**Nhược:** Browser không cache inline styles như nó cache `<link rel="stylesheet">`. Tuy nhiên, JS-level cache (`cachedStyle`) đã giảm thiểu cost tính toán.

### Khuyến nghị

- [ ] Xem xét inject `<style>` một lần vào `document.head` với ID cố định thay vì tái inject mỗi lần render
  ```ts
  const existing = document.getElementById("xwk-styles");
  if (!existing) {
    const el = document.createElement("style");
    el.id = "xwk-styles";
    el.textContent = this.renderStyles(...);
    document.head.appendChild(el);
  }
  ```
  → Browser tái sử dụng CSSOM, không phân tích lại mỗi lần open/close
- Priority: medium — lợi ích thực tế nhỏ vì JS cache đã giải quyết cost chính

---

## P9 — Memory Leaks 🟢 ĐÃ FIX

Đã xác nhận trong Round 3 verification:

- [x] `destroy()` trong `WalletManager` huỷ `pendingConnection`, gọi `removeAllListeners()`
- [x] `WalletModal.destroy()` gọi `manager.cancelPendingConnection()` trước khi tháo DOM
- [x] `restoreSession()` trong adapters không giữ reference vòng
- [x] Event listeners trong `WalletButton` được cleanup khi button bị remove

Không có vấn đề rò bộ nhớ nghiêm trọng được phát hiện.

---

## P10 — Checklist Tổng Hợp Cho Coder

### 🔴 Cần làm trước release

| ID | Việc cần làm | File liên quan |
|---|---|---|
| PERF-01 | Thêm cảnh báo rõ trong README: IIFE chỉ dùng cho legacy/demo | `README.md` |
| PERF-02 | Đo Lighthouse baseline (TTI, TBT) và commit kết quả | CI config |
| PERF-03 | Kiểm tra Ledger adapter: `xrpl` có cần là peerDep không? | `adapters/ledger/package.json` |

### 🟡 Làm ở v0.2.0

| ID | Việc cần làm | Lợi ích ước tính |
|---|---|---|
| PERF-04 | Dynamic import WalletConnect icons.js | −22 KB initial load cho WC adapter |
| PERF-05 | Dynamic import `@walletconnect/sign-client` khi click WC | −16 KB initial load |
| PERF-06 | Tách IIFE thành core + adapter riêng lẻ | Core IIFE ~30 KB thay vì 528 KB |
| PERF-07 | Inject `<style id="xwk-styles">` vào `document.head` một lần | Tái dùng CSSOM |
| PERF-08 | Đánh giá bỏ `qrcode` fallback hoặc dynamic import | −8–10 KB |

### 🟢 Đã tốt, không cần thay đổi

- Promise.all cho getWalletAvailability
- cachedStyleKey cho CSS
- destroy() cleanup đầy đủ
- touch-action, prefers-reduced-motion
- sideEffects: false trên core

---

## Phương pháp đo (Recommendations cho team)

### Lighthouse CI (tự động)
```bash
# Thêm vào CI pipeline
npx lighthouse-ci autorun --collect.url=http://localhost:5173 \
  --assert.budgets.js.maxNumericValue=300000
```

### Chrome DevTools trace thủ công
1. Mở example vanilla app (`npm run dev:vanilla`)
2. DevTools → Performance → Record
3. Click "Connect Wallet"
4. Stop recording
5. Xem: **Long Tasks > 50ms**, **Layout Thrashing**, **Style Recalculation**

### Bundle analyzer
```bash
# Phân tích composition của IIFE bundle:
npx source-map-explorer packages/browser/dist/xrpl-wallet-kit.iife.min.js \
  packages/browser/dist/xrpl-wallet-kit.iife.min.js.map
# Hoặc dùng rollup-plugin-visualizer trong build config
```

### Metric targets (đề xuất)

| Metric | Target |
|---|---|
| ESM bundle (app chỉ dùng 2 adapters) | ≤ 50 KB gzip |
| IIFE bundle (all-in-one) | ≤ 250 KB gzip (dài hạn) |
| modal.open() → first paint | ≤ 100ms (desktop) |
| WC URI appear after click | ≤ 2s |
| TBT do SDK gây ra | ≤ 50ms |

---

*Tạo bởi: Review automation — 2026-05-28*  
*Vòng review tiếp theo: sau khi team implement PERF-04 và PERF-05*
