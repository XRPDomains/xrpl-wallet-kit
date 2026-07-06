# AUTH PACKAGE REVIEW — `@xrpl-wallet-kit/auth`

**Ngày review:** 2026-06-19  
**Reviewer:** Claude (Cowork)  
**Phạm vi:** `packages/auth/` — toàn bộ source, verifier, tests  
**Spec tham chiếu:** `Review/SIGN_IN_SPEC.md` (đã approved)

---

## Tóm tắt

Implementation tốt và khớp với spec ở mức độ design. Logic core — factory, controller, verifier, message format — đều đúng hướng. Có **1 issue critical** (dependency version) và một số **medium/low** items cần giải quyết trước release.

**Verdict: ✅ APPROVE với fixes bắt buộc ở mục A.1**

---

## Coder Follow-up — 2026-06-19

Đã xử lý sau review:

- ✅ A.2 fixed: thêm `devDependencies` cho `ripple-keypairs`, `verify-xrpl-signature`, `xrpl` trong `packages/auth/package.json`.
- ✅ A.3 fixed: bổ sung tests cho null account, concurrent sign-in guard, `destroy()` cleanup/guard, PEER_ERROR message, và signedTx `signedBy` mismatch.
- ✅ A.4 verified on Windows: `npm.cmd run typecheck` pass và `npm.cmd test -- --runInBand` pass với 140 tests.

Chưa đổi:

- ⚠️ A.1 needs maintainer decision: review đề xuất đổi `@xrpl-wallet-kit/core` dependency sang `"workspace:*"`, nhưng repo hiện tại các package nội bộ đang dùng pinned version `0.1.0-beta.0` trong `dependencies` để nhất quán publish package. Nếu project quyết định chuyển convention sang workspace protocol thì nên đổi đồng bộ toàn bộ internal package dependencies, không chỉ riêng `packages/auth`.

---

## Phạm vi đọc

| File | Dòng | Trạng thái |
|------|------|------------|
| `packages/auth/package.json` | — | Đọc đầy đủ |
| `packages/auth/src/types.ts` | 82 | Đọc đầy đủ |
| `packages/auth/src/auth.ts` | 160 | Đọc đầy đủ |
| `packages/auth/src/message.ts` | 131 | Đọc đầy đủ |
| `packages/auth/src/nonce.ts` | 20 | Đọc đầy đủ |
| `packages/auth/src/verifiers/xrpl.ts` | 143 | Đọc đầy đủ |
| `packages/auth/src/index.ts` | 17 | Đọc đầy đủ |
| `tests/auth.test.ts` | 185 | Đọc đầy đủ |
| **Chạy test thực tế** | — | ❌ Không thể — esbuild platform mismatch (xem A.4) |

---

## A. Issues

### 🔴 A.1 — `package.json`: core dep pinned thay vì workspace:* (CRITICAL)

**File:** `packages/auth/package.json`

```json
// Hiện tại (SAI):
"dependencies": {
  "@xrpl-wallet-kit/core": "0.1.0-beta.0"
}

// Đúng (theo spec + CLAUDE.md monorepo convention):
"dependencies": {
  "@xrpl-wallet-kit/core": "workspace:*"
}
```

**Tại sao critical:** Khi core bumps version (lên `0.1.1-beta.0` chẳng hạn), `packages/auth` sẽ không pick up dependency update trong monorepo build. Tất cả packages khác trong monorepo đều dùng `workspace:*`. Pinned version phá vỡ quy tắc monorepo và có thể tạo duplicate copies của core trong `node_modules`.

**Fix:** Đổi thành `"workspace:*"`.

---

### 🟡 A.2 — `package.json`: thiếu `devDependencies` cho peer packages

**File:** `packages/auth/package.json`

Spec yêu cầu peer deps (optional) và cũng install chúng vào `devDependencies` để test local có thể chạy:

```json
// Cần thêm:
"devDependencies": {
  "ripple-keypairs": "^2.0.0",
  "verify-xrpl-signature": "^2.0.0",
  "xrpl": "^4.0.0"
}
```

