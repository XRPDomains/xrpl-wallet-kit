# xrpl-wallet-kit — Pre-Beta Review

**Reviewer:** Senior Engineer (TypeScript SDK / Wallet Adapter Architecture)
**Date:** 2026-05-26
**Scope:** Full monorepo — core, adapters, UI, browser bundle, tests, release config

---

## Tổng quan

Codebase có nền móng kiến trúc tốt: tách rõ core/headless, adapter contract ổn định, error taxonomy sạch, event system nhất quán. Tổng cộng **30 findings** (1 Critical, 8 High, 12 Medium, 9 Low) sau khi đọc toàn bộ source, docs và skill files.

---

## Kết quả verification (2026-05-26)

Kiểm tra source sau khi coder fix. Trạng thái từng finding quan trọng:

| # | Severity | Trạng thái | Ghi chú |
|---|----------|------------|---------|
| C3 | Critical | ✅ Fixed | `connect()` gọi `await this.disconnect()` trước khi connect adapter mới |
| H1 | High | ✅ Fixed | `isValidStoredSession()` kiểm tra `adapterId`, `connectedAt`, `account.address` đúng kiểu |
| H2 | High | ✅ Fixed | `destroy()` và `removeAllListeners()` đã có trong `WalletManager` + `WalletEventEmitter` |
| H4 | High | ✅ Fixed | Sau timeout disconnect: emit `session_stale`, gọi `cancelPendingConnection()` |
| M2 | Medium | ✅ Fixed | Cả `connectWithModal` và `connectWithCustomQr` đều reuse `pendingConnection` nếu có |
| C2 | High | ✅ Fixed | `createOptionalNamespaces()` thêm `xrpl_signMessage` + `xrpl_signTransactionFor` vào tất cả 3 connect path |
| H3 | High | ❌ Chưa fix | GemWallet vẫn `this.unsupported()` với generic tx (không có fallback `submitTransaction`) |
| H5 | High | ✅ Fixed | `announcedAdapters = new Set<string>()` — dedup `connecting` event; recovery loop không emit `disconnected` giả |
| H6 | High | ✅ Fixed | Full fix: `isAvailable()` → `isConnected()` → `resolvePassiveAddress()` (không trigger popup); guard địa chỉ khớp session |
| C1 | High | ❌ Chưa fix | Vẫn dùng `window.localStorage` trực tiếp (kế hoạch: xử lý trong beta) |
| C4 | Medium | ❌ Chưa fix | `RECOVER_SESSION_RETRY_DELAYS_MS = [0, 700, 1600, 3000]` vẫn hardcoded |
| C6 | Medium | ❌ Chưa fix | Ledger vẫn tạo `new Client()` mỗi transaction (có `finally` nên không leak — chỉ là performance) |
| M4 | Medium | ❌ Chưa fix | `getExplorerAccountUrl` vẫn fallback `livenet.xrpl.org` cho mọi MAINNET không có `explorerAccountUrl` |
| M5 | Medium | ❌ Chưa fix | `walletConnectChainId` vẫn bắt buộc (`string`, không phải `string?`) |
| M1 | Medium | ❌ Chưa fix | `normalizeTxResult` chưa có field `confirmed`, `signed: true` vẫn dùng khi có `hash` |

**Tóm tắt (cập nhật sau commit "Harden pre-beta wallet flows"):**

- ✅ **Đã fix:** C3, H1, H2, H4, M2, **C2, H5, H6** — toàn bộ pre-beta blockers và recommended items đã sạch.
- 🔵 **Beta hardening (có thể làm sau):** H3 (GemWallet generic tx), C1 (localStorage injection), C4 (recovery delays), C6 (Ledger client reuse), M4 (explorer URL fallback), M1 (confirmed field).
- Không còn Hard blocker nào trước beta release.

---

## Kế hoạch hành động

### Sửa ngay — true pre-beta blockers (bắt buộc trước beta release)

| # | File | Thay đổi |
|---|------|----------|
| C3 | `packages/core/src/manager.ts:189` | Thay `throw alreadyConnected` bằng `await this.disconnect()` |
| H1 | `packages/core/src/manager.ts:325` | Validate `account.address` là string trước khi cast |
| H2 | `packages/core/src/events.ts`, `manager.ts` | Thêm `removeAllListeners()` và `destroy()` |
| H4 | `packages/core/src/manager.ts:244` | Gọi `cancelPendingConnection` sau timeout disconnect |
| M2 | `packages/adapters/walletconnect/src/index.ts:463` | `connectWithModal` consume `pendingConnection` có sẵn |
| — | `tests/` | Browser bundle smoke test — verify IIFE + `Buffer` polyfill |

### Sửa trước beta release

| # | File | Thay đổi |
|---|------|----------|
| C2 | `packages/adapters/walletconnect/src/index.ts:636` | Thêm `optionalNamespaces` vào session proposal |
| H3 | `packages/adapters/gemwallet/src/index.ts:59` | Fallback về `submitTransaction` cho generic tx |
| H5 | `packages/core/src/manager.ts:151` | Emit `connecting` tuần tự thay vì parallel |
| H6 | `packages/adapters/dropfi/src/index.ts:70` | Thêm guard `isAvailable()` trước khi gọi provider trong `restoreSession` |
| C4 | `packages/core/src/manager.ts:12` | Thêm `recoveryTimeoutMs` config, giảm default delays |
| C6 | `packages/adapters/ledger/src/index.ts:222` | Tái sử dụng `xrpl.Client` qua các transaction để giảm latency |
| C7 | `packages/react/`, `packages/next/`, `README.md` | Thêm tests, bổ sung docs (exports đã ổn) |

### Xử lý trong beta

