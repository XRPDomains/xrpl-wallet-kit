# @xrpl-wallet-kit/adapter-xyra

Experimental, standalone opt-in Xyra adapter, introduced in 0.1.20.
Not included in the default client or CDN bundle.
Tracking: [issue #49](https://github.com/XRPDomains/xrpl-wallet-kit/issues/49).
No live wallet approval or ledger acceptance has been performed by the agent.

## Usage

```ts
import { createWalletClient } from "@xrpl-wallet-kit/client/selective";
import { createXyraAdapter } from "@xrpl-wallet-kit/adapter-xyra";

const manager = createWalletClient({
  network: "mainnet",
  adapters: [createXyraAdapter({ timeoutMs: 60000, maxFeeDrops: "1000000" })]
});
await manager.connect("xyra"); // invoke from a user gesture
const signed = await manager.signTransaction({
  txJson: { TransactionType: "AccountSet", Account: manager.getAccount()!.address }
});
console.log(signed.txBlob);
```

Local previews can use source imports. The published package exports
XyraAdapter, createXyraAdapter, XyraAdapterOptions and XYRA_ICON. No default
client/browser wallet list is changed. The React and vanilla local previews
include Xyra in their wallet checkboxes, defaulting to mainnet; vanilla
transaction forms default to sign-only. This does not enable it on CDN latest.

## Protocol and SDK Review

Official reference: https://www.xyra.now/developers.
Reviewed @xyrawallet/sdk 0.3.0 from the npm registry on 2026-10-06, MIT metadata,
no declared runtime dependencies, tarball SHA-1
3dcb46dd1b8ffadcd1830d485b853eaf2a4a1475. Its declared GitHub repository was
not accessible during review. The published SDK is the protocol reference,
not a runtime dependency: its default singleton touches window on import,
its receiver checks origin without popup source/correlation, and its waiting
timeouts/close monitoring lack deterministic cancellation cleanup.

The adapter pins https://wallet.xyra.now and uses /connect and /sign, network
xrpl-mainnet or xrpl-testnet, base64 JSON tx and explicit submit=true only for
submission. It also sends the SDK's explicit SIGN submit message after 500ms.
No arbitrary wallet URL, devnet, custom RPC or Xahau configuration is accepted.

Live connect/sign page bundles were inspected on 2026-10-06 (wallet Next build
_6oC_6dfbFar35mjXeVRD). Replies use CONNECT_RESPONSE and SIGN_RESPONSE. The
protocol has no echoed request ID. The adapter therefore binds each operation
to a fresh randomly named popup, exact event.source, origin and response type,
with one pending request. Do not describe this as an ID-correlated protocol.

## Capabilities and Limits

- connect/disconnect, signTransaction and explicit signAndSubmit are implemented.
- signMessage is disabled until message encoding/proof is verified end to end.
- payments/nftOffers remain disabled until live tests of those families.
- Passive restore is intentionally omitted: there is no passive provider-session
  signal in the reviewed protocol. Reconnect requires user approval, not an
  unchecked cached address presented as a current wallet session.
- No multisign, batch co-signing or payment-channel message-signature support.

Account public key must derive the returned address. Each signed blob is decoded
and checked for the connected signer, cryptographic signature, hash, expected
network and unchanged requested fields. Only missing Fee, Sequence and
LastLedgerSequence may be filled by the wallet. Sequence/ledger fields must fit
uint32. Fee must be positive and <= maxFeeDrops (default 1,000,000 drops, 1 XRP),
including a supplied fee; set a lower limit when appropriate. No GhostSig-style
SourceTag requirement is imposed on Xyra.

Sign-only requires submitted=false and no submitResult. The result contains a
verified txBlob. Unexpected submission reports fail closed with raw outcome.

The reviewed live wallet broadcasts with the submit RPC and returns preliminary
engine_result, not validated ledger confirmation. A preliminary tesSUCCESS or
submitted=true is NOT final success. The adapter keeps hash/raw data in
WalletKitError.details with outcomeUnknown=true and instructs the caller to
inspect the ledger before retrying. Success requires a reported validated
tesSUCCESS and positive ledger_index; this is still a wallet report, not
independent ledger attestation. Live validated-result support or independent
confirmation remains unfinished. Do not automatically retry these errors.

## Browser Requirements

Use HTTPS (localhost is suitable for local dApp previews), allow popups, and
invoke each operation from a fresh user gesture. Preserve the requesting origin
in the referrer: strict-origin-when-cross-origin or origin works; no-referrer
and noreferrer prevent the wallet's domain verification. If COOP is configured,
use same-origin-allow-popups, not same-origin. Do not use noopener/noreferrer.
isAvailable only checks browser APIs, not wallet readiness or passkey support.

Blocked/closed popup, rejection, timeout, AbortSignal and local disconnect
remove listeners/timers and close the popup. Cancellation after explicit submit
may leave an unknown on-ledger outcome. Disconnect is local, not remote credential
revocation. The official /logo-icon.svg is embedded as base64; allow data: in
img-src. Transaction JSON is sent in the popup URL as required by the protocol;
do not include secrets or private application metadata in transaction fields.

## Validation Still Required

Focused mocked protocol/cryptographic tests and no-emit source typechecking
do not prove live wallet compatibility. Before stable support, record mainnet/
testnet connect, sign-only, account/network switching, submission confirmation,
rejection, timeout/recovery and mobile popup behavior. Verify message proof
before enabling it. Package/build verification does not replace live acceptance;
publication of this experimental adapter does not claim production readiness.
