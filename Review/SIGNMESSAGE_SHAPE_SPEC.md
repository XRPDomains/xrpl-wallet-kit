# SignMessageResult — Chuẩn hóa Shape trước khi làm `@xrpl-wallet-kit/auth`

**Ngày:** 2026-06-05  
**Ưu tiên:** Phải làm trước khi implement `@xrpl-wallet-kit/auth`  
**File liên quan:** `packages/core/src/types.ts`, tất cả adapter `src/index.ts`

---

## ✅ Verification — Round 1 (2026-06-06)

**Tất cả items đã được coder implement đầy đủ và chính xác.**

| Item | Trạng thái | Ghi chú |
|---|---|---|
| `SignatureKind = "signature" \| "signedTx"` export từ core | ✅ Done | `packages/core/src/types.ts` |
| `SignMessageResult.signatureKind: SignatureKind` (required) | ✅ Done | Field bắt buộc, không optional |
| `SignMessageResult.publicKey?: string` | ✅ Done | |
| `SignMessageResult.txBlob?: string` | ✅ Done | |
| GemWallet → `signatureKind: "signature"`, `publicKey` từ `request.account` | ✅ Done | |
| Crossmark → `signatureKind: "signature"`, `publicKey` từ result trước, fallback `request.account` | ✅ Done | Đúng spec — ưu tiên publicKey từ signInAndWait response |
| DropFi → `signatureKind: "signature"`, `publicKey` từ `request.account` | ✅ Done | |
| Otsu → `signatureKind: "signature"`, `publicKey` từ `request.account` | ✅ Done | |
| Xaman → `signatureKind: "signedTx"`, `signature` field đã xóa | ✅ Done | Clean — chỉ có `txBlob` |
| xrpl-snap → `signatureKind: "signedTx"` | ✅ Done | |
| WalletConnect → branch đúng: "signature" khi dùng `xrpl_signMessage`, "signedTx" khi fallback payment tx | ✅ Done | `publicKey` cũng được pick từ result khi có |
| `WALLET_ADAPTER_API_VERSION` bump → `"1.1"` | ✅ Done | Changelog ghi rõ breaking change |

### Phát hiện ngoài spec

### R2 amendment — common `proof` field

`SignMessageResult` now includes a common `proof?: string` field for app DX:

- `signatureKind === "signature"`: `proof` mirrors `signature`.
- `signatureKind === "signedTx"`: `proof` mirrors `txBlob`.
- App integrations may use `proof` as the value sent to the server, while verifiers still branch by `signatureKind`.
- Keep `signature` and `txBlob` as semantic fields for advanced integrations and backward compatibility. Do not put signed transaction blobs into `signature`.

Coder đã thêm `AuthenticateResult` vào `packages/core/src/types.ts` — type này không có trong spec, nhưng là extension hợp lý:

```ts
export interface AuthenticateResult {
  address: string;
  message: string;
  signatureKind: SignatureKind;
  signature?: string;
  txBlob?: string;
  publicKey?: string;
  issuedAt: string;
  expiresAt: string;
  statement: string;
  raw?: unknown;
}
```

**Nhận xét:** Type này overlap với `WalletAuthVerifyParams` trong SIGN_IN_SPEC. Khi implement `packages/auth`, coder nên quyết định rõ: dùng `AuthenticateResult` này hay dùng `WalletAuthVerifyParams` — không nên để cả hai tồn tại song song với shape gần giống nhau. Khả năng cao `AuthenticateResult` là draft sketch cho auth flow — review lại khi bắt đầu `packages/auth`.

---

## Vấn đề hiện tại (đã giải quyết)

`SignMessageResult` hiện có hai field tùy chọn nhưng không có discriminator:

```ts
// packages/core/src/types.ts — hiện tại
export interface SignMessageResult {
  signature?: string;   // compact raw sig HOẶC tx hex — mơ hồ!
  txBlob?: string;      // tx hex — nhưng nhiều adapter set = signature cùng giá trị!
  raw?: unknown;
}
```

