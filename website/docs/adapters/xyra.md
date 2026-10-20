# Xyra (Experimental)

Introduced in 0.1.20 as an experimental opt-in standalone npm adapter, not
included in the default client or CDN bundle. Track acceptance in [issue #49](https://github.com/XRPDomains/xrpl-wallet-kit/issues/49).
Official wallet documentation: [Xyra developers](https://www.xyra.now/developers).

```ts
import { createWalletClient } from "@xrpl-wallet-kit/client/selective";
import { createXyraAdapter } from "@xrpl-wallet-kit/adapter-xyra";

const manager = createWalletClient({
  network: "mainnet",
  adapters: [createXyraAdapter({ maxFeeDrops: "1000000" })]
});
await manager.connect("xyra"); // user gesture
const result = await manager.signTransaction({
  txJson: { TransactionType: "AccountSet", Account: manager.getAccount()!.address }
});
console.log(result.txBlob);
```

The local React and vanilla previews expose Xyra through wallet checkboxes.
Vanilla defaults to sign-only. This does not change default client wallets or
the CDN bundle. Default: standard XRPL mainnet/testnet; devnet/custom RPC are
rejected. Unreleased Xahau mainnet/testnet support requires opt-in
`supportedChains` plus the optional injected protocol runtime.
signMessage/payments/nftOffers are not advertised.
No passive restore is available; reconnect requires fresh approval.

The adapter checks exact popup origin/source, account-key binding, transaction
signature/hash and requested intent. Only missing Fee/Sequence/LastLedgerSequence
can be filled, with bounded fee and uint32 sequence/ledger fields. The protocol
has no echoed request ID; fresh popup instances and one pending request provide
local correlation. The published SDK is not loaded because its receiver and
lifecycle do not satisfy these checks and its default import is not SSR-safe.

**Submission caveat:** the live wallet currently returns broadcast results,
not final ledger validation. The adapter refuses to present preliminary
tesSUCCESS as confirmed success. Accepted broadcasts return `status: "submitted"`;
wait for WalletManager's `tx_confirmed` event or check the ledger. Inspect the
preserved hash/raw outcome before retrying an outcomeUnknown error. Sign-only
returns a verified txBlob and rejects any submission report.

Normalized XRPL statuses are `signed`, `submitted` and `confirmed`; a validated
wallet reply uses `confirmed`, with the original engine result kept in `raw`.
Independent ledger confirmation remains preferable. Submit failures use
`SUBMIT_FAILED`; a verified `submitted: false` reply reports
`outcomeUnknown: false`, while unverifiable replies may remain uncertain.

Allow popups, preserve origin in Referrer-Policy, and use COOP
same-origin-allow-popups if configured. no-referrer, noopener and noreferrer can
break the flow or domain verification. Allow data: in img-src for the embedded
official icon. Requests contain base64 transaction JSON in the popup URL;
never put secrets in transaction metadata. Local availability detection is
not proof of wallet or passkey readiness.

Safari/macOS and Safari/iOS popup behavior after asynchronous dApp preflight
still requires live verification; Chrome tests do not establish compatibility.

Live approval, signing, network switching, mobile and recovery acceptance are
still pending. See the package README for the protocol review and fee limits.
