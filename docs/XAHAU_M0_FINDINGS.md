# Xahau M0: Evidence And Decisions

Date: 2026-10-17. Baseline: kit 0.1.23 plus local chain-filter foundation.
Status: **offline codec spike passed; M0 remains open** for live provider,
fee enforcement and runtime/session integration gates. Not a support announcement.

## 1. Scope And Safety

- Private fixture lives in `scripts/spikes/xahau`, outside public workspaces.
- No production Xahau dependency or official adapter enabled. The later browser
  lab adds only React DOM development typings to the root manifest/lock.
- No website/browser build, commit, release, wallet popup or signed RPC submission.
- Offline fixtures derive deterministic public test keys in memory. Never fund them.
- Separate RPC probe permits only server_info, server_definitions, account_info
  and fee at the fixed testnet endpoint, with network ID verification and timeout.

## 2. Package Evidence

Verified against npm registry metadata and installed published artifacts, not
only GitHub branches. The private lockfile records exact transitive versions and
tarball integrities. Install scripts were disabled.

| Candidate | Version | Evidence / disposition |
| --- | --- | --- |
| xahau-binary-codec | 2.3.0, ISC | Preferred codec candidate for M1; explicit XrplDefinitions instances supported; bundled definitions tested |
| xahau | 4.2.0, ISC | SDK used as signing reference; not yet selected as production dependency |
| xahau-client | 1.0.0, ISC metadata | Registry metadata does not establish a maintained signing codec; not selected on name/ownership assumptions |
| @gemwallet/api | 3.8.0 | Published declaration/source inspected; root kit currently has 3.7.0, not silently upgraded |
| @xyrawallet/sdk | 0.3.0, MIT | Published types and runtime probed without real UI; not suitable for top-level SSR import |

Environment tested: Node 22.17.0, Windows; root XRPL baseline package 4.7.0.
This is not Node 18/20, mobile browser, bundler or hardware acceptance. No dependency
security audit or universal compatibility claim is made by this spike.

Bundled codec definitions file SHA-256:
`35126c384d70d6bf3f3ee6d7411a7f84e5610ef07bad64604fd6e85e513bceb7`.

### Codec boundary decision

Use explicit per-context definitions without global mutation. Seven codec tests
pass, including three prepared sign/verify vectors, negative mutations, strict
roundtrip checks and interleaved independent Xahau contexts versus XRPL encoding.

**Important:** the raw codec silently drops unknown fields, including nested
HookParameter fields. Comparing only encoded unsigned blobs would hide that
loss. A production boundary must reject unsupported/unknown input before wallet
dispatch and validate the intended JSON under an explicit normalization policy.

The spike's deep roundtrip assertion only handles canonical fully prepared
fixtures. It is not a complete validator for all transaction shapes, optional
fields, X-address normalization or wallet autofill. Do not copy it as a public
generic validator without those rules.

## 3. Offline Vectors And Verification

All vectors use testnet NetworkID 21338 and explicit Fee, Sequence,
LastLedgerSequence, Flags and SigningPubKey. The fixture Fee is arbitrary test
input, not a recommended/default estimate.

| Vector | Frozen signed transaction hash |
| --- | --- |
| Payment | D3DA622D2E17129F757C17C827222835A0B229023D6CEFE696D396014966A89A |
| Payment + HookParameters | 5EF11E91464A9099DF6F6754D351FD01438CA2A440F2847B68B49AB54E74E72F |
| Invoke + HookParameters | C7BB9725DC4BA5887426985922016118F42C69613AA17E154D94454CF7F63A9D |

Tests construct signing data with the candidate codec, sign using fixture key
tools, decode and compare intent, bind the public key to Account, verify the
signature and calculate the transaction hash. Blob/hash match SDK Wallet.sign.
Both paths share the candidate codec: this is not independent ledger validation.

Negative cases reject changed destination, network, fee, HookParameters, invalid
signature and account/key mismatch. Interleaved tests preserve XRPL encoding;
this does not prove every dependency lacks mutable state under arbitrary use.

## 4. Published Provider Contracts

### GemWallet: correct the networkID assumption

Both installed root API 3.7.0 and isolated published API 3.8.0 declare:

```ts
GetNetworkResponse.result?: {
  chain: string;
  network: Network;
  websocket: string;
}
```

There is **no networkID field in this response declaration**. The SDK's internal
network constants having networkID does not imply getNetwork returns it. An AST
test records the actual 3.8.0 reply fields.

Proposed proof: validate returned chain + network, then bind the endpoint to a
trusted registered preset and verify its numeric network_id. Never use only a
Mainnet/Testnet label, never connect to arbitrary provider-supplied URLs. An
explicit chain field is evidence to validate, not proof that a running extension
has been tested. Re-read authoritative state before signing/restore as needed.

The published API also exposes signTransaction and submitTransaction, but its
sign result uses a field named signature. Whether that value is a complete blob,
and how the released extension autofills/changes fee, needs live verification.
Do not enable sign-only or submit based on the method name alone.

Current kit Payment conversion drops fields such as Fee and NetworkID; a Xahau
path cannot reuse that convenience conversion unchanged. Prefer a verified
generic transaction path if the provider contract and live behavior permit it.

### Xyra: exact identifiers and SSR boundary

Published runtime 0.3.0 accepts xahau-mainnet and xahau-testnet in connect/sign.
The type union also includes shorthand aliases that the runtime validator does
not accept: the offline probe rejects xahau. Use explicit preset strings.