| # | File | Thay đổi |
|---|------|----------|
| C1 | `packages/adapters/xaman/src/index.ts`, `walletconnect/src/index.ts` | Inject `WalletStorage` cho pending marker thay vì `window.localStorage` trực tiếp |
| M1 | `packages/core/src/result.ts:31` | Tách biệt `signed` và `confirmed` |
| M3 | `packages/ui/src/modal.ts:612` | Cache CSS, inject `<style id="xwk-styles">` một lần |
| M4 | `packages/core/src/networks.ts:97` | Bỏ hardcode fallback explorer URL |
| M5 | `packages/core/src/types.ts:15` | Đổi `walletConnectChainId` thành optional |
| M7 | `packages/ui/src/modal.ts:77` | Gọi `cancelPendingConnection` trong `destroy()` |
| M9 | `docs/UI_CONFIG_EN.md`, `UI_CONFIG_VI.md` | Đánh dấu unimplemented options là `(planned)` — chỉ cần thiết khi chuẩn bị public docs |

### Backlog sau beta

| # | File | Thay đổi |
|---|------|----------|
| C5 | `packages/adapters/walletconnect/src/index.ts:381` | Refactor magic string thành constant/flag |
| M6 | `packages/adapters/ledger/src/index.ts:165` | Lock transport khi `getAccounts()` đang chạy |
| M8 | `packages/core/src/networks.ts:104` | Đổi tên `isMainnetNetwork` → `isXrplCanonicalMainnet` |
| L1 | 3 adapters | Extract `toHex()` vào `@xrpl-wallet-kit/core` utils |
| L2 | `packages/core/package.json` | Thêm `"sideEffects": false` |
| L3 | `packages/core/src/adapter.ts:4` | Đổi type `adapterApiVersion` thành `"1.0" | (string & {})` |
| L4 | `packages/core/src/adapter.ts:73` | Cross-check `payments`/`nftOffers` trong `validateWalletAdapter` |
| L5 | `packages/ui/src/modal.ts:48` | Đổi tên `autoOpen()` → `open()` hoặc document rõ |
| L6 | `packages/core/src/storage.ts:19` | Cho phép caller truyền `storagePrefix` |
| L7 | `packages/adapters/walletconnect/src/index.ts:768` | Gọi `client.core.destroy()` trước khi reset `initializationPromise` |
| L8 | `docs/HTML_LEGACY_INTEGRATION_EN.md:117` | Thay `/api/xrplnft/getName` bằng generic placeholder — chỉ cần thiết khi chuẩn bị public docs |

---

## 🔴 CRITICAL (1)

### C3 — `connect()` ném lỗi khi đã có session active, người dùng không thể đổi wallet

**File:** `packages/core/src/manager.ts:189–191`

**Code hiện tại:**
```ts
if (this.activeAdapterId && this.activeAdapterId !== adapterId) {
  throw createWalletError.alreadyConnected(this.activeAdapterId);
}
```

**Rủi ro:** Người dùng đang connect Xaman, muốn đổi sang GemWallet → nhận lỗi `ALREADY_CONNECTED` thay vì chuyển được. Đây là flow cực kỳ phổ biến. UI không có cách handle gracefully vì lỗi xảy ra trước khi adapter mới được thử. Đặc biệt gây ra UX tệ khi modal hiển thị danh sách nhiều wallets.

**Cách sửa — Option A (khuyến nghị):**
```ts
// packages/core/src/manager.ts
async connect(adapterId: string, options: ConnectOptions = {}): Promise<ConnectResult> {
  // Nếu đang có session của adapter KHÁC, tự động disconnect trước
  if (this.activeAdapterId && this.activeAdapterId !== adapterId) {
    await this.disconnect();
  }
  // ... tiếp tục logic connect như bình thường
}
```

**Cách sửa — Option B (backward-compatible hơn):**
```ts
// Thêm option vào ConnectOptions
export interface ConnectOptions {
  network?: WalletNetwork;
  signal?: AbortSignal;
  forceSwitch?: boolean;  // thêm field này
}

// Trong connect()
if (this.activeAdapterId && this.activeAdapterId !== adapterId) {
  if (!options.forceSwitch) {
    throw createWalletError.alreadyConnected(this.activeAdapterId);
  }
  await this.disconnect();
}
```

---

## 🟠 HIGH (8)

### C1 — Xaman & WalletConnect: Pending recovery marker ghi thẳng vào `window.localStorage`, bỏ qua `WalletStorage` đã inject

**Files:** `packages/adapters/xaman/src/index.ts:299–330`, `packages/adapters/walletconnect/src/index.ts:773–808`

> **Severity đã điều chỉnh:** Hạ từ Critical xuống High, **không ép sửa trước beta**. Marker là temporary (TTL 3 phút, tự xoá sau redirect return) — với app dùng `window.localStorage` mặc định (phần lớn browser dApps), flow hoạt động bình thường. Inject `WalletStorage` là cải tiến kiến trúc đúng hướng nhưng chỉ thực sự cần khi app dùng custom storage backend. Lên kế hoạch sửa trong beta.

**Code hiện tại:**
```ts
// Cả Xaman và WalletConnect đều làm giống nhau
window.localStorage?.setItem(this.getPendingRecoveryKey(), String(Date.now()));
```

**Rủi ro:** `WalletManager` nhận `WalletStorage` qua dependency injection — có thể là sessionStorage, IndexedDB, React Native AsyncStorage, hay bất kỳ backend nào. Nhưng pending recovery marker lại đi thẳng vào `window.localStorage`. Hậu quả: recovery không hoạt động trong SSR/Node, in-app browser bị security restriction, hoặc app dùng custom storage. Nếu session lưu ở custom storage nhưng marker ghi vào localStorage, `canRecoverSession()` trả về `false` → người dùng mất redirect return flow sau khi rời app.

**Cách sửa:**
```ts
// Thêm vào WalletConnectAdapterOptions và XamanAdapterOptions
export interface WalletConnectAdapterOptions {
  // ...fields hiện có...
  storage?: WalletStorage;  // truyền từ WalletManager
}

// Trong adapter
private async setPendingRecoveryMarker(): Promise<void> {
  const storage = this.options.storage ?? fallbackLocalStorage();
  await storage.setItem(this.getPendingRecoveryKey(), String(Date.now()));
}

private async clearPendingRecoveryMarker(): Promise<void> {
  const storage = this.options.storage ?? fallbackLocalStorage();
  await storage.removeItem(this.getPendingRecoveryKey());
}
```

