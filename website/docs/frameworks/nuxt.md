# Nuxt

Use the Vue plugin once per Nuxt application, with matching package versions.

```sh
npm install @xrpl-wallet-kit/vue @xrpl-wallet-kit/core @xrpl-wallet-kit/adapter-ghostsig xrpl@^4
```

## Provider

A universal provider lets server-rendered components inject safe wallet state.
Do not create a manager at module scope or share it between server requests.

```ts
// plugins/wallet-kit.ts
import { WalletManager } from '@xrpl-wallet-kit/core'
import { createWalletKitPlugin } from '@xrpl-wallet-kit/vue'

export default defineNuxtPlugin({
  name: 'wallet-kit',
  setup(nuxtApp) {
    const manager = new WalletManager({ network: 'mainnet', adapters: [], autoReconnect: true })
    nuxtApp.vueApp.use(createWalletKitPlugin({ manager, autoReconnect: true }))
    return { provide: { walletManager: manager } }
  },
})
```

## Client Adapters

Register browser adapters after the provider:

```ts
// plugins/wallet-adapters.client.ts
import { createGhostsigAdapter } from '@xrpl-wallet-kit/adapter-ghostsig'
export default defineNuxtPlugin({
  name: 'wallet-adapters',
  dependsOn: ['wallet-kit'],
  setup(nuxtApp) {
    nuxtApp.$walletManager.register(createGhostsigAdapter())
  },
})
```

Expose public wallet application IDs through `useRuntimeConfig().public`, never
seeds or secrets. Add a `#app` module augmentation for `$walletManager: WalletManager`
to your Nuxt project when using TypeScript.

## Components

```vue
<script setup lang="ts">
import { WalletButton, useWalletKit } from '@xrpl-wallet-kit/vue'
const { account, status, signAndSubmit } = useWalletKit()
</script>
<template>
  <WalletButton />
  <span v-if="account">{{ account.address }}</span>
</template>
```

The button renders a neutral span during SSR and mounts its UI after hydration.
Wallet state starts disconnected on the server. Composables do not add a separate
set of listeners for each component. No wallet prompt runs during SSR, and
auto-reconnection is explicit opt-in.

Session restoration does not restore checkout state or resubmit a payment.
Keep order reconciliation in your application.

## Xahau

For a core-based provider, register the Xahau networks/protocol when constructing
the manager and declare the supported chains on Xaman, GemWallet, Xyra or Ledger.
Keep the manager app/request-scoped and register browser adapters in the client
plugin. The full client can configure Xahau automatically instead; see
[Xahau setup](/docs/configuration/xahau#core-selective-integration) for the two paths.
Do not only change the network ID on the XRPL-only example above.

GhostSig and Joey Wallet's native extension are XRPL-only. Xyra supports XRPL
and Xahau. Check [adapter capabilities](/docs/adapters/overview) and use
`manager.signIn()` only for wallets with native sign-in support.
