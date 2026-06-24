# Vue 3

XRPL Wallet Kit is framework-agnostic — the core has no React dependency, so it integrates cleanly into any Vue 3 application. This guide shows the recommended composable pattern using `@xrpl-wallet-kit/client`.

## Installation

::: code-group
```sh [npm]
npm install @xrpl-wallet-kit/client
```
```sh [yarn]
yarn add @xrpl-wallet-kit/client
```
```sh [pnpm]
pnpm add @xrpl-wallet-kit/client
```
:::

For fine-grained installs, use individual packages instead:

```sh
npm install @xrpl-wallet-kit/core @xrpl-wallet-kit/ui @xrpl-wallet-kit/adapter-xaman
```

## Quick Start

```vue
<!-- App.vue -->
<script setup lang="ts">
import { onMounted } from 'vue'
import { createWalletKit } from '@xrpl-wallet-kit/client'

const { manager } = createWalletKit({
  wallets: 'all',
  walletConnectProjectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID,
  xamanClientId: import.meta.env.VITE_XAMAN_CLIENT_ID,
  connectButton: '#connect-btn',
})

onMounted(() => manager.recoverSession())
</script>

<template>
  <button id="connect-btn" />
</template>
```

`createWalletKit` mounts a `WalletButton` onto the `#connect-btn` element automatically. The modal opens on click, and sessions restore on page reload.

## `useWalletKit()` Composable

For reactive wallet state across your Vue app, create a shared composable:

```ts
// composables/useWalletKit.ts
import { ref, onMounted, onUnmounted } from 'vue'
import { createWalletKit } from '@xrpl-wallet-kit/client'
import type { WalletSession, WalletAccount } from '@xrpl-wallet-kit/core'

// Create kit once, outside the composable, so state is shared app-wide
const { manager, modal } = createWalletKit({
  wallets: 'all',
  walletConnectProjectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID,
  xamanClientId: import.meta.env.VITE_XAMAN_CLIENT_ID,
})

const session = ref<WalletSession | null>(null)
const account = ref<WalletAccount | null>(null)
const status = ref<'disconnected' | 'connecting' | 'connected'>('disconnected')

// Sync state from manager events
manager.on('connected', (s) => {
  session.value = s
  account.value = s.account
  status.value = 'connected'
})
manager.on('disconnected', () => {
  session.value = null
  account.value = null
  status.value = 'disconnected'
})

export function useWalletKit() {
  onMounted(() => manager.recoverSession())

  return {
    manager,
    modal,
    session,
    account,
    status,
    openModal: () => modal.open(),
    closeModal: () => modal.close(),
    disconnect: () => manager.disconnect(),
  }
}
```

Use it in any component:

```vue
<!-- components/WalletStatus.vue -->
<script setup lang="ts">
import { useWalletKit } from '@/composables/useWalletKit'

const { account, status, openModal, disconnect } = useWalletKit()
</script>

<template>
  <div>
    <button v-if="status === 'disconnected'" @click="openModal">
      Connect Wallet
    </button>
    <span v-else-if="status === 'connecting'">Connecting…</span>
    <div v-else>
      <span>{{ account?.address }}</span>
      <button @click="disconnect">Disconnect</button>
    </div>
  </div>
</template>
```

## Provide / Inject (App-wide)

For apps where you want to pass the kit through the component tree via Vue's provide/inject:

```ts
// main.ts
import { createApp } from 'vue'
import { createWalletKit } from '@xrpl-wallet-kit/client'
import App from './App.vue'

const kit = createWalletKit({
  wallets: 'all',
  walletConnectProjectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID,
})

const app = createApp(App)
app.provide('walletKit', kit)
app.mount('#app')
```

```vue
<!-- Any descendant component -->
<script setup lang="ts">
import { inject } from 'vue'
import type { WalletKitInstance } from '@xrpl-wallet-kit/client'

const kit = inject<WalletKitInstance>('walletKit')!
</script>
```

## Mounting the Connect Button

`WalletButton` from `@xrpl-wallet-kit/ui` mounts onto any DOM element. In Vue, use a template ref:

```vue
<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { WalletManager } from '@xrpl-wallet-kit/core'
import { WalletModal, WalletButton } from '@xrpl-wallet-kit/ui'
import { createGemWalletAdapter } from '@xrpl-wallet-kit/adapter-gemwallet'

const btnRef = ref<HTMLElement | null>(null)
let button: WalletButton | null = null

const manager = new WalletManager({
  adapters: [createGemWalletAdapter()],
})
const modal = new WalletModal({ manager })

onMounted(async () => {
  button = new WalletButton({ manager, modal, target: btnRef.value! })
  await manager.recoverSession()
})

onUnmounted(() => {
  button?.destroy()
  modal.destroy()
  manager.destroy()
})
</script>

<template>
  <div ref="btnRef" />
</template>
```

## Listening to Events

```ts
import { useWalletKit } from '@/composables/useWalletKit'

const { manager } = useWalletKit()

manager.on('connected', ({ account }) => {
  console.log('Connected:', account.address)
})

manager.on('disconnected', () => {
  console.log('Disconnected')
})

manager.on('error', ({ error }) => {
  console.error('Wallet error:', error.message)
})
```

See [Events & Hooks](/docs/advanced/events-hooks) for the full event reference.

## Signing a Transaction

```ts
const { manager } = useWalletKit()

const result = await manager.signAndSubmit({
  txJson: {
    TransactionType: 'Payment',
    Account: manager.getAccount()!.address,
    Destination: 'rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe',
    Amount: '1000000', // 1 XRP in drops
    Fee: '12',
    Sequence: 1,
  },
})

console.log('Transaction hash:', result.hash)
```

## Transaction Toasts

Add toast notifications for every transaction result:

```ts
import { WalletToast } from '@xrpl-wallet-kit/ui'

const { manager } = useWalletKit()
const toast = new WalletToast({ manager })
toast.mount()
```

Toasts appear automatically on submit, confirm, and failure — no extra wiring.

## Theming

```ts
import { createWalletKit } from '@xrpl-wallet-kit/client'

createWalletKit({
  wallets: 'all',
  theme: {
    accent: '#0284c7',
    radius: '12px',
  },
  themeMode: 'dark',
})
```

See [Theming](/docs/configuration/theming) for the full token reference.

## TypeScript

All types are re-exported from `@xrpl-wallet-kit/core`:

```ts
import type {
  WalletSession,
  WalletAccount,
  WalletAdapter,
  WalletUiTheme,
} from '@xrpl-wallet-kit/core'
```

## Next Steps

- [Nuxt 3](/docs/frameworks/nuxt) — SSR-safe plugin setup
- [Theming](/docs/configuration/theming) — customize colors and fonts
- [Adapters](/docs/adapters/overview) — configure individual wallets
- [Events & Hooks](/docs/advanced/events-hooks) — full event reference
