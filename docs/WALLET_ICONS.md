# Wallet Icons

Default wallet icons are embedded as `data:image/*;base64,...` strings only after a verified source or user-approved asset is selected. Examples and SDK packages must not depend on XRPDomains-hosted assets.

Apps can still override every icon through adapter options or WalletConnect wallet config:

```ts
createXamanAdapter({ apiKey, icon: "data:image/svg+xml;base64,..." });
createWalletConnectAdapter({ projectId, id: "joey", name: "Joey", icon });
```

## Source Policy

- Prefer existing embedded icons from XRPL Commons `xrpl-connect` adapter sources for matching adapters.
- Prefer official brand/media kits when a wallet publishes a reusable asset.
- Do not invent or stylize wallet marks when a verified source is missing.
- Do not reference XRPDomains `/walletlogo` assets from SDK packages or examples.
- Treat wallet names and logos as third-party trademarks. For a commercial npm release, review each wallet's brand terms before shipping exact official marks.

## Current Defaults

| Wallet | Default location | Source/reference |
| --- | --- | --- |
| Xaman | `wallet-adapter-xaman/src/index.ts` | XRPL Commons embedded icon: https://github.com/XRPL-Commons/xrpl-connect/blob/develop/packages/adapters/xaman/src/xaman-adapter.ts |
| GemWallet | `wallet-adapter-gemwallet/src/index.ts` | XRPL Commons embedded icon: https://github.com/XRPL-Commons/xrpl-connect/blob/develop/packages/adapters/gemwallet/src/gemwallet-adapter.ts |
| Crossmark | `wallet-adapter-crossmark/src/index.ts` | XRPL Commons embedded icon: https://github.com/XRPL-Commons/xrpl-connect/blob/develop/packages/adapters/crossmark/src/crossmark-adapter.ts |
| WalletConnect | `wallet-adapter-walletconnect/src/icons.ts` | XRPL Commons embedded icon: https://github.com/XRPL-Commons/xrpl-connect/blob/develop/packages/adapters/walletconnect/src/walletconnect-adapter.ts |
| Ledger | `wallet-adapter-ledger/src/index.ts` | XRPL Commons embedded icon: https://github.com/XRPL-Commons/xrpl-connect/blob/develop/packages/adapters/ledger/src/ledger-adapter.ts |
| StaticBit | `wallet-adapter-walletconnect/src/icons.ts` | User-approved asset from `tmp/walletconnect-icons/staticbitwallet.png` |
| Bitget Wallet | `wallet-adapter-walletconnect/src/icons.ts` | User-approved asset from `tmp/walletconnect-icons/bitgetwallet.svg` |
| Joey Wallet | `wallet-adapter-walletconnect/src/icons.ts` | User-approved asset from `tmp/walletconnect-icons/joeywallet.png`; file bytes are JPEG, encoded as `image/jpeg` |
| Girin Wallet | `wallet-adapter-walletconnect/src/icons.ts` | User-approved asset from `tmp/walletconnect-icons/girinwallet.png`; file bytes are JPEG, encoded as `image/jpeg` |
| Bifrost Wallet | `wallet-adapter-walletconnect/src/icons.ts` | User-approved asset from `tmp/walletconnect-icons/bifrostwallet.png` |
| DropFi | `wallet-adapter-dropfi/src/index.ts` | User-approved asset from `tmp/walletconnect-icons/dropfi.png` |
| XRPL Snap | `wallet-adapter-xrpl-snap/src/index.ts` | User-approved cropped asset from `tmp/walletconnect-icons/xrplsnap.png` |

## Maintenance Notes

- Keep WalletConnect wallet list and deeplinks in `wallet-adapter-walletconnect/src/wallets.ts`.
- Keep generic and approved WalletConnect wallet data URI icons in `wallet-adapter-walletconnect/src/icons.ts`.\r\n- Do not re-add deleted candidate icons without another review pass.

