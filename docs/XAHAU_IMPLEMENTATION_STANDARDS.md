# Implementation Standards — Xahau / Multi-chain Extension
*Dành cho Codex và engineer thực hiện M0-M2. Đọc toàn bộ trước khi viết dòng code đầu tiên.*

---

## Chốt triển khai - 2026-10-17

Các quyết định trong mục này thay thế các ví dụ cũ bên dưới khi có khác biệt.
Sau yêu cầu ghép nối của maintainer, code local đã có optional runtime tại
`packages/xahau`, contract protocol-neutral trong core và đường opt-in cho bốn
adapter. Console 5173 dùng chung cho hai chain/mainnet/testnet. Đây chưa phải
bản phát hành hoặc chứng nhận live acceptance. Các mục foundation/lab bên dưới
là lịch sử thiết kế; trạng thái mới nhất ở findings mục 17 và source.

M0 artifact evidence: xem [XAHAU_M0_FINDINGS.md](./XAHAU_M0_FINDINGS.md).
Published GemWallet API 3.8.0 trả chain/network/websocket, không có networkID trong
getNetwork response. Offline codec/provider-contract spike nằm riêng trong
scripts/spikes/xahau, không phải dependency hoặc runtime production.

- `undefined` criterion là không giới hạn; `[]` là deny-all. Filter `{}` cũng
  deny-all. Giao rỗng phải luôn deny-all, kể cả khi chỉ một chiều không khớp.
- `supportedNetworks` và `supportedChains`, nếu cùng tồn tại, được AND; metadata
  mới không được mở rộng legacy allowlist. Không có khai báo mới: mặc định family
  XRPL cũ, với legacy allowlist nếu có. Legacy `[]` là deny-all.
- Version là metadata compatibility, không phải authorization. Không so sánh
  version bằng chuỗi, không bump BaseWalletAdapter để đổi version mọi adapter cũ.
- Standard adapter map chain aliases qua network registry; lưu network IDs chính
  xác và derive family từ các preset đó. Prefix `xrpl:` không xác định family
  Xahau. Chưa map được thì không tự cho phép. Kiểm tra advertised chain còn hiệu lực.
- Manager gate connect, restore, recovery, switch và signing; modal chỉ là UI,
  dùng `manager.adapters.values()`, `getAdapter()` và network từ active account
  hoặc `getNetwork()`. Không dùng API giả `currentNetwork`/`Map.filter()`.
- Khai báo family không chứng minh wallet support, protocol runtime hoặc mode.
  Chỉ bật các adapter/method sau M0; không có ví dụ cấu hình Stellar/EVM nào
  đồng nghĩa kit đã có serializer hoặc transaction pipeline cho các chain đó.
- Family default XRPL cũ được tập trung tại helper compatibility. Không refactor
  các nhánh XRPL hiện hữu không liên quan chỉ để xóa mọi string literal.
- Browser globals chỉ dùng runtime tại browser boundary khi cần popup/extension;
  không truy cập ở module scope. Storage mới phải injected/SSR-safe. Không đổi
  toàn bộ arrays công khai cũ sang readonly nếu gây breaking change ngoài phạm vi.
- Test matrix phải gồm disjoint/empty intersections, mixed legacy/new metadata,
  exact Standard chain, direct manager calls, restore/recovery, network changes
  và preflight đổi capability. Unsupported wallet bị ẩn nhưng direct call vẫn bị chặn.
- Filter không mô tả được network x transaction-type x mode; capability đó là
  milestone kế tiếp, không dùng flat booleans để công bố Invoke/submit Xahau.

Code mẫu bên dưới là lịch sử thiết kế; implementation source và mục chốt này
là cơ sở acceptance cho foundation. Không copy lại helper `.length` cũ.

## 1. Quy tắc cứng (không được vi phạm)

```
1. Logic chain-aware mới trong manager/modal dùng WalletNetwork và filter,
   không thêm nhánh theo tên chain. Giữ fallback family XRPL cũ tập trung trong
   helper compatibility; không refactor nhánh XRPL hiện hữu ngoài phạm vi.

2. Không import type hoặc runtime từ @xrpl-wallet-kit/xahau vào packages/core,
   packages/ui, hoặc bất kỳ adapter nào.

3. Không mutate txJson đầu vào. Luôn structuredClone() trước khi chuẩn bị snapshot.

4. Không truy cập browser globals ở module scope. Browser boundary có thể dùng
   popup/extension API tại runtime; storage mới dùng WalletStorage injected.

5. Không throw Error() thuần. Dùng WalletKitError(WalletKitErrorCode.X, message).

6. Không có any trong code mới. Dùng unknown + type guard hoặc generic.

7. Array trong contract mới là readonly; không đổi contract cũ ngoài phạm vi.
```

