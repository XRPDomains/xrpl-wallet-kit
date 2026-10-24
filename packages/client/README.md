# @xrpl-wallet-kit/client

All-in-one XRPL Wallet Kit client for browser dApps.

This package creates the wallet manager, official adapters, modal UI, connect button, identity resolver, balance display, transaction toast, and recent transaction wiring from one configuration object.

## Install

Joey Wallet's native extension is opt-in via `wallets: ["joey-wallet"]`.
The kit exposes `signIn({ nonce, statement, resources })` for its native login
proofs. Check `kit.manager.can("signIn")` and verify on the server using
`verifyWalletSignIn` from `@xrpl-wallet-kit/auth/verifiers`. A server-issued,
one-time nonce is required. Existing `signMessage()` integrations are unchanged.

```bash
npm install @xrpl-wallet-kit/client
```

For React apps, also install `@xrpl-wallet-kit/react`.

```bash
npm install @xrpl-wallet-kit/client @xrpl-wallet-kit/react
```

## Choosing an entry

- `@xrpl-wallet-kit/client` provides the batteries-included factory and first-party adapter exports. It has the largest bundle profile.
- `@xrpl-wallet-kit/client/selective` provides core, UI, storage resolution, and a manager factory without importing any wallet adapter. Install and pass only the adapter packages your app supports.

```ts
import { createWalletClient } from "@xrpl-wallet-kit/client/selective";
import { createGemWalletAdapter } from "@xrpl-wallet-kit/adapter-gemwallet";

const manager = createWalletClient({
  adapters: [createGemWalletAdapter()],
  network: "mainnet",
  storage: "localStorage",
});
```

## Quick Start

```ts
import { createWalletKit } from "@xrpl-wallet-kit/client";

const kit = createWalletKit({
  metadata: {
    name: "My XRPL App",
    description: "Wallet connection for My XRPL App",
    url: window.location.origin,
    icons: [`${window.location.origin}/icon.png`],
  },
  network: "mainnet",
  autoReconnect: true,
  walletConnectProjectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID,
  connectButton: "#connect-wallet",
  ui: {
    nonce: window.__CSP_NONCE__, // optional, for strict Content Security Policy
    themeMode: "light",
    walletConnect: { mode: "default" },
    accountPanel: {
      showBalance: true,
      showAddressQr: true,
      showRecentTransactions: true,
      maxVisibleTransactions: 5,
    },
    toast: true,
  },
});
```

`metadata` is used by WalletConnect/AppKit and future auth prompts to identify the dApp. Legacy fields (`appName`, `appDescription`, `appUrl`, `appIcons`) are still accepted, but new integrations should prefer `metadata`.

`walletConnect.mode: "default"` uses the official WalletConnect AppKit modal. Use `"list"` or `"group"` when you want XRPL Wallet Kit to render its custom wallet list and QR/deeplink panel.

## Xahau

The all-in-one client recognizes `xahau-mainnet` and `xahau-testnet` without
separate protocol/network imports. Xaman (with `xamanClientId`), GemWallet and
Xyra are enabled for those chains; the modal filters incompatible wallets.
Default Ledger remains XRPL-only pending device/app-specific Xahau acceptance.
For controlled Xahau device testing, explicitly include `"ledger"` in `wallets`
or supply a chain-aware Ledger adapter. This opt-in is not proof of support for
Invoke/HookParameters or any untested device/app; never enable blind signing
to make a test pass.

```ts
import { createWalletKit } from "@xrpl-wallet-kit/client";

const kit = createWalletKit({
  network: "xahau-testnet",
  xamanClientId: "YOUR_XAMAN_CLIENT_ID",
  preflight: { maxFeeDrops: "50000" }, // application-selected ceiling, not a fee recommendation
});

// Invoke from a user action. This factory does not connect automatically.
await kit.connect("xaman");
const signed = await kit.signTransaction({
  txJson: { TransactionType: "Payment", Destination: recipientAddress, Amount: "1000000" },
});
// To broadcast instead, call kit.signAndSubmit({ txJson: ... }) explicitly.
```

