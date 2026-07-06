# Sign-In with Wallet — Technical Specification

**Package:** `@xrpl-wallet-kit/auth`  
**Version target:** `0.1.0-beta.1`  
**Status:** ✅ Reviewed — Ready for Implementation  
**Date:** 2026-06-03

---

## 0. Coder Review Amendments

Những điểm dưới đây là chỉnh sửa sau khi đối chiếu spec với codebase hiện tại:

- `@xrpl-wallet-kit/auth` nên là package riêng, không nhồi production auth flow vào `WalletManager.authenticate()`. Core giữ vai trò ký message; auth package xử lý nonce, server verification, state và sign-out.
- `ripple-keypairs` không được chỉ là `devDependency` nếu verifier runtime cần import nó sau khi package publish. Dùng optional peer dependency cho `ripple-keypairs`, và verifier subpath phải báo lỗi rõ nếu server chưa cài peer này.
- XRPL verifier không được coi `RegularKey` là public key. `RegularKey` là địa chỉ account khác, không phải signing public key. Verifier nên ưu tiên `publicKey` từ wallet/sign result; ledger lookup chỉ là fallback hạn chế qua `account_data.PublicKey`.
- Message hashing/signing compatibility giữa các wallet vẫn là rủi ro beta. Cần test thực tế GemWallet, Crossmark, Xaman, WalletConnect, XRPL Snap và ghi kết quả vào `docs/adapters/signing-compat.md`.

### 0.2 Verification — Round 1 (2026-06-06)

**Prerequisite (SignMessageResult shape) — DONE.** Coder đã implement xong toàn bộ SIGNMESSAGE_SHAPE_SPEC.md trước khi bắt tay vào auth package. Xem chi tiết tại `Review/SIGNMESSAGE_SHAPE_SPEC.md`.

**`packages/auth` — CHƯA BẮT ĐẦU.**

| Deliverable | Trạng thái |
|---|---|
| `packages/core/src/types.ts` — `SignatureKind` + `SignMessageResult` | ✅ Done (prerequisite) |
| `WALLET_ADAPTER_API_VERSION` → `"1.1"` | ✅ Done (prerequisite) |
| Tất cả adapter cập nhật `signatureKind` | ✅ Done (prerequisite) |
| `packages/auth/package.json` | ❌ Chưa bắt đầu |
| `packages/auth/src/types.ts` | ❌ Chưa bắt đầu |
| `packages/auth/src/auth.ts` | ❌ Chưa bắt đầu |
| `packages/auth/src/message.ts` | ❌ Chưa bắt đầu |
| `packages/auth/src/nonce.ts` | ❌ Chưa bắt đầu |
| `packages/auth/src/verifiers/xrpl.ts` | ❌ Chưa bắt đầu |
| `packages/auth/src/index.ts` | ❌ Chưa bắt đầu |
| `tests/auth.test.ts` | ❌ Chưa bắt đầu |
| `docs/adapters/signing-compat.md` | ❌ Chưa bắt đầu |

**Lưu ý thêm phát hiện ngoài spec:**

Coder đã tạo thêm `packages/next/` và `packages/react/`. Scope hiện đã rõ: React package cung cấp Provider/hooks/WalletButton, Next package là client-bound re-export cho App Router. Không ảnh hưởng trực tiếp đến `packages/auth`; package-level README cho React/Next vẫn nên bổ sung trước publish.

Coder cũng đã thêm `AuthenticateResult` vào `packages/core/src/types.ts`. Quyết định đã chốt ở 0.5.B: giữ `AuthenticateResult` cho `manager.authenticate()` và giữ `WalletAuthVerifyParams` riêng cho payload gửi server; không merge, không xóa.

---

### 0.5 Pre-implementation Review — 2026-06-18

Đây là lần kiểm tra cuối trước khi coder bắt tay vào `packages/auth`. Ghi lại 5 vấn đề cần làm rõ không có trong các update trước.

#### A. `manager.authenticate()` vs `createWalletAuth()` — HAI thứ KHÁC NHAU

Coder đã tự implement `WalletManager.authenticate()` trong core. **Đây không phải là `createWalletAuth()` và không thay thế được nó.** Cần phân biệt rõ:

| | `manager.authenticate()` | `createWalletAuth()` |
|---|---|---|
| **Package** | `@xrpl-wallet-kit/core` | `@xrpl-wallet-kit/auth` |
| **Nonce** | Không — không cần server | Có — lấy từ server qua `adapter.getNonce()` |
| **Domain / URI** | Không có trong message | Có — nhúng vào message SIWE-style |
| **Server verify** | Không — chỉ sign | Có — gọi `adapter.verify()` |
| **Replay protection** | Không | Có — nonce được server invalidate |
| **Dùng khi nào** | Ký statement đơn giản, không cần backend | Full sign-in flow với backend session |

**Quy tắc implement cho coder:** `createWalletAuth().signIn()` PHẢI gọi `manager.signMessage({ message })` trực tiếp — KHÔNG gọi `manager.authenticate()`. Lý do: auth package tự xây dựng message từ server nonce + domain + URI, nếu dùng `manager.authenticate()` thì message format sẽ sai (thiếu nonce, domain, URI).

#### B. `AuthenticateResult` vs `WalletAuthVerifyParams` — KHÔNG CONFLICT

Coder đã thêm `AuthenticateResult` vào core. Đây là return type của `manager.authenticate()`. Nó KHÔNG conflict với `WalletAuthVerifyParams` trong auth package:

```
AuthenticateResult (core)          WalletAuthVerifyParams (auth/types.ts)
─────────────────────────────      ──────────────────────────────────────
address: string                    address: string
message: string                    message: string
signatureKind: SignatureKind        signatureKind: SignatureKind
proof: string                      proof: string
signature?: string                 signature?: string
txBlob?: string                    txBlob?: string
publicKey?: string                 publicKey?: string
issuedAt: string                   ← KHÔNG CÓ (không cần trong verify payload)
expiresAt: string                  ← KHÔNG CÓ
statement: string                  ← KHÔNG CÓ
raw?: unknown                      ← KHÔNG CÓ
```

**Kết luận:** Giữ cả hai. `AuthenticateResult` là structured response; `WalletAuthVerifyParams` là gói payload gửi lên server. Không merge, không xóa.

#### C. `proof` đã được đảm bảo bởi `normalizeSignMessageResult()` trong manager

Coder đã implement `normalizeSignMessageResult()` trong manager.ts. Method này:
- Throw `signRejected` nếu adapter trả về result không có `signature` (khi kind === "signature") hoặc không có `txBlob` (khi kind === "signedTx")
- Gán `proof = signature ?? txBlob` trước khi trả về
- Warn adapter cũ không set `signatureKind`

