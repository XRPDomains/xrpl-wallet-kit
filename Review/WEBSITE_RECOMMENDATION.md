# Website Docs — Đề xuất cải tiến

**Ngày:** 2026-06-18  
**So sánh với:** [ConnectKit docs](https://family.co/docs/connectkit) · [RainbowKit docs](https://rainbowkit.com/docs/introduction)  
**Hiện trạng:** VitePress, đã build, có nội dung cơ bản đầy đủ

---

## Đánh giá hiện trạng

Site hiện tại đã có nền tảng tốt: VitePress, local search, PlaygroundWidget Vue component, dark mode, custom.css đã tune. Nội dung đủ cho beta. Nhưng so với ConnectKit/RainbowKit còn thiếu một số mảng quan trọng sẽ ảnh hưởng đến adoption.

**Điểm mạnh hiện tại:**
- Structure rõ ràng (Getting Started → Config → Adapters → API)
- Code examples chất lượng tốt, đúng với API thực
- Playground page là unique selling point so với nhiều SDK khác
- Adapter docs đầy đủ cho cả 8 wallets

**3 khoảng trống lớn nhất so với ConnectKit/RainbowKit:**
1. Không có **framework-specific guides** (React, Next.js, HTML/jQuery) — nhưng coder đã làm `packages/react` và `packages/next`
2. Không có **Advanced section** — headless usage, custom adapter, events/hooks
3. Không có **Authentication section** — đang được build trong packages/auth

---

## Đề xuất cấu trúc sidebar mới

So sánh trực tiếp với RainbowKit (bên trái) → xrpl-wallet-kit đề xuất (bên phải):

```
RainbowKit                          XRPL Wallet Kit (đề xuất)
─────────────────────────────       ──────────────────────────────────────

### Overview                        ### Getting Started
Introduction                        Introduction
Migration Guide                     Installation              ← cần cải thiện
                                    Quick Start
### Getting Started                 Playground
Installation
ConnectButton                       ### Frameworks             ← MỚI
Modal Sizes                         React
Theming                             Next.js
Chains                              Vanilla TypeScript
Localization                        Plain HTML / jQuery
Authentication
Recent Transactions                 ### Configuration
                                    Connect Button             ← tách ra
### Advanced                        Theming
Modal Hooks                         Networks
Custom ConnectButton                Localization (i18n)
Custom Theme
Custom Wallet List                  ### Authentication          ← MỚI (khi auth ship)
Custom Wallets                      Sign In with XRPL
Custom Chains                       Next.js Setup
Custom App Info                     Custom Backend
Custom Avatars
Custom Authentication               ### Adapters
WalletButton                        Overview
Cool Mode                           [8 adapters...]

                                    ### Advanced               ← MỚI
                                    Events & Hooks
                                    Custom Adapter
                                    Headless Core
                                    Bundle & Performance

                                    ### API Reference
                                    WalletManager
                                    WalletModal
                                    Errors

                                    ### Guides
                                    Going Live
                                    Migration Guide
                                    Examples

                                    ### Community
                                    GitHub
                                    X (Twitter)
```

---

## Phân tích từng mảng

### 1. Frameworks section — Độ ưu tiên: Cao ⭐

Đây là mảng thiếu lớn nhất, nhất là khi coder đã làm xong `packages/react` và `packages/next`.

**Các trang cần tạo:**

#### `docs/frameworks/react.md`
```md
# React

Install React bindings:
npm install @xrpl-wallet-kit/react

import { WalletKitProvider, useWalletKit } from "@xrpl-wallet-kit/react";

function App() {
  return (
    <WalletKitProvider manager={manager}>
      <YourApp />
    </WalletKitProvider>
  );
}

function ConnectButton() {
  const { openModal, session } = useWalletKit();
  return session
    ? <span>{session.account.address}</span>
    : <button onClick={openModal}>Connect Wallet</button>;
}
```
→ Cover: Provider setup, hooks (useWalletKit, useWalletSession, useWalletAccount, useWalletStatus), WalletButton component, SSR caveat

#### `docs/frameworks/next.md`
```md
# Next.js

import { WalletKitProvider } from "@xrpl-wallet-kit/next";
// "use client" is handled automatically
```
→ App Router setup, provider placement (root layout), SSR guard, dynamic import pattern

#### `docs/frameworks/vanilla.md`
Đây chính là nội dung quick-start hiện tại, chuyển vào đây và giữ quick-start là entry point ngắn gọn hơn.

#### `docs/frameworks/html-legacy.md`
Adapt từ `Review/AUTH_LEGACY_HTML_EXAMPLE.md` (phần non-auth). Đây là content độc đáo mà ConnectKit không có — plain HTML + jQuery với IIFE bundle.

---

### 2. Advanced section — Độ ưu tiên: Cao ⭐

RainbowKit Advanced có 11 trang. Xrpl-wallet-kit cần ít nhất 4:

#### `docs/advanced/events-hooks.md` — Modal Events & WalletManager Events
```ts
// WalletManager events
manager.on("connect", (result) => { ... });
manager.on("disconnect", () => { ... });
manager.on("error", (err) => { ... });
manager.on("sessionRestored", (session) => { ... });

// WalletModal events (DOM)
modal.onOpen(() => { ... });
modal.onClose(() => { ... });
```
→ Liệt kê tất cả events, payload types, unsubscribe pattern

#### `docs/advanced/custom-adapter.md` — Write Your Own Adapter
Highlight skill/doc đã có trong `skills/xrpl-wallet-kit-adapter-developer/`. Nội dung: BaseWalletAdapter extension, adapter contract, metadata object, required methods.

#### `docs/advanced/headless.md` — Use Core Without UI
```ts
// Không dùng @xrpl-wallet-kit/ui
import { WalletManager } from "@xrpl-wallet-kit/core";
// Build your own UI, wire up to manager events
```
→ Cho team muốn build UI riêng từ headless core

#### `docs/advanced/bundle-performance.md` — Bundle & Performance
- Per-package bundle sizes (core 5.7KB, ui 12KB, full client, browser IIFE 528KB gzip)
- Tree-shaking — chỉ install adapters cần dùng
- WalletConnect dynamic import (đã làm PERF-4)
- Recommendation: không dùng IIFE cho production

---

### 3. Configuration — Connect Button riêng — Độ ưu tiên: Trung bình

RainbowKit có hẳn trang `ConnectButton` trong Getting Started vì đó là API trung tâm nhất của users. Tương tự, xrpl-wallet-kit nên tách `WalletButton` ra thành trang riêng thay vì chỉ nói qua trong Quick Start.

`docs/configuration/connect-button.md`:
- WalletButton constructor options
- Tất cả display states: disconnected → connecting → connected → account panel
- Tùy chỉnh label, size, icon
- Headless alternative (custom button + `manager.connect()`)

---

### 4. Authentication section — Độ ưu tiên: Cao (nhưng blocked) 🚧

Blocked cho đến khi `packages/auth` ship. Nhưng nên tạo placeholder pages ngay để người đọc biết tính năng này đang coming.

```
docs/authentication/
  introduction.md   ← "Coming soon — packages/auth"
  nextjs.md         ← Next.js + express backend
  custom-backend.md ← Custom backend guide (adapt từ AUTH_LEGACY_HTML_EXAMPLE.md)
```

---

### 5. Guides section — Độ ưu tiên: Trung bình

#### `docs/guides/going-live.md` — Production Checklist
ConnectKit có trang Going Live riêng. Đây là trust signal quan trọng.

Nội dung:
```md
# Going Live

Before shipping your XRPL dApp to production:

## ✅ Setup
- [ ] Replace VITE_WALLETCONNECT_PROJECT_ID with your own project ID from WalletConnect Cloud
- [ ] Replace VITE_XAMAN_CLIENT_ID with your registered Xaman client ID
- [ ] Set network to MAINNET (not TESTNET)
- [ ] Verify session storage prefix doesn't conflict with other apps

## ✅ Bundle
- [ ] Using individual packages, not the IIFE browser bundle
- [ ] Tree-shaking enabled (check bundler config)
- [ ] WalletConnect dynamic import configured

## ✅ UI/UX
- [ ] Test on mobile (Xaman QR scan, WalletConnect mobile pairing)
- [ ] Dark mode tested
- [ ] Wallet not installed state shows install link

## ✅ Error handling
- [ ] WalletError codes handled: UserRejected, NotConnected, SignFailed
- [ ] Network error (user on wrong network) shown clearly

## ✅ Security
- [ ] No private keys or wallet secrets in client code
- [ ] Environment variables not exposed in build output
```

#### `docs/guides/migration.md`
Sẽ quan trọng khi có breaking changes (v0.2.0+). Tạo skeleton ngay:
```md
# Migration Guide

## v0.1.x → v0.2.0
*No breaking changes yet — updates will be listed here.*
```

---

### 6. Cải thiện trang Installation hiện tại — Độ ưu tiên: Cao

RainbowKit Installation có tab switcher cho npm/yarn/pnpm/bun. VitePress hỗ trợ `::: code-group` natively.

**Thay đổi trong `docs/installation.md`:**

```md
::: code-group
```sh [npm]
npm install @xrpl-wallet-kit/core @xrpl-wallet-kit/ui
```
```sh [yarn]
yarn add @xrpl-wallet-kit/core @xrpl-wallet-kit/ui
```
```sh [pnpm]
pnpm add @xrpl-wallet-kit/core @xrpl-wallet-kit/ui
```
:::
```

Ngoài ra cần thêm:
- Quick install table: mỗi adapter với package name và khi nào dùng
- StackBlitz link (nếu có example) hoặc hướng dẫn clone example
- Peer dependency note (TypeScript >=5.0)

---

### 7. Landing page (index.md) — Độ ưu tiên: Thấp nhưng visible

ConnectKit có hero animation/video. RainbowKit có video embed. Trang home của xrpl-wallet-kit hiện đang dùng VitePress default home layout với icon + features grid — trông ổn nhưng thiếu visual punch.

**Đề xuất cụ thể (không cần custom component phức tạp):**

a) Thêm screenshot modal vào hero image thay vì logo SVG đơn giản:
```yaml
hero:
  image:
    src: /screenshots/modal-demo.png   # screenshot thực của modal
    alt: XRPL Wallet Kit modal preview
```

