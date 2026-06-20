---
layout: home

hero:
  name: "XRPL Wallet Kit"
  text: "Wallet adapters for every XRPL dApp"
  tagline: Framework-agnostic. Headless. TypeScript-first. Supports vanilla JS, React, Vue, and legacy HTML in one SDK.
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
    title: 9 Wallet Adapters
    details: Xaman, GemWallet, WalletConnect, Crossmark, Ledger, Dropfi, XRPL Snap, and Otsu — all behind one unified API. Add only the adapters your dApp needs.
    link: /docs/adapters/overview
    linkText: Browse adapters

  - icon: 🎨
    title: Headless UI
    details: Drop in the prebuilt modal and connect button, or build your own UI on top of the headless core — no framework required.
    link: /docs/advanced/headless
    linkText: Headless guide

  - icon: 🌐
    title: Framework Agnostic
    details: Works with React, Vue, Svelte, vanilla TypeScript, and plain HTML via IIFE CDN bundle. No framework, no bundler required.
    link: /docs/frameworks/vanilla
    linkText: Framework guides

  - icon: ⚡
    title: Tree-Shakeable
    details: Only pay for what you import. Each adapter is a separate package. Core is 5.7 KB gzip.
    link: /docs/advanced/bundle-performance
    linkText: Bundle guide

  - icon: 🔒
    title: Sign In with Wallet
    details: Built-in authentication package — SIWW flow with nonce, message signing, and server-side signature verification. Works with any backend.
    link: /docs/auth/introduction
    linkText: Auth guide

  - icon: 🌍
    title: Multinetwork
    details: Mainnet, Testnet, Devnet, and custom XRPL networks. Built-in explorer links and network badge in the modal.
    link: /docs/configuration/networks
    linkText: Network co