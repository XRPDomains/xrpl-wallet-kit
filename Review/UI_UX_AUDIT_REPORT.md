# UI/UX, AI Slop & Accessibility Audit Report (For Developers)

Tài liệu này tổng hợp toàn bộ các phát hiện lỗi, đề xuất tối ưu hóa và danh sách công việc (Checklist) để lập trình viên sửa đổi các vấn đề về **AI Slop**, **Aesthetics (Thẩm mỹ giao diện)** và **Accessibility (Khả năng tiếp cận - WCAG 2.1 AA)** trên thư viện **XRPL Wallet Kit**.

---

## 1. Loại bỏ AI Slop (AI Slop Cleanup)

### ⏹️ Tối ưu hóa dung lượng ảnh nhúng (Raster Base64 Icons)
*   **Xác nhận thực tế:** Các icon nhúng trực tiếp trong mã nguồn hiện tại **đã được tối ưu hóa hoàn toàn** trùng khớp 100% với các file tối ưu trong thư mục `tmp/` (ví dụ: `dropfi.png` chỉ ~4.9 KB tương đương 6.6 KB ký tự base64; `bifrost.png` chỉ ~3.4 KB tương đương 4.6 KB ký tự base64). Mọi icon đều ở kích thước chuẩn 128x128px và dưới 10 KB. Các nhận định về ảnh cỡ lớn (~289 KB, ~56 KB) trong các tài liệu audit cũ (`DESIGN_CRITIQUE.md`, `PERFORMANCE_CHECKLIST.md`) thuộc về phiên bản cũ và đã được đội ngũ phát triển xử lý trước đó.
*   **Giải pháp nâng cao cho Coder (nếu muốn tối ưu thêm):**
    - [ ] Cân nhắc thay thế các icon raster bằng định dạng vector **SVG đã được rút gọn** (Clean SVG) khi có điều kiện để sắc nét hơn trên màn hình Retina.
    - [ ] Thiết lập cơ chế **dynamic import** (Lazy-loading) cho tệp `icons.ts` của WalletConnect để giảm tải parse module ban đầu.

### ⏹️ Double Overlay khi dùng WalletConnect Default Mode
*   **Vấn đề:** Chế độ `walletConnectUiMode: "default"` mở cả modal riêng của SDK (ở trạng thái loading/connecting) và modal gốc của WalletConnect (AppKit) đè lên trên. Khi người dùng đóng modal AppKit, modal của SDK vẫn hiển thị lỗi kết nối bị từ chối.
*   **Giải pháp cho Coder:**
    - [ ] Khi cấu hình `useModal: true` và `modalMode: "always"` được kích hoạt trên WalletConnect adapter, hãy ẩn hoặc đóng modal của SDK ngay lập tức để nhường quyền kiểm soát hiển thị hoàn toàn cho modal gốc của WalletConnect.

---

## 2. Tối ưu hóa Giao diện & Visual Tokens (Interface & Token Optimization)

