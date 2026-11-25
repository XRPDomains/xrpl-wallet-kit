# Privy embedded wallet

Privy is an opt-in adapter for native XRPL wallets on Mainnet and Testnet. It uses the dApp's Privy app and the network selected in Wallet Kit.

## Installation

```sh
npm install @xrpl-wallet-kit/adapter-privy @xrpl-wallet-kit/client xrpl
```

Register the adapter in the browser. Allow the dApp origin and callback URL in Privy Dashboard, enable at least one supported login method, and serve the same app on the callback route. Use a public App ID and, when applicable, a public Client ID.

```ts
import { createWalletKit } from "@xrpl-wallet-kit/client";
import { createPrivyAdapter } from "@xrpl-wallet-kit/adapter-privy";

const kit = createWalletKit({
  network: "testnet",
  autoReconnect: true,
  adapters: [
    createPrivyAdapter({
      appId: import.meta.env.VITE_PRIVY_APP_ID,
      clientId: import.meta.env.VITE_PRIVY_CLIENT_ID || undefined,
      redirectUri: new URL("/wallet/privy", window.location.origin).href
    })
  ]
});

kit.button.mount("#connect-wallet");
```

Passing `adapters` replaces the default list. Include any other adapters your app needs. The default browser IIFE does not bundle Privy.

On React, register the same adapter with the manager passed to `WalletKitProvider` and render `WalletButton`. Initialize the manager on the client on both routes. Keep the same network and manager storage across the OAuth redirect so the callback completes on the network chosen before login.

## Login and signing

Email uses a one-time code. Google and X use OAuth redirects and appear when enabled in the dashboard. When Email is the only available method, the wallet picker opens the email form directly. Dashboard configurations that mandate CAPTCHA are outside the current adapter's supported flow.

Kit reports a connected wallet after Privy supplies the XRPL account and signing session. On refresh it restores the stored wallet and user identity. Explicit disconnect logs out of Privy. Closing a pending login or transaction review cancels that step.

The Kit modal asks for approval before signing. Call `manager.signTransaction({ txJson })` for a signed blob, or `manager.signAndSubmit({ txJson })` for submission. Check `result.status` and the ledger before treating a payment as successful. If a submitted transaction has an uncertain outcome, verify its state before retrying. Message signing, Devnet and Xahau are outside this adapter's scope.

Headless clients must subscribe to `adapter.onInteraction()` and show the active prompt, including the full review before calling its submit action. Treat authentication fields as private and pass them directly to the active prompt.

The adapter currently uses the pinned XRPL Commons Privy integration. The browser owns the authenticated signing session, and the app requires no Privy app secret in the frontend or a dedicated application backend for this flow.

## Local testing

Set `VITE_PRIVY_APP_ID` and optionally `VITE_PRIVY_CLIENT_ID` in the repository root `.env.local` and run `npm run dev:react`. Allow that exact localhost origin and its `/wallet/privy` callback in Privy Dashboard. Use the existing network picker. Fund the Testnet wallet before exercising Payment. Mainnet submission spends real XRP.

See the [Testnet validation checklist](../../../examples/validation/privy-testnet/README.md) for refresh, sign-only, validated submission, cancellation and logout cases.
