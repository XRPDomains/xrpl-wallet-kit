# XRPL Wallet Kit — Lộ Trình Phát Triển 3 Tháng

**Tác giả:** Senior Architect / Technical Advisor  
**Cập nhật:** 2026-05-28  
**Phạm vi:** Ổn định beta → Mở rộng Kit (NFT, Portfolio) → Ứng dụng thực chiến (Telegram Mini App Wallet)

---

## Tổng quan chiến lược

Lộ trình chia ba pha rõ ràng, mỗi pha kế thừa output của pha trước:

| Pha | Thời gian | Mục tiêu chính | Output |
|-----|-----------|----------------|--------|
| **Pha 1** | Tháng 1 | Ổn định core + P1 Features | Beta release `0.1.0` |
| **Pha 2** | Tháng 2 | NFT Kit + Portfolio Kit | Minor release `0.2.0` |
| **Pha 3** | Tháng 3 | Telegram Mini App Wallet | App MVP + `0.3.0` |

Nguyên tắc xuyên suốt: **không phá vỡ API hiện tại**. Mọi bổ sung đều additive — dApp hiện có không cần migration.

---

## Pha 1 — Tháng 1: Ổn định & Core Features

### Tuần 1–2: Bug Fixes & Pre-Beta Blockers

Các vấn đề này phải xong trước khi publish beta lên npm. Lấy từ REVIEW.md và ARCHITECTURE_REVIEW.md.

**Nhóm A — Bugs nghiêm trọng (bắt buộc)**

| ID | Vấn đề | File liên quan | Giải pháp tóm tắt |
|----|--------|----------------|-------------------|
| C3 | `connect()` crash khi đã có session active | `WalletManager` | Cho phép re-connect → tự disconnect cũ rồi connect mới |
| C1 | Xaman/WalletConnect ghi recovery marker thẳng vào `window.localStorage`, bỏ qua `WalletStorage` đã inject | adapter-xaman, adapter-walletconnect | Dùng injected storage thay vì global |
| H1 | `parseStoredSession` không validate schema — crash khi storage bị corrupt | `core/storage` | Thêm schema guard, fallback về null |
| H2 | `WalletManager` không có `destroy()` — event listener tích lũy trong React StrictMode | `core/WalletManager` | Implement `destroy()`, clear all listeners |
| H4 | `disconnect()` timeout 2 giây silent | `core/WalletManager` | Expose timeout config, emit event khi force-timeout |

**Nhóm B — Cải thiện quan trọng**

| ID | Vấn đề | Giải pháp tóm tắt |
|----|--------|-------------------|
| H3 | GemWallet `signAndSubmit` fail với generic tx | Thêm fallback qua `signTransaction` + manual submit |
| M3 | CSS 4KB re-inject mỗi lần render | Cache `<style>` tag, chỉ inject 1 lần |
| L1 | `toHex()` duplicate ở 3 adapters | Extract vào `core/utils.ts`, re-export |
| L2 | `core/package.json` thiếu `sideEffects: false` | Thêm field — bắt buộc cho tree-shaking |

**Deliverable tuần 1–2:** Tất cả C, H severity đóng. `npm run typecheck && npm test` sạch. Test coverage tăng từ 13 lên ≥ 60 cases.

---

### Tuần 3–4: P1 Features — Standard bắt buộc cho dApp production

**Feature 1.1 — Sign-In with XRPL (Authentication)**

Đây là tính năng RainbowKit có (SIWE) nhưng XRPL ecosystem **hoàn toàn thiếu**. Kit này có cơ hội set standard.

```typescript
// API surface — thêm vào WalletManager
const result = await manager.authenticate({
  statement: "Sign in to MyDApp",
  expiresIn: 3600,
  domain: "mydapp.io"
});
// result: { address, message, signature, issuedAt, expiresAt }
// Backend verify bằng cách reconstruct message và check signature
```

Implementation: Headless hoàn toàn. Kit tạo challenge message chuẩn → gọi `adapter.signMessage()` → trả về payload. Không biết gì về backend. dApp tự verify.

Effort: **M (5 ngày)**. Không cần UI mới, chỉ cần core logic + types.

---

