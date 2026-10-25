# Adapters Overview

An adapter connects Kit's standard manager API to a wallet provider. DApps use the same connection and signing methods, while each adapter declares the operations its wallet can actually perform.

## Built-In Adapters

| Adapter | Adapter ID | Package | Wallet type |
|---|---|---|---|
| [Xaman](/docs/adapters/xaman) | `xaman` | `@xrpl-wallet-kit/adapter-xaman` | Mobile app |
| [GemWallet](/docs/adapters/gemwallet) | `gemwallet` | `@xrpl-wallet-kit/adapter-gemwallet` | Extension |
| [Joey Wallet](/docs/adapters/joey-wallet) | `joey-wallet` | `@xrpl-wallet-kit/adapter-joey-wallet` | Extension |
| [Crossmark](/docs/adapters/crossmark) | `crossmark` | `@xrpl-wallet-kit/adapter-crossmark` | Extension |
| [DropFi](/docs/adapters/dropfi) | `dropfi` | `@xrpl-wallet-kit/adapter-dropfi` | Extension / mobile in-app browser |
| [GhostSig](/docs/adapters/ghostsig) | `ghostsig` | `@xrpl-wallet-kit/adapter-ghostsig` | Hosted popup |
| [Xyra](/docs/adapters/xyra) | `xyra` | `@xrpl-wallet-kit/adapter-xyra` | Hosted popup |
| [Ledger](/docs/adapters/ledger) | `ledger` | `@xrpl-wallet-kit/adapter-ledger` | Hardware device |
| [XRPL Snap](/docs/adapters/xrpl-snap) | `xrplsnap` | `@xrpl-wallet-kit/adapter-xrpl-snap` | MetaMask Snap |
| [WalletConnect](/docs/adapters/walletconnect) | `walletconnect` | `@xrpl-wallet-kit/adapter-walletconnect` | Multi-wallet protocol |

Use `joey-wallet` for the native Joey extension. The WalletConnect detail entry `joey` is a different connection path. The client also accepts `xrpl-snap` as an alias; the registered Snap adapter ID is `xrplsnap`.

## Client Registration and Networks

| Adapter | Default XRPL client | Xahau client |
|---|---|---|
| Xaman | With `xamanClientId` | With `xamanClientId` |
| GemWallet | Included | Included |
| Joey Wallet | Explicit opt-in | Not supported |
| Crossmark | Included | Not supported |
| DropFi | Included | Not supported |
| GhostSig | Explicit opt-in | Not supported |
| Xyra | Explicit opt-in | Included |
| Ledger | Included | Explicit opt-in; device app dependent |
| XRPL Snap | Included | Not supported |
| WalletConnect | With `walletConnectProjectId` | Not supported |

`wallets: "all"` follows the defaults above; it does not add opt-in Joey Wallet, GhostSig or XRPL Xyra. Select their IDs explicitly. Wallets unsupported on the selected chain are filtered from the modal.

For Xahau presets, protocol setup and the required positive fee ceiling, see [Xahau Configuration](/docs/configuration/xahau). Ledger uses XRP on XRPL and XAH on Xahau; connection alone is not proof of support for every transaction type.

## Capability Matrix

This matrix describes manager-level XRPL operations, not identical provider APIs or every wallet version.

| Adapter | Sign only | Sign and submit | `signMessage()` proof | Native `signIn()` | Session restore |
|---|---|---|---|---|---|
| Xaman | Yes, fallback | Yes | `signedTx` | No | Matching XRPL SDK account |
| GemWallet | Provider dependent | Yes | `signature` | No | Matching passive XRPL account |
| Joey Wallet | Yes | Yes | Not exposed | Yes | Existing grant and matching network |
| Crossmark | Not exposed | Yes | `signature` | No | Matching passive account |
| DropFi | Not exposed | Yes | `signature` | No | Matching passive account |
| GhostSig | Yes | Yes | Not exposed | No | Cached account/key, not fresh authentication |
| Xyra | Yes | Yes | Not exposed | No | Reconnect required |
| Ledger | Yes | Yes | Not exposed | No | Fresh device connection required |
| XRPL Snap | Not exposed | Yes | `signedTx` | No | Cached account, not fresh verification |
| WalletConnect | Wallet dependent | Wallet dependent | `signedTx`, wallet dependent | No | Active generic session; not detail entries |

