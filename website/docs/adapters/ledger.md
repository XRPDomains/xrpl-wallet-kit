# Ledger Adapter

The Ledger adapter connects to a hardware Ledger device via WebHID (preferred) or WebUSB. The XRP app on the Ledger handles transaction signing; private keys never leave the device.

## Installation

```bash
npm install @xrpl-wallet-kit/adapter-ledger
```

## Quick Start

```ts
import { createLedgerAdapter } from "@xrpl-wallet-kit/adapter-ledger";

const adapter = createLedgerAdapter({
  accountIndex: 0,  // BIP44 account index (default: 0)
});
```

## Options

| Option | Type | Default | Description |
|---|---|---|---|
| `accountIndex` | `number` | `0` | BIP44 account index (`44'/144'/<index>'/0/0`) |
| `derivationPath` | `string` | `44'/144'/0'/0/0` | Full custom derivation path (overrides `accountIndex`) |
| `preferWebHID` | `boolean` | `true` | Prefer WebHID transport; fall back to WebUSB if unavailable |
| `timeout` | `number` | `60000` | Timeout in ms for device operations (connect + sign) |
| `connectLedger` | `() => Promise<LedgerSession>` | — | Inject a custom connection flow (useful for custom account pickers) |
| `icon` | `string` | — | Override the default Ledger icon |

## Connection Flow

1. User clicks Ledger in the connect modal
2. Browser shows a WebHID or WebUSB device picker — user selects their Ledger
3. The adapter opens a transport connection and calls `getAddress()` from the XRP app
4. The Ledger device displays the address for confirmation (if `verify: true`)
5. The adapter returns the account address and public key

::: warning Requirements
- Ledger device must be **connected** via USB
- Ledger must be **unlocked** (PIN entered)
- **XRP app** must be open on the device
- Browser must support WebHID (`navigator.hid`) or WebUSB (`navigator.usb`)
:::

## Capabilities

| Capability | Supported |
|---|:---:|
| connect | ✅ |
| disconnect | ✅ |
| signTransaction | ✅ |
| signAndSubmit | ✅ |
| sessionRestore | ❌ |
| signMessage | ❌ |
| payments | ❌ (standard txJson works) |
| nftOffers | ❌ (standard txJson works) |

## Message Signing

Ledger **does not support** arbitrary message signing. There is no `signMessage` method. If your flow requires message signing, use a software wallet such as GemWallet or Crossmark.

## Transactions

The adapter autofills the transaction via an `xrpl.js` client connection, then sends it to the Ledger for signing. The user must confirm the transaction on the device screen.

```ts
// Sign-only (no broadcast)
const signed = await manager.signTransaction({
  txJson: {
    TransactionType: "Payment",
    Account: session.account.address,
    Destination: "rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe",
    Amount: "1000000",
  },
});
// signed.txBlob — hex blob ready for submission
// signed.signed — boolean

// Sign + submit
const result = await manager.signAndSubmit({
  txJson: { TransactionType: "Payment", ... },
});
// result.hash   — transaction hash
// result.status — e.g. "tesSUCCESS"
```

The adapter requires a network URL (`options.network.rpcUrl`) to autofill and submit. It connects and disconnects from the XRPL network per transaction.

### Multiple Accounts

Use `getAccounts()` to browse multiple Ledger accounts before connecting:

```ts
import { LedgerAdapter } from "@xrpl-wallet-kit/adapter-ledger";

const ledger = new LedgerAdapter();
const accounts = await ledger.getAccounts(5); // first 5 accounts
// [{ address, publicKey, path, index }, ...]

// Connect to a specific account
const adapter = createLedgerAdapter({ accountIndex: 2 });
```

## Session Restore / Mobile Return Recovery

Session restore always returns `null`. Hardware wallets require a fresh device prompt — there is no safe passive state to verify a stored session. On page reload, the user must reconnect by selecting their Ledger device again.

## Known Limitations

- No `signMessage` — Ledger XRP app does not support arbitrary message signing.
- No session restore — requires a fresh device connection every page load.
- A live XRPL network connection is required for autofill (`rpcUrl` must be set on the connected `XrplNetwork`).
- Browser must support WebHID or WebUSB — Firefox and Safari have partial or no support.
- Only one Ledger transport can be open at a time; concurrent adapter instances may conflict.

## Troubleshooting

**"No device found" / "Cannot open device"?** The USB cable is not connected or the device is locked. Connect the Ledger and enter the PIN, then retry.

**"Please open the XRP app"?** The Ledger is unlocked but the XRP app is not running. Navigate to the XRP app on the device and open it.

**"Ledger is locked"?** Enter your PIN on the device to unlock it, then retry.

**"Request timed out"?** The default timeout is 60 seconds. If the user takes longer to confirm on device, increase `timeout` in options.

**User rejected the transaction?** The adapter throws a `WalletError` with code `SIGN_REJECTED` when the user presses the Reject button on the Ledger.

**Browser not supported?** Chrome and Edge support WebHID/WebUSB. Firefox has limited WebUSB support. Safari does not support either transport.

## Manual Test Checklist

- [ ] Browser compatibility check — `navigator.hid` or `navigator.usb` present
- [ ] Connect — device picker shows, Ledger address returned after approval
- [ ] `signTransaction` — user confirms on Ledger, `txBlob` returned (no broadcast)
- [ ] `signAndSubmit` — user confirms on Ledger, transaction confirmed on ledger, hash returned
- [ ] `getAccounts(5)` — first 5 BIP44 derivation paths returned
- [ ] Page reload — no auto-restore (user must reconnect manually)
- [ ] Ledger locked — error message "Ledger is locked" shown
- [ ] XRP app not open — error message "Please open the XRP app" shown
- [ ] Timeout — user doesn't confirm in time, readable timeout error shown
- [ ] Rejection — user presses Reject on Ledger, adapter throws `SIGN_REJECTED`
