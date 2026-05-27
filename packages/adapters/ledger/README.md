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
- `signAndSubmit()` signs and submits when requested by the caller.

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
- user rejection on device.

## Links

- Ledger: https://www.ledger.com
- XRPL Wallet Kit: https://github.com/XRPDomains/xrpl-wallet-kit
