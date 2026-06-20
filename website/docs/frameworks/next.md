# Next.js

`@xrpl-wallet-kit/next` is a thin wrapper around `@xrpl-wallet-kit/react` that adds the `"use client"` directive required for Next.js App Router. The API is identical to the React package.

## Installation

```bash
npm install @xrpl-wallet-kit/next @xrpl-wallet-kit/client
```

## App Router Setup

### 1. Create the manager (server-safe singleton)

```ts
// lib/wallet-manager.ts
import { WalletManager } from "@xrpl-wallet-kit/core";
import { createDefaultAdapters } from "@xrpl-wallet-kit/client";

// Module-level singleton — safe in Next.js
export const manager = new WalletManager({
  adapters: createDefaultAdapters({
    walletConnectProjectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID,
    xamanClientId: process.env.NEXT_PUBLIC_XAMAN_CLIENT_ID,
  }),
});
```

### 2. Create a Client Provider component

`WalletKitProvider` uses browser APIs — it must be in a Client Component:

```tsx
// components/WalletProvider.tsx
"use client";

import { WalletKitProvider } from "@xrpl-wallet-kit/next";
import { manager } from "@/lib/wallet-manager";

export function WalletProvider({ children }: { children: React.ReactNode }) {
  return (
    <WalletKitProvider manager={manager} ui={{ mode: "dark" }}>
      {children}
    </WalletKitProvider>
  );
}
```

### 3. Add to Root Layout

```tsx
// app/layout.tsx
import { WalletProvider } from "@/components/WalletProvider";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <WalletProvider>
          {children}
        </WalletProvider>
      </body>
    </html>
  );
}
```

### 4. Use hooks in Client Components

```tsx
// components/ConnectButton.tsx
"use client";

import { useWalletKit } from "@xrpl-wallet-kit/next";

export function ConnectButton() {
  const { account, openModal, disconnect } = useWalletKit();

  if (account) {
    return (
      <button onClick={disconnect}>
        {account.address.slice(0, 8)}…
      </button>
    );
  }

  return <button onClick={openModal}>Connect Wallet</button>;
}
```

### 5. Session restore

Call `recoverSession()` once on the client after mount:

```tsx
// components/WalletProvider.tsx
"use client";

import { useEffect } from "react";
import { WalletKitProvider } from "@xrpl-wallet-kit/next";
import { manager } from "@/lib/wallet-manager";

export function WalletProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    manager.recoverSession();
  }, []);

  return (
    <WalletKitProvider manager={manager}>
      {children}
    </WalletKitProvider>
  );
}
```

## Environment Variables

Add to `.env.local` (Next.js requires the `NEXT_PUBLIC_` prefix for client-side env vars):

```bash
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id
NEXT_PUBLIC_XAMAN_CLIENT_ID=your_xaman_client_id
```

## Drop-in WalletButton

```tsx
// components/ConnectButton.tsx
"use client";

import { WalletButton } from "@xrpl-wallet-kit/next";

export function ConnectButton() {
  return <WalletButton />;
}
```

Use in a Server Component or layout:

```tsx
// app/layout.tsx
import { ConnectButton } from "@/components/ConnectButton";

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <header>
          <ConnectButton />
        </header>
        {children}
      </body>
    </html>
  );
}
```

## Pages Router

If you are on the older Pages Router, import from `@xrpl-wallet-kit/react` directly instead — the `"use client"` directive is App Router–specific and not needed:

```tsx
// pages/_app.tsx
import { WalletKitProvider } from "@xrpl-wallet-kit/react";
import { manager } from "@/lib/wallet-manager";

export default function App({ Component, pageProps }) {
  return (
    <WalletKitProvider manager={manager}>
      <Component {...pageProps} />
    </WalletKitProvider>
  );
}
```

## API Reference

`@xrpl-wallet-kit/next` re-exports everything from `@xrpl-wallet-kit/react`. See the [React guide](/docs/frameworks/react) for the full API reference.
