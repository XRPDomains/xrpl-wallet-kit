# XRPL Wallet Kit — Full Codebase Audit

**Ngày audit:** 2026-06-18  
**Trigger:** "có khác nhiều sửa đổi gần đây" — audit toàn bộ sau round SignMessageResult + packages mới  
**Scope:** core, ui, client, browser, tất cả adapters, packages/react, packages/next  

---

## Tóm tắt nhanh

| Severity | Số lượng |
|---|---|
| 🔴 CRITICAL | 2 |
| 🟡 WARNING | 5 |
| 🔵 NOTE | 5 |

**Kết luận:** Coder đã implement đúng tất cả yêu cầu trong SIGNMESSAGE_SHAPE_SPEC và làm thêm hai packages lớn (`react`, `next`) cùng một adapter mới (`otsu`). Các lỗi nghiêm trọng nhất nằm trong `packages/react` (render-phase side effect) và thiếu test coverage. Có thể tiếp tục với `packages/auth` nhưng cần fix 2 CRITICAL trước khi release.

---

## Thay đổi mới so với lần review trước

### packages/core — thay đổi

**`types.ts`:**
- ✅ `SignatureKind = "signature" | "signedTx"` — export mới
- ✅ `SignMessageResult.signatureKind: SignatureKind` — bắt buộc
- ✅ `SignMessageResult.proof?: string` — convenience field (mirrors signature hoặc txBlob)
- ✅ `AuthenticateRequest` — interface mới (statement, expiresIn?, account?)
- ✅ `AuthenticateResult` — interface mới (address, message, signatureKind, proof, …)

**`adapter.ts`:**
- ✅ `WALLET_ADAPTER_API_VERSION` → `"1.1"`
- ✅ Version check dùng `!startsWith("1.")` — backward-compat với cả 1.0 và 1.1

**`manager.ts`:**
- ✅ `authenticate(request: AuthenticateRequest): Promise<AuthenticateResult>` — fully implemented
- ✅ `normalizeSignMessageResult(adapterId, result)` — backward-compat, warn nếu adapter cũ không set signatureKind
- `proof` assembly dùng `?? ""` làm final fallback (nhưng `normalizeSignMessageResult` sẽ throw trước đó → không bao giờ reach được)

### packages/adapters — thay đổi

Tất cả 7 adapter đã cập nhật đúng per spec (verified trong SIGNMESSAGE_SHAPE_SPEC.md Round 1).

**Adapter mới — `otsu/`:**
- Extension adapter cho Otsu Wallet (MV3 Chrome extension), inject tại `window.xrpl` với `isOtsu = true`
- Hỗ trợ: connect, disconnect, restoreSession, signMessage, signTransaction, signAndSubmit
- `signatureKind: "signature"` — đúng
- Phụ thuộc chỉ `@xrpl-wallet-kit/core` — đúng architecture

### packages/react/ — PACKAGE MỚI

React bindings. Cung cấp `WalletKitProvider`, `useWalletKit()`, `useWalletSession()`, `useWalletAccount()`, `useWalletStatus()`, `useWalletCapabilities()`, `WalletButton`.

### packages/next/ — PACKAGE MỚI

Thin wrapper cho Next.js App Router — thêm `"use client"` directive và re-export 2 items từ react package.

---

## 🔴 CRITICAL — Phải fix trước release

### [C1] Không có test coverage cho code mới

**Vấn đề:** Test script là `node --import tsx --test tests/*.test.ts`. Nếu `tests/` không có file hoặc không có file match glob thì command **pass silently** — không có lỗi, nhưng zero tests chạy.

Không có test cho:
- `authenticate()` trong `WalletManager`
- `normalizeSignMessageResult()` backward-compat logic
- `OtsuAdapter` (tất cả methods)
- `WalletKitProvider` (react package)
- packages/next

