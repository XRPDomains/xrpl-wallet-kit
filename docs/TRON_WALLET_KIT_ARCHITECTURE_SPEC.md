# Tron Wallet Kit Architecture Spec

This document defines how to build **Tron Wallet Kit** as a controlled chain port of XRPL Wallet Kit. The goal is not to design a new connector library from scratch. The goal is to map the proven XRPL Wallet Kit architecture 1:1, then replace only the chain-specific layer: Tron networks, Tron adapters, Tron transaction normalization, Tron balance lookup, explorer links, and Tron signature verification.

Important distinction: port the **architecture**, not the XRPL vocabulary. Public APIs, capabilities, method hints, docs, and examples must use Tron-native concepts and names.

## 1. Product Rule

Tron Wallet Kit must follow the same architectural boundaries as XRPL Wallet Kit:

- Core owns wallet/session/event/transaction lifecycle.
- Adapters own wallet-provider quirks and normalize wallet APIs.
- Client owns default adapter assembly and developer-friendly entrypoints.
- UI owns modal, button, account panel, toast, QR, theming, i18n, and layout.
- Browser owns the IIFE/CDN build for HTML/legacy apps.
- React/Next packages expose framework bindings only.
- Auth owns server-verifiable sign-in payloads and verification helpers.

Do not push adapter-specific logic into apps. Do not let apps branch on each wallet. Do not make UI call private adapter APIs. Do not keep XRPL-specific public names such as `payments`, `trustSet`, `nftOffers`, `acceptNFTOffer`, or `burnNFT`.

## 2. Monorepo Layout

Use the same package layout:

```txt
tron-wallet-kit/
  packages/
    core/
    client/
    ui/
    browser/
    react/
    next/
    auth/
    adapters/
      tronlink/
      walletconnect/
      okx/
      bitget/
      ledger/
  examples/
    react/
    html-legacy-bundle/
  website/
  tests/
  scripts/
  Review/
  PROJECT_MEMORY.md
  CHANGELOG.md
```

Package names:

```txt
@tron-wallet-kit/core
@tron-wallet-kit/client
@tron-wallet-kit/ui
@tron-wallet-kit/browser
@tron-wallet-kit/react
@tron-wallet-kit/next
@tron-wallet-kit/auth
@tron-wallet-kit/adapter-tronlink
@tron-wallet-kit/adapter-walletconnect
@tron-wallet-kit/adapter-okx
@tron-wallet-kit/adapter-bitget
@tron-wallet-kit/adapter-ledger
```

## 3. Core Package

`@tron-wallet-kit/core` is the stable internal contract. Keep the generic wallet primitives because they make adapters, UI, and React bindings portable:

```ts
WalletManager
WalletAdapter
BaseWalletAdapter
WalletNetwork
WalletAccount
WalletSession
WalletCapabilities
WalletEvents
WalletStorage
WalletTransaction
```

Export Tron aliases for developer clarity:

```ts
export type TronNetwork = WalletNetwork;
export type TronAccount = WalletAccount;
export type TronTransactionPayload = TransactionPayload;
```

## 4. Tron Network Model

Mirror XRPL Wallet Kit's network model, with Tron defaults:

```ts
export type WalletNetworkId = "mainnet" | "nile" | "shasta" | (string & {});

export interface WalletNetwork {
  id: WalletNetworkId;
  name: string;
  family?: "tron" | string;
  networkType: "MAINNET" | "TESTNET" | "DEVNET" | "CUSTOM";
  nativeAsset?: "TRX";
  nativeAssetDecimals?: 6;
  rpcUrl: string;
  httpRpcUrl?: string;
  walletConnectChainId?: string;
  explorerTxUrl?: string;
  explorerAccountUrl?: string;

  fullHost?: string;
  solidityNode?: string;
  eventServer?: string;
}
```

Default networks:

```txt
mainnet
nile
shasta
```

`showBalance: true` must work with default network config. A dApp should not need to load extra libraries just to show a TRX balance unless the docs explicitly document that optional mode.

## 5. Account Model

Normalize every wallet provider into one account shape:

```ts
export interface WalletAccount {
  address: string;       // Base58 T-address.
  hexAddress?: string;   // 41-prefixed hex address, if available.
  publicKey?: string;
  network?: WalletNetwork;
  networkType?: string;
  activationStatus?: "active" | "unfunded" | "unknown";
}
```

Adapters must hide provider-specific shapes such as `defaultAddress.base58`, `selectedAddress`, `address`, or `hex`. App code should only read `session.account.address`.

## 6. Adapter Contract

Keep the XRPL Wallet Kit adapter contract:

```ts
export interface WalletAdapter {
  adapterApiVersion?: "1.0" | "1.1" | string;
  metadata: WalletMetadata;
  capabilities: WalletCapabilities;

  isAvailable?: () => boolean | Promise<boolean>;

  connect(options: ConnectOptions): Promise<ConnectResult>;
  disconnect?: () => Promise<void>;

  restoreSession?: (session: WalletSession) => Promise<ConnectResult | null>;
  canRecoverSession?: (options: ConnectOptions) => boolean | Promise<boolean>;
  recoverSession?: (options: ConnectOptions) => Promise<ConnectResult | null>;
  cancelPendingConnection?: () => void | Promise<void>;

  signMessage?: (request: SignMessageRequest) => Promise<SignMessageResult>;
  signTransaction?: (request: SignTransactionRequest) => Promise<SignTransactionResult>;
  submitTransaction?: (request: SubmitTransactionRequest) => Promise<TxResult>;
}
```

The internal primitive should avoid XRPL-flavored names. Use `submitTransaction` or another neutral transaction-lifecycle name in core. Public client APIs should expose Tron-native names. See section 10.

Capabilities:

```ts
export interface WalletCapabilities {
  connect: boolean;
  disconnect?: boolean;
  signMessage?: boolean;
  signTransaction?: boolean;
  submitTransaction?: boolean;
  transferTrx?: boolean;
  transferTrc10?: boolean;
  transferTrc20?: boolean;
  tokenTransfer?: boolean;
  smartContract?: boolean;
  resourceManagement?: boolean;
  governance?: boolean;
  qr?: boolean;
  deeplink?: boolean;
}
```

## 7. Adapter Responsibilities

Each adapter must normalize wallet quirks internally:

- Detect provider availability safely.
- Wait briefly for injected providers during auto reconnect.
- Normalize account address.
- Normalize connection rejection.
- Normalize message signatures.
- Normalize signed transactions.
- Normalize broadcast transaction hash.
- Implement cleanup listeners.
- Throw on user cancel/reject.
- Never return successful objects with empty `signature`, `txBlob`, or hash fields.

The app should never need code like:

```ts
if (wallet === "tronlink") { ... }
if (wallet === "bitget") { ... }
```

That branching belongs inside adapters.

## 8. Wallet Manager Behavior

`WalletManager` should mirror XRPL Wallet Kit:

- `register(adapter)`
- `connect(adapterId)`
- `autoReconnect()`
- `disconnect()`
- `signMessage()`
- `signTransaction()`
- internal `submitTransaction()`
- `authenticate()`
- `addTransaction()`
- `getTransactions()`
- `getSession()`
- `getAccount()`
- `getCapabilities()`
- event emitter
- storage abstraction
- light transaction confirmation

Events:

```ts
connecting
connected
disconnected
error
qr
signing
signed
rejected
accountChanged
networkChanged
tx_submitted
tx_confirmed
tx_failed
session_restored
session_stale
session_expired
```

Important rule: after `session_restored`, also emit `connected`. Apps should be able to listen to `connected` for both manual connects and auto reconnects.

## 9. Sign Message Shape

Every adapter must return the same normalized result:

```ts
export type SignatureKind = "signature" | "signedTx";

export interface SignMessageResult {
  signatureKind: SignatureKind;
  proof?: string;
  signature?: string;
  txBlob?: string;
  publicKey?: string;
  raw?: unknown;
}
```

Preferred Tron result:

```ts
{
  signatureKind: "signature",
  signature: "...",
  proof: "...",
  raw
}
```

