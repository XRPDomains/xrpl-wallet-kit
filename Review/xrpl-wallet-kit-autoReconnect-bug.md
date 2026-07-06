# XRPL Wallet Kit — `autoReconnect` race condition with browser extensions

**Severity:** High — `autoReconnect: true` is effectively broken for 3 of the 6 supported adapters on a real cold page load.
**Reported by:** XRPDomains integration team
**Tested on:** Kit v0.1.0-beta.3 IIFE bundle, Chrome 136 + Edge 135, all extensions installed and previously connected.

## Symptom

After a successful first connect (any of GemWallet, Crossmark, DropFi) the session is correctly persisted to `localStorage`. On the next page reload:

- The button stays in the disconnected ("Connect Wallet") state.
- `kit.manager.getSession()` returns `null`.
- The user has to open the wallet picker and click their wallet again.

For **Xaman** and **WalletConnect**, autoReconnect works on the same reload. So the regression is specific to the extension adapters.

## Root cause

Trace through the kit source (paths relative to `packages/`):

1. `client/src/index.ts:105-107` — when `autoReconnect: true`, `manager.autoReconnect()` runs synchronously inside `create()`:

   ```ts
   if (options.autoReconnect) {
     void manager.autoReconnect();
   }
   ```

2. `core/src/manager.ts:113-134` — `runAutoReconnect()` reads the stored session, finds the adapter, and calls `adapter.restoreSession(session)`. If that returns `null`, it emits `session_stale` with `reason: "restore_unavailable"` and returns. **No retry, no defer, no further attempts.**

3. The extension adapters' `restoreSession()` short-circuit to `null` when `isAvailable()` is false:

   - `adapters/gemwallet/src/index.ts` line ~37: `if (!await this.isAvailable()) return null;`
   - `adapters/crossmark/src/index.ts` line ~38: `if (!this.isAvailable()) return null;`
   - `adapters/dropfi/src/index.ts` line ~74: `if (!provider) return null; if (!this.isAvailable()) return null;`

4. Each `isAvailable()` probes a window global:
   - GemWallet → `provider.isInstalled()` where `provider = window.gemWallet` (via `@gemwallet/api`)
   - Crossmark → `window.crossmark.sync.isInstalled()`
   - DropFi → `window.xrpl.isDropFi || .connect || .getAddress || ...`

5. **Those globals are injected asynchronously by the extension's content script** — typically at `document_idle`, sometimes after `DOMContentLoaded` but before `window.load`, sometimes after `load`. When the page's `<script>` tag runs `kit.create()`, the globals usually do **not** exist yet on a cold reload.

   The kit's first (and only) `restoreSession()` call therefore probes a global that is `undefined`, returns `null`, and the kit gives up.

## Reproduction

Minimal:

```html
<script src="xrpl-wallet-kit.iife.min.js"></script>
<script>
  const kit = XRPLWalletKit.create({
    network: 'mainnet',
    autoReconnect: true,
    storage: 'localStorage',
    wallets: ['gemwallet', 'crossmark', 'dropfi'],
    connectButton: { target: '#btn' }
  });
  kit.manager.on('session_stale', e => console.log('STALE', e));
  kit.manager.on('connected', e => console.log('CONNECTED', e));
</script>
```

1. Open page, click Connect, pick GemWallet, approve.
2. Reload.
3. Console shows `STALE { reason: 'restore_unavailable' }` — `CONNECTED` never fires.
4. Click Connect Wallet manually — works, because by then the extension global is present.

## Proposed fixes (pick one or combine)

### A. Defer `autoReconnect()` until extensions are likely injected (smallest change)

In `client/src/index.ts`:

```ts
if (options.autoReconnect) {
  const triggerAutoReconnect = () => {
    // One animation frame after the load event gives extension content
    // scripts a chance to finish their document_idle injection.
    requestAnimationFrame(() => { void manager.autoReconnect(); });
  };
  if (typeof document !== 'undefined' && document.readyState !== 'complete') {
    window.addEventListener('load', triggerAutoReconnect, { once: true });
  } else {
    triggerAutoReconnect();
  }
}
```

This alone resolves ~80 % of cases in our testing. Cost: autoReconnect happens ~50-200 ms later. Imperceptible for users; the button just shows "Connect Wallet" for a frame before flipping.

### B. Poll `isAvailable()` inside `restoreSession()` (best UX, scoped to extension adapters)

Add a small helper to `BaseWalletAdapter`:

```ts
protected async waitForAvailability(timeoutMs = 2500, pollMs = 100): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      if (await this.isAvailable()) return true;
    } catch {}
    await new Promise<void>((r) => setTimeout(r, pollMs));
  }
  return false;
}
```

Use it inside each extension adapter's `restoreSession()`:

```ts
async restoreSession(session: WalletSession) {
  if (!await this.waitForAvailability(2500)) return null;
  // ... existing logic
}
```

Scoped to `restoreSession` only (not first-time `connect()`, which the user explicitly initiated and where the extension is expected to be present). 2.5 s is generous; in practice extensions inject in under 500 ms.

### C. Retry in `runAutoReconnect` (kit-level, no per-adapter change)

In `core/src/manager.ts` `runAutoReconnect()`, when `restored?.session` is `null` AND the reason would be "restore_unavailable", retry 3 times with 600 ms delay before emitting `session_stale`. This is the smallest blast radius but spreads the wait across all adapters even when they don't need it.

### D. Recommended: A + B combined

`A` removes the most common race even before the adapter sees the call. `B` covers slow extensions / slow machines that haven't finished injecting by `load + 1RAF`. Together they're essentially watertight.

Approximate implementation cost:

- A: 5 min change in `client/src/index.ts` + 1 unit test.
- B: 30 min — small helper in `BaseWalletAdapter` + one-line call in each of 3 adapter files + 3 unit tests with mocked window globals.
- C: 15 min in `manager.ts` + 1 unit test, but less precise.

## Workaround in place at XRPDomains (for context)

Until the kit ships a fix, our integration calls `kit.manager.autoReconnect()` manually after `window.load + 200 ms`, with two more retries 600 ms apart if the first attempt still returns `null`:

```js
function retryAuto(attempt) {
    if (!kit?.manager) return;
    if (kit.manager.getSession()) return;        // already restored
    kit.manager.autoReconnect().then((session) => {
        if (!session && attempt < 3) {
            setTimeout(() => retryAuto(attempt + 1), 600);
        }
    });
}
window.addEventListener('load', () => setTimeout(() => retryAuto(1), 200), { once: true });
```

This works because `runAutoReconnect()` does **not** strip the session from storage on `restore_unavailable` — only on `session_expired` (adapter unregistered) or `parseStoredSession` failure. So a later retry from the same storage entry is safe.

Worth noting in the kit docs even if you fix this upstream: integrators need to know `manager.autoReconnect()` is idempotent and re-callable.

## Acceptance checks for the fix

1. Cold reload (Ctrl+Shift+R) with each of GemWallet, Crossmark, DropFi previously connected → button shows connected state within 1 second, `connected` event fires, no `session_stale` event.
2. Cold reload with the extension uninstalled mid-session → `session_stale` fires after the 2.5 s budget, with the same `reason: "restore_unavailable"` (current behaviour preserved for genuine unavailability).
3. Xaman + WalletConnect unchanged (no regression on storage-only adapters).
4. Bundle size delta ≤ 1 KB.

Happy to test a beta build before release.