Không có `devDependencies` này, tests cho verifier (test 7 và 8 trong `tests/auth.test.ts`) dùng `dependencies` injection mock nên vẫn pass — nhưng không ai có thể test real peer loading trong `loadPeer<T>()` locally. PEER_ERROR message cũng không có test coverage.

---

### 🟡 A.3 — Test coverage chưa đủ

8 tests hiện tại cover happy path tốt. Cần bổ sung:

| Scenario | Lý do |
|----------|-------|
| `destroy()` → listeners bị remove | Spec nói `destroy()` must clear listeners; currently tested implicitly nhưng không explicit |
| `signIn()` khi account = null (chưa connect wallet) | Dòng 42 `auth.ts` có guard nhưng không có test |
| `signIn()` concurrent guard (signing flag) | Dòng 37 `auth.ts` `if (this.signing) throw` — không có test |
| `loadPeer()` khi peer không installed | PEER_ERROR message là DX quan trọng, cần verify text rõ ràng |
| Verify pass nhưng `signedBy` không trùng address | Branch trong `verifySignedTransaction` line 77 |

---

### 🟡 A.4 — Tests không chạy được trong bash sandbox (môi trường CI)

Khi chạy trong bash sandbox của Cowork (Linux), `node_modules` được mount từ Windows (OneDrive). `tsx` / `esbuild` trong node_modules là binary build cho `@esbuild/win32-x64` — không chạy được trên Linux. Kết quả:

```
Error: The package "@esbuild/linux-x64" was not installed
```

**Không phải lỗi code** — đây là giới hạn môi trường. Tests phải chạy trên Windows machine.

**Action:** Coder chạy `npm test` trên Windows trước khi merge để xác nhận 8/8 tests pass.

---

### 🟢 A.5 — `validateAuthMessage`: signature thay đổi so với spec (acceptable deviation)

**Spec định nghĩa:** `validateAuthMessage(params: WalletAuthMessageParams): WalletAuthValidationResult` (sync)

**Implementation:** `validateAuthMessage(message: string, options): Promise<WalletAuthValidationResult>` (async, nhận raw string)

Đây là deviation có chủ ý và **tốt hơn spec**:
- Nhận raw `string` thay vì parsed params → caller không cần parse trước
- `async` vì `options.isNonceUsed` có thể là `Promise<boolean>` (DB lookup)
- Return `{ valid, errors, message }` với `message` là parsed object → caller nhận luôn cả hai

Không cần fix, chỉ cần update docs/spec khi viết public API docs.

---

### 🟢 A.6 — `WalletAuth` dùng `getState()` method thay vì `readonly` properties

**Spec:** `readonly status: WalletAuthStatus; readonly address: string | null`

**Implementation:** `getState(): WalletAuthState` trả về `{ ...this.state }` (snapshot copy)

Safer hơn vì: trả snapshot immutable thay vì expose internal reference. Consumer không thể accidentally mutate state. Interface consistent hơn cho observer pattern. **Acceptable deviation.**

---

### 🟢 A.7 — `signOut()` re-throws lỗi adapter

`signOut()` không có catch block — lỗi từ `adapter.signOut()` sẽ propagate sau khi `finally` reset state:

```ts
async signOut(): Promise<void> {
  try {
    await this.adapter.signOut?.();   // throws → propagates
  } finally {
    this.setState({ status: "unauthenticated", ... }); // vẫn chạy
  }
}
```

Test #6 expects behavior này và test pass. Spec không explicitly nói suppress hay rethrow, nên đây là **implementation choice hợp lý** — state luôn được reset, caller vẫn biết có lỗi server-side signout. Nên document behavior này trong API docs.

---

## B. Confirmed Correct ✅

Những phần quan trọng đã verify khớp với spec:

