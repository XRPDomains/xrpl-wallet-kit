# Identity & Avatar

When a wallet is connected, XRPL Wallet Kit automatically resolves the address to a **human-readable name** and **avatar** via [xrpdomains.xyz](https://xrpdomains.xyz). Both appear together in the connect button and account panel — no extra configuration required.

## How it works

After a successful connection, the kit runs an identity lookup in the background:

```
address → identityResolver → { name, avatar?, verified?, source? }
```

If the resolver returns a result, the button replaces the truncated address with the name, and displays the avatar image if one is available. If the resolver returns `null`, the button falls back to showing the truncated address (default behavior).

## What gets displayed

| Resolver returns | Connect button | Account panel |
|---|---|---|
| `{ name, avatar }` | Avatar + name | Avatar + name + address |
| `{ name }` | Wallet icon + name | Wallet icon + name + address |
| `null` (no match) | Wallet icon + address | Wallet icon + address |
| _(identity disabled)_ | Wallet icon + address | Wallet icon + address |

## Disable identity entirely

```ts
import { createWalletKit } from "@xrpl-wallet-kit/client";

const kit = createWalletKit({
  adapters: [/* ... */],
  button: {
    target: "#connect-btn-root",
    showWeb3Name: false,        // don't resolve or display any name
  },
});
```

Or with `WalletButton` directly:

```ts
import { WalletButton } from "@xrpl-wallet-kit/ui";

const button = new WalletButton({
  manager,
  modal,
  target,
  showWeb3Name: false,
});
```

## Disable avatar only

Keep the name display but hide the avatar in the account panel:

```ts
// via createWalletKit
const kit = createWalletKit({
  adapters: [/* ... */],
  ui: {
    accountPanel: { showAvatar: false },
  },
  button: {
    target: "#connect-btn-root",
  },
});
```

## Control fallback when no name is found

By default (`fallbackToAddress: true`), if the resolver returns `null`, the button shows the truncated address. Set to `false` to show only the wallet icon:

```ts
const button = new WalletButton({
  manager,
  modal,
  target,
  showWeb3Name: true,
  fallbackToAddress: false,   // show icon only when no name resolved
});
```

## Custom identity resolver

Replace the default xrpdomains.xyz lookup with your own name registry or profile system. The resolver receives the connected address and the full session object.

```ts
import { WalletButton } from "@xrpl-wallet-kit/ui";
import type { WalletIdentity } from "@xrpl-wallet-kit/ui";

const button = new WalletButton({
  manager,
  modal,
  target,
  identityResolver: async (address, session): Promise<WalletIdentity | null> => {
    const profile = await myApp.getProfile(address);
    if (!profile) return null;

    return {
      name:     profile.displayName,
      avatar:   profile.avatarUrl,      // any https:// URL, IPFS URL, etc.
      verified: profile.isVerified,     // shows a verified badge when true
      source:   "my-registry",          // optional, for your own tracking
    };
  },
});
```

### WalletIdentity shape

```ts
interface WalletIdentity {
  name:      string;    // display name shown in button and panel
  avatar?:   string;    // URL of the avatar image
  verified?: boolean;   // shows a ✓ badge when true
  source?:   string;    // arbitrary string — not displayed, useful for logging
}
```

## React to identity changes

Use `onIdentityChange` to sync the resolved name/avatar to your own app state:

```ts
const button = new WalletButton({
  manager,
  modal,
  target,
  onIdentityChange: (identity, session) => {
    if (identity) {
      console.log(`Resolved: ${identity.name}`, identity.avatar);
    } else {
      console.log("No identity found for", session?.account.address);
    }
  },
});
```

## `createWalletKit` shorthand

When using the all-in-one package, pass identity options under `button`:

```ts
import { createWalletKit } from "@xrpl-wallet-kit/client";

const kit = createWalletKit({
  adapters: [/* ... */],
  button: {
    target: "#connect-btn-root",
    showWeb3Name: true,
    fallbackToAddress: true,
    identityResolver: async (address) => {
      const name = await myRegistry.lookup(address);
      return name ? { name } : null;
    },
    onIdentityChange: (identity) => {
      myStore.setUserName(identity?.name ?? null);
    },
  },
  ui: {
    accountPanel: { showAvatar: true },
  },
});
```

## See also

- [Connect Button](/docs/configuration/connect-button) — full `WalletButton` options reference
- [Theming](/docs/configuration/theming) — customize avatar border color via `accent` token
- [WalletModal & WalletButton API](/docs/api/wallet-modal)
