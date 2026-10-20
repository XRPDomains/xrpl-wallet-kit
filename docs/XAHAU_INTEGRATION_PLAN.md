# XRPL Wallet Kit: Xahau Integration Plan

| Thuộc tính | Giá trị |
| --- | --- |
| Trạng thái | Local opt-in implementation theo yêu cầu; chưa phát hành |
| Ngày | 2026-10-16 |
| Cập nhật sau review | 2026-10-17; đã nối runtime/4 adapter vào console chung; acceptance thực tế do maintainer kiểm chứng |
| Baseline | XRPL Wallet Kit 0.1.23 |
| Đối tượng | Maintainer, reviewer kiến trúc/bảo mật, developer dApp và người kiểm thử ví |
| Quyết định cần chốt | Phạm vi MVP, ranh giới protocol, thứ tự adapter và release gates |

## Bằng chứng M0 mới nhất

Xem [XAHAU_M0_FINDINGS.md](./XAHAU_M0_FINDINGS.md) và private spike tại
`scripts/spikes/xahau`. Runtime hiện nằm ở `packages/xahau`; core chỉ giữ contract
protocol-neutral. Local 5173 chọn XRPL/Xahau mainnet/testnet, lọc ví và dùng
adapter chính, không còn màn lab riêng. Các mục thiết kế lịch sử phía dưới phải
đọc cùng trạng thái mới nhất tại mục 17 của findings; không coi code local là
bằng chứng live wallet/hardware acceptance hay bản npm đã phát hành.

Điều chỉnh quan trọng: published GemWallet API 3.8.0 trả chain/network/websocket,
không có networkID trong getNetwork response. Phải validate bằng chứng đó cùng
trusted preset/RPC identity, không yêu cầu một field API không khai báo. Xyra SDK
0.3.0 xác nhận explicit preset strings nhưng import không SSR-safe. Các góp ý
gốc về networkID bên dưới là lịch sử, không phải điều kiện nghiệm thu hiện hành.

## Kết luận đối chiếu review - 2026-10-17

Các khối `[REVIEW]` bên dưới được giữ nguyên làm lịch sử góp ý, **không phải
quyết định kỹ thuật đã duyệt**. Khi có khác biệt, áp dụng kết luận trong mục này.
Phê duyệt cập nhật tài liệu không đồng nghĩa phê duyệt code, release hoặc giao dịch.

### Những điểm tiếp thu

- Chốt điểm inject protocol trước M1, nhưng core chỉ phụ thuộc contract hẹp,
  không import kiểu `XahauProtocol` từ package Xahau. Chọn package/version bằng
  spike M0; không coi tên `xahau-client` hay thông tin maintainer trong góp ý
  là đã xác minh. Đánh giá codec chính thức và dependency thực tế.
- Không dùng global definitions mutation. Closure bọc một import singleton không
  tự tạo isolation; phải chứng minh hai runtime độc lập bằng kiểm thử đồng thời.
  Ưu tiên definitions đóng gói, tương thích phiên bản; không lấy definitions chưa
  kiểm chứng từ endpoint tùy ý vào thời điểm ký.
- Có preset family/asset/networkId rõ ràng, codec vectors từ M0 và chain context
  bắt buộc ở Xahau connect/restore/request/event. Kiểm tra runtime thay vì đổi
  `WalletAccount.network` thành required toàn cục gây ảnh hưởng custom adapter cũ.
- Auth cần expected-chain validation, challenge chain-bound và atomic nonce.
  Identity/explorer phải được gate theo chain và policy dịch vụ, không chỉ tên Mainnet.
- Cần chỉ định người review và live acceptance trước khi đóng milestone tương ứng.
  Không yêu cầu đủ người test Ledger/M5 mới được bắt đầu spike M0 không broadcast.

### Các nhận định được điều chỉnh

| Góp ý | Kết luận áp dụng |
| --- | --- |
| Manager mặc định ghi đè localStorage | Core mặc định dùng MemoryWalletStorage riêng. Collision xảy ra khi các manager dùng chung storage/key hoặc browser prefix. Chốt namespace theo instance/chain ở M0; vẫn kiểm tra trường hợp nhiều manager cùng family |
| History phân tách bằng numeric 21337/0 | `transactionNetworkId()` hiện ưu tiên `account.network.id`, ví dụ xahau-mainnet/mainnet, không phải numeric networkId. Giữ ID duy nhất và kiểm tra custom network collision; không mặc định mọi history case đều an toàn |
| HookParameters tương ứng HookHash/HookNamespace/HookOn | Đây là các nhóm field khác nhau. Parameter name/value là hex blobs, giới hạn tương ứng 32/256 bytes theo docs. Không dùng quy tắc HookOn 8 byte cố định; tài liệu hiện mô tả Hash256. Pin definitions/version trong vectors |
| Phí 10 drops/instruction và default 2 XAH | Chưa đủ bằng chứng để áp dụng công thức hoặc default này. Bắt buộc dApp đặt ceiling tường minh cho Xahau MVP, estimate bằng transaction-aware RPC; quyết định default sau số liệu M0 nếu thực sự cần |
| GemWallet chắc chắn trả networkID | Artifact API 3.8.0 khai báo chain/network/websocket, không có networkID trong getNetwork response. Validate chain + network + trusted endpoint/RPC ID; Mainnet/Testnet string riêng lẻ không đủ. Live extension behavior vẫn cần nghiệm thu |
| Dùng xahau:21337 như chuẩn CAIP chung | Chưa chốt namespace chuẩn. Xây bảng mapping riêng cho internal network ID, numeric NetworkID, provider selector, auth chain string và Wallet Standard/WalletConnect. Auth dùng chuỗi đã thống nhất với backend, không suy ra transport support từ hình thức chuỗi |
| Envelope phải thêm family và mặc định bản cũ là xrpl | Chưa quyết định schema bump. Ưu tiên network identity đã xác minh, resolve qua registry và migration có kiểm chứng. Session thiếu identity không được âm thầm gán XRPL, nhất là custom network; yêu cầu reconnect khi không thể xác minh |

