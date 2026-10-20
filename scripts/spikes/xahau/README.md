# Xahau M0 Spike

Private research fixture, not a public workspace or production wallet runtime.
Xahau dependencies/lock are isolated here; root/public manifests and the normal
XRPL browser entry do not gain Xahau dependencies. The local lab adds only React
DOM development typings at the root. Offline tests also use the repository's
installed `xrpl` and `ripple-keypairs` as the XRPL baseline and fixture key tools.

```powershell
npm --prefix scripts/spikes/xahau ci --workspaces=false --ignore-scripts --no-audit --no-fund
node --import tsx --test scripts/spikes/xahau/*.test.mjs
```

Tests generate public deterministic fixture keys in memory. Never fund those
accounts. No test creates a network client, requests wallet approval or submits
a transaction. Import checks run in a child process without browser globals.

The strict encode/verify helpers are spike-only assertions for fully prepared,
canonical fixtures. They are not a general transaction validator, production
fee policy or published signing API. SDK cross-checks share the same underlying
codec and do not constitute independent protocol certification.

`boundary.mjs` adds a private Payment/Invoke subset validator and full signed-blob
verification prototype. It reuses core error codes via the root-installed `tsx`
loader; it is not exported by any public package. Policy requires an explicit
account, numeric network ID and maximum fee in drops. Only canonical native
amounts and the account's own single signing key are accepted. Regular keys,
multisign, issued amounts, other transaction types, RPC trust, ledger freshness,
fee estimation and hardware approval remain outside this prototype. The field
allowlist is deliberately narrower than protocol definitions; it is not a full
Xahau schema validator. No provider or RPC submit path exists here.

`rpc-policy.mjs` experiments with a fixed HTTPS testnet endpoint and a read-only
method allowlist. Its five tests inject a fake transport: no live RPC is called.
It checks server-reported network/ledger age, validated account sequence and
transaction-aware base/open-ledger fees against an explicit cap, then rechecks
network/expiry. It never silently increases the prepared Fee. The 30-second
age limit and 20-ledger expiry window are research choices, not public defaults.
This trusts the configured RPC's reports (not independent consensus evidence),
does not reserve a sequence, and produces no reusable authorization to sign or
submit. Revalidation after user approval, cancellation/session binding, Hook
execution errors and live fee-response semantics remain integration gates.

`sign-only.mjs` composes those prototypes with an injected sign-only dispatcher
and local session getter. Nine offline tests cover pre/post-approval preflight,
session changes, caller/provider mutation, malformed replies, abort and timeout.
No real provider is called. The session revision must increase on every relevant
disconnect/reconnect/account/network event, even if the same account returns.
The getter must describe already-verified state, not untrusted storage. This
contract remains historical M0 research, not the runtime used by the unified
console. It checks state at
async boundaries, not through a live event subscription. Aborting discards late
results but cannot undo signing on a device, close arbitrary wallet UI, or stop
an injected RPC transport that ignores cancellation. No subsequent RPC/dispatch
is initiated by this runner after cancellation. Production provider integration
and live acceptance remain pending; local reply normalization/serialization is
implemented only in the acceptance adapters below.

## Unified Local Console

The separate lab route/components and its browser test scaffold were removed.
Run `npm run dev:vanilla` and open `http://127.0.0.1:5173/`. Select Chain and
Network, then connect a supported wallet. Xahau uses the official adapters with
the optional `packages/xahau` runtime, not the private prototypes in this folder.
Set the explicit fee ceiling, use Payment or Transaction JSON, and select
sign-only or explicit submission. Mainnet broadcast requires confirmation.
The local RPC proxy has two fixed upstreams; it now accepts verified signed-blob
submission and transaction lookup in addition to preflight queries.

Focused type check: `node node_modules/typescript/bin/tsc --project examples/vanilla/tsconfig.json --pretty false`.
Live wallet/app acceptance is performed manually by the maintainer in that UI;
no further browser/mock suite is required just to use it.

Optional read-only testnet RPC probe (no signing/submission):

```powershell
node scripts/spikes/xahau/probe-testnet.mjs
```

The probe fixes the endpoint to Xahau testnet, checks network ID 21338 and only
allows server_info, server_definitions, account_info and fee. Fee observations
are examples for the queried account/destination at one ledger, not a global
default or proof of wallet behavior. No mainnet probe is included.

See docs/XAHAU_M0_FINDINGS.md for decisions, evidence and remaining gates.
