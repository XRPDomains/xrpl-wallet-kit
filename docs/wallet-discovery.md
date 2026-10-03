# XRPL Wallet Discovery

## Decision

Reuse the existing Wallet Standard registration handshake instead of introducing
another XRPL-specific window event protocol or competing provider global.
`wallet-standard:register-wallet` and `wallet-standard:app-ready` are handled by
`@wallet-standard/app`. The bridge supports the XRPL single-input signing feature
shapes published by tequdev/XLS-72d. This is interoperability with that feature
contract, not a claim that every injected XRPL wallet implements it.

Primary references:

- [Wallet Standard app registry](https://github.com/wallet-standard/wallet-standard/blob/master/packages/core/app/src/wallets.ts)
- [Wallet Standard wallet-side registration](https://github.com/wallet-standard/wallet-standard/blob/master/packages/core/wallet/src/register.ts)
- [XRPL sign-only feature](https://github.com/tequdev/xrpl-wallet-standard/blob/main/packages/core/src/features/XRPLSignTransaction.ts)
- [XRPL sign-and-submit feature](https://github.com/tequdev/xrpl-wallet-standard/blob/main/packages/core/src/features/XRPLSignAndSubmitTransaction.ts)

The older Wallet Standard `DESIGN.md` explicitly says it is outdated. The current
implementation's events, not `navigator.wallets` or an EIP-6963 announcement, are
the discovery mechanism used here.

## App Integration

Discovery is opt-in. No change is needed for existing configured adapters.

```ts
import { WalletManager, startWalletStandardDiscovery } from "@xrpl-wallet-kit/core";

const manager = new WalletManager({ adapters: legacyAdapters });
const discovery = startWalletStandardDiscovery(manager);

manager.on("walletsChanged", ({ wallets }) => renderWalletList(wallets));
// Existing connect/sign APIs operate on the discovered metadata.id.
// During explicit app teardown:
discovery.dispose();
manager.destroy();
```

Call discovery in the browser, before mounting the React provider/modal. In
Next.js, start it in a client effect, never during SSR; clean up the returned
controller. The headless module is safe to import on the server, but starting
discovery there requires a supplied registry. The current Wallet Standard
dependencies require Node 22+ for tooling. Importing core does not start discovery
or register a window listener. The browser IIFE also exposes these core helpers.

Both pre-existing and subsequently registered compatible wallets appear without
a wallet-kit release. `getAdapters()` returns discovery-owned adapters. Registration
does not connect, enumerate unauthorized accounts, scan provider globals, or open
wallet UI. Existing adapters and discovered wallets coexist; discovery never
overwrites an ID already present in the manager. `walletsChanged` updates the
React context and an already-open built-in picker.

## Wallet and Feature Contract

- Wallet version `1.0.0`, a name, an XRPL chain, `standard:connect` and
  `standard:events`, both feature version `1.0.0`, are required.
- Optional `standard:disconnect` maps to adapter disconnect.
- `xrpl:signTransaction` version `1.0.0` receives
  `{ tx_json, account, network }` and returns `{ signed_tx_blob }`.
- `xrpl:signAndSubmitTransaction` version `1.0.0` receives the same input and
  returns `{ tx_hash, tx_json? }`.
- Account objects remain the provider's authorized account objects. The selected
  account must support the requested chain and signing feature before dispatch.
- No message signing, multisign, or network switching capability is inferred.
  Unknown feature versions are not invoked. `submit: false` always uses the
  sign-only feature and never falls through to submit.

Wallet/account chain IDs map through the network's `walletConnectChainId`;
`xrpl:0`, `xrpl:1`, and `xrpl:2` are mainnet/testnet/devnet. The tequdev reserved
aliases are normalized. Custom chains need an explicit configured network mapping;
the kit does not infer RPC endpoints from wallet-provided strings.

Account/network authorization is checked before signing, transaction input is
copied, and conflicting `Account` or `walletPayload` inputs fail closed. Control
fields such as AbortSignal and local request IDs never enter wallet feature input.
The request cancellation semantics in [Request Lifecycle](request-lifecycle.md)
apply; cancellation cannot undo a provider submit.

## Identity, Restoration, and Trust

The registry distinguishes wallet objects, not their display names. Default kit
IDs are opaque per-page IDs, so two wallets with the same name can coexist. Names,
icons, accounts, and features are untrusted page-level claims, not authenticated
extension identity. A page script can forge a Standard wallet. Discovery is not an
attestation mechanism or a security boundary against hostile scripts/extensions.

Default discovered adapters do not restore persisted sessions across reloads.
An app that has an explicit, trusted wallet-identity policy can opt into stable IDs:

```ts
const discovery = startWalletStandardDiscovery(manager, {
  resolveId: wallet => trustedWalletIds.get(wallet) ?? null,
  allowRestore: true,
});
```

`trustedWalletIds` must come from the app's explicit trust policy, not merely a
wallet name comparison. `resolveId` may exclude wallets by returning null. ID
collisions are skipped, never resolved by silently replacing a configured adapter.
Restoration reads only already-authorized `wallet.accounts`, requires the stored
address and chain, and never calls connect, even with a `silent` flag. Start
discovery before `manager.autoReconnect()` when restoration is enabled.

Only bounded raster base64 data-URI icons are forwarded automatically (PNG/WebP/GIF,
up to 256 KiB of URI text). Remote, executable, malformed, and SVG icons are omitted;
the picker uses its fallback. Discovery metadata is rendered as text, not HTML.

## Changes and Cleanup

The bridge subscribes to `standard:events` changes and reads the wallet's current
properties. Authorized account changes update the manager, cancelling pending
signing through the existing account-change path. Account revocation or losing
the configured chain clears the local session without requesting a wallet logout.
The adapter uses the new authorization for subsequent signing; it does not silently
switch the application to an unknown chain.

Registry unregister removes only discovery-owned adapters. It cancels their
pending local operations and prevents late connect/restore results from activating
a removed wallet. Explicit `discovery.dispose()` unregisters those adapters and
detaches subscriptions. `manager.destroy()` detaches discovery subscriptions and
local waits without logging the provider out or deleting its persisted session.
The upstream shared registry keeps its page-lifetime handshake listener; a single
dapp controller must not tear down another controller's shared registry.

## Legacy Wrappers and Wallet-Side Reference

`createWalletStandardWallet(adapter, { networks, icon })` wraps an existing adapter
without touching its injected global. Explicit connect delegates to the provider;
silent connect returns only authorization already held by this wrapper. It exposes
only implemented signing modes, validates account identity/network, and preserves
sign-only versus submit. The first configured network is the connection network;
the wrapper does not implicitly switch a legacy provider between chains. Only the
connected account's chain is authorized for signing.

Example wallet-side registration in the injected page context:

```ts
import { registerWallet } from "@wallet-standard/wallet";
import { createWalletStandardWallet } from "@xrpl-wallet-kit/core";

const standardWallet = createWalletStandardWallet(myInjectedProviderAdapter, {
  networks: [testnet],
  icon: "data:image/png;base64,...", // actual wallet icon bytes
});
registerWallet(standardWallet);
// Relay authorized provider events, and unsubscribe those provider listeners
// when the provider bridge is disposed:
provider.onAuthorizedAccountChanged(account => standardWallet.updateAccount(account));
provider.onAuthorizationRevoked(() => standardWallet.updateAccount(null));
```

These provider event names are illustrative; map the real provider's event API.
Only relay accounts authorized to the dapp, not a wallet UI's unrelated selection.
An app-side wrapper can instead use `getWallets().register(standardWallet)` from
`@wallet-standard/app`; retain its unregister callback. Do not register the same
legacy wallet twice in the same manager unless presenting both entries is intended.
Existing first-party adapters remain unchanged and usable without wrappers.

## Validation

Automated tests cover the official event handshake in both startup orders,
duplicate registration/names, legacy coexistence and wrappers, version/chain
filtering, signing modes, account revocation, unregister/destroy, passive restore,
late registration in React, and connection/restoration races. Real extension and
webview compatibility still needs manual wallet-side QA.