**Hệ quả cho auth package:** Khi auth package gọi `manager.signMessage()`, `signResult.proof` được đảm bảo là non-empty string — auth package không cần double-check. Chỉ cần check `signResult.proof` để throw lỗi thân thiện nếu undefined (backward compat guard, không xảy ra với coder's normalizer).

#### D. R4 adapter changes — ĐÃ ĐƯỢC IMPLEMENT

Đọc source sau khi audit xác nhận tất cả adapters đã có R4-compliant `publicKey` resolution:

| Adapter | R4 implementation |
|---|---|
| GemWallet | `connect()` gọi `getPublicKey()` song song; `signMessage()` fallback `getPublicKey()` nếu `request.account.publicKey` missing |
| Crossmark | `pickString()` lấy publicKey từ nhiều response paths: `response.data.publicKey`, `response.publicKey`, `publicKey`, v.v. |
| DropFi | `resolvePublicKey()` helper, fallback qua `provider.publicKey`, `provider.getPublicKey()`, `connect()` result, `getAddress()` result |
| Otsu | `result.publicKey ?? request.account?.publicKey` trong signMessage |
| WalletConnect | `publicKeyResponsePaths()` helper tìm publicKey trong response |
| Xaman / xrpl-snap | `signedTx` path — không cần publicKey |

**Kết luận:** R4 prerequisites đã xong. Auth package Phase 5 (verifier) có thể tin tưởng `signResult.publicKey` có giá trị với các "signature" adapters nếu wallet/provider hỗ trợ.

#### E. Monorepo wiring — THIẾU trong Phase 1

Phase 1 hiện tại không nhắc đến wiring. Coder PHẢI:

```bash
# 1. Thêm vào root tsconfig.json:
{ "path": "./packages/auth" }

# 2. Workspace đã covered bởi "packages/*" — không cần thêm package.json

# 3. KHÔNG thêm auth vào packages/client — auth là optional, dApp tự install riêng
# packages/client là all-in-one convenience, auth là opt-in thêm backend security
```

### 0.6 Audit follow-up after React/Next review — 2026-06-19

Các điểm liên quan đến auth prerequisites đã được cập nhật trong codebase:

- React Provider render-phase side effect đã fix: `WalletKitProvider` tạo/destroy modal trong browser-safe layout effect và render `null` tới khi context sẵn sàng; `tests/react.test.ts` cover SSR render không throw.
- Next client boundary đã fix: `@xrpl-wallet-kit/next` re-export đầy đủ `WalletKitProvider`, `WalletButton`, các hooks, aliases và types từ React package.
- `WalletAdapterApiVersion` đã include `"1.1"` để phản ánh adapter API hiện tại.
- Otsu global type conflict đã fix: adapter không còn declare global `window.xrpl?: OtsuProvider`; runtime đọc injected provider qua `unknown` + `isOtsu` guard.
- Test coverage đã tăng: `npm test -- --runInBand` pass với 127 tests tại thời điểm cập nhật này.

Remaining non-auth blockers:

- `packages/react/README.md` và `packages/next/README.md` vẫn chưa có, dù package manifest include `README.md` trong `files`.
- `packages/auth` vẫn chưa bắt đầu.

---

### 0.1 R2 update after SignMessageResult shape standardization

`Review/SIGNMESSAGE_SHAPE_SPEC.md` is now the source of truth for the wallet signing result shape. This spec must be read with these amendments before implementation:

- `WalletAuthVerifyParams` must include `signatureKind: "signature" | "signedTx"`, required `proof`, optional `signature`, optional `txBlob`, and optional `publicKey`.
- `proof` is the simple integration field. When `signatureKind === "signature"`, `proof === signature`. When `signatureKind === "signedTx"`, `proof === txBlob`.
- `WalletAuth.signIn()` must not reject a result only because `signature` is missing. For Xaman, XRPL Snap, and WalletConnect transaction fallback, the verifiable proof is a signed transaction blob exposed through `proof` and `txBlob`.
- `WalletAuthAdapter.verify()` must receive the complete proof object, not only `{ message, signature, address, publicKey }`.
- `SignatureVerifier.verify()` must branch by `signatureKind`.
- For `signatureKind: "signedTx"`, use `verify-xrpl-signature` to verify the signed transaction blob, decode the transaction, verify `verifyResult.signedBy === address`, verify `tx.Account === address`, and compare the memo text with the original auth message.
- For `signatureKind: "signature"`, use `ripple-keypairs.verify(messageHex, signature, publicKey)` and verify `deriveAddress(publicKey) === address`.
- `@xrpl-wallet-kit/auth/verifiers` should keep server-only dependencies out of the client entry. Suggested optional peers for the XRPL verifier path: `ripple-keypairs`, `verify-xrpl-signature`, and `xrpl`.
- Ledger lookup via `account_info.account_data.PublicKey` is only a fallback for compact signatures. It cannot verify accounts where the signing public key is unavailable or where signing happened through another key path unless the wallet returns the signing `publicKey`.

### 0.3 R3 update: common `proof` field for app DX

`SignMessageResult` and auth verify payloads now carry a common `proof` field to reduce app-side branching:

```ts
type SignMessageResult = {
  signatureKind: "signature" | "signedTx";
  proof: string;
  signature?: string;
  txBlob?: string;
  publicKey?: string;
  raw?: unknown;
};
```

Simple app integrations may send `{ message, address, signatureKind, proof, publicKey }` to the server without choosing between `signature` and `txBlob` on the client. Server/verifier code must still branch on `signatureKind`:

- `signatureKind === "signature"`: verify `proof` as the compact signature. `signature` should mirror `proof` when present.
- `signatureKind === "signedTx"`: verify `proof` as the signed transaction blob. `txBlob` should mirror `proof` when present.

Do not put signed transaction blobs into `signature`. Keep `signature` and `txBlob` as semantic fields for advanced users and backward compatibility, while `proof` is the unified value for DX.

### 0.4 R4 update: compact signature `publicKey` requirement

Latest integration testing showed that a result shaped like this is not enough for server verification:

```json
{
  "signatureKind": "signature",
  "proof": "...",
  "signature": "..."
}
```

For `signatureKind === "signature"`, the server verifier must also receive a signing `publicKey` unless it can safely resolve one from ledger `account_info.account_data.PublicKey`. The verifier must fail clearly when no usable public key is available. Do not guess and do not use `RegularKey` as a public key.

Required server payload for compact signatures:

```ts
{
  address: string;
  message: string;
  signatureKind: "signature";
  proof: string;
  signature?: string;
  publicKey: string;
}
```

Built-in adapter behavior after the R4 patch:

| Adapter | `signatureKind` | `publicKey` handling |
|---|---:|---|
| GemWallet | `"signature"` | Calls `getPublicKey()` during `connect()` and falls back to `getPublicKey()` during `signMessage()` when `request.account.publicKey` is missing. |
| Crossmark | `"signature"` | Uses `publicKey` from `signInAndWait` response first, then falls back to `request.account.publicKey`. |
| DropFi | `"signature"` | Reads `publicKey` from provider fields, `getPublicKey()`, `connect()` result, `getAddress()` result, or `signMessage()` wrappers when available. |
| Otsu | `"signature"` | Preserves `publicKey` from `connect()`, `getAddress()`, or `signMessage()` response when the provider exposes it. |
| Xaman | `"signedTx"` | No external `publicKey` required; proof is a signed transaction blob. |
| XRPL Snap | `"signedTx"` | No external `publicKey` required; proof is a signed transaction blob. |
| WalletConnect verified profiles (Bifrost, Joey) | `"signedTx"` | Default auth-safe path uses legacy `xrpl_signTransaction` with `submit:false`; no external `publicKey` required. |
| WalletConnect direct `xrpl_signMessage` | `"signature"` | Not the default path. Only use for a future wallet/profile after real-wallet verification; requires wallet `publicKey` or ledger fallback. |
| WalletConnect unsafe/unsupported profiles (Bitget, Girin, StaticBit) | n/a | `signMessage` disabled by default; auth must fail capability check instead of prompting. |

Implementation rule for `@xrpl-wallet-kit/auth`:

- `WalletAuth.signIn()` should pass through `publicKey: signResult.publicKey`.
- `createXrplSignatureVerifier()` must treat missing `publicKey` on compact signatures as a recoverable verifier problem only if ledger fallback is enabled and succeeds.
- Real-wallet compatibility docs must record whether each wallet returns `publicKey` for compact signatures.
- App/server examples should state that `signatureKind === "signature"` needs `publicKey`, while `signatureKind === "signedTx"` does not.

---

## 1. Mục tiêu & Nguyên tắc thiết kế

### 1.1 Mục tiêu

Cung cấp flow xác thực người dùng qua chữ ký ví (Sign-In with Wallet) tương tự Sign-In with Ethereum (EIP-4361), nhưng:

- **Không phụ thuộc blockchain cụ thể** — core API hoàn toàn generic, không hardcode tên chain
- **Pluggable** — dApp tự cung cấp backend logic (getNonce, verify, signOut); kit không áp đặt framework
- **Extensible** — khi kit mở rộng sang chain khác (hoặc đa chain), API không cần thay đổi
- **Tree-shakeable** — server-side verifier (phụ thuộc ripple-keypairs / verify-xrpl-signature / xrpl) là sub-path riêng, không vào client bundle

### 1.2 Nguyên tắc đặt tên — BẮT BUỘC tuân thủ

> **Coder lưu ý:** Đây là rule quan trọng nhất của spec này.

**❌ Không được đặt tên theo blockchain:**
```ts
// SAI — hardcode chain
createXrplAuth()
XrplAuthAdapter
signInWithXrpl()
XrplAuthMessage
xrplVerify()
```

**✅ Đặt tên theo domain (wallet / auth):**
```ts
// ĐÚNG — generic
createWalletAuth()
WalletAuthAdapter
signIn()
WalletAuthMessage
SignatureVerifier
```

**Ngoại lệ duy nhất được phép:** các concrete implementation (giống như `createXamanAdapter`, `createGemWalletAdapter`) có thể có tên chain cụ thể:
```ts
// OK — concrete implementations
createXrplSignatureVerifier()     // verifier cụ thể cho XRPL
createEthereumSignatureVerifier() // nếu sau này kit hỗ trợ EVM
```

---

## 2. Monorepo Layout

```
packages/
  auth/                              ← package mới
    package.json                     ← @xrpl-wallet-kit/auth
    tsconfig.json
    src/
      index.ts                       ← public API (client-safe)
      types.ts                       ← tất cả interfaces & types
      auth.ts                        ← WalletAuth controller (createWalletAuth)
      message.ts                     ← formatAuthMessage, parseAuthMessage
      nonce.ts                       ← generateNonce (crypto.randomUUID)
      verifiers/
        index.ts                     ← re-export verifiers
        xrpl.ts                      ← createXrplSignatureVerifier (server-side)
```

### package.json exports map

```json
{
  "name": "@xrpl-wallet-kit/auth",
  "version": "0.1.0-beta.1",
  "type": "module",
  "exports": {
    ".": "./dist/index.js",
    "./verifiers": "./dist/verifiers/index.js"
  },
  "dependencies": {
    "@xrpl-wallet-kit/core": "workspace:*"
  },
  "peerDependencies": {
    "ripple-keypairs": "^2.0.0",
    "verify-xrpl-signature": "^9.2.0",
    "xrpl": "^4.0.0"
  },
  "peerDependenciesMeta": {
    "ripple-keypairs": {
      "optional": true
    },
    "verify-xrpl-signature": {
      "optional": true
    },
    "xrpl": {
      "optional": true
    }
  },
  "devDependencies": {
    "ripple-keypairs": "^2.0.0",
    "verify-xrpl-signature": "^9.2.0",
    "xrpl": "^4.0.0"
  }
}
```

> `ripple-keypairs`, `verify-xrpl-signature`, and `xrpl` are optional peer dependencies + dev dependencies in package `auth`. `createXrplSignatureVerifier` exports from `./verifiers`; users install these peers only when they need server-side XRPL verification. **Do not import verifier code or these chain-specific dependencies into `./index.ts`.** If server code calls a verifier without the required peer installed, throw a clear error such as `Install ripple-keypairs and verify-xrpl-signature to use @xrpl-wallet-kit/auth/verifiers.`

---

## 3. TypeScript Types (types.ts)

```ts
import type { SignatureKind } from "@xrpl-wallet-kit/core";

// ─── Adapter interface ───────────────────────────────────────────────────────
// Coder implement interface này để connect với backend cụ thể của từng dApp.
// Interface hoàn toàn generic — không mention bất kỳ chain nào.

export interface WalletAuthAdapter {
  /**
   * Step 1 — Lấy nonce một lần (one-time, từ server của dApp).
   * Nonce phải là random, unpredictable, và expire sau khi dùng.
   */
  getNonce(): Promise<string>;

  /**
   * Step 2 — Tạo message text để wallet ký.
   * Kit gọi hàm này với các params đã resolve (address, nonce, domain...).
   * Coder có thể dùng formatAuthMessage() của kit hoặc custom format riêng.
   */
  createMessage(params: WalletAuthMessageParams): string;

  /**
   * Step 3 — Gửi message + signature lên server để verify.
   * Server so khớp address, verify signature, tạo session (JWT, cookie...).
   * Trả về true nếu xác thực thành công.
   */
  verify(params: WalletAuthVerifyParams): Promise<boolean>;

  /**
   * Step 4 — Đăng xuất (optional).
   * Gọi API server để destroy session/token.
   */
  signOut?(): Promise<void>;
}

// ─── Message params ──────────────────────────────────────────────────────────

export interface WalletAuthMessageParams {
  /** Địa chỉ ví đang kết nối */
  address: string;

  /** Nonce từ server — ngăn replay attack */
  nonce: string;

  /** window.location.host — dApp domain */
  domain: string;

  /** window.location.origin — full origin URI */
  uri: string;

  /**
   * Chain identifier (optional).
   * Để dApp/server biết message được tạo trên chain nào.
   * Không hardcode format — coder tự quyết định convention:
   *   XRPL mainnet: "xrpl:0"
   *   XRPL testnet: "xrpl:1"
   *   EVM mainnet: "eip155:1"
   */
  chainId?: string;

  /** ISO 8601 — thời điểm tạo message (defaults to Date.now()) */
  issuedAt?: string;

  /** ISO 8601 — thời điểm hết hạn (optional) */
  expirationTime?: string;

  /**
   * Câu thông báo hiện cho user trong wallet UI.
   * Ví dụ: "Sign in to access your dashboard."
   */
  statement?: string;

  /** Message format version — default "1" */
  version?: string;
}

// ─── Verify params ───────────────────────────────────────────────────────────

export interface WalletAuthVerifyParams {
  /** Message text gốc (chưa hash) — server sẽ parse hoặc hash lại để verify */
  message: string;

  /** Discriminator returned by WalletManager.signMessage(). */
  signatureKind: SignatureKind;

  /**
   * Common proof value for simple app integrations.
   * - signatureKind === "signature": same value as signature
   * - signatureKind === "signedTx": same value as txBlob
   */
  proof: string;

  /** Compact signature. Present when signatureKind === "signature". */
  signature?: string;

  /** Signed transaction blob. Present when signatureKind === "signedTx". */
  txBlob?: string;

  /** Address wallet claim — server cross-check với kết quả verify */
  address: string;

  /**
   * Optional signing public key returned by the wallet/adapter.
   * Strongly recommended for XRPL server verification because ledger account_info
   * may not expose a usable PublicKey for every account state.
   */
  publicKey?: string;
}

// ─── Auth state ──────────────────────────────────────────────────────────────

export type WalletAuthStatus =
  | "unauthenticated"  // chưa đăng nhập
  | "loading"          // đang thực hiện signIn / signOut
  | "authenticated"    // đã xác thực thành công
  | "error";           // xảy ra lỗi

export interface WalletAuthState {
  status: WalletAuthStatus;
  /** Địa chỉ ví đang authenticated — null nếu chưa authenticate */
  address: string | null;
  /** Lỗi gần nhất — null nếu không có lỗi */
  error: Error | null;
}

// ─── Controller interface ────────────────────────────────────────────────────

export interface WalletAuth {
  /** Trạng thái hiện tại */
  readonly status: WalletAuthStatus;
  /** Địa chỉ authenticated — null nếu chưa đăng nhập */
  readonly address: string | null;

  /**
   * Trigger sign-in flow:
   * 1. Gọi adapter.getNonce()
   * 2. Gọi adapter.createMessage() với address + nonce
   * 3. Gọi manager.signMessage(message)
   * 4. Gọi adapter.verify() với full proof object: signatureKind + proof + signature/txBlob + address
   * 5. Cập nhật state → "authenticated"
   */
  signIn(): Promise<void>;

  /**
   * Trigger sign-out:
   * 1. Gọi adapter.signOut() nếu có
   * 2. Reset state → "unauthenticated"
   */
  signOut(): Promise<void>;

  /** Đăng ký listener khi state thay đổi */
  on(event: "change", handler: (state: WalletAuthState) => void): void;
  /** Gỡ listener */
  off(event: "change", handler: (state: WalletAuthState) => void): void;

  /** Cleanup — gỡ tất cả listeners, cancel pending operations */
  destroy(): void;
}

// ─── Options ─────────────────────────────────────────────────────────────────

export interface WalletAuthOptions {
  /**
   * Domain để nhúng vào message (default: window.location.host).
   * Override khi chạy trong môi trường không có window (SSR, test).
   */
  domain?: string;

  /**
   * URI để nhúng vào message (default: window.location.origin).
   */
  uri?: string;

  /**
   * Chain ID để nhúng vào message.
   * Không có default — coder tự cung cấp để tránh hardcode.
   */
  chainId?: string;

  /**
   * Statement hiện trong wallet UI (optional).
   * Ví dụ: "Sign in to access My dApp."
   */
  statement?: string;

  /**
   * Thời hạn message (giây, tính từ issuedAt).
   * Nếu set, message sẽ có trường expirationTime.
   * Server nên reject message đã hết hạn.
   */
  expiresIn?: number;
}

// ─── Server-side verifier interface ──────────────────────────────────────────
// Đặt ở types.ts để client code có thể import type mà không kéo server deps.

export interface SignatureVerifier {
  /**
   * Verify chữ ký trên server-side.
   * @param address  - địa chỉ ví
   * @param message  - message text gốc (plain UTF-8)
   * @param signatureKind - "signature" for compact sig, "signedTx" for signed transaction proof
   * @param proof - common proof value; compact signature or signed transaction blob based on signatureKind
   * @param signature - compact signature when signatureKind === "signature"
   * @param txBlob - signed transaction blob when signatureKind === "signedTx"
   * @param publicKey - optional public key for compact signature verification
   */
  verify(params: WalletAuthVerifyParams): Promise<boolean>;
}
```

---

## 4. Core Controller (auth.ts)

```ts
import type { WalletManager } from "@xrpl-wallet-kit/core";
import type { WalletAuthAdapter, WalletAuthOptions, WalletAuth, WalletAuthState, WalletAuthStatus } from "./types";

/**
 * Tạo WalletAuth controller — entry point của package.
 *
 * @param manager - WalletManager đã connect (manager.activeSession phải có)
 * @param adapter - WalletAuthAdapter do dApp cung cấp
 * @param options - config (domain, uri, chainId, statement, expiresIn)
 *
 * @example
 * const auth = createWalletAuth(manager, myAdapter, {
 *   chainId: "xrpl:0",
 *   statement: "Sign in to My dApp",
 *   expiresIn: 3600,
 * });
 *
 * auth.on("change", (state) => { ... });
 * await auth.signIn();
 */
export function createWalletAuth(
  manager: WalletManager,
  adapter: WalletAuthAdapter,
  options: WalletAuthOptions = {}
): WalletAuth {
  // implementation ...
}
```

### signIn() flow (pseudocode)

```
signIn():
  1. Nếu status === "loading" → throw (no concurrent sign-in)
  2. address = manager.activeSession?.account.address
     Nếu không có → throw Error("No active wallet session. Connect a wallet first.")
  3. setState({ status: "loading", error: null })
  4. nonce = await adapter.getNonce()
  5. domain  = options.domain ?? window.location.host
     uri     = options.uri    ?? window.location.origin
     issuedAt = new Date().toISOString()
     expirationTime = options.expiresIn
       ? new Date(Date.now() + options.expiresIn * 1000).toISOString()
       : undefined
  6. messageText = adapter.createMessage({
       address, nonce, domain, uri,
       chainId: options.chainId,
       statement: options.statement,
       issuedAt, expirationTime,
       version: "1",
     })
  7. signResult = await manager.signMessage({ message: messageText })
     Auth package không branch theo wallet id; wallet-specific behavior thuộc adapter và manager.signMessage().
     Nếu !signResult.proof → throw Error(...)
     Nếu signResult.signatureKind === "signature" && !signResult.signature → dùng signResult.proof làm compact signature fallback
     Nếu signResult.signatureKind === "signedTx" && !signResult.txBlob → dùng signResult.proof làm signed transaction blob fallback
  8. ok = await adapter.verify({
       message: messageText,
       signatureKind: signResult.signatureKind,
       proof: signResult.proof,
       signature: signResult.signature,
       txBlob: signResult.txBlob,
       address,
       publicKey: signResult.publicKey,
     })
     Nếu !ok → throw Error("Authentication rejected by server.")
  9. setState({ status: "authenticated", address, error: null })

Catch (e):
  setState({ status: "error", address: null, error: e })
  throw e
```

---

## 5. Message Format (message.ts)

Package cung cấp `formatAuthMessage()` như một utility helper. **Coder trong `createMessage()` của adapter có thể dùng hoặc tự format** — không bắt buộc.

### Format chuẩn

```
{domain} wants you to sign in with your wallet:
{address}

{statement}

URI: {uri}
Version: {version}
Nonce: {nonce}
Issued At: {issuedAt}
```

Nếu có chainId:
```
Chain ID: {chainId}
```

Nếu có expirationTime:
```
Expiration Time: {expirationTime}
```

### Ví dụ message thực tế

```
app.mydapp.io wants you to sign in with your wallet:
rN7n3473SaZBCG4dFL83w7PB5e4LKRMW3h

Sign in to access your dashboard.

URI: https://app.mydapp.io
Version: 1
Nonce: abc123xyz789
Issued At: 2026-06-03T10:00:00.000Z
Chain ID: xrpl:0
Expiration Time: 2026-06-03T11:00:00.000Z
```

### API

```ts
/**
 * Format message text từ params.
 * Dùng trong createMessage() của WalletAuthAdapter.
 */
export function formatAuthMessage(params: WalletAuthMessageParams): string;

/**
 * Parse message text thành object.
 * Dùng trên server để verify từng field.
 * Throws nếu format không hợp lệ.
 */
export function parseAuthMessage(message: string): WalletAuthMessageParams;

/**
 * Validate parsed message:
 * - issuedAt không quá xa trong quá khứ (default: trong vòng 1 tiếng)
 * - expirationTime chưa qua (nếu có)
 * - domain khớp với expected
 * - nonce hợp lệ (nếu cung cấp nonceSet)
 */
export function validateAuthMessage(
  params: WalletAuthMessageParams,
  options: {
    expectedDomain: string;
    maxAge?: number;          // giây, default 3600
    usedNonces?: Set<string>; // nonces đã dùng (để prevent replay)
  }
): { valid: boolean; reason?: string };
```

---

## 6. Nonce Utility (nonce.ts)

```ts
/**
 * Tạo nonce ngẫu nhiên an toàn trên client.
 * Dùng trong server handler để tạo nonce trước khi trả về client —
 * hoặc dùng crypto.randomUUID() trực tiếp nếu coder prefer.
 *
 * Format: 16 bytes hex (32 chars) — đủ entropy để prevent replay.
 */
export function generateNonce(): string {
  // Browser: crypto.getRandomValues()
  // Node.js: crypto.randomBytes()
  // Không dùng Math.random()
}
```

> **Lưu ý:** Nonce PHẢI được generate trên **server** và lưu vào session/DB trước khi trả về client. Client không tự generate nonce. `generateNonce()` này chỉ là helper cho server-side API handler.

---

## 7. Server-Side Verifier (verifiers/xrpl.ts)

Sub-path export: `@xrpl-wallet-kit/auth/verifiers`

> **Chỉ import trên server.** Kéo vào client bundle làm tăng bundle ~50KB.

```ts
import { createXrplSignatureVerifier } from "@xrpl-wallet-kit/auth/verifiers";
```

### API

```ts
export interface XrplSignatureVerifierOptions {
  /**
   * XRPL node WebSocket URL — dùng để lookup account_data.PublicKey
   * khi publicKey không được cung cấp trực tiếp.
   * Nếu không set, verify() bắt buộc phải nhận publicKey trong params.
   *
   * Lưu ý: account_data.RegularKey là địa chỉ account khác, KHÔNG phải public key.
   * Không được dùng RegularKey làm publicKey để verify chữ ký.
   */
  nodeUrl?: string;

  /**
   * Custom message hashing function.
   *
   * WHY THIS EXISTS: Mỗi wallet có thể dùng cách hash khác nhau trước khi ký:
   * - Một số ký raw UTF-8 bytes trực tiếp
   * - Một số thêm prefix (tương tự EIP-191)
   * - Một số dùng SHA-512 half với XRPL tx prefix
   *
   * Default implementation: raw UTF-8 bytes (không prefix).
   * Nếu wallet dApp dùng cách hash khác, coder override ở đây.
   *
   * @param message - message text gốc
   * @returns hex string của bytes cần verify
   */
  hashMessage?: (message: string) => string;

  /**
   * Timeout khi query XRPL node (ms, default: 5000)
   */
  nodeTimeout?: number;
}

/**
 * Tạo SignatureVerifier cho XRPL.
 * Implements SignatureVerifier interface từ types.ts.
 *
 * Dùng verify-xrpl-signature cho signed transaction proofs và ripple-keypairs
 * cho compact message signatures.
 *
 * @example Server-side (Next.js API route):
 * ```ts
 * import { createXrplSignatureVerifier } from "@xrpl-wallet-kit/auth/verifiers";
 *
 * const verifier = createXrplSignatureVerifier({
 *   nodeUrl: "wss://xrplcluster.com",
 * });
 *
 * // trong /api/auth/verify:
 * const isValid = await verifier.verify({
 *   address: body.address,
 *   message: body.message,
 *   signatureKind: body.signatureKind,
 *   proof: body.proof,
 *   signature: body.signature,
 *   txBlob: body.txBlob,
 *   // publicKey: body.publicKey, // nếu wallet trả về
 * });
 * ```
 */
export function createXrplSignatureVerifier(
  options?: XrplSignatureVerifierOptions
): SignatureVerifier;
```

### Verify logic (implementation guide cho coder)

```
verify({ address, message, signatureKind, proof, signature, txBlob, publicKey }):

  If signatureKind === "signedTx":
    1. Require proof. Let signedBlob = txBlob ?? proof.
    2. verify-xrpl-signature.verifySignature(signedBlob).
       Reject if signatureValid is false.
       Reject if signedBy !== address.
    3. Decode signedBlob with xrpl.decode(signedBlob).
    4. Reject if tx.Account !== address.
    5. Extract first Memo.MemoData, hex-decode as UTF-8.
    6. Reject if decoded memo text !== message.
    7. Return true.

  If signatureKind === "signature":
    1. Require proof. Let compactSignature = signature ?? proof.
    2. Resolve public key:
     a. Nếu publicKey được cung cấp → dùng trực tiếp
     b. Nếu không → gọi account_info trên XRPL node:
        result = await client.request({ command: "account_info", account: address })
        publicKey = result.account_data.PublicKey
     c. Nếu vẫn không có → throw Error("Cannot resolve public key for address")
     d. KHÔNG dùng result.account_data.RegularKey. RegularKey là địa chỉ account,
        không phải public key. Nếu account dùng RegularKey và wallet không trả
        về publicKey, verifier không thể xác minh chắc chắn chỉ từ account_info.

  3. Hash message:
     messageHex = options.hashMessage
       ? options.hashMessage(message)
       : Buffer.from(message, 'utf8').toString('hex')

  4. Verify với ripple-keypairs:
     try:
       return verify(messageHex, compactSignature, publicKey)
       // ripple-keypairs tự detect secp256k1 vs ed25519 từ prefix public key
     catch:
       return false

  5. Cross-check address:
     derivedAddress = deriveAddress(publicKey)
     if (derivedAddress !== address) return false
```

> **Known issue — Hash format inconsistency:** Các wallet khác nhau có thể dùng cách hash message khác nhau. GemWallet và Crossmark chưa công bố spec chính thức. Coder cần test thực tế với từng wallet và document kết quả vào `docs/adapters/signing-compat.md`. Đây là lý do `hashMessage` option được để mở.

---

## 8. Public API (index.ts)

```ts
// Client-safe exports

export { createWalletAuth } from "./auth";
export { formatAuthMessage, parseAuthMessage, validateAuthMessage } from "./message";
export { generateNonce } from "./nonce";

export type {
  WalletAuthAdapter,
  WalletAuthMessageParams,
  WalletAuthVerifyParams,
  WalletAuthState,
  WalletAuthStatus,
  WalletAuthOptions,
  WalletAuth,
  SignatureVerifier,        // interface — server code cũng cần
} from "./types";

// KHÔNG export createXrplSignatureVerifier ở đây
// → dùng: import { createXrplSignatureVerifier } from "@xrpl-wallet-kit/auth/verifiers"
```

---

## 9. Usage Examples

### 9.1 Basic — Vanilla JS / TypeScript

```ts
import { createWalletAuth } from "@xrpl-wallet-kit/auth";

// Bước 1: Tạo adapter kết nối với backend của dApp
const adapter = {
  async getNonce() {
    const res = await fetch("/api/auth/nonce");
    return res.text();
  },

  createMessage(params) {
    // Dùng helper của kit (hoặc tự format)
    return formatAuthMessage(params);
  },

  async verify({ message, signatureKind, proof, signature, txBlob, address, publicKey }) {
    const res = await fetch("/api/auth/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, signatureKind, proof, signature, txBlob, address, publicKey }),
    });
    return res.ok;
  },

  async signOut() {
    await fetch("/api/auth/signout", { method: "POST" });
  },
};

// Bước 2: Tạo controller — SAU KHI wallet đã connect
const auth = createWalletAuth(manager, adapter, {
  chainId: "xrpl:0",
  statement: "Sign in to access your dashboard.",
  expiresIn: 3600,
});

// Bước 3: Listen state changes
auth.on("change", (state) => {
  console.log("Auth status:", state.status, state.address);
});

// Bước 4: Trigger sign-in (sau khi user click "Sign In" button)
try {
  await auth.signIn();
  console.log("Authenticated as", auth.address);
} catch (e) {
  console.error("Auth failed:", e);
}
```

### 9.2 Server — Next.js API routes (Node.js)

```ts
// pages/api/auth/nonce.ts
import { generateNonce } from "@xrpl-wallet-kit/auth";

export async function GET(req: Request) {
  const nonce = generateNonce();
  // Lưu nonce vào session/DB với TTL 5 phút
  await saveNonce(req, nonce);
  return new Response(nonce);
}

// pages/api/auth/verify.ts
import { createXrplSignatureVerifier } from "@xrpl-wallet-kit/auth/verifiers";
import { parseAuthMessage, validateAuthMessage } from "@xrpl-wallet-kit/auth";

const verifier = createXrplSignatureVerifier({
  nodeUrl: process.env.XRPL_NODE_URL,
});

export async function POST(req: Request) {
  const { message, signatureKind, proof, signature, txBlob, address, publicKey } = await req.json();

  // 1. Parse và validate message fields
  const parsed = parseAuthMessage(message);
  const { valid, reason } = validateAuthMessage(parsed, {
    expectedDomain: "app.mydapp.io",
    maxAge: 300,            // message không được cũ hơn 5 phút
    usedNonces: nonceSet,   // prevent replay
  });
  if (!valid) return new Response(reason, { status: 400 });

  // 2. Verify signature or signed transaction proof
  const ok = await verifier.verify({
    address,
    message,
    signatureKind,
    proof,
    signature,
    txBlob,
    publicKey
  });
  if (!ok) return new Response("Invalid signature", { status: 401 });

  // 3. Tạo session
  await createSession(address);
  return new Response("OK");
}
```

### 9.3 React integration (hook pattern — ngoài scope của package, nhưng dApp có thể tự viết)

```ts
// hooks/useWalletAuth.ts — dApp tự implement, không thuộc @xrpl-wallet-kit/auth
import { useEffect, useState } from "react";
import { createWalletAuth, WalletAuthState } from "@xrpl-wallet-kit/auth";

export function useWalletAuth(manager: WalletManager, adapter: WalletAuthAdapter) {
  const [state, setState] = useState<WalletAuthState>({
    status: "unauthenticated",
    address: null,
    error: null,
  });

  useEffect(() => {
    const auth = createWalletAuth(manager, adapter, { chainId: "xrpl:0" });
    auth.on("change", setState);
    return () => auth.destroy();
  }, [manager, adapter]);

  return state;
}
```

---

## 10. Integration với WalletManager

### Điều kiện tiên quyết

`manager.signMessage()` phải hoạt động — tức là `manager.activeSession` phải có và adapter đang active phải support `signMessage`.

```ts
// createWalletAuth phải throw lỗi rõ ràng nếu:
// 1. manager.activeSession === null (chưa connect wallet)
// 2. manager.capabilities.signMessage === false (adapter không hỗ trợ)
```

### Adapter capability check

| Wallet | signMessage | Ghi chú |
|---|:---:|---|
| GemWallet | ✅ | `gemWallet.signMessage()` |
| Crossmark | ✅ | `crossmark.sign()` |
| WalletConnect verified profiles (Bifrost, Joey) | ✅ | Legacy signed transaction proof: `xrpl_signTransaction` + `submit:false` |
| WalletConnect unsafe/unsupported profiles (Bitget, Girin, StaticBit) | ❌ | Disabled by default for auth/signMessage; capability check must fail before prompting |
| Otsu | ✅ | `provider.signMessage()` |
| Xaman | ✅ | via payload sign |
| Dropfi | ✅ | |
| XRPL Snap | ✅ | |
| **Ledger** | ❌ | Ledger không hỗ trợ sign arbitrary message — auth không hoạt động |

> Coder cần check `adapter.capabilities.signMessage` trong `createWalletAuth()` và throw `Error("Active wallet adapter does not support message signing.")` nếu false.

---

## 11. Error Handling

`signIn()` throws trong các trường hợp:

| Error | Message |
|---|---|
| Chưa connect wallet | `"No active wallet session. Connect a wallet first."` |
| Adapter không hỗ trợ signMessage | `"Active wallet adapter does not support message signing."` |
| User reject sign | Re-throw `WalletError` từ manager (code: `SIGN_REJECTED`) |
| Wallet không trả proof hợp lệ | `"Wallet did not return a verifiable signature proof."` |
| getNonce fail | Re-throw với message gốc |
| verify() trả về false | `"Authentication rejected by server."` |
| Timeout | Re-throw `WalletError` (code: `REQUEST_TIMEOUT`) |

Mọi error đều cập nhật state về `{ status: "error", error: e }`.

---

## 12. Hard Rules — Coder phải tuân thủ

1. **Không hardcode tên chain trong types.ts và auth.ts** — `chainId` là string tự do, không enum
2. **Không import `ripple-keypairs`, `verify-xrpl-signature`, `xrpl` hoặc bất kỳ chain-specific lib vào `index.ts`** — server deps chỉ ở `verifiers/`; các verifier dependency phải là optional peer dependency, không chỉ là devDependency
3. **`formatAuthMessage()` không được mention "XRPL", "XRP", "Ethereum" trong message output** — chỉ dùng "wallet"
4. **`WalletAuth.signIn()` phải cancel nếu manager.activeSession bị mất trong lúc flow chạy**
5. **`destroy()` phải gỡ tất cả event listeners** — không để memory leak
6. **Nonce phải được validate và invalidate phía server sau lần dùng đầu tiên** — không validate trên client
7. **`signOut()` phải reset state về unauthenticated kể cả khi adapter.signOut() throw** — dùng `finally`
8. **Không tự động trigger signIn khi wallet connect** — đây là quyết định của dApp, không phải kit
9. **Package phải work mà không có `window`** — support SSR (Node.js), dùng `typeof window !== "undefined"` khi cần

---

## 13. Testing Requirements

Coder cần viết test cho:

- `formatAuthMessage()` — output đúng format với đủ/thiếu optional fields
- `parseAuthMessage()` — round-trip với formatAuthMessage
- `validateAuthMessage()` — expired message, wrong domain, replayed nonce
- `generateNonce()` — unique, đủ entropy (32+ chars), no Math.random
- `createWalletAuth()` — mock manager + mock adapter, test state transitions
- `createXrplSignatureVerifier()` — mock ripple-keypairs, verify-xrpl-signature, and xrpl decode; test verify pass/fail for both `signature` and `signedTx`
- `createXrplSignatureVerifier()` — test không dùng `RegularKey` làm public key
- Signing compatibility — test thực tế từng wallet có `signMessage` và ghi rõ hash/publicKey behavior vào `docs/adapters/signing-compat.md`

Test runner: Node test runner (tương tự `tests/core.test.ts` hiện tại)

---

## 14. Deliverables

| File | Người làm |
|---|---|
| `packages/auth/src/types.ts` | Coder |
| `packages/auth/src/message.ts` | Coder |
| `packages/auth/src/nonce.ts` | Coder |
| `packages/auth/src/auth.ts` | Coder |
| `packages/auth/src/verifiers/xrpl.ts` | Coder |
| `packages/auth/src/index.ts` | Coder |
| `packages/auth/package.json` | Coder |
| `tests/auth.test.ts` | Coder |
| Kiểm tra signing hash với GemWallet + Crossmark thực tế | Coder (cần test với wallet thật) |
| `docs/adapters/signing-compat.md` | Coder ghi kết quả test thật từng adapter |
| `website/docs/auth/introduction.md` | Chú viết sau khi coder xong |

---

## 15. Implementation Plan For Reviewer Sign-Off

This plan implements `@xrpl-wallet-kit/auth` in low-risk phases. It must not change wallet modal UI, modal sizing, account panel sizing, or adapter runtime behavior unless a test proves the auth contract requires a field adjustment.

### Phase 1 — Package Scaffold

Create `packages/auth`:

- `package.json`
- `tsconfig.json`
- `src/index.ts`
- `src/types.ts`
- `src/auth.ts`
- `src/message.ts`
- `src/nonce.ts`
- `src/verifiers/index.ts`
- `src/verifiers/xrpl.ts`

Exports:

- `"."` must be client-safe.
- `"./verifiers"` is server-side verifier entry.

Dependency rule:

- `@xrpl-wallet-kit/core` is a normal dependency.
- `ripple-keypairs`, `verify-xrpl-signature`, and `xrpl` are optional peer dependencies plus dev dependencies.
- Do not import verifier code or server-only dependencies from `src/index.ts`.

Monorepo wiring (MANDATORY — xem 0.5.E):

```ts
// root tsconfig.json — thêm vào mảng "references":
{ "path": "./packages/auth" }
```

`packages/client` KHÔNG được thêm `auth` vào dependencies — auth là opt-in riêng.

Verification:

```bash
npm run typecheck
```

### Phase 2 — Core Auth Types

Implement `types.ts`:

- `WalletAuthAdapter`
- `WalletAuthMessageParams`
- `WalletAuthVerifyParams`
- `WalletAuthState`
- `WalletAuthStatus`
- `WalletAuthOptions`
- `WalletAuth`
- `SignatureVerifier`

`WalletAuthVerifyParams` must use the standardized sign result shape:

```ts
interface WalletAuthVerifyParams {
  message: string;
  signatureKind: SignatureKind;
  proof: string;
  signature?: string;
  txBlob?: string;
  address: string;
  publicKey?: string;
}
```

Verification:

```bash
npm run typecheck
```

### Phase 3 — Message And Nonce Utilities

Implement:

- `formatAuthMessage()`
- `parseAuthMessage()`
- `validateAuthMessage()`
- `generateNonce()`

Rules:

- Message format must stay chain-generic. Do not mention XRPL, XRP, Ethereum, or any chain name in the default message text.
- Nonce must use secure crypto APIs. Do not use `Math.random()`.
- Nonce should be generated and stored by the dApp server. `generateNonce()` is a helper for server-side handlers.

Tests:

- `formatAuthMessage()` output with required and optional fields.
- `parseAuthMessage()` round-trip.
- `validateAuthMessage()` for wrong domain, expired message, old issuedAt, and replayed nonce.
- `generateNonce()` uniqueness and minimum entropy/length checks.

### Phase 4 — WalletAuth Controller

Implement `createWalletAuth(manager, adapter, options)`.

Flow:

1. Require active wallet session.
2. Require active adapter capability `signMessage`.
3. Prevent concurrent sign-in.
4. Get nonce from `adapter.getNonce()`.
5. Resolve `domain`, `uri`, `issuedAt`, `expirationTime`, `chainId`, and `statement`.
6. Create message with `adapter.createMessage()`.
7. **Call `manager.signMessage({ message })`** — KHÔNG dùng `manager.authenticate()`. Xem 0.5.A để biết lý do.
   - Auth package không branch theo wallet id. Wallet-specific behavior thuộc adapters và `manager.signMessage()`.
8. Validate proof shape:
   - `proof` is required for every successful sign result.
   - `signatureKind === "signature"` uses `signature ?? proof`.
   - `signatureKind === "signedTx"` uses `txBlob ?? proof`.
9. Call `adapter.verify()` with the full proof object.
10. Set authenticated state only after server verify succeeds.

State/listener requirements:

- `on("change")`
- `off("change")`
- `destroy()`
- `signOut()` must reset state in `finally`, even if adapter sign-out fails.
- If the wallet session disappears during sign-in, fail clearly and do not authenticate.

Tests:

- Initial unauthenticated state.
- Successful sign-in state transition.
- Error state transition.
- Verify receives `signatureKind`, `proof`, `signature`, `txBlob`, `address`, `message`, and `publicKey`.
- Missing wallet session throws.
- Unsupported `signMessage` throws.
- Concurrent sign-in is rejected.
- `destroy()` removes listeners.

### Phase 5 — XRPL Server Verifier

Implement `createXrplSignatureVerifier()` in `src/verifiers/xrpl.ts`.

For `signatureKind === "signedTx"`:

1. Require `proof`; set `signedBlob = txBlob ?? proof`.
2. Call `verify-xrpl-signature.verifySignature(signedBlob)`.
3. Reject if `signatureValid` is false.
4. Reject if `signedBy !== address`.
5. Decode with `xrpl.decode(signedBlob)`.
6. Reject if `tx.Account !== address`.
7. Extract first `Memo.MemoData`, decode hex as UTF-8.
8. Reject if decoded memo text does not equal the original auth message.
9. Return true.

For `signatureKind === "signature"`:

1. Require `proof`; set `compactSignature = signature ?? proof`.
2. Resolve signing `publicKey`:
   - Prefer provided `publicKey`.
   - Optional fallback: `account_info.account_data.PublicKey`.
   - Never use `RegularKey` as a public key.
3. Compute `messageHex` with `options.hashMessage(message)` or default UTF-8 hex.
4. Verify with `ripple-keypairs.verify(messageHex, compactSignature, publicKey)`.
5. Verify `ripple-keypairs.deriveAddress(publicKey) === address`.
6. Return true only when both checks pass.

Tests:

- Mock `verify-xrpl-signature`.
- Mock `xrpl.decode`.
- Mock `ripple-keypairs`.
- `signedTx` success/failure.
- `signedTx` rejects wrong signer.
- `signedTx` rejects memo mismatch.
- `signature` success/failure.
- `signature` rejects derived address mismatch.
- Ledger fallback does not use `RegularKey`.
- Missing optional peer produces a clear error message.

### Phase 6 — Public Exports And Docs

Client-safe `src/index.ts` exports:

- `createWalletAuth`
- `formatAuthMessage`
- `parseAuthMessage`
- `validateAuthMessage`
- `generateNonce`
- public types only

Server-only `src/verifiers/index.ts` exports:

- `createXrplSignatureVerifier`
- verifier-related types if needed

Docs/examples:

- Basic dApp usage.
- Next.js API route nonce/verify example.
- Difference between `signature` and `signedTx`.
- Optional peer dependency note.
- Signing compatibility caveat for real wallets.

Verification:

```bash
npm run typecheck
npm test
```

### Phase 7 — Browser Safety And Integration

Verify the auth package does not pull server verifier dependencies into browser bundles.

Run:

```bash
npm run build:browser
node --check packages/browser/dist/xrpl-wallet-kit.iife.min.js
```

Expected:

- Browser bundle builds.
- Client entry does not import `ripple-keypairs`, `verify-xrpl-signature`, or `xrpl`.
- Known Rollup PURE warning from dependency is non-fatal if still present.

### Final Verification

Before declaring implementation complete:

```bash
npm run typecheck
npm test
npm run build:browser
node --check packages/browser/dist/xrpl-wallet-kit.iife.min.js
```

### Guardrails

- Do not change modal UI, modal size, account panel frame, QR panel frame, or toast UI during auth implementation.
- Do not import server-only verifier dependencies from the client-safe auth entry.
- Do not hardcode XRPL/XRP/Ethereum names in generic auth types, controller, or default message formatter.
- `verify-xrpl-signature` is only for `signatureKind === "signedTx"`.
- `ripple-keypairs` is only for `signatureKind === "signature"`.
- `publicKey` availability must still be tested with real GemWallet, Crossmark, DropFi, Otsu, and WalletConnect direct `xrpl_signMessage`.
- If compact-signature wallets do not return a public key and ledger fallback cannot resolve one, verifier should fail clearly instead of guessing.
- Nonce validation and invalidation are server responsibilities; client must not self-validate nonce as proof of auth.

---

*Document version: 1.0 — 2026-06-03*