Fallback only if a wallet cannot sign raw messages and must sign a proof transaction:

```ts
{
  signatureKind: "signedTx",
  txBlob: "...",
  proof: "...",
  raw
}
```

If the user cancels, the adapter must throw. It must not return `{ signature: undefined }`, `{ signature: null }`, or `{ txBlob: "" }`.

## 10. Public Tron-Native API Naming

Do not expose XRPL-flavored transaction names as the main developer-facing API. The architecture can be ported 1:1, but the public vocabulary must be Tron-native.

Use neutral primitives in core:

```ts
manager.signMessage()
manager.signTransaction()
manager.submitTransaction()
```

Expose Tron-friendly wrappers from `@tron-wallet-kit/client`:

```ts
kit.signMessage(request)
kit.signTransaction(transaction)
kit.sendTransaction(transaction)
kit.transferTrx(request)
kit.transferTrc10(request)
kit.transferTrc20(request)
kit.triggerSmartContract(request)
kit.freezeBalance(request)
kit.unfreezeBalance(request)
kit.delegateResource(request)
kit.undelegateResource(request)
kit.voteWitness(request)
```

Recommended mapping:

```ts
kit.sendTransaction(tx)
// -> manager.submitTransaction({ transaction: tx, methodHint: "generic" })

kit.transferTrx({ to, amountSun })
// -> builds a Tron native transfer transaction
// -> manager.submitTransaction({ transaction, methodHint: "transferTrx" })

kit.transferTrc10({ tokenId, to, amount })
// -> builds a TRC10 transfer transaction
// -> manager.submitTransaction({ transaction, methodHint: "transferTrc10" })

kit.transferTrc20({ contractAddress, to, amount, feeLimit })
// -> builds a TRC20 transfer contract call
// -> manager.submitTransaction({ transaction, methodHint: "transferTrc20" })

kit.triggerSmartContract({ contractAddress, functionSelector, parameters, feeLimit })
// -> builds smart contract trigger transaction
// -> manager.submitTransaction({ transaction, methodHint: "triggerSmartContract" })

kit.freezeBalance({ amountSun, resource })
// -> builds freeze/stake transaction according to the target Tron API version
// -> manager.submitTransaction({ transaction, methodHint: "freezeBalance" })

kit.delegateResource({ to, amountSun, resource })
// -> builds resource delegation transaction
// -> manager.submitTransaction({ transaction, methodHint: "delegateResource" })
```

`SubmitTransactionRequest.methodHint` should use Tron-native values:

```ts
type TronMethodHint =
  | "transferTrx"
  | "transferTrc10"
  | "transferTrc20"
  | "triggerSmartContract"
  | "freezeBalance"
  | "unfreezeBalance"
  | "voteWitness"
  | "delegateResource"
  | "undelegateResource"
  | "generic";
```

This gives app developers a clean Tron API while keeping the manager lifecycle identical to XRPL Wallet Kit.

## 11. Client Package

`@tron-wallet-kit/client` is the primary developer entrypoint:

```ts
createWalletClient(options)
createWalletKit(options)
```

Example:

```ts
const kit = createWalletKit({
  appName: "My Tron dApp",
  network: "mainnet",
  wallets: "all",
  autoReconnect: true,
  walletConnectProjectId: "...",
  ui: {
    themeMode: "auto",
    showRecentTransactions: true
  },
  connectButton: {
    target: "#connect-wallet",
    showBalance: true
  }
});
```

Return shape:

```ts
{
  manager,
  modal,
  button,
  toast,
  openModal,
  closeModal,
  disconnect,
  refreshBalance,
  refreshAccount,
  getSession,
  signMessage,
  signTransaction,
  sendTransaction,
  transferTrx,
  transferTrc10,
  transferTrc20,
  triggerSmartContract,
  freezeBalance,
  unfreezeBalance,
  delegateResource,
  undelegateResource,
  voteWitness
}
```

`submitTransaction` may still be available on `manager`, but docs should guide users toward `sendTransaction`, `transferTrx`, `transferTrc10`, `transferTrc20`, `triggerSmartContract`, and resource/governance helpers.

## 12. UI Package

