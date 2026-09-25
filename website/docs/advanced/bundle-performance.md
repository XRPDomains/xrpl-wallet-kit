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

## Reproducible Bundle Baseline

From the repository root:

```sh
npm ci
npm run check:bundle
```

The fixtures in `tests/fixtures/bundle` import the built package exports, preserve
the created manager as an observable global, and use Vite production bundling
with esbuild minification and an ES2020 target. No source aliases are used.

Baseline measured on 2026-09-25 with package version 0.1.18, Node 22.17.0 and
Vite 6.4.3 using the repository lockfile:

| Fixture | JS chunks | Minified bytes | Gzip bytes | Included adapters |
| --- | ---: | ---: | ---: | --- |
| `client/selective` + GemWallet | 1 | 105,016 | 22,666 | GemWallet |
| `client` with `wallets: ['gemwallet']` | 10 | 1,566,646 | 507,818 | All 7 built-in adapters |

Sizes sum all emitted JavaScript chunks, including dynamic chunks, and gzip each
chunk separately. They are not initial-page download sizes, npm tarball sizes,
or Next.js application measurements. Framework runtime, UI usage and bundler
versions can change application results. This fixture does not establish a new
Next.js baseline.

CI checks the actual emitted module graph: the selective fixture must include
GemWallet and exclude other adapters and WalletConnect, Ledger and Xaman SDKs.
It also requires selective gzip size to stay below half the defaults fixture.
Exact bytes are reported, not pinned, so dependency updates can be reviewed
without failing on insignificant compression differences.

## Browser Script and Code Splitting

The browser IIFE is useful for HTML sites that do not use a bundler. It includes
the built-in adapters and browser polyfills in one file. Websites using the CDN
can continue to use the `@latest` URL; selective imports require a module bundler.

ES module consumers can split dynamic imports into separate chunks. A runtime
wallet filter does not eliminate these chunks from the generated application.
Inspect both initial and deferred chunks in the application's production build
when comparing delivery costs.

## React Updates

`useWalletAccount()` and `useWalletStatus()` are convenience hooks over the shared
wallet context. They currently receive context updates just like `useWalletKit()`;
they do not provide independent subscriptions or guarantee fewer renders. Keep
expensive derived work memoized and pass only necessary values to memoized child
components.
