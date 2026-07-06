# xrpl-wallet-kit — Architecture, Product Model & Market Review

**Reviewer:** Senior Engineer / Product Architect
**Date:** 2026-05-26
**Scope:** Kiến trúc, tổ chức code, product model, so sánh thị trường, đề xuất cải tiến

---

## 1. Kiến trúc (Architecture)

### 1.1 Sơ đồ dependency

```
window.XRPLWalletKit   ← browser (IIFE + Buffer polyfill)
         ↑
       client           ← convenience re-export: core + ui + all adapters
      ↙     ↘
   react    next        ← framework bindings (React context, "use client")
      ↑
    ui  ←  core  ← adapters/*
```

Dependency flow là **một chiều nghiêm ngặt**: `core` không biết `ui`, `ui` không biết `adapters`, `adapters` không biết nhau. Đây là điểm mạnh kiến trúc rõ ràng nhất — dễ tree-shake, dễ test từng layer độc lập.

### 1.2 Điểm mạnh kiến trúc

**Headless core thực sự.** `WalletManager` không import bất kỳ DOM API nào. Có thể chạy trong Node, Web Worker, hay React Native (giả sử custom storage). Hiếm thấy ở thư viện cùng loại.

**Adapter contract rõ ràng + có validator.** `assertWalletAdapter()` / `validateWalletAdapter()` giúp third-party adapter authors không thể đoán nhầm về contract. Đây là design decision đúng — Solana wallet-adapter không có validator tương đương, dẫn đến nhiều community adapter implementation không nhất quán.

**Event-driven + type-safe.** `WalletEventEmitter` với typed event map (`WalletEvents`) — consumer có autocomplete khi gọi `manager.on("connected", ...)`. Phần lớn thư viện tương tự chỉ dùng `string` event name.

**Session storage decoupled.** `WalletStorage` interface injection cho phép app swap localStorage → sessionStorage → IndexedDB mà không cần sửa SDK. Wagmi v2 không có abstraction tương đương ở level này.

**Three distribution paths.** ESM packages cho modern bundler, React/Next bindings, và IIFE bundle cho legacy jQuery/plain HTML. Không có thư viện wallet adapter nào trên thị trường hiện tại phục vụ cả ba đối tượng này từ cùng một codebase.

### 1.3 Điểm yếu kiến trúc

**Không có reactive state layer.** `WalletManager` là event emitter — consumer phải tự subscribe, tự unsubscribe, tự sync với UI state. React hook `useWalletKit()` trả về object từ `useMemo` dựa trên manager instance, nhưng không có caching hay reactive re-fetch. Với wagmi, `useAccount()` tự biết khi nào re-render vì dùng TanStack Query bên dưới. Với XRPL Kit, developer phải tự `manager.on("connected", setState)`.

**Single account per session.** `WalletSession.account` là một object duy nhất. Ledger hỗ trợ nhiều account (BIP44 path), Crossmark cũng vậy — nhưng SDK không có concept `accounts[]`. Developer muốn "switch account" phải disconnect/reconnect hoàn toàn.

**Không có typed transaction builder.** `signAndSubmit` nhận `txJson: Record<string, unknown>` — không có type-safe XRPL transaction helpers. Với Solana, `@solana/web3.js` cung cấp transaction types; EVM có Viem. XRPL dev phải tự build transaction object với risk typo field name.

**Bundle size không được track.** Không có `size-limit` hay bundlesize CI check. `@xrpl-wallet-kit/client` re-export tất cả adapters — developer cần tree-shake thủ công bằng cách import từng adapter riêng.

---

## 2. Tổ chức Code (Code Organization)

### 2.1 Điểm tốt

- Monorepo với npm workspaces — build và typecheck đồng bộ.
- Mỗi adapter là một package độc lập — developer chỉ install những gì cần.
- `docs/adapters/` và `skills/` có hướng dẫn chi tiết cho adapter author — không nhiều thư viện có đầu tư này.
- Examples phân tách rõ: `vanilla/` (Vite + TS) và `html-jquery/` (plain HTML) — hai use case rất khác nhau đều được cover.

