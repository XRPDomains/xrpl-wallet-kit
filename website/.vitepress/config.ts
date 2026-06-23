import { defineConfig } from "vitepress";

export default defineConfig({
  title: "XRPL Wallet Kit",
  description:
    "Framework-agnostic wallet adapter toolkit for XRPL browser dApps. Headless TypeScript core with optional prebuilt UI.",

  head: [
    ["link", { rel: "icon", type: "image/svg+xml", href: "/logo.svg" }],
    ["meta", { name: "theme-color", content: "#0078ae" }],
    ["meta", { property: "og:type", content: "website" }],
    ["meta", { property: "og:title", content: "XRPL Wallet Kit" }],
    [
      "meta",
      {
        property: "og:description",
        content: "Wallet adapter toolkit for XRPL browser dApps",
      },
    ],
  ],

  themeConfig: {
    logo: "/logo.svg",
    siteTitle: "XRPL Wallet Kit",

    nav: [
      { text: "Docs", link: "/docs/introduction" },
      { text: "Playground", link: "/docs/playground" },
      { text: "Theme Builder", link: "/docs/theme-builder" },
      { text: "API Reference", link: "/docs/api/wallet-manager" },
      {
        text: "v0.1.0-beta",
        items: [
          {
            text: "Changelog",
            link: "https://github.com/XRPDomains/xrpl-wallet-kit/releases",
          },
          {
            text: "Contributing",
            link: "https://github.com/XRPDomains/xrpl-wallet-kit/blob/main/CONTRIBUTING.md",
          },
        ],
      },
    ],

    sidebar: [
      {
        text: "Getting Started",
        items: [
          { text: "Introduction", link: "/docs/introduction" },
          { text: "Installation", link: "/docs/installation" },
          { text: "Quick Start", link: "/docs/quick-start" },
          { text: "Playground", link: "/docs/playground" },
          { text: "🎨 Theme Builder", link: "/docs/theme-builder" },
        ],
      },
      {
        text: "Frameworks",
        items: [
          { text: "React", link: "/docs/frameworks/react" },
          { text: "Next.js", link: "/docs/frameworks/next" },
          { text: "Vanilla TypeScript", link: "/docs/frameworks/vanilla" },
          { text: "HTML (Legacy / CDN)", link: "/docs/frameworks/html-legacy" },
        ],
      },
      {
        text: "Configuration",
        items: [
          { text: "Theming", link: "/docs/configuration/theming" },
          { text: "Networks", link: "/docs/configuration/networks" },
          { text: "Localization (i18n)", link: "/docs/configuration/i18n" },
          { text: "Connect Button", link: "/docs/configuration/connect-button" },
          { text: "Identity & Avatar", link: "/docs/configuration/identity" },
        ],
      },
      {
        text: "Authentication",
        collapsed: true,
        items: [
          { text: "Sign In with XRPL", link: "/docs/auth/introduction" },
          { text: "Next.js Integration", link: "/docs/auth/nextjs" },
          { text: "Custom Backend (Express)", link: "/docs/auth/custom-backend" },
        ],
      },
      {
        text: "Adapters",
        items: [
          { text: "Overview", link: "/docs/adapters/overview" },
          { text: "Xaman", link: "/docs/adapters/xaman" },
          { text: "GemWallet", link: "/docs/adapters/gemwallet" },
          { text: "WalletConnect", link: "/docs/adapters/walletconnect" },
          { text: "Crossmark", link: "/docs/adapters/crossmark" },
          { text: "Ledger (Hardware)", link: "/docs/adapters/ledger" },
          { text: "Dropfi", link: "/docs/adapters/dropfi" },
          { text: "XRPL Snap (MetaMask)", link: "/docs/adapters/xrpl-snap" },
          { text: "Otsu Wallet", link: "/docs/adapters/otsu" },
        ],
      },
      {
        text: "Advanced",
        items: [
          { text: "Events & Hooks", link: "/docs/advanced/events-hooks" },
          { text: "Bundle & Performance", link: "/docs/advanced/bundle-performance" },
          { text: "Headless Core", link: "/docs/advanced/headless" },
          { text: "Custom Adapter", link: "/docs/advanced/custom-adapter" },
          { text: "🤖 Building with AI", link: "/docs/advanced/ai-development" },
        ],
      },
      {
        text: "API Reference",
        items: [
          { text: "WalletManager", link: "/docs/api/wallet-manager" },
          { text: "WalletModal & WalletButton", link: "/docs/api/wallet-modal" },
          { text: "WalletToast", link: "/docs/api/wallet-toast" },
          { text: "createWalletKit", link: "/docs/api/create-wallet-kit" },
          { text: "Errors", link: "/docs/api/errors" },
        ],
      },
      {
        text: "Guides",
        items: [
          { text: "Going Live", link: "/docs/guides/going-live" },
          { text: "Migration Guide", link: "/docs/guides/migration" },
        ],
      },
    ],

    socialLinks: [
      {
        icon: "github",
        link: "https://github.com/XRPDomains/xrpl-wallet-kit",
      },
    ],

    footer: {
      message: "Released under the MIT License.",
      copyright: "Copyright © 2024 XRPL Wallet Kit Contributors",
    },

    editLink: {
      pattern:
        "https://github.com/XRPDomains/xrpl-wallet-kit/edit/main/website/:path",
      text: "Edit this page on GitHub",
    },

    search: {
      provider: "local",
    },
  },
});