Importing the SDK without window fails: its default singleton starts listening
at module load. Preserve the kit's deferred custom popup boundary, or explicitly
defer any SDK import until a browser runtime. Do not replace it with a top-level
import in an SSR-safe adapter.

Tests only reach a fake popup boundary; they do not establish wallet acceptance,
reply correctness, fee ceiling enforcement or submit semantics on Xahau. Sign-only
is the first candidate; wallet-side submit stays off until pre-broadcast safety
is proven.

### Xaman: SDK fields exist, live binding still pending

Installed SDK types support options.force_network on each payload, and reply
environment_networkid / environment_nodeuri / environment_nodetype. Official
OAuth docs describe XAHAU and XAHAUTESTNET. Mapping must bind OAuth, restore and
each sign request, not only initial connection.

The kit currently decodes sign-only blobs through xrpl and does not yet attach
force_network per Xahau request. SignIn proof verification must also use the
correct chain-aware proof path; the three transaction vectors above do not cover
Xaman SignIn or remote autofill. No live Xaman API authorization was performed.

## 5. Network Mapping To Verify At Integration

| Context | Mainnet | Testnet |
| --- | --- | --- |
| Internal preset ID | xahau-mainnet | xahau-testnet |
| family / native asset / decimals | xahau / XAH / 6 | xahau / XAH / 6 |
| Transaction NetworkID | 21337 | 21338 |
| Wallet Standard mapping currently used by kit | xrpl:21337 | xrpl:21338 |
| Xaman selector | XAHAU | XAHAUTESTNET |
| Xyra explicit runtime selector | xahau-mainnet | xahau-testnet |
| GemWallet published constants / response fields | XAHAU + Mainnet + verified endpoint | XAHAU + Testnet + verified endpoint |

Auth expected-chain token must be agreed with the backend; this table does not
establish a universal CAIP namespace. WalletConnect needs a real partner session
approving a chain and methods; no WalletConnect support is inferred here.

## 6. Read-Only Testnet Observation

Probe timestamp: 2026-10-17T02:17:43.333Z, endpoint https://xahau-test.net.
Verified network_id 21338, validated ledger 13238479, server build
2026.10.16-tmp-dev. This is a development testnet observation, not mainnet behavior.

Server definitions hash:
`B4ECDF4E5C79CD627E79715520AC91F923ECDB3EBABAEE39F24C052CAC96C2F4`.
Server advertises Invoke transaction type 99. The server hash and local file
SHA-256 are different identifiers; do not compare them as the same hash algorithm.

| Unsigned fee probe | base_fee | base_fee_no_hooks | open_ledger_fee |
| --- | --- | --- | --- |
| Payment | 10 drops | 10 drops | 10 drops |
| Invoke + HookParameters | 18358 drops | 10 drops | 18358 drops |

Probe uses a public account for sequence lookup and an unsigned blob with Fee 0,
SigningPubKey empty; nothing was signed/submitted. These values depend on the
specific transaction, account/destination, node and ledger. They do not justify
a default 2 XAH ceiling or a fixed instruction-price formula. dApp-configured fee
ceilings remain mandatory. Hook failure and congested fee conditions remain untested.

## 7. Runtime And Session Design: Next Implementation Gate

Proposed ownership, not a public API already implemented:

- Core owns narrow protocol interfaces and resolves a runtime for the request's
  fixed network context. No core/UI/adapter imports from the Xahau package.
- Optional Xahau module implements preparation, strict validation and signed-result
  verification with the selected codec; full SDK remains a dev reference until needed.
- Adapter plumbing must pass returned blobs through that context instead of
  directly importing xrpl decode. Resolve how adapters obtain context before M1;
  do not put functions on transaction data that structuredClone/preflight copies
  or forwards to a wallet.
- Keep protocol operations per request/context; registry selection must not let
  unknown families fall back silently to the default XRPL runtime.
- A caller-defined storage namespace must isolate manager instances as well as
  chains. Keep default legacy behavior; schema migration must verify registered
  identity, not infer XRPL from an absent field. Namespace/API design still pending.
- Add expected-chain auth validation with atomic nonce binding; do not count codec
  vectors as authentication coverage. Backend migration remains explicit.

No fee enforcement guarantee is possible after wallet-side broadcast. If the
provider cannot prove the bound before broadcast, disable that submit mode and
require verified sign-only + explicit submit when available.

## 8. Ledger: Per-App, Per-Transaction M0 Matrix

Correction: do not classify Ledger hardware as XRPL-only or require the XAH app
universally. The current kit not enabling Ledger on Xahau is an implementation
state, not proof the XRP app cannot sign a Xahau Payment with NetworkID.

### Source evidence, not hardware acceptance

Inspected LedgerHQ/app-xrp at commit
`7b5185ff09b4b3d15df242b156a6aaadfc99f555` on 2026-10-17:

- `src/xrp/fields.c` labels UInt32 field 1 as Network ID.
- `src/xrp/xrp_parse.c` includes Payment in its supported transaction-type switch;
  Invoke is not listed in that switch at this commit.
- The parser can return BLIND_SIGN_REQUIRED for transaction types/fields it does
  not recognize. Do not assert every unknown type must always be rejected or
  that a returned signature proves clear-signing support.
- No source commit/version correspondence to a particular installed device app
  was established. Older/newer apps and hardware models may behave differently.

