# Scaffold Notes

When creating an official package in this monorepo:

1. Copy `docs/adapters/templates/adapter-package` to `packages/adapters/<wallet-id>`.
2. Rename package in `package.json` to `@xrpl-wallet-kit/adapter-<wallet-id>`.
3. Update class/function names and metadata `id`, `name`, `type`, `icon`, `group`, and `homepage`.
4. Implement availability detection without throwing for normal missing-provider cases.
5. Implement `connect()` and only the optional methods that the wallet actually supports.
6. Add cleanup for listeners, timers, popups, transports, and stale sessions.
7. Add package exports and TypeScript declarations.
8. Add package to workspace dependencies only if the all-in-one client/browser bundle should include it.
9. Add or update examples only if the adapter should appear in default previews.
10. Run validation commands.

If the adapter is third-party-owned outside this monorepo, keep package naming independent but depend on `@xrpl-wallet-kit/core` and follow the same interface.

