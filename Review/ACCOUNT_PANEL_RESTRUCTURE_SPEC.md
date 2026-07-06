# Thiết Kế Lại Account Panel: Tối Giản, Chuyên Nghiệp & Không Thanh Cuộn
*Bản đặc tả kỹ thuật sửa đổi layout để loại bỏ AI Slop (Scrollbar lồng nhau, giao diện phân mảnh)*

Tài liệu này cung cấp thiết kế cấu trúc mới (Restructured Layout) cho **Account Panel** của thư viện **XRPL Wallet Kit**, đáp ứng mong muốn tối ưu hóa không gian, đưa các chức năng chính lên trên và giải quyết triệt để lỗi thẩm mỹ từ thanh cuộn.

---

## 1. Sơ Đồ So Sánh Layout (Before vs. After)

### ❌ Layout Hiện Tại (Trực quan cồng kềnh, phân mảnh)
```text
+---------------------------------------+
|                Header                 |
+---------------------------------------+
|               [Avatar]                |
|             Domain Name               |
|          [ 0x1234...abcd ] (QR Button)|
|             [ 12.34 XRP ]             |
|                                       |
|  +---------------------------------+  |
|  | Cảnh báo / Warning kích hoạt   |  |
|  +---------------------------------+  |
|                                       |
|  +---------------------------------+  |
|  | LỊCH SỬ GIAO DỊCH               |  |
|  | - Row 1                         |  |
|  | - Row 2  [Thanh cuộn dọc nội bộ]|  |
|  +---------------------------------+  |
|                                       |
|  +---------------------------------+  |
|  | [Copy]  [Explorer]  [Disconnect]|  |
|  +---------------------------------+  |
+---------------------------------------+
```

###  Layout Mới Đề Xuất (Tối giản, chuyên nghiệp, không cuộn)
```text
+---------------------------------------+
|                Header                 |
+---------------------------------------+
|               [Avatar]                |
|             Domain Name               |
|    [ 0x1234...abcd | 12.34 XRP ] [QR] |  <-- Gom cụm Địa chỉ, Số dư và nút QR
|                                       |
|  +---------------------------------+  |
|  | Cảnh báo / Warning (nếu có)     |  |
|  +---------------------------------+  |
|                                       |
|  +---------------------------------+  |
|  | GIAO DỊCH GẦN ĐÂY         Xem cả|  |  <-- Click "Xem cả" hoặc tiêu đề sẽ mở
|  | - Giao dịch 1                   |  |      màn hình phụ Lịch sử (max 10 tx)
|  | - Giao dịch 2                   |  |
|  | - Giao dịch 3 (Tối đa 3 tx)     |  |  <-- Khóa cứng tối đa 3 dòng, không cuộn
|  +---------------------------------+  |
|                                       |
|  +---------------------------------+  |
|  | [Copy]  [Explorer]  [Disconnect]|  |  <-- Giữ nguyên ở đáy để đồng bộ UX
|  +---------------------------------+  |
+---------------------------------------+
```

---

## 2. Hướng Giải Quyết Chi Tiết & Tương Tác UX

### 📍 Bước 1: Ghép Số dư bên cạnh Địa chỉ Ví (Unified Address & Balance Pill) và Xử lý ẩn Domain Name trống
*   **Giải pháp:** Thay thế hai dòng hiển thị riêng biệt bằng một dòng duy nhất dạng "Pill" (Viên thuốc) gộp chung địa chỉ ví và số dư.
*   **Cấu trúc HTML đề xuất:**
    ```html
    <div class="xwk-account-meta-pill">
      <span class="xwk-pill-address">r3km...38v2</span>
      <span class="xwk-pill-divider">|</span>
      <span class="xwk-pill-balance">12.34 XRP</span>
      <button class="xwk-address-qr-trigger" type="button">...</button>
    </div>
    ```
*   **Đồng bộ Logic Phân giải Web3 Name (XRP Domain):**
    *   **Trường hợp 1 (Có Web3 Name):** Hiển thị Web3 Name (ví dụ: `alice.xrp`) trong phần tử `.xwk-account-name`. Ngay phía dưới hiển thị Unified Pill chứa địa chỉ rút gọn và số dư.
    *   **Trường hợp 2 (Không có Web3 Name / Tên miền trống):**
        *   **Ẩn hoàn toàn** phần tử `.xwk-account-name` khỏi DOM (không render thẻ rỗng hoặc thiết lập `display: none`).
        *   **Hiệu quả:** Loại bỏ hoàn toàn khoảng trắng dư thừa (gap/margin) ở vị trí tên miền. Giao diện sẽ hiển thị trực tiếp Unified Pill ngay dưới Avatar.
        *   **Tránh trùng lặp:** Địa chỉ ví chỉ hiển thị duy nhất 1 lần trong Unified Pill, không bị hiển thị lặp lại ở phần tiêu đề tên miền.
