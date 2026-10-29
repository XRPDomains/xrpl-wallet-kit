# Bundle & Performance

## Choose an Entry Point

`@xrpl-wallet-kit/client` provides synchronous factories with built-in adapters.
The `wallets` option selects adapters at runtime; it does not remove their SDKs
from the build. Existing `createWalletKit()` and `createWalletClient()` calls
remain synchronous and compatible.

For applications that choose adapters explicitly, use the selective entry:

```ts
import { createWalletClient, XRPL_TESTNET } from '@xrpl-wallet-kit/client/selective';
import { createGemWalletAdapter } from '@xrpl-wallet-kit/adapter-gemwallet';

const manager = createWalletClient({
  networks: [XRPL_TESTNET],
  network: 'testnet',
  adapters: [createGemWalletAdapter()],
  storage: 'memory'
});
```

The selective factory returns a `WalletManager`. It requires an explicit adapter
array and does not provide the all-in-one `createWalletKit()` UI factory. Mount
the manager with `WalletKitProvider` in React, or create UI components explicitly.
It also accepts `storage: 'localStorage'` or a custom storage implementation.

The client package still lists the built-in adapters as install dependencies.
To reduce installed dependencies too, use `@xrpl-wallet-kit/core` and individual
adapter packages directly, adding `@xrpl-wallet-kit/react` or `@xrpl-wallet-kit/ui`
only when needed.

## Measure Your Bundle

From the repository root:

```sh
npm ci
npm run check:bundle
```

The fixtures in `tests/fixtures/bundle` import the built package exports, preserve
the created manager as an observable global, and use Vite production bundling
with esbuild minification and an ES2020 target. No source aliases are used.

Sizes sum all emitted JavaScript chunks, including dynamic chunks, and gzip each
chunk separately. They are not initial-page download sizes, npm tarball sizes,
or Next.js application measurements. Measure the current dependency lockfile
and application build; older release measurements do not represent the current
adapter set or Xahau runtime. Framework runtime, UI usage and bundler versions
change application results.

CI checks the actual emitted module graph: the selective fixture must include
GemWallet and exclude other adapters and WalletConnect, Ledger and Xaman SDKs.
It also requires selective gzip size to stay below half the defaults fixture.
Exact bytes are reported, not pinned, so dependency updates can be reviewed
without failing on insignificant compression differences.

## Browser Script and Code Splitting

The browser IIFE is useful for HTML sites that do not use a bundler. It includes
the built-in adapters and browser polyfills in one file. Websites using the CDN
can continue to use the `@latest` URL; selective imports require a module bundler.

Xahau codec/definitions are separate from the main browser script. The minified
`xrpl-wallet-kit-xahau.runtime.js` loads on first Xahau preparation or lookup,
not merely on connection. XRPL-only pages do not download it. Self-host the
matching runtime beside the IIFE; see [Xahau CDN setup](/docs/configuration/xahau#dynamic-xahau-runtime).

ES module consumers can split dynamic imports into separate chunks. A runtime
wallet filter does not eliminate these chunks from the generated application.
Inspect both initial and deferred chunks in the application's production build
when comparing delivery costs.

## Signing and RPC

Xahau preparation reads the ledger head, queue-aware account sequence and a
transaction-aware fee quote. Independent head/account reads run together; when
the transaction already contains the required fields, the fee read joins them.
After wallet approval, Kit verifies the exact signed intent and repeats fresh
sequence, expiry and fee checks. The immediate verified-submission path uses
that fresh head within the controlled phase. Standalone submission checks a
fresh head separately. Do not remove post-sign checks to reduce requests.

Long approval delays, account queues and fee changes can invalidate a prepared
transaction. No fixed RPC count or end-to-end timing is guaranteed. A preliminary
submit response is not a validated receipt, and uncertain submission is never
automatically retried.

Choose one confirmation owner. If your application SDK already tracks validated
receipts, disable Kit's confirmation poller and update history from those receipts:

```ts
const kit = createWalletKit({
  network: "xahau-mainnet",
  preflight: { maxFeeDrops: "50000" },
  accountStatus: { enabled: false }, // Optional if your app owns these reads
  transactionConfirmation: { enabled: false },
});
```

These switches do not bypass signing verification. They also do not disable
button balance reads enabled with `showBalance`; use a shared custom resolver
when your app already owns that data. Feed only validated successful receipts
into history as `confirmed`.

## Balance and Wallet Detection

Availability probes share in-flight work and a short cache. Refresh when needed
with `manager.getWalletAvailability({ refresh: true })`, not on every render.
Availability is detection, not authentication or a guarantee of chain support.

The button coalesces in-flight balance refreshes for the same account/network,
caches reserve reads and preserves a previous balance on transient failures.
Keep `showBalance` off if the app does not need it, and avoid polling it from
multiple components. A custom `balanceResolver` can reuse your application's data.

## React Updates

`useWalletAccount()` and `useWalletStatus()` are convenience hooks over the shared
wallet context. They currently receive context updates just like `useWalletKit()`;
they do not provide independent subscriptions or guarantee fewer renders. Keep
expensive derived work memoized and pass only necessary values to memoized child
components.