### Quy tắc phí và submit sau review

Đánh dấu hoặc cảnh báo "fee not kit-protected" không đủ điều kiện để bật
sign-and-submit Xahau ở MVP. Nếu provider autofill/submit bên trong ví mà kit
không bảo đảm được fee ceiling trước broadcast, mode đó bị tắt. Khi sign-only
được hỗ trợ, xác minh blob và fee trước bước submit tường minh. Kiểm tra sau
broadcast không thể ngăn mức phí đã bị chi tiêu.

### Deliverables bắt buộc của M0

1. Ghi package/version/license, codec/definitions strategy và contract injection
   nhỏ nhất; chứng minh XRPL-only không phải tải runtime Xahau.
2. Vectors Payment, Invoke với HookParameters và Payment có HookParameters;
   encode/sign/decode/verify, negative vectors, không bỏ field và không nhiễu runtime.
   SetHook vẫn ngoài phạm vi MVP.
3. Bảng network mapping và bằng chứng chain của từng provider trên bản phát hành;
   xác minh cả connect, restore, ký và provider network-change behavior.
4. Thiết kế namespace/session migration và expected-chain auth validation, kèm
   test plan cho hai manager, legacy/custom networks và callback muộn.
5. Bảng capability theo network/type/mode, fee-autofill behavior, mức phí đo được
   trên testnet và đường chặn mode không bảo vệ được trước broadcast.
6. Báo cáo go/no-go, cohort đủ điều kiện, người phụ trách các gate kế tiếp và ước
   lượng lại. Không tự chạy mainnet hoặc publish từ kết quả spike.