### 2.2 Điểm cần cải thiện

**Không có `size-limit` config.** Dễ accidentally ship adapter nặng mà không hay.

**Test coverage còn thấp.** 1 file test, 13 test cases, chỉ cover core. Adapter implementations không có unit test — risk regression cao khi sửa adapter.

**`examples/` import trực tiếp từ `packages/*/src` thay vì qua built dist.** Điều này che đi lỗi package export — bài test thực tế phải dùng `dist/` build.

**Không có Storybook hay component playground** cho `@xrpl-wallet-kit/ui`. Contributor muốn thay đổi modal layout phải chạy full Vite dev server.

---

## 3. Product Model

### 3.1 Positioning hiện tại

```
Headless core                          Full-featured UI kit
     │                                        │
  wagmi ──────────────────────────── RainbowKit / AppKit
     │                                        │
  xrpl-wallet-kit  ←── đây ─────────  (chưa có trên XRPL)
```

XRPL Wallet Kit chọn vị trí **"headless-first với optional UI"** — đúng với thị trường XRPL vốn nhỏ, đa dạng về app shell (dApps có React, có jQuery legacy, có mobile WebView).

### 3.2 Ba nhóm người dùng thực tế

| Nhóm | Cần gì | XRPL Kit phục vụ được không |
|------|--------|---------------------------|
| **XRPL dApp mới** (React/Vite) | Hook đơn giản, UI sẵn, support Xaman + GemWallet | ✅ Tốt với `@xrpl-wallet-kit/react` |
| **App legacy** (jQuery, server-render) | Drop-in script tag, không cần bundler | ✅ Tốt với IIFE bundle |
| **Platform / marketplace** | Custom wallet UI hoàn toàn, control tuyệt đối | ✅ Tốt với headless core + adapter list |

Nhóm thứ 4 **chưa được phục vụ tốt**:

| Nhóm | Cần gì | Hiện tại |
|------|--------|----------|
| **NFT marketplace phức tạp** | Multi-account, balance fetch, tx history, reactive hooks | ❌ Thiếu |
| **Mobile app** (React Native) | Native provider bridge, deep link handling | ⚠️ Chỉ qua WalletConnect/Xaman deeplink |
| **Server-side** | Verify wallet signature | ❌ Không có utility |

### 3.3 Mô hình phân phối

Hiện tại phân phối dưới dạng npm packages — đúng hướng. Nhưng thiếu:
- **CDN-hosted IIFE** (jsDelivr / unpkg) — hiện tại dev phải tự host, giảm barrier to entry cho legacy apps.
- **Version changelog** — không có CHANGELOG.md. Khi update `0.1.x → 0.2.0`, developer không biết gì đã đổi.

---

## 4. So Sánh Thị Trường

### 4.1 Đối thủ trực tiếp: xrpl-connect (XRPL-Commons)

Đây là đối thủ gần nhất — cùng target XRPL, cùng adapter-based architecture, cùng framework-agnostic positioning. Đáng phân tích kỹ.

