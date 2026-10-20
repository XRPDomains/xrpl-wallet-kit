# Xahau M0 - Architecture Decisions

Date: 2026-10-17. Design handoff, not a shipped API or live acceptance.
Read with XAHAU_M0_FINDINGS and XAHAU_IMPLEMENTATION_STANDARDS.

## 1. Runtime Boundary For M1

Select `xahau-binary-codec@2.3.0` with explicit per-instance definitions for the
first implementation; retain `xahau@4.2.0` as a development signing reference.
The private lockfile records integrity. Do not fetch definitions from a
wallet-supplied URL or mutate a process-global XRPL codec.

Core owns the protocol-neutral interfaces; an optional Xahau package implements
them. The application explicitly injects runtimes into a manager. No core, UI
or adapter import of that optional package, even a type-only import. XRPL-only
applications retain the current dependency path; a real consumer/bundle test is
an M1 acceptance gate, not proven by this document or the private Node tests.

Contract responsibilities (names provisional until M1 implementation review):

| Owner | Responsibility |
| --- | --- |
| Manager | Resolve fixed network and runtime; capture session revision, cancel stale work; enforce wallet capability/mode |
| Runtime | Validate supported transaction shape, prepare via injected trusted reader, encode, verify signed blob/hash/intent |
| Adapter | Translate explicit provider selector/request/reply; report authoritative account/network; never choose a codec globally |
| App | Inject endpoints, fee ceiling, storage namespace, user approval and explicit submit policy |

Pass runtime/context through a separate internal call dependency, never as
functions attached to transaction JSON. Start with fully prepared single-sign
native Payment/Invoke. Unsupported family/type/field/mode fails closed; no
fallback to XRPL. Preserve existing XRPL preparation behavior outside new paths.
Account signing authority beyond the master key (RegularKey/SignerList) needs
separate chain-aware validated-ledger evidence before acceptance.

## 2. Storage And Migration Design

Keep per-manager MemoryWalletStorage as the default. Persistent storage remains
opt-in. Use an explicitly injected namespace containing app/instance identity;
partition by exact registered network identity, not family alone. Two managers
on the same family/network must still be isolatable by namespace.

Use a deterministic structured tuple such as JSON serialization of
`[schema, namespace, family, presetId, numericNetworkId]` for new partition keys;
do not concatenate unchecked delimiters. A custom preset additionally binds its
registered identity and configured RPC policy. Network family/ID alone cannot
authorize a provider URL. Snapshot and test the current legacy key behavior
before introducing a new key/schema; preserve XRPL-only compatibility.

Restore procedure:

1. Parse the envelope with bounds/schema checks. Resolve its network through the
   caller's registry; reject ambiguous/missing/custom identity, never infer XRPL.
2. Confirm the adapter is registered and its effective chain/type/mode allows
   the target. Stored capabilities/account are hints, not authorization.
3. Query authoritative provider account/network or perform verified restore.
   If the provider cannot supply enough evidence, require reconnect.
4. Compare provider, registry and runtime chain identity. Only then install the
   session, increment revision and persist the new partition.
5. Migrate a legacy record only after successful verification. Never delete an
   unrelated manager's key or partially overwrite it on a failed restore.

M1 tests: two managers same chain, XRPL/Xahau sharing a backend, delimiter-like
namespace strings, legacy/custom ambiguity, tampered account, unavailable
provider, failed migration, reconnect to the same account and late callbacks.
Storage does not defend against malicious same-origin code; provider checks
prevent trusting an injected record as a wallet session.

## 3. Expected-Chain Authentication Design

The backend selects and stores an exact expected chain identity in each
challenge. Bind challenge ID, account, chain token, domain/origin, purpose,
nonce, issued-at and expiry into the signed bytes. Do not infer the chain from
the address or a Mainnet label. Transport aliases such as Wallet Standard's
`xrpl:21338` are not automatically the backend auth namespace.

Validation must compare the request and parsed signed message to the stored
challenge and expected chain, verify cryptographic ownership and apply explicit
chain-aware account-authority rules. Absence of signer evidence must fail, not
grant delegated authority. After verification, atomically consume the challenge
or nonce with a conditional update; a read-only 'nonce used?' check is not an
atomic replay defense. Concurrent verification may yield at most one success.
Never silently accept the old XRPL auth format for Xahau; migration is an
explicit server/client version decision. Backend integration is not implemented
by the transaction spike.

Required tests: valid chain, wrong family/network, same address on both chains,
changed domain/purpose, expired/future challenge, replay, concurrent replay,
missing chain/signer evidence, RegularKey authority mismatch and legacy format.

## 4. Cohort And Go/No-Go

| Candidate | Research direction | Production decision now |
| --- | --- | --- |
| Xaman | First candidate; verify selector, SignIn proof, fee and network-change semantics | NO-GO pending live evidence |
| GemWallet | Generic signTransaction with verified complete blob; network pre-check plus trusted RPC | NO-GO pending full-blob/autofill/live session evidence |
| Xyra | Existing deferred custom popup, explicit Xahau selectors, verified blob/hash | NO-GO pending live evidence |
| Ledger | Separate XRP/XAH app/version/type/field/mode matrix | Pending per case; no universal supported/unsupported verdict |
| Other adapters | No inferred Xahau support from XRPL compatibility | Outside initial cohort pending separate research |

No wallet-submit mode enters the cohort without a pre-broadcast fee guarantee.
Verified sign-only is the first candidate mode; even that is not enabled yet.
SetHook, mainnet acceptance and broad transaction support remain outside this
first prototype.

Implementation owner for the next code changes: Codex in this checkout.
The user has volunteered live testing; device/provider results are still pending.
Final independent reviewer is unassigned: this is a release gate, not a fabricated
approval. Re-estimate M1 after live captures identify provider normalization and
autofill work; the old 2-3 day M0 estimate excludes waiting for external evidence.
No evidence-backed calendar completion date is available yet.

## 5. M0 Deliverable Status

| Plan deliverable | Status |
| --- | --- |
| Package/license/definitions and minimal injection design | Artifact evidence plus design above; consumer packaging acceptance remains M1 |
| Three codec vectors, negative cases and isolation | 28 offline tests across codec/provider/boundary/RPC/lifecycle suite |
| Provider mapping and live connect/restore/network-change/sign | Mapping recorded; live results pending checklist |
| Namespace/migration/auth design and test plan | Recorded above; implementation belongs to later milestones |
| Network/type/mode and fee evidence | Testnet observation/prototype plus explicit no-go matrix; wallet autofill/Hook failures pending |
| Go/no-go, owners and re-estimate | Conditional go for implementation design; no-go for enablement; reviewer/date not invented |

**M0 is not fully closed until mandatory live evidence is reviewed or an explicit
scope change is approved.** Completed engineering research must not be described
as live wallet acceptance. See XAHAU_M0_LIVE_CHECKLIST for the user's next tests.
