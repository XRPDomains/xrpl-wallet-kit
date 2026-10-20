# Xahau Integration — Code Review (2026-10-19)

## Phạm vi và phương pháp

Open Code Review (OCR) theo **Delegation Mode**, giống `CODE_AUDIT_2026-10-01.md`:
phần chọn file/nhóm file làm deterministic, phần đánh giá do reviewer thực hiện.
Không chạy được `ocr` CLI trong sandbox (Git 2.34 < yêu cầu 2.41; ngoài ra quy tắc
dự án hạn chế thao tác bash trên OneDrive). File selection lấy từ
`git diff --ignore-cr-at-eol` so với `HEAD` (`ef9c417`, release 0.1.23) cộng các
file untracked. Nội dung code quan trọng được đối chiếu lại bằng đọc trực tiếp.

Bundles đã review:

| Bundle | Files |
| --- | --- |
| Core contract | `core/src/{types,utils,protocol,manager,request,errors,discovery,index}.ts` |
| Protocol runtime | `xahau/src/{index,lazy,networks}.ts`, `xahau/package.json` |
| Client / bundle | `client/src/index.ts`, `client/package.json`, `browser/vite.config.ts` |
| Adapters | `gemwallet`, `xaman` (+`browser-auth`), `xyra` (+`popup`), `ledger` (+`device-app`) |
| UI | `ui/src/modal.ts`, locales |
| Tests | `client`, `gemwallet`, `xyra`, `ledger-open-app`, `chain-filter`, `xahau-protocol`, `xaman-xahau`, `ui-chain-filter` |

Không review: website, docs, examples, spike scripts. Không chạy test/build.

## Tóm tắt

Kiến trúc đúng hướng và phần lớn an toàn: protocol injection qua `core`, manager
fail-closed khi thiếu runtime, verify blob/NetworkID/fee/chữ ký trước submit,
trần phí lấy min, Ledger mặc định vẫn XRPL-only. Các điểm cần xử lý trước merge:
một thay đổi bảo mật chưa khớp tài liệu (signMessage trên Xahau), line-ending
churn, và một số thay đổi hành vi với người dùng **XRPL thuần** cần ghi CHANGELOG
hoặc kiểm thử hồi quy.

| ID | Mức | Vấn đề |
| --- | --- | --- |
| R1 | P1 | signMessage trên Xahau đã bật lại (GemWallet, Xaman) nhưng auth chưa gắn chain |
| R2 | P1 | Line-ending LF→CRLF trên ~40 file, diff 7.264 dòng thay vì ~1.086 |
| R3 | P2 | GemWallet XRPL: luôn bật `signTransaction`, đổi code path ký sign-only, trần phí ẩn 1 XRP |
| R4 | P2 | `supportedNetworks` legacy nay được enforce ở connect/restore/sign; `[]` thành deny-all |
| R5 | P2 | WalletStandardAdapter giờ mặc định `DEFAULT_XRPL_NETWORKS` → custom network bị từ chối |
| R6 | P2 | IIFE `inlineDynamicImports` gom codec Xahau vào bundle CDN của mọi người dùng |
| R7 | P2 | Chọn protocol chỉ theo `family`, không theo network |
| R8 | P3 | Wire-mapping chain nằm rải trong từng adapter, khó mở rộng chain mới |
| R9 | P3 | Literal `"xrpl"` lặp trong manager thay vì helper chung |
| R10 | P3 | Storage key chưa tách theo chain ở client khi có nhiều manager |

## Chi tiết

### R1 (P1) — signMessage Xahau không chain-bound

- `gemwallet/src/index.ts:109-120`, `xaman/src/index.ts:239-262`: bản trước chặn
  `signMessage` khi có `protocolContext`; bản này cho chạy (Xaman thêm
  `force_network`). `tests/gemwallet.test.ts:17` còn test ký message trên Xahau.
- `packages/auth` không đổi logic (diff chỉ là CRLF): chưa có `expectedChainId`,
  `Chain ID` trong message là tùy chọn và không được validate.
- `XAHAU_M0_FINDINGS.md` mục 17 ghi "chain-bound message auth remain disabled" —
  code và tài liệu đang mâu thuẫn.
- Tác động: backend phục vụ cả XRPL và Xahau không phân biệt được người dùng
  đăng nhập trên chain nào; cùng một chữ ký hợp lệ ở cả hai nơi.
- Đề xuất: chặn lại như trước, hoặc bật kèm điều kiện: manager tự chèn
  `Chain ID` khi network ngoài XRPL, thêm `expectedChainId` vào
  `WalletAuthValidationOptions` và `verifyWalletAuth`, có test negative.

### R2 (P1) — Line-ending churn