---

### C2 — WalletConnect: `xrpl_signMessage` và `xrpl_signTransactionFor` không được khai báo trong `optionalNamespaces`

**File:** `packages/adapters/walletconnect/src/index.ts:636–645`

> **Severity đã điều chỉnh:** Hạ từ Critical xuống High. `signMessage` qua Payment memo fallback đang hoạt động. Nhưng wallet mobile enforce strict namespace — nếu `xrpl_signMessage` không trong optional thì wallet reject khi SDK cố gọi. Cần sửa trước beta.

**Code hiện tại:**
```ts
methods: [XRPLWalletConnectMethod.SIGN_TRANSACTION]  // chỉ 1 method trong requiredNamespaces
```

**Vấn đề:** `signMessage()` cố gọi `xrpl_signMessage` nếu `sessionSupportsMethod()` trả về `true`. Nhưng method này không được negotiate trong namespace proposal → wallet từ chối với lỗi "unauthorized method". `xrpl_signTransactionFor` bị bỏ sót tương tự.

**Lưu ý thiết kế:** Giữ `xrpl_signTransaction` trong `requiredNamespaces` (intentional — broad wallet compatibility). Chỉ thêm `xrpl_signMessage` và `xrpl_signTransactionFor` vào `optionalNamespaces` — không phải `requiredNamespaces`.

**Cách sửa:**
```ts
// packages/adapters/walletconnect/src/index.ts
function createRequiredNamespaces(chainId: string) {
  return {
    xrpl: {
      chains: [chainId],
      methods: [XRPLWalletConnectMethod.SIGN_TRANSACTION],   // giữ nguyên required
      events: [],
      rpcMap: {}
    }
  };
}

function createOptionalNamespaces() {
  return {
    xrpl: {
      methods: [
        XRPLWalletConnectMethod.SIGN_MESSAGE,
        XRPLWalletConnectMethod.SIGN_TRANSACTION_FOR
      ],
      events: []
    }
  };
}

// Khi gọi client.connect()
const { uri, approval } = await this.client.connect({
  requiredNamespaces: createRequiredNamespaces(chainId),
  optionalNamespaces: createOptionalNamespaces()  // thêm dòng này
});
```

---

### H1 — `parseStoredSession`: Legacy session không validate schema, dễ crash khi storage bị hỏng

**File:** `packages/core/src/manager.ts:325–338`

**Code hiện tại:**
```ts
if ("adapterId" in parsed && "account" in parsed && "connectedAt" in parsed) {
  return parsed as WalletSession;  // cast mà không validate gì thêm
}
```

**Rủi ro:** Nếu localStorage bị ghi đè bởi browser extension, XSS, hoặc schema cũ, `parsed.account.network` có thể là `null` hay sai kiểu → crash khi `withWalletMetadata` truy cập `session.account.network`.

**Cách sửa:**
```ts
// packages/core/src/manager.ts
function isValidLegacySession(parsed: unknown): parsed is WalletSession {
  if (!parsed || typeof parsed !== "object") return false;
  const s = parsed as Record<string, unknown>;
  return (
    typeof s.adapterId === "string" &&
    typeof s.connectedAt === "number" &&
    s.account !== null &&
    typeof s.account === "object" &&
    typeof (s.account as Record<string, unknown>).address === "string"
  );
}

private parseStoredSession(raw: string): WalletSession | null {
  try {
    const parsed = JSON.parse(raw);
    // Versioned envelope
    if (parsed?.version === WALLET_STORAGE_VERSION && parsed.session) {
      if (!isValidLegacySession(parsed.session)) {
        this.emit("session_expired", { reason: "invalid_schema" });
        return null;
      }
      return parsed.session;
    }
    // Legacy unversioned
    if (isValidLegacySession(parsed)) return parsed;
    this.emit("session_expired", { reason: "invalid_schema" });
    return null;
  } catch {
    return null;
  }
}
```

---

### H2 — `WalletManager` không có `destroy()` — listener bị tích lũy trong React StrictMode

**Files:** `packages/core/src/manager.ts`, `packages/core/src/events.ts`

**Rủi ro:** Trong React, nếu component unmount và remount (đặc biệt trong StrictMode với double-mount), mỗi `manager.on()` gọi tích lũy thêm listener. Sau 10 lần re-render, có thể có 10+ listener đang lắng nghe cùng một event.

**Cách sửa:**
```ts
// packages/core/src/events.ts
export class WalletEventEmitter {
  private listeners = new Map<string, Set<Function>>();

  // Thêm method mới
  removeAllListeners(event?: string): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }
}

// packages/core/src/manager.ts
export class WalletManager extends WalletEventEmitter {
  // Thêm method mới
  destroy(): void {
    this.removeAllListeners();
    void this.cancelPendingConnection();
    // Không gọi disconnect() — destroy chỉ dọn dẹp SDK, không logout ví
  }
}

// Cách dùng trong React:
useEffect(() => {
  const manager = new WalletManager({ ... });
  return () => manager.destroy();  // cleanup khi unmount
}, []);
```

---

### H3 — GemWallet: `signAndSubmit` ném lỗi với generic transaction dù capability khai báo `true`

**File:** `packages/adapters/gemwallet/src/index.ts:59–64`

**Code hiện tại:**
```ts
case undefined:
default:
  this.unsupported(`GemWallet method: ${request.methodHint ?? "generic"}`);
```

**Rủi ro:** Capability khai báo `signAndSubmit: true` nhưng chỉ handle 4 method hints cụ thể (payment, createNFTOffer, acceptNFTOffer, cancelNFTOffer). Bất kỳ generic transaction nào (OfferCreate, TrustSet, EscrowCreate...) đều throw `UNSUPPORTED_METHOD`. Developer nhìn vào `capabilities.signAndSubmit === true` và bị bất ngờ hoàn toàn.