### ⏹️ Box Shadow cho Light Theme (Elevation)
*   **File ảnh hưởng:** [packages/ui/src/themes.ts](file:///c:/Users/PC/OneDrive/Develop/VibeCode/xrplWalletKit/packages/ui/src/themes.ts)
*   **Vấn đề:** Cấu hình mặc định của `lightTheme` thiết lập `shadow: "none"`. Điều này làm modal phẳng dẹt, chìm vào nền trắng của dApp, thiếu đi chiều sâu thị giác (Elevation) cần thiết của một cửa sổ hội thoại nổi.
*   **Giải pháp cho Coder:**
    - [ ] Cập nhật giá trị `shadow` trong `lightTheme` mặc định:
      ```ts
      shadow: "0 8px 40px rgba(15, 23, 42, 0.12), 0 0 0 1px rgba(15, 23, 42, 0.04)"
      ```

### ⏹️ Đồng bộ cấu hình Visual Tokens (Consistency)
*   **File ảnh hưởng:** [packages/ui/src/modal.ts](file:///c:/Users/PC/OneDrive/Develop/VibeCode/xrplWalletKit/packages/ui/src/modal.ts)
*   **Vấn đề:** Có sự bất nhất trong việc áp dụng tokens bo góc:
    1.  Nút ví `.xwk-wallet` bị cứng giá trị `border-radius: 16px` thay vì lấy từ token `theme.walletRadius`.
    2.  Bo góc ảnh ví trong danh sách là `12px` nhưng ở kết nối loading panel lại là `16px`.
    3.  Hàm `renderMobileSheetOverrides()` dùng `!important` ghi đè cứng bo góc mobile sheet, bỏ qua tùy biến `radius` của dev.
*   **Giải pháp cho Coder:**
    - [ ] Đổi class `.xwk-wallet` sử dụng `${theme.walletRadius}` thay vì `16px` cứng.
    - [ ] Đảm bảo bo góc icon của ví đồng bộ ở tất cả các màn hình hiển thị.
    - [ ] Truyền giá trị `theme.radius` vào hàm `renderMobileSheetOverrides(theme)` để áp dụng bo góc động trên mobile sheet.

### ⏹️ Loại bỏ hiện tượng giật/nhấp nháy Visual (Visual Flickering)
*   **File ảnh hưởng:** [packages/ui/src/button.ts](file:///c:/Users/PC/OneDrive/Develop/VibeCode/xrplWalletKit/packages/ui/src/button.ts), [packages/ui/src/modal.ts](file:///c:/Users/PC/OneDrive/Develop/VibeCode/xrplWalletKit/packages/ui/src/modal.ts)
*   **Vấn đề:**
    1.  Badge "Installed" xuất hiện chậm hơn danh sách ví sau khi hàm `getWalletAvailability()` giải quyết bất đồng bộ, gây dịch chuyển dòng.
    2.  Nút Connect Wallet hiển thị địa chỉ ví rút gọn trước, sau đó ~1 giây mới cập nhật tên miền `.xrp` phân giải xong, tạo cảm giác giật visual.
*   **Giải pháp cho Coder:**
    - [ ] Áp dụng thời gian đệm trễ (Settle Window ~260ms) trong `WalletButton` trước khi hiển thị địa chỉ fallback để chờ phân giải tên miền.
    - [ ] Sử dụng cache trong bộ nhớ lưu `network:address` -> `Web3 Identity` để hiển thị tức thì trong các phiên làm việc sau.
    - [ ] Dự phòng chiều rộng cố định hoặc hiển thị placeholder/skeleton mờ cho badge "Installed" trong khi đang kiểm tra trạng thái bất đồng bộ.

### ⏹️ Nâng cao hiệu năng CSS Injection
*   **File ảnh hưởng:** [packages/ui/src/modal.ts](file:///c:/Users/PC/OneDrive/Develop/VibeCode/xrplWalletKit/packages/ui/src/modal.ts), [packages/ui/src/dom.ts](file:///c:/Users/PC/OneDrive/Develop/VibeCode/xrplWalletKit/packages/ui/src/dom.ts)
*   **Vấn đề:** Mỗi lần thay đổi view trong modal, toàn bộ `root.innerHTML` bị thay đổi kéo theo thẻ `<style>` chứa ~4 KB mã CSS bị ghi đè và yêu cầu trình duyệt phân tích lại (style recalculation).
*   **Giải pháp cho Coder:**
    - [ ] Sử dụng hàm `ensureWalletStyle(id, css)` để đăng ký CSS một lần duy nhất vào `document.head`. Chỉ thay đổi mã HTML thuần bên trong modal thay vì ghi đè cả thẻ style.

---

## 3. Khả năng tiếp cận & Trải nghiệm Di động (Accessibility & Mobile UX)

### ⏹️ Khắc phục độ tương phản Badge "Installed" ở chế độ sáng (Lỗi Major - WCAG AA)
*   **File ảnh hưởng:** [packages/ui/src/modal.ts](file:///c:/Users/PC/OneDrive/Develop/VibeCode/xrplWalletKit/packages/ui/src/modal.ts) (phần `renderStyles()`)
*   **Vấn đề:** Màu chữ xám `#6b7280` trên nền xám sáng `#f0f1f3` của badge có tỷ lệ tương phản **4.28:1** (tiêu chuẩn WCAG AA là **4.5:1**).
*   **Giải pháp cho Coder:**
    - [ ] Thay đổi màu chữ badge trong chế độ sáng (Light mode) thành `#5c6878` để tăng tỷ lệ tương phản lên **5.01:1** đạt chuẩn WCAG AA.
      ```ts
      const badgeColor = this.resolveThemeMode() === "dark" ? "#cbd5e1" : "#5c6878";
      ```

### ⏹️ Nhãn ARIA động cho Dialog (A11y Robustness)
*   **File ảnh hưởng:** [packages/ui/src/modal.ts](file:///c:/Users/PC/OneDrive/Develop/VibeCode/xrplWalletKit/packages/ui/src/modal.ts) (hàm `renderShell()`, `renderQrShell()`, `renderConnectShell()`)
*   **Vấn đề:** Thuộc tính `aria-label="Connect Wallet"` bị cố định ở ngoài thẻ dialog. Khi chuyển đổi sang màn hình quét mã QR hoặc chờ phê duyệt thiết bị, screen reader vẫn thông báo nhãn cũ.
*   **Giải pháp cho Coder:**
    - [ ] Thêm thuộc tính `id="xwk-title"` vào phần tử `h2` / `div` hiển thị tiêu đề tiêu chuẩn.
    - [ ] Thay thế `aria-label` trên thẻ overlay/section modal bằng:
      ```html
      aria-labelledby="xwk-title"
      ```

### ⏹️ Nhãn Screen Reader cho cụm danh sách ví bổ sung
*   **File ảnh hưởng:** [packages/ui/src/modal.ts](file:///c:/Users/PC/OneDrive/Develop/VibeCode/xrplWalletKit/packages/ui/src/modal.ts) (hàm `renderWalletGroup()`)
*   **Vấn đề:** Phần tử hiển thị số lượng ví ẩn `<span class="xwk-mini-more">+${overflow}</span>` không rõ ngữ cảnh đối với người dùng sử dụng máy đọc màn hình.
*   **Giải pháp cho Coder:**
    - [ ] Thêm thuộc tính `aria-label` chi tiết:
      ```html
      `<span class="xwk-mini-more" aria-label="+${overflow} more wallets">+${overflow}</span>`
      ```

### ⏹️ Hỗ trợ Tiếp cận đối với Giao diện Quét mã QR
*   **File ảnh hưởng:** [packages/ui/src/modal.ts](file:///c:/Users/PC/OneDrive/Develop/VibeCode/xrplWalletKit/packages/ui/src/modal.ts) (hàm `renderQrShell()`)
*   **Vấn đề:** Screen Reader không có mô tả cho phần mã QR, và người dùng khiếm thị cần được hướng dẫn sử dụng tính năng Copy URI.
*   **Giải pháp cho Coder:**
    - [ ] Thêm thuộc tính `aria-hidden="true"` vào thẻ div chứa QR code `.xwk-qr-code`.
    - [ ] Thêm thẻ thông báo ẩn (`.xwk-sr-only`) ngay cạnh mã QR:
      ```html
      <span class="xwk-sr-only">QR code — use the Copy URI button below if you cannot scan.</span>
      ```

---

## 4. Audit các Cập nhật Mới: Mã QR Địa chỉ trong Account Panel (Address QR Code Audit)

Đợt cập nhật đã bổ sung tính năng hiển thị mã QR của địa chỉ ví trực tiếp trong bảng điều khiển tài khoản (Account Panel). Dưới đây là đánh giá UI/UX chuyên sâu về tính năng này:

*   **Vector SVG sắc nét:** Thư viện sử dụng `qr-code-styling` để vẽ mã QR dưới dạng SVG thay vì tạo thẻ ảnh raster (PNG/JPG). Nhờ vậy, mã QR luôn sắc nét ở mọi độ phân giải (màn hình Retina) và không gây phình dung lượng file tĩnh.
*   **Hỗ trợ Dark/Light Mode động:** Mã QR giải quyết màu sắc (`qrColor`) dựa trên chế độ sáng/tối của theme đang kích hoạt (sử dụng màu sáng `QR_LIGHT` cho nền tối và ngược lại). Màu nền QR được đặt là `transparent` giúp nó hòa nhập tự nhiên vào background của modal.
*   **Hỗ trợ Screen Reader:** Nút kích hoạt hiển thị QR (`.xwk-address-qr-trigger`) được cấu hình cả `aria-label` và `title` chứa chuỗi dịch nghĩa ("Show address QR code" / "Hiển thị mã QR địa chỉ"), giúp người khiếm thị biết chính xác chức năng nút bấm. Khung chứa mã QR (`.xwk-address-qr-code`) được đánh dấu `aria-hidden="true"`, địa chỉ ví dạng văn bản classic được hiển thị ngay bên dưới trong chip `.xwk-address-qr-chip` để máy đọc dễ dàng.
*   **Keyboard Navigation (Focus indicators):** Nút kích hoạt QR, nút sao chép địa chỉ và nút quay lại đều được áp dụng bộ chọn `:focus-visible` để hiển thị viền highlight rõ ràng (outline màu accent) khi điều hướng bằng bàn phím.
*   **Xử lý lỗi phòng vệ (Defensive Fallback):** Thư viện bọc quá trình dựng mã QR trong khối `try/catch`. Trong trường hợp hiếm gặp khi thư viện vẽ QR lỗi hoặc không tải được, một div fallback `.xwk-address-qr-fallback` sẽ được render hiển thị địa chỉ text thuần để đảm bảo app không bị crash.

---

## 5. Checklist Khắc phục Giao diện: Account Panel, QRCode, Recent Transactions & UI Desync

Dưới đây là checklist các điểm phân mảnh giao diện, chồng nhiều lớp, và các hành vi trải nghiệm bất hợp lý (UX/UI Slop) cần phân công lập trình viên khắc phục:

### 🔴 Lỗi Nghiêm Trọng (Critical Gaps)

- [ ] **Lỗi Mất Nút Quay Lại trong chế độ Dropdown (Dropdown Mode QR Back Navigation):**
  * *Hiện trạng:* Khi cấu hình `accountPanelMode: "dropdown"`, phần header của modal (chứa tiêu đề và nút Back `data-xwk-account-back`) bị loại bỏ hoàn toàn để giao diện dropdown được tinh gọn. Tuy nhiên, khi người dùng nhấn vào nút hiển thị mã QR, giao diện QR được tải nhưng không có bất kỳ nút Back hay Close nào. Người dùng bị kẹt ở màn hình QR và không thể quay về thông tin tài khoản chính ngoại trừ việc tắt hẳn dropdown rồi mở lại.
  * *Khắc phục:* Trong chế độ dropdown, khi `this.addressQrOpen` là true, cần chèn một nút quay lại (Back button) nhỏ, trực quan trực tiếp vào phía trên vùng nội dung mã QR.
- [ ] **Lỗi Treo Giao Diện khi Đổi Tài Khoản (UI State Desync on Account Change):**
  * *Hiện trạng:* Khi ví extension kích hoạt sự kiện `accountChanged` hoặc `networkChanged`, bộ điều khiển gọi `resolveBalance()`. Tuy nhiên, nếu cấu hình mặc định `showBalance` là `false`, hàm `resolveBalance()` lập tức thoát sớm (`return`) mà không gọi `this.render()`. Kết quả là nút Wallet Button tiếp tục hiển thị địa chỉ ví cũ, gây nhầm lẫn nghiêm trọng cho người dùng.
  * *Khắc phục:* Tách biệt lệnh cập nhật giao diện `this.render()` ra khỏi các điều kiện rào cản của số dư. Phải luôn thực hiện re-render khi tài khoản hoặc mạng thay đổi bất kể `showBalance` có bật hay không.

### 🟡 Lỗi Trải Nghiệm (UX/UI Slop & Layering Issues)

- [ ] **Hiện Tượng Nhảy Chiều Cao Modal (Layout Shift):**
  * *Hiện trạng:* Khi người dùng mở mã QR, class `.xwk-account-panel-with-transactions` bị gỡ bỏ, làm chiều cao modal đột ngột co rút từ `650px` xuống `527px`. Khi nhấn Back quay lại, modal lại phình to ra `650px`. Sự thay đổi kích thước đột ngột này gây nhức mắt và làm lệch vị trí bấm của ngón tay.
  * *Khắc phục:* Khóa cứng chiều cao tối đa của khung modal ngoài. Thay vào đó, cho phép các phần tử bên trong (như danh sách transactions) tự động co giãn bằng CSS Flexbox/Grid, giữ nguyên chiều cao của cửa sổ hội thoại.
- [ ] **Thanh Cuộn Lồng Nhau (Double Scroll / Scroll-Within-Scroll):**
  * *Hiện trạng:* Phần body của modal (`.xwk-account-modal-body`) có cấu hình `overflow: auto`. Bên trong đó, danh sách transactions (`.xwk-tx-list`) cũng được giới hạn chiều cao ở mức cực kỳ thấp `max-height: 86px` (chỉ hiển thị được 2 dòng giao dịch) và tự có thanh cuộn riêng. Trên di động, việc cuộn trong một khu vực 86px nhỏ hẹp lồng trong một body cuộn khác gây khó chịu cực kỳ và kẹt cảm ứng.
  * *Khắc phục:* Bỏ thuộc tính cuộn riêng của `.xwk-tx-list`, cho phép danh sách giao dịch hiển thị tự nhiên trong modal body và cuộn chung với dòng chảy chính của cửa sổ.
- [ ] **Mất Lớp Phủ Nền (Backdrop Dimming) của Dropdown trên Mobile:**
  * *Hiện trạng:* Trên màn hình di động (<520px), giao diện dropdown được cố định ở đáy màn hình dưới dạng Bottom Sheet để giống với modal. Nhưng vì là dropdown nên nó thiếu đi lớp overlay làm mờ nền `.xwk-account-overlay`. Điều này khiến giao diện bị chồng chéo trực tiếp lên nội dung trang dApp đang hiển thị phía sau, gây phân mảnh và rối rắm thị giác.
  * *Khắc phục:* Khi chiều rộng màn hình dưới 520px, kích hoạt lớp phủ overlay làm mờ nền cho cả chế độ Dropdown để cô lập giao diện điều khiển với trang web dApp.
- [ ] **Đóng/Mở Transactions Bị Giật Cục (Instant Snapping):**
  * *Hiện trạng:* Việc nhấn vào header lịch sử giao dịch để ẩn/hiện danh sách row diễn ra tức thời, không có hiệu ứng chuyển cảnh (accordion transition).
  * *Khắc phục:* Cấu hình hiệu ứng CSS transition trên thuộc tính `max-height` hoặc `grid-template-rows` của container chứa danh sách giao dịch để đóng mở mượt mà.
- [ ] **Thiết Kế Dạng Hộp Phân Mảnh (Boxy Fragmented Blocks):**
  * *Hiện trạng:* Mỗi phần thông tin (địa chỉ ví, warning kích hoạt, transactions history, các nút chức năng) đều được bọc trong các viền border xám riêng lẻ với cùng màu nền `theme.surface`. Điều này tạo ra một chuỗi các khối hộp rời rạc chồng chất lên nhau, thiếu đi sự gọn gàng, tinh tế và cảm giác cao cấp.
  * *Khắc phục:* Gom nhóm các thông tin metadata và hành động chung vào các thẻ có phân cấp rõ ràng, thay thế các viền border thô bằng các khoảng padding thông thoáng và các mức độ đậm nhạt khác nhau của màu chữ (Visual Hierarchy).

### 🟢 Accessibility & Touch Target

- [ ] **Kích Thước Điểm Chạm (Touch Target) của Nút QR trên Di Động:**
  * *Hiện trạng:* Nút kích hoạt QR `.xwk-address-qr-trigger` trên di động chỉ rộng 36x36px, thấp hơn tiêu chuẩn WCAG 2.1 (khuyến nghị tối thiểu 44x44px hoặc ít nhất 40x40px) khiến người dùng dễ bấm trượt.
  * *Khắc phục:* Tăng padding cho nút `.xwk-address-qr-trigger` trong CSS để mở rộng vùng touch-target lên tối thiểu 40x40px mà không làm phóng to kích thước icon SVG bên trong.

---

## 8. Đề xuất Hướng giải quyết Tránh Thanh cuộn (Scrollbars) & Phân mảnh Giao diện

Để giao diện Account Panel đạt mức thẩm mỹ cao cấp (Premium Aesthetics), sạch sẽ và gọn gàng đúng chuẩn Web3 hiện đại (tương tự RainbowKit, AppKit), việc hiển thị thanh cuộn vật lý (scrollbar) hoặc lồng nhiều thanh cuộn là điều nên tránh. Dưới đây là 3 hướng giải quyết kỹ thuật cho coder:

### 💡 Hướng 1: Ẩn thanh cuộn vật lý bằng CSS (CSS Scrollbar Hiding) - *Khuyên dùng cho Mobile*
*   **Ý tưởng:** Giữ nguyên tính năng cuộn (người dùng vẫn dùng chuột cuộn hoặc ngón tay vuốt bình thường) nhưng ẩn hoàn toàn thanh cuộn (scrollbar track & thumb) khỏi giao diện.
*   **CSS để Coder áp dụng:**
    ```css
    /* Ẩn thanh cuộn trên Chrome, Safari, Opera */
    .xwk-account-modal-body::-webkit-scrollbar,
    .xwk-tx-list::-webkit-scrollbar {
      display: none;
    }
    /* Ẩn thanh cuộn trên Firefox và IE/Edge */
    .xwk-account-modal-body,
    .xwk-tx-list {
      -ms-overflow-style: none;  /* IE/Edge */
      scrollbar-width: none;  /* Firefox */
    }
    ```
*   **Ưu điểm:** Cực kỳ dễ làm, giữ nguyên luồng logic hiện tại, giao diện trông mượt mà và liền mạch ngay lập tức.

### 💡 Hướng 2: Chuyển đổi sang giao diện View-based (Màn hình phụ riêng)
*   **Ý tưởng:** Coi **Lịch sử giao dịch (Recent Transactions)** là một màn hình phụ độc lập tương tự như màn hình **QRCode**. 
    *   Màn hình chính chỉ hiển thị: Avatar/Hero, Web3 Name, Địa chỉ ví, Số dư, và 1 nút chuyển hướng: `Recent Transactions ➜` (hoặc icon lịch sử cạnh nút QR).
    *   Khi người dùng nhấn vào nút này, toàn bộ nội dung body sẽ chuyển sang view giao dịch với tiêu đề "Lịch sử giao dịch" và có nút Back ở góc trái để quay lại.
*   **Ưu điểm:** Loại bỏ hoàn toàn sự chồng chéo thông tin. Modal không bao giờ bị tràn chiều cao, không bao giờ cần thanh cuộn, giao diện gọn gàng tuyệt đối.

### 💡 Hướng 3: Giới hạn cứng số lượng giao dịch (Strict Limit & Explorer Link)
*   **Ý tưởng:** Giới hạn cứng số lượng giao dịch hiển thị tối đa là **3 dòng** giao dịch gần nhất.
    *   Loại bỏ hoàn toàn thuộc tính cuộn (`overflow: auto` và `max-height`) của `.xwk-tx-list`.
    *   Dưới 3 dòng giao dịch, chèn một liên kết text nhỏ: `Xem thêm trên Explorer ↗` dẫn thẳng tới địa chỉ ví trên mạng lưới tương ứng.
*   **Ưu điểm:** Giữ cho chiều cao của Panel luôn cố định, cấu trúc HTML phẳng dẹt đơn giản, không phát sinh bất kỳ thanh cuộn nào trong tài liệu.

