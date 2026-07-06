# Checklist Nâng Cấp Giao Diện Chuyên Nghiệp (Premium UI/UX Checklist)
*Lấy cảm hứng từ Reown AppKit (demo.reown.com) và ConnectKit (family.co/connectkit)*

Tài liệu này đề xuất lộ trình và danh sách công việc (Checklist) chi tiết dành cho lập trình viên để chuyển đổi giao diện **XRPL Wallet Kit** từ mức "cơ bản" lên mức "chuyên nghiệp, mượt mà và hiện đại" đạt tiêu chuẩn của các thư viện kết nối Web3 hàng đầu hiện nay.

---

## 1. Hiệu Ứng Chuyển Động Vi Mô & Co Giãn Đàn Hồi (Micro-interactions & Spring Physics)

Các thư viện Web3 hiện đại tạo cảm giác "clicky" và có độ nảy bằng cách sử dụng hiệu ứng tỉ lệ (scale) kết hợp với các đường cong chuyển động tự nhiên (Cubic Bezier / Spring).

- [ ] **Hiệu ứng Nhấn Nút Đàn Hồi (Tactile Click Feedback):**
  * *Ý tưởng:* Khi di chuột qua ví hoặc nút bấm, kích thước tăng nhẹ. Khi nhấn chuột xuống (active), kích thước co lại tạo cảm giác đàn hồi vật lý.
  * *Giải pháp:* Loại bỏ cấu hình `transform: none` thô cứng trên các lớp `:hover` và `:active`. Thay thế bằng CSS transition:
    ```css
    .xwk-wallet, .xwk-account-button, .xwk-account-panel-actions button, .xwk-close, .xwk-back {
      transition: transform 0.12s cubic-bezier(0.34, 1.56, 0.64, 1), background-color 0.16s ease;
    }
    .xwk-wallet:hover, .xwk-account-button:hover {
      transform: scale(1.02);
    }
    .xwk-wallet:active, .xwk-account-button:active {
      transform: scale(0.98);
    }
    ```
- [ ] **Hiệu Ứng Trượt Mượt Mà Khi Đổi View (Slide-in View Transitions):**
  * *Ý tưởng:* Khi chuyển đổi giữa các màn hình (ví dụ: từ Danh sách ví sang màn hình quét QR hoặc Đang kết nối), thay vì thay đổi tức thì gây giật mắt, hãy bọc mã HTML của view trong các container trượt.
  * *Giải pháp:* Áp dụng hiệu ứng slide và fade phối hợp:
    ```css
    @keyframes xwk-view-slide-in {
      from {
        opacity: 0;
        transform: translateX(12px);
      }
      to {
        opacity: 1;
        transform: translateX(0);
      }
    }
    ```

---

## 2. Giao Diện Co Giãn Động Theo Chiều Cao (Dynamic Height Morphing)

Một trong những đặc trưng lớn nhất của AppKit và ConnectKit là khả năng thay đổi chiều cao của modal một cách êm ái khi đổi màn hình (morphing).

- [ ] **CSS Height Morphing:**
  * *Hiện trạng:* Chiều cao modal bị thay đổi giật cục ngay khi render lại nội dung HTML mới có kích thước khác.
  * *Giải pháp:* 
    1. Cấu hình transition chiều cao trên thẻ `.xwk-modal`: `transition: height 0.22s cubic-bezier(0.25, 1, 0.5, 1);`.
    2. Trước khi cập nhật nội dung HTML mới, coder đo chiều cao của view hiện tại và khóa chiều cao tĩnh bằng CSS.
    3. Cập nhật nội dung mới, đo chiều cao đích mới và gán giá trị chiều cao đích này vào phần tử để kích hoạt hiệu ứng morphing mượt mà của trình duyệt.

---

## 3. Hệ Thống Màu Sắc & Border Dạng HSL (Mathematical Theming)

Để modal tự động hòa trộn hoàn hảo vào mọi ứng dụng dApp (kể cả khi dApp đổi màu nền tùy ý), màu viền border và màu hover không nên dùng màu xám opaque cứng (như `#e5e7eb`).