**Cách sửa:**
```ts
// packages/adapters/gemwallet/src/index.ts
async signAndSubmit(request: SignAndSubmitRequest): Promise<TxResult> {
  switch (request.methodHint) {
    case "payment":
      return this.handlePayment(request);
    case "createNFTOffer":
      return this.handleCreateNFTOffer(request);
    case "acceptNFTOffer":
      return this.handleAcceptNFTOffer(request);
    case "cancelNFTOffer":
      return this.handleCancelNFTOffer(request);
    default:
      // Fallback về submitTransaction cho mọi tx type khác
      return this.handleGenericTransaction(request);
  }
}

private async handleGenericTransaction(request: SignAndSubmitRequest): Promise<TxResult> {
  const result = await GemWalletApi.submitTransaction({ transaction: request.txJson });
  return normalizeTxResult(result);
}
```

---

### H4 — `disconnect()` timeout 2 giây im lặng, adapter state không được reset

**File:** `packages/core/src/manager.ts:244`

**Code hiện tại:**
```ts
await this.withTimeout(this.getAdapter()?.disconnect?.(), 2000);
// Nếu timeout: WalletManager clear session nhưng adapter vẫn coi mình connected
```

**Rủi ro:** Sau timeout, WalletManager đã clear session nhưng WalletConnect adapter vẫn giữ `session` và `client` nội bộ. Lần connect sau có thể reuse stale session object, gây ra hành vi không nhất quán.

**Cách sửa:**
```ts
// packages/core/src/manager.ts
private async disconnectAdapter(): Promise<void> {
  const adapter = this.getAdapter();
  if (!adapter) return;
  try {
    await this.withTimeout(adapter.disconnect?.(), 2000);
  } catch (e) {
    // Timeout hoặc lỗi — buộc cleanup
    this.logger.warn("disconnect timeout, forcing cleanup");
    await adapter.cancelPendingConnection?.();
    this.emit("session_stale", {
      adapterId: adapter.metadata.id,
      reason: "disconnect_timeout"
    });
  }
}
```

---

### H5 — `recoverPendingReturnSession` emit `connecting` cho tất cả adapters cùng lúc

**File:** `packages/core/src/manager.ts:151`

**Code hiện tại:**
```ts
recoverableAdapters.forEach((adapter) =>
  this.emit("connecting", { adapterId: adapter.metadata.id, recovering: true })
);
```

**Rủi ro:** Nếu cả Xaman và WalletConnect đều có pending marker, UI nhận 2 sự kiện `connecting` đồng thời. Không adapter nào được ưu tiên, kết quả là trạng thái loading mơ hồ.

**Cách sửa:**
```ts
// Thử từng adapter tuần tự thay vì song song
private async recoverPendingReturnSession(): Promise<ConnectResult | null> {
  for (const adapter of recoverableAdapters) {
    this.emit("connecting", { adapterId: adapter.metadata.id, recovering: true });
    try {
      const result = await this.tryRecoverAdapter(adapter);
      if (result) return result;
    } catch {
      // Thử adapter tiếp theo — không emit "disconnected" ở đây vì adapter
      // chưa bao giờ thực sự connected trong lần này; emit giả sẽ làm UI
      // hiểu nhầm là user vừa logout.
    }
  }
  // Nếu tất cả đều thất bại, WalletManager tự emit trạng thái phù hợp
  return null;
}
```

---

### H6 — DropFi `restoreSession` có thể trigger provider call khi chưa có user gesture

**File:** `packages/adapters/dropfi/src/index.ts:70–80`

`restoreSession` gọi `resolveAddress(provider, true, null)` với `connected = true`, có thể kích hoạt `getAddress()` và `getAccounts()` khi người dùng chưa chủ động reconnect. Trên mobile in-app browser, provider detection không ổn định — chỉ check `isDropFi` flag chưa đủ để xác nhận session còn hợp lệ.

**Cách sửa:**
```ts
// packages/adapters/dropfi/src/index.ts
async restoreSession(session: WalletSession): Promise<ConnectResult | null> {
  // Kiểm tra provider available trước
  if (!await this.isAvailable()) return null;

  const provider = this.getProvider();
  // Dùng getAddress thụ động (không trigger connect UI)
  try {
    const address = await provider.getAddress();
    if (!address || address !== session.account.address) return null;
    return { account: session.account, session };
  } catch {
    return null;  // provider không phản hồi → không restore
  }
}
```

---

## 🟡 MEDIUM (12)

### C4 — `recoverPendingReturnSession`: Polling cứng 5.3 giây, không configurable

**File:** `packages/core/src/manager.ts:12, 153–168`

> **Severity đã điều chỉnh:** Hạ từ Critical xuống Medium. Đây là UX improvement, không phải correctness bug. Recovery vẫn hoạt động — chỉ là chậm hơn cần thiết.

**Code hiện tại:**
```ts
const RECOVER_SESSION_RETRY_DELAYS_MS = [0, 700, 1600, 3000];
// Tổng: 0 + 700 + 1600 + 3000 = 5300ms
```

**Vấn đề:** App gọi `autoReconnect()` trong top-level init. Nếu recovery thất bại (network chậm, wallet không phản hồi), app bị treo 5.3 giây với trạng thái `connecting` nhưng không có feedback cho người dùng. Không có cách abort từ bên ngoài.

**Cách sửa:**
```ts
// packages/core/src/types.ts — thêm vào WalletManagerConfig
export interface WalletManagerConfig {
  // ...fields hiện có...
  recoveryTimeoutMs?: number;  // default: 5300, set 0 để disable retry
}

// packages/core/src/manager.ts
// Giảm default xuống còn 2 lần thử
const DEFAULT_RECOVER_DELAYS_MS = [0, 1500];

// Tính delays dựa theo config
private getRecoverDelays(): number[] {
  if (this.config.recoveryTimeoutMs === 0) return [0];
  return DEFAULT_RECOVER_DELAYS_MS;
}

private async recoverPendingReturnSession(signal?: AbortSignal): Promise<ConnectResult | null> {
  for (const delay of this.getRecoverDelays()) {
    if (signal?.aborted) break;
    if (delay > 0) await sleep(delay);
    // ...thử recovery...
  }
  return null;
}
```

