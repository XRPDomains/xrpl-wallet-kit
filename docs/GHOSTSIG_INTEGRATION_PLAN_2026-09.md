# GhostSig integration plan

## Implementation Update - 2026-10-05

### Live Test Report - 2026-10-06

The maintainer reports that Payment and all NFT actions in the vanilla preview
passed against the live GhostSig wallet: NFTokenCreateOffer, NFTokenAcceptOffer
and NFTokenBurn. The preview supplies explicit SourceTag: 0 for GhostSig in all
four forms. This report enables the payments and nftOffers capability flags.
Network, transaction hashes and individual buy/broker variants were not supplied.
Sign-only, cancellation/recovery and the complete cross-network acceptance matrix
remain unverified live; issue #34 stays open. No release or default-list change
is implied by this report.

The vanilla preview now defaults its four transaction forms to sign-only,
with an explicit sign-and-submit option. Sign-only calls manager.signTransaction
and displays the returned txBlob; submit calls manager.signAndSubmit. Focused
mock routing checks passed for both modes, including GhostSig SourceTag: 0.
This is preview coverage, not a live sign-only acceptance report.

The workspace now implements an experimental opt-in package, client/IIFE
exports, `web` metadata type, locale label, verified transaction replies and
popup lifecycle tests. Default wallet lists and CDN latest stay unchanged.
Popup reuse is deferred; each request is closed deterministically and a fresh
gesture is required for the next popup. No npm release or live passkey/testnet
acceptance is claimed. Issue #34 remains open for those acceptance checks.
See `packages/adapters/ghostsig/README.md` and the website adapter guide.

Live source inspection found that the raw signer adds SourceTag when omitted
and may correct a supplied Sequence. The adapter requires an explicit uint32
SourceTag (0 allowed) and rejects changes to supplied Sequence, rather than
relaxing the three-field autofill allowlist. This is a GhostSig-only requirement.

Protocol source checked: XRPL Commons develop commit
`d43330a2003977399cd7349eff84c318c87637eb` and live
`https://ghostsig.dev/src/connect.js` on 2026-10-05.