---

## 2. Thay đổi `types.ts` — chính xác từng field

### 2.1 Thêm `WalletChainFilter` (type mới, thêm trước `WalletCapabilityDetails`)

```ts
/**
 * Declarative filter describing which networks an adapter can handle.
 * All specified criteria are ANDed. Omitting a criterion means "any value passes".
 * Used for UI filtering and pre-dispatch gating — no chain name literals in manager.
 */
export interface WalletChainFilter {
  /** Protocol family strings declared by WalletNetwork.family. */
  families?: readonly string[];
  /** Specific network preset IDs matching WalletNetwork.id. */
  networkIds?: readonly WalletNetworkId[];
  /** Network classification filter. */
  networkTypes?: readonly WalletNetwork["networkType"][];
}
```

### 2.2 Sửa `WalletCapabilityDetails` — thêm `supportedChains`

```ts
export interface WalletCapabilityDetails {
  supportedNetworks?: readonly WalletNetworkId[];   // giữ nguyên, backward compat
  supportedChains?: WalletChainFilter;              // THÊM MỚI
  supportedTransactionTypes?: readonly string[];
  supportedMethods?: readonly string[];
  transactionModes?: readonly WalletTransactionMode[];
}
```

### 2.3 Sửa `WalletAdapterApiVersion`

```ts
export type WalletAdapterApiVersion = "1.0" | "1.1" | "1.2" | (string & {});
//                                                              ↑ thêm "1.2"
```

Adapter khai báo `adapterApiVersion: "1.2"` khi implement `supportedChains`.
Không tự động bump version của adapter cũ.

---

## 3. Hàm `adapterSupportsNetwork` — pure function, vào `packages/core/src/utils.ts`

```ts
import type { WalletAdapter, WalletNetwork } from "./types";

/**
 * Returns true if the adapter declares support for the given network.
 * Pure function — no side effects, no manager state.
 *
 * Legacy network restrictions and new criteria are ANDed.
 * No new declaration defaults to the legacy XRPL family, independent of version.
 */
export function adapterSupportsNetwork(
  adapter: WalletAdapter,
  network: WalletNetwork
): boolean {
  const details = adapter.capabilities.details;

  const legacy = details?.supportedNetworks;
  if (legacy !== undefined && !legacy.includes(network.id)) return false;
  if (details?.supportedChains !== undefined) return matchesChainFilter(details.supportedChains, network);
  return getNetworkFamily(network) === LEGACY_NETWORK_FAMILY;
}
```

`matchesChainFilter`, `getNetworkFamily` và legacy constant nằm cùng utils.ts.
Không import SDK hoặc preset chain. Implementation đầy đủ tại source bao gồm
empty-list semantics và deny-all cho filter không có criterion.

---

## 4. Adapter config — constructor pattern

### 4.1 Adapter linh hoạt (Xaman, WalletConnect)

Constructor nhận `supportedChains?: WalletChainFilter`. Adapter ghi vào
`capabilities.details.supportedChains` nhưng **chỉ được thu hẹp xuống**,
không được mở rộng hơn `maxSupportedChains` nội bộ của adapter:

```ts
// Trong constructor của XamanAdapter:
private readonly _supportedChains: WalletChainFilter;

constructor(options: XamanAdapterOptions) {
  // Ví dụ sau M0 và protocol acceptance; KHÔNG bật giá trị này ở foundation.
  const ADAPTER_MAX: WalletChainFilter = { families: ["xrpl", "xahau"] };

  // dApp có thể thu hẹp nhưng không mở rộng
  const requested = options.supportedChains;
  this._supportedChains = requested
    ? intersectChainFilter(ADAPTER_MAX, requested)
    : ADAPTER_MAX;
}

get capabilities(): WalletCapabilities {
  return {
    connect: true,
    // ...
    details: {
      supportedChains: this._supportedChains,
      // ...
    },
  };
}
```

### 4.2 `intersectChainFilter` — helper cho adapter linh hoạt

```ts
// packages/core/src/utils.ts (hoặc trong adapter, không cần export từ core)
import { intersectChainFilter } from "@xrpl-wallet-kit/core";

const narrowed = intersectChainFilter(
  { families: ["xrpl"] },
  { families: ["xahau"] }
);
// narrowed.families = []; matcher từ chối mọi network, không wildcard.
```

### 4.3 Adapter có phạm vi cố định (XRPL Snap, GhostSig, Otsu)

Hardcode trong `capabilities`, constructor không nhận `supportedChains`:

```ts
get capabilities(): WalletCapabilities {
  return {
    connect: true,
    details: {
      supportedChains: { families: ["xrpl"] },  // cố định, không config
    },
  };
}
```

Ledger không thuộc nhóm kết luận XRPL-only này. Phải đánh giá theo model,
firmware, app XRP/XAH + version, network, transaction type, field set và mode.
Payment có NetworkID có thể khác hoàn toàn Payment có HookParameters hoặc Invoke.
M0 phải có ma trận Ledger riêng: xem XAHAU_M0_FINDINGS.md, mục Ledger.

Runtime kit hiện chưa bật Ledger Xahau là trạng thái implementation/acceptance,
không phải kết luận thiết bị không hỗ trợ. Không bắt buộc dùng XAH app khi chưa
kiểm tra đường XRP app. Capability theo network đơn thuần không đủ để cấp quyền
mọi transaction type; không mở Invoke chỉ vì Payment ký được.

### 4.4 `WalletStandardAdapter` trong `discovery.ts`

**Không sửa constructor.** Derive `supportedChains` tự động từ `wallet.chains`:

```ts
// chain() chuẩn hóa alias theo discovery.ts; không lấy family từ prefix.
const networks = (this.options.networks ?? DEFAULT_XRPL_NETWORKS).filter(network =>
  this.wallet.chains.some(item => chain(item) === chain(network.walletConnectChainId ?? ""))
);
details: {
  supportedNetworks: networks.map(network => network.id),
  supportedChains: {
    networkIds: networks.map(network => network.id),
    families: [...new Set(networks.map(getNetworkFamily))],
  },
  transactionModes: [...],
}

```

Chỉ chain được map trong registry mới đủ điều kiện filter. Không tự mở rộng
ra testnet/chain khác cùng family. Protocol readiness vẫn là điều kiện độc lập.

---

## 5. Modal/UI filter — không hardcode

```ts
// packages/ui/src/modal.ts — thay bất kỳ chỗ nào filter adapter bằng:
import { adapterSupportsNetwork } from "@xrpl-wallet-kit/core";

const network = manager.getAccount()?.network ?? manager.getNetwork();
const visibleAdapters = [...manager.adapters.values()].filter(adapter =>
  adapterSupportsNetwork(adapter, network)
);
```

Không được có `if (network.family === "xrpl")` hay `if (network.id === "mainnet")`
trong modal. Mọi phân nhánh phải qua `adapterSupportsNetwork`.

---

## 6. `adapterApiVersion: "1.2"` — khi nào khai báo

Khai báo `adapterApiVersion: "1.2"` khi adapter:
- Implement `supportedChains` trong `capabilities.details`, VÀ
- Constructor nhận `supportedChains` config (nếu là adapter linh hoạt)

Không tự ý bump adapter cũ lên `"1.2"` nếu không thêm `supportedChains`.
Manager không dùng version để phân nhánh logic — chỉ để dApp kiểm tra compatibility.

---

## 7. Yêu cầu test cho từng thay đổi

### 7.1 `adapterSupportsNetwork` unit test (không cần browser)

```
✓ Adapter không có supportedChains, không có supportedNetworks
  → pass nếu network.family = "xrpl", fail nếu network.family = "xahau"
✓ Adapter có supportedChains.families = ["xrpl", "xahau"]
  → pass cho cả hai family
✓ Adapter có supportedChains.families = ["xrpl"]
  → pass xrpl, fail xahau
✓ Adapter có supportedChains.networkIds = ["mainnet"]
  → pass network.id = "mainnet", fail network.id = "testnet" dù family đúng
✓ Adapter có supportedChains.networkTypes = ["MAINNET"]
  → pass networkType MAINNET, fail TESTNET
✓ Multi-criteria AND: families + networkIds + networkTypes đều phải pass
✓ Adapter có supportedNetworks = ["mainnet", "testnet"] (legacy)
  → pass nếu network.id trong list, fail nếu không
```

### 7.2 Narrowing helper hiện tại; constructor config sau M0

```
✓ intersectChainFilter({families: ["xrpl"]}, {families: ["xrpl","xahau"]})
  → chỉ giữ xrpl, không mở rộng maximum
✓ Giao families/networkIds/networkTypes không khớp → deny-all
✓ Empty criterion [], filter {}, hoặc empty legacy allowlist → deny-all
✓ Không mutate hoặc giữ alias tới các array caller truyền vào
```

Xaman/GemWallet/Xyra chưa nhận constructor config này. Chỉ thêm constructor
tests khi API thực sự được triển khai sau M0 evidence. Adapter cũ không bắt buộc
đổi interface hay thêm supportedChains chỉ để chạy foundation.

### 7.3 Modal filter test