**Vấn đề cốt lõi:** Auth verifier không biết phải verify theo path nào vì:

1. Xaman, xrpl-snap, WalletConnect (fallback) set cả `signature` AND `txBlob` = **cùng một hex string** của signed transaction
2. GemWallet, Crossmark, DropFi, Otsu chỉ set `signature` = **compact raw signature**
3. Không có flag nào báo đây là tx blob hay raw signature
4. Không có `publicKey` trong result — cần cho path raw signature verify

---

## Hai verification path hoàn toàn khác nhau

### Path A — `"signedTx"` (Xaman, xrpl-snap, WalletConnect-payment-fallback)

Message được nhúng vào Memo field của một SignIn/Payment transaction. Adapter trả về signed tx hex (blob).

**Verify phía server:**
```ts
// KHÔNG cần publicKey truyền từ ngoài — nó nằm trong tx blob
const tx = xrpl.decode(txBlob);
// 1. Kiểm tra Memo chứa đúng message gốc
// 2. verify-xrpl-signature.verifySignature(txBlob) xác nhận chữ ký hợp lệ
// 3. verify result.signedBy và tx.Account phải khớp với address đã đăng ký
```

### Path B — `"signature"` (GemWallet, Crossmark, DropFi, Otsu)

Wallet ký trực tiếp message (hoặc hash của nó). Adapter trả về compact signature.

**Verify phía server:**
```ts
// CẦN publicKey — không có thì không verify được
import * as keypairs from "ripple-keypairs";
const messageHash = computeMessageHash(message); // sha512half hoặc tương đương
const valid = keypairs.verify(messageHash, signature, publicKey);
// + kiểm tra keypairs.deriveAddress(publicKey) === address
```

---

## Fix cần làm

### 1. Thêm `signatureKind` vào `SignMessageResult` — `packages/core/src/types.ts`

```ts
export type SignatureKind = "signature" | "signedTx";

export interface SignMessageResult {
  /** Discriminator — REQUIRED. Nếu không có thì auth verifier phải đoán. */
  signatureKind: SignatureKind;

  /**
   * Unified proof value for app DX.
   * - signatureKind === "signature": same value as signature
   * - signatureKind === "signedTx": same value as txBlob
   */
  proof?: string;

  /** Compact raw signature (hex/base64). Có khi signatureKind === "signature". */
  signature?: string;

  /**
   * Signed transaction blob (hex). Có khi signatureKind === "signedTx".
   * Message gốc nằm trong Memo field của tx này.
   */
  txBlob?: string;

  /**
   * Public key của signing account.
   * Bắt buộc cung cấp khi signatureKind === "signature".
   * Không cần khi signatureKind === "signedTx" (pubkey embedded trong blob).
   */
  publicKey?: string;

  raw?: unknown;
}
```

> **Lưu ý `WALLET_ADAPTER_API_VERSION`:** Đây là breaking change với adapters bên ngoài — bump lên `"1.1"` và ghi changelog rõ trong `packages/core/src/adapter.ts`.
>
> **Implementation note:** built-in adapters hiện không có `this.session`. Khi cần public key, dùng `request.account?.publicKey`, public key trong response của wallet, hoặc adapter-owned cached value nếu adapter thật sự lưu được. Không thêm hardcoded `this.session` vào adapter.

---

### 2. Cập nhật từng adapter

#### GemWallet — `packages/adapters/gemwallet/src/index.ts`

```ts
// Hiện tại:
return { signature: result.result?.signedMessage, raw: result };

// Fix:
return {
  signatureKind: "signature",
  signature: result.result?.signedMessage,
  publicKey: request.account?.publicKey,  // optional; server can fallback ledger lookup
  raw: result,
};
```

#### Crossmark — `packages/adapters/crossmark/src/index.ts`

