# Changelog

## 0.1.0-beta.0

First public beta target for XRPL Wallet Kit.

### Added

- Headless wallet core with adapter architecture, session storage, network registry, activation status, and wallet events.
- Prebuilt wallet UI with connect modal, WalletConnect modes, custom QR panel, Connect Button, Account Panel, themes, layouts, and mobile bottom sheet behavior.
- Browser bundle for vanilla JavaScript and legacy HTML/jQuery integrations.
- React and Next.js helper packages.
- First-party adapters for Xaman, GemWallet, Crossmark, DropFi, WalletConnect, XRPL Snap, and Ledger.
- Sign-only and sign-and-submit manager flows.
- Basic docs for npm beta, browser usage, and legacy HTML integration.

### Notes

- Published under the `beta` npm dist-tag.
- WalletConnect `projectId` must be provided by the integrating app.
- APIs may still change before `1.0.0`.
