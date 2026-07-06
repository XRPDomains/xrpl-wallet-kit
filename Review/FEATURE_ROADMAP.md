# XRPL Wallet Kit — Feature Roadmap

**Tham khảo:** RainbowKit 2.x, ConnectKit 1.9, web3-onboard (thirdweb)
**Mục tiêu:** Bổ sung các tính năng standard của EVM kits + differentiator riêng cho XRPL

---

## 🔴 P1 — Làm sớm

### 1. Sign-In with XRPL (Authentication)
RainbowKit có SIWE tích hợp sẵn — user ký message để chứng minh ownership, backend tạo session. XRPL chưa có chuẩn chung, kit này có thể set standard cho cả ecosystem.

**API đề xuất:**
```ts
const { address, message, signature } = await manager.authenticate({
  statement: "Sign in to MyApp",
  expiresIn: 3600
});
```
Kit tự tạo challenge → gọi `adapter.sign()` → trả về payload sẵn để app verify với backend. Không phụ thuộc framework.

---

### 2. Transaction Notify / Toast
web3-onboard có Notify module: pending → confirmed → failed. XRPL confirm 3-5s nhưng user vẫn cần biết kết quả ngay.

**API đề xuất:**
```ts
manager.on("tx_submitted", ({ hash }) => { ... })
manager.on("tx_confirmed", ({ hash, result }) => { ... })
manager.on("tx_failed",    ({ hash, error }) => { ... })
```
UI layer expose optional `<WalletToast />` component (hoặc plain DOM). dApp có thể tự render hoặc dùng built-in.

---

### 3. Localization (i18n)
RainbowKit ship 20+ ngôn ngữ. XRPL user base tập trung ở Nhật, Đông Nam Á, châu Âu. Hiện tại kit hardcode tiếng Anh.

**API đề xuất:**
```ts
createWalletKit({
  ui: { locale: "ja" } // built-in: en | ja | vi | zh
})
```
Tất cả user-facing string đã nằm trong `renderShell/renderConnectShell/renderQrShell` — chỉ cần extract ra `locales/en.ts`, `locales/ja.ts`, v.v.

---

## 🟡 P2 — Quan trọng, làm sau P1

### 4. Recent Transactions trong Account Panel
RainbowKit cho phép dApp đăng ký transaction history, account panel hiện pending/confirmed với link explorer.

**API đề xuất:**
```ts
manager.addTransaction({ hash: "ABC123", description: "Swap 10 XRP → USDT" })
// Account panel tự hiện, lưu localStorage, clear khi disconnect
```

---

### 5. Transaction Preview Callback
web3-onboard có pre-flight simulation. XRPL đặc biệt cần vì DEX orders, trust lines, NFT mint là transaction phức tạp user không hiểu.

**API đề xuất:**
```ts
createWalletKit({
  ui: {
    transactionPreview: async (tx) => ({
      summary: "Gửi 10 XRP đến rXXX...",
      details: [{ label: "Phí", value: "0.000012 XRP" }]
    })
  }
})
```
Kit hiện preview card trong modal trước khi user confirm. dApp tự inject logic, kit chỉ render.

---

### 6. Modal Hooks nâng cao
Hiện tại `modal.open()` / `modal.close()` đã có. Cần bổ sung:

```ts
modal.openAccount()   // mở thẳng account panel
modal.openNetwork()   // mở network switcher (tương lai)
modal.isOpen()        // reactive state
modal.on("open", cb)
modal.on("close", cb)
```

---

## 🟢 P3 — XRPL-specific, không có trên EVM kits

### 7. Account Activation Guard trong Connect Flow
Hiện tại `activationStatus: "unfunded"` chỉ hiện ở account panel. Nên bổ sung: khi connect xong mà account unfunded, modal hiện cảnh báo với số XRP cần nạp + QR receive address ngay trong flow — không để user tự tìm hiểu.

### 8. Trust Line Awareness
Khi dApp gọi sign transaction mà token chưa có trust line → kit detect và hiện hướng dẫn thay vì silent error: *"Bạn cần thiết lập Trust Line cho USDT trước khi giao dịch."*

### 9. Multi-Network Display (chuẩn bị cho XRPL EVM Sidechain)
XRPL EVM Sidechain dự kiến live Q3 2025. Nên chuẩn bị network indicator rõ hơn: XRPL Mainnet vs XRPL EVM vs Testnet — không chỉ badge text mà có màu/icon riêng để tránh nhầm lẫn.

---

## Tóm tắt ưu tiên

| # | Tính năng | Effort | Impact |
|---|-----------|--------|--------|
| 1 | Sign-In with XRPL | M | 🔴 Standard bắt buộc cho dApp production |
| 2 | Transaction Notify | S | 🔴 UX gap rõ nhất hiện tại |
| 3 | Localization | S-M | 🔴 XRPL user base đa quốc gia |
| 4 | Recent Transactions | S | 🟡 Copy RainbowKit pattern |
| 5 | Transaction Preview | M | 🟡 Killer feature cho DEX/DeFi |
| 6 | Modal Hooks nâng cao | S | 🟡 Cần cho custom integrations |
| 7 | Activation Guard | S | 🟢 XRPL-specific, data đã có |
| 8 | Trust Line Awareness | M | 🟢 XRPL-specific, giảm support burden |
| 9 | Multi-Network Display | S | 🟢 Chuẩn bị cho EVM Sidechain |

> Số 1 (Auth) và số 5 (Transaction Preview) là hai thứ EVM kits có nhưng XRPL ecosystem **hoàn toàn thiếu** — nếu kit này implement trước, đây sẽ là differentiator thực sự.