- So sánh `git diff --stat` thường và `--ignore-cr-at-eol`: 7.264+/6.329- so với
  1.086+/151-. Ví dụ `ui/src/modal.ts`: 1.213 dòng CRLF trên đĩa, 0 trong `HEAD`.
- Các file chỉ đổi line ending, không đổi logic: `auth/src/auth.ts`,
  `adapters/dropfi`, `adapters/xrpl-snap`, `adapters/walletconnect/src/*`,
  phần lớn `tests/core.test.ts`, `ui-button-theme`, `ui-component-style`...
- Vi phạm quy tắc CLAUDE.md "do not silently convert line endings"; làm hỏng
  `git blame` và che mất thay đổi thật khi review PR.
- Đề xuất: thêm `.gitattributes` (`* text=auto eol=lf`), chạy
  `git add --renormalize .`, kiểm tra lại diff chỉ còn ~1.1k dòng.

### R3 (P2) — GemWallet XRPL đổi code path

- `capabilities.signTransaction = true` luôn được set (constructor), kể cả khi
  không dùng Xahau. Manager sẽ gọi `adapter.signTransaction` mới thay vì
  fallback `signAndSubmit({ submit: false })` như trước.
- Đường XRPL mới gọi `provider.signTransaction({ transaction })` và tự verify,
  với trần phí mặc định `request.maxFeeDrops ?? "1000000"`: một giới hạn mới
  không có trong tài liệu XRPL. Mỗi `current()` gọi thêm `getAddress()`.
- `signAndSubmit({ submit: false })` cũng rẽ sang đường này.
- Đề xuất: chỉ bật đường mới khi có `supportedChains`, hoặc giữ nhưng ghi
  CHANGELOG + test hồi quy live GemWallet XRPL (sign-only, phí cao hơn 1 XRP).

### R4 (P2) — Legacy `supportedNetworks` được enforce rộng hơn

- Trước: chỉ `switchNetwork` kiểm tra, và `[]` được hiểu là không giới hạn.
- Nay: `adapterSupportsNetwork` chạy ở connect, restore, recover, sign, event.
  DropFi/GhostSig khai báo `["mainnet","testnet","devnet"]` nên network XRPL
  custom (standalone, sidechain, node riêng với id khác) sẽ bị từ chối khi connect.
- Hướng này đúng về an toàn nhưng là breaking change với XRPL → cần CHANGELOG và
  ghi rõ cách mở (`supportedChains` hoặc config adapter).

### R5 (P2) — WalletStandardAdapter

- `discovery.ts:80-85`: khi không truyền `options.networks`, giờ lọc theo
  `DEFAULT_XRPL_NETWORKS` (trước là `undefined` = không giới hạn). Network custom
  khai báo ở manager nhưng không truyền vào Standard adapter sẽ bị deny.
- Luôn khai báo `supportedChains` → `acceptNetworkEvent`/`assertAccountNetwork`
  ngắt kết nối nếu event thiếu network. Hiện `toAccount` có network nên ổn, nhưng
  nên có test riêng.

### R6 (P2) — Kích thước bundle CDN

- `browser/vite.config.ts:59` `inlineDynamicImports: true`: lazy-load không còn
  tác dụng trong IIFE; codec + definitions JSON vào bundle của mọi site XRPL dùng CDN.
- Đề xuất: đo trước/sau (`.iife.min.js` gzip). Nếu tăng đáng kể, tách
  `xrpl-wallet-kit-xahau.iife.js` add-on, tự đăng ký protocol khi load.

### R7 (P2) — Chọn protocol theo family

- `manager.ts:428`: `protocols.find(item => item.family === family)`. Không xét
  `protocol.networks`, nên không thể có hai runtime cùng family (ví dụ testnet
  dùng definitions mới hơn mainnet), và protocol nhận cả network nó không khai báo
  (runtime Xahau tự chặn bằng `networkCheck`, runtime khác có thể không).
- Đề xuất: match `family` **và** `networks.some(n => n.id === network.id)`.

### R8–R10 (P3)

- **R8:** mapping wire-format nằm trong từng adapter: Xaman
  `XAHAU/XAHAUTESTNET`, Xyra `selector`, GemWallet `chain.toUpperCase()` +
  `Mainnet/Testnet`, Ledger app `XAH`, max filter `["xrpl","xahau"]` lặp 4 lần.
  Xem mục "Độ mở rộng" bên dưới.
- **R9:** `"xrpl"` literal ở `manager.ts:633, 675, 1229`; dùng helper
  `isLegacyFamily()` từ `utils.ts` để chỉ còn một chỗ.
