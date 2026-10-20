# Xahau M0 - Live Acceptance Checklist

Cap nhat: 2026-10-19. Pham vi testnet-only trong muc 1-7 la checklist M0 ban dau,
khong phai gioi han cua console hien tai. Ket qua live maintainer moi nhat o muc 9.
Trang thai: **Payment da duoc maintainer bao pass tren 4 vi; cac lenh khac chua chot**.

## 1. Pham Vi Va Dieu Kien Bat Dau

- Dung vi test rieng; khong dung seed/key production, khong gui seed cho nguoi test.
- Khong mainnet, khong submit, khong auto-retry, khong bat blind signing de vuot loi.
- Khong ky neu man hinh vi/device hien XRP mainnet, sai account, sai network,
  sai nguoi nhan, sai don vi hoac phi khong duoc giai thich.
- Khong dan tx_blob con hieu luc len GitHub: blob da ky co the bi nguoi khac submit.
  Bao cao cong khai chi luu hash/digest; raw blob chi luu cuc bo co kiem soat.
- Khong sua vi, doi app hay doi network trong luc cho approval tru cac case
  race duoc chi dinh rieng; moi case dung request rieng va ghi ket qua rieng.

**Cong cu hien tai:** `http://127.0.0.1:5173/`, mot console chung. Chon Chain
XRPL/Xahau va mainnet/testnet; danh sach vi tu loc. Ca Xaman, GemWallet, Xyra va
Ledger da co duong Xahau opt-in; khong can cai dependencies cua private spike de
chay UI. Route lab cu da bo. Code local chua duoc publish.

Chon vi -> Connect -> dien Payment hoac Transaction JSON, dat maximum fee drops
tuong minh -> chon sign-only -> duyet tren vi/device -> doc ket qua/events.
Console co mainnet va submit nhung cac che do do nam ngoai checklist M0 nay;
khong dung chung ket qua sign-only de danh dau submit pass.
Runtime chuan bi va kiem tra truoc/sau khi ky. Cac bang ben duoi la tai lieu tham
chieu cho nguoi test, khong phai yeu cau tao them suite. Khong danh dau restore,
auth, NFT hay lenh/app Ledger chua test la pass. Khong auto retry submission.

## 2. Thong Tin Moi Lan Test

| Truong | Gia tri can ghi |
| --- | --- |
| Thoi gian / OS / browser | UTC hoac timezone ro rang; version |
| Kit commit / harness revision | Gia tri thuc te, khong chi ghi latest |
| Vi | GemWallet / Xyra / Xaman / Ledger |
| Extension/web/provider version | Version va URL nguon |
| Account test | Dia chi classic; khong seed/private key |
| Network | Xahau testnet / 21338 |
| RPC | Endpoint da duoc kit kiem tra, khong tu dong tin URL vi tra ve |
| Ledger neu co | Model, firmware, XRP hay XAH app + version, transport/library, derivation path |

## 3. Nhom A - Network, Connect, Restore

Thuc hien rieng cho **GemWallet, Xyra va Xaman** khi harness cho provider do san
sang. Ghi ro NA neu vi khong co API tuong ung; NA khong phai PASS.

| ID | Thao tac | Ket qua can quan sat |
| --- | --- | --- |
| A1 | Chon Xahau testnet trong vi, connect | Account classic va selector/chain response khop; khong suy chain tu chu Testnet |
| A2 | Reload, kiem tra khong restore gia | Passive restore Xahau chua ho tro: ghi NA cho restore thanh cong; khong chap nhan storage la bang chung chain/account |
| A3 | Doi account trong vi | Kit cap nhat hoac disconnect; session cu khong duoc dung ky |
| A4 | Doi sang XRPL testnet hoac Xahau mainnet khi khong cho ky | Kit nhan network event/state moi hoac fail closed; khong tu gui transaction |
| A5 | Doi lai Xahau testnet | Tao revision/session hop le moi; khong hoi sinh request cu |
| A6 | Disconnect trong vi, reload app | Khong restore session gia tu localStorage |
| A7 | Hai tab/manager, namespace khac nhau | Session/account/network tab nay khong ghi de tab kia; ghi ro neu harness chua co case nay |

Capture provider state truoc/sau, khong chi screenshot label:

- GemWallet: raw `getNetwork` result gom `chain`, `network`, `websocket`.
  Khong doi hoi field `networkID` khong ton tai trong released contract.
  `XAHAU` + `Testnet` la pre-check; RPC identity va signed blob la cac buoc rieng.
  Neu getNetwork tra reject khong result, ghi UNREPORTED cho provider network,
  khong tick chain proof PASS tu configured preset. Xahau connect co the tiep tuc
  theo muc 11.2; phai kiem tra NetworkID/RPC/signed blob rieng o nhom B.
- Xyra: selector explicit `xahau-testnet`; record connect result va event behavior.
  Khong dung alias `xahau` hoac dua SDK import module-scope vao harness.
- Xaman: ghi selector/request network binding va ket qua thuc te. SignIn/auth
  khong duoc danh dau pass chi vi Payment ky thanh cong.