Supply a real classic recipient address. Xahau preparation fills Account,
NetworkID, Sequence, Fee and expiry, and verifies the complete signed result.
Global `preflight.maxFeeDrops`, request preflight caps and `request.maxFeeDrops`
combine using the lowest ceiling; `preflight: false` does not remove the global
protocol ceiling. Application preflight checks run on the input transaction;
the protocol then estimates/enforces the actual fee before wallet approval.

ESM consumers load the Xahau codec when first used for signing or transaction
lookup, not when importing the client or connecting. The IIFE automatically loads
`xrpl-wallet-kit-xahau.runtime.js` from its script directory on first Xahau use;
self-host both files and allow that directory in `script-src`. Pin the package
version so the main bundle and runtime match. XRPL-only defaults remain unchanged.
To opt an initially XRPL client into both chains, pass `networks: [...XAHAU_NETWORKS]`
using the lightweight preset export from this same client package. Explicit
`adapters` and `protocols` remain caller-owned and are not rewritten.

Direct RPC requires an endpoint accessible from the browser. If deployment
CORS requires a proxy, pass `xahau: { request }`, a trusted
`(network, method, params, signal) => Promise<result>` transport returning the
unwrapped RPC result. Never proxy arbitrary wallet-provided URLs.
The `client/selective` entry remains manual and does not import Xahau.

## Selecting Wallets

```ts
const kit = createWalletKit({
  wallets: ["xaman", "gemwallet", "dropfi", "ledger", "walletconnect"],
  walletConnectProjectId: "...",
  connectButton: "#connect-wallet",
});
```

Available built-in ids:

- `xaman`
- `gemwallet`
- `crossmark`
- `dropfi`
- `walletconnect`
- `xrpl-snap` or `xrplsnap`
- `ledger`
- `xyra` (included by default for Xahau; opt-in for XRPL)
- `otsu`

`ledger` is included in `wallets: "all"` by default. Because it is a hardware wallet, it does not silently restore after reload; users must reconnect the device and open the XRP app.

## Signing

```ts
const signed = await kit.signMessage({
  message: "Sign in to My XRPL App",
});

const submitted = await kit.signAndSubmit({
  txJson: {
    TransactionType: "Payment",
    Account: kit.getSession()?.account.address,
    Destination: "r...",
    Amount: "1000000",
  },
});
```

The client delegates to the active adapter. Apps do not need to branch by wallet id for supported methods.

## Recent Transactions

When `showRecentTransactions` is enabled, `manager.signAndSubmit()` records submitted transactions with a returned hash and the account panel can show compact rows with status, relative time, and an explorer link.

```ts
kit.manager.addTransaction({
  hash: "A1B2...",
  status: "submitted",
  account: kit.getSession()?.account,
});
```

## WalletConnect Sign Message Destination

Some WalletConnect wallets use a non-submitted transaction proof for message signing. Pass `walletConnectSignMessageDestination` when you want that proof transaction to use a known destination instead of the default.

```ts
createWalletKit({
  walletConnectProjectId: "...",
  walletConnectSignMessageDestination: "r...",
});
```

## Related

When `storage: "localStorage"` is used, all sessions are namespaced by configured
family and network, including XRPL mainnet/testnet/devnet. An old XRPL session
is copied once only when its complete registered network identity matches; normal
wallet verification still applies. Logout prevents that legacy session from being
imported again. Legacy data is not deleted and old transaction history is not
automatically migrated. Separate apps on the same network should use their own
storage, for example `createBrowserWalletStorage("my-app.xrpl.testnet.")`.
An injected storage object is always used as supplied.

- `@xrpl-wallet-kit/core` - headless manager and adapter contract
- `@xrpl-wallet-kit/ui` - modal, button, inline picker, and toast
- `@xrpl-wallet-kit/browser` - IIFE bundle for HTML/legacy apps
