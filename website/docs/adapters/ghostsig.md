# GhostSig (Experimental)

Implemented in the current workspace, **not yet published on npm or CDN latest**.
Live passkey/testnet validation remains open in
[issue #34](https://github.com/XRPDomains/xrpl-wallet-kit/issues/34).

GhostSig is a hosted wallet opened in a popup. It is not an extension or
WalletConnect wallet. The kit declares it as `type: "web"`, group `Web wallets`.
Availability means the browser can open popups, not that passkey/PRF is supported.

## Workspace Usage

```ts
import { WalletManager } from "@xrpl-wallet-kit/core";
import { createGhostsigAdapter } from "@xrpl-wallet-kit/adapter-ghostsig";

const manager = new WalletManager({
  network: "testnet",
  adapters: [createGhostsigAdapter({ timeoutMs: 60000 })]
});
await manager.connect("ghostsig"); // invoke from a user gesture
const result = await manager.signTransaction({
  txJson: { TransactionType: "AccountSet", Account: manager.getAccount()!.address, SourceTag: 0 }
});
console.log(result.txBlob);
```

Install `xrpl` v4/v5 alongside this adapter when it is released. Compact message
signing is unsupported; do not use this adapter for the kit's sign-in flow.
Payments/nftOffers product capabilities stay disabled until live validation.
Only the kit's standard mainnet/testnet/devnet configurations are accepted;
custom RPC/network definitions are refused before the popup opens.

## Selective Client and IIFE

```ts
import { createWalletClient } from "@xrpl-wallet-kit/client/selective";
import { createGhostsigAdapter } from "@xrpl-wallet-kit/adapter-ghostsig";
const manager = createWalletClient({ network: "testnet", adapters: [createGhostsigAdapter()] });
```

The locally built browser bundle exports `XRPLWalletKit.createGhostsigAdapter`.
All-in-one setup can use `wallets: ["ghostsig"]` and optional
`ghostsig: { timeoutMs: 60000 }`. Merely providing the option does not enable it.
Neither the default wallet list nor `wallets: "all"` includes GhostSig.
The existing jsDelivr `@latest` URL stays unchanged, but will not expose these
exports until a new coordinated npm release is published. Do not add this wallet
to CDN-based playground/theme-builder lists before that release.

## Signing and Submission

The popup receives protocol v1 requests pinned to `https://ghostsig.dev`.
Replies must match source, origin, version and an unpredictable request ID.
Address/key binding, signature, transaction hash and original fields are
verified before returning a signed blob. Only missing Sequence/Fee/
LastLedgerSequence may be added by the wallet; requested values cannot change.
Transactions containing signing fields, multisign or unsupported metadata are
refused. Cached restore opens no popup and is not fresh authentication; the
next signature re-proves the stored address and key.

Provide an explicit uint32 `SourceTag` (`0` is allowed). The current wallet adds
its own tag when omitted, so the adapter refuses missing tags before opening a
popup rather than accepting an unrequested field. A wallet correction of an
explicit Sequence is also rejected; prepare a fresh transaction. Other wallet
adapters and existing dApp transaction flows are unchanged.

Sign-and-submit succeeds only for the wallet's reported validated `tesSUCCESS`
with a ledger index. It is not independently checked against a ledger node.
Uncertain outcomes throw with verified hash/raw transaction in error details.
Always inspect that hash before retrying. Cancellation/timeout after dispatch
does not prove that a transaction was never submitted. A progress provider hash
is unverified until the full signed transaction is received and checked.

## Popup Deployment

Use HTTPS or localhost development and allow popups. If setting COOP, use
`Cross-Origin-Opener-Policy: same-origin-allow-popups`; `same-origin` severs the
opener. `noopener` and `noreferrer` are incompatible. The wallet's own CSP
governs its page; your normal script CSP must allow your application bundle.
Allow `https://ghostsig.dev` in `img-src` for the official hosted PNG icon.
Only the production origin or explicitly configured `http://localhost` URL is
accepted. Do not deploy a wallet copy on an arbitrary production origin.

Every terminal request removes listeners/timers and closes its popup.
Disconnect clears local state, not remote passkeys. Popup reuse is intentionally
deferred; every signature needs a fresh user gesture to avoid popup blocking.

## Local Test

React preview opts in with `?ghostsig=1`, switches that preview to testnet and
uses a separate session storage prefix. The normal React preview is unchanged.
Record connect, reconnect, sign-only, submit, reject, timeout and wallet-switching
results with the wallet build/date before treating the adapter as production-ready.