`@tron-wallet-kit/ui` should port the XRPL UI surfaces:

- Wallet modal
- Wallet button
- Account panel
- Address QR modal
- Wallet toast
- Recent transactions
- Theme tokens
- Light/dark/auto mode
- i18n
- WalletConnect QR/details views

Rules learned from XRPL Wallet Kit:

- Do not let modal frames jump unnecessarily.
- Connect modal, account panel, address QR, and custom QR views must feel like one app.
- Recent transactions may increase account panel height, but must never overlap hero/account controls.
- Do not hardcode colors; use theme tokens.
- Avoid heavy shadow hover states.
- Long errors must be clamped or wrapped safely.
- Brand footer text is not translation text.
- QR views should support a light QR mode if dark QR is hard to scan.

## 13. Browser Package

`@tron-wallet-kit/browser` must provide an IIFE/CDN build:

```html
<script src="https://cdn.jsdelivr.net/npm/@tron-wallet-kit/browser/dist/tron-wallet-kit.iife.min.js"></script>
```

Global:

```js
window.TronWalletKit
```

Requirements:

- Version banner at the top of the bundle.
- Smoke test after browser build.
- No truncated bundles.
- No hidden dependency on extra global libraries unless documented.
- HTML legacy docs must use the browser bundle directly.

## 14. React and Next Packages

Expose bindings similar to XRPL Wallet Kit:

```ts
TronWalletProvider
useWalletKit()
useWalletSession()
useWalletAccount()
useWalletStatus()
useWalletCapabilities()
```

Status:

```ts
"disconnected" | "connecting" | "connected"
```

Provider must react to:

```ts
connected
disconnected
accountChanged
networkChanged
session_restored
session_stale
session_expired
```

## 15. Auth Package

`@tron-wallet-kit/auth` mirrors XRPL Wallet Kit auth:

```ts
createSignInMessage()
verifySignIn()
generateNonce()
verifyTronSignature()
```

Auth result:

```ts
{
  address,
  message,
  signatureKind,
  proof,
  signature?,
  txBlob?,
  publicKey?,
  issuedAt,
  expiresAt,
  statement,
  raw?
}
```

The first implementation should fully support `signatureKind: "signature"`. `signedTx` can be added when a wallet requires transaction-based proof.

## 16. Transaction Lifecycle

Every transaction-like action should enter the same lifecycle:

```txt
sendTransaction / transferTrx / transferTrc10 / transferTrc20 / triggerSmartContract
  -> manager.submitTransaction()
  -> signing event
  -> adapter signs and broadcasts
  -> normalize tx hash
  -> addTransaction()
  -> tx_submitted
  -> light confirmation lookup
  -> tx_confirmed / tx_failed / unknown
```

If confirmation retries expire, mark as `unknown`, not `failed`. Show an explorer link so the user can inspect the transaction.

## 17. Recent Transactions

Config:

```ts
ui: {
  showRecentTransactions: true,
  maxVisibleTransactions: 5
}
```

Recent transactions should be opt-in. If enabled and transactions exist, they appear in the account panel. The list should scroll internally and must not overlap the account hero or action buttons.

## 18. Balance

Balance runs only when `showBalance` is enabled.

Expose balance in session:

```ts
session.balance = {
  value,
  formatted,
  symbol: "TRX",
  spendable,
  raw
}
```

Refresh balance on:

- `connected`
- `accountChanged`
- `networkChanged`
- after submitted/confirmed transaction if `showBalance` is enabled
- manual `kit.refreshBalance()`

Do not poll continuously by default.

## 19. Identity Extension Point

Do not hardcode a name service into core. Keep an optional identity resolver:

```ts
ui.identity.resolver
kit.refreshIdentity()
```

Tron identity/name support can be added later without changing manager, adapters, or account panel contracts.

## 20. WalletConnect

WalletConnect behavior should follow XRPL Wallet Kit lessons:

- Default mode uses the official WalletConnect/AppKit modal unless the developer explicitly chooses custom list/group/details mode.
- Custom QR is used only for list/group/details modes.
- Detect stale pairings and clear them safely.
- Do not let timeout logic swallow valid wallet responses.
- Test signMessage and transaction flows per wallet.
- UI renders QR; adapter owns WalletConnect session logic.