Xaman routes `manager.signTransaction()` through its declared sign-only transaction mode. GemWallet needs a provider with `signTransaction`; WalletConnect needs a wallet that returns a blob without broadcasting. Ledger and Snap transaction types depend on the installed app/Snap.

All integrations can clear the local Kit session using `manager.disconnect()`. This is different from a provider-level disconnect or revoking site permissions: GemWallet, Crossmark and XRPL Snap do not expose such a provider operation through Kit.

Check the active adapter before offering an action:

```ts
const canSignOnly = manager.can("signTransaction");
const canSignMessage = manager.can("signMessage");
const canSignIn = manager.can("signIn");
```

Generic `txJson` signing does not automatically imply Batch, multisigning or support for every amendment. See the adapter's Capabilities and Integration Notes sections.

<div id="recommended-setup"></div>

## Connect

```ts
import { createWalletKit } from "@xrpl-wallet-kit/client";

const kit = createWalletKit({
  network: "mainnet",
  wallets: ["xaman", "gemwallet", "joey-wallet"],
  xamanClientId: "YOUR_XAMAN_CLIENT_ID",
  ui: { walletList: { layout: "auto" } },
});

const { account } = await kit.connect("gemwallet");
```

Each adapter guide provides equivalent Client and Core examples. Use the Client helper for automatic registration or construct a `WalletManager` with explicit adapters for a selective integration. Connect and sign from user actions so wallet approval UI can open.

## Transactions

Use `manager.signAndSubmit({ txJson })` or `manager.signTransaction({ txJson })` when supported. Adapter guides use the same Payment and NFT examples, with wallet-specific limits stated beside them. A hash or preliminary `submitted` result is not validated ledger success; observe [WalletManager events](/docs/api/wallet-manager#events) before declaring completion.

For Xahau payments, URI tokens, Invoke and Hook parameters, use the [Xahau examples](/docs/configuration/xahau) rather than assuming XRPL NFT transaction names apply unchanged.

<div id="message-signing-result-shape"></div>

## Authentication

`signMessage()` and native `signIn()` solve different integration cases:

- **Message authentication:** GemWallet, Crossmark and DropFi return compact `signature` proofs. Xaman, WalletConnect and XRPL Snap return `signedTx` transaction proofs. Inspect `signatureKind` and use the correct [backend verifier](/docs/auth/introduction).
- **Wallet-native sign-in:** Joey Wallet exposes a separate `signIn()` flow with CAIP-122 or Ledger-backed challenge proofs. Use its [native sign-in verifier](/docs/auth/native-sign-in), not the message-auth verifier.

A successful connection or restored account is not a server login session. Authentication requires a server-issued challenge, signature/account/context verification and replay protection. Never broadcast a transaction used only as an authentication proof.

<div id="session-restore"></div>
<div id="availability-detection"></div>

## Sessions and Availability

Call `manager.autoReconnect()` on startup where restore is supported. Read each adapter's Sessions and Disconnect section: passive provider verification, cached metadata and explicit reconnect are different guarantees. Xahau integrations require reconnecting after reload.

The Installed badge reports passive availability, not permission to sign or an authenticated account. A provider may appear after initial page load; allow detection to refresh and verify extension site access before reporting it missing.

<div id="walletconnect-modes"></div>

## Related Guides

- [Installation](/docs/installation)
- [WalletManager](/docs/api/wallet-manager)
- [Message Authentication](/docs/auth/introduction)
- [Wallet-Native Sign In](/docs/auth/native-sign-in)
- [Xahau Configuration](/docs/configuration/xahau)
