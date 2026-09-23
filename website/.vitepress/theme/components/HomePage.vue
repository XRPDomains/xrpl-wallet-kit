<template>
  <main class="xwk-home">
    <header class="xwk-home__hero">
      <div>
        <span class="xwk-home__eyebrow">Wallet infrastructure for XRPL</span>
        <h1>XRPL Wallet Kit</h1>
        <p class="xwk-home__lede">
          One typed connection layer for XRPL wallets, with a headless core when you need control and
          production UI when you do not.
        </p>
        <nav class="xwk-home__actions" aria-label="Start using XRPL Wallet Kit">
          <a class="xwk-home__action xwk-home__action--primary" href="./docs/quick-start">Quick start</a>
          <a class="xwk-home__action" href="./docs/api/wallet-manager">API reference</a>
          <a class="xwk-home__action" href="https://github.com/XRPDomains/xrpl-wallet-kit">GitHub</a>
        </nav>
      </div>
      <div class="xwk-home__code" aria-label="Install and initialize">
        <span class="xwk-home__code-label">Minimum integration</span>
        <pre><code>npm i @xrpl-wallet-kit/core

const manager = new WalletManager({
  adapters,
  network: "mainnet"
})</code></pre>
      </div>
    </header>

    <div class="xwk-home__section xwk-home__adapters" aria-label="Supported wallet adapters">
      <span class="xwk-home__adapter-label">Adapters</span>
      <div class="xwk-home__adapter-list">
        <span>Xaman</span><span>GemWallet</span><span>WalletConnect</span><span>Crossmark</span>
        <span>Ledger</span><span>DropFi</span><span>XRPL Snap</span><span>Otsu</span>
      </div>
    </div>

    <section class="xwk-home__section" aria-labelledby="integration-heading">
      <div class="xwk-home__section-head">
        <span class="xwk-home__section-index">01 / Integration paths</span>
        <h2 id="integration-heading">Use only the layer your application needs.</h2>
        <p>The same adapter contract runs behind the packaged interface, framework integrations, and custom headless flows.</p>
      </div>
      <div class="xwk-home__routes">
        <a class="xwk-home__route" href="./docs/quick-start">
          <strong>Prebuilt UI</strong>
          <span>Connect button, wallet modal, inline selector, and transaction feedback.</span>
          <code>start →</code>
        </a>
        <a class="xwk-home__route" href="./docs/advanced/headless">
          <strong>Headless core</strong>
          <span>Own the entire interface while keeping adapter lifecycle and capability checks.</span>
          <code>compose →</code>
        </a>
        <a class="xwk-home__route" href="./docs/frameworks/legacy-cdn">
          <strong>Browser bundle</strong>
          <span>Load the current release from jsDelivr for plain HTML and script-based apps.</span>
          <code>embed →</code>
        </a>
        <a class="xwk-home__route" href="./docs/auth/introduction">
          <strong>Wallet auth</strong>
          <span>Issue a nonce, sign a message, and verify ownership on your backend.</span>
          <code>verify →</code>
        </a>
      </div>
    </section>

    <section class="xwk-home__section" aria-labelledby="workbench-heading">
      <div class="xwk-home__section-head">
        <span class="xwk-home__section-index">02 / Live workbench</span>
        <h2 id="workbench-heading">Inspect the shipped interface.</h2>
        <p>
          Change layout, color mode, and button treatment. The preview loads the published browser bundle and
          produces matching configuration.
        </p>
      </div>
      <div class="xwk-home__workbench">
        <PlaygroundWidget />
      </div>
    </section>
  </main>
</template>