- **R10:** client vẫn dùng `createBrowserWalletStorage()` prefix mặc định; hai
  manager XRPL/Xahau cùng trang sẽ chung key. Thêm prefix theo family/network.

## Điểm tốt đã xác nhận

- Manager fail-closed khi network ngoài XRPL thiếu runtime (`manager.ts:1226-1233`).
- Trần phí: min của config/preflight/request (`manager.ts:674-684`).
- Runtime: validator từ chối field lạ + roundtrip, `Sequence` lấy ledger `current`
  có queue, verify NetworkID/key/chữ ký/fee/canonical, `SUBMIT_FAILED` phân loại
  `tem/tef/tel`, kiểm tra `server_info.network_id` trước mọi RPC.
- `client`: dedupe network theo id, Ledger mặc định XRPL-only, Xyra chỉ thêm khi
  dùng Xahau hoặc khai báo; test xác nhận cấu hình XRPL mặc định không đổi.
- Xyra giữ custom popup, mở trước cửa sổ trống; Xaman bind `force_network` cho
  OAuth/payload và kiểm tra endpoint; restore Xahau trả `null` (fail-closed).
- `switchNetwork` thêm guard session đổi giữa chừng; `outcomeUnknown` lấy từ
  adapter thay vì đoán.

## Tác động lên XRPL

| Nhóm | Ảnh hưởng | Rủi ro |
| --- | --- | --- |
| Dapp XRPL dùng `createWalletKit` mặc định | Danh sách ví, adapter config không đổi (có test) | Thấp |
| GemWallet trên XRPL | Đổi đường sign-only + trần phí ẩn 1 XRP (R3) | Trung bình |
| Adapter khai báo `supportedNetworks` / Standard wallet | Custom network bị chặn khi connect (R4, R5) | Trung bình |
| Adapter bên thứ ba không khai báo gì | Vẫn chạy mọi network family XRPL như cũ | Thấp |
| Người dùng CDN/IIFE | Bundle lớn hơn (R6) | Trung bình |
| Người dùng `core` trực tiếp | API thêm field tùy chọn, không phá vỡ | Thấp |
| UI | Modal lọc theo network, lỗi được bản địa hóa | Thấp |

Kết luận: không phá API XRPL, nhưng có 3 thay đổi hành vi (R3–R5) và 1 thay đổi
kích thước (R6) cần ghi CHANGELOG cho bản 0.2.0 thay vì 0.1.x patch.

## Độ mở rộng cho chain khác

Phù hợp tốt cho **mạng cùng họ rippled** (XRPL sidechain, Xahau fork, network có
NetworkID): `WalletChainFilter`, `WalletProtocol`, guard trong manager và
`lookupTransaction` theo RPC đều không biết tên chain.

Giới hạn hiện tại:

1. `WalletProtocol` mang mô hình XRPL: blob hex, `TransactionPayload` kiểu
   xrpl.js, `maxFeeDrops`, địa chỉ classic. Chain khác họ (Stellar, EVM) cần
   interface khác cho account, phí và tx, không chỉ thêm protocol.
2. Thêm một chain mới hiện phải sửa: client (`usesXahau`, `chainOptions`), 4
   adapter (max filter + wire mapping), và có thể UI/identity.
3. Đề xuất để thêm chain bằng "preset + runtime" mà không sửa adapter:
   - Đưa wire mapping vào metadata của network preset, ví dụ
     `network.providerHints = { xaman: "XAHAU", xyra: "xahau-mainnet",
     gemwallet: { chain: "XAHAU", network: "Mainnet" }, ledgerApp: "XAH" }`.
     Adapter đọc hint; thiếu hint thì từ chối network đó.
   - Client nhận plugin chain: `createWalletKit({ chains: [xahau()] })`, trong đó
     `xahau()` trả `{ networks, protocol, adapterDefaults }`. Giữ
     `network: "xahau-mainnet"` như alias tiện lợi.
   - Chọn protocol theo family + network (R7), và một helper legacy family (R9).

## Việc cần làm trước merge

1. Quyết định R1 (chặn lại hoặc thêm `expectedChainId`) và sửa tài liệu cho khớp.
2. Chuẩn hóa line ending (R2), xác nhận diff còn khoảng 1.1k dòng.
3. Test hồi quy GemWallet XRPL sign-only và custom XRPL network (R3–R5); ghi CHANGELOG.
4. Đo bundle IIFE (R6).
5. Chạy `npm.cmd run typecheck && npm.cmd test && npm.cmd run build:browser`
   và `node scripts/check-xahau-consumers.mjs`.
6. Live acceptance theo `docs/XAHAU_M0_LIVE_CHECKLIST.md`, đặc biệt Xyra trên
   Safari và Ledger (Payment/Invoke).