*   **Hiệu quả:** Tiết kiệm ~50px chiều cao modal, gom các thông tin trạng thái tĩnh vào một nhóm trực quan và tối ưu khoảng trống.


### 📍 Bước 2: Giữ nguyên vị trí Nút Hành Động ở dưới cùng (UX Consistency)
*   **Giải pháp:** Để đảm bảo tính thống nhất trong thói quen sử dụng của người dùng (đồng cách hiểu với người dùng), cụm nút hành động `.xwk-account-panel-actions` (Sao chép địa chỉ, Xem Explorer, Ngắt kết nối) vẫn được giữ lại ở đáy của modal, bên dưới danh sách xem trước giao dịch.
*   **Hiệu quả:** Người dùng dễ dàng định vị nút "Disconnect" ở vị trí quen thuộc mà không cần làm quen với sơ đồ nút mới.

### 📍 Bước 3: Giới hạn 3 Giao dịch mặc định và bổ sung View phụ (Sub-view) chi tiết
Để loại bỏ hoàn toàn thanh cuộn khó chịu ở màn hình chính nhưng vẫn đáp ứng nhu cầu xem nhiều lịch sử của người dùng:
1.  **Màn hình chính (Main View):**
    *   Giới hạn thuộc tính hiển thị tối đa `maxVisibleTransactions: 3`.
    *   Ẩn hoàn toàn thanh cuộn của `.xwk-tx-list` bằng CSS.
    *   Tiêu đề Lịch sử giao dịch sẽ hiển thị nút bấm `Xem tất cả ➜` (hoặc `See All ➜`).
2.  **Màn hình phụ Lịch sử (History Sub-view):**
    *   Khi người dùng click vào `Xem tất cả` hoặc Header của lịch sử giao dịch, giao diện Account Panel sẽ chuyển trạng thái view sang `"history"`.
    *   Khi ở view `"history"`, giao diện modal sẽ chuyển sang hiển thị danh sách **10 giao dịch gần nhất** trên một màn hình rộng rãi, không bị chen chúc bởi Avatar hay các nút hành động ở đáy.
    *   Phần Header modal sẽ xuất hiện nút **Back** (`data-xwk-account-back`) để người dùng dễ dàng quay về màn hình thông tin chính.


---

## 3. Bản vẽ CSS tham khảo cho Coder

Coder cần áp dụng các tinh chỉnh CSS sau để layout mới hoạt động ổn định và đẹp mắt:

```css
/* 1. Gộp Address & Balance Pill */
.xwk-account-meta-pill {
  align-items: center;
  background: var(--xwk-surface);
  border: 1px solid var(--xwk-border);
  border-radius: 12px;
  color: var(--xwk-muted);
  display: inline-flex;
  font-size: 13px;
  font-weight: 560;
  gap: 8px;
  padding: 6px 6px 6px 12px;
}
.xwk-pill-divider {
  opacity: 0.3;
}
.xwk-pill-balance {
  color: var(--xwk-foreground);
}

/* 2. Sắp xếp lại Actions Button */
.xwk-account-panel-actions {
  display: grid;
  gap: 8px;
  grid-template-columns: repeat(3, 1fr); /* Chia đều 3 cột ngang gọn gàng */
  width: 100%;
}

/* 3. Khóa cứng danh sách giao dịch chính không cho xuất hiện thanh cuộn */
.xwk-tx-list {
  overflow: hidden !important; /* Triệt tiêu hoàn toàn scrollbar */
  max-height: none !important;
}

/* 4. Định dạng nút "Xem tất cả" bên phải Header giao dịch */
.xwk-tx-header-link {
  color: var(--xwk-accent);
  font-size: 11px;
  font-weight: 600;
  margin-left: auto;
  text-transform: none;
  text-decoration: none;
}
.xwk-tx-header-link:hover {
  text-decoration: underline;
}
```

---

## Coder Alignment Notes

- Do not render `.xwk-account-name` when Web3 name / XRP domain is empty. Address must appear only once inside `.xwk-account-meta-pill`.
- Keep `.xwk-account-panel-actions` as a one-column full-width stack by default. Do not switch to three columns in phase 1 because the current action labels are touch-oriented and mobile-safe.
- Main Account Panel transaction history is a compact preview: show up to 3 rows, no nested scrollbar, and no collapse gap.
- Use a secondary history sub-view for longer history. The sub-view may have one internal scroll region if content exceeds the available modal height.
- Avoid underline/shadow-heavy hover states. Use theme tokens and subtle surface hover only.
