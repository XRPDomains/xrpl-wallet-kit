# Chain-Aware Adapters

Read the current `packages/core/src/types.ts`, `protocol.ts`, `utils.ts` and
the nearest chain-aware adapter before coding. `packages/xahau/src/networks.ts`
and `index.ts` define the current Xahau presets and runtime scope; do not infer
support from a shared address format or transaction name.

## Declaration and Connection

- Declare `capabilities.details.supportedChains` using `families`, `networkIds`
  or both. Read the core filter semantics: combined constraints intersect;
  empty filters match nothing. Keep any legacy `supportedNetworks` declaration
  consistent with the chain filter.
- A missing chain declaration preserves legacy XRPL behavior; it does not opt
  the adapter into Xahau. Adding `families: ["xrpl", "xahau"]` is a support
  claim, not a substitute for implementing both signing paths.
- Manager rejects unsupported networks and non-XRPL networks without a registered
  protocol before `adapter.connect()`. Do not bypass this guard in direct-provider flows.
- Use `ConnectOptions.protocolContext` for non-XRPL signing. Require a protocol
  for any non-XRPL family rather than special-casing `family === "xahau"`.
- Read wallet wire selectors from `network.providerHints`; do not scatter chain
  names, RPC endpoints or network IDs throughout adapter methods.
- Verify the provider's selected chain/network where the provider exposes them.
  A provider may report only chain/name, not NetworkID: map verified identifiers
  to registered presets. A rejection or missing response is not network proof.
- Emit `accountChanged`/`networkChanged` with the resolved network. If an adapter
  declares `supportedChains`, a network event without a network disconnects the
  session; an event outside its filter also disconnects it.
- Recheck account/network after asynchronous wallet operations. Clear stale
  protocol context on disconnect. Do not relabel an existing session as another chain.

## Signing and Submission

- Reuse `prepareProtocolTransaction` and `verifyProtocolTransaction` from core
  when appropriate; pass generic `txJson`, not XRPL-specific `walletPayload`.
- Xahau preparation requires a positive `maxFeeDrops`. Preserve the manager's
  effective fee ceiling and signal. The protocol prepares NetworkID, sequence,
  fee and expiry using its trusted RPC; do not run XRPL codec/autofill afterward.
- Obtain the signed blob without provider submission, verify it, then call the
  protocol's `submit` only when requested. A wallet API that always broadcasts
  is not automatically suitable for this protocol-owned submission flow.
- Hardware signing uses the protocol codec for transaction serialization and
  signature verification; never encode Xahau through the XRPL codec. Preserve
  Account, NetworkID, HookParameters, amounts and all other signed intent.
- Keep explicit caller expiry strict. The shared verifier permits only a bounded
  extension of kit-autofilled expiry and rechecks against trusted RPC; do not
  ignore LastLedgerSequence or other verification failures globally.
- Lazy protocol `encode`, `decode` and `verify` are synchronous and require an
  initialized runtime. Await `prepare` before using them; connection alone does
  not load the browser Xahau runtime.
- `submit: false` must not broadcast. Preserve `SUBMIT_FAILED`, hash, engine result,
  finality and `outcomeUnknown` from protocol errors; do not wrap all failures as
  `SIGN_FAILED` or infer confirmation from a preliminary RPC success response.

## Xahau Scope and Integration

- Mainnet: `xahau-mainnet`, NetworkID 21337. Testnet: `xahau-testnet`, NetworkID 21338.
  Both use XAH with six decimal places. Use preset explorers and native-asset
  metadata for links, labels, fee messages and hardware app selection.
- Current runtime supports master-key single-sign Payment, TrustSet,
  OfferCreate/Cancel, AccountSet, Invoke with HookParameters, and URIToken
  mint/buy/sell-offer/cancel/burn. Check the source allowlist before extending it.
- Do not claim SetHook, Batch, multisign, delegated-key signing, XLS-20 parity,
  chain-bound authentication or passive Xahau restore. Raw message signing is
  not a chain-bound login proof. XRPL NFT capability flags do not imply URIToken support.
- Full client automatically registers Xahau presets and lazy protocol. Core and
  `client/selective` need explicit registration from `@xrpl-wallet-kit/xahau`.
  Keep core independent of Xahau package imports.
- Xaman, GemWallet and Xyra participate in the full client's Xahau setup; Xaman
  requires its client ID. Ledger is explicitly opt-in and opens XAH on the
  hardware, not Ledger Live. Do not broaden defaults just because connect works.
- Browser runtime is a separate, fully minified ESM asset named
  `xrpl-wallet-kit-xahau.runtime.js`, loaded beside the IIFE on demand. Preserve
  matching versions, CSP/CORS compatibility and shared core error identity.

## Focused Validation and Docs

Cover supported and rejected networks, missing protocol, provider mismatch,
cross-chain events, sign-only/no broadcast, preserved fields, fee limits and
submission outcome mapping as relevant to the change. Hardware or wallet live
tests are user-operated; do not submit real transactions automatically.

Consumer docs should show configuration and transaction examples with correct
asset units, supported wallets and essential restrictions. Keep live-test logs,
issue status and implementation history in internal acceptance/review documents.