```ts
// Hiện tại:
return { signature: result.response?.data?.signature, raw: result };

// Fix:
return {
  signatureKind: "signature",
  signature: result.response?.data?.signature,
  // Crossmark trả publicKey cả trong signInAndWait result
  publicKey: result.response?.data?.publicKey ?? request.account?.publicKey,
  raw: result,
};
```

#### DropFi — `packages/adapters/dropfi/src/index.ts`

```ts
// Hiện tại:
return { signature, raw: signature };

// Fix:
return {
  signatureKind: "signature",
  signature,
  publicKey: request.account?.publicKey,
  raw: signature,
};
```

#### Otsu — `packages/adapters/otsu/src/index.ts`

```ts
// Fix (tương tự GemWallet/DropFi):
return {
  signatureKind: "signature",
  signature: result.signature,
  publicKey: request.account?.publicKey,
  raw: result,
};
```

#### Xaman — `packages/adapters/xaman/src/index.ts`

```ts
// Hiện tại:
return { signature: result.response?.hex ?? undefined, txBlob: result.response?.hex ?? undefined, raw: result };

// Fix — xóa `signature` field vì đây là tx blob, không phải compact sig:
return {
  signatureKind: "signedTx",
  txBlob: result.response?.hex ?? undefined,
  // publicKey không cần — embedded trong tx blob
  raw: result,
};
```

#### xrpl-snap — `packages/adapters/xrpl-snap/src/index.ts`

```ts
// Hiện tại:
return { signature, txBlob: signature, raw: result };

// Fix:
return {
  signatureKind: "signedTx",
  txBlob: signature,  // rename biến cho rõ hơn
  raw: result,
};
```

#### WalletConnect — `packages/adapters/walletconnect/src/index.ts`

Đây là adapter phức tạp nhất — `signatureKind` phải được set tại điểm biết rõ path nào được dùng.

```ts
async signMessage(request: SignMessageRequest) {
  // ...existing session/capability checks...

  const shouldTrySignMessage = this.sessionSupportsMethod(XRPLWalletConnectMethod.SIGN_MESSAGE);

  if (shouldTrySignMessage) {
    try {
      const result = await this.signMessageWithWalletConnectMethod(network, request);
      const sig = pickPath(result, ["signature", "signedMessage"]);
      // xrpl_signMessage returns compact signature
      return {
        signatureKind: "signature",
        signature: typeof sig === "string" ? sig : undefined,
        publicKey: this.session?.namespaces?.xrpl?.accounts?.[0]
          ? undefined  // WC sessions often don't expose pubkey — cần test thực tế
          : undefined,
        raw: result,
      };
    } catch (error) {
      if (!this.isInvalidWalletConnectMethodError(error)) throw error;
      // fallthrough to payment tx path below
    }
  }

  // Fallback: signed Payment transaction
  const result = await this.signMessageWithPaymentTransaction(network, request);
  const blob = pickPath(result, ["tx_blob", "txBlob", "result.tx_blob"]);
  return {
    signatureKind: "signedTx",
    txBlob: typeof blob === "string" ? blob : undefined,
    raw: result,
  };
}
```

> **WalletConnect publicKey note:** WalletConnect protocol không expose signing publicKey qua session data. Nếu wallet hỗ trợ `xrpl_signMessage` và trả về compact sig, cần test xem có trả về `publicKey` trong response không. Nếu không có, auth verifier phải dùng ledger lookup (`account_info` → `account_data.PublicKey`) — xem SIGN_IN_SPEC.md section về fallback.

---

### 3. Runtime normalize/warn trong `WalletManager.signMessage()` — `packages/core/src/manager.ts`

`validateWalletAdapter()` chỉ kiểm tra shape tĩnh của adapter, không gọi async `signMessage()`. Vì vậy warn thiếu `signatureKind` nên đặt trong `WalletManager.signMessage()` sau khi nhận kết quả:

