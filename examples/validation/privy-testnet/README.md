# Privy browser validation on XRPL Testnet

This standalone vanilla Vite demo validates the browser path for [issue #52](https://github.com/XRPDomains/xrpl-wallet-kit/issues/52). It uses the pinned XRPL Commons release candidate and does not change Wallet Kit packages or defaults.

## Run locally

1. In a dedicated Privy test app, enable Google OAuth and restrict the allowed origin to `http://localhost:5182` for local testing. Allow `http://localhost:5182/wallet/privy` as the callback if required by the app configuration.
2. Copy `.env.example` to `.env.local` inside this directory. Set the public app ID and, if applicable, the public client ID. This browser demo has no app backend or app secret.
3. Run `npm ci` and `npm run dev` from this directory, then open `http://localhost:5182`. Keep the hostname consistent throughout OAuth.

## Live acceptance

1. Use **Sign in with socials** and complete Google authentication. The account line should show a native XRPL Testnet address only once the upstream adapter can use its signer. Verify the Privy chooser does not offer external wallets.
2. Reload. Verify the same address returns and remains usable.
3. Fund your test wallet with the faucet if needed. Enter a different, funded Testnet address you control and the amount in XRP. The default is 0.001 XRP.
4. Choose **Sign only** and approve the review. Verify a signed blob was returned and that its hash was not submitted. Choose **Sign and submit on Testnet** and separately approve the review. Verify `tesSUCCESS` and look up the returned hash with the Testnet `tx` RPC. It must show `validated: true`, the expected source and destination, and the entered amount in drops (1 XRP = 1,000,000 drops).
5. Log out and verify transaction controls are disabled. Reload and verify the wallet does not restore after logout. Sign in again immediately after logout and verify the original address is reused.
6. Separately cancel or abandon a login and try again. Verify expired or late callbacks do not connect the old session or replace a newer wallet.

Record which cases were exercised, the SDK versions, and the validated Testnet hash in #52. Keep tokens, app secrets, and private keys out of the report. The upstream browser SDK handles authentication and user-authorized signing, and its adapter submits through XRPL RPC. The live run determines whether this path works with our Privy configuration.

References: [XRPL Commons PR #217](https://github.com/XRPL-Commons/xrpl-connect/pull/217) and [Privy's XRPL API guide](https://docs.privy.io/wallets/using-wallets/xrpl/overview).
