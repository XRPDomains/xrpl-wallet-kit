# Nuxt 3

XRPL Wallet Kit works with Nuxt 3 via a client-side plugin. Because wallet adapters interact with browser APIs (extensions, WalletConnect, localStorage), all setup must run on the client — Nuxt's `.client.ts` plugin convention handles this automatically.

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

## Plugin Setup

Create `plugins/wallet-kit.client.ts`. The `.client.ts` suffix tells Nuxt to load this plugin in the browser only — no SSR crash, no hydration mismatch.

```ts
// plugins/wallet-kit.client.ts
import { createWalletKit } from '@xrpl-wallet-kit/client'

export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig()

  const kit = createWalletKit({
    wallets: 'all',
    walletConnectProjectId: config.public.walletConnectProjectId,
    xamanClientId: config.public.xamanClientId,
  })

  // Restore session from localStorage on every page load
  kit.manager.recoverSession()

  return {
    provide: {
      walletKit: kit,
    },
  }
})
```

### Runtime Config

Add your public keys to `nuxt.config.ts` — they are injected at build time and safe to expose client-side:

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  runtimeConfig: {
    public: {
      walletConnectProjectId: process.env.NUXT_PUBLIC_WALLETCONNECT_PROJECT_ID,
      xamanClientId: process.env.NUXT_PUBLIC_XAMAN_CLIENT_ID,
    },
  },
})
```

```sh
# .env
NUXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id
NUXT_PUBLIC_XAMAN_CLIENT_ID=your_xaman_client_id
```

## `useWallet()` Composable

Build a reactive composable on top of the plugin. Create `composables/useWallet.ts`:

```ts
// composables/useWallet.ts
import type { WalletSession, WalletAccount } from '@xrpl-wallet-kit/core'

export function useWallet() {
  const nuxtApp = useNuxtApp()

  // useState gives SSR-safe reactive state (shared across components)
  const session = useState<WalletSession | null>('wallet:session', () => null)
  const account = useState<WalletAccount | null>('wallet:account', () => null)
  const status = useState<'disconnected' | 'connecting' | 'connected'>(
    'wallet:status',
    () => 'disconnected',
  )

  // Wire up events once — idempotent thanks to the 'connected' check
  if (import.meta.client) {
    const { manager, modal } = nuxtApp.$walletKit

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

  // Server-side: return safe defaults (state refs are still reactive)
  return {
    manager: null,
    modal: null,
    session,
    account,
    status,
    openModal: () => {},
    closeModal: () => {},
    disconnect: async () => {},
  }
}
```

## Using in a Component

```vue
<!-- components/WalletButton.vue -->
<script setup lang="ts">
const { account, status, openModal, disconnect } = useWallet()
</script>

<template>
  <div>
    <button v-if="status === 'disconnected'" @click="openModal">
      Connect Wallet
    </button>
    <span v-else-if="status === 'connecting'">Connecting…</span>
    <div v-else class="wallet-connected">
      <span>{{ account?.address?.slice(0, 8) }}…</span>
      <button @click="disconnect">Disconnect</button>
    </div>
  </div>
</template>
```

## Mounting the Connect Button

For the built-in `WalletButton` UI, mount it with `ClientOnly` and a template ref:

```vue
<!-- components/AppHeader.vue -->
<script setup lang="ts">
const btnRef = ref<HTMLElement | null>(null)

onMounted(() => {
  const { $walletKit } = useNuxtApp()
  if (btnRef.value) {
    $walletKit.button?.mount(btnRef.value)
  }
})
</script>

<template>
  <header>
    <ClientOnly>
      <div ref="btnRef" />
    </ClientOnly>
  </header>
</template>
```

::: tip
Wrap wallet UI in `<ClientOnly>` to prevent SSR hydration mismatches. The slot content renders only in the browser.
:::

## Pages with Wallet-Gated Content

Use the composable in a page to guard wallet-only sections:

```vue
<!-- pages/dashboard.vue -->
<script setup lang="ts">
const { account, status, openModal } = useWallet()
</script>

<template>
  <main>
    <div v-if="status === 'connected'">
      <h1>Welcome, {{ account?.address }}</h1>
      <!-- wallet-gated content -->
    </div>
    <div v-else>
      <p>Connect your XRPL wallet to continue.</p>
      <button @click="openModal">Connect Wallet</button>
    </div>
  </main>
</template>
```

## Signing a Transaction

```ts
// In a component or composable
const { manager } = useWallet()

async function sendPayment() {
  if (!manager) return

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
}
```

## Transaction Toasts

```ts
// plugins/wallet-kit.client.ts (add to the existing plugin)
import { WalletToast } from '@xrpl-wallet-kit/ui'

export default defineNuxtPlugin(() => {
  const kit = createWalletKit({ wallets: 'all', /* ... */ })

  // Mount toast notifications
  const toast = new WalletToast({ manager: kit.manager })
  toast.mount()

  kit.manager.recoverSession()

  return { provide: { walletKit: kit } }
})
```

## Theming

Pass `theme` and `themeMode` to `createWalletKit`:

```ts
const kit = createWalletKit({
  wallets: 'all',
  theme: {
    accent: '#0284c7',
    radius: '14px',
    fontFamily: 'Inter, sans-serif',
  },
  themeMode: 'dark', // or 'light' | 'auto'
})
```

See [Theming](/docs/configuration/theming) for the full token reference.

## SSR Notes

| Concern | Solution |
|---|---|
| Wallet adapters crash on server | Use `.client.ts` plugin — never runs in SSR |
| Hydration mismatch on connected state | `useState()` with SSR-safe defaults (`null`, `'disconnected'`) |
| `window` / `document` access | Guard with `if (import.meta.client)` or `onMounted` |
| `WalletButton` mounts to DOM | Wrap in `<ClientOnly>` or mount inside `onMounted` |

## TypeScript

The plugin provides typed access via module augmentation. Add to `nuxt.d.ts`:

```ts
// nuxt.d.ts
import type { WalletKitInstance } from '@xrpl-wallet-kit/client'

declare module '#app' {
  interface NuxtApp {
    $walletKit: WalletKitInstance
  }
}

declare module 'vue' {
  interface ComponentCustomProperties {
    $walletKit: WalletKitInstance
  }
}

export {}
```

## Next Steps

- [Vue 3](/docs/frameworks/vue) — Vue 3 composable pattern (without Nuxt)
- [Theming](/docs/configuration/theming) — customize colors and fonts
- [Adapters](/docs/adapters/overview) — configure individual wallets
- [Events & Hooks](/docs/advanced/events-hooks) — full event reference
