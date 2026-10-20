# @xrpl-wallet-kit/adapter-xaman

## Browser authorization (since 0.1.23)

Browser logins use an independent OAuth state and a five-minute deadline. A
same-origin return tab can complete the original pending login through local
storage. Tokens are scoped to the configured app and authenticated with Xaman's
userinfo endpoint; a URL or local-storage record alone is not proof of login.
Cancellation prevents a late callback from activating an account. Other tabs
without an explicit pending login do not connect automatically. Storage must be
available for this flow. xApps and injected authentication retain their SDK path.
These changes ship in 0.1.23. Live mobile acceptance remains pending; automated
coverage does not establish compatibility with every mobile browser.

Xaman adapter for XRPL Wallet Kit.

Xaman is a mobile XRPL wallet. This adapter uses the Xaman SDK / OAuth PKCE flow, emits QR and deeplink connection payloads through XRPL Wallet Kit, and supports mobile return recovery.

## Capabilities

- `connect`
- `signMessage`
- `signAndSubmit`
- `payments`
- `nftOffers`
- `qr`
- `deeplink`

## Install

```bash
npm install @xrpl-wallet-kit/adapter-xaman
```

## Usage

```ts
import { createWalletKit } from "@xrpl-wallet-kit/client";
import { createXamanAdapter } from "@xrpl-wallet-kit/adapter-xaman";

const kit = createWalletKit({
  adapters: [
    createXamanAdapter({
      apiKey: "YOUR_XAMAN_API_KEY"
    })
  ],
  autoReconnect: true
});
```

When using `@xrpl-wallet-kit/client` defaults, Xaman is already included when configured through the client options.

## Runtime Notes

- Requires a Xaman API key or injected test SDK/auth objects.
- Connection and signing may produce QR/deeplink flows. The adapter reports those through the manager/UI event path.
- Pending mobile-return recovery markers use `WalletStorage` through the adapter's `recoveryStorage` option.
- `restoreSession()` waits briefly for the Xaman OAuth/PKCE SDK to rehydrate remembered JWT state after page reload, then restores only when the active Xaman account matches the stored session.
- `restoreSession()` verifies account ownership only. It preserves the stored manager network context instead of treating Xaman refresh metadata as proof that the mobile app switched networks.
- `restoreSession()` and `recoverSession()` are best-effort and return `null` for normal stale or unavailable sessions.
- Sign-only transaction requests (`submit: false`) allow Xaman to extend `LastLedgerSequence` by at most `maxLastLedgerSequenceExtension` ledgers. The default is `50`; set `0` to require exact preservation.
- On Xahau, this allowance applies only to expiry autofilled by the kit, for both signing modes. An explicit dApp deadline must remain unchanged. All other fields remain exact, and the accepted expiry is checked again against the trusted RPC's current validated ledger window before returning or submitting.
- Xahau message signing uses Xaman's non-submittable `SignIn` proof with an explicit `force_network`. It returns `signatureKind: "signedTx"`, not a compact signature or independently verified chain-bound authentication. Include domain/network/nonce in authentication messages and verify the proof on the appropriate backend.
- Signing waits are bounded to five minutes unless `timeoutMs` is supplied. While waiting, the adapter reads the existing payload every two seconds to recover missed subscription events; it never creates another payload or resubmits. Timeout/cancellation errors preserve `details.providerRequestId` when known and mark an uncertain outcome. Check that payload before retrying; local cleanup does not cancel a remote transaction.

## Testing

Use `assertWalletAdapter(createXamanAdapter({ ... }))` in adapter tests. For deterministic tests, pass mock `auth`, `sdk`, and `recoveryStorage` objects instead of using live Xaman services.

## Links

- Xaman: https://xaman.app
- XRPL Wallet Kit: https://github.com/XRPDomains/xrpl-wallet-kit