**Feature 1.2 — Transaction Toast (Notify)**

Gap UX rõ nhất hiện tại. XRPL confirm trong 3–5 giây nhưng không có visual feedback.

```typescript
// packages/ui/src/toast.ts — class mới, độc lập với WalletModal
const toast = new WalletToast({
  manager,
  theme: "dark",
  position: "bottom-right",
  autoDismissMs: 5000,
  explorerUrl: (hash) => `https://livenet.xrpl.org/transactions/${hash}`
});
toast.mount(); // inject vào document.body

// manager tự emit events — toast lắng nghe:
// tx_submitted → pending spinner
// tx_confirmed → green check + dismiss timer
// tx_failed    → red X + error text
```

Cần bổ sung events vào `WalletManager`: `tx_submitted`, `tx_confirmed`, `tx_failed`. UI layer chỉ subscribe — zero coupling với adapter.

Effort: **S–M (4 ngày)**. DOM + CSS thuần, không cần framework.

---

**Feature 1.3 — Localization (i18n)**

XRPL user base tập trung ở Nhật, Đông Nam Á, châu Âu. Hardcode tiếng Anh là blocker cho adoption.

```typescript
createWalletKit({
  ui: {
    locale: "vi",        // en | ja | vi | zh | ko
    messages: {          // override bất kỳ string nào
      connectWallet: "Kết nối ví"
    }
  }
})
```

Implementation: Extract tất cả string từ `renderShell/renderConnectShell/renderQrShell/renderPanelContent` vào `locales/en.ts`. Các ngôn ngữ khác extend base. UI dùng `t("key")` helper.

Effort: **S–M (4 ngày)**. Refactor cẩn thận để không vỡ existing tests.

---

**Deliverable cuối Tháng 1:**
- `0.1.0-beta.1` publish lên npm
- CHANGELOG với breaking changes rõ ràng
- Docs cập nhật cho 3 features mới
- CI pipeline: typecheck + test + build:browser chạy trên mọi PR

---

## Pha 2 — Tháng 2: NFT Kit + Portfolio Kit

Đây là differentiator thực sự — không có XRPL library nào có sẵn những thứ này.

### Tuần 5–6: NFT Display Kit

XRPL có NFT native (XLS-20). Kit cần expose data layer sạch để dApp render NFT gallery, detail, và offers mà không cần tự gọi XRPL API.

**Architecture:**

```
packages/
  nft/            @xrpl-wallet-kit/nft   ← NEW package
    src/
      fetcher.ts        NftFetcher class — fetch NFTs của account từ XRPL node
      types.ts          NFT, NftOffer, NftMetadata types
      metadata.ts       Resolve IPFS/HTTP metadata từ URI
      index.ts
```

Dependency: `xrpl` library (chỉ dùng `client.request()`). Không import `@xrpl-wallet-kit/ui`.

**Core API:**

```typescript
import { NftFetcher } from "@xrpl-wallet-kit/nft";

const fetcher = new NftFetcher({
  rpcUrl: "wss://xrplcluster.com",
  ipfsGateway: "https://ipfs.io/ipfs/"  // configurable
});

// Fetch tất cả NFTs của account
const { nfts, marker } = await fetcher.getAccountNfts({
  account: "rXXX...",
  limit: 20,
  marker: undefined
});

// Resolve metadata từ URI (IPFS hoặc HTTP)
const metadata = await fetcher.resolveMetadata(nft.uri);
// metadata: { name, description, image, attributes[], ... }

// Fetch offers cho một NFT
const { buyOffers, sellOffers } = await fetcher.getNftOffers(nft.nftId);
```

**UI Components (packages/ui bổ sung):**

Kit cung cấp headless data, còn UI là optional helpers dùng DOM thuần:

```typescript
import { renderNftCard, renderNftGallery, renderNftDetail } from "@xrpl-wallet-kit/ui/nft";

