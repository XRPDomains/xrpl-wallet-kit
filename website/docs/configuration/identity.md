# Identity & Avatar

The default resolver displays a name in the connect button and account panel.
XRPL Mainnet uses XRPName with an optional avatar. Xahau Testnet uses the
published `@xahauname/sdk` to read the wallet's verified Primary name, such as
`alice.xah`; no extra identity configuration is needed. Xahau avatar/profile
reads are not enabled. Other networks fall back to the wallet address.

## XahauName Primary

The read-only SDK call `client.read.getName({ address })` checks Primary,
and current native ownership at one validated ledger. Receiving-address records
are independent and are not required to display the verified Primary name.
The Kit never substitutes the first owned domain, a display-text record or an
unverified indexer candidate. It does not prompt the wallet or sign a transaction.

Reads have a timeout, a bounded cache and shared in-flight lookup for the same
address/network/RPC. `kit.refreshIdentity()` or `button.refreshIdentity()` bypasses
the cache; call it after a Primary update is validated. Missing or failed reads
leave the address visible. Changing account/network cannot apply a late name
from the previous session.

### Mainnet Deployment

Mainnet is disabled until a trusted deployment is explicitly supplied. It never
uses the Testnet treasury, namespace or Hook hashes as a fallback:

```ts
import { createDefaultWalletIdentityResolver } from "@xrpl-wallet-kit/ui";

const resolver = createDefaultWalletIdentityResolver({
  xahauName: {
    mainnet: trustedMainnetDeployment, // treasury, namespaceId, hookHashes, expectedNetworkId: 21337
    timeoutMs: 15000,
    cacheTtlMs: 60000,
  },
});
const kit = createWalletKit({
  network: "xahau-mainnet",
  preflight: { maxFeeDrops: "50000" },
  connectButton: "#connect-wallet",
  ui: { identity: { resolver } },
});
```

`trustedMainnetDeployment` is application configuration from a verified deployment
manifest, not data returned by a wallet or an arbitrary profile. The SDK checks
network/deployment identity. Set `xahauName: false` on the default resolver to
disable XahauName, or `xahauName: { testnet: false }` to disable Testnet only.
`createXrpDomainsResolver()` retains its XRPL-only behavior;
`createXahauNameResolver()` is available for Xahau-only custom compositions.

### Browser Runtime

ESM integrations load the SDK as a deferred chunk. The IIFE loads the separate,
minified `xrpl-wallet-kit-xahauname.runtime.js` beside the main script when an
eligible identity lookup starts. Self-host this file from the same Kit release;
do not add a second script tag. Allow its origin in CSP `script-src` and the
selected WebSocket RPC in `connect-src`. XRPL-only pages do not request this
runtime. It is separate from the Xahau transaction-signing runtime.

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
  connectButton: {
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

To keep the display name without a profile image, supply a resolver that returns
the name and omits `avatar`:

```ts
// via createWalletKit
const kit = createWalletKit({
  adapters: [/* ... */],
  connectButton: {
    target: "#connect-btn-root",
    identityResolver: async (address) => {
      const profile = await myRegistry.lookup(address);
      return profile ? { name: profile.name } : null;
    },
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
      verified: profile.isVerified,     // metadata; not server authentication
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
  verified?: boolean;   // optional resolver metadata, not an ownership proof
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

When using the all-in-one package, pass button options under `connectButton`,
or configure the resolver through `ui.identity.resolver`:

```ts
import { createWalletKit } from "@xrpl-wallet-kit/client";

const kit = createWalletKit({
  adapters: [/* ... */],
  connectButton: {
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
});
```

Identity is display metadata, not authentication or proof of ownership on a
second chain. A custom resolver can inspect `session.account.network` to choose
the right registry for XRPL or Xahau. Keep recipient-name resolution and
application-specific identity verification in your dApp.

## See also

- [Connect Button](/docs/configuration/connect-button) — full `WalletButton` options reference
- [Theming](/docs/configuration/theming) — customize avatar border color via `accent` token
- [WalletModal & WalletButton API](/docs/api/wallet-modal)