```ts
if (result && typeof result === "object" && !("signatureKind" in result)) {
  logger.warn(
    `[xwk] Adapter "${adapter.metadata.id}" returned SignMessageResult without signatureKind. ` +
    `Auth verifier will not work correctly. Please update the adapter.`
  );
  // Optional beta compatibility:
  // infer "signedTx" when txBlob exists, otherwise "signature".
}
```

---

## Tác động đến `@xrpl-wallet-kit/auth`

Sau khi chuẩn hóa xong, `createXrplSignatureVerifier()` có thể branch rõ ràng:

```ts
export function createXrplSignatureVerifier(): SignatureVerifier {
  return async (params: WalletAuthVerifyParams): Promise<boolean> => {
    const { message, signatureKind, signature, txBlob, publicKey, address } = params;

    if (signatureKind === "signedTx") {
      // Path A: verify tx blob
      if (!txBlob) throw new Error("txBlob required for signedTx verification");
      return verifySignedTx({ txBlob, message, address });

    } else {
      // Path B: verify compact signature
      if (!signature) throw new Error("signature required for compact signature verification");
      const resolvedPubKey = publicKey ?? (await fetchPublicKeyFromLedger(address));
      if (!resolvedPubKey) throw new Error(`Cannot resolve publicKey for ${address}`);
      return verifyRawSignature({ message, signature, publicKey: resolvedPubKey, address });
    }
  };
}
```

`WalletAuthVerifyParams` cần update để include `signatureKind`:

```ts
// packages/auth/src/types.ts
export interface WalletAuthVerifyParams {
  message: string;
  proof: string;        // unified proof value: signature or txBlob based on signatureKind
  signature?: string;    // cho signatureKind === "signature"
  txBlob?: string;       // cho signatureKind === "signedTx"
  signatureKind: SignatureKind;  // import từ @xrpl-wallet-kit/core
  address: string;
  publicKey?: string;
}
```

---

## Thứ tự implement

```
1. packages/core/src/types.ts       — thêm SignatureKind + update SignMessageResult
2. packages/core/src/adapter.ts     — bump WALLET_ADAPTER_API_VERSION → "1.1", thêm runtime warn
3. packages/adapters/gemwallet/     — set signatureKind: "signature" + publicKey from session
4. packages/adapters/crossmark/     — set signatureKind: "signature" + publicKey from result/session
5. packages/adapters/dropfi/        — set signatureKind: "signature" + publicKey from session
6. packages/adapters/otsu/          — set signatureKind: "signature" + publicKey from session
7. packages/adapters/xaman/         — set signatureKind: "signedTx", xóa signature field
8. packages/adapters/xrpl-snap/     — set signatureKind: "signedTx", xóa signature field
9. packages/adapters/walletconnect/ — branch theo path, set signatureKind đúng chỗ
10. npm run typecheck && npm test    — verify không có regression
11. packages/auth/                  — bắt đầu implement sau khi step 1-10 xanh hết
```

---

## Checklist test sau khi fix

- [ ] `npm run typecheck` — pass
- [ ] `npm test` — pass  
- [ ] GemWallet `signMessage` → `signatureKind === "signature"` && `publicKey` có giá trị
- [ ] Crossmark `signMessage` → `signatureKind === "signature"` && `publicKey` có giá trị
- [ ] Xaman `signMessage` → `signatureKind === "signedTx"` && `txBlob` có giá trị, `signature` undefined
- [ ] xrpl-snap `signMessage` → `signatureKind === "signedTx"` && `txBlob` có giá trị
- [ ] WalletConnect (qua wallet hỗ trợ signMessage) → `signatureKind === "signature"`
- [ ] WalletConnect (fallback payment tx) → `signatureKind === "signedTx"`
- [ ] Runtime warn xuất hiện trong console nếu adapter cũ không set `signatureKind`

---

*Ref: Review/SIGN_IN_SPEC.md — WalletAuthVerifyParams, createXrplSignatureVerifier()*  
*Generated: 2026-06-05*
