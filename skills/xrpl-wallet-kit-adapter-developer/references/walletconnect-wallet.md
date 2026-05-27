# Adding a WalletConnect Wallet Definition

Use this reference when adding a new WalletConnect-based wallet to `packages/adapters/walletconnect/src/wallets.ts`.

## WalletConnectWalletConfig interface

```ts
interface WalletConnectWalletConfig {
  id: string;                        // required — stable lowercase id, e.g. "bitget"
  name: string;                      // required — display name, e.g. "Bitget Wallet"
  description?: string;              // optional — short description for UI tooltip
  group?: string;                    // optional — UI group label, typically "WalletConnect"
  icon?: string;                     // optional — SVG data URI or base64 image string (strongly recommended)
  walletConnect?: {
    metadataName?: string;           // wallet's exact name in WC relay metadata (used for session matching)
  };
  links?: {
    universal?: string;              // universal link for mobile (HTTPS deeplink)
    native?: string;                 // native app scheme, e.g. "joey://wc"
  };
  qrMode?: "walletconnect" | "custom"; // "walletconnect" = use WC modal, "custom" = use SDK QR panel
  useModal?: boolean;                // true = use official WC modal UI for this wallet
  signMessage?: boolean;             // true = wallet supports xrpl_signMessage via WC
  deeplink?: (uri: string) => string; // function to build mobile deeplink from WC URI
}
```

## Field guide

### `id`

Stable lowercase identifier — no spaces, only letters/numbers/hyphens. Must be unique across the XRPL_WALLETCONNECT_WALLETS array. This is what consumers pass in `wallets: ["joey", "bitget"]`.

### `walletConnect.metadataName`

The wallet's exact name string as it appears in WalletConnect session metadata. Used to match incoming session approvals to the correct adapter. If the wallet shows as "Bifrost Wallet" in WC relay, set `metadataName: "Bifrost Wallet"`. When missing, session matching falls back to the `name` field.

### `qrMode`

- `"walletconnect"`: The official WalletConnect QR modal handles this wallet. The SDK delegates display to `@walletconnect/modal`. Use this for wallets that have strong WC modal support and don't need custom QR handling.
- `"custom"`: The SDK renders its own QR panel (using `qr-code-styling`) with Copy URI and deeplink buttons. Use this for wallets where you control the deeplink and want a branded, consistent experience.

All current XRPL wallets use `"walletconnect"` because the WC modal handles them natively.

### `useModal`

Set to `false` for wallets where the SDK renders its own QR panel. Setting `true` forces the official WalletConnect modal even when the SDK is in custom/group mode. For detail-mode adapters, always set `false`.

### `links.universal` vs `links.native`

- `universal`: HTTPS URL the wallet registers as a universal link on iOS/Android. E.g. `https://joeywallet.xyz/wc`. The OS routes this to the wallet app if installed, otherwise opens the web version.
- `native`: Custom URL scheme for direct app launch. E.g. `joey://wc`. Only works if the wallet is installed; no web fallback. Using native avoids the browser redirect step.

Provide both when available. The SDK prefers `native` on mobile when the deeplink function is present.

### `deeplink`

A function that builds a mobile deeplink URL from the WalletConnect URI. Called when the SDK needs to open the wallet directly for session approval. The WC URI looks like `wc:abc123@2?relay-protocol=irn&symKey=...`.

Common patterns:

```ts
// Append as query param (most common)
deeplink: (uri) => `joey://settings/wc?uri=${encodeURIComponent(uri)}`

// Universal link variant
deeplink: (uri) => `https://app.bifrostwallet.com/wc?uri=${encodeURIComponent(uri)}`

// Non-standard format (Bitget)
deeplink: (uri) => `bitkeep://bkconnect?action=dapp&uri=${encodeURIComponent(uri)}`
```

When omitted, the SDK shows the QR code and Copy URI button only — no "Open Wallet" button.

### `signMessage`

Set to `true` only when the wallet is confirmed to accept `xrpl_signMessage` requests via WalletConnect. Most current XRPL WC wallets only support `xrpl_signTransaction`, so leave this unset unless tested.

## Complete examples

### Minimal (QR only, no deeplink)

```ts
{
  id: "mywallet",
  name: "My Wallet",
  description: "Connect My Wallet through WalletConnect.",
  group: "WalletConnect",
  walletConnect: { metadataName: "My Wallet" },
  links: { universal: "https://mywallet.app/wc" },
  qrMode: "walletconnect",
  useModal: false,
  icon: MY_WALLET_ICON
}
```

### With native deeplink (recommended for mobile wallets)

```ts
{
  id: "mywallet",
  name: "My Wallet",
  description: "Connect My Wallet through WalletConnect.",
  group: "WalletConnect",
  walletConnect: { metadataName: "My Wallet" },
  links: {
    universal: "https://mywallet.app/wc",
    native: "mywallet://wc"
  },
  qrMode: "walletconnect",
  useModal: false,
  deeplink: (uri) => `mywallet://wc?uri=${encodeURIComponent(uri)}`,
  icon: MY_WALLET_ICON
}
```

### Existing wallet references

See `packages/adapters/walletconnect/src/wallets.ts` for all current XRPL wallet configs:

- **StaticBit**: universal link only, no deeplink, `qrMode: "walletconnect"`
- **Bitget**: both universal + native, non-standard deeplink format, `qrMode: "walletconnect"`
- **Joey**: both links, standard query-param deeplink
- **Girin**: both links, no deeplink function (QR only)
- **Bifrost**: both links, universal link as deeplink (HTTPS deeplink pattern)

## How to add a new wallet

1. Add the icon as a constant in `packages/adapters/walletconnect/src/icons.ts` (SVG data URI preferred).
2. Add a deeplink helper to `walletConnectDeeplinks` in `wallets.ts` if the wallet has a custom deeplink format.
3. Add the `WalletConnectWalletConfig` object to the `XRPL_WALLETCONNECT_WALLETS` array.
4. Export the new wallet id in `packages/client/src/index.ts` under `WalletKitAdapterId` if it should be addressable by name.
5. Run `npm.cmd run typecheck` to verify no type errors.
6. Test manually: QR shows, deeplink opens wallet on mobile, session approve updates connected state.

## Icon guidelines

- Format: inline SVG data URI (`data:image/svg+xml,...`) or base64 PNG
- Size: optimized for 40×40px display
- Background: transparent or clean solid color — no app chrome
- Do not use third-party trademark icons without checking the wallet's brand/usage guidelines before npm publishing.