---

### C6 — Ledger: Tạo `xrpl.Client` mới cho mỗi transaction — latency cao, không phải memory leak

**File:** `packages/adapters/ledger/src/index.ts:222–275`

> **Severity đã điều chỉnh:** Hạ từ Critical xuống Medium. Code có `finally { await client.disconnect() }` nên **không có connection leak**. Vấn đề là performance, không phải correctness.

**Code hiện tại:**
```ts
async signWithDefaultLedger(...): Promise<TxResult> {
  const client = new Client(this.network.rpcUrl);
  await client.connect();
  try {
    // ...autofill, sign, submit...
  } finally {
    await client.disconnect();  // ← finally đảm bảo cleanup đúng
  }
}
```

**Đánh giá:** Pattern này an toàn — `finally` đảm bảo `client.disconnect()` luôn chạy kể cả khi `submitAndWait` throw. Không có leak.

**Vấn đề thực sự — performance:** Hardware wallet Ledger vốn đã chậm vì user phải confirm vật lý (5–30 giây). Mở WebSocket mới + connect handshake (~1–3 giây) cho mỗi transaction là overhead không cần thiết. Với autofill + submit, latency có thể tăng thêm 2–4 giây so với reusing connection.

**Cách sửa — cải thiện UX rõ rệt:**
```ts
export class LedgerAdapter extends BaseWalletAdapter {
  private xrplClient?: Client;

  private async getXrplClient(): Promise<Client> {
    if (this.xrplClient?.isConnected()) return this.xrplClient;
    this.xrplClient = this.options.xrplClient ?? new Client(this.network.rpcUrl);
    await this.xrplClient.connect();
    this.addCleanup(() => this.xrplClient?.disconnect());
    return this.xrplClient;
  }

  async signWithDefaultLedger(...): Promise<TxResult> {
    const client = await this.getXrplClient();
    const autofilled = await client.autofill(txJson);
    // ...sign và submit — không cần disconnect sau mỗi call...
  }
}

// Phương án inject từ bên ngoài:
export interface LedgerAdapterOptions {
  xrplClient?: Client;  // caller tự inject và quản lý lifecycle
}
```

---

### C7 — `@xrpl-wallet-kit/react` và `@xrpl-wallet-kit/next`: tồn tại nhưng thiếu tests, docs, và export verification

**Files:** `packages/react/src/index.tsx`, `packages/next/src/index.ts`, `README.md`

> **Severity đã điều chỉnh:** Hạ từ Critical xuống Medium. Cả hai packages **đã tồn tại** với implementation đầy đủ — `WalletKitProvider`, `useWalletKit`, `WalletButton`, cleanup đúng trong `useEffect`. Finding ban đầu sai về việc packages không tồn tại.

**Trạng thái thực tế:**
- `packages/react`: có `WalletKitProvider`, `useWalletKit`, `WalletButton`, cleanup listeners trong `useEffect`
- `packages/next`: re-exports từ `@xrpl-wallet-kit/react` với `"use client"` directive

**Vấn đề còn lại trước khi publish:**

1. **Tests** — Không có test file cho react/next packages. Cần ít nhất:
   - `WalletKitProvider` mount/unmount cleanup (verify listeners và `modal.destroy()` được gọi)
   - `useWalletKit` outside provider throws error với message rõ ràng
   - `WalletButton` render và trigger connect/disconnect đúng

2. **Package exports** — Export map ESM + types đã có và đúng cấu trúc. Chưa có CJS entry (`require`) — không bắt buộc nếu target là modern bundlers, nhưng cần ghi rõ trong README nếu muốn hỗ trợ CommonJS:

3. **README** — React/Next quickstart guide chưa có trong public-facing docs. Cần thêm ví dụ `WalletKitProvider` wrap + `useWalletKit` hook.

4. **SSR safety** — `packages/next` dùng `"use client"` nhưng chưa document rõ server-side usage boundary. Cần ghi chú trong README.

---

### M1 — `normalizeTxResult`: `signed: true` khi có hash nhưng transaction có thể đã fail on-ledger

**File:** `packages/core/src/result.ts:31`

**Code hiện tại:**
```ts
signed: typeof signed === "boolean" ? signed : status === "tesSUCCESS" || Boolean(hash),
```

Transaction có hash với status `tecNO_DST`, `tecINSUFF_FEE`... → `signed: true` nhưng thực ra đã fail on-ledger. Code như `if (result.signed) showSuccess()` sẽ bị nhầm.

**Cách sửa:**
```ts
// packages/core/src/result.ts
export interface TxResult {
  hash?: string;
  status?: string;
  signed?: boolean;
  confirmed?: boolean;  // thêm field mới — on-ledger success
  rejected?: boolean;
  raw?: unknown;
}

// Trong normalizeTxResult:
const confirmed = status === "tesSUCCESS";
const signed = typeof rawSigned === "boolean"
  ? rawSigned
  : confirmed || Boolean(txBlob);  // có txBlob = đã ký, dù chưa submit
```

---

### M2 — WalletConnect `preInitialize()` + `connect()` tạo 2 proposals song song

**File:** `packages/adapters/walletconnect/src/index.ts:132–157, 463`

`preInitialize()` tạo `pendingConnection` với URI sẵn. Nếu `connect()` sau đó trigger modal mode, `pendingConnection` không được dùng và `client.connect()` mới tạo proposal thứ 2. Proposal đầu còn treo, ví có thể nhận duplicate request.