- [ ] **Viền và Nền Bán Trong Suốt (Semi-transparent Tokens):**
  * *Ý tưởng:* Sử dụng màu bán trong suốt (alpha) dựa trên màu chữ foreground chính.
  * *Giải pháp:*
    * Đổi token `border` ở Light Theme: `rgba(17, 24, 39, 0.08)` (tương phản 8% dựa trên màu xám đen của chữ).
    * Đổi token `border` ở Dark Theme: `rgba(248, 250, 252, 0.10)`.
    * Đổi token `surfaceHover` thành `rgba(var(--foreground-rgb), 0.04)`.
    * Cách làm này giúp viền modal luôn tự động tiệp với màu nền dApp của khách hàng.

---

## 4. Hiệu Ứng Kính Mờ Cao Cấp (Glassmorphic Backdrop & Glow)

- [ ] **Nâng Cấp Preset Glass Theme:**
  * *Ý tưởng:* Đưa hiệu ứng kính mờ (glassmorphism) của `glassTheme` lên mức chân thực và hiện đại nhất giống Reown AppKit.
  * *Giải pháp:*
    * Tăng chỉ số mờ nền `overlayBlur` từ `20` lên `24` hoặc `28`.
    * Thêm đường viền phát sáng nhẹ quanh modal (border-glow) bằng cách lồng shadow:
      ```css
      box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.08), 0 12px 40px rgba(0, 0, 0, 0.28);
      ```
    * Tách cấu hình `glassTheme` thành hai chế độ Light Glass và Dark Glass tự động thay vì dùng chung các giá trị màu sáng.

---

## 5. Tối Ưu Hóa Onboarding & Trợ Giúp Người Dùng (Onboarding UX)

ConnectKit có mục trợ giúp tuyệt vời cho người dùng mới khi họ chưa cài đặt bất kỳ ví nào.

