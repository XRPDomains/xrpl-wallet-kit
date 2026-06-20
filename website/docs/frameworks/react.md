# React

`@xrpl-wallet-kit/react` provides React bindings for XRPL Wallet Kit — a `WalletKitProvider`, a set of hooks, and a drop-in `WalletButton` component.

## Installation

```bash
npm install @xrpl-wallet-kit/react @xrpl-wallet-kit/client
```

## Quick Start

```tsx
import { WalletManager } from "@xrpl-wallet-kit/core";
import { createDefaultAdapters } from "@xrpl-wallet-kit/client";
import { WalletKitProvider, WalletButton } from "@xrpl-wallet-kit/react";

const manager = new WalletManager({
  adapters: createDefaultAdapters({
    walletConnectProjectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID,
  }),
});

// Restore previous session on load
await manager.recoverSession();

function App() {
  return (
    <WalletKitProvider manager={manager}>
      <WalletButton />
    </WalletKitProvider>
  );
}
```

`WalletButton` renders a fully self-contained connect / account panel button. No extra configuration needed.

## `WalletKitProvider`

Wrap your application (or the subtree that needs wallet access) with `WalletKitProvider`:

```tsx
import { WalletKitProvider } from "@xrpl-wallet-kit/react";

function App() {
  return (
    <WalletKitProvider
      manager={manager}
      ui={{
        mode: "dark",
        modal: { title: "Connect to MyApp" },
      }}
    >
      <MyApp />
    </WalletKitProvider>
  );
}
```

**Props:**

```ts
interface WalletKitProviderProps {
  manager: WalletManager;     // required
  ui?: WalletUiConfig;        // optional — theme, locale, modal config
  children: React.ReactNode;
}
```

The provider creates and manages the `WalletModal` internally. You do not need to instantiate it yourself.

## Hooks

### `useWalletKit()`

The main hook. Returns the full context value:

```tsx
function MyComponent() {
  const { account, status, openModal, disconnect } = useWalletKit();

  if (status === "disconnected") {
    return <button onClick={openModal}>Connect Wallet</button>;
  }

  if (status === "connecting") {
    return <span>Connecting…</span>;
  }

  return (
    <div>
      <span>{account?.address}</span>
      <button onClick={disconnect}>Disconnect</button>
    </div>
  );
}
```

**Returns:**

```ts
interface WalletKitContextValue {
  manager: WalletManager;
  session: WalletSession | null;
  account: WalletAccount | null;
  status: "disconnected" | "connecting" | "connected";
  wallets: WalletMetadata[];       // all registered adapters
  connect: (adapterId: string) => Promise<WalletSession>;
  disconnect: () => Promise<void>;
  openModal: () => void;
  closeModal: () => void;
  modal: WalletModal;
}
```

### `useWalletSession()`

Returns the current `WalletSession` or `null`:

```tsx
function SessionDisplay() {
  const session = useWalletSession();
  return session
    ? <span>Connected via {session.adapterId}</span>
    : <span>Not connected</span>;
}
```

### `useWalletAccount()`

Returns the current `WalletAccount` or `null`:

```tsx
function AddressDisplay() {
  const account = useWalletAccount();
  return account
    ? <span>{account.address}</span>
    : null;
}
```

### `useWalletStatus()`

Returns `"disconnected" | "connecting" | "connected"` without subscribing to account details — useful for lightweight status indicators:

```tsx
function StatusDot() {
  const status = useWalletStatus();
  return <span className={`dot dot--${status}`} />;
}
```

### `useWalletCapabilities()`

Returns the active adapter's capabilities, or `undefined` if not connected:

```tsx
function SignButton() {
  const capabilities = useWalletCapabilities();

  if (!capabilities?.signMessage) {
    return <span>This wallet does not support message signing</span>;
  }

  return <button onClick={sign}>Sign Message</button>;
}
```

## `WalletButton` Component

Drop-in connect button — renders disconnected state, connecting state, connected account panel, and disconnect all automatically:

```tsx
import { WalletButton } from "@xrpl-wallet-kit/react";

// Default
<WalletButton />

// With options
<WalletButton label="Connect XRPL Wallet" size="lg" variant="pill" />
```

**Props** (all optional):

```ts
type ReactWalletButtonProps = {
  label?: string;
  size?: "sm" | "md" | "lg";
  variant?: "default" | "pill" | "minimal" | "outline";
  showAdapterIcon?: boolean;
  showChevron?: boolean;
};
```

`WalletButton` must be used inside a `WalletKitProvider`.

## Custom Connect Button

If you want full control over the button UI, use `openModal` from `useWalletKit()`:

```tsx
function CustomConnectButton() {
  const { openModal, account } = useWalletKit();

  if (account) {
    return <span>{account.address.slice(0, 8)}…</span>;
  }

  return (
    <button
      onClick={openModal}
      className="my-custom-button"
    >
      Connect Wallet
    </button>
  );
}
```

## SSR / Server Components

`WalletKitProvider` uses `useLayoutEffect` in the browser and `useEffect` on the server (no hydration mismatch). The modal is created client-side only.

For Next.js App Router, use the dedicated `@xrpl-wallet-kit/next` package — it re-exports everything with the required `"use client"` directive.

## TypeScript

All types are exported:

```ts
import type {
  WalletKitContextValue,
  WalletKitProviderProps,
  WalletKitStatus,
  ReactWalletButtonProps,
} from "@xrpl-wallet-kit/react";
```