**Fix cần làm:**
1. Verify `tests/` thực sự có file hay đang empty
2. Thêm unit tests cho `authenticate()` + `normalizeSignMessageResult()` vào `tests/core.test.ts`
3. Thêm test file cho OtsuAdapter — follow pattern `tests/adapters/otsu.test.ts` (mock `window.xrpl`)
4. React testing — ít nhất là render + context tests (có thể dùng `@testing-library/react`)

---

### [C2] `WalletKitProvider` — render-phase side effect (React rules violation)

**File:** `packages/react/src/index.tsx`

**Vấn đề:** `createWalletModal()` được gọi trong render function body, guarded bởi `!modalRef.current`:

```tsx
// WRONG — side effect trong render, vi phạm React rules
if (!modalRef.current && typeof document !== "undefined") {
  modalRef.current = createWalletModal(manager, uiOptions);
}
```

Trong React 18 Strict Mode, component render 2 lần. Ref không reset giữa hai lần render (khác với state) nên về mặt thực tế pattern này hoạt động — nhưng đây là **undefined behavior** và có thể vỡ nếu React thay đổi cách handle refs trong Strict Mode.

**Fix đúng:**

```tsx
// Dùng useRef + useLayoutEffect
const modalRef = useRef<WalletModal | null>(null);

useLayoutEffect(() => {
  if (typeof document === "undefined") return;
  modalRef.current = createWalletModal(manager, uiOptions);
  return () => {
    modalRef.current?.destroy();
    modalRef.current = null;
  };
}, [manager]); // rebuild nếu manager thay đổi
```

---

## 🟡 WARNING — Fix trước public release

### [W1] `WalletAdapterApiVersion` type không enumerate `"1.1"`

**File:** `packages/core/src/types.ts`

**Vấn đề:**
```ts
// Hiện tại — thiếu "1.1":
export type WalletAdapterApiVersion = "1.0" | (string & {});
```

Adapters bên ngoài được IDE suggest chỉ `"1.0"`. Khai báo `"1.1"` vẫn compile nhưng không có autocomplete hint.

**Fix:**
```ts
export type WalletAdapterApiVersion = "1.0" | "1.1" | (string & {});
```

**Lưu ý thêm:** Tất cả built-in adapters không tự khai báo `adapterApiVersion` — họ dùng default từ `BaseWalletAdapter`. Chỉ `OtsuAdapter` tự set `adapterApiVersion = WALLET_ADAPTER_API_VERSION`. Các adapters cũ (gemwallet, crossmark, etc.) sẽ tự động advertise `"1.1"` qua base class mà không có explicit opt-in. Điều này là chấp nhận được vì coder đã update tất cả chúng — nhưng nên document rõ trong changelog.

---

### [W2] `packages/next` — API surface quá hẹp

**File:** `packages/next/src/index.ts`

**Vấn đề:** Package chỉ re-export 2 items với tên alias (không canonical):
```ts
"use client";
export { WalletKitProvider as XrplWalletProvider } from "@xrpl-wallet-kit/react";
export { useWalletKit as useXrplWallet } from "@xrpl-wallet-kit/react";
```

Next.js App Router consumers cần `"use client"` boundary cho TẤT CẢ client-side imports. Nếu họ import `useWalletSession`, `useWalletAccount`, `WalletButton`… trực tiếp từ `@xrpl-wallet-kit/react` thì sẽ thiếu boundary và gặp lỗi `"You're importing a component that needs createContext"`.

**Fix — re-export đầy đủ với "use client":**
```ts
"use client";
export {
  WalletKitProvider,
  useWalletKit,
  useWalletSession,
  useWalletAccount,
  useWalletStatus,
  useWalletCapabilities,
  WalletButton,
} from "@xrpl-wallet-kit/react";

// Alias giữ backward-compat:
export { WalletKitProvider as XrplWalletProvider, useWalletKit as useXrplWallet } from "@xrpl-wallet-kit/react";
```

---

### [W3] `OtsuProvider` type declaration — window.xrpl conflict với GemWallet

**File:** `packages/adapters/otsu/src/index.ts`