// Render gallery vào container
renderNftGallery(container, {
  nfts,
  onSelect: (nft) => renderNftDetail(detailContainer, { nft, offers })
});
```

Visual: Card 160×160px, lazy-load ảnh, skeleton loading, fallback khi metadata không resolve được.

Effort: **L (8 ngày)**. `NftFetcher` là phần nặng nhất — IPFS metadata resolve cần timeout, retry, cache.

---

**Feature 2.1 — Account Activation Guard**

Khi connect xong mà account unfunded (chưa có 10 XRP reserve), modal hiện ngay cảnh báo với QR nhận XRP. Hiện tại `activationStatus: "unfunded"` chỉ hiện ở account panel — user không thấy.

```typescript
// Modal view mới: "guard"
// Trigger: sau connect(), nếu manager.getAccountInfo() trả về activationStatus = "unfunded"
// Hiện:
//   - Cảnh báo rõ ràng: "Tài khoản chưa kích hoạt"
//   - Số XRP cần: 10 XRP (từ reserve info)
//   - QR code địa chỉ để nhận XRP
//   - Nút "Tiếp tục dù vậy" để bypass
```

Effort: **S (2 ngày)**. Data đã có, chỉ cần UI view mới.

---

### Tuần 7–8: Portfolio Kit

**Architecture:**

```
packages/
  portfolio/       @xrpl-wallet-kit/portfolio   ← NEW package
    src/
      fetcher.ts        PortfolioFetcher — XRP balance, token balances, trust lines
      price.ts          PriceResolver — fetch giá từ DEX on-chain hoặc oracle
      history.ts        TransactionHistory — paginated tx list
      types.ts
      index.ts
```

**Core API:**

```typescript
import { PortfolioFetcher } from "@xrpl-wallet-kit/portfolio";

const portfolio = new PortfolioFetcher({
  rpcUrl: "wss://xrplcluster.com"
});

// XRP balance + reserve info
const { xrpBalance, ownerReserve, baseReserve, available } =
  await portfolio.getXrpBalance("rXXX...");
// available = xrpBalance - baseReserve - ownerReserve * numObjects

// Token balances (trust lines với nonzero balance)
const tokens = await portfolio.getTokenBalances("rXXX...");
// tokens: [{ currency, issuer, balance, limit }]

// Transaction history với pagination
const { transactions, marker } = await portfolio.getTransactionHistory({
  account: "rXXX...",
  limit: 20,
  txTypes: ["Payment", "OfferCreate"]  // filter tùy chọn
});

// Trust line awareness — detect thiếu trust line
const hasTrustLine = await portfolio.hasTrustLine({
  account: "rXXX...",
  currency: "USD",
  issuer: "rhub8VRN55s94qWKDv6jmDy1pUykJzF3wq"  // Bitstamp
});
```

**Feature 2.2 — Trust Line Warning**

Khi dApp gọi `signTransaction` với token nhưng account chưa có trust line → kit detect trước khi sign và hiện warning inline:

```typescript
// Tích hợp vào WalletManager
manager.on("sign_preflight_warning", ({ type, data }) => {
  if (type === "missing_trust_line") {
    // data: { currency, issuer }
    // UI layer hiện banner "Bạn cần thiết lập Trust Line cho USD trước khi giao dịch"
  }
});
```

Effort: **M (6 ngày)**. `PortfolioFetcher` straightforward. `price.ts` là phần phức tạp nhất nếu muốn DEX price.

---

**Feature 2.3 — Recent Transactions trong Account Panel**

Copy pattern từ RainbowKit — account panel hiện 5 tx gần nhất với link explorer.

```typescript
// dApp đăng ký tx
manager.addTransaction({
  hash: "ABC123",
  description: "Swap 10 XRP → 5 USDT",
  status: "pending"
});
// Panel tự update khi tx_confirmed/tx_failed

