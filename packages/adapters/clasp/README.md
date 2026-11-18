# Clasp adapter

Opt-in hosted passkey wallet for XRPL Mainnet and Testnet. Register
`createClaspAdapter()` explicitly with WalletManager or a client's `adapters`.
Start connect and signing from a user action; successful requests may reuse the popup.
Use `signTransaction()` for a verified signed blob without submission and
`signAndSubmit()` for wallet-managed submission. `submit: false` uses sign-only.

Sign-only checks the returned fee against a default ceiling of 1,000,000 drops
or the configured/requested ceiling. For native submission, set `txJson.Fee`
when using a fee ceiling; the wallet's submit response does not include a blob
for independent verification. A returned hash is not proof of ledger validation.

Disconnect is local; no automatic restore, message signing, sign-in, multisign,
Batch, XRPL EVM or Xahau. See the [Clasp developer docs](https://claspwallet.com/developers/).

Kit's Clasp v1 transport cleans up listeners and timers on cancellation/timeout.
Once a submit request reaches the wallet, local cancellation cannot revoke it;
Kit leaves that approval untouched and never automatically replays the transaction.
Errors retain `details.hash` when supplied by Clasp. User rejection is a known
non-submission; unconfirmed submissions retain `outcomeUnknown: true`.

The `client` option accepts an SDK-compatible replacement. Custom clients must
implement `cancelPendingRequest(reason)` to release their underlying requests.
