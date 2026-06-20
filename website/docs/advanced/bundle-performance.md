# Bundle & Performance

## Package Sizes

Install only what you need. Each package is independent and tree-shakeable:

| Package | Gzipped | What it includes |
|---|---|---|
| `@xrpl-wallet-kit/core` | ~5.7 KB | WalletManager, session storage, error types, network config |
| `@xrpl-wallet-kit/ui` | ~12 KB | WalletModal, WalletButton, WalletToast, themes, locales |
| `@xrpl-wallet-kit/react` | ~3 KB | WalletKitProvider, hooks, WalletButton component |
| `@xrpl-wallet-kit/adapter-xaman` | ~4 KB | Xaman OAuth adapter |
| `@xrpl-wallet-kit/adapter-gemwallet` | ~1 KB | GemWallet extension adapter |
| `@xrpl-wallet-kit/adapter-walletconnect` | ~2 KB + WC SDK | WalletConnect v2 adapter |
| `@xrpl-wallet-kit/client` | Sum of above | All packages bundled |
| `@xrpl-wallet-kit/browser` | ~528 KB | IIFE bundle with all adapters + polyfills |

::: tip Production recommendation
Use individual packages with a bundler (Vite, Rollup, webpack). Never use the IIFE browser bundle in production — it bundles everything regardless of what you use.
:::

## Tree-Shaking

All packages ship ES modules and support tree-shaking. Install only the adapters your app actually uses:

```bash
# ✅ Minimal install — only what you need
npm install @xrpl-wallet-kit/core @xrpl-wallet-kit/ui
npm install @xrpl-wallet-kit/adapter-gemwallet
npm install @xrpl-wallet-kit/adapter-xaman

# ❌ Avoid unless you need everything
npm install @xrpl-wallet-kit/client
```

When you use `@xrpl-wallet-kit/client` with `wallets: "all"`, all adapters are included regardless. With `wallets: ["gemwallet", "xaman"]`, only those two adapter packages are bundled — but the others are still listed as dependencies and must be installed.

For the smallest bundle, import adapter factories directly:

```ts
import { WalletManager } from "@xrpl-wallet-kit/core";
import { createGemWalletAdapter } from "@xrpl-wallet-kit/adapter-gemwallet";
import { createXamanAdapter } from "@xrpl-wallet-kit/adapter-xaman";
// ← WalletConnect, Ledger, Crossmark, etc. are NOT included
```

## WalletConnect Lazy Loading

The WalletConnect SDK (`@walletconnect/modal-core`) is large (~120 KB gzip). The `@xrpl-wallet-kit/adapter-walletconnect` package loads it lazily — the SDK is not imported until the user actually clicks "WalletConnect" in the modal.

This is handled automatically — no configuration needed. You'll see it in your bundle as a dynamic import chunk.

## Code Splitting

If you use `createWalletKit()` or the WalletConnect adapter, your bundler will automatically split the WalletConnect SDK into a separate chunk. Verify this in your build output:

```sh
# Vite — look for a walletconnect chunk in dist/assets/
vite build
ls dist/assets/ | grep walletconnect
```

## Vite Configuration

No special Vite config is needed. XRPL Wallet Kit ships pure ESM and works out of the box. If you encounter issues with the `xrpl` peer dependency (used only in `@xrpl-wallet-kit/auth/verifiers`), add a manual chunk:

```ts
// vite.config.ts
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          xrpl: ["xrpl"],
        },
      },
    },
  },
});
```

## Preload the Modal

The first time `WalletModal` is opened, it injects styles into the document. To avoid any flash on first open, call `modal.preload()` after page load:

```ts
// After DOM is ready, before user clicks
window.addEventListener("load", () => {
  modal.preload?.();
});
```

## Session Storage

Session data is stored in `localStorage` by default under the key `xwk:session`. The payload is a small JSON object — well under 1 KB. Override the storage key or use in-memory storage for testing:

```ts
import { WalletManager, createMemoryStorage } from "@xrpl-wallet-kit/core";

const manager = new WalletManager({
  adapters: [...],
  storage: createMemoryStorage(),   // no localStorage writes
});
```

## Avoiding Re-renders (React)

`useWalletKit()` re-renders whenever `session`, `account`, or `status` changes. To avoid unnecessary re-renders, use the narrower hooks:

```tsx
// ✅ Only re-renders on status change
const status = useWalletStatus();

// ✅ Only re-renders when account changes
const account = useWalletAccount();

// ❌ Re-renders on any context change
const { status, account, session, wallets, connect, ... } = useWalletKit();
```
