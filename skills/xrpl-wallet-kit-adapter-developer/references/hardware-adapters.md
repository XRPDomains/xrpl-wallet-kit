# Hardware Adapter Notes

Use this reference when building Ledger, Trezor, or other hardware wallet adapters.

## Core Principles

- Treat hardware wallets as explicit user-presence devices.
- Do not auto-restore a hardware wallet as connected after page refresh unless the SDK provides a safe, confirmed session model.
- Prefer returning `null` from `restoreSession()` so the UI can ask the user to reconnect the device.
- Keep transport code inside the adapter; keep account picker UI outside the adapter.
- Always clean up USB/HID transports on disconnect and after temporary account lookups.

## Browser Support

Hardware browser support should be feature-detected:

- WebHID: `navigator.hid`
- WebUSB: `navigator.usb`

`isAvailable()` should return `false` when neither is available. Missing support is not an exceptional crash path.

## Connection Flow

A good hardware `connect()` flow:

1. Check WebHID/WebUSB support.
2. Create the preferred transport.
3. Instantiate the wallet app SDK.
4. Request the address using a derivation path.
5. Return normalized `account.address`, optional `publicKey`, and `session.metadata.derivationPath`.
6. Clean up transport if connection fails.

Default XRPL derivation path:

```text
44'/144'/0'/0/0
```

If account selection is supported, expose a method such as `getAccounts(count, startIndex)` but keep the UI chooser outside the adapter.

## Signing Flow

For XRPL Ledger-style transaction signing:

1. Ensure an active hardware session exists.
2. Autofill transaction fields through XRPL RPC if needed.
3. Set `Account` to the connected address when missing.
4. Remove `TxnSignature` and `Signers` before signing.
5. Set `SigningPubKey` to the hardware public key for normal signing.
6. Encode the transaction to a signing blob.
7. Ask the hardware device to sign.
8. Rebuild the signed transaction with `TxnSignature`.
9. Return a signed-only result for `submit:false`, or submit and return hash/status for `submit:true`.

For `submit:false`, return enough data for downstream code:

```ts
{
  signed: true,
  raw: {
    txBlob,
    signedTx
  }
}
```

## Capability Rules

- Enable `connect` only when the adapter can retrieve an address from the hardware device.
- Enable `disconnect` when transport cleanup is implemented.
- Enable `signAndSubmit` only after transaction signing and optional submit behavior are implemented.
- Do not enable `signMessage` unless the hardware app exposes a real message-signing method or the project has explicitly standardized a transaction-based proof for that wallet.
- Do not enable `payments` or `nftOffers` until those XRPL payloads have been tested manually.

## Error Mapping

Map common hardware states to user-friendly errors:

- device not connected: wallet not available;
- browser does not support WebHID/WebUSB: wallet not available;
- device locked: connection failed with unlock instructions;
- app not open: connection failed with "open the XRP app";
- user rejected on device: rejected/canceled error;
- operation timeout: timeout error.

Preserve the original provider error as cause/raw where possible.

## Manual Test Checklist

- Browser without WebHID/WebUSB returns unavailable state.
- Ledger disconnected returns a friendly missing-device error.
- Ledger locked returns unlock instructions.
- Ledger connected but XRP app closed returns "open XRP app".
- Connect succeeds with expected address/public key.
- Disconnect closes transport and clears session.
- Refresh does not silently reconnect as active hardware wallet.
- `submit:false` returns a signed tx blob and `signed: true`.
- `submit:true` submits and returns hash/status.
- User rejection on device does not leave UI stuck in loading/signing.

