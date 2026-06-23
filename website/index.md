---
layout: home

hero:
  name: "XRPL Wallet Kit"
  text: "Connect any XRPL wallet — ready in minutes"
  tagline: "9 adapters · Customizable modal · Built-in auth · AI-powered"
  image:
    src: /logo.svg
    alt: XRPL Wallet Kit
  actions:
    - theme: brand
      text: Get Started
      link: /docs/introduction
    - theme: alt
      text: Live Playground
      link: /docs/playground
    - theme: alt
      text: View on GitHub
      link: https://github.com/XRPDomains/xrpl-wallet-kit

features:
  - icon: 🔌
    title: 9 Wallet Adapters — most in the ecosystem
    details: Xaman, GemWallet, WalletConnect, Crossmark, Ledger, Dropfi, XRPL Snap, Otsu — one unified API. Add only what your dApp needs.
    link: /docs/adapters/overview
    linkText: Browse adapters

  - icon: 🎨
    title: Beautiful modal, fully customizable
    details: Accent color, radius, dark/light mode, list or grid layout — all configurable. Live preview in the playground before writing a line of code.
    link: /docs/playground
    linkText: Try the playground

  - icon: 🤖
    title: Build adapters with AI
    details: The only XRPL wallet library with an AI coding skill. Claude Code and Codex produce correct adapters from wallet docs alone, with capability rules and error codes enforced automatically.
    link: /docs/advanced/ai-development
    linkText: AI development guide

  - icon: 🔒
    title: Sign In with XRPL Wallet
    details: Nonce, wallet-signed message, server-side verification — all built in. Works with Express, Next.js, or any backend. No third-party service required.
    link: /docs/auth/introduction
    linkText: Auth guide

  - icon: 📦
    title: Works everywhere — zero lock-in
    details: React, Vue, vanilla TypeScript, or plain HTML via CDN script — one API everywhere. Core is 5.7 KB gzip.
    link: /docs/frameworks/vanilla
    linkText: See all frameworks

  - icon: 🧩
    title: Headless core & typed contract
    details: UI is fully optional. Build a custom wallet selector on the headless core, or validate any adapter at runtime with assertWalletAdapter().
    link: /docs/advanced/headless
    linkText: Headless guide
---
