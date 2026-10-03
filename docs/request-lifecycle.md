# Request Lifecycle and Cancellation

`WalletManager.connect`, `signMessage`, `signTransaction`, `signAndSubmit`, and
`authenticate` accept optional `signal`, `timeoutMs`, and `requestId`. Existing
calls without these fields remain supported. Authentication tracks its message
signing operation. Core does not impose a new default timeout; provider defaults
(including WalletConnect request timeouts) still apply.

Successful result shapes are unchanged. Cancellation caused by disconnect,
account/network changes, or destroy now rejects promptly with `REQUEST_CANCELLED`,
including during preflight (rather than waiting to report `PREFLIGHT_FAILED`).
Apps that match error codes should handle the new cancellation/expiration codes;
existing code using error categories can continue treating these as user action
or timeout. A destroyed manager cannot be reused; create a new instance.

```ts
const controller = new AbortController();
const requestId = crypto.randomUUID();
const unsubscribe = manager.on("request_changed", ({ request }) => {
  if (request.id === requestId) renderRequest(request);
});
try {
  await manager.signAndSubmit({
    txJson,
    requestId,
    signal: controller.signal,
    timeoutMs: 120_000,
  });
} finally {
  unsubscribe();
}
// In the application's cancel action, use controller.abort() or:
// manager.cancelRequest(requestId);
```

`timeoutMs` must be finite, positive, and at most 2147483647 milliseconds.
IDs must be non-empty strings of at most 200 characters and must not duplicate
retained requests in the same manager. Omit the ID to generate one. These IDs are
local diagnostics, not wallet authentication challenges or protocol nonces.

## States

- `pending`: accepted locally, before dispatch/preflight completes.
- `opened`: the provider operation has been invoked or the provider reports opening.
  It does not prove that the user saw a popup or QR code.
- `connected`: a connection completed.
- `signed`: a signature/sign-only result returned, or the provider reports signing.
- `submitted`: a sign-and-submit operation returned successfully. This does not
  mean ledger validation; use transaction confirmation separately.
- `expired`: the local timeout elapsed or the provider reported expiration.
- `cancelled`: local abort, disconnect, destroy, changed signing account/network,
  or a recognized provider rejection.
- `failed`: another operation error.

Read `pending` on the snapshot to distinguish provider progress from completion.
For example, Xaman can report `signed` while result retrieval is still pending.
Successful submit flows report `signed` then `submitted`; `submit: false` stops
at `signed` and does not automatically register a submitted transaction.

`getPendingRequests()` returns active snapshots. `getRequest(id)` returns a
frozen diagnostic snapshot. The manager keeps at most 100 terminal records plus
active requests in memory. Records contain times, adapter/account/network, state,
and optional provider UUID/hash, never transaction payloads or signing proofs.
`request_changed` observers cannot change the provider outcome by throwing.
Adapters may report provider progress via `onRequestProgress`; existing adapters
that ignore the new fields remain usable through the manager's local wrapper.

## Local Cancellation Is Not Transaction Cancellation

Abort/timeout settles the caller's promise, removes local timers/listeners, and
ignores late provider results. A provider may continue signing or submitting.
`REQUEST_CANCELLED`, `REQUEST_TIMEOUT`, and `REQUEST_EXPIRED` errors include
`details.requestId`, `details.outcomeUnknown`, and available provider UUID/hash.
For a dispatched sign-and-submit request, `outcomeUnknown` is conservatively true
after failure/cancellation. Do not interpret that as failure on the ledger or
automatically retry payment. Check the wallet/provider result and, when a hash is
available, reconcile it against the intended network before retrying.

Xaman closes/resolves the local subscription, including one created after an
abort, without deleting the remote payload. Its payload UUID is exposed as
`providerRequestId`. WalletConnect cancels the local response wait without
disconnecting a valid session; it cannot withdraw an RPC already sent to the
wallet. No synthetic WalletConnect provider request ID is invented.

## Background, Deeplink Return, and Reload

Going into the background does not automatically abort a request. Returning from
a deeplink in the same document continues waiting on the existing SDK operation;
the kit never sends a second signing request on visibility/focus changes. Browser
suspension can delay timer execution, so a local timeout is not a wallet/ledger
expiry guarantee. Apps that want to cancel on backgrounding must explicitly abort.

On reload, in-memory pending request records are lost. Passive auto reconnect and
existing Xaman/WalletConnect connection recovery can restore the wallet account,
but do not resume/replay a pending signing RPC or recreate a signing payload.
Session restoration is not proof that a pending transaction failed or succeeded.
An app requiring cross-reload result recovery must retain its own minimal intent
correlation and available provider UUID/hash, then use provider/server-side result
lookup or ledger reconciliation. Never persist secrets, proofs, or full sensitive
transaction data merely to retry automatically.

`destroy()` cancels pending local waits and prevents future manager operations;
it does not log the wallet out or remove its persisted session. `disconnect()`
also clears the active session. Neither can undo a remote submit.

## Adapter Implementations

Use the protected `BaseWalletAdapter.withWalletRequest(request, operation)` when
implementing a cancellable provider wait, or the exported lazy
`waitForWalletRequest` / `assertWalletRequestActive` helpers. Check the signal
after asynchronous preparation before starting provider work. Remove SDK
subscriptions in `finally` and handle subscriptions created after cancellation.
Do not pass local control fields into wallet RPC parameters. Do not add an await
before popup-opening calls that require synchronous browser user activation.

Tests in `tests/request-lifecycle.test.ts` and
`tests/mobile-request-lifecycle.test.ts` cover local cancellation, late results,
expiry, connection persistence races, passive return/reload, and no signing replay.
Real-device deeplink/provider cancellation behavior still requires manual QA.
