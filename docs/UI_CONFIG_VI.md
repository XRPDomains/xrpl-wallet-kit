# Cấu hình UI XRPL Wallet Kit

Tài liệu này mô tả cấu hình UI public hiện tại. Từ bản này, config mới phải được trao đổi và chốt tên trước khi bổ sung, tránh phát sinh alias hoặc option trùng nghĩa.

> Ghi chú: phần CSS variables ở cuối là định hướng theme tiếp theo. API hiện tại dùng `ui.customTheme` bằng JavaScript config.

## Ví dụ đầy đủ

```ts
createWalletKit({
  appName: "My XRPL dApp",
  walletConnectProjectId: "...",
  xamanClientId: "...",
  autoReconnect: true,

  ui: {
    mode: "light",
    themeName: "default",
    language: "vi-VN",
    customTheme: {
      accent: "#0078ae",
      background: "#ffffff",
      foreground: "#111827",
      muted: "#64748b",
      border: "#e5e7eb",
      overlay: "rgba(15,23,42,.46)",
      surface: "#f8fafc",
      surfaceHover: "#f1f5f9",
      shadow: "none",
      radius: "14px",
      walletRadius: "10px",
      fontFamily: "Inter, system-ui, sans-serif"
    },
    modal: {
      title: "Connect Wallet",
      width: "default",
      footerText: "XRPL Wallet Kit",
      autoOpen: false
    },
    walletList: {
      layout: "list",
      wallets: "all",
      groups: undefined,
      showGroup: true,
      showInstalledBadge: true
    },
    walletConnect: {
      mode: "group",
      cta: "both",
      qr: {
        style: "dots",
        showLogo: false
      }
    },
    connectButton: {
      label: "Connect Wallet",
      size: "md",
      variant: "default",
      accountStatus: "full",
      showBalance: false,
      showAdapterIcon: true,
      showChevron: true
    },
    accountPanel: {
      mode: "modal",
      showAvatar: true,
      copyAddress: true,
      disconnect: true,
      explorer: false
    },
    identity: {
      enabled: true,
      fallbackToAddress: true,
      resolver: async (address, session) => null
    }
  }
});
```

## `ui.mode`

Chọn theme mode tổng thể.

- `light`: giao diện sáng.
- `dark`: giao diện tối.
- `auto`: theo `prefers-color-scheme` của trình duyệt.

Default hiện tại: `light`.

## `ui.themeName`

Tên theme preset.

- `default`
- `minimal`
- `rounded`
- `compact`
- string tùy chỉnh cho preset sau này

Hiện tại phần tùy biến thực tế nằm ở `ui.customTheme`.

## `ui.language`

Ngôn ngữ UI, dành cho translations sau này.

Ví dụ: `vi-VN`, `en-US`, `auto`.

Ghi chú: translation resolver đầy đủ chưa triển khai, nên chưa coi đây là tính năng hoàn chỉnh.

## `ui.customTheme`

Tùy biến token giao diện bằng JS object.

```ts
customTheme: {
  accent: "#0078ae",
  background: "#ffffff",
  foreground: "#111827",
  muted: "#64748b",
  border: "#e5e7eb",
  overlay: "rgba(15,23,42,.46)",
  surface: "#f8fafc",
  surfaceHover: "#f1f5f9",
  shadow: "none",
  radius: "14px",
  walletRadius: "10px",
  fontFamily: "Inter, system-ui, sans-serif"
}
```

Ý nghĩa chính:

- `accent`: màu nhấn chính.
- `background`: nền modal/panel.
- `foreground`: màu chữ chính.
- `muted`: màu chữ phụ.
- `border`: màu border nhẹ.
- `overlay`: nền phủ sau modal.
- `surface`: nền wallet item, account action, QR card.
- `surfaceHover`: nền hover/tap, không làm nhảy layout.
- `shadow`: shadow modal/panel, hiện ưu tiên `none`.
- `radius`: bo góc modal/account panel.
- `walletRadius`: bo góc wallet item/action button.
- `fontFamily`: font UI.

## `ui.modal`

Cấu hình modal chọn ví.

```ts
modal: {
  title: "Connect Wallet",
  width: "default",
  footerText: "XRPL Wallet Kit",
  autoOpen: false
}
```

- `title`: tiêu đề modal.
- `width`: `compact`, `default`, hoặc `wide`.
- `footerText`: text nhỏ dưới modal.
- `autoOpen`: tự mở modal khi khởi tạo kit.

Trên mobile, modal tự chuyển thành bottom sheet full-width, chỉ bo 2 góc trên.

## `ui.walletList`

Cấu hình danh sách ví trong modal.

```ts
walletList: {
  layout: "list",
  wallets: "all",
  groups: undefined,
  showGroup: true,
  showInstalledBadge: true
}
```

- `layout`: `list`, `card`, `icon`, hoặc `grid`.
- `wallets`: `"all"` hoặc mảng adapter id theo đúng thứ tự hiển thị.
- `groups`: nhóm ví tùy chỉnh.
- `showGroup`: hiện group label dưới tên ví.
- `showInstalledBadge`: hiện Installed badge cho extension/snap khi khả dụng.

Ví dụ chọn ví theo thứ tự:

```ts
walletList: {
  wallets: ["xaman", "gemwallet", "crossmark", "dropfi", "xrplsnap", "walletconnect"]
}
```

## `ui.walletConnect`

Cấu hình riêng cho WalletConnect.

```ts
walletConnect: {
  mode: "group",
  cta: "both",
  qr: {
    style: "dots",
    showLogo: false
  }
}
```

