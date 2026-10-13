# @xrpl-wallet-kit/adapter-ledger

Ledger hardware wallet adapter for XRPL Wallet Kit.

This adapter connects to Ledger devices through WebHID or WebUSB, reads an XRPL account from the XRP app, and supports signed transaction flows for XRPL dApps.

## Capabilities

- `connect`
- `disconnect`
- `signTransaction`
- `signAndSubmit`

## Install

```bash
npm install @xrpl-wallet-kit/adapter-ledger
```

## Usage

```ts
import { createWalletKit } from "@xrpl-wallet-kit/client";
import { createLedgerAdapter } from "@xrpl-wallet-kit/adapter-ledger";

const kit = createWalletKit({
  adapters: [createLedgerAdapter()]
});
```

## Runtime Notes

- Requires a browser with WebHID or WebUSB support.
- Requires a connected Ledger device with the XRP app open.
- Hardware wallets are explicit user-presence devices. `restoreSession()` returns `null` and does not silently reconnect after refresh.
- Default derivation path is `44'/144'/0'/0/0`.
- `signTransaction()` signs without submit.
- Default signing verifies the device signature locally before returning or submitting it. RPC errors keep their original message and cause rather than being translated into device errors.
- Disconnecting or changing the Ledger session while signing prevents subsequent submission.
- Default single-sign signing autofills network fields and adds `tfFullyCanonicalSig`, preserving transaction-specific flags, for compatibility with XRP app versions such as 2.3.2. It does not change destination, amount or tags.
- Device signing errors include the prepared transaction and Ledger status code in `details`; `submitAttempted: false` means the adapter did not reach submission. App version is included when available.
- `signAndSubmit()` signs and submits when requested by the caller.
- `signTransaction()` supports XRPL multisigning when `SigningPubKey` is empty. It returns a signed blob plus the signer contribution under `raw.signer`/`raw.signedTx` for the dApp to combine with other signers.
- `signAndSubmit()` rejects multisign payloads with `UNSUPPORTED_METHOD`; the dApp must combine a quorum of signer contributions before submission.
- A custom `connectLedger` session must implement `signMultisignTransaction()` to opt into multisigning.
- Default multisign signing requires a fully prepared transaction (`Account`, `Sequence`/ticket fields, `Fee`, `LastLedgerSequence`, `SigningPubKey: ""`, no signature fields). It does not autofill or connect to RPC. Prepare once before collecting signatures; see [core coordination helpers](../../../docs/multisign.md).

## Options

```ts
createLedgerAdapter({
  accountIndex: 0,
  derivationPath: "44'/144'/0'/0/0",
  preferWebHID: true,
  timeout: 60000
});
```

Use `connectLedger` in tests or custom integrations to inject a prebuilt Ledger session.

## Testing

Hardware transport should be mocked in unit tests. Manual smoke testing should cover:

- unsupported browser;
- device disconnected;
- device locked;
- XRP app not open;
- connect success;
- disconnect cleanup;
- `submit:false` signed transaction result;
- multisign sign-only contribution and malformed pre-populated `Signers` input;
- multisign submission fails closed;
- user rejection on device.

## Links

- Ledger: https://www.ledger.com
- XRPL Wallet Kit: https://github.com/XRPDomains/xrpl-wallet-kit