b) Thêm 2 button: "Get Started" + "View Playground" (không chỉ View on GitHub):
```yaml
actions:
  - theme: brand
    text: Get Started
    link: /docs/introduction
  - theme: alt
    text: Live Playground →
    link: /docs/playground
  - theme: alt
    text: GitHub
    link: https://github.com/...
```

c) Thêm feature cards dưới đây là điểm mạnh thực tế:
```yaml
features:
  - icon: 🎭
    title: Interactive Playground
    details: Test the wallet modal live in your browser — no setup required.
    link: /docs/playground
    linkText: Try it now
```

---

## Tổng hợp todo theo priority

### Tuần 1 — Ngay bây giờ (content có thể viết, code đã có)

| Trang | Mô tả | Effort |
|---|---|---|
| `docs/frameworks/react.md` | React bindings guide | S |
| `docs/frameworks/next.md` | Next.js App Router setup | S |
| `docs/frameworks/vanilla.md` | Reorganize từ quick-start | XS |
| `docs/frameworks/html-legacy.md` | Adapt từ AUTH_LEGACY_HTML_EXAMPLE.md | S |
| `docs/advanced/events-hooks.md` | WalletManager + Modal events | S |
| `docs/advanced/bundle-performance.md` | Bundle sizes, tree-shaking | XS |
| `docs/guides/going-live.md` | Production checklist | XS |
| `docs/guides/migration.md` | Skeleton — điền sau | XS |
| Cập nhật `docs/installation.md` | code-group tabs | XS |
| Cập nhật `config.ts` sidebar | Thêm các section mới | XS |