**Tổng quan xrpl-connect:**
- Repo: [XRPL-Commons/xrpl-connect](https://github.com/XRPL-Commons/xrpl-connect) — 18 stars, 8 forks, v0.8.2 (May 2026)
- Single-package install: `npm install xrpl-connect xrpl`
- Docs public và live: [xrpl-commons.github.io/xrpl-connect](https://xrpl-commons.github.io/xrpl-connect/)
- Build toolchain: Turborepo + pnpm + tsup (hiện đại hơn)
- 7 adapters: Xaman, Crossmark, GemWallet, WalletConnect, Ledger, **Xyra**, **Otsu**

**So sánh điểm-đến-điểm:**

| Feature | xrpl-connect | xrpl-wallet-kit | Nhận xét |
|---------|-------------|----------------|---------|
| **Install DX** | `npm i xrpl-connect` (1 pkg) | `npm i @xrpl-wallet-kit/client + adapters` | ❌ xrpl-wallet-kit phức tạp hơn cho người mới |
| **UI layer** | Web Component (`<xrpl-wallet-connector>`) | DOM class (`WalletModal`) | xrpl-connect: native Web Component hoạt động trong mọi framework kể cả React/Vue không cần wrapper |
| **Docs** | VitePress live site + Interactive Builder + Try It Out | Internal only | ❌ xrpl-wallet-kit thua rõ |
| **Vue / Nuxt** | ✅ có guide và bindings | ❌ không có | ❌ |
| **Typed transactions** | `SubmittableTransaction` từ `xrpl` package — type-safe | `Record<string, unknown>` | ❌ xrpl-wallet-kit thiếu typing |
| **IIFE / legacy HTML** | ❌ không có | ✅ IIFE bundle | ✅ xrpl-wallet-kit dẫn đầu |
| **Xaman mobile flow** | ✅ QR + deeplink | ✅ PKCE + QR + deeplink | ✅ xrpl-wallet-kit sâu hơn (PKCE) |
| **WalletConnect** | Single adapter, no per-wallet config | `details` mode với config per-wallet | ✅ xrpl-wallet-kit linh hoạt hơn |
| **DropFi adapter** | ❌ | ✅ | ✅ |
| **XRPL Snap adapter** | ❌ | ✅ | ✅ |
| **Xyra / Otsu adapter** | ✅ | ❌ | ❌ xrpl-wallet-kit thiếu 2 wallets mới |
| **`accountChanged` event** | ✅ | ❌ | ❌ |
| **`networkChanged` event** | ✅ | ❌ | ❌ |
| **`walletConnectChainId` optional** | ✅ (`walletConnectId?`) | ❌ required | ❌ |
| **Wallet switching** | ❌ `ALREADY_CONNECTED` throws | ✅ đã fix (C3) | ✅ xrpl-wallet-kit đã fix, xrpl-connect chưa |
| **`destroy()` / cleanup** | Không thấy | ✅ đã thêm | ✅ |
| **Adapter contract validator** | ❌ không có | ✅ `assertWalletAdapter()` | ✅ xrpl-wallet-kit hơn rõ |
| **Session schema validation** | Không rõ | ✅ `isValidStoredSession()` | ✅ |
| **CHANGELOG.md** | ✅ | ❌ | ❌ xrpl-wallet-kit thiếu |
| **Interactive customization** | ✅ Online builder | ❌ | ❌ |
| **Build tooling** | Turborepo + tsup | npm workspaces + Vite | Turborepo nhanh hơn với monorepo lớn |

**Tóm tắt so sánh với xrpl-connect:**

xrpl-connect mạnh hơn ở: **DX (install đơn giản), docs công khai, Vue/Nuxt support, typed tx, Interactive Builder, CHANGELOG**. Đây là những thứ developer thấy ngay trước khi viết một dòng code.

xrpl-wallet-kit mạnh hơn ở: **IIFE/legacy bundle, PKCE Xaman flow, per-wallet WalletConnect config (details mode), adapter contract validator, session validation, wallet switching đã fix, DropFi + XRPL Snap adapters, cleanup/destroy pattern**.

**Kết luận:** Nếu developer mới tìm kiếm "XRPL wallet connect" và thấy hai thư viện, xrpl-connect sẽ thắng về first impression vì docs live và install đơn giản. xrpl-wallet-kit vượt trội về depth và production robustness — nhưng những ưu điểm đó không hiển thị trước khi đọc source code.

---

### 4.2 Ecosystem EVM/Solana tương đồng

| | wagmi (EVM) | Solana wallet-adapter | AppKit/Web3Modal | **xrpl-wallet-kit** |
|---|---|---|---|---|
| **Headless core** | ✅ | ✅ | ❌ UI-first | ✅ |
| **Framework agnostic** | ❌ React-only | ❌ React-first | ⚠️ | ✅ |
| **Legacy HTML support** | ❌ | ❌ | ❌ | ✅ IIFE bundle |
| **Hardware wallet** | ✅ via connectors | ⚠️ community | ✅ | ✅ Ledger |
| **Mobile deeplink** | ⚠️ | ⚠️ | ✅ | ✅ Xaman PKCE + WC |
| **Reactive state / caching** | ✅ TanStack Query | ⚠️ | ✅ | ❌ event-only |
| **Multi-account** | ✅ | ✅ | ✅ | ❌ |
| **Tx builder / typing** | ✅ Viem | ✅ web3.js | ✅ | ❌ |
| **Community adapters** | 100+ | 30+ | 50+ | 7 official |
| **Server-side utils** | ✅ | ✅ | ⚠️ | ❌ |
| **Bundle size tracking** | ✅ | ✅ | ✅ | ❌ |
| **Docs quality** | ✅✅ | ✅ | ✅ | ⚠️ internal only |

### 4.3 Competitive advantage thực sự

So với xrpl-connect và mọi thư viện EVM/Solana, xrpl-wallet-kit là thư viện duy nhất làm được đồng thời:
1. **IIFE bundle** cho legacy app (jQuery, plain HTML, server-render) — xrpl-connect không có.
2. **Xaman PKCE flow** — redirect return session recovery, localStorage marker TTL, deeplink — sâu hơn xrpl-connect.
3. **WalletConnect per-wallet config** — `details` mode với QR, deeplink, icon, metadata per wallet.
4. **Adapter contract validator** — `assertWalletAdapter()` — xrpl-connect không có, rủi ro cho third-party adapters.
5. **Session validation + schema guard** — `isValidStoredSession()` trước khi deserialize.
6. **Wallet switching** — xrpl-connect vẫn throw `ALREADY_CONNECTED`, xrpl-wallet-kit đã fix.

**Đây là lợi thế phòng thủ tốt** vì target là XRPL ecosystem — EVM tooling không thể dễ dàng port sang do sự khác biệt của XRPL ledger model (account activation, trust lines, NFTokens, no EVM opcodes...).

### 4.4 Rủi ro cạnh tranh

**xrpl-connect có first-impression tốt hơn hiện tại.** Single package, live docs site, Interactive Builder online, Vue/Nuxt support — developer mới sẽ thử xrpl-connect trước khi tìm đến xrpl-wallet-kit. Nếu không có public docs trước beta, xrpl-wallet-kit có thể mất market share ở nhóm developer mới dù kỹ thuật sâu hơn.

**xrpl-connect đang release nhanh (v0.8.x, 10 releases).** Gap về features — typed tx, Vue, customization builder — có thể thu hẹp. Và khi xrpl-connect fix wallet switching + thêm PKCE Xaman, lợi thế kỹ thuật của xrpl-wallet-kit sẽ nhỏ đi.

**Xaman SDK trực tiếp.** Developer Xaman-only dùng `xumm-sdk` không cần abstraction. Cần thuyết phục multi-wallet value proposition rõ ràng hơn trong README.

**AppKit mở rộng XRPL support.** Nếu Reown/WalletConnect thêm XRPL với full UI kit, cả hai thư viện XRPL đều mất lợi thế UI layer.

---

## 5. Đề Xuất Cải Tiến

### 5.1 Ngắn hạn — trước và trong beta

**5.1.1 Reactive hooks layer cho React**

`useWalletKit()` hiện trả về `{ manager, modal }` — developer phải tự wire state. Cần thêm derived hooks:

```ts
// @xrpl-wallet-kit/react — thêm các hooks này
function useWalletAccount(): WalletAccount | null
function useWalletStatus(): "disconnected" | "connecting" | "connected"
function useWalletAdapter(): WalletAdapter | null
function useWalletCapabilities(): WalletCapabilities | null
```

Không cần TanStack Query ngay — chỉ cần `useState` + `useEffect` subscribe vào manager events. Low effort, high impact cho React developer.

**5.1.2 Bundle size budget**

Thêm `size-limit` vào CI:
```json
// package.json
"size-limit": [
  { "path": "packages/core/dist/index.js", "limit": "15 kB" },
  { "path": "packages/browser/dist/xrpl-wallet-kit.iife.min.js", "limit": "200 kB" }
]
```

**5.1.3 CDN distribution**

Publish IIFE lên npm với tag `@xrpl-wallet-kit/browser` để có thể dùng qua jsDelivr:
```html
<script src="https://cdn.jsdelivr.net/npm/@xrpl-wallet-kit/browser/dist/xrpl-wallet-kit.iife.min.js"></script>
```

**5.1.4 CHANGELOG và semver**

Trước khi publish `0.1.0`, thêm `CHANGELOG.md` và commit convention (conventional commits hoặc changesets). Developer cần biết khi `WalletAdapter` interface thay đổi. xrpl-connect đã có CHANGELOG từ sớm — đây là signal professionalism rõ ràng.

**5.1.5 Public docs site — ưu tiên cao**

xrpl-connect có VitePress docs live với Try It Out và Interactive Builder. Đây là gap lớn nhất về perception. Ngay cả docs đơn giản deploy lên GitHub Pages cũng giúp ích nhiều hơn là không có gì. Tối thiểu cần trước beta:
- Getting Started (Quick Start hiện có trong README là đủ làm base)
- Framework guides: Vanilla JS, React, Next.js
- API Reference auto-generated từ TypeDoc
- Adapter list với link đến wallet homepage

**5.1.6 Typed XRPL transaction helpers**

xrpl-connect dùng `Transaction = SubmittableTransaction` từ package `xrpl` — type-safe, developer có autocomplete. xrpl-wallet-kit dùng `Record<string, unknown>`. Cần:
```ts
// Đơn giản nhất: thêm type alias
import type { SubmittableTransaction } from "xrpl";
export type XrplTxJson = SubmittableTransaction;

// signAndSubmit nhận typed tx
signAndSubmit(request: { txJson: XrplTxJson; ... }): Promise<TxResult>
```
Không cần build tx builder — chỉ cần expose type từ `xrpl` là đủ cho autocomplete.

**5.1.7 Xyra và Otsu adapters**

xrpl-connect đã có hai adapters này. Nên xem xét thêm để không bị tụt về adapter coverage.

---

### 5.2 Trung hạn — sau beta

**5.2.1 Multi-account support**

```ts
// Thêm vào WalletAdapter
listAccounts?: () => Promise<WalletAccount[]>;
switchAccount?: (address: string) => Promise<WalletAccount>;

// WalletSession
accounts?: WalletAccount[];   // tất cả accounts available
account: WalletAccount;        // account đang active
```

Quan trọng với Ledger (5–10 accounts), và nhiều wallet extension đang phát triển multi-account.

**5.2.2 Type-safe XRPL transaction helpers**

Không cần build full tx builder — chỉ cần typed wrappers cho các tx phổ biến:

```ts
// @xrpl-wallet-kit/core — thêm tx helpers
export function buildPayment(params: {
  account: string;
  destination: string;
  amount: string | { currency: string; issuer: string; value: string };
  memos?: string[];
}): XrplPaymentTx

export function buildNFTokenMint(params: { ... }): XrplNFTokenMintTx
export function buildOfferCreate(params: { ... }): XrplOfferCreateTx
```

Giúp developer tránh typo field name (`Destination` vs `destination`) và tăng discoverability qua TypeScript autocomplete.

**5.2.3 Server-side signature verification**

```ts
// @xrpl-wallet-kit/server (Node-only package)
export async function verifyWalletSignature(params: {
  message: string;
  signature: string;
  publicKey: string;
  address: string;
}): Promise<boolean>
```

Login-with-wallet flow ngày càng phổ biến. Hiện tại developer phải tự implement verify logic — error-prone với các edge case encoding.

**5.2.4 Vue và Svelte bindings**

```ts
// @xrpl-wallet-kit/vue
export function useWalletKit(): WalletKitComposable

// @xrpl-wallet-kit/svelte
export const walletStore: Writable<WalletKitState>
```

Vue 3 và SvelteKit đang tăng popularity trong XRPL developer community (đặc biệt ở các thị trường Đông Nam Á). Không cần build ngay — nhưng nên có roadmap public.

---

### 5.3 Dài hạn — ecosystem growth

**5.3.1 Community adapter registry**

Solana wallet-adapter có `@solana/wallet-adapter-wallets` tổng hợp community adapters. XRPL Kit nên có tương tự:

```
packages/adapters/          ← official adapters (maintained by core team)
community/                   ← community-contributed adapters (separate repo, peer review)
  adapter-dcent/
  adapter-tangem/
  adapter-d'CENT/
```

Publish hướng dẫn "how to publish a community adapter" và danh sách `awesome-xrpl-wallet-kit`.

**5.3.2 Reactive data layer (future `@xrpl-wallet-kit/query`)**

Khi ecosystem lớn hơn, nên thêm optional data layer:

```ts
// @xrpl-wallet-kit/query — TanStack Query integration
function useXrplBalance(): { data: XrplBalance; isLoading: boolean }
function useXrplAccountInfo(): { data: XrplAccountInfo; refetch: () => void }
function useXrplTransactionHistory(): { data: XrplTx[]; fetchMore: () => void }
```

Không cần phát triển ngay — nhưng architecture hiện tại đủ sạch để thêm layer này mà không cần refactor core.

**5.3.3 Xahau network first-class**

Xahau (XRPL EVM sidechain / Hooks Amendment) đang phát triển. Một số XRPL dApps sẽ cần cross-network support. Nên chuẩn bị:

- `XahauMainnet`, `XahauTestnet` built-in network definitions.
- Document rõ sự khác biệt về tx types giữa XRPL mainnet và Xahau.
- Đảm bảo `getExplorerAccountUrl()` không hardcode về `livenet.xrpl.org` cho mọi MAINNET (finding M4).

---

## 6. Đánh Giá Tổng Thể

| Chiều | Điểm | Nhận xét |
|-------|------|---------|
| **Kiến trúc** | 8/10 | Headless core, dependency flow sạch, event-driven. Thiếu reactive layer. |
| **Tổ chức code** | 7/10 | Monorepo tốt, test coverage thấp, examples import từ src. |
| **Adapter coverage** | 7/10 | 7 adapters, nhưng thiếu Xyra và Otsu (xrpl-connect đã có). |
| **Developer experience** | 6/10 | Quick start ổn nhưng không có public docs, React hooks raw, typed tx thiếu. |
| **Production readiness** | 7/10 | Core robust (session validation, wallet switching, destroy) nhưng thiếu CHANGELOG, test coverage. |
| **Competitive position** | 7/10 | Kỹ thuật sâu hơn xrpl-connect nhưng thua về perception và DX bề mặt. |

**Kết luận:** XRPL Wallet Kit có kiến trúc internal tốt hơn xrpl-connect — session safety, wallet switching, adapter validator, PKCE Xaman, WalletConnect per-wallet config. Nhưng xrpl-connect đang thắng về **developer onboarding experience**: docs live, single-package install, typed tx, Vue/Nuxt support.

Ba ưu tiên cao nhất để lấy lại lợi thế perception trước beta:

1. **Public docs site** — ngay cả VitePress đơn giản cũng đủ; không có docs = không tồn tại với developer mới.
2. **Reactive React hooks + `accountChanged` event** — xrpl-connect đã có, xrpl-wallet-kit cần bắt kịp.
3. **Typed XRPL transaction** — import type từ `xrpl` package, không cần build tx builder phức tạp.