```
✓ network = manager.getAccount()?.network ?? manager.getNetwork()
✓ Fixture legacy không khai báo → hiện trên XRPL, ẩn trên Xahau
✓ Fixture khai báo hai family → hiện khi đúng network/filter cho phép
✓ Thứ tự cấu hình wallets và giới hạn legacy vẫn được giữ
✓ networkChanged → modal re-filter ngay, không cần reload
```

Không dùng fixture để khẳng định official adapter đã hỗ trợ Xahau. Không bảo đảm
mọi ví đều hiện trên XRPL nếu config/allowlist của chính ví loại network đó.

Ledger không bị ẩn vĩnh viễn theo tên ví hoặc giả định XRP-only. Khi chưa có
runtime và capability đã nghiệm thu, nó có thể bị filter khỏi Xahau picker của
bản kit hiện tại. Khi Payment được nghiệm thu cho một app/version, UI có thể
hiện Ledger cho capability đó; Invoke/HookParameters vẫn bị gate độc lập nếu
chưa đạt. Test UI phải phân biệt hai trạng thái, không coi hidden là kết luận
về khả năng hardware.

---

## 8. Checklist trước khi submit PR

- [ ] Không thêm nhánh tên chain vào logic manager/modal mới; giữ compatibility
      fallback tập trung, không sửa các nhánh XRPL cũ ngoài phạm vi
- [ ] `adapterSupportsNetwork` là pure function, không import bất kỳ chain preset nào
- [ ] Test pass/fail family, network ID và network type; multi-criteria AND,
      criterion undefined/[], filter {}, disjoint intersection và mixed legacy/new metadata
- [ ] `WalletStandardAdapter.capabilities.details.supportedChains` được derive
      từ `wallet.chains`, không hardcode
- [ ] `intersectChainFilter` không mở rộng maximum, không mutate/alias caller arrays
- [ ] Direct manager calls bị gate, không chỉ UI; test missing/unsupported network
      events và cancellation; switch metadata mismatch thống nhất NETWORK_NOT_SUPPORTED
- [ ] Typecheck pass: `npm run typecheck`
- [ ] Existing tests pass: `npm test`
- [ ] Trước commit/PR: `npm run build:browser` theo CLAUDE.md; không thay bằng website build
- [ ] Adapter cũ (Ledger, GhostSig, Otsu, DropFi, Crossmark) không bị thay đổi
      interface, chỉ có thể thêm `supportedChains` vào capabilities hardcoded

---

## 9. File cần đụng — danh sách tối thiểu cho M1

```
packages/core/src/types.ts
  → Thêm WalletChainFilter, sửa WalletCapabilityDetails, thêm "1.2" vào version

packages/core/src/utils.ts
  → Thêm adapterSupportsNetwork(), thêm intersectChainFilter() nếu cần share

packages/core/src/discovery.ts
  → Sửa WalletStandardAdapter.capabilities getter: thêm supportedChains

packages/ui/src/modal.ts
  → Thay filter logic bằng adapterSupportsNetwork()

packages/adapters/xaman/src/index.ts
  → Nhận supportedChains từ constructor config (sau M0 xác nhận Xahau support)

packages/adapters/gemwallet/src/index.ts
  → Chỉ sau M0 xác minh chain/network/websocket và trusted endpoint identity trên released API/extension

packages/adapters/*/src/index.ts (XRPL Snap, GhostSig, Otsu, Crossmark, DropFi)
  → Thêm supportedChains: { families: ["xrpl"] } vào capabilities — không đổi gì khác

packages/adapters/ledger/src/index.ts và device-app.ts
  → M0 audit/test riêng XRP app và XAH app theo transaction/field/mode; không hardcode XRPL-only như kết luận support
```

**Không được sửa:** packages/auth, packages/browser entrypoint, packages/client,
packages/next. Không sửa nếu không có lý do cụ thể liên quan đến chain filter.

---

## 10. Điều Codex không được tự quyết

- Không tự chọn tên chain string khác ngoài `"xrpl"` và `"xahau"` cho Xahau preset
- Không tự đặt default `maxSupportedChains` cho adapter mà chưa có M0 evidence
- Không tự thêm Xahau vào capabilities của GemWallet trước khi xác minh chain,
  network và trusted endpoint identity của released extension; không yêu cầu
  networkID trong getNetwork response khi published API không khai báo field này
- Không tự commit/publish hoặc build website trong phát triển. Dùng focused tests
  và typecheck; trước commit/PR được yêu cầu chạy typecheck, test, build:browser
  theo CLAUDE.md. Browser validation không phải website build hoặc npm publish.
- Không sửa tests của adapter khác để make them pass — fix root cause thay vì workaround test