**Vấn đề:** Cả Otsu adapter và GemWallet adapter đều khai báo `window.xrpl` với type khác nhau:
```ts
// Otsu declares:
declare global { interface Window { xrpl?: OtsuProvider; } }
// GemWallet declares:
declare global { interface Window { xrpl?: GemWalletProvider; } }
```

TypeScript sẽ **merge** hai declarations này, tạo union type không hợp lệ. Trong project dùng cả hai adapter, type của `window.xrpl` sẽ bị broken.

**Fix (pick one):**
- Option A: Otsu dùng unique namespace `window.otsu?: OtsuProvider` và check `(window as any).xrpl?.isOtsu`
- Option B: Tạo shared `XrplWindowProvider` interface ở core có `isOtsu?: boolean; isGem?: boolean` và cả hai adapter extend từ đó
- Option C: Cả hai adapter cast `(window as any).xrpl` và không khai báo global type — ít type-safe hơn nhưng không conflict

Option B là sạch nhất về lâu dài.

---

### [W4] `dev:react` script thiếu example app

**File:** `package.json` (root)

**Vấn đề:** Root `package.json` có script `"dev:react": "node scripts/serve-react.mjs"` nhưng không tìm thấy React example app (`examples/react/` hoặc tương đương) trong project.

**Fix:** Hoặc tạo `examples/react/` app, hoặc xóa script nếu chưa implement. Script trỏ vào file không tồn tại sẽ gây confusing cho contributor.

---

### [W5] `AuthenticateResult` overlap với `WalletAuthVerifyParams` trong auth spec

**File:** `packages/core/src/types.ts`

Coder đã thêm `AuthenticateResult` vào core. Khi bắt đầu `packages/auth`, sẽ có overlap với `WalletAuthVerifyParams` trong SIGN_IN_SPEC. Hai types có shape gần giống nhau.

**Cần quyết định tại Phase 2 của SIGN_IN_SPEC:**
- Option A: `AuthenticateResult` ở core là response của `WalletManager.authenticate()` — đây là shape phù hợp. `WalletAuthVerifyParams` trong auth là phần params truyền lên server, có thể là subset khác.
- Option B: Merge hoàn toàn — `WalletAuthVerifyParams` import từ core và alias `AuthenticateResult`.
- Option C: Xóa `AuthenticateResult` khỏi core, chỉ dùng trong auth package.

Hiện tại coder đã implement `WalletManager.authenticate()` return `AuthenticateResult` — nên Option A là path ít breaking nhất. Cần update SIGN_IN_SPEC Phase 2 để reflect quyết định này.

---

## 🔵 NOTE — Housekeeping

### [N1] `DEFAULT_AUTHENTICATE_EXPIRES_IN_SECONDS` không export

Module-level constant trong `manager.ts` không export. Nếu UI muốn hiển thị "phiên đăng nhập có hiệu lực 1 giờ" thì không đọc được. Cân nhắc export từ core.

---

### [N2] `OtsuAdapter.restoreSession` — silent fallback trên empty address

**File:** `packages/adapters/otsu/src/index.ts` ~line 201

```ts
// Nếu getAddress() returns { address: "" } thì fallback về stale session address
const address = (await provider.getAddress()).address ?? session.account.address;
```

Cần explicit check: `if (!address) return null;` thay vì fallback im lặng.

---

### [N3] `button.ts` — mutation session object (pre-existing)

**File:** `packages/ui/src/button.ts` ~line 489

UI code làm `delete session.balance` trên object owned bởi `WalletManager`. Pre-existing issue — ghi lại để fix trong future cleanup.

---

### [N4] `OtsuAdapter.signAndSubmit(submit: false)` — extra fields không trong TxResult

Khi `submit === false`, delegate về `signTransaction()`. Return object có thêm `txBlob`, `tx_blob`, `hash` không khai báo trong `TxResult` interface. Không phải runtime bug nhưng TypeScript caller sẽ không thấy các fields này.

---

### [N5] `next/tsconfig.json` — thiếu `../ui` trong references

Transitive dependency — hoạt động qua `../react` nhưng không explicit. Có thể gây vấn đề với `tsc -b` incremental trong edge case.

