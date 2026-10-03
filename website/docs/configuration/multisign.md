# Multisign Coordination

Available starting in v0.1.19.

Use the opt-in core helpers to verify and combine signer contributions without
modifying the prepared transaction. Install `xrpl` alongside the kit.

Prepare `Account`, `Sequence`/ticket fields, `Fee`, `LastLedgerSequence` and any
network-specific fields once. Set `SigningPubKey: ""` and omit signature fields.
Only request contributions from adapters that explicitly support multisign.
The default Ledger multisign path requires these fields and no longer autofills
each contribution; single-sign behavior is unchanged.

```ts
import {
  combineMultisignContributions,
  submitMultisignTransaction,
} from "@xrpl-wallet-kit/core";

const combined = await combineMultisignContributions(
  preparedTx, signingResults, trustedSignerPolicy,
);

if (combined.quorumMet && combined.feeSufficient) {
  const response = await submitMultisignTransaction(
    preparedTx, signingResults, trustedSignerPolicy,
    (txBlob) => connectedClient.submit(txBlob),
    { signal: abortController.signal, timeoutMs: 30_000 },
  );
}
```

The policy contains the source `account`, `quorum`, current `baseFeeDrops`, and
`signers: [{ account, weight, publicKeys }]`. Resolve it from trusted validated
ledger state on the intended network, including RegularKey/master-key rules.
Never trust keys or weights supplied by contributors. Recheck authorization,
expiry and fees before submitting; helpers do not fetch or refresh ledger state.

Signatures, encoded transaction intent, duplicates and key authorization are
checked before combination. Partial collections report `quorumMet: false`.
Submission refuses insufficient quorum/fee and dispatches once through the
caller-owned connection. A submit response is not ledger confirmation. Local
cancellation after dispatch cannot undo submission; look up the transaction
before retrying. These functions do not populate manager request/history state.

See the [full integration contract and test limitations](https://github.com/XRPDomains/xrpl-wallet-kit/blob/main/docs/multisign.md)
and [XRPL multisign requirements](https://xrpl.org/docs/concepts/accounts/multi-signing).
