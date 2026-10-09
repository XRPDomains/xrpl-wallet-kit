# Scaffold Notes

When creating an official package in this monorepo:

1. Inspect `docs/adapters/templates/adapter-package`, the skill template and a current comparable adapter; adapt them to the current core contract rather than copying unchanged stubs.
2. Rename package in `package.json` to `@xrpl-wallet-kit/adapter-<wallet-id>`.
3. Update class/function names and metadata `id`, `name`, `type`, `icon`, `group`, and `homepage`.
4. Implement availability detection without throwing for normal missing-provider cases.
5. Implement `connect()` and only the optional methods that the wallet actually supports.
6. Add cleanup for listeners, timers, popups, transports, and stale sessions.
7. Add package exports and TypeScript declarations.
8. Align package/core dependency versions with the workspace. Add client/browser exports only when needed; choose default, opt-in or standalone registration explicitly.
9. Update consumer docs and relevant preview selectors without claiming npm/CDN availability before publication.
10. Run focused validation first. Full tests, bundling, website builds and publication are separate steps when requested or required by the changed surface.

If the adapter is third-party-owned outside this monorepo, keep package naming independent but depend on `@xrpl-wallet-kit/core` and follow the same interface.
