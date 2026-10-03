# Multisign Coordination

Release status: available on repository `main`; npm/CDN publication is pending.

Core provides opt-in, asynchronous helpers for collecting independently signed
XRPL transactions. Install the optional `xrpl` peer dependency to use them.
Single-sign APIs and default wallet behavior are unchanged.

## Prepare Once

Before requesting signatures, prepare the entire transaction against the target
network: source `Account`, `Sequence` (or ticket fields), `Fee`,
`LastLedgerSequence`, and any network-specific fields such as `NetworkID`.
Set `SigningPubKey: ""`; omit `TxnSignature` and `Signers`.
Budget the fee for the intended maximum number of signatures. Do not autofill,
change fees, or refresh expiry after collecting any signature: start a new round
instead. The default Ledger multisign path now requires this prepared payload
and signs it without an RPC connection or autofill. Custom Ledger sessions must
implement `signMultisignTransaction` and preserve the same intent.

Only use adapters whose transaction-mode capabilities explicitly support
multisign. Ordinary single-sign support does not imply multisign support.

## Trusted Signer Policy

Read the source account's SignerList from a trusted **validated ledger** on the
same network as the prepared transaction. Resolve each signer's currently
authorized public keys, including RegularKey and disabled-master-key rules.
Supply that snapshot as `MultisignPolicy`. Do not build this policy from the
untrusted contributions themselves. Signer weight is 1-65535; quorum must be
positive and cannot exceed the sum of authorized weights.

These helpers do not fetch ledger state, discover keys, or verify snapshot
freshness. An accepted signature proves possession of a supplied public key,
not that the ledger still authorizes it. Recheck signer-list/key authorization,
expiry, balance and the network fee before submission. Ledger state can change
after the check; only the ledger determines final acceptance.

## Combine and Submit

```ts
import {
  combineMultisignContributions,
  submitMultisignTransaction,
  type MultisignPolicy,
} from "@xrpl-wallet-kit/core";

// preparedTx is identical for every signing request.
// signingResults contain the txBlob returned by each capable adapter.
// policy is resolved from trusted ledger state, not from signingResults.
const policy: MultisignPolicy = trustedSignerPolicy;
const combined = await combineMultisignContributions(
  preparedTx, signingResults, policy,
);

if (combined.quorumMet && combined.feeSufficient) {
  // client is already connected to the intended network; no Wallet is passed.
  const response = await submitMultisignTransaction(
    preparedTx, signingResults, policy,
    (txBlob) => client.submit(txBlob),
    { signal: abortController.signal, timeoutMs: 30_000 },
  );
  // Check engine_result, then track the hash until validated or expired.
}
```

Contributions may be hexadecimal blobs or objects containing `txBlob`, including
`SignTransactionResult`. Each must contain exactly one signer. The helper
compares canonical encoded transaction intent, verifies every signature with
XRPL's cryptographic implementation, rejects duplicates and unauthorized keys,
and combines signers in numeric AccountID order using `xrpl.multisign`.
It never changes the transaction's signed fields. Inputs are captured before
asynchronous verification and are not mutated.

`combineMultisignContributions` supports partial collections and returns
`quorumMet`, `weight`, `quorum`, `signerAccounts`, `txJson`, `txBlob` and
`feeSufficient`. The fee check uses the supplied current `baseFeeDrops` times
`signerCount + 1`. It is a minimum check, not a guarantee against load escalation
or transaction-specific fee rules. Invalid contributions/policies throw
`WalletKitError` with `INVALID_REQUEST`.

`submitMultisignTransaction` verifies contributions again and refuses submission
without quorum or sufficient fee. The caller supplies the transport, owns its
connection, network selection and confirmation tracking. The helper dispatches
once; it does not retry, manage keys, collect signatures, or create manager
request/history entries. Submit responses are returned unchanged, including
unsuccessful engine results.

Cancellation/timeout is local. Cancellation before dispatch prevents submission;
after dispatch it cannot undo a network submission. Treat the outcome as unknown
and look up the transaction hash before any retry. Keep transport connections
alive until outstanding network work has settled.

## Validation Status

Automated tests cover Ed25519/secp256k1, authorized RegularKey, immutable intent,
duplicates, forged signatures, malformed contributions, quorum, fee refusal,
input snapshots, cancellation and mocked Ledger signing without RPC/autofill.
Live Ledger hardware and a funded multisign testnet account remain manual
integration checks. No claims of live ledger validation are made by these tests.

## Protocol References

- [XRPL multi-signing](https://xrpl.org/docs/concepts/accounts/multi-signing)
- [SignerListSet](https://xrpl.org/docs/references/protocol/transactions/types/signerlistset)
- [Transaction common fields](https://xrpl.org/docs/references/protocol/transactions/common-fields)
- [xrpl.js multisign](https://js.xrpl.org/functions/multisign.html)
