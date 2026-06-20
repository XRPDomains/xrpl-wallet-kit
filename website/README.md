# XRPL Wallet Kit — Documentation Site

Built with [VitePress](https://vitepress.dev). Outputs static HTML — deploy anywhere, including IIS.

## Development

```bash
cd website
npm install
npm run dev
# → http://localhost:5173
```

## Build

```bash
npm run build
# → .vitepress/dist/
```

## Deploy to IIS (Windows Server)

```powershell
# Run on the server (or CI agent with access to the server)
.\deploy-iis.ps1 -SitePath "C:\inetpub\wwwroot\xrpl-docs"
```

Prerequisites on the IIS server:
1. [URL Rewrite module](https://www.iis.net/downloads/microsoft/url-rewrite)
2. Static Content feature enabled
3. Node.js 18+ (only needed on build machine, not on the IIS server itself)

## Structure

```
website/
├── .vitepress/
│   ├── config.ts          ← nav, sidebar, SEO
│   └── theme/
│       ├── index.ts       ← theme entry
│       └── custom.css     ← brand colors, overrides
├── docs/
│   ├── introduction.md
│   ├── installation.md
│   ├── quick-start.md
│   ├── configuration/
│   │   ├── theming.md
│   │   ├── networks.md
│   │   └── i18n.md
│   ├── adapters/
│   │   ├── overview.md
│   │   ├── xaman.md
│   │   ├── gemwallet.md
│   │   ├── walletconnect.md
│   │   ├── crossmark.md
│   │   ├── ledger.md
│   │   ├── dropfi.md
│   │   ├── xrpl-snap.md
│   │   └── otsu.md
│   └── api/
│       ├── wallet-manager.md
│       ├── wallet-modal.md
│       └── errors.md
├── public/
│   └── logo.svg
├── index.md               ← landing page
├── web.config             ← IIS URL rewrite + MIME types
├── deploy-iis.ps1         ← deployment script
└── package.json
```