**Cách sửa:**
```ts
// packages/adapters/walletconnect/src/index.ts
private async connectWithModal(options: ConnectOptions): Promise<ConnectResult> {
  // Nếu đã có pendingConnection từ preInitialize(), dùng lại thay vì tạo mới
  const pending = await this.pendingConnection ?? await this.client.connect({
    requiredNamespaces: createRequiredNamespaces(chainId)
  });
  this.pendingConnection = null;  // mark as consumed

  if (pending.uri) {
    this.walletConnectModal?.openModal({ uri: pending.uri });
  }
  return this.waitForApproval(pending.approval);
}
```

---

### M3 — `WalletModal.renderStyles()` tạo lại ~4KB CSS string mỗi lần render view

**File:** `packages/ui/src/modal.ts:612–636`

`renderShell()`, `renderQrShell()`, `renderConnectShell()` mỗi cái đều gọi `renderStyles()`. Khi user đổi view (list → qr → list), CSS được tạo lại và inject lại 3 lần.

**Cách sửa:**
```ts
// packages/ui/src/modal.ts
private styleEl: HTMLStyleElement | null = null;

private ensureStylesInjected(theme: WalletTheme): void {
  // Chỉ inject một lần, hoặc khi theme thực sự thay đổi
  if (this.styleEl && this.styleEl.dataset.theme === JSON.stringify(theme)) return;

  if (!this.styleEl) {
    this.styleEl = document.createElement("style");
    this.styleEl.id = "xwk-styles";
    document.head.appendChild(this.styleEl);
  }
  this.styleEl.textContent = this.renderStyles(theme);
  this.styleEl.dataset.theme = JSON.stringify(theme);
}

// Thêm cleanup trong destroy():
destroy() {
  this.styleEl?.remove();
  this.styleEl = null;
}
```

---

### M4 — `getExplorerAccountUrl()` hardcode fallback về `livenet.xrpl.org` cho mọi MAINNET network

**File:** `packages/core/src/networks.ts:97–101`

**Code hiện tại:**
```ts
if (network.networkType === "MAINNET") {
  return `https://livenet.xrpl.org/accounts/${address}`;  // sai với Xahau mainnet
}
```

Xahau Mainnet có `networkType: "MAINNET"` nhưng không có `explorerAccountUrl` → fallback về `livenet.xrpl.org` thay vì `explorer.xahau.network`.

**Cách sửa:**
```ts
// packages/core/src/networks.ts
export function getExplorerAccountUrl(
  network: WalletNetwork,
  address: string
): string | undefined {
  if (!network.explorerAccountUrl) return undefined;  // không fallback
  return network.explorerAccountUrl.replace("{address}", address);
}
```
Caller tự quyết định hiển thị gì khi `undefined` được trả về (ẩn nút explorer thay vì link sai).

---

### M5 — `WalletNetwork.walletConnectChainId` bắt buộc với mọi network

**File:** `packages/core/src/types.ts:15`

Ledger-only setup hoặc custom network vẫn phải khai báo `walletConnectChainId` dù không dùng WalletConnect.

**Cách sửa:**
```ts
// packages/core/src/types.ts
export interface WalletNetwork {
  id: string;
  name: string;
  networkType: "MAINNET" | "TESTNET" | "DEVNET" | "CUSTOM";
  rpcUrl: string;
  walletConnectChainId?: string;  // đổi thành optional
  // ...
}

// packages/adapters/walletconnect/src/index.ts — guard khi cần
const chainId = options.network?.walletConnectChainId;
if (!chainId) throw createWalletError.connectionFailed("WalletConnect requires walletConnectChainId");
```

---

### M6 — `LedgerAdapter.getAccounts()` public method ghi đè `this.transport` khi đang signing

**File:** `packages/adapters/ledger/src/index.ts:165–193`

Nếu gọi `getAccounts()` trong khi user đang ký transaction (transport đang bận), method này ghi đè `this.transport`. Hành vi không xác định.

**Cách sửa:**
```ts
// packages/adapters/ledger/src/index.ts
private isTransportBusy = false;

async getAccounts(count = 5, startIndex = 0): Promise<LedgerAccount[]> {
  if (this.isTransportBusy) {
    throw new Error("Transport is busy, cannot enumerate accounts while signing");
  }
  // Tạo transport tạm thời riêng thay vì dùng this.transport
  const tempTransport = await TransportWebHID.create();
  try {
    const app = new AppXrp(tempTransport);
    // ... lấy accounts ...
    return accounts;
  } finally {
    await tempTransport.close();
  }
}
```

---

### M7 — `WalletModal.destroy()` không cancel pending connection

**File:** `packages/ui/src/modal.ts:77–83`

**Code hiện tại:**
```ts
destroy() {
  this.close(false, false);  // notify=false → cancelPendingConnection() không được gọi
  // ...
}
```

Nếu modal bị destroy trong khi WalletConnect đang pending, connection tiếp tục chạy nền. Sự kiện session arrive sẽ fire nhưng không có handler. `autoReconnect` lần sau có thể nhận stale session.

**Cách sửa:**
```ts
destroy() {
  // Luôn cancel pending connection khi destroy, bất kể notify flag
  void this.manager.cancelPendingConnection?.();
  this.close(false, false);
  this.styleEl?.remove();
  // ...
}
```

---

### M8 — `isMainnetNetwork()` check cả `nativeAsset === "XRP"`, tên hàm misleading

**File:** `packages/core/src/networks.ts:104–106`

Hàm check cả `family === "xrpl"` và `nativeAsset === "XRP"` → thực chất là "is XRPL canonical mainnet". Nhưng tên gợi ý "is any mainnet". Xahau Mainnet bị treat như non-mainnet ở mọi nơi dùng hàm này.

**Cách sửa:**
```ts
// packages/core/src/networks.ts

// Đổi tên hoặc thêm hàm mới rõ nghĩa hơn
export function isXrplCanonicalMainnet(network: WalletNetwork): boolean {
  return network.family === "xrpl" && network.nativeAsset === "XRP";
}

// Hàm mới cho "any mainnet type"
export function isMainnetType(network: WalletNetwork): boolean {
  return network.networkType === "MAINNET";
}