- [ ] **Màn hình hướng dẫn: "Tôi chưa có ví?" (Don't have a wallet?):**
  * *Ý tưởng:* Thêm một liên kết tinh tế ở dưới cùng danh sách ví: *"New to XRPL? Get a Wallet ↗"*.
  * *Giải pháp:* 
    * Khi click vào nút này, chuyển hướng sang một màn hình phụ hướng dẫn cách tải ví di động Xaman (bằng mã QR trực quan) hoặc cài đặt các ví trình duyệt (GemWallet, Crossmark, DropFi) kèm link tải trực tiếp trên Chrome Web Store / App Store.

---

## 6. Nâng Cấp Thiết Kế Mã QR (Stylized QR & Center Logo)

Mã QR của AppKit luôn cực kỳ chuyên nghiệp nhờ các góc vuông bo mịn và có logo thương hiệu nằm chính giữa.

- [ ] **Tích Hợp Logo Giữa Mã QR (QR Center Logo):**
  * *Ý tưởng:* Chèn logo ví tương ứng (như logo Xaman hoặc logo WalletConnect) vào chính giữa ma trận QR code.
  * *Giải pháp:* Tận dụng thuộc tính `image` và `imageOptions` của thư viện `qr-code-styling` hiện có:
    ```ts
    const qrCode = new QRCodeStyling({
      // ...
      image: walletLogoUrl, // URL ảnh logo ví
      imageOptions: {
        crossOrigin: "anonymous",
        hideBackgroundDots: true,
        imageSize: 0.4,
        margin: 4
      }
    });
    ```
    Hiệu ứng này giúp mã QR trông gọn gàng, tăng độ nhận diện thương hiệu và tạo cảm giác tin cậy.

---

## 7. Thiết Kế Trực Quan Cho Recent Transactions (History List UX)

Giao dịch gần đây cần hiển thị trạng thái sinh động và tối giản để tránh cảm giác khô khan.

- [ ] **Trạng thái Trống Sinh Động (Illustration Empty State):**
  * *Hiện trạng:* Giao diện khi chưa có giao dịch `.xwk-tx-empty` hiển thị một ô xám đơn điệu.
  * *Giải pháp:* Thay thế bằng một icon nét vẽ SVG mờ (như tờ biên lai trống) kết hợp dòng chữ nhẹ nhàng: *"Chưa phát sinh giao dịch trong phiên này"*.
- [ ] **Vòng Tròn Tiến Trình Đang Chờ (Pending Circle Pulse):**
  * *Ý tưởng:* Khi giao dịch ở trạng thái `submitted` (đang chờ xác nhận), hiển thị vòng loading tròn xung quanh biểu tượng trạng thái của giao dịch để người dùng cảm thấy hệ thống đang hoạt động tích cực.

---

## 8. Hiệu ứng Skeleton cho Trạng thái Loading (Skeleton Loaders & Shimmering Animation)

ConnectKit và Reown AppKit loại bỏ các vòng xoay loading spinner truyền thống cho các dữ liệu văn bản và số dư. Họ thay thế bằng các khung xương (Skeleton) pulsing mờ để người dùng hình dung trước bố cục giao diện (Layout Skeleton).

- [ ] **Hiệu ứng Shimmer Pulse dùng chung (CSS Shimmer Effect):**
  * *Giải pháp:* Khai báo một lớp utility CSS để các phần tử skeleton có hiệu ứng quét sáng/tối (shimmer) mượt mà:
    ```css
    .xwk-skeleton {
      background: linear-gradient(
        90deg,
        var(--xwk-surface) 25%,
        var(--xwk-surface-hover) 50%,
        var(--xwk-surface) 75%
      );
      background-size: 200% 100%;
      animation: xwk-shimmer 1.5s infinite ease-in-out;
      border-radius: 4px;
      display: inline-block;
    }
    @keyframes xwk-shimmer {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }
    ```
- [ ] **Skeleton cho Số dư ví (Account Balance Skeleton Loading):**
  * *Hiện trạng:* Khi số dư tài khoản đang được tải (`this.balanceLoading = true`), giao diện hiển thị icon spinner xoay cùng dòng chữ "Connecting..." thô sơ làm lệch dòng.
  * *Giải pháp:* Ẩn spinner và chữ. Render một block skeleton hình chữ nhật bo góc với kích thước tương đương vùng số dư thực tế:
    ```html
    <div class="xwk-skeleton" style="width: 80px; height: 24px; margin-top: 4px;"></div>
    ```
- [ ] **Skeleton cho Phân giải Tên miền Web3 (Web3 Name Resolving Placeholder):**
  * *Hiện trạng:* Khi dApp đang chạy hàm phân giải tên miền `.xrp` qua API XRP Domains, hệ thống hiển thị địa chỉ ví rút gọn tĩnh rồi nhảy cái "cạch" sang tên miền khi hoàn thành.
  * *Giải pháp:* Hiển thị một block skeleton chữ nhật bo góc mỏng tại vị trí hiển thị Web3 Name trong khi API đang phân giải nhằm tránh hiện tượng giật cục visual (Layout Jump).
    ```html
    <div class="xwk-skeleton" style="width: 120px; height: 18px;"></div>
    ```
- [ ] **Skeleton cho Badge "Installed" của Danh sách Ví:**
  * *Hiện trạng:* Các badge trạng thái cài đặt ví được kiểm tra bất đồng bộ qua `getWalletAvailability()`. Khi mở modal, các ví render trước, sau đó badge "Installed" đột ngột xuất hiện làm xô đẩy toàn bộ danh sách (Layout Shift).
  * *Giải pháp:* Trong thời gian chờ kết quả kiểm tra ví, hiển thị một khung badge skeleton mờ bo góc có hiệu ứng pulse. Sau khi có kết quả:
    - Nếu ví khả dụng: Chuyển màu skeleton thành màu xanh của badge "Installed".
    - Nếu ví không khả dụng: Ẩn badge skeleton đi bằng hiệu ứng fade-out mượt mà.
- [ ] **Skeleton cho Hình quét QR Code (QR Scanner Loading Placeholder):**
  * *Hiện trạng:* Khi người dùng nhấn nút kết nối ví di động, mã QR cần ~500ms để khởi tạo URI và vẽ mã. Trong thời gian này dApp hiển thị khoảng trắng hoặc loading spinner.
  * *Giải pháp:* Vẽ một khối vuông skeleton lớn đại diện cho khu vực QR (`width: 200px; height: 200px; border-radius: 12px`) để giữ chỗ visual trước khi mã QR thực tế hiện lên.