### Tuần 2-3 — Sau khi auth package ship

| Trang | Mô tả | Effort |
|---|---|---|
| `docs/authentication/introduction.md` | Sign In With XRPL overview | S |
| `docs/authentication/nextjs.md` | Next.js + Iron Session example | M |
| `docs/authentication/custom-backend.md` | Express backend example | M |
| `docs/advanced/custom-adapter.md` | Write your own adapter | M |
| `docs/advanced/headless.md` | Headless core guide | S |

### Tháng 2+ — Nice to have

| Feature | Mô tả | Effort |
|---|---|---|
| Interactive Theme Builder | Vue component thay đổi theme realtime | L |
| OG image mỗi trang | `og:image` per-page | M |
| StackBlitz embed | Embed live example trực tiếp trong docs | M |
| Screenshot/GIF hero | Thay logo bằng modal screenshot | XS |
| Algolia DocSearch | Nếu site public và muốn search tốt hơn | S |
| `/docs/configuration/connect-button.md` | WalletButton dedicated page | S |

---

## Config thay đổi ngay trong `config.ts`

```ts
sidebar: [
  {
    text: "Getting Started",
    items: [
      { text: "Introduction", link: "/docs/introduction" },
      { text: "Installation", link: "/docs/installation" },
      { text: "Quick Start", link: "/docs/quick-start" },
      { text: "Playground", link: "/docs/playground" },
    ],
  },
  {
    text: "Frameworks",           // ← MỚI
    items: [
      { text: "React", link: "/docs/frameworks/react" },
      { text: "Next.js", link: "/docs/frameworks/next" },
      { text: "Vanilla TypeScript", link: "/docs/frameworks/vanilla" },
      { text: "Plain HTML / jQuery", link: "/docs/frameworks/html-legacy" },
    ],
  },
  {
    text: "Configuration",
    items: [
      { text: "Connect Button", link: "/docs/configuration/connect-button" }, // ← MỚI
      { text: "Theming", link: "/docs/configuration/theming" },
      { text: "Networks", link: "/docs/configuration/networks" },
      { text: "Localization (i18n)", link: "/docs/configuration/i18n" },
    ],
  },
  {
    text: "Authentication",       // ← MỚI (coming soon)
    collapsed: true,
    items: [
      { text: "Sign In with XRPL", link: "/docs/authentication/introduction" },
      { text: "Next.js Setup", link: "/docs/authentication/nextjs" },
      { text: "Custom Backend", link: "/docs/authentication/custom-backend" },
    ],
  },
  {
    text: "Adapters",
    items: [
      { text: "Overview", link: "/docs/adapters/overview" },
      { text: "Xaman", link: "/docs/adapters/xaman" },
      { text: "GemWallet", link: "/docs/adapters/gemwallet" },
      { text: "WalletConnect", link: "/docs/adapters/walletconnect" },
      { text: "Crossmark", link: "/docs/adapters/crossmark" },
      { text: "Ledger (Hardware)", link: "/docs/adapters/ledger" },
      { text: "Dropfi", link: "/docs/adapters/dropfi" },
      { text: "XRPL Snap (MetaMask)", link: "/docs/adapters/xrpl-snap" },
      { text: "Otsu Wallet", link: "/docs/adapters/otsu" },
    ],
  },
  {
    text: "Advanced",             // ← MỚI
    items: [
      { text: "Events & Hooks", link: "/docs/advanced/events-hooks" },
      { text: "Custom Adapter", link: "/docs/advanced/custom-adapter" },
      { text: "Headless Core", link: "/docs/advanced/headless" },
      { text: "Bundle & Performance", link: "/docs/advanced/bundle-performance" },
    ],
  },
  {
    text: "API Reference",
    items: [
      { text: "WalletManager", link: "/docs/api/wallet-manager" },
      { text: "WalletModal", link: "/docs/api/wallet-modal" },
      { text: "Errors", link: "/docs/api/errors" },
    ],
  },
  {
    text: "Guides",               // ← MỚI
    items: [
      { text: "Going Live", link: "/docs/guides/going-live" },
      { text: "Migration Guide", link: "/docs/guides/migration" },
    ],
  },
],
```