// Hoặc để kit tự fetch từ PortfolioFetcher nếu được cấu hình
```

Effort: **S (2 ngày)**.

---

**Deliverable cuối Tháng 2:**
- `@xrpl-wallet-kit/nft` publish lên npm
- `@xrpl-wallet-kit/portfolio` publish lên npm
- `0.2.0` release bao gồm tất cả P2 features
- Example mới: `examples/nft-gallery/` — Vite app hiện NFT gallery + portfolio
- Storybook (hoặc đơn giản hơn: `/examples/ui-playground/`) cho component UI

---

## Pha 3 — Tháng 3: Telegram Mini App Wallet

Đây là ứng dụng thực chiến đầu tiên dùng toàn bộ kit. Mục tiêu là build một ví XRPL hoàn chỉnh chạy trong Telegram, dùng đúng những package đã xây dựng.

### Tổng quan ứng dụng

**Tên:** XRP Wallet for Telegram (tên tạm)  
**Platform:** Telegram Mini App (TWA — Telegram Web App)  
**Stack:** React + Vite + `@xrpl-wallet-kit/*`  
**Môi trường:** Chạy trong WebView của Telegram — không có browser extension, không có QR scanner tự nhiên

---

### Tuần 9–10: Telegram Adapter + Core Adjustments

**Challenge đặc thù của môi trường Telegram:**

| Vấn đề | Giải pháp |
|--------|-----------|
| Không có window.xrpl (extension) | Dùng Xaman deeplink hoặc WalletConnect |
| WebView hạn chế — không popup | Modal phải inline, không dùng `position: fixed` |
| User đã có Telegram account | Auth bằng `initData` của Telegram, không cần SIWE riêng |
| Touch-only, màn hình nhỏ | UI responsive, bottom-sheet pattern thay vì dialog |
| Không có clipboard API đầy đủ | Copy address dùng Telegram.WebApp.HapticFeedback |

**Package mới: `@xrpl-wallet-kit/adapter-telegram`**

```
packages/adapters/telegram/
  src/
    index.ts         TelegramWalletAdapter — wrap WalletConnect + Xaman deeplink
    twa-bridge.ts    Telegram WebApp API bridge
    storage.ts       TelegramStorage — dùng CloudStorage của Telegram thay vì localStorage
```

```typescript
// TelegramWalletAdapter — không inject window, dùng WalletConnect QR hoặc Xaman deeplink
export class TelegramWalletAdapter extends BaseWalletAdapter {
  metadata = {
    id: "telegram",
    name: "Connect via WalletConnect",
    type: "walletconnect",
    // ...
  };

  // Dùng Telegram.WebApp.CloudStorage để persist session
  // Không dùng localStorage (bị clear giữa các session TWA)
}
```

**TelegramStorage — replace localStorage:**

```typescript
// Telegram cung cấp CloudStorage API — persist qua sessions
class TelegramStorage implements WalletStorage {
  async get(key: string): Promise<string | null> {
    return new Promise((resolve) => {
      Telegram.WebApp.CloudStorage.getItem(key, (err, value) => {
        resolve(err ? null : value ?? null);
      });
    });
  }
  async set(key: string, value: string): Promise<void> { ... }
  async remove(key: string): Promise<void> { ... }
}
```

**Core adjustment — Modal bottom-sheet mode:**

Bổ sung `displayMode: "bottom-sheet"` cho `WalletModal` — thay vì dialog trung tâm, modal slide từ dưới lên (pattern chuẩn của mobile app).

```typescript
createWalletKit({
  ui: {
    displayMode: "bottom-sheet",  // default: "dialog"
    // bottom-sheet: full width, max-height 85vh, border-radius chỉ trên
  }
})
```

Effort: **M–L (7 ngày)**. `TelegramStorage` là phần quan trọng nhất vì CloudStorage API là callback-based.

---

### Tuần 11–12: Build Telegram Wallet MVP

**App structure:**

```
apps/
  telegram-wallet/         ← NEW app
    src/
      App.tsx
      pages/
        Home.tsx           Dashboard: số dư XRP + top tokens
        Portfolio.tsx      Token list + giá tương đối
        NFTs.tsx           NFT gallery
        Send.tsx           Form gửi XRP/token
        History.tsx        Transaction history
        Settings.tsx       Network, ngôn ngữ, disconnect
      components/
        BottomNav.tsx      5-tab navigation
        AddressCard.tsx    Address display + copy + QR
        TokenRow.tsx       Token list item
        NftCard.tsx        NFT thumbnail card
      hooks/
        useWallet.ts       Wrap useWalletKit() + Telegram-specific
        usePortfolio.ts    Wrap PortfolioFetcher với react-query
        useNfts.ts         Wrap NftFetcher
      lib/
        telegram.ts        Telegram.WebApp helpers
        kit.ts             WalletKit instance (singleton)
```

**Màn hình Home — Dashboard:**

```
┌─────────────────────────────────┐
│  [Avatar] rXXXX...1234   [⋮]   │
│                                 │
│        1,234.56 XRP             │
│       ≈ $742.00 USD             │
│                                 │
│  [Gửi]  [Nhận]  [Lịch sử]     │
│                                 │
│  Token                          │
│  USD (Bitstamp)    50.00        │
│  SOLO              100.00       │
│                                 │
│  NFTs (3)          [Xem tất cả]│
│  [img] [img] [img]              │
└─────────────────────────────────┘
│ 🏠 Home │ 💼 Portfolio │ 🖼 NFT │ 🕐 Lịch sử │ ⚙ Settings │
```

**Flow kết nối ví:**

```
Mở app Telegram
    ↓
TelegramStorage.get("wallet-session") → có session?
    │ YES                       NO
    ↓                           ↓
restoreSession()           Hiện connect sheet
    │                           ↓
    ↓                      Chọn: WalletConnect | Xaman
Dashboard                       ↓
                          Scan QR hoặc deeplink → Xaman app
                               ↓
                          Approved → session lưu vào CloudStorage
                               ↓
                          Dashboard
```

**Tích hợp các package đã build:**

```typescript
// kit.ts — khởi tạo một lần
export const kit = createWalletKit({
  adapters: [
    createWalletConnectAdapter({ projectId: import.meta.env.VITE_WC_PROJECT_ID }),
    createXamanAdapter({ clientId: import.meta.env.VITE_XAMAN_CLIENT_ID }),
  ],
  storage: new TelegramStorage(),
  ui: {
    locale: "vi",
    displayMode: "bottom-sheet",
    theme: "dark"  // Telegram dark mode default
  }
});

// hooks/usePortfolio.ts — data layer
const portfolio = new PortfolioFetcher({ rpcUrl: XRPL_NODE });
const nftFetcher = new NftFetcher({ rpcUrl: XRPL_NODE });

export function useXrpBalance(address: string) {
  return useQuery({
    queryKey: ["balance", address],
    queryFn: () => portfolio.getXrpBalance(address),
    refetchInterval: 10_000  // poll mỗi 10 giây
  });
}
```

**Tích hợp WalletToast:**

```typescript
// App.tsx
useEffect(() => {
  const toast = new WalletToast({
    manager: kit.manager,
    position: "bottom-center",  // Telegram thường có bottom nav
    autoDismissMs: 4000
  });
  toast.mount();
  return () => toast.destroy();
}, []);
```

**Deploy:**

```
apps/telegram-wallet/
  ├── dist/           ← Vite build output
  ├── Dockerfile      ← Serve với nginx
  └── .env.example   ← VITE_WC_PROJECT_ID, VITE_XAMAN_CLIENT_ID, VITE_BOT_TOKEN
```

Telegram Bot cần BotFather setup: `/newapp` → trỏ vào URL của app đã deploy.

Effort: **L (9 ngày)**. React + TanStack Query + kit integration.

---

**Deliverable cuối Tháng 3:**
- `@xrpl-wallet-kit/adapter-telegram` publish lên npm
- `apps/telegram-wallet/` trong monorepo — có thể deploy độc lập
- `0.3.0` release
- Hướng dẫn deploy lên Vercel/Railway cho Telegram Mini App
- Bot Telegram demo để test

---

## Ma trận effort tổng hợp

| # | Feature / Task | Effort | Sprint |
|---|----------------|--------|--------|
| — | Bug fixes C3, C1, H1, H2, H4 | M (6 ngày) | T1–W1 |
| — | Bug fixes H3, M3, L1, L2 | S (3 ngày) | T1–W2 |
| 1 | Sign-In with XRPL | M (5 ngày) | T1–W3 |
| 2 | Transaction Toast | S–M (4 ngày) | T1–W3 |
| 3 | Localization (en, vi, ja, zh) | S–M (4 ngày) | T1–W4 |
| 4 | NFT Kit (`@xrpl-wallet-kit/nft`) | L (8 ngày) | T2–W5–6 |
| 5 | Account Activation Guard | S (2 ngày) | T2–W6 |
| 6 | Portfolio Kit (`@xrpl-wallet-kit/portfolio`) | M (6 ngày) | T2–W7 |
| 7 | Trust Line Warning | M (3 ngày) | T2–W7 |
| 8 | Recent Transactions Panel | S (2 ngày) | T2–W8 |
| 9 | Telegram Adapter + TelegramStorage | M–L (7 ngày) | T3–W9–10 |
| 10 | Bottom-sheet modal mode | S (2 ngày) | T3–W9 |
| 11 | Telegram Wallet App MVP | L (9 ngày) | T3–W11–12 |

**Buffer:** Mỗi tuần dự trù 20% cho review, bug từ QA, và tài liệu.

---

## Team đề xuất

| Vai trò | Số người | Công việc chính |
|---------|----------|-----------------|
| Core Engineer | 1–2 | WalletManager, adapter fixes, new adapters |
| UI Engineer | 1 | Toast, NFT UI components, bottom-sheet |
| Full-stack (Telegram) | 1–2 | Telegram adapter, TWA app, deploy |
| QA / Tech writer | 0.5 | Test cases, changelog, SDK docs |

Team 3–4 người là đủ cho lộ trình này nếu mỗi tuần đạt 4–5 ngày lập trình thực.

---

## Rủi ro & Giảm thiểu

| Rủi ro | Khả năng | Tác động | Giảm thiểu |
|--------|----------|----------|------------|
| Xaman deeplink hoạt động không ổn định trong TWA WebView | Trung bình | Cao | Test sớm tuần 9, có fallback WalletConnect QR |
| Telegram CloudStorage API bị giới hạn tốc độ hoặc quota | Thấp | Trung bình | Cache local trong memory, chỉ sync khi cần |
| XRPL NFT metadata IPFS chậm / không resolve được | Cao | Trung bình | Timeout 5s, fallback placeholder, cache aggressive |
| WalletConnect v2 session bị drop trong TWA (background) | Trung bình | Cao | Implement reconnect logic, hiện banner "Reconnect" |
| XRPL EVM Sidechain thay đổi API trước tháng 3 | Thấp | Thấp | Theo dõi XRPL Foundation announcements |

---

## Tiêu chí hoàn thành

**Cuối Tháng 1 — Beta `0.1.0`:**
- [ ] 0 bug severity Critical/High còn mở
- [ ] Test coverage ≥ 60 test cases
- [ ] Sign-In, Toast, i18n hoạt động trong example vanilla
- [ ] npm publish thành công cho tất cả packages hiện có

**Cuối Tháng 2 — Minor `0.2.0`:**
- [ ] `@xrpl-wallet-kit/nft` fetch và hiện NFT gallery với metadata
- [ ] `@xrpl-wallet-kit/portfolio` hiện balance + tokens + history
- [ ] Trust Line Warning trigger đúng trường hợp
- [ ] Example NFT gallery deploy được lên Vercel

**Cuối Tháng 3 — Minor `0.3.0` + App:**
- [ ] Telegram Wallet chạy được trong Telegram production
- [ ] Connect qua WalletConnect hoặc Xaman thành công
- [ ] Gửi XRP và xem NFT hoạt động end-to-end
- [ ] `@xrpl-wallet-kit/adapter-telegram` publish lên npm
- [ ] Hướng dẫn deploy đầy đủ cho developer khác dùng kit xây Telegram app

---

## Ghi chú ưu tiên cuối

Nếu phải cắt scope, thứ tự ưu tiên như sau:

1. **Giữ nguyên:** Bug fixes Tháng 1 (không thể bỏ — beta release không thể có C/H bugs)
2. **Giữ nguyên:** NFT Kit + Portfolio Kit (differentiator — không có trên XRPL hiện tại)
3. **Giữ nguyên:** Telegram Wallet App (proof of concept thực chiến cho SDK)
4. **Có thể trễ:** Sign-In with XRPL → dời sang `0.2.0`
5. **Có thể trễ:** Localization → bắt đầu với en + vi, thêm ja/zh sau
6. **Có thể cắt:** Transaction Preview (P2 feature — dApp có thể tự implement)