---

## Kiểm tra đặc biệt — packages/react architecture

### ✅ Đúng:
- Phụ thuộc chỉ `@xrpl-wallet-kit/core` + `@xrpl-wallet-kit/ui` — không có adapter imports
- `react` là `peerDependency` — đúng
- Không có business logic
- Không có XRPL-specific code trong package này

### ⚠️ Cần cải thiện:
- SSR: `WalletKitProvider` throw `"Wallet Kit React UI requires a browser document"` bên trong `useMemo` khi chạy trên server — crash component thay vì degrade gracefully. Cần document hoặc handle với `if (typeof window === "undefined") return null`.
- `WalletButton` props effect chạy lại mỗi lần parent render nếu `props` là inline object — phổ biến với JSX. Cần document "memoize options prop".
- Context không expose `authenticate` — caller phải dùng `manager.authenticate()` trực tiếp. Minor ergonomics gap.

---

## Root wiring — ✅ Đúng

- `packages/react`, `packages/next`, `packages/adapters/otsu` đều có trong root `tsconfig.json` references
- `package.json` workspaces `"packages/*"` cover tất cả packages mới
- Build order trong tsconfig: core → adapters → ui → react → next → client → browser (đúng)
- `client` và `browser` không include `react`/`next` — correct (client là pre-framework)
- `adapter-otsu` chưa được wire vào `client` — documented trong otsu README là intentional

---

## Trạng thái prerequisites cho `packages/auth`

| Prerequisite | Trạng thái |
|---|---|
| `SignMessageResult` shape chuẩn hóa | ✅ Done |
| `WALLET_ADAPTER_API_VERSION → "1.1"` | ✅ Done |
| `AuthenticateRequest` type | ✅ Done (core) |
| `AuthenticateResult` type | ✅ Done (core) |
| `WalletManager.authenticate()` | ✅ Done (core) |
| SIGN_IN_SPEC phase 1-7 | 🔲 Chưa bắt đầu |
| Quyết định `AuthenticateResult` vs `WalletAuthVerifyParams` | ❌ Chưa quyết định |
| Test coverage cho authenticate() | ❌ Chưa có |

**Kết luận:** Core plumbing đã sẵn sàng. Coder CÓ THỂ bắt đầu `packages/auth` nhưng nên resolve [W5] (AuthenticateResult overlap) tại Phase 2 và add tests [C1] song song.

---

## Action items theo priority

| Priority | ID | Việc cần làm | File |
|---|---|---|---|
| 🔴 Critical | C1 | Thêm tests cho authenticate(), normalizeSignMessageResult, OtsuAdapter | `tests/` |
| 🔴 Critical | C2 | Fix WalletKitProvider render-phase side effect → useLayoutEffect | `packages/react/src/index.tsx` |
| 🟡 Warning | W1 | Thêm `"1.1"` vào `WalletAdapterApiVersion` type | `packages/core/src/types.ts` |
| 🟡 Warning | W2 | Re-export đầy đủ từ packages/next | `packages/next/src/index.ts` |
| 🟡 Warning | W3 | Fix window.xrpl global type conflict (Otsu vs GemWallet) | `packages/adapters/otsu/src/index.ts` |
| 🟡 Warning | W4 | Tạo examples/react/ hoặc xóa dev:react script | `package.json` |
| 🟡 Warning | W5 | Quyết định AuthenticateResult vs WalletAuthVerifyParams trước Phase 2 auth | SIGN_IN_SPEC Phase 2 |
| 🔵 Note | N1 | Export DEFAULT_AUTHENTICATE_EXPIRES_IN_SECONDS | `packages/core/src/manager.ts` |
| 🔵 Note | N2 | OtsuAdapter.restoreSession: explicit empty address check | `packages/adapters/otsu/src/index.ts` |
| 🔵 Note | N5 | next/tsconfig.json: thêm `../ui` reference | `packages/next/tsconfig.json` |

---

*Generated: 2026-06-18 | Audit scope: packages/core, ui, client, browser, adapters/*, react, next*