Nguồn đối chiếu field: [Hook parameters](https://xahau.network/docs/hooks/concepts/parameters/),
[SetHook field reference](https://xahau.network/docs/protocol-reference/transactions/transaction-types/sethook/).
Thông số protocol phải được xác minh lại theo version/definitions đã chọn trong M0.

## Tóm tắt dành cho reviewer

Đề xuất mở rộng kit hiện tại bằng module Xahau opt-in, giữ nguyên defaults và
API XRPL hiện có. Không fork kit hoặc viết lại thành framework multichain.
Tái sử dụng modal, React/Vue bindings và lifecycle; tách phần codec, chuẩn bị
giao dịch, phí và xác minh kết quả theo protocol.

Ưu tiên Xaman, GemWallet và Xyra, mỗi ví có capability được kiểm chứng riêng.
Crossmark cần compatibility spike; Ledger cần ma trận app XRP/XAH và từng lệnh từ M0. Không
coi ví hỗ trợ Xahau là bằng chứng adapter hiện tại đã hỗ trợ Xahau.

Tài liệu gồm ma trận bằng chứng upstream, kế hoạch kỹ thuật, work breakdown,
nghiệm thu, rủi ro, tương thích và câu hỏi review. Đây chưa phải implementation
spec với public API đã chốt; đề xuất duyệt spike trước khi triển khai toàn bộ.

Research date: 2026-10-16. Proposal only; no adapter is newly enabled by this document.

## Decision

Keep one kit and existing XRPL defaults. Add an explicit, optional Xahau protocol
module with mainnet/testnet presets, chain-aware transaction handling and reuse
of existing framework bindings. Wallet support, provider API support, local kit
implementation and successful live acceptance are separate milestones.

## Adapter Matrix

| Adapter | Evidence | Current kit gap | Planned scope |
| --- | --- | --- | --- |
| Xaman | Official OAuth docs expose XAHAU/XAHAUTESTNET forced networks | Bind login and every signing request to the requested chain; replace XRPL-only decoding for Xahau | P1: first mobile wallet |
| GemWallet | Official extension source defines XAHAU mainnet 21337 and testnet 21338 | Current provider typing/normalization retains network name but not sufficient chain identity; inspect released API fields and reject ambiguous Mainnet/Testnet | P1: first extension wallet, conditional on released API verification |
| Xyra | Official developer docs explicitly support XRPL/Xahau mainnet/testnet and sign-only/submit | Current adapter intentionally accepts only XRPL mainnet/testnet; verify exact Xahau wire identifiers and use chain-aware result verification | P1: first web wallet; retain experimental status until live acceptance |
| Crossmark | Installed official @crossmarkio/typings 0.0.6 includes Xahau network types, labels and network identity; official docs describe custom networks | Current adapter assigns requested network without proving the provider's actual chain; verify SDK request selectors, response identity and released wallet behavior | P2: compatibility spike, then enable only passing methods |
| Ledger | XRP app source recognizes Network ID; XAH app also exists. Neither proves all Xahau transactions work on installed hardware | Audit/test XRP and XAH apps by model/version, transaction type, fields and mode; kit preparation/codec must preserve NetworkID and intent | M0: per-transaction matrix; P2: enable only verified combinations, Payment first |
| WalletConnect | Transport accepts negotiated chains; no specific Xahau wallet/session verified in this audit | A chain ID string is not wallet support; require an actual wallet approving the exact chain, accounts and methods | P3: conditional, not advertised at launch |
| MetaMask XRPL Snap | Official Peersyst docs cover XRPL; no explicit Xahau guarantee found | Current chain mapping only includes 0/1/2; inspect actual stored networks and codec before any expansion | Deferred; custom RPC alone is insufficient |
| DropFi | Official provider supports switching networks; no explicit Xahau guarantee found | Current capabilities list XRPL mainnet/testnet/devnet; obtain provider confirmation and chain-aware replies | Deferred |
| Otsu | Official README lists XRPL mainnet/testnet and XRPL EVM sidechains, not Xahau | Current provider and kit normalization do not establish Xahau compatibility | Deferred |
| GhostSig | Official SDK documents XRPL mainnet/testnet/devnet and Stellar, not Xahau | Current adapter explicitly restricts XRPL presets; upstream protocol/network support needed | Deferred |

Absence of explicit evidence means unverified, not proof a wallet can never
support Xahau. Source-tree capability is not proof of a released extension/API.
Wallet Standard discovery is a conditional integration path, not an additional
wallet: require actual advertised chain/account/features and chain-aware checks.

## P0: Shared Foundation

- Optional @xrpl-wallet-kit/xahau module. Evaluate official xahau codec/client
  packages; isolate protocol operations without global definition mutation or
  replacing the existing XRPL dependency contract.

  > **[REVIEW — codec package decision, required before M0 spike]:**
  > Candidates are `xahau-client` (npm, Xahau Foundation maintained) and the
  > Xahau fork of xrpl.js. Do NOT write a custom serializer. Audit: npm version,
  > license (MIT/ISC), browser/ESM compatibility, SSR safety, whether it mutates
  > global `definitions` singletons. If it does mutate globals, the module MUST
  > run in an isolated closure; two simultaneous manager instances (XRPL + Xahau)
  > must not corrupt each other's encode output. Confirm in M0 spike, document
  > the chosen package name and version in the audit evidence before proceeding.
  > The `WalletNetwork.definitionsUrl` field exists but requires a runtime fetch —
  > for Xahau, prefer bundled definitions over a network-dependent fetch at sign time.

- Presets xahau-mainnet/xahau-testnet with XAH units, explorer and RPC identity.
  NetworkID 21337/21338 must be present in the prepared snapshot; reject conflicts
  before wallet dispatch. Validate the configured RPC network_id as well.

  > **[REVIEW — `WalletNetwork` mapping, actionable]:**
  > `WalletNetwork` in `types.ts` already has `networkId?: number` — set it to
  > `21337` (mainnet) and `21338` (testnet) in the Xahau presets. Also set
  > `family: "xahau"` (the field is typed as `"xrpl" | string` — Xahau simply
  > uses a different family string). All capability gating, UI chain labels,
  > XRPName conditional resolution, and explorer links MUST branch on
  > `network.family === "xahau"` — not on `networkId` alone, since custom XRPL
  > networks can have arbitrary IDs too. Use `nativeAsset: "XAH"` and
  > `nativeAssetDecimals: 6` (drops, same as XRP).
  >
  > **`WalletManagerConfig` currently has no `protocol` or `protocolModule` field.**
  > The Xahau module needs an injection point — propose adding
  > `protocol?: XahauProtocol` (or similar) to `WalletManagerConfig` as an
  > opt-in. This is the M0 API design decision that must be chekced by reviewer
  > before implementation begins.

- Encode/decode, signing-intent comparison, signature/hash verification and
  submission confirmation must all use the selected protocol.

  > **[REVIEW — HookParameters test vectors, required for M0]:**
  > HookParameters have byte-level constraints that differ from standard XRPL
  > fields: HookHash (32 bytes), HookNamespace (32 bytes), HookOn (8 bytes bitmask).
  > Before claiming codec correctness, prepare at minimum three sign-and-verify
  > test vectors: (1) Payment with no Hooks, (2) Invoke with HookParameters, (3)
  > SetHook is out of scope MVP but the codec must not silently drop HookParameters
  > fields from other tx types. Vectors must round-trip: encode → sign → decode →
  > verify intent. Add these to the automated test suite at M0, not M3.

- Estimate fees using the transaction-aware fee RPC, including Hooks execution,
  with a mandatory configured ceiling. Do not blindly reuse XRPL base fees.

  > **[REVIEW — fee ceiling concrete value, required for dApp config docs]:**
  > Hooks base execution fee is currently ~10 drops/instruction, commonly
  > 1,000–100,000 drops per Hook depending on complexity. Recommend default ceiling
  > of **2,000,000 drops (2 XAH)** for Invoke transactions; expose as
  > `preflight.maxFeeDrops` (already in `TransactionPreflightPolicy`). Document
  > that dApps with complex multi-Hook flows MUST configure a higher explicit ceiling
  > — the default must be low enough to protect users but not so low it blocks
  > legitimate Invoke txs. Provider autofill overriding the ceiling is the highest
  > fee-attack vector: if a provider cannot guarantee the fee stays within ceiling
  > post-autofill, the mode must be flagged as "fee not kit-protected" in
  > capabilities, and sign-only + manual submit should be the recommended path.

- Derive per-network capabilities. Unsupported adapters fail before approval;
  do not infer support from a successful address query.
- Isolate sessions, transaction history, cache and auth challenges by chain.
  Switching chains cancels pending work and cannot reuse stale approvals.

  > **[REVIEW — storage namespace collision, concrete bug to fix before M1]:**
  > `createBrowserWalletStorage` in `storage.ts` uses a hardcoded prefix
  > `"xrpl-wallet-kit."`. A Xahau `WalletManager` instance using the same
  > default storage will write to the same `xrpl-wallet-kit.session` key as an
  > XRPL manager — last write wins, silently corrupting both sessions.
  >
  > **Required fix:** The `@xrpl-wallet-kit/xahau` module must either:
  > (a) Auto-inject storage prefix `"xrpl-wallet-kit.xahau."` when constructing
  >     the Xahau manager, OR
  > (b) Require the dApp to pass `storage: createBrowserWalletStorage("xrpl-wallet-kit.xahau.")`
  >     explicitly — document this as a required config item.
  >
  > Option (a) is safer for dApp developers; option (b) is more explicit for
  > reviewers. This must be decided before the session isolation claim can be made.
  > Tx history keys `xwk_tx:${networkId}:${address}` are naturally isolated by
  > `networkId` (21337 vs 0) — no change needed there.

- Show XAH, explicit chain and correct explorer. Do not automatically reuse
  XRPL-specific identity/profile services on Xahau.

  > **[REVIEW — XRPName / identity conditional, must be gated on `family`]:**
  > The kit currently auto-resolves XRPName / XRP Domains on connect. XRPL and
  > Xahau share the same address byte format — a `.xrp` domain registered on XRPL
  > for address `rABC...` is XRPL-specific. Showing it for the same address on a
  > Xahau connection is misleading and incorrect.
  >
  > **Required:** XRPName resolution, avatar fetch, and any XRPL identity service
  > calls MUST be gated on `network.family === "xrpl"` (or `network.id` being an
  > XRPL preset). On Xahau, the kit must show the raw address or a Xahau-native
  > identity service if one exists — not the XRPL .xrp domain. This applies to:
  > connect button label, Account Panel header, recent tx sender/receiver display.

## P1: Initial Wallet Cohort

Implement Xaman, GemWallet and Xyra sequentially against the same acceptance
contract. Start with XAH Payment sign-only and explicit submit. Add TrustSet,
OfferCreate/OfferCancel and Invoke/HookParameters only when that wallet's exact
method, codec and live behavior pass. A wallet may ship a smaller capability set.

For GemWallet, a plain Mainnet/Testnet label is ambiguous between chains. Require
chain/network ID or an authoritative endpoint and reject ambiguity. If the
released API cannot prove chain identity, defer it rather than guess.

> **[REVIEW — GemWallet specific API field, actionable]:**
> GemWallet's `getNetwork()` (source:
> `gemwallet-extension/.../getNetwork/getNetwork.ts`, listed in references)
> returns an object that includes `networkID: number`. Xahau mainnet returns
> `21337`, Xahau testnet `21338`. This is the authoritative proof field —
> **do not accept a string label** ("Mainnet"/"Testnet") as chain identity.
> Before enabling GemWallet for Xahau, confirm the integer `networkID` is
> present in the released extension API (not just source), matches the
> configured preset, and is validated before `setSession()`. If `networkID`
> is absent or `0`/`1` (XRPL values), reject and throw `AmbiguousNetworkError`.
>
> **[REVIEW — `formatAuthMessage` chain field already exists]:**
> `packages/auth/src/message.ts` already includes `chainId` in `formatAuthMessage`
> (line 38). For Xahau auth flows, pass `chainId: "xahau:21337"` (CAIP-2 style)
> in `WalletAuthMessageParams`. The server's `validateAuthMessage` must then
> check `parsed.chainId === "xahau:21337"` for Xahau sessions and reject
> cross-chain replays (an XRPL-signed message must not authenticate a Xahau session
> and vice versa). Add `expectedChainId` to `WalletAuthValidationOptions`.

## P2: Extension And Hardware Expansion

Crossmark spike first: inspect installed SDK network selector and live identity,
then test Payment and Invoke independently. Keep disabled until the spike passes.

Ledger: begin the XRP-app/XAH-app compatibility matrix in M0, including Payment
with NetworkID, Payment with HookParameters, Invoke alone and Invoke with
HookParameters. Audit exact app identity/version, model/firmware, APDU behavior,
derivation path, parser coverage and device review. Neither require XAH app nor
assume XRP app supports every Xahau type. Production enablement remains a later
hardware milestone. Reuse transports/cancellation and request only the app
validated for that combination; no Ledger Live desktop runtime dependency.
Hardware acceptance is required before advertising each method/field/mode.

## Acceptance And Exclusions

- Testnet: connect, correct chain, sign-only without broadcast, explicit submit
  through validation, reject/cancel/timeout and chain changes during signing.
- Negative cases: missing/conflicting NetworkID, substituted intent, incorrect
  hash/signature, ambiguous network, excessive fee and Hook rejection.
- Mainnet: user-approved low-value acceptance after testnet; record wallet/API
  and hardware versions, network and exact supported methods.
- Existing XRPL behavior and defaults remain covered by regression tests.
- No initial Batch, NFT, multisign, SetHook deployment, bridge or Burn2Mint
  claims. Each needs separate protocol and wallet acceptance.
- No release/build/commit is authorized merely by approval of this proposal.

## Primary References

- Xaman OAuth: https://docs.xaman.dev/environments/identity-oauth2-openid
- GemWallet source: https://github.com/GemWallet/gemwallet-extension/blob/master/packages/constants/src/network/network.constant.ts
- GemWallet network API: https://github.com/GemWallet/gemwallet-extension/blob/master/packages/api/src/getNetwork/getNetwork.ts
- Xyra: https://www.xyra.now/developers
- Crossmark: https://docs.crossmark.io/ ; local evidence: node_modules/@crossmarkio/typings/build/src/schema/v2/networks/xahau.d.ts and schema/v4/index.d.ts
- Ledger: https://github.com/LedgerHQ/app-xah ; Makefile declares XAH app identity
- GhostSig SDK: https://jsr.io/@ghostsig/sdk
- Otsu: https://github.com/RomThpt/otsu-wallet
- DropFi: https://www.dropfi.app/docs/dropfi-web-injection-script
- XRPL Snap: https://github.com/Peersyst/xrpl-snap
- Xahau signing/fees: https://xahau.network/docs/features/transaction-signing/
- Xahau protocol fields: https://xahau.network/docs/protocol-reference/transactions/transaction-common-fields/

## Tổng thể sản phẩm và phạm vi MVP

Mục tiêu là dApp dùng cùng kit để chọn XRPL hoặc Xahau mà không phải tự nối
nhiều provider, đồng thời giữ an toàn về chain, intent, phí và trạng thái submit.
Không lấy số lượng ví hiển thị làm tiêu chí thành công.

| Hạng mục | Phạm vi | Điều kiện |
| --- | --- | --- |
| Network | Xahau mainnet/testnet | Opt-in; không thay nghĩa các ID XRPL cũ |
| Account | Connect/disconnect/restore | Chain được xác minh, không chỉ khớp địa chỉ |
| Payment | Chuyển XAH | Acceptance đầu tiên cho mỗi ví |
| Token/DEX | TrustSet, OfferCreate, OfferCancel | Mở từng lệnh/mode sau kiểm thử |
| Hooks | Invoke, HookParameters | Codec, phí, wallet approval và kết quả đều đạt |
| Framework | UI, React, Vue và entry SSR liên quan | Dùng lại manager; không nhân đôi state |
| Developer tools | Console test chung port 5173 | Không tạo thêm bản test/clone |

Ngoài phạm vi MVP: Batch, NFT, multisign, SetHook/WASM deployment, bridge,
Burn2Mint, Hook compiler/IDE, tự chuyển tài sản cross-chain và XRPName trên Xahau.
Các lệnh ngoài phạm vi bị chặn rõ ràng, không generic passthrough bỏ qua verification.

## Adapter contract extension: `supportedChains` filter

> Chốt 2026-10-17: đọc mục "Chốt triển khai" trong
> [XAHAU_IMPLEMENTATION_STANDARDS.md](./XAHAU_IMPLEMENTATION_STANDARDS.md).
> Các snippet trong phần này là lịch sử thiết kế, không copy làm implementation.
> Filter rỗng deny-all; legacy/new declarations AND; version không cấp quyền;
> Standard map qua registry, không derive family bằng namespace prefix.
> Ví dụ Stellar/EVM chỉ minh họa metadata, không cam kết kit hỗ trợ protocol đó.

Foundation đã có code local: types/helpers, manager guards, Standard exact-network
mapping và modal filtering. Có tests cho empty/disjoint intersections, legacy AND,
direct calls, restore/recovery, identity mismatch, switch/sign cancellation và UI.
Chưa bật Xahau cho official adapter, chưa hoàn tất codec/fees/provider spike M0.
Chưa thêm constructor config vào adapter linh hoạt; helper narrowing sẵn sàng
để dùng khi có M0 evidence. Không có commit/build website/release tự động.

### Vấn đề

`WalletCapabilities` hiện tại là flat boolean — không có cơ chế để adapter
tuyên bố nó hỗ trợ chain nào, ở phạm vi nào. Nếu dùng `families: string[]`
đơn thuần thì manager vẫn phải `if family === "xrpl"` — hardcode tên chain
vào logic lõi, mỗi lần thêm chain mới phải sửa manager.

**Mục tiêu:** manager không biết gì về tên chain cụ thể. Mọi quyết định
hiển thị / filter / gating đều do adapter tự khai báo, manager chỉ đối chiếu
generic.

### Thiết kế: declarative multi-criteria filter

#### Bước 1 — Thêm `WalletChainFilter` và `supportedChains` vào `types.ts`

```ts
/**
 * Declarative filter describing which networks an adapter can handle.
 * All specified criteria are ANDed. Omitting a criterion means "any value passes".
 * Manager uses this for UI filtering and pre-dispatch gating — no chain names
 * are hardcoded in manager logic.
 */
export interface WalletChainFilter {
  /** Protocol family strings: "xrpl", "xahau", or any future family. */
  families?: readonly string[];
  /** Specific network preset IDs: "mainnet", "xahau-mainnet", "testnet", etc. */
  networkIds?: readonly WalletNetworkId[];
  /** Network classification: MAINNET, TESTNET, DEVNET, CUSTOM. */
  networkTypes?: readonly WalletNetwork["networkType"][];
}

export interface WalletCapabilityDetails {
  supportedNetworks?: readonly WalletNetworkId[];  // kept for backward compat
  supportedChains?: WalletChainFilter;             // NEW — replaces ad-hoc family checks
  supportedTransactionTypes?: readonly string[];
  supportedMethods?: readonly string[];
  transactionModes?: readonly WalletTransactionMode[];
}
```

#### Bước 2 — Hàm match generic trong manager (không hardcode tên chain)

```ts
// packages/core/src/manager.ts (hoặc utils)
function adapterSupportsNetwork(
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

Manager gọi `adapterSupportsNetwork(adapter, selectedNetwork)` — không bao giờ
`if family === "xrpl"`. Khi thêm chain mới, chỉ adapter cần cập nhật config.

#### Bước 3 — Adapter khai báo `supportedChains` trong constructor config

Config của adapter là nguồn sự thật. Adapter nhận từ constructor và ghi vào
`capabilities.details.supportedChains`. Hai loại adapter:

**Adapter linh hoạt** — dApp có thể thu hẹp phạm vi, không thể mở rộng hơn
khả năng thực tế của wallet:

```ts
// Xaman: hỗ trợ cả hai family, nhưng dApp chỉ muốn Xahau
new XamanAdapter({
  apiKey: "...",
  supportedChains: { families: ["xahau"] },  // thu hẹp từ ["xrpl","xahau"]
})

// WalletConnect: giới hạn chỉ mainnet và testnet, không devnet
new WalletConnectAdapter({
  projectId: "...",
  supportedChains: {
    families: ["xrpl"],
    networkTypes: ["MAINNET", "TESTNET"],
  },
})
```

**Adapter cố định** — chain support là thuộc tính của wallet, không configurable:

```ts
// Ledger: capability Xahau chưa bật ở runtime kit hiện tại.
// M0 kiểm tra XRP/XAH app riêng theo lệnh; không suy hardware là XRPL-only.
// Constructor config không được mở quyền cho lệnh chưa được nghiệm thu.

// GemWallet: khai báo ["xrpl","xahau"] sau khi M0 spike xác nhận released API
new GemWalletAdapter()
// → capabilities.details.supportedChains = { families: ["xrpl","xahau"] }
```

#### Bước 4 — UI filter không hardcode

Modal đọc `adapterSupportsNetwork(adapter, currentNetwork)` để build danh sách:

```ts
const network = manager.getAccount()?.network ?? manager.getNetwork();
const visibleAdapters = [...manager.adapters.values()].filter(a =>
  adapterSupportsNetwork(a, network)
);
```

Adapter không hỗ trợ chain đang chọn → ẩn hoàn toàn. Không grayed-out,
không tooltip "coming soon" — ẩn hẳn để tránh confusion.

Khi user chuyển chain → modal re-filter tự động qua cùng hàm, không cần
branch logic theo tên chain.

#### Bước 5 — `adapterApiVersion: "1.2"` đánh dấu chain-aware

Adapter khai báo `"1.2"` khi implement contract mới. Manager gate theo metadata,
không dùng version làm quyền hỗ trợ chain hoặc so sánh version bằng chuỗi.

### Ví dụ mở rộng chain tương lai

Thêm XRPL EVM sidechain hoặc Stellar (GhostSig):

```ts
new GhostSigAdapter({
  supportedChains: { families: ["xrpl", "stellar"] },  // ví dụ future
})
```

Đây chỉ là minh họa filter tương lai, không phải API GhostSig hiện có. Stellar/EVM
cần protocol runtime, provider mapping và acceptance riêng; đổi config không đủ
để ký giao dịch. Không nằm trong phạm vi mở rộng Xahau này.

### Ghi chú triển khai cho M1

- Foundation local đã có WalletChainFilter, matcher/intersection, manager guards,
  exact-network mapping cho Wallet Standard và modal filtering.
- Filter rỗng deny-all; legacy và new declarations AND; version không cấp quyền.
- Chưa thêm constructor supportedChains cho Xaman/GemWallet/Xyra. M0 phải xác minh
  provider/protocol trước; Ledger và các adapter XRPL cũ giữ fallback compatibility.
- Manager gate mọi wallet entrypoint liên quan; modal dùng active account network
  hoặc getNetwork(), không có API currentNetwork.
- Test matrix bao gồm các chiều network/filter, empty/disjoint/mixed declarations,
  direct calls, restore/recovery, provider events và switch/sign cancellation.
- Unsupported switch target thống nhất NETWORK_NOT_SUPPORTED. Chain-aware events
  thiếu network bị revoke session với NETWORK_MISMATCH; ghi trong adapter contract.

## Kiến trúc và ranh giới trách nhiệm

### Nền tảng hiện có và khoảng cách

`WalletNetwork` đã có family, asset, custom ID, RPC, networkId, definitionsUrl và
explorer. Registry, cancellation, request lifecycle và framework bindings có thể
tái sử dụng. Tuy nhiên có decode/encode và multisign helpers đang dùng `xrpl`;
metadata definitionsUrl không chứng minh dynamic codec đã hoàn chỉnh.

Cần rà soát fallback explorer, nhãn XRP, balance, identity và adapter gán network
theo yêu cầu dApp thay vì xác minh network thật của provider.

### Ownership

| Thành phần | Trách nhiệm |
| --- | --- |
| Core | Session/lifecycle/request control, protocol routing và capability gating |
| Module Xahau opt-in | Preset, codec, prepare, phí, verification và RPC normalization |
| Adapter | Network selection/proof, provider dispatch và chuẩn hóa reply |
| UI/framework | Chain/asset/capability đúng; dùng chung state của manager |
| Backend dApp | Policy nghiệp vụ, challenge/replay protection và cấp auth session |

Thiết kế contract protocol nhỏ cho prepare/encode/decode/verify/confirm. Chỉ
public hóa phần cần thiết sau spike; không làm abstraction tổng quát cho các
chain chưa có use case. Đánh giá thư viện Xahau chính thức về phiên bản, license,
dependency graph và browser/SSR compatibility; không tự viết serializer.

Runtime/definitions phải theo context, không sửa global singleton. Hai manager
XRPL và Xahau chạy đồng thời không được làm thay đổi kết quả serialize của nhau.

Đề xuất import module Xahau tường minh. Không đưa cả SDK Xahau vào IIFE/CDN mặc
định ở MVP; nếu cần CDN Xahau thì đánh giá entry/build opt-in sau khi đo bundle.
Đây là quyết định cần reviewer chốt, không phải API đã triển khai.

### Pipeline giao dịch

1. Resolve network và protocol runtime đã cấu hình.
2. Xác minh RPC network_id và network thật của ví; từ chối bằng chứng mơ hồ.
3. Kiểm tra adapter/network/type/mode trước approval.
4. Clone input; chuẩn bị snapshot với NetworkID, sequence, ledger expiry và phí.
5. Áp dụng fee ceiling và policy trước khi dispatch.
6. Gửi yêu cầu với network selector đúng của provider.
7. Decode blob theo chain; xác minh signature/hash và intent theo quy tắc autofill
   đã khai báo. Không chấp nhận sửa Destination/Amount/HookParameters trái ý định.
8. Sign-only không broadcast; submit chỉ khi có yêu cầu rõ ràng, theo dõi validated
   ledger và transaction result trên đúng chain ban đầu.

RPC tự khai báo network ID không thay thế trust vào endpoint. Không tin URL bất
kỳ từ wallet reply; preset/endpoint phải được chọn có chủ đích và kiểm tra.

Không để provider tự autofill lại phí rồi vượt ceiling. Nếu provider không cho
kiểm soát phí trước submit, không quảng bá mode đó là được kit bảo vệ; ưu tiên
sign-only rồi verify trước broadcast khi provider thực sự hỗ trợ.

### Session, auth và UI

- Ràng buộc session/history/cache/request với chain identity; chỉ migration storage
  khi cần, không xóa toàn bộ session XRPL cũ.
- Đổi chain/account hoặc disconnect hủy context cũ; callback muộn không được
  kích hoạt session hoặc submit. Không tự retry uncertain broadcast.
- Backend auth ràng buộc challenge với chain, origin/domain, nonce và expiry;
  consume nonce nguyên tử. Sở hữu key không tự chứng minh RegularKey/SignerList
  hay trạng thái account trên một chain cụ thể.
- UI hiển thị XAH, tên chain và explorer đúng; không tự gọi identity service
  XRPL cho Xahau chỉ vì địa chỉ giống nhau.
- Giữ thiết kế hiện tại; theme builder chỉ mở Xahau khi runtime đáp ứng, không
  dùng mock preview làm bằng chứng live wallet acceptance.

## Work breakdown, lịch và dependencies

| Milestone | Deliverable | Exit gate | Ước lượng |
| --- | --- | --- | --- |
| M0 / P0 | Spike codec/runtime, API cohort, Payment mẫu và Ledger XRP/XAH transaction matrix | Roundtrip/verify đạt; network selector; packaging; Ledger từng case có evidence hoặc pending rõ ràng, không kết luận chung | 2-3 ngày công, ước lượng lại theo availability hardware |
| M1 / P0 | Module, presets, network/fee guards, protocol routing | Negative cases đạt; XRPL defaults không đổi; contexts không nhiễu nhau | 3-4 ngày công |
| M2 / P1 | Xaman rồi GemWallet rồi Xyra | Payment testnet đạt theo từng mode; capability có bằng chứng | 3-5 ngày công |
| M3 / P1 | UI/console/SSR/docs; token/DEX/Invoke được chọn | Hiển thị đúng chain; từng lệnh mở rộng đạt độc lập | 2-3 ngày công |
| M4 | Security review, regression, mainnet acceptance, release notes | Không còn blocker; maintainer duyệt publish | 1-2 ngày công |
| M5 / P2 | Crossmark integration và Ledger app/type/mode đã xác minh từ M0 | Chỉ bật từng capability đã có live acceptance; không yêu cầu XAH app chung cho mọi case | 4-8 ngày công thêm |

MVP M0-M4 dự kiến **11-17 ngày công của một engineer**, chưa tính chờ upstream,
review, thiết bị hoặc người duyệt giao dịch. Đây là planning estimate, không
cam kết lịch. Phạm vi đã rộng hơn ước lượng ban đầu chỉ tập trung Xaman.

Sau M0 phải ước lượng lại. Một ví thiếu API/bằng chứng có thể bị loại khỏi cohort,
không nới lỏng guard để giữ lịch. Payment có thể phát hành trước Invoke/DEX.
WalletConnect chỉ ước lượng sau khi có đối tác thực; không hứa ngày hỗ trợ các
adapter deferred.

Dependencies cần maintainer bố trí: thông tin app Xaman, phiên bản extension/web
wallet được chọn, test account/funds, người live test, thiết bị Ledger với app XRP và XAH nếu khả dụng
và reviewer bảo mật. Chưa có chủ sở hữu cụ thể cho các vai trò này.

## Test strategy và bằng chứng nghiệm thu

### Tự động, tập trung theo rủi ro

- Known vectors/roundtrip, signature/hash, field Xahau/HookParameters và hai runtime
  đồng thời; không âm thầm mất field khi encode.
- NetworkID thiếu được chuẩn bị đúng, xung đột bị chặn; sai RPC/wallet chain,
  plain Mainnet/Testnet mơ hồ và unsupported adapter đều fail trước approval.
- Intent substitution, fee quá trần, expiry sai, blob/hash/signature không hợp lệ.
- Reject/cancel/timeout, đổi chain/account, disconnect, late callback và restore.
- SSR/public exports; consumer XRPL-only không import runtime Xahau; regression
  workflow XRPL, UI asset/explorer và session migration nếu có.

Trong phát triển dùng focused tests/typecheck. Full regression, packed-consumer
và browser checks ở milestone/release gate; không build website sau mỗi thay đổi.

### Live acceptance theo từng adapter

| Case | Bằng chứng cần có |
| --- | --- |
| Connect | Đúng address và chain, không chỉ cached state |
| Sign-only | Blob xác minh được; flow không broadcast |
| Submit | Hash, validated ledger và kết quả cuối cùng đúng |
| Token/DEX/Invoke | Kiểm thử độc lập từng lệnh/mode trước capability |
| Hook rejection | Phân biệt ledger/Hook result với lỗi provider; không báo success giả |
| Switch/cancel | Request cũ không tiếp tục trên context mới |
| Ledger | App XRP/XAH thực tế, model/firmware/version; transaction type/fields, review clarity và verified signature; không suy support từ một Payment |

Testnet trước; mainnet chỉ dùng giao dịch giá trị nhỏ được maintainer chủ động
phê duyệt. Ghi kit/provider/wallet version, browser/OS, network, method/mode,
hash/result và hardware version khi có. Không lưu seed, OAuth token hoặc dữ liệu
cá nhân không cần thiết. Mock tests không thay live acceptance.

## Risk register

| Rủi ro | Mức | Biện pháp / điều kiện chặn |
| --- | --- | --- |
| Nhầm XRPL/Xahau vì cùng địa chỉ/Mainnet | Cao | Chain identity bắt buộc; proof từ provider; reject ambiguity |
| Codec sai/bỏ field Hooks | Cao | Codec theo context, vectors và intent verification |
| Phí Hooks vượt ý định | Cao | Transaction-aware estimate; ceiling; kiểm soát provider autofill |
| Ví có support nhưng API không đủ | Cao | Spike trên bản phát hành; capability nhỏ hoặc defer |
| Auth/session replay khác chain | Cao | Chain-bound challenge, nonce nguyên tử, restore verified |
| Broadcast lại hoặc báo success sớm | Cao | Outcome unknown, no retry, validated confirmation |
| Bundle phình/SSR lỗi | Trung bình | Opt-in module; dependency graph và consumer smoke |
| Ledger app/model không sẵn | Trung bình | Milestone riêng, hardware acceptance; không chặn MVP |
| Breaking change cho XRPL dApp | Cao | Additive contract, giữ defaults, regression và semver review |

## Compatibility, rollout và rollback

- DApp XRPL không phải cài Xahau hoặc đổi config để tiếp tục chạy.
- Giữ nguyên nghĩa mainnet/testnet/devnet cũ; không chuyển XRPL request sang Xahau.
- Protocol/capability APIs ưu tiên additive, kiểm tra cả custom adapter. Nếu cần
  breaking change phải có migration và version phù hợp, không mặc định patch.
- Candidate/experimental opt-in trước; stable theo từng capability đã nghiệm thu.
- Có thể quay ứng dụng về XRPL-only hoặc tắt adapter/method lỗi trong bản sửa.
  Không tự gửi giao dịch bù, phát lại uncertain transaction hoặc tuyên bố có thể
  rollback giao dịch đã validated.
- Giao dịch pending phải được đối soát trên chain gốc kể cả khi ứng dụng rollback.
- Commit/push/npm/GitHub release/build/deploy chỉ khi được yêu cầu. Không tạo thêm
  clone/worktree chỉ để triển khai feature này.

## Checklist quyết định cho reviewer

1. Chấp nhận một kit, Xahau opt-in, không multichain rewrite?
2. Module là package hay subpath; contract tối thiểu nào cần public?

   > **[REVIEW — API injection point missing from types.ts]:**
   > `WalletManagerConfig` does not yet have a `protocol` or `xahauModule` field.
   > This must be added before M1 — it is the hook that lets the Xahau module
   > inject its codec, fee estimator, and preset resolver into the manager without
   > modifying `core`. Propose: `protocol?: { prepare, encode, decode, verifyResult, estimateFee }`.
   > Keep it narrow; do not design a generic multi-chain protocol abstraction now.

3. Cohort Xaman/GemWallet/Xyra và điều kiện proof network đã hợp lý?
4. Chấp nhận Payment MVP trước, token/DEX/Invoke có thể tách release?
5. Fee ceiling và provider autofill có cần policy chặt hơn?

   > **[REVIEW — answer: yes, stricter needed for Hooks]:** See P0 fee ceiling
   > comment above. Additionally: after provider autofill, the kit must re-read
   > the `Fee` field from the prepared tx and verify it is ≤ `maxFeeDrops` before
   > dispatching to the wallet. If the provider's autofill API cannot be called
   > before the wallet approval dialog opens (some adapters autofill inside the
   > wallet), document this as "fee unverifiable pre-approval" in the capability
   > details and surface a warning in the UI.

6. Có chấp nhận chưa đưa Xahau vào IIFE/CDN mặc định đợt đầu?
7. Session schema và auth chain binding có yêu cầu tương thích bổ sung?

   > **[REVIEW — two concrete schema changes needed]:**
   > (a) `StoredWalletSessionEnvelope` has no top-level `family` or `protocol` field.
   > Restoring a stored session without it relies on `session.account.network.family`
   > being populated — which is only true if the network was set at connect time.
   > Add `family?: string` to the envelope at version bump; migration: if absent,
   > default to `"xrpl"`.
   > (b) `WalletAuthValidationOptions` needs `expectedChainId?: string` (see P1
   > comment on `formatAuthMessage`). Without it, cross-chain auth replay between
   > XRPL and Xahau sessions is not blocked at the validation layer.

8. Ai chịu trách nhiệm security review và live acceptance cho từng ví/thiết bị?

   > **[REVIEW — blocker: no named owner, M4 cannot gate without one]:**
   > This question is unanswered. M4 ("Security review, regression, mainnet
   > acceptance") cannot close without a named reviewer for each of: (i) security
   > review of Xahau module, (ii) live testnet acceptance for Xaman, (iii) live
   > testnet acceptance for GemWallet, (iv) live testnet acceptance for Xyra,
   > (v) Ledger hardware acceptance (M5). Assign before M0 spike approval is granted.

9. Release experimental/stable và semver gate đã đủ rõ?
10. Có blocker upstream hoặc use case Xahau cụ thể cần ưu tiên thay đổi phạm vi?

    > **[REVIEW — one implicit blocker not listed]:**
    > The events in `WalletEvents` (`connected`, `tx_submitted`, `tx_confirmed`, etc.)
    > carry `account?: WalletAccount` which includes `account.network`. This is
    > sufficient to propagate `network.family = "xahau"` in events — no new event
    > fields are needed IF adapters always populate `account.network` on Xahau
    > connections. Verify this in M0/M1 acceptance: if any adapter returns
    > `account.network = undefined`, the event consumer has no chain context.
    > Make `account.network` required (non-optional) for Xahau adapter connect results.

**Đề xuất phê duyệt:** duyệt M0 trước, chốt contract và cohort sau bằng chứng
thực nghiệm. Không duyệt bật mọi adapter chỉ từ tuyên bố hỗ trợ mạng của ví.

## Điểm cần kiểm tra trong repository

- Core: `packages/core/src/types.ts`, `networks.ts`, `manager.ts`, `preflight.ts`,
  `multisign.ts`, `batch.ts`, `discovery.ts` và storage/session helpers.
- Adapter: `packages/adapters/*/src/`; Ledger `device-app.ts` hiện mở XRP.
- UI/auth: `packages/ui/src/balance.ts`, `button.ts`, modal và `packages/auth/src/`.
- Client/framework/browser entrypoints, public typings và consumer compatibility.
- Crossmark evidence là official package `@crossmarkio/typings@0.0.6` đã cài,
  không phải lời khẳng định wallet release/live acceptance. Reviewer cần ghi lại
  phiên bản upstream cụ thể ở M0 vì các URL nguồn có thể thay đổi.