---

## So sánh nhanh với ConnectKit / RainbowKit

| Feature | ConnectKit | RainbowKit | xrpl-wallet-kit hiện tại | Sau cải tiến |
|---|:---:|:---:|:---:|:---:|
| Framework guides (React/Next) | ✅ | ✅ | ❌ | ✅ |
| Plain HTML / Legacy guide | ❌ | ❌ | ❌ | ✅ (unique!) |
| Authentication guide | ✅ | ✅ | ❌ | 🔲 (auth WIP) |
| Advanced section | ✅ | ✅ (11 pages) | ❌ | ✅ (4 pages) |
| Migration guide | ✅ | ✅ | ❌ | ✅ (skeleton) |
| Going Live checklist | ✅ | ❌ | ❌ | ✅ |
| Interactive playground | ✅ (Try It Out) | CodeSandbox | ✅ | ✅ |
| Interactive Theme Builder | ✅ | ❌ | ❌ | 🔲 (V2) |
| Package manager tabs | ✅ | ✅ | ❌ | ✅ (code-group) |
| API Reference | ✅ | ❌ (slim) | ✅ | ✅ |
| Custom adapter guide | ❌ | ✅ | ❌ (in skill only) | ✅ |
| Video/demo hero | ✅ | ✅ | ❌ | 🔲 (V2) |

**Unique advantage của xrpl-wallet-kit:** Plain HTML/jQuery guide và Playground trực tiếp trên website là điểm không ai có trong XRPL ecosystem.

---

*Generated: 2026-06-18 | Ref: family.co/docs/connectkit, rainbowkit.com/docs/introduction*