## 4. Nhom B - Sign-Only Qua Harness

### Gate truoc moi approval

Engineer phai hien va luu snapshot Account, Destination, Amount neu co, NetworkID,
Sequence, LastLedgerSequence, Fee, SigningPubKey, field mo rong va unsigned digest.
Harness phai lay sequence/ledger/fee tu RPC testnet, dung ceiling do nguoi test
chap thuan. Khong copy Sequence/expiry/phi offline trong spike lam giao dich live.
Khong copy key fixture cong khai vao vi, khong cap tien cho account fixture.

| ID | Transaction | Dieu kien |
| --- | --- | --- |
| B1 | Payment toi account test do nguoi test kiem soat | Native XAH, NetworkID 21338; amount/fee duoc duyet ro |
| B2 | Payment + SourceTag/DestinationTag + Memo | So san tung field, khong tu chen/bot tag |
| B3 | Payment + HookParameters | Chi sau khi engineer chon destination/Hook va payload an toan; khong sao chep parameter tuy y |
| B4 | Invoke khong HookParameters | Case doc lap, provider co the reject; ghi loi goc |
| B5 | Invoke + HookParameters | Can destination/Hook/payload ro rang nhu B3; khong suy pass tu B1/B3/B4 |

Moi request phai la **sign-only**, khong goi wallet submit API. Sau approval:

1. Record raw response shape va ten field, khong chi thong bao success.
2. GemWallet: xac minh field `signature` thuc su chua full signed blob hay chi
   compact signature. Chi full blob decode/verify duoc moi du dieu kien cho flow nay.
3. Xyra: capture `tx_blob` va `hash`; hash phai duoc tinh lai tu blob.
4. Decode voi Xahau definitions da pin; so san toan bo intent, NetworkID, Fee,
   Account, public key, chu ky, HookParameters va hash. Field bi vi autofill/thay doi
   phai ghi ro; khong tu chap nhan bang cach thay expected intent sau khi ky.
5. Recheck session, network, sequence, ledger expiry va phi sau approval.
6. Khong broadcast. Cho qua LastLedgerSequence tren validated testnet truoc khi
   chia se raw blob cho review; uu tien chi chia se digest va verification result.

### Cancel / Race (moi dong la request rieng)

| ID | Thao tac khi dang cho approval | Ky vong |
| --- | --- | --- |
| R1 | Reject tren vi | Request ket thuc, khong retry |
| R2 | Cancel tai dApp | Khong tra blob ve caller, khong submit; vi co the van mo |
| R3 | Doi account/network neu vi cho phep | Ket qua cu bi loai, ke ca vi van tra signature |
| R4 | Disconnect/reconnect cung account | Revision doi; request cu khong duoc hoi sinh |
| R5 | De het han ledger/timeout | Khong tra ket qua nhu mot request con hop le |
| R6 | Xyra tren Safari macOS va Safari iOS, co preflight async cham | Test connect va sign-only tu click; record OS/browser/version va popup co bi chan khong. Chua co ket qua live; Chrome/WebKit desktop khong thay the iOS |

Neu vi da ky sau khi cancel, ghi 'late signature discarded', khong ghi 'device
did not sign'. Cancellation cua kit khong the hoan tac hanh dong tren vi/device.

## 5. Nhom C - Ledger Rieng Theo App/Version

Client mac dinh giu Ledger XRPL-only va an khoi danh sach Xahau. Chi bat
tuong minh qua wallets: ["ledger"] hoac adapter rieng de test co kiem soat.
L1-L8 chua co ket qua thi khong cong bo ho tro giao dich/app do; dac biet
khong suy Invoke/HookParameters tu Payment. Khong cho phep blind signing.

Chay **L1-L8 trong XAHAU_M0_FINDINGS, muc 8**, rieng cho XRP app va XAH app khi
co. Truoc mat uu tien L1 Payment toi gian, sau do L2 tags/memos. Khong ep doi sang
XAH app khi dang kiem tra XRP app: dat deviceApp: "XRP" tuong minh hoac
autoOpenApp: false. Xahau connect mac dinh yeu cau mo app XAH truc tiep tren
thiet bi; chi tiep tuc neu model/firmware ho tro. Ledger Live desktop khong
la doi tuong test. Maintainer da xac nhan auto-open XAH hoat dong (muc 9).

Moi case ghi: device co hien review khong, hien asset/network/amount/fee gi,
co warning/blind-sign prompt khong, APDU error/status, verification ket qua blob.
Khong bat blind signing de cho pass. Payment pass khong dong nghia Invoke,
HookParameters, TrustSet hay OfferCreate/Cancel pass. B1-B5 chi la subset prototype;
L6-L8 can validator/fixtures tuong ung, chua duoc runner hien tai ho tro.

## 6. Mau Gui Ket Qua

Sao chep bang nay cho tung case; co the gui ket qua tung nhom, khong can doi het.

