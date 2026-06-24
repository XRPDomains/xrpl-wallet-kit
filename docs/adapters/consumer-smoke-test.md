# Consumer Type Smoke Test

Use this before publishing a public package release.

1. Build packages:

```powershell
npm.cmd run build
npm.cmd run build:browser
```

2. In a clean temporary project, install the packed packages or workspace-linked packages.

3. Verify these imports compile with `tsc --noEmit`:

```ts
import { WalletManager } from "@xrpl-wallet-kit/core";
import { createWalletKit } from "@xrpl-wallet-kit/client";
import { createWalletModal } from "@xrpl-wallet-kit/ui";
import { WalletKitProvider, WalletButton } from "@xrpl-wallet-kit/react";
import { create, createClient } from "@xrpl-wallet-kit/browser";
```

4. Verify browser script usage:

```html
<script src="/dist/xrpl-wallet-kit.iife.min.js"></script>
<script>
  const kit = window.XRPLWalletKit.create({ walletConnectProjectId: "..." });
</script>
```

Acceptance criteria: TypeScript sees declarations for every public import and the browser global exposes `XRPLWalletKit.create` and `XRPLWalletKit.createClient`.