## 21. Storage

Use storage abstraction everywhere:

```ts
interface WalletStorage {
  getItem(key: string): string | null | Promise<string | null>;
  setItem(key: string, value: string): void | Promise<void>;
  removeItem(key: string): void | Promise<void>;
}
```

Session envelope:

```ts
{
  version: 1,
  session,
  updatedAt
}
```

Do not call `window.localStorage` directly inside adapters for recovery markers. Use `WalletStorage`.

## 22. Adapter README Standard

Each adapter README must include:

```txt
Overview
Install
Capabilities
Provider detection
Connect flow
Auto reconnect behavior
Sign message behavior
Sign transaction behavior
Send transaction behavior
Known wallet quirks
Example
Troubleshooting
```

## 23. Website Docs

Mirror XRPL Wallet Kit docs structure:

```txt
Introduction
Installation
Quick Start
Configuration
Theme Builder
Recent Transactions
Authentication
Adapters Overview
Adapter: TronLink
Adapter: WalletConnect
React
Next
HTML Legacy
Browser/CDN
Release Notes
```

Whenever npm version is bumped, also sync the website menu/header version and browser bundle cache/version references.

## 24. Quality Gates

Recommended scripts:

```json
{
  "build": "tsc -b && node scripts/fix-esm-extensions.mjs",
  "build:browser": "npm run build && npm --workspace @tron-wallet-kit/browser run build && npm run smoke:browser",
  "typecheck": "tsc -b --pretty false",
  "test": "npm run build && node --import tsx --test tests/*.test.ts",
  "smoke:browser": "node tests/browser-bundle-smoke.mjs",
  "check:quality": "npm run typecheck && npm run check:deps && npm run check:unused:report && npm run check:duplicates:report"
}
```

Do not mark a phase complete unless these relevant checks pass:

```txt
npm run build
npm test
npm run build:browser
npm --prefix website run build
```

## 25. Project Memory

Keep:

```txt
PROJECT_MEMORY.md
Review/
CHANGELOG.md
```

Record every important decision:

- Adapter quirks
- UI sizing rules
- WalletConnect behavior
- Sign message result shape
- Auth verification constraints
- Browser bundle pitfalls
- NPM and GitHub release process

This prevents session drift and avoids reintroducing already-fixed issues.

## 26. Non-Negotiables

- Do not build Tron Wallet Kit as a single connector file.
- Do not make dApps branch by wallet provider.
- Do not duplicate modal and inline rendering logic unnecessarily.
- Do not hardcode UI colors or dimensions outside theme/config tokens.
- Do not hide adapter quirks in app examples.
- Do not skip browser/HTML legacy support.
- Do not skip auth; sign-in is a strategic feature.
- Do not publish without browser smoke tests.

## 27. Porting Summary

The correct implementation strategy:

```txt
XRPL Wallet Kit architecture
  -> keep package/module/API/event/UI/docs/test/release discipline
  -> replace XRPL networks with Tron networks
  -> replace XRPL adapters with Tron adapters
  -> replace XRPL transaction normalization with Tron transaction normalization
  -> replace XRPL public vocabulary with Tron-native public APIs
  -> replace XRPL balance resolver with Tron balance resolver
  -> replace XRPL explorer links with Tron explorer links
  -> replace XRPL auth verifier with Tron signature verifier
```

Short instruction for the implementation agent:

> Do not design Tron Wallet Kit as a new connector library. Port XRPL Wallet Kit 1:1 at the architectural level. Keep the manager, adapter, UI, browser, React, auth, docs, tests, and release discipline. Replace the chain-specific layer and the public chain vocabulary. Public APIs should use Tron-native names such as `sendTransaction`, `transferTrx`, `transferTrc10`, `transferTrc20`, `triggerSmartContract`, `delegateResource`, and `voteWitness`. Do not expose XRPL-oriented concepts such as `payments`, `trustSet`, `nftOffers`, or `burnNFT` in the Tron public API.