```text
Case ID:
Ket qua: PASS / FAIL / BLOCKED / NA
Thoi gian:
Kit commit / harness revision:
Vi/provider version:
OS/browser:
Ledger model/firmware/app/version (neu co):
Network/account:
Thao tac:
Provider response shape (khong seed/token/raw blob con hieu luc):
Device review / warning:
Prepared intent digest / signed tx hash:
Verify NetworkID/account/intent/signature/hash:
Phi truoc/sau, cap da duyet:
Session/network truoc/sau:
Loi goc / APDU status:
Screenshot (che thong tin nhay cam):
```

## 7. Dieu Kien Chot

Khong tick PASS cho case chua chay. FAIL la bang chung huu ich, khong duoc xoa.
M0 can ket luan theo tung wallet/network/type/mode va ghi ngoai cohort neu thieu
bang chung. Bieu mau nay khong tu dong dong M0 va khong bat capability production.
Gate release van can integration/browser/SSR/regression va review rieng.

## 8. Ket Qua Da Bao Cao Va Gate Con Mo (2026-10-18)

- Maintainer bao Ledger connect tot. Chua kem network/app/version/device hoac
  signed blob verification; ghi nhan connect-only, chua tick L1-L8 hay Payment/
  Invoke/HookParameters pass. Console local van giu Ledger opt-in de test tiep.
- Safari macOS/iOS: chua co ket qua live R6. Chua doi popup lifecycle chi tu
  ket qua Chrome; neu bi chan can dua reservation len truoc manager preflight.
- Kiem tra ky thuat (khong thay live acceptance): typecheck/browser build +
  smoke pass; 21 client/Xyra tests pass; Vite production Chrome va Next 16.3.8
  webpack production prerender round-trip Invoke/NetworkID/HookParameters pass.
- IIFE do lai: readable 3,866,351 bytes (gzip 831,229); minified 2,081,904 bytes
  (gzip 644,151). inlineDynamicImports gom codec Xahau vao moi IIFE/CDN download;
  ESM co lazy chunk, selective khong tu import Xahau. Day la so do build local,
  khong phai xac nhan npm/CDN da cap nhat.

## 9. Cap Nhat Live Tu Maintainer (2026-10-19)

- Maintainer bao Payment pass tren Xaman, GemWallet, Xyra va Ledger trong dot
  test hien tai; truoc do da chon test mainnet. Day la ket qua live do maintainer
  bao cao, khong phai ket qua mock cua agent.
- Ledger tu mo XAH app tren thiet bi thanh cong. Khong lien quan Ledger Live.
- Chua co bang tach theo tung vi/mode sign-only va sign-and-submit, tx hash,
  OS/browser va version vi/device; khong tu dien cac bang chi tiet la PASS.
- Chua suy ra PASS cho tag/memo, Invoke, HookParameters, TrustSet, OfferCreate/
  Cancel, AccountSet, restore, auth, race/cancel hay Safari popup.
- Buoc tiep: B2 Payment voi tag/memo, sau do B4 Invoke va B3/B5 HookParameters
  voi destination/Hook/payload da biet. Ledger test rieng; khong bat blind signing
  de vuot qua giao dich/device khong review duoc. Uu tien sign-only cho lenh moi.
- Chua doi default adapter registration, build website, commit hay publish tu
  ket qua Payment nay.

## 10. Mo Them Thao Tac Local (2026-10-19, Chua Xac Nhan Live)

- NFT tren Xahau dung form URIToken rieng: mint, tao/huy sell offer, buy, burn.
  Dung chung mode sign-and-submit/sign-only va fee cap. Form NFToken cua XRPL
  van tach rieng; mo form khong co nghia moi vi/device da pass URIToken.
- Message mo cho Xaman (SignIn, force_network Xahau, khong submit) va GemWallet
  (native signature). Xyra/Ledger chua co message API trong adapter hien tai.
  Day la raw signing, khong phai xac nhan chain-bound auth; tab Auth va Batch
  van chua bat tren Xahau. Maintainer chu dong test trong console 5173.

## 11. Invoke Mainnet Live Acceptance (2026-10-21)

- Maintainer reported successful live Invoke calls on Xahau Mainnet with all
  four adapters: Xaman, GemWallet, Xyra and Ledger. This supersedes the open
  Invoke acceptance status in section 9 for this tested flow only.
- The local console provides `Invoke - Mainnet smoke test`, targeting
  `rH8M9qWfWspxY93sDNEd43cVabpf29msLV` with `TEST=wallet-kit` in HookParameters.
  Before the maintainer's test, unsigned RPC simulation returned `tesSUCCESS`,
  Hook return text `Transaction accepted for no reason`, zero emits and zero
  Hook state changes. Simulation is separate evidence, not a signed live result.
- Transaction hashes, per-wallet signing modes, wallet/app versions and browser
  details were not supplied; do not invent those records or mark both modes passed.
- This confirms the maintainer-reported basic Invoke flow, not arbitrary Hooks,
  business-parameter semantics, state writes, emitted transactions, SetHook,
  multisign, blind-signing safety or Safari/iOS compatibility.
- No adapter capability/default changes, automated signing, builds, commit,
  push or publication are triggered by recording this result.
