# @xrpl-wallet-kit/xahau

Unreleased, opt-in Xahau protocol runtime. Core/UI/adapters do not import this
package. Core/selective consumers keep Xahau as an explicit dependency.
The all-in-one client installs it automatically and registers a lazy runtime
when Xahau is configured; dApps using that client do not need the imports below.
The browser IIFE loads a separate, version-matched Xahau runtime only on first
transaction preparation or lookup. Self-host its runtime asset beside the IIFE;
see the browser package README for CSP and CDN version pinning requirements.

```ts
import { WalletManager } from "@xrpl-wallet-kit/core";
import { createXahauProtocol, XAHAU_NETWORKS } from "@xrpl-wallet-kit/xahau";
import { createXyraAdapter } from "@xrpl-wallet-kit/adapter-xyra";

const manager = new WalletManager({
  network: "xahau-testnet",
  networks: [...XAHAU_NETWORKS],
  protocols: [createXahauProtocol()],
  adapters: [createXyraAdapter({ supportedChains: { families: ["xrpl", "xahau"] } })]
});
await manager.connect("xyra"); // explicit user action
const result = await manager.signTransaction({
  txJson: { TransactionType: "Payment", Destination: "r...", Amount: "1" },
  maxFeeDrops: "100000" // app/user-selected ceiling, not a recommended default
});
```

The same opt-in applies to Xaman, GemWallet and Ledger. Register mainnet 21337
or testnet 21338 explicitly. RPC identity is checked against the selected preset.
For browser CORS, inject a trusted `request(network, method, params, signal)`
implementation; never proxy arbitrary provider URLs. The 5173 local console
already supplies a fixed-endpoint proxy and supports both chains/networks.

Implemented transaction scope: native Payment, Invoke/HookParameters, TrustSet,
OfferCreate, OfferCancel, AccountSet, URITokenMint/Burn/Buy/CreateSellOffer/
CancelSellOffer; master-key single-sign only. Unsupported
types, multisign, noncanonical/dropped fields, conflicting Account/NetworkID,
unbounded fees and expired/stale preparation fail closed. Xahau NFTs use URIToken
transactions, not the XRPL console's NFToken offer forms. SetHook, XLS-20 parity,
chain-bound message auth and passive Xahau session restore are not claimed.

The local console exposes raw message signing for Xaman (non-submittable SignIn,
explicit Xahau network selector) and GemWallet (native message signature).
Signing a message is separate from authentication: these results do not establish
chain ownership, freshness or replay protection. Applications must include their
domain/network/nonce in the message and verify the returned proof appropriately.
The XRPL auth demo remains disabled on Xahau. Xyra and Ledger do not advertise a
message signing API in their current adapters. Live acceptance is still required.

All Xahau adapters sign without broadcast, verify the complete blob/intent/key/
signature/hash/fee, and recheck preflight. Explicit sign-and-submit then sends
the verified blob to the configured RPC; accepted broadcasts remain `submitted`,
not validated success. Never retry an uncertain submission blindly. Ledger app
support is transaction/field/version dependent. Explicit Ledger connect now
requests the XAH device app by default (autoOpenApp can be disabled); it never
enables blind signing or silently falls back to XRP. Live device/wallet
acceptance is performed by the user.

Preparation reads `account_info` from the current open ledger with queue data,
and selects the next sequence after locally queued transactions. Network identity
and transaction expiry still use a recent validated ledger. This is not a global
sequence reservation: serialize concurrent signing from the same account.

Submission errors use `SUBMIT_FAILED`, preserving `hash`, `engineResult`,
`submissionRejected`, `final` and `outcomeUnknown` when available. A local
`tef`/`tel` rejection is not proof of final failure across the network;
`tem` is final, while already-seen/past-sequence, relayed and provisional
responses still need hash lookup. Never infer permission to create a new
payment from `outcomeUnknown: false` alone.

Compatibility checked locally with Node 22.17 (native ESM), Vite 6.4.3
(production Chrome execution) and Next 16.3.8 (production server prerender).
The Vite/Next checks round-trip Invoke with NetworkID and HookParameters through
the built package. JSON import attributes require a compatible Node/bundler;
older bundlers are not claimed supported. RPC cancellation uses AbortController
with a cleaned-up timer, not AbortSignal.any/timeout.

After building packages, rerun `node scripts/check-xahau-consumers.mjs` with
Playwright and Chrome available (`PLAYWRIGHT_MODULE_PATH` may point to an
external Playwright installation). Fixtures stay under ignored `tmp/`.