### `walletConnect.mode`

- `default`: hiện một item WalletConnect, click dùng WalletConnect modal mặc định.
- `list`: hiện các ví WalletConnect như wallet item riêng lẻ.
- `group`: gom các ví WalletConnect vào một item WalletConnect, click tiếp để chọn ví con rồi hiện custom QR/deeplink.

Default trong client hiện tại: `group`.

### `walletConnect.cta`

- `copy`: chỉ Copy URI.
- `open`: chỉ Open Wallet.
- `both`: hiện cả hai khi có deeplink.

Renderer hiện vẫn dựa trên URI/deeplink thực tế; option này giữ tên API ổn định cho bước hoàn thiện tiếp theo.

### `walletConnect.qr`

- `style`: `standard` hoặc `dots`.
- `showLogo`: bật/tắt logo trong QR.

Custom QR hiện dùng `qr-code-styling`, nền trong suốt và mặc định không nhúng logo để ưu tiên scan ổn định.

## `ui.connectButton`

Cấu hình nút Connect Wallet.

```ts
connectButton: {
  label: "Connect Wallet",
  size: "md",
  variant: "default",
  accountStatus: "full",
  showBalance: false,
  showAdapterIcon: true,
  showChevron: true
}
```

- `label`: text khi chưa connect.
- `size`: `sm`, `md`, `lg`.
- `variant`: `default`, `pill`, `minimal`, `outline`.
- `accountStatus`: `full`, `address`, `icon`.
- `showBalance`: hiện số dư khả dụng XRP.
- `showAdapterIcon`: hiện icon ví đã kết nối.
- `showChevron`: hiện nút mở account panel.

## `ui.accountPanel`

Cấu hình account panel sau khi connect.

```ts
accountPanel: {
  mode: "modal",
  showAvatar: true,
  copyAddress: true,
  disconnect: true,
  explorer: false
}
```

- `mode`: `dropdown` hoặc `modal`.
- `showAvatar`: định hướng hiện avatar mặc định hoặc avatar từ identity.
- `copyAddress`: hiện nút copy address.
- `disconnect`: hiện nút disconnect.
- `explorer`: hiện explorer action khi có `explorerUrl`.

Default hiện tại: `modal`. Trên mobile, `modal` tự thành bottom sheet.

## `ui.identity`

Cấu hình Web3 name / identity.

```ts
identity: {
  enabled: true,
  fallbackToAddress: true,
  resolver: async (address, session) => null
}
```

Resolver có thể trả object:

```ts
{ name: "btcetf.xrp", avatar: "https://...", source: "xrpdomains", verified: true }
```

hoặc string name, hoặc `null`.

## Direct Connect Button Options

Khi dùng `createWalletButton()` riêng hoặc React `WalletButton`, có thêm các field cấp button:

```ts
{
  showWeb3Name: true,
  fallbackToAddress: true,
  copyAddress: true,
  explorer: false,
  disconnect: true,
  accountPanel: true,
  accountPanelMode: "modal",
  showBalance: false,
  identityResolver,
  balanceResolver,
  onIdentityChange,
  onBalanceChange,
  explorerUrl,
  formatAddress
}
```

## Adapter ID hiện tại

```ts
[
  "xaman",
  "gemwallet",
  "crossmark",
  "dropfi",
  "xrplsnap",
  "staticbit",
  "bitget",
  "joey",
  "girin",
  "bifrost"
]
```

`ledger` đã có hướng adapter nhưng đang tạm disable trong UI/test.

## Cấu hình khuyến nghị

### Dapp đơn giản

```ts
ui: {
  mode: "light",
  walletList: { layout: "list", wallets: "all" },
  walletConnect: { mode: "default" },
  accountPanel: { mode: "modal" }
}
```

### Dapp muốn giao diện sạch

```ts
ui: {
  walletList: {
    layout: "list",
    wallets: ["xaman", "gemwallet", "crossmark", "dropfi", "xrplsnap", "walletconnect"]
  },
  walletConnect: { mode: "group" }
}
```

### Trang test adapter

```ts
ui: {
  walletList: { layout: "list", wallets: "all", showGroup: true, showInstalledBadge: true },
  walletConnect: { mode: "list", cta: "both" },
  connectButton: { showBalance: true }
}
```

## Định hướng CSS variables

Định hướng theme tối ưu là để UI render bằng CSS variables, còn JS config là cách tiện để set token. Khi triển khai, người dùng có thể override bằng file CSS riêng.

```css
:root {
  --xwk-font-family: Inter, system-ui, sans-serif;
  --xwk-color-background: #ffffff;
  --xwk-color-foreground: #111827;
  --xwk-color-muted: #64748b;
  --xwk-color-surface: #f8fafc;
  --xwk-color-surface-hover: #f1f5f9;
  --xwk-color-border: #e5e7eb;
  --xwk-color-overlay: rgba(15, 23, 42, 0.46);
  --xwk-color-accent: #0078ae;
  --xwk-radius-modal: 14px;
  --xwk-radius-wallet-item: 10px;
  --xwk-shadow-modal: none;
}
```

## Nguyên tắc bổ sung config mới

- Không thêm alias nếu không thật sự cần.
- Không thêm config trùng nghĩa với config đã có.
- Tên config phải mô tả đúng thành phần UI hoặc hành vi.
- Config mới cần được trao đổi và chốt trước khi đưa vào code.
- Docs VI/EN phải cập nhật cùng lúc khi thêm, đổi tên hoặc xóa config.