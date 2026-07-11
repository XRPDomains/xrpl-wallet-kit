# App Metadata

`metadata` describes the dApp that is asking the user to connect or sign. Wallets use it to show a recognizable app name, URL, and icon.

```ts
import { createWalletKit } from "@xrpl-wallet-kit/client";

const kit = createWalletKit({
  metadata: {
    name: "XRP Domains",
    description: "XRPL domains and wallet tools",
    url: "https://xrpdomains.xyz",
    icons: ["https://xrpdomains.xyz/icon.png"],
  },
  walletConnectProjectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID,
  connectButton: "#connect-wallet",
});
```

## Fields

| Field | Type | Notes |
|---|---|---|
| `name` | `string` | Human-readable dApp name. Required when `metadata` is provided. |
| `description` | `string` | Short description shown by some wallets. |
| `url` | `string` | Canonical dApp origin or website URL. |
| `icons` | `string[]` | Public HTTPS icon URLs. The first icon is treated as the primary app icon. |

## Legacy Aliases

Existing integrations can still pass `appName`, `appDescription`, `appUrl`, and `appIcons`.

```ts
createWalletKit({
  appName: "My XRPL App",
  appDescription: "Wallet connection for My XRPL App",
  appUrl: window.location.origin,
  appIcons: [`${window.location.origin}/icon.png`],
});
```

For new integrations, prefer `metadata`. It keeps the app identity in one object and leaves room for future wallet/auth UX without adding more top-level options.