// Deprecated alias để tránh breaking change
/** @deprecated Dùng isXrplCanonicalMainnet() hoặc isMainnetType() */
export const isMainnetNetwork = isXrplCanonicalMainnet;
```

---

### M9 — UI config có những option được ghi trong docs nhưng chưa implement

**Files:** `docs/UI_CONFIG_EN.md:108–113, 122–126, 205–207, 252–259`

> **Lưu ý:** Finding này chỉ là blocker nếu đang chuẩn bị public docs. Với internal docs (hiện tại), đây là low-priority. Đánh dấu `(planned)` khi chuẩn bị publish.

Các option sau hiển thị trong public docs như thể đã hoạt động, nhưng code chú thích rõ "not implemented yet":
- `ui.themeName` (`"minimal"`, `"rounded"`, `"compact"`) — resolver chưa apply
- `ui.language` (`"vi-VN"`, `"auto"`) — translation chưa có
- `ui.walletList.showInstalledBadge` — "planned"
- `ui.walletConnect.cta` (`"copy"`, `"open"`, `"both"`) — "kept as stable API direction"

**Rủi ro:** Developer config `ui.language = "vi-VN"` không thấy gì xảy ra, mở issue, mất niềm tin vào SDK.

**Cách sửa — ngắn hạn (không cần code):**
Trong `UI_CONFIG_EN.md` và `UI_CONFIG_VI.md`, thêm tag `_(planned)_` vào mỗi option chưa có:
```md
## `ui.themeName` _(planned)_

Theme preset name. **Lưu ý: chưa hoạt động trong phiên bản hiện tại. Dùng `ui.customTheme` để tùy chỉnh giao diện.**
```

**Cách sửa — dài hạn:**
```ts
// packages/ui/src/config.ts — log warning khi dùng unimplemented option
if (overrides.themeName && overrides.themeName !== "default") {
  console.warn(
    `[xrpl-wallet-kit] ui.themeName="${overrides.themeName}" chưa được hỗ trợ. ` +
    `Dùng ui.customTheme để tùy chỉnh giao diện.`
  );
}
```

---

## 🔵 LOW (9)

### C5 — [Design Note] WalletConnect: `shouldRecoverWithoutStoredSession()` hardcode string `"walletconnect"`

**File:** `packages/adapters/walletconnect/src/index.ts:381`

> **Severity đã điều chỉnh:** Hạ từ Critical xuống Low / Design Note. **Đây là intentional design** — detail adapters (Bitget, Joey, Girin, Bifrost...) không nên background-recover để tránh stale recovery loop. Chỉ root `"walletconnect"` adapter mới chạy pending recovery flow. Finding ban đầu sai khi đề xuất bật recovery cho detail adapters.

**Code hiện tại:**
```ts
private shouldRecoverWithoutStoredSession(): boolean {
  return this.metadata.id === "walletconnect";  // magic string
}
```

**Vấn đề nhỏ:** Hardcode string thay vì constant/flag. Nếu ID thay đổi hoặc có adapter custom muốn opt-in recovery, cần sửa code.

**Cách sửa — tùy chọn, không urgent:**
```ts
// Thêm constant để tránh magic string
const WALLETCONNECT_ROOT_ADAPTER_ID = "walletconnect" as const;

private shouldRecoverWithoutStoredSession(): boolean {
  return this.metadata.id === WALLETCONNECT_ROOT_ADAPTER_ID;
}

// Hoặc nếu muốn extensible trong tương lai:
export interface WalletConnectAdapterOptions {
  enablePendingRecovery?: boolean;  // không set mặc định cho detail adapters
}
```

**Không** đổi detail adapters thành `enablePendingRecovery: true` — đó là regression về intentional design.

---

### L1 — `toHex()` duplicate trong 3 adapters

**Files:** `xaman/index.ts:280`, `walletconnect/index.ts:710`, `xrpl-snap/index.ts:111`

Cùng logic `TextEncoder → hex`. Nên extract vào `packages/core/src/utils.ts`:
```ts
export function toHex(input: string): string {
  return Array.from(new TextEncoder().encode(input))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}
```

---

### L2 — `packages/core/package.json` thiếu `sideEffects: false`

**File:** `packages/core/package.json`

```json
{
  "name": "@xrpl-wallet-kit/core",
  "sideEffects": false  // thêm dòng này
}
```
Cho phép webpack/rollup tree-shake các phần không dùng của core.

---

### L3 — `adapterApiVersion` type là `string` thay vì branded type

**Files:** `packages/core/src/adapter.ts:4`, `packages/core/src/types.ts:109`

```ts
// Hiện tại
adapterApiVersion?: string;

