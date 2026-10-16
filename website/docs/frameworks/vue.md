# Vue 3

`@xrpl-wallet-kit/vue` provides app-scoped state, composables and a wallet button.
These bindings are available since 0.1.23.

## Setup

```ts
import { createApp } from 'vue'
import { createWalletClient } from '@xrpl-wallet-kit/client'
import { createWalletKitPlugin } from '@xrpl-wallet-kit/vue'
import App from './App.vue'

const manager = createWalletClient({
  network: 'mainnet',
  autoReconnect: true,
  wallets: ['gemwallet', 'crossmark', 'ghostsig'],
})
createApp(App).use(createWalletKitPlugin({ manager, autoReconnect: true })).mount('#app')
```

## Components

```vue
<script setup lang="ts">
import { WalletButton, useWalletKit, useWalletModal } from '@xrpl-wallet-kit/vue'
const { account, status, signTransaction } = useWalletKit()
const { openAndWait } = useWalletModal()
</script>
<template>
  <WalletButton :options="{ showBalance: false }" />
  <span v-if="account">{{ account.address }}</span>
</template>
```

`account`, `session`, `status`, `wallets`, `availability` and `modal` are readonly refs.
`connect`, `disconnect`, `signMessage`, `signTransaction` and `signAndSubmit` preserve
manager result and error types. `openAndWait()` resolves a session or rejects when
the user closes the picker. `refreshAvailability()` refreshes wallet detection.

## Lifecycle

DOM and optional restoration start on mount, not during SSR or import. Each app
gets its own state and subscriptions; use a separate manager per app or SSR request.
Unmount destroys UI and listeners without disconnecting the caller-owned manager.
Call `manager.destroy()` when the application no longer needs it.

Configure themes and CSP through the plugin's `ui` option. Button options go
through `WalletButton.options`. See [Nuxt](/docs/frameworks/nuxt) for SSR setup.
