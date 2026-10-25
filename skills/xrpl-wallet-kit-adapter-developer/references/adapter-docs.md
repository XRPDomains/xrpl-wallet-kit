# Consumer Adapter Guide

Use this contract for every wallet guide in `website/docs/adapters/`. The overview is a comparison/index page, not a wallet guide.

## Page Structure

Start with `# <Wallet Name> Adapter`, a short introduction and an Integration/Value table containing Package, Adapter ID, Wallet type and Client registration. State default versus opt-in registration accurately.

Use these H2 sections, in this exact order:

1. Installation
2. Connect
3. Networks
4. Capabilities
5. Options
6. Transactions
7. Authentication
8. Sessions and Disconnect
9. Integration Notes
10. Troubleshooting
11. Related Guides

Use H3 sections for wallet-specific material, not extra top-level headings. Keep browser requirements, provider detection, device apps and WalletConnect detail modes inside Integration Notes or the relevant connection/network section.

## Examples and Tables

- Installation shows core + named adapter + the XRPL peer. Explain that the Client tab uses the all-in-one client package instead.
- Connect uses one VitePress code group with Client and Core tabs. Both define `manager` and `account`; use these names in subsequent examples. Keep the adapter ID and factory name exact, including `joey-wallet` versus WalletConnect's `joey`.
- Never put a real project ID/API key or a live recipient into examples. Use descriptive credential and recipient placeholders. Explain variables such as `nonceFromServer` before they are required.
- Networks distinguishes standard presets, custom networks, Xahau, explicit opt-in, protocol registration and relevant wallet/device restrictions. Do not treat a successful connection as proof of transaction/app support.
- Capabilities uses Operation/Support columns and the same rows: Connect, Disconnect, Session restore, `signTransaction()`, `signAndSubmit()`, `signMessage()`, `signIn()`, `switchNetwork()`, Payment / NFT transactions, QR / deep link.
- Describe manager-level behavior, not just boolean flags. Xaman's sign-only fallback is usable through the manager; local disconnect is not provider permission revocation; cached restore is not verified account ownership. Distinguish generic transaction support from specialized payment/NFT capability flags.
- Options uses Option/Type/Default/Description columns. State that factory options are not automatically top-level client options. Read current source signatures and defaults, not just old documentation.
- Transactions has Payment and NFT Transactions subsections. Reuse the regions in `website/.vitepress/snippets/adapter-transactions.md` with `<!--@include: ../../.vitepress/snippets/adapter-transactions.md#region-name-->`.
- Include payment sign-only only when that manager operation is supported. Otherwise explicitly say it is unavailable. The shared NFT region includes mint, create/accept/cancel offer and burn examples.
- All examples in the shared transaction region target XRPL. Link to the Xahau guide for XAH/URI token/Invoke examples; never relabel an XRPL-specific example as chain-neutral.
- Authentication names the actual proof kind and separates `signMessage()` from native `signIn()`. Unsupported methods get an explicit explanation, not dummy code. Link to the correct server verifier; wallet approval and cache restore do not create a backend login session.
- Sessions explains passive provider verification, cached-only restore, explicit reconnect, and what disconnect actually clears. Do not call a popup/approval flow passive restore.
- Troubleshooting uses Symptom/Action columns with concise actions. Do not instruct automatic resubmission after uncertain dispatch.
- Related Guides includes Adapters Overview plus the relevant internal integration guides and official provider documentation.

## Maintenance

Read adapter source when updating capability/option claims. Keep the overview and Introduction's Supported Wallets table aligned. Preserve existing page paths and meaningful section anchors when possible; if renaming headings, add explicit legacy anchors or update inbound links.

For docs-only changes, run the focused documentation contract test and inspect rendered guides in the website dev server. Do not automatically build SDK bundles, publish, commit or rebuild the website unless requested.

```powershell
node --import tsx --test tests/adapter-docs.test.ts
```