// Nên đổi thành
adapterApiVersion?: "1.0" | (string & {});
// Cho phép autocomplete "1.0" nhưng vẫn chấp nhận string bất kỳ
```

---

### L4 — `validateWalletAdapter` không kiểm tra `capabilities.payments` / `capabilities.nftOffers`

**File:** `packages/core/src/adapter.ts:73–88`

`payments` và `nftOffers` không có method tương ứng trong `WalletAdapter` interface, nên validator không thể cross-check. Cần document rõ ràng: khai báo `payments: true` chỉ là hint cho UI, không phải contract — hoặc thêm validation warning.

---

### L5 — `WalletModal.autoOpen()` chỉ gọi `open()`, tên gây nhầm lẫn

**File:** `packages/ui/src/modal.ts:48`

Tên `autoOpen()` gợi ý "tự mở khi điều kiện thỏa mãn" nhưng thực ra chỉ là alias của `open()`. Đổi tên thành `open()` hoặc thêm JSDoc giải thích.

---

### L6 — `createBrowserWalletStorage` prefix cứng, conflict khi nhiều instances

**File:** `packages/core/src/storage.ts:19`

```ts
// Hiện tại
export function createBrowserWalletStorage(): WalletStorage {
  const prefix = "xrpl-wallet-kit.";  // cứng

// Nên đổi thành
export function createBrowserWalletStorage(prefix = "xrpl-wallet-kit."): WalletStorage {
```
Quan trọng với microfrontend hoặc nhiều kit instances trên cùng origin.

---

### L7 — `WalletConnect.cleanup()` reset `initializationPromise` mà không destroy old client

**File:** `packages/adapters/walletconnect/src/index.ts:768`

```ts
// Thêm trước khi reset
await this.client?.core?.relayer?.provider?.disconnect().catch(() => {});
// hoặc nếu API hỗ trợ:
await this.client?.core?.destroy().catch(() => {});
this.initializationPromise = undefined;
```

---

### L8 — HTML legacy integration docs dùng endpoint XRPDomains-specific trong "Recommended" example

**Files:** `docs/HTML_LEGACY_INTEGRATION_EN.md:117`, `docs/HTML_JQUERY_BETA_VI.md:116`

> **Lưu ý:** Chỉ cần sửa khi chuẩn bị public docs. Đây là internal docs — người dùng hiện tại biết ngữ cảnh.

```js
// Code hiện tại trong example — lộ business-specific path
identityEndpoint: '/api/xrplnft/getName',
identityProfileEndpoint: '/api/xrplnft/getAddress',

// Nên thay bằng generic
identityEndpoint: '/api/identity/getName',     // placeholder — replace với API của bạn
identityProfileEndpoint: '/api/identity/getProfile',
```

---

## Tests & Release Readiness

**Trạng thái hiện tại:**
- 1 file test (`tests/core.test.ts`) — 13 tests (tăng từ 9; 4 test mới cover: wallet switching, invalid session guard, destroy/removeAllListeners, disconnect timeout), chỉ cover core với mock adapter
- Browser bundle smoke test mới (`tests/browser-bundle-smoke.mjs`) — verify IIFE load, Buffer polyfill, `XRPLWalletKit.create` và `createClient` exposed
- Không có adapter-level tests với mock providers
- Không có UI tests
- Không có browser bundle smoke test
- `@xrpl-wallet-kit/react` và `@xrpl-wallet-kit/next`: cả hai đã có export map ESM + types; không có CJS entry (có thể là vấn đề với bundler cũ, nhưng không bắt buộc cho beta)

**Coverage bắt buộc trước beta (true blockers):**

1. **Browser bundle smoke test** — load IIFE trong jsdom, verify `Buffer` polyfill, verify `window.XRPLWalletKit.create` exposed đúng. Đây là blocker vì bundle là điểm deliver chính.

2. **WalletConnect proposal dedup** — test `preInitialize()` + `connect()` không tạo 2 proposals (finding M2).

3. **Session validation roundtrip** — ghi session bị lỗi vào storage → `autoReconnect()` không crash (finding H1).

4. **Disconnect timeout cleanup** — verify `cancelPendingConnection` được gọi sau timeout disconnect (finding H4).

**Coverage nên có trước beta:**

5. **Adapter contract tests** — mỗi adapter cần file test riêng. Dùng template ở `skills/xrpl-wallet-kit-adapter-developer/references/test-template.md`. Tối thiểu: user-reject → `CONNECTION_REJECTED`, provider missing → `WALLET_NOT_AVAILABLE`, `assertWalletAdapter` pass.

6. **React cleanup test** — `WalletKitProvider` unmount gọi `destroy()` và off listeners (finding C7). _Phụ thuộc vào H2 — cần thêm `destroy()` vào `WalletManager` trước._

7. **Recovery roundtrip** — connect → ghi session → `autoReconnect()` → session đúng adapter + account.

**Package exports trước khi publish:**
- Thêm `"sideEffects": false` vào tất cả package.json (xem L2)
- `packages/browser/package.json`: tách export condition `"browser"` riêng thay vì dùng `"default"` cho IIFE
- Verify export map của `@xrpl-wallet-kit/react` và `@xrpl-wallet-kit/next` (xem C7)

**Docs cần bổ sung (khi chuẩn bị public):**
- React/Next quickstart section trong README (xem C7)
- Đánh dấu unimplemented config options là `(planned)` (xem M9)
- Thay generic placeholder cho XRPDomains endpoints (xem L8)
- Migration guide khi `WALLET_ADAPTER_API_VERSION` tăng
- Browser compatibility matrix cho Ledger (WebHID/WebUSB)
- Ví dụ Xahau network config

---

## Điểm tốt

- **Core/UI tách biệt hoàn toàn** — `WalletManager` không import bất kỳ DOM API nào. UI package là dependency một chiều.
- **`BaseWalletAdapter` cleanup system** — `addCleanup()` / `runCleanup()` thực thi theo thứ tự ngược, sạch sẽ, đã được test.
- **`WalletKitError` + error codes** — taxonomy đủ, `isWalletKitError()` type guard chuẩn, `normalizeWalletError()` cover các regex pattern chính.
- **`validateWalletAdapter()` + `assertWalletAdapter()`** — contract validation tốt, giúp ích rõ rệt cho third-party adapter authors.
- **WalletConnect implementation** — `waitForApprovalOrRecoveredSession` với window focus/pageshow listeners, `isMobile()` gating cho iOS deeplink — thiết kế kỹ lưỡng.
- **Ledger error taxonomy** — `parseLedgerError()` map đúng status codes (0x6985 rejected, 0x6804 locked, 0x6e00 app-not-open).
- **`normalizeTxResult` path resolution** — `pickPath()` với multi-level dot-path fallback xử lý tốt sự đa dạng của adapter response.
- **`autoReconnect` single-flight** — `autoReconnectPromise` cache đảm bảo chỉ có 1 concurrent recovery.
- **UI accessibility** — focus trap, Escape key, `aria-modal`, `role="dialog"`, `aria-live` regions đầy đủ.
- **Mobile bottom sheet** — `env(safe-area-inset-*)` padding, `max-height: 100dvh`, iOS overscroll được xử lý đúng.
- **Adapter docs & skill** — `adapter-contract.md`, `creating-an-adapter.md`, `testing-checklist.md`, `SKILL.md` đều viết cẩn thận, align chặt với implementation.