The existence of LedgerHQ/app-xah provides another candidate app path, not proof
it is required for Payment or that it supports all Hooks fields.

### Required live cases

Run each row separately for the actual XRP app/version, then for XAH app/version
when available. Start with Xahau testnet NetworkID 21338; mainnet 21337 requires
separate, explicit low-value approval later. No test below has been performed
on hardware in this spike.

| Case | Transaction / field set | XRP app hardware | XAH app hardware |
| --- | --- | --- | --- |
| L1 | Payment, native XAH, explicit NetworkID; no HookParameters | Pending | Pending / app availability |
| L2 | Payment + DestinationTag/Memos | Pending, independent of L1 | Pending |
| L3 | Payment + NetworkID + HookParameters | Pending, do not inherit L1 | Pending |
| L4 | Invoke + NetworkID, no HookParameters | Pending; source does not list clear-sign support | Pending |
| L5 | Invoke + NetworkID + HookParameters | Pending, independent of L3/L4 | Pending |
| L6 | TrustSet | Pending, independent type | Pending |
| L7 | OfferCreate | Pending, independent type | Pending |
| L8 | OfferCancel | Pending, independent type | Pending |

For each case, record model, firmware, app name/version, transport/library
version, derivation path, prepared JSON and encoded blob digest, device review
fields/warnings, APDU status/error and outcome. Preserve individual failures.

Acceptance order:

1. Confirm exact hardware app and public key/address with the user; do not force
   XAH when evaluating XRP-app compatibility or switch apps silently.
2. Prepare an unsigned snapshot with chain-aware fee/expiry/NetworkID checks.
   No missing/conflicting NetworkID may reach the hardware approval path.
3. Request sign-only first; record whether the app rejects, clear-signs or
   requires blind signing. Do not enable blind signing as a workaround for MVP.
4. Verify returned signature, key/account binding, hash and every intended field
   using the Xahau codec. HookParameters must survive byte-for-byte. Inspect
   native-unit/chain information displayed on device as well as browser UI.
5. Only after sign-only passes may an explicitly approved testnet submit be
   evaluated through validated ledger confirmation. Never automatically retry.

Capability key is **model/firmware + app/version + network + transaction type +
field set + signing mode**. A Payment success cannot authorize Invoke, Hooks
parameters, another app/version, mainnet or submit mode. A blind-signed result
is a separate observation, not a passed safe MVP capability.

M0 must retain this matrix and execute hardware cases when the device/tester is
available; unexecuted rows stay pending, not unsupported/passed. Later M5 is
production plumbing/enablement for combinations already verified, not the first
time Ledger compatibility is considered. No hardcoded family-only conclusion
or global Ledger UI exclusion replaces this evidence.

Sources pinned to the inspected revision:

- [Network ID field](https://github.com/LedgerHQ/app-xrp/blob/7b5185ff09b4b3d15df242b156a6aaadfc99f555/src/xrp/fields.c)
- [Parser/type and blind-sign checks](https://github.com/LedgerHQ/app-xrp/blob/7b5185ff09b4b3d15df242b156a6aaadfc99f555/src/xrp/xrp_parse.c)
- [Transaction type definitions](https://github.com/LedgerHQ/app-xrp/blob/7b5185ff09b4b3d15df242b156a6aaadfc99f555/src/xrp/transaction_types.h)
- [XAH app alternative](https://github.com/LedgerHQ/app-xah)

The user subsequently supplied https://xahau.network/ecosystem/, which lists
Ledger. That catalog does not establish an installed app/version/type matrix;
hardware acceptance above remains pending.

## 9. Go / No-Go

**Go:** continue narrow protocol/context design and candidate validation. The
codec candidate can represent and sign the tested Xahau fixtures without changing
XRPL encoding. Published provider schemas now have artifact-level evidence.

**No-go for enabling/releasing Xahau yet:**

- No live provider network/restore/change/sign acceptance for the three wallets.
- GemWallet complete-blob semantics and fee/autofill behavior not verified.
- Xaman SignIn proof, request network binding and fee behavior not verified.
- Xyra live Xahau result verification and pre-broadcast fee control not verified.
- No production runtime injection, namespace/migration or auth-chain implementation.
- No browser/SSR consumer bundle validation beyond Node import evidence; no
  reviewed Hook failure/fee policy, hardware acceptance or named final reviewer.

No new completion date is asserted until these gates are scoped. The private
spike does not mark M0, M1 or any adapter capability complete.

## 10. Reproduce And Sources

Commands: see `scripts/spikes/xahau/README.md`. Twenty-eight offline tests passed. Re-running
the optional read-only probe can return different ledger/fee values.

- [Published codec metadata](https://registry.npmjs.org/xahau-binary-codec/2.3.0)
- [Published SDK metadata](https://registry.npmjs.org/xahau/4.2.0)
- [GemWallet API artifact metadata](https://registry.npmjs.org/@gemwallet%2fapi/3.8.0)
- [Xyra SDK artifact metadata](https://registry.npmjs.org/@xyrawallet%2fsdk/0.3.0)
- [Codec explicit definitions API](https://github.com/Xahau/xahau.js/blob/main-xahau/packages/xahau-binary-codec/src/index.ts)
- [Codec STObject field selection](https://github.com/Xahau/xahau.js/blob/main-xahau/packages/xahau-binary-codec/src/types/st-object.ts)
- [Xahau signing and transaction-aware fees](https://xahau.network/docs/features/transaction-signing/)
- [Xaman OAuth selectors](https://docs.xaman.dev/environments/identity-oauth2-openid)
- [Xyra provider docs](https://www.xyra.now/developers)

Installed artifacts are the evidence for version-specific claims; upstream branch
links may change. Local private lockfile is required to reproduce transitive versions.

## 11. Review Notes On The Three Blockers (2026-10-17)

Research input for the next implementation gate. Proposals, not accepted decisions;
each still needs a test before it is relied on.

### 11.1 Codec drops unknown fields: root cause and strict validator

Confirmed in `xahau-binary-codec` `STObject.from` (main-xahau): input keys are
mapped through `definitions.field[name]`, then filtered by `f !== undefined &&
value !== undefined && f.isSerialized`. Unknown names and non-serialized fields
are dropped without error. The same function recurses into nested STObject and
STArray, so a misspelled `HookParameterName` inside `HookParameters` is lost too.
X-addresses are also rewritten into `Account`/`Destination` + tag fields.

Encoding is therefore not validation. Proposed boundary, in the optional Xahau
module, run before preflight/wallet dispatch and again on the decoded signed blob:

```ts
// Illustrative only. Reject, never strip.
function assertKnownFields(obj: Record<string, unknown>, defs: XrplDefinitionsBase, path = ""): void {
  for (const [name, value] of Object.entries(obj)) {
    const field = defs.field[name];
    if (field === undefined || !field.isSerialized) throw invalid(`${path}${name}: unknown or non-serialized field`);
    if (typeof value === "string" && isValidXAddress(value)) throw invalid(`${path}${name}: X-address not accepted; use classic address + tag`);
    if (field.type.name === "STObject") assertKnownFields(asObject(value, path + name), defs, `${path}${name}.`);
    if (field.type.name === "STArray") {
      for (const [i, item] of asArray(value, path + name).entries()) {
        const keys = Object.keys(asObject(item, `${path}${name}[${i}]`));
        if (keys.length !== 1) throw invalid(`${path}${name}[${i}]: array item must have exactly one wrapper key`);
        assertKnownFields(item as Record<string, unknown>, defs, `${path}${name}[${i}].`);
      }
    }
  }
}
```

Then the second guard: `decode(encode(tx, defs), defs)` must deep-equal the
validated input under an explicit normalization policy (uppercase hex for Blob/
Hash/AccountID-free hex fields, string drops for native Amount, no implicit
defaults). Any difference is an error, never a silent fix. Required tests:
misspelled top-level field, misspelled nested `HookParameter` field, extra key in
an array wrapper, X-address input, lowercase hex blob, and `undefined` values.
Errors use the existing `INVALID_REQUEST` / `PREFLIGHT_FAILED` codes.

### 11.2 GemWallet without networkID: bind on the signed blob, not getNetwork

Root `node_modules/@gemwallet/api` (3.7.0) confirms the finding and adds context:

- `getNetwork` returns `chain` / `network` / `websocket` only. `Chain.XAHAU =
  "XAHAU"`, Xahau networks are labelled `"Mainnet"` / `"Testnet"` (same labels as
  XRPL, so `network` alone is ambiguous; `chain` is required).
- `BaseTransactionRequest.networkID?: number` exists on the convenience methods,
  and `signTransaction({ transaction })` takes a generic transaction. The kit's
  Payment conversion that drops NetworkID must not be reused for Xahau.
- `SignTransactionResponse.result.signature` is typed `string`; whether it is the
  full signed blob is unverified. Detect it by decoding: a full blob decodes to a
  transaction with `TxnSignature` and `SigningPubKey`; anything else fails closed.
- The package exports `XAHAU_MAINNET_NODES` / `XAHAU_TESTNET_NODES`. Do not trust
  these as the allowlist; the kit preset's own endpoints remain the source of truth.

Key point: the missing response field is less critical than it looks. Xahau
requires `NetworkID` in every transaction and it is covered by the signature.
A blob with NetworkID 21338 cannot apply on XRPL or Xahau mainnet (`tel` class,
not applied, no fee). So the binding proof is:

1. Kit prepares the tx with the preset NetworkID (never omitted or wallet-filled).
2. After signing, decode the blob with the Xahau codec and require NetworkID,
   Account, SigningPubKey-derived address and all intended fields to match (11.1).
3. Submit through the kit/dApp RPC verified by `server_info.network_id`, not the
   wallet's websocket.

`getNetwork` (`chain === "XAHAU"` + label + websocket in the preset allowlist) then
becomes a UX pre-check that fails early, not the security boundary. Message
signing and auth carry no NetworkID, so they still need the expected-chain token
in the message plus backend validation. Wallet-side `submitTransaction` stays off
until fee and autofill behavior is measured live.

### 11.3 Xyra SDK not SSR-safe: keep the custom popup, no SDK dependency

The current adapter (`packages/adapters/xyra`) does not import `@xyrawallet/sdk`.
It uses its own popup boundary with `typeof window` guards in `isAvailable()` and
`popup.ts`. Recommendation: keep it that way for Xahau and only add the explicit
`xahau-mainnet` / `xahau-testnet` selectors plus chain-aware result verification.

Reasons beyond SSR:

- A lazy `await import("@xyrawallet/sdk")` inside the click handler runs before
  `window.open`, which can consume transient user activation. Safari in particular
  may then block the popup. If the SDK is ever needed, preload it when the modal
  opens and open the window synchronously in the click.
- The SDK's module-load listener is a hidden global side effect, which conflicts
  with per-instance managers and destroy() cleanup.
- Xyra documents `signMessage` as network-agnostic, so auth chain binding must come
  from the message text (same as 11.2), regardless of SDK use.
- `sign` returns `tx_blob` + `hash`; verify both with the Xahau codec as in 11.2,
  including recomputing the hash, instead of trusting the returned hash.

If an SDK path is ever required, use a memoized lazy loader that resets on
failure, throws `WALLET_NOT_AVAILABLE` when `window` is absent, and is covered by
a Node import smoke test of the adapter entry point.

Sources: [codec STObject](https://github.com/Xahau/xahau.js/blob/main-xahau/packages/xahau-binary-codec/src/types/st-object.ts),
[Xahau signing / NetworkID](https://xahau.network/docs/features/transaction-signing/),
[Xyra developer docs](https://www.xyra.now/developers), [Xahau ecosystem wallets](https://xahau.network/ecosystem/).

## 12. Review Follow-Up: Private Boundary Prototype (2026-10-17)

Section 11 is retained as review input. The following decisions qualify those
proposals; they do not enable a production adapter or complete M0.

- **11.1 accepted with a narrower schema:** `scripts/spikes/xahau/boundary.mjs`
  validates prepared native Payment/Invoke, with explicit HookParameter/Memo
  wrapper and child-field allowlists. A field being known to definitions does not
  make it valid at every position. Unknown/misplaced fields, wrapper extras,
  undefined, X-addresses, lowercase hex and implicit drops normalization fail
  with `INVALID_REQUEST`. Encode/decode must preserve the exact snapshot.
- **11.2 accepted as a blob-boundary experiment only:** verify the prepared
  account, numeric NetworkID, explicit maximum fee, exact signed intent,
  signing-key-derived account and cryptographic signature. A compact signature,
  unsigned blob, changed fee/network/intent or noncanonical blob fails closed
  with `PREFLIGHT_FAILED`. This does not prove that a live GemWallet reply contains
  a full blob. No provider-submit or kit-submit path was added. Do not rely on
  the review's blanket wrong-chain/no-fee claim to justify broadcasting anything.
- **11.3 accepted as the implementation direction:** retain Xyra's current
  deferred custom popup; do not introduce its SDK into the production adapter.
  The same prototype recomputes the transaction hash and rejects a mismatching
  wallet hash. Live provider behavior and SSR entry-point checks for future
  Xahau adapter changes remain separate gates.

Evidence: the 14-test offline suite passes, including four new boundary tests
with positive Payment/Invoke vectors and negative field, signature, intent,
network, fee, hash and compact-response cases. No wallet approval, RPC call or
transaction submission was performed for this follow-up. The prototype supports
only the account's own single signing key: regular keys, multisign and issued
assets are explicitly not covered. It does not estimate fees, validate current
ledger sequence/expiry or implement a trusted RPC boundary.

The supplied [Xahau ecosystem page](https://xahau.network/ecosystem/) lists Ledger;
that is discovery evidence, not proof of app/version/type or clear-sign coverage.
The section 8 Ledger device matrix remains pending independently for Payment,
HookParameters and Invoke. Next M0 evidence needs live GemWallet/Xyra sign-only
response shapes, trusted-RPC/fee policy design and per-device Ledger results.

## 13. Read-Only RPC And Fee Policy Prototype (2026-10-17)

Added private `scripts/spikes/xahau/rpc-policy.mjs`, not wired into an adapter,
manager, browser bundle or signing flow. Five additional tests pass using a mock
transport; the complete private suite now has 19 passing offline tests.

- The client fixes the HTTPS endpoint to `https://xahau-test.net`, rejects
  redirects and permits only `server_info`, `account_info` and `fee`. No wallet
  websocket, caller URL or submit method is accepted. Requests use a 10s timeout.
- Before account/fee queries, require server-reported NetworkID 21338 and a
  recent validated ledger. Check the validated account and prepared sequence.
- The fee request encodes the exact prepared fields, including HookParameters,
  with query-only Fee `0` and empty SigningPubKey. Require canonical positive
  drops for transaction-aware `base_fee` and `open_ledger_fee`; take the larger
  value, reject above the caller cap or above the prepared Fee. Never silently
  rewrite the approved transaction or fall back to XRPL's base fee.
- Recheck network and expiry after querying fees, rejecting a backwards ledger.
  Tests cover Payment and Invoke + HookParameters, wrong chain, stale/expired
  ledger, changed sequence, invalid replies, fee cap, insufficient prepared fee,
  final network mismatch, forbidden submit and transport/HTTP/RPC errors.

The 30s ledger age and 20-ledger expiry window are explicit **spike choices**,
not production defaults. Server-reported network and age are trusted RPC
assertions, not cryptographic network/consensus proof. This is a preflight
experiment, not a quote reservation: sequence, fees and session can change during
wallet approval. Production integration still needs revalidation/cancellation
around approval, controlled endpoint selection and live fee/error fixtures
(including Hook execution failures). Ledger hardware and provider sign-only
checks remain pending. No additional live RPC, wallet popup or submission was
performed for this follow-up.

## 14. Sign-Only Lifecycle Prototype (2026-10-17)

Private `scripts/spikes/xahau/sign-only.mjs` composes strict intent validation,
fee/ledger preflight, an injected sign-only dispatcher, signed-blob verification
and post-approval preflight. It has no submit path and no wallet SDK calls.

- Snapshot the prepared intent, fee policy and verified local session. Require
  Xahau family, expected account/NetworkID, adapter identity and session revision.
  Compare state at async boundaries. Reconnection to the same account must still
  change the revision; a storage record is not verified provider state.
- Request `submit: false` with a separate copy of the prepared JSON. Reject a
  changed intent, compact/missing blob or incorrect wallet hash before any final
  RPC checks. Provider-specific raw reply normalization remains unimplemented.
- After approval, recheck network, validated account sequence, ledger expiry and
  fee policy before returning the verified blob. This narrows the approval-time
  race; it does not reserve a sequence/fee or authorize future submission.
- Cancellation and a bounded timeout reject even if the provider never settles.
  Late replies are discarded; cancellation during preflight prevents subsequent
  queries and wallet dispatch. An already-running transport may finish, and a
  device may still sign: cancellation cannot undo an external wallet operation.

Nine additional offline tests pass (28 total). They cover the happy path,
preflight session changes, reconnect revisions, wrong family, post-approval
fee/sequence/expiry changes, mutated payload/policy, malformed replies, abort
before dispatch/during RPC/during approval, and a hung-provider timeout.

This is not production manager integration or live wallet evidence. A real
session-event bridge, per-wallet request serialization and GemWallet/Xyra reply
captures remain required. The runner accepts only an injected reader and does
not accidentally fall back to a live RPC during the tests. No browser build,
wallet approval, live RPC or submission was performed for this follow-up.

## 15. M0 Closeout Inputs And Live Test Handoff (2026-10-17)

Added [architecture decisions](./XAHAU_M0_ARCHITECTURE_DECISIONS.md) covering the
minimal protocol boundary, namespace/migration rules, expected-chain auth with
atomic nonce consumption, initial cohort and go/no-go ownership. These are
design decisions, not claims that production runtime/auth/storage changes ship.

The user confirmed availability for live testing. Use the
[live acceptance checklist](./XAHAU_M0_LIVE_CHECKLIST.md) for provider versions,
network/session cases, sign-only vectors, races and per-app Ledger evidence.
It explicitly separates wallet observations from kit acceptance: the current
5173 XRPL demo and private Node runner are not a wired Xahau browser harness.
Provider signing cases remain blocked until that harness is ready. No secrets or
still-valid signed blobs should be posted in the public report.

M0 research/design deliverables now have a consolidated handoff. Full M0 closure
still requires the mandatory live results (or an explicitly approved scope
change); the user's agreement to test is not a passed result. Next work is the
controlled browser/provider harness and actual captures, not more mock evidence
presented as hardware/provider acceptance.

## 16. Local Browser Wiring (2026-10-17)

User requested integration of the prepared standards/tests. Added an opt-in lab
at `/xahau.html` on the existing 5173 server, with navigation back to `/`. It uses
a separate in-memory WalletManager, the pinned per-context Xahau codec and local
acceptance adapters for GemWallet, Xyra and Ledger. Published adapters/capabilities
and the XRPL console's mainnet default are unchanged. Xaman is not wired yet.

The lab prepares native Payment/Invoke from validated account/ledger data and
transaction-aware fees, requires an explicit fee cap and exact-intent approval,
then requests sign-only and verifies blob/signature/hash plus post-approval
preflight. Prepared UI snapshots expire after 45s. Only hashes/verification
metadata are retained in exported reports. No submit or mainnet action exists.

GemWallet uses the root API 3.7.0 generic signTransaction and re-reads account/
network before and after signing. Network/account/logout events invalidate the
local session. Xyra keeps the exact-origin/source custom popup; a blank window
is reserved in the click task before async preflight and navigated only after
checks. Ledger uses WebHID and the existing XRP transport protocol, preserves
NetworkID/HookParameters in encoding, and never opens/switches apps or enables
blind signing. Each actual app/type/field/mode remains subject to device testing.

Direct browser access to the testnet RPC failed in this environment. The dev
server therefore provides a bounded same-origin read-only proxy with a fixed
HTTPS upstream, no redirects, and only server_info/account_info/fee. A single
read-only server_info request through that proxy returned network_id 21338 and
server build 2026.10.16-tmp-dev. No wallet transaction was signed/submitted live.

Validation: local lab TypeScript check passed; 29 private tests plus 7 existing
Xyra regression tests passed (36 total). Browser smoke passed with intercepted
GemWallet/Xyra and RPC, including fee-cap rejection, explicit approval, verified
sign-only result, network invalidation, report privacy and desktop/mobile layout.
These mocked browser results do not replace the user's live wallet/device tests.
Session persistence/restore and multi-manager migration are not implemented by
this lab and must not be marked passed from a reload/disconnected screen.

## 17. Unified Console And Opt-In Adapter Integration (2026-10-17)

At the user's request, the separate browser lab was removed. `/xahau.html`
redirects to `/`; the existing console at 5173 selects XRPL/Xahau and mainnet/
testnet, filters wallets and isolates storage by selected network. Xahau shows
Xaman, GemWallet, Xyra and Ledger. Transaction JSON covers Payment, Invoke,
TrustSet, OfferCreate/Cancel and AccountSet. Mainnet submit needs explicit
confirmation; sign-only remains the default. Xahau auth/NFT parity is not claimed.

The optional `packages/xahau` runtime is injected through the core protocol
contract, not imported into core/UI/adapters. All four official adapters now
have opt-in chain filters and a chain-aware signing path. Xahau wallet-side
broadcast is disabled: prepare with an explicit ceiling, sign-only, verify exact
blob/key/signature/intent/NetworkID/fee, recheck, then optionally submit via the
configured RPC. Runtime transaction lookup feeds the existing manager's ledger
confirmation flow. Xaman OAuth/payload selectors are explicit and scoped; Xyra
keeps the custom popup; Ledger does not auto-switch apps on Xahau. Passive Xahau
restore and chain-bound message auth remain disabled rather than inferred.

Issue 49 implementation follow-up: Xyra XRPL preliminary accepted broadcasts
return `submitted` with verified hash/blob; they are not validated success.
Manager confirmation (or caller ledger inspection) remains required. Unknown
outcomes retain their hash and must not be blindly retried.

Focused verification only: package/example type checking; seven existing Xyra
regression tests; two offline Payment/Invoke SDK signing comparisons; a browser
check of chain/network filtering, JavaScript errors and mobile overflow. No new
large test suite, live wallet/device approval, mainnet broadcast, website build,
commit or release was performed. The maintainer runs live acceptance in the
unified UI; this report does not manufacture passed hardware/provider results.

## 18. GemWallet Metadata Regression Correction (2026-10-18)

The maintainer reports that a previously usable connection fails after the
recent changes. Supplied logs show getNetwork returning `{ type: "reject" }`,
not a reported conflicting chain and not a missing numeric NetworkID field.
The local hard gate and bounded metadata retries introduced during diagnosis
turned unavailable optional metadata into a connection failure. Retrying did
not fix the observed extension reply and has been removed.

Following section 11.2, protocol-backed Xahau connect may use the configured
preset when that exact metadata read is rejected without a result. The session
explicitly records networkSource=configured-preset/providerNetworkAvailable=false;
this is not a claim that the wallet reported or proved its active network.
Available metadata that conflicts with the preset still fails. Missing methods,
malformed responses and transport errors do not silently become success.

Account/generation/abort checks remain active. Before returning a signed result
or submitting, the Xahau runtime must verify explicit NetworkID, RPC identity,
full signed intent, fee/expiry and account/key/signature. No wallet-side submit,
Xahau auth or passive Xahau restore is enabled. Provider live acceptance remains
pending; simulated successful connection is not evidence of live wallet support.

## 19. Ledger Device App Selection (2026-10-18, Unreleased)

At the maintainer's request, explicit Ledger connection now requests XRP on
XRPL and XAH on Xahau through the existing Ledger OS app-launch APDUs. This
supersedes the earlier no-auto-switch behavior recorded in sections 16/17.
LedgerHQ/app-xah Makefile declares APPNAME=XAH and the 44'/144' path.
This does not launch Ledger Live desktop or install device applications.

App-not-open/manual-reconnect errors name the selected app. autoOpenApp=false
retains manual control; deviceApp="XRP" explicitly selects the XRP compatibility
experiment on Xahau. There is no silent fallback from unavailable XAH to XRP.
Same-device transport recovery, abort/timeout and rejection behavior are retained.
Default client Ledger is still XRPL-only unless explicitly opted into Xahau.

Nineteen focused Ledger tests and typecheck pass, including XAH launch ordering,
already-open XAH, manual fallback messages and XRPL regressions. Actual XAH app
launch/device approval and transaction matrix acceptance remain maintainer tests.

## 20. Maintainer Payment Acceptance (2026-10-19, Unreleased)

The maintainer reports that Payment passes for all four integrated wallets:
Xaman, GemWallet, Xyra and Ledger. The preceding test discussion explicitly
selected mainnet. Ledger successfully auto-opens the XAH app on the device.
This supersedes the pending-live status for that app-launch behavior above.

The report is aggregate: per-wallet signing modes, hashes, browser and wallet/
device versions were not supplied with this update. Do not infer a complete
mainnet/testnet or sign-only/submission matrix, or validated ledger confirmation
for every mode. Payment success does not establish Invoke/HookParameters,
other transaction types, passive restore, message authentication or Safari popup
acceptance. Next live checks are tagged/memo Payment and then separate Invoke/
HookParameters cases, with no blind-signing workaround on Ledger.

The local Xaman Xahau path now accepts a bounded extension of a kit-autofilled
LastLedgerSequence only, while explicit dApp deadlines remain exact. The runtime
rechecks expiry against the trusted RPC after signing; all other intent fields
remain exact. Mainnet and testnet explorer presets use xahau.xrpl.org and
xahau-testnet.xrpl.org respectively. The preview mainnet confirmation popup was
removed at the maintainer's request; wallet approval and fee limits remain.

## 21. Code Review Follow-Up (2026-10-20, Unreleased)

Response to Review/XAHAU_CODE_REVIEW_2026-10-19.md, checked against the current
checkout rather than treating the review's snapshot as the current source:

This table records the first follow-up. Section 22 supersedes the deferred
R6/R8 and partial R10 dispositions below.

| Finding | Disposition |
| --- | --- |
| R1 | Raw message signing remains enabled as requested. Non-XRPL auth challenges include canonical chain identity; server expectedChainId rejects missing/mismatched chains before proof verification or nonce consumption. This is not a new Xahau proof verifier. Local Xahau Auth remains disabled. |
| R2 | Not reproduced in the current Git diff: normal and ignore-cr-at-eol stats match. No bulk renormalization, staging, or edits to unrelated files. |
| R3 | XRPL sign-only behavior and its default 1-XRP ceiling are documented. xrplMaxFeeDrops and request maxFeeDrops allow explicit ceilings; the smaller explicit cap wins. Offline high-fee/sign-only regression passes without submission. New live XRPL acceptance is not claimed. |
| R4 | Intentional fail-closed semantics retained and documented. Custom XRPL regression covers both legacy and chain restrictions; an empty legacy list remains deny-all. |
| R5 | Manager discovery already forwards registered custom presets. Added custom-network and networkless-event regression coverage; direct adapters still require explicit custom mappings. |
| R6 | IIFE still inlines the Xahau runtime. Fresh bundle measurement/add-on decisions are deferred until release/build authorization; no new size claim. |
| R7 | Protocol selection and confirmation lookup now use family plus declared network identity, not the first matching family or RPC URL alone. |
| R8 | Provider-specific wire mapping remains in adapters; a chain plugin/hints redesign is deferred. |
| R9 | Manager legacy-family decisions use the shared isLegacyNetwork helper. |
| R10 | Non-XRPL localStorage namespaces include family/network. Legacy XRPL storage is preserved; multiple XRPL managers still require caller-provided scoped storage. No cross-chain session migration. |

Chain-sensitive display checks cover amount errors, explicit Xahau mainnet/testnet
badges, generic account/address errors and Ledger app guidance. Ledger messages
use the selected XAH/XRP target even when an SDK error mentions the other app.
The XRPL Wallet Kit brand and XRPL Snap adapter name are intentionally unchanged.

Validation: workspace and example TypeScript checks passed; 193 focused tests
passed before the final Ledger wording regression, then 30 client/Ledger checks
passed including that new case. Browser checks at desktop and 320/375/414/768 px
passed without page errors. A local Auth HTTP check rejects Xahau challenges
and swapped-chain XRPL nonces before signature verification. No new live wallet
transaction, website/SDK bundle build, commit, push or publication was performed.

## 22. Remaining Review Implementation (2026-10-20, Unreleased)

- R6: the browser IIFE no longer includes the Xahau codec. It loads a version-matched
  ES-module runtime from the original script directory on first Xahau preparation
  or lookup. No caller import is needed. Missing assets, CSP failures and version
  mismatches stop before signing. Self-host both files or pin the CDN version.
  XRPL-only pages do not request this runtime. The build rejects accidental codec
  imports into the base IIFE. The runtime shares core error classes with the IIFE.
- R8: presets own `providerHints` for Xaman, GemWallet, Xyra and Ledger. Adapters
  consume the shared validated helper and caller-provided chain filters rather
  than hardcoding Xahau wire selectors or a two-family ceiling. Missing mappings
  fail before provider approval. Hints do not replace actual network verification.
  New same-model families need explicit presets, adapter configuration and runtime;
  the client's convenience defaults still cover XRPL/Xahau, not arbitrary chains.
- R10: client localStorage is scoped by family/network for XRPL and Xahau. A legacy
  XRPL session migrates once only on complete registered network identity match,
  followed by the normal provider verification. Logout prevents remigration.
  Old data is retained; old transaction history is not copied automatically.
  Explicit storage objects remain unchanged, including caller-owned namespaces.
- GemWallet injected providers without `signTransaction` do not advertise sign-only.
  The default SDK still exposes sign-only. Submit-only fixture coverage is not
  evidence of real-wallet sign-only acceptance.

Live acceptance remains maintainer-owned: GemWallet XRPL sign-only, Safari/iOS
Xyra popup behavior and Ledger transaction/field/version coverage must not be
reported as passed from offline tests. No live signing or broadcast was performed
by this follow-up, and no commit, push, npm publish or release is authorized here.

Final validation: typecheck, 464 tests (zero failures/cancellations), browser
build and VM smoke passed. Browser runtime checks passed under self-only CSP,
including signed Invoke/HookParameters, shared error identity, one lazy fetch,
404 and version-mismatch rejection before signing. Vite production browser and
Next.js/webpack production prerender passed the codec consumer checks. Local
desktop/mobile console layout checks passed without page errors.

Measured with Node gzip on the final minified assets:

| Asset | Bytes | Gzip bytes |
| --- | ---: | ---: |
| Baseline inline IIFE before this follow-up | 2,086,291 | 645,552 |
| Final base IIFE | 1,974,858 | 617,382 |
| On-demand Xahau runtime | 393,685 | 108,811 |

XRPL-only gzip download decreases by 28,170 bytes (4.36%). A page that actually
uses Xahau loads 726,193 gzip bytes total, more than the inline baseline because
the separately cached runtime duplicates some shared dependencies. This is a
tradeoff for keeping the codec out of XRPL-only downloads, not an overall Xahau
size reduction. Runtime transfer is deferred until needed, not removed.

Dependency audit policy passed with existing exceptions, not a clean audit:
root reports seven low and three high dependency findings (including elliptic
and node-forge); website reports zero. No blanket dependency upgrade was applied.

## 23. Invoke Mainnet Live Update (2026-10-21)

The maintainer reported basic Invoke on Xahau Mainnet passing with Xaman,
GemWallet, Xyra and Ledger. See `XAHAU_M0_LIVE_CHECKLIST.md`, section 11, for
the tested console preset, separate unsigned-simulation evidence and remaining
scope limitations. Earlier open Invoke gates are historical for this tested
flow; they are not evidence that arbitrary Hook logic or every signing mode passed.