**Status:** Implemented, experimental opt-in
**Tracking issue:** [#34](https://github.com/XRPDomains/xrpl-wallet-kit/issues/34)  
**Priority:** P2  
**Reviewed:** 2026-09-30

## Decision

GhostSig is a good fit for XRPL Wallet Kit as an opt-in hosted wallet adapter.
It should not enter the default wallet list until the popup protocol has been
validated live and the upstream integration has shipped in a stable release.

GhostSig is not an injected extension, WalletConnect peer, hardware wallet, or
mobile deeplink. It is a hosted passkey wallet opened in a browser popup. The
dApp and wallet exchange versioned requests and replies with `postMessage`.

The initial integration should provide:

- `connect`
- `disconnect`
- passive `restoreSession`
- `signTransaction`
- `signAndSubmit`

It must not advertise `signMessage`. GhostSig signs XRPL transactions, not
arbitrary authentication messages.

## References and maturity

- GhostSig wallet: <https://ghostsig.dev/>
- XRPL Connect adapter source:
  <https://github.com/XRPL-Commons/xrpl-connect/tree/develop/packages/adapters/ghostsig>
- XRPL Connect integration commit:
  <https://github.com/XRPL-Commons/xrpl-connect/commit/ef77b11>
- SEP-43 wallet protocol error codes:
  <https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0043.md>
- SEP-52 key derivation and backup shares:
  <https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0052.md>

The XRPL Connect implementation landed on its `develop` branch on 2026-09-24
and remains under its unreleased changelog. It is useful as a protocol
reference, but it is not yet a stable dependency or compatibility promise.

## Wallet model

GhostSig uses the WebAuthn PRF extension to obtain 32 bytes after a verified
passkey prompt. It derives an Ed25519 key for the requested ledger, signs once,
and clears buffers it controls. The hosted page keeps the credential ID and
public account information between operations, not a stored private key.

Every transaction signature requires a new passkey prompt. The transaction
signing digest is used as the WebAuthn challenge, binding the prompt to that
transaction. GhostSig can also restore from SEP-52 backup shares; during such a
restored session, secret material remains in the wallet page's memory until the
user disconnects.

This remains an origin-trust model. Users trust the code served by
`https://ghostsig.dev`, and users of synced passkeys also depend on the security
of their passkey provider account.

## Proposed package

```text
packages/adapters/ghostsig/
  package.json
  README.md
  src/
    index.ts
    popup.ts
    icon.ts
```

Suggested public API:

```ts
export interface GhostsigAdapterOptions {
  url?: string;
  timeoutMs?: number;
}

export class GhostsigAdapter extends BaseWalletAdapter {}

export function createGhostsigAdapter(
  options?: GhostsigAdapterOptions
): GhostsigAdapter;
```

The default URL is `https://ghostsig.dev/?connect`. Production configuration
must not permit an arbitrary origin. An explicit `http://localhost` URL may be
accepted for local protocol development.

## Metadata and capabilities

The existing adapter type union does not accurately describe a hosted popup
wallet. Prefer adding a `web` or `hosted` type and corresponding UI label over
misclassifying GhostSig as an extension or embedded wallet. If that API change
is deferred, use a dedicated `group: "Web wallets"` and document the temporary
type choice.

Initial capabilities:

```ts
{
  connect: true,
  disconnect: true,
  signMessage: false,
  signTransaction: true,
  signAndSubmit: true,
  details: {
    supportedNetworks: ["mainnet", "testnet", "devnet"],
    transactionModes: ["sign-only", "sign-and-submit"]
  }
}
```

The initial plan kept `payments` and `nftOffers` disabled until live testing.
They are now enabled following the 2026-10-06 maintainer report above. This
does not claim every transaction variant or network has been validated.

## Protocol mapping

### Connect

1. Resolve and validate the requested network before opening a popup.
2. Open the popup synchronously inside the user's click call stack.
3. Wait for a versioned `ready` message from the exact popup and origin.
4. Post a `connect` request containing `chain: "xrpl"` and the network ID.
5. Validate the returned classic address and 32-byte Ed25519 public key.
6. Normalize the public key to XRPL's uppercase `ED`-prefixed representation.
7. Persist the address and public key in session metadata.

### Restore

Restoration may return the stored public account without opening a popup. This
is a cached session, not fresh proof of wallet control. The next signature must
match both the restored address and public key.

### Sign only

Send the transaction as JSON with `submit: false` and the expected address.
Normalize the reply to:

```ts
{
  txBlob: result.blob,
  signed: true,
  raw: result
}
```

GhostSig may fill `Sequence`, `Fee`, and `LastLedgerSequence` from its ledger
connection. Other caller-provided transaction fields must remain unchanged.

### Sign and submit

Send the transaction with `submit: true`. Return success only when the wallet
reports a confirmed acceptable ledger outcome. Preserve the signed blob, hash,
wallet outcome, and ledger result under `raw`.

Offline, unsent, handed-back, failed, malformed, and uncertain outcomes must
reject. An uncertain error must include the transaction hash and raw outcome so
the application can query the ledger before attempting another submission.

## Security invariants

The popup client is security-sensitive protocol code. It must enforce all of
the following:

1. Pin production requests and replies to `https://ghostsig.dev`.
2. Require `event.origin` to match the configured popup origin.
3. Require `event.source` to be the exact opened window.
4. Require the supported protocol version, response type, and request ID.
5. Generate request and window identifiers with cryptographic randomness.
   Fail closed if secure randomness is unavailable.
6. Reject malformed addresses, keys, signatures, blobs, hashes, and outcomes.
7. Bind every signing result to both the connected address and public key.
8. Decode `txBlob`, derive its hash, validate the signer and signature, and
   compare the signed transaction with the request after allowing only
   documented autofill fields.
9. Reject replies received after disconnect, cancellation, timeout, or adapter
   destruction.
10. Remove message listeners, intervals, timers, and popup references on every
    terminal path.
11. Reuse a connect popup only for a short bounded interval and only for the
    same origin, chain, and network.
12. Preserve typed user-rejection, popup-blocked, popup-closed, timeout,
    unsupported-network, and validation errors.

`Cross-Origin-Opener-Policy: same-origin` severs the popup opener and prevents
the protocol from replying. Integration documentation must recommend
`same-origin-allow-popups` for applications that set COOP.

## Cancellation and lifecycle

The adapter must support XRPL Wallet Kit's cancellation contract rather than
only polling until timeout:

- Observe `ConnectOptions.signal` before opening and while awaiting a reply.
- Implement `cancelPendingConnection()`.
- Close a client-owned popup when an operation is aborted or times out.
- Prevent a late popup response from restoring a disconnected session.
- Clear account state on `disconnect()` without claiming to revoke a remote
  session; GhostSig does not retain an application session to terminate.

## Integration surface

Implementation will need coordinated updates to:

- root workspace lockfile and TypeScript project references
- `@xrpl-wallet-kit/adapter-ghostsig`
- client adapter ID, selective factories, and adapter option types
- browser/IIFE exports and browser smoke tests
- adapter validation and UI locale if a new hosted-wallet type is introduced
- wallet icon and modal grouping
- package installation table and adapter overview
- capability and message-signing matrices
- CDN/legacy browser API documentation
- release smoke tests and package integrity checks

The website must not list GhostSig as supported until the package is implemented
and included in a release.

## Test matrix

### Automated

- SSR/non-browser import and `isAvailable() === false`
- popup blocked and popup closed
- wrong origin, wrong source, wrong request ID, and wrong protocol version
- malformed connect and signing replies
- user rejection and wallet/service errors
- timeout, abort, disconnect during connect, and late responses
- listener/timer/popup cleanup on every terminal path
- standard network acceptance and custom network rejection
- address and public-key mismatch after restore
- transaction mutation outside documented autofill fields
- invalid signature, blob, or transaction hash
- sign-only `txBlob` normalization
- validated success, ledger failure, offline handoff, and uncertain submission
- adapter contract, package exports, browser bundle, and SSR smoke tests

### Live testnet

- new passkey account connect
- existing passkey sign-in
- reload and passive restore
- sign-only, decode locally, then submit separately
- sign and submit through GhostSig
- rejected passkey prompt
- closed and blocked popup
- timeout and network outage
- switch from GhostSig to another adapter and back
- Chrome, Safari, and Firefox where WebAuthn PRF is available
- desktop and mobile popup behavior

Record the browser version, passkey provider, wallet revision, account, network,
transaction hashes, package tarball integrity, and observed result.

## Rollout

### Local validation, 2026-10-05

- Full suite: 357 tests passed, including the GhostSig protocol and adapter contract tests.
- Readable and minified browser bundles exercise connect and sign-only replies with
  locally generated Ed25519 proofs; these are mocked protocol tests, not live wallet signing.
- Website build and the opt-in React preview rendered the GhostSig icon during
  initial validation. The icon now embeds the supplied `tmp/ghostsig.svg`.
- React preview: `http://127.0.0.1:5175/` now defaults to mainnet with all
  configured wallets selected; checkboxes filter the connection modal.
- No npm publication or real passkey/ledger transaction was performed. Issue #34
  remains open until the live testnet matrix is completed.

1. **Protocol spike:** implement and test the popup client in isolation.
2. **Opt-in adapter:** publish the standalone package and selective client ID.
3. **Live validation:** complete the testnet matrix and resolve protocol gaps.
4. **Documentation release:** publish public adapter and integration guides.
5. **Default-list decision:** consider default inclusion only after the upstream
   protocol is stable and the always-available wallet row has been reviewed for
   product impact.

## Open questions

- Will GhostSig publish and version a standalone protocol client, or should the
  kit maintain its own audited implementation?
- Is the popup protocol intended to be stable across GhostSig releases?
- Which exact submission outcomes are final enough to map to `submitted` versus
  `confirmed` in XRPL Wallet Kit?
- Can GhostSig provide a machine-readable version/build identifier for live
  compatibility diagnostics?
- Should XRPL Wallet Kit add a first-class `hosted` adapter type, or use the
  broader `web` type for future browser-hosted wallets?
