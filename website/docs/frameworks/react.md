# React

`@xrpl-wallet-kit/react` provides React bindings for XRPL Wallet Kit — a `WalletKitProvider`, a set of hooks, and a drop-in `WalletButton` component.

## Installation

```bash
npm install @xrpl-wallet-kit/react @xrpl-wallet-kit/core \
  @xrpl-wallet-kit/adapter-gemwallet @xrpl-wallet-kit/adapter-crossmark
```

## Choosing a setup

| You want | Use | Bundle profile |
| --- | --- | --- |
| Default wallets with the least setup | `client` + `react` | Largest |
| Selected wallets with the kit modal | `client/selective` + `react` + named adapters | Medium |
| Your own wallet interface | `core` + named adapters | Smallest |

The all-in-one client includes first-party adapter factories. If your app supports only a few wallets, import those adapter packages directly as shown below.

## Quick Start

```tsx
import { WalletManager } from "@xrpl-wallet-kit/core";
import { createGemWalletAdapter } from "@xrpl-wallet-kit/adapter-gemwallet";
import { createCrossmarkAdapter } from "@xrpl-wallet-kit/adapter-crossmark";
import { WalletKitProvider, WalletButton } from "@xrpl-wallet-kit/react";

const manager = new WalletManager({
  autoReconnect: true,
  adapters: [createGemWalletAdapter(), createCrossmarkAdapter()],
});

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
  availability: Record<string, boolean | "unknown">;
  refreshAvailability: () => Promise<void>;
  connect: (adapterId: string) => Promise<WalletSession>;
  disconnect: () => Promise<void>;
  openModal: () => void;
  closeModal: () => void;
  modal: WalletModal | null;       // null during SSR and before client mount
}
```

For a custom selector, treat `"unknown"` as a pending check rather than as unavailable:

```tsx
function WalletList() {
  const { wallets, availability, connect } = useWalletKit();

  return wallets.map((wallet) => (
    <button
      key={wallet.id}
      disabled={availability[wallet.id] !== true}
      onClick={() => connect(wallet.id)}
    >
      {wallet.name}
    </button>
  ));
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

// Brand icon while disconnected
<WalletButton
  label="Connect"
  icon={{ type: "image", src: "/brand-wallet.svg", alt: "MyApp wallet" }}
/>
```

**Props** (all optional):

```ts
type ReactWalletButtonProps = {
  label?: string;
  size?: "sm" | "md" | "lg";
  variant?: "default" | "pill" | "minimal" | "outline";
  icon?: false
    | { type: "default" }
    | { type: "image"; src: string; alt?: string }
    | { type: "html"; html: string; ariaLabel?: string };
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

`WalletKitProvider` keeps its children and a deterministic context value in server-rendered HTML. The modal is created client-side only, so `modal` is initially `null`; `openModal()` and `closeModal()` are safe no-ops until it mounts.

The React package publishes a `"use client"` boundary and works directly in Next.js App Router Client Components. The dedicated `@xrpl-wallet-kit/next` package remains available as a thin discoverability alias. See the [Next.js guide](/docs/frameworks/next) for provider placement.

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
