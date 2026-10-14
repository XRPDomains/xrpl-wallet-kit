# @xrpl-wallet-kit/vue

Vue 3 bindings with app-scoped state, a wallet button and awaitable modal.
This package is implemented locally; npm publication is a separate release step.

```ts
import { createWalletKitPlugin } from '@xrpl-wallet-kit/vue';
app.use(createWalletKitPlugin({ manager, autoReconnect: true }));
```

```vue
<script setup lang="ts">
import { WalletButton, useWalletKit } from '@xrpl-wallet-kit/vue';
const { account, status, signTransaction } = useWalletKit();
</script>
<template><WalletButton /><span>{{ account?.address }}</span></template>
```

State is readonly and scoped to each application. DOM, availability checks and
optional restoration start on mount, not on import or during SSR. App unmount
detaches listeners and destroys the modal without disconnecting the caller-owned
manager. `useWalletModal().openAndWait()` preserves core errors and result types.
Do not reuse a manager between server requests. See the website Vue/Nuxt guides.
