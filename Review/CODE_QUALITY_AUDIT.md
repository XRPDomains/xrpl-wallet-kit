# Checklist Đánh Giá Chất Lượng Mã Nguồn (Code Quality & Architecture Audit)
*Tập trung vào Tối ưu hiệu năng, Rò rỉ bộ nhớ, Tránh giật lag và Tính an toàn của hệ thống*

Tài liệu này tổng hợp các phát hiện lỗi kỹ thuật ngầm (Code Smells), rò rỉ bộ nhớ (Memory Leaks), và các điểm cần tối ưu hóa trong cấu trúc mã nguồn của **XRPL Wallet Kit** kèm giải pháp khắc phục chi tiết cho lập trình viên.

---

## 1. Rò Rỉ Bộ Nhớ DOM do CSS Injection (DOM Style Memory Leak)

- [ ] **Khắc phục Rò rỉ Thẻ `<style>` liên tục:**
  * *Tệp tin ảnh hưởng:* [packages/ui/src/dom.ts](file:///c:/Users/PC/OneDrive/Develop/VibeCode/xrplWalletKit/packages/ui/src/dom.ts) (hàm `ensureWalletStyle`) và [packages/ui/src/modal.ts](file:///c:/Users/PC/OneDrive/Develop/VibeCode/xrplWalletKit/packages/ui/src/modal.ts) (hàm `ensureStyles`).
  * *Vấn đề:* Mỗi khi cấu hình theme hoặc layout thay đổi, hàm `getWalletStyleId()` sẽ băm (hash) chuỗi CSS mới để tạo ra một ID mới. Hàm `ensureWalletStyle()` kiểm tra sự tồn tại của thẻ style có ID này, nếu chưa có sẽ tạo mới và append vào `document.head`. Do các thẻ style cũ **không bao giờ bị gỡ bỏ**, việc chuyển đổi theme/layout nhiều lần sẽ sinh ra hàng chục thẻ `<style>` rác trong `document.head`, gây rò rỉ bộ nhớ và làm chậm quá trình phân tích CSSOM của trình duyệt.
  * *Giải pháp:* Thay vì dùng ID băm động, hãy sử dụng một thẻ style cố định duy nhất cho modal và ghi đè trực tiếp nội dung của nó:
    ```typescript
    export function ensureWalletStyle(id: string, styles: string): void {
      if (typeof document === "undefined") return;
      let element = document.getElementById(id) as HTMLStyleElement;
      if (!element) {
        element = document.createElement("style");
        element.id = id;
        document.head.appendChild(element);
      }
      if (element.textContent !== styles) element.textContent = styles;
    }
    ```

---

## 2. Giảm Dung Lượng Bundle qua Dynamic Import (Tree Shaking & Lazy Loading)

- [ ] **Lazy-load các thư viện vẽ mã QR nặng:**
  * *Tệp tin ảnh hưởng:* [packages/ui/src/modal.ts](file:///c:/Users/PC/OneDrive/Develop/VibeCode/xrplWalletKit/packages/ui/src/modal.ts)
  * *Vấn đề:* Thư viện `qr-code-styling` và `qrcode` được import tĩnh ở đầu file. Kích thước bundle của phần UI sẽ bị phình to rất nặng (~100 KB+), ngay cả khi dApp của khách hàng chỉ dùng ví extension và không bao giờ hiển thị mã QR.
  * *Giải pháp:* Chuyển sang import động (dynamic import) trong hàm `renderQr()` để trình duyệt chỉ tải code QR khi người dùng thực sự mở màn hình quét QR:
    ```typescript
    private async renderQr(container: HTMLElement, uri: string) {
      container.replaceChildren();
      try {
        const QRCodeStyling = (await import("qr-code-styling")).default;
        // Tiến hành khởi tạo và render QR...
      } catch (err) {
        // ...
      }
    }
    ```

---

## 3. Quản Lý Trạng Thái Bất Đồng Bộ khi Hủy Kết Nối (Abort Connection Signal)

- [ ] **Tích hợp triệt để AbortSignal vào các Wallet Adapter:**
  * *Tệp tin ảnh hưởng:* Các adapter trong `packages/core/src/adapters/` (GemWallet, Crossmark, Xaman).
  * *Vấn đề:* Thuộc tính `signal?: AbortSignal` đã được truyền vào hàm `connect()`, nhưng bên trong các adapter ví chưa lắng nghe sự kiện `abort` của signal này trong quá trình chờ người dùng duyệt popup. Kết quả là nếu người dùng đóng modal (hủy kết nối), tiến trình chờ phê duyệt ngầm của ví vẫn chạy và có thể throw lỗi không mong muốn sau đó.
  * *Giải pháp:* Trong mỗi adapter, đăng ký lắng nghe sự kiện `abort` để reject Promise kết nối ngay lập tức:
    ```typescript
    if (options.signal) {
      options.signal.addEventListener("abort", () => {
        // Hủy popup hoặc reject kết nối ví
      });
    }
    ```

---

## 4. Tần Suất Yêu Cầu RPC quá cao (Rate Limiting & Debouncing Balance Refresh)

- [ ] **Bảo vệ API Node bằng Debounce số dư:**
  * *Tệp tin ảnh hưởng:* [packages/ui/src/button.ts](file:///c:/Users/PC/OneDrive/Develop/VibeCode/xrplWalletKit/packages/ui/src/button.ts) (hàm `resolveBalance`).
  * *Vấn đề:* Khi tài khoản, mạng lưới, hoặc nhiều giao dịch thay đổi liên tục, dApp gọi `resolveBalance()` dồn dập, tạo ra hàng loạt request RPC kiểm tra tài khoản lên các node công cộng (Public Nodes), dễ dẫn đến bị chặn IP (Rate Limit) hoặc làm chậm ứng dụng.
  * *Giải pháp:* Thiết lập cơ chế chống rung (Debounce) tối thiểu 1.5 giây cho các yêu cầu lấy số dư:
    ```typescript
    private balanceTimeout: number | null = null;
    private async resolveBalance(session: WalletSession | null) {
      if (this.balanceTimeout) clearTimeout(this.balanceTimeout);
      this.balanceTimeout = window.setTimeout(async () => {
        // Thực hiện gọi API Node thực tế ở đây
      }, 300);
    }
    ```

---

## 5. Kháng Lỗi khi Kết Nối Trực Quan Bị Hỏng (UI Error Boundaries)

- [ ] **Bọc Try/Catch cho các Luồng Render HTML:**
  * *Tệp tin ảnh hưởng:* [packages/ui/src/modal.ts](file:///c:/Users/PC/OneDrive/Develop/VibeCode/xrplWalletKit/packages/ui/src/modal.ts) và [packages/ui/src/button.ts](file:///c:/Users/PC/OneDrive/Develop/VibeCode/xrplWalletKit/packages/ui/src/button.ts) (hàm `render()`).
  * *Vấn đề:* Nếu xảy ra lỗi bất ngờ khi phân tích dữ liệu session hoặc phân giải tên miền Web3 từ API bên thứ ba, hàm `render()` sẽ crash và làm cho toàn bộ cây DOM của modal/button bị treo (giao diện đơ, không phản hồi).
  * *Giải pháp:* Bọc phần render chính trong khối `try/catch`. Nếu phát hiện crash, hiển thị một thông báo lỗi fallback nhẹ kèm nút bấm Disconnect/Reset để người dùng có thể tự giải thoát giao diện.