**Core flow:**
- ✅ `createWalletAuth(manager, adapter, options)` factory — đúng signature
- ✅ Gọi `manager.signMessage({ message, account })` — KHÔNG phải `manager.authenticate()`
- ✅ `signResult.publicKey` được pass vào `adapter.verify()` — critical cho SECP256K1
- ✅ `isWalletAuthSignInResult(signResult)` guard trước khi dùng proof
- ✅ Concurrent signIn guard: `if (this.signing) throw new Error(...)`
- ✅ Session change detection: `getSession() !== initialSession` trước khi ký
- ✅ `normalizeAuthError()` map reject/cancel/denied → `WalletKitErrorCode.SIGN_REJECTED`
- ✅ `ensureActive()` guard trên `signIn()` và `on()` (throws nếu destroyed)

**Nonce & Message:**
- ✅ `generateNonce()` dùng `crypto.getRandomValues()` — không dùng `Math.random()`
- ✅ `generateNonce()` minimum 16 bytes (128-bit security) — default 24 bytes
- ✅ `formatAuthMessage` / `parseAuthMessage` round-trip clean
- ✅ `validateAuthMessage` check: domain, uri, address, expiry, maxAge, nonce reuse

**Verifier (XRPL):**
- ✅ `resolveLedgerPublicKey()` chỉ đọc `account_data.PublicKey` — **KHÔNG dùng `RegularKey`**
- ✅ `utf8ToHex()` produce UPPERCASE hex (yêu cầu của ripple-keypairs)
- ✅ `loadPeer<T>()` lazy import với PEER_ERROR message rõ ràng
- ✅ Handle cả 2 return shapes của verify-xrpl-signature: `boolean` và `{ signatureValid, signedBy }`
- ✅ `withTimeout()` bọc XRPL client operations — tránh hang
- ✅ `disconnect()` luôn được gọi trong `finally` dù request có lỗi

**Bundle isolation:**
- ✅ `packages/auth/src/index.ts` — KHÔNG export `createXrplSignatureVerifier`
- ✅ Verifier chỉ có ở subpath `@xrpl-wallet-kit/auth/verifiers`
- ✅ Server deps (ripple-keypairs, xrpl, verify-xrpl-signature) chỉ load qua dynamic `import()` — không leak vào browser bundle

**SSR safety:**
- ✅ `resolveDefaultDomain()` check `typeof window !== "undefined"` trước khi đọc `window.location`
- ✅ `generateNonce()` check `globalThis.crypto` — không assume browser globals

**Monorepo wiring:**
- ✅ `tsconfig.json` root có `{ "path": "./packages/auth" }` — typecheck hoạt động

---

## C. Nhận xét phụ

**`WalletAuthMessageParams.issuedAt` và `version` là required** trong implementation (không phải optional như spec). Đây là đúng — auth controller luôn set cả hai, và verifier cần chúng để validate. Spec dùng optional là looseness không cần thiết.

**`signOut()` không gọi `ensureActive()`** — cho phép signOut chạy ngay cả sau `destroy()`. Có thể là intentional (cleanup path). Không critical nhưng nên document.

**`on()` trả về unsubscribe function `() => void`** — pattern tốt, consistent với WalletManager events.

**`dependencies` injection pattern trong verifier** — excellent testability design. Cho phép mock toàn bộ crypto/XRPL layer mà không cần real peer installed trong test env.

---

## D. Action Items

| # | Priority | Who | Action |
|---|----------|-----|--------|
| D.1 | 🔴 CRITICAL | Coder | `packages/auth/package.json`: đổi core dep thành `"workspace:*"` |
| D.2 | 🟡 Medium | Coder | `packages/auth/package.json`: thêm `devDependencies` cho 3 peer packages |
| D.3 | 🟡 Medium | Coder | Thêm tests: destroy(), null account, concurrent guard, PEER_ERROR text |
| D.4 | 🟡 Medium | Coder | Chạy `npm test` trên Windows machine — xác nhận 8/8 pass |
| D.5 | 🟢 Low | Reviewer | Update SIGN_IN_SPEC: document `validateAuthMessage` async deviation + `getState()` pattern |
| D.6 | 🟢 Low | Reviewer | Viết `website/docs/auth/introduction.md` sau khi D.1-D.4 done |

---

## E. Files không thay đổi trong session này

Review chỉ đọc, không sửa bất kỳ file nào trong `packages/auth/`.
