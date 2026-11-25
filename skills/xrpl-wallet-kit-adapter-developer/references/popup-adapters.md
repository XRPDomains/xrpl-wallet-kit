# Hosted Popup Adapters

Use this reference for Clasp, GhostSig, Xyra, and other wallets that exchange requests with a hosted popup. Match the provider's documented handshake and submission contract.

## Opening and routing

- Validate the configured wallet URL and network before opening. Pin the exact trusted origin for both incoming messages and the outgoing target origin. Accept a development origin only through an explicit development setting.
- Open from the user's click before any asynchronous setup that can lose browser user activation. If preparation can wait, open the window first and dispatch only after the request is ready and the provider handshake has completed.
- Check the sender window, exact origin, expected message type, reply schema, and the active request identity before handling a message. Use an unpredictable request ID where the protocol supports it. Ignore duplicated readiness messages after dispatch. For protocols without a request ID, isolate attempts by popup window and accept replies only from the active instance.
- A popup that opens but never becomes ready can indicate COOP severed the opener reference. Check the actual deployed response headers and the provider's configuration. The Clasp and GhostSig guides document `same-origin-allow-popups` for dApps using their transports. Keep the rest of the site's isolation and CSP intact and scope any header change to the required surface.

## Cancellation and finality

- Track which attempt owns the popup, listeners, and timers. A busy error, stale reply, timeout, or cleanup from another attempt must leave the active attempt alone.
- Distinguish opening or handshaking from dispatching a submission request. Before dispatch, transport failure can be reported as known not submitted. After dispatch, closure, timeout, or local cancellation may leave the result unknown. Keep a provider hash when available, surface the uncertainty, and never automatically replay or reuse a window that may still be submitting.
- Preserve explicit provider rejection and verified ledger failure separately. Claim success only when validated ledger evidence establishes it. A preliminary response or hash is enough to start tracking, with confirmation handled separately.
- Passive restoration must prove the same account without opening a window. If the provider has no passive proof, require user-initiated reconnect and document it.

## Signed intent and provider exceptions

- Use `txJson` as the source for generic Kit signing. Apply documented provider defaults on a copy before dispatch. Verify against that same normalized intent, preserving explicit fields. GhostSig's omitted `SourceTag: 0` default is specific to GhostSig. Keep `DestinationTag` independent.
- For sign-only, check the returned blob against the connected account/key, applicable network, signature, hash, and requested fields. Allow only the documented autofill fields and bounds. Confirm `submit: false` takes the sign-only path.
- Document whether `signAndSubmit` is wallet-managed or the Kit submits a verified blob via RPC, and what finality evidence the provider returns. Only advertise tested transaction modes and networks.

## Acceptance

Cover popup-blocked, readiness timeout, wrong-origin/window/ID, duplicate readiness, cancellation and late replies, reconnect, changed signed fields, sign-only with no broadcast, and uncertain submission with no replay. Exercise the entry point under the actual dApp origin and headers on the supported networks. Keep live results distinct from transport fixtures.

Repo examples: `packages/adapters/clasp/src/client.ts`, `packages/adapters/ghostsig/src/popup.ts`, `tests/clasp.test.ts`, `tests/ghostsig.test.ts`, and `tests/xyra.test.ts`.
