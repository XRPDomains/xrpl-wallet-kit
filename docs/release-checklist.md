# Release checklist

1. Set the same semantic version in the root, every publishable workspace, examples, and website package.
2. Update internal `@xrpl-wallet-kit/*` dependency versions, the browser banner, website navigation version, widget bundle constants, and legacy example cache query.
3. Run `npm run build:browser`, `npm run smoke:release`, and `npm --prefix website run build`.
4. Run the **Coordinated release** workflow with publishing disabled and inspect the artifacts/logs.
5. Ensure `NPM_TOKEN` is configured, then rerun with publishing enabled. The workflow publishes workspaces and creates the matching `vX.Y.Z` GitHub release.

The release smoke script is the authoritative version-consistency check. Do not publish from an unvalidated working tree.
