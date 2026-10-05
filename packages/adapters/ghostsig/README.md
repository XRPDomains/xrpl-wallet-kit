# @xrpl-wallet-kit/adapter-ghostsig

Experimental opt-in hosted popup adapter. Implemented in this workspace, not
published on npm yet; live passkey/testnet acceptance remains tracked in #34.

```ts
import { WalletManager } from "@xrpl-wallet-kit/core";
import { createGhostsigAdapter } from "@xrpl-wallet-kit/adapter-ghostsig";

const manager = new WalletManager({
  adapters: [createGhostsigAdapter()],
  network: "testnet"
});
// Invoke from user interaction, never on page load.
await manager.connect("ghostsig");
const signed = await manager.signTransaction({
  txJson: { TransactionType: "AccountSet", Account: manager.getAccount()!.address, SourceTag: 0 }
});
```

The package requires `xrpl` v4/v5. All-in-one client/IIFE exports the factory,
but neither the default list nor `wallets: "all"` enables it. Use
`wallets: ["ghostsig"]`, optionally with `ghostsig: { timeoutMs: 60000 }`, or
pass an adapter explicitly to `@xrpl-wallet-kit/client/selective`.

## Protocol and Safety

Protocol v1 is pinned to `https://ghostsig.dev/?connect`. A custom `url` permits
only that HTTPS origin or explicit `http://localhost` development. Each request
opens a fresh randomly named popup synchronously before awaiting work. Only one
request may be pending. Every terminal path removes listeners/timers and closes
the popup; short-lived popup reuse is intentionally not implemented yet.

Replies must match the popup source, origin, protocol version and secure random
request ID. Account address must derive from the ED-prefixed public key. Signing
checks both connected identity fields, decoded transaction, signature and hash.
Only missing Sequence, Fee and LastLedgerSequence may be filled by the wallet;
caller-provided fields cannot change. Non-signing metadata, pre-signed and
multisign requests are unsupported. Return values include verified `txBlob` for
sign-only; they never confuse a compact signature with a serialized transaction.

Supply an explicit uint32 SourceTag (`0` is allowed). The current wallet's raw
signer adds its own SourceTag when omitted; the adapter refuses that implicit
extra field instead of silently changing intent. It also refuses any correction
of a caller-supplied Sequence: prepare a fresh transaction if the wallet says
that Sequence is stale. This requirement applies only to this new adapter.

`signMessage`, product-level payments/nftOffers and custom XRPL networks are
not advertised. The three kit standard network configurations are accepted;
GhostSig uses its own nodes, not caller-specified RPC endpoints.

Restoration uses cached address/key and opens no popup. It is not a fresh proof
of control; the next signed reply re-proves both. Disconnect only clears local
state and cancels local work; it does not revoke passkeys or remote credentials.

Sign-and-submit succeeds only for a reported validated `tesSUCCESS` with a
ledger index. This is the wallet's report, not independent ledger attestation.
Failure/uncertain results retain the verified hash and raw transaction in
`WalletKitError.details`. Inspect the hash on-ledger before retrying. A cancelled
or timed-out dispatched submission may still reach the ledger; a progress
`providerHash` is not independently verified until the full signed reply arrives.

## Browser Deployment

Allow popups and use HTTPS (localhost HTTP is allowed). If setting COOP, use
`Cross-Origin-Opener-Policy: same-origin-allow-popups`; `same-origin` severs the
opener. Do not use `noopener`/`noreferrer` for this protocol. The popup's own CSP
controls wallet resources; normal dApp script CSP still applies to your bundle.
Allow `https://ghostsig.dev` in `img-src` for its official hosted PNG icon.
`isAvailable()` only reports browser API availability, not passkey/PRF support.
Autoconnect/sign chains without a fresh user gesture may be popup-blocked.

The icon is the wallet's hosted PNG. The protocol reference is XRPL Commons
xrpl-connect (MIT), develop commit `d43330a2003977399cd7349eff84c318c87637eb`.
Runtime protocol was checked against `ghostsig.dev/src/connect.js` on 2026-10-05.
