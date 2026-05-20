import React, { useMemo } from "react";
import { createRoot } from "react-dom/client";
import { Buffer } from "buffer";
import { WalletManager, createBrowserWalletStorage } from "../../../packages/core/src";
import { createCrossmarkAdapter } from "../../../packages/adapters/crossmark/src";
import { createDropFiAdapter } from "../../../packages/adapters/dropfi/src";
import { createGemWalletAdapter } from "../../../packages/adapters/gemwallet/src";
import { createWalletConnectAdapters, createWalletConnectMetadata } from "../../../packages/adapters/walletconnect/src";
import { createXamanAdapter } from "../../../packages/adapters/xaman/src";
import { createXrplSnapAdapter } from "../../../packages/adapters/xrpl-snap/src";
import { createDefaultWalletButtonConfig, createDefaultWalletUiConfig } from "../../../packages/ui/src";
import { WalletButton, WalletKitProvider, useWalletKit } from "../../../packages/react/src";
import type { WalletAdapter } from "../../../packages/core/src";
import "./styles.css";

if (!("Buffer" in globalThis)) {
  (globalThis as typeof globalThis & { Buffer: typeof Buffer }).Buffer = Buffer;
}

const PREVIEW_CONFIG = {
  xamanClientId: import.meta.env.VITE_XAMAN_CLIENT_ID ?? "",
  walletConnectProjectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID ?? "",
  metadata: {
    name: import.meta.env.VITE_XRPL_WALLET_KIT_APP_NAME ?? "XRPL Wallet Kit React Preview",
    description: import.meta.env.VITE_XRPL_WALLET_KIT_APP_DESCRIPTION ?? "XRPL wallet adapter React preview",
    url: import.meta.env.VITE_XRPL_WALLET_KIT_APP_URL ?? "http://127.0.0.1:5174",
    icons: []
  }
};

function createPreviewManager() {
  const adapters: WalletAdapter[] = [
    createGemWalletAdapter(),
    createCrossmarkAdapter(),
    createDropFiAdapter(),
    createXrplSnapAdapter()
  ];

  let manager: WalletManager;
  if (PREVIEW_CONFIG.xamanClientId) {
    adapters.unshift(createXamanAdapter({
      apiKey: PREVIEW_CONFIG.xamanClientId,
      onQr: ({ adapterId, uri, deeplink }) => manager.emitQr(adapterId, uri, deeplink)
    }));
  }

  manager = new WalletManager({
    appName: PREVIEW_CONFIG.metadata.name,
    appDescription: PREVIEW_CONFIG.metadata.description,
    appUrl: PREVIEW_CONFIG.metadata.url,
    appIcons: PREVIEW_CONFIG.metadata.icons,
    network: "mainnet",
    autoReconnect: true,
    storage: createBrowserWalletStorage("xwk.react.preview."),
    adapters
  });

  if (PREVIEW_CONFIG.walletConnectProjectId) {
    createWalletConnectAdapters({
      projectId: PREVIEW_CONFIG.walletConnectProjectId,
      metadata: createWalletConnectMetadata(PREVIEW_CONFIG.metadata),
      mode: "details",
      wallets: "all",
      onQr: ({ adapterId, uri, deeplink }) => manager.emitQr(adapterId, uri, deeplink)
    }).forEach((adapter) => manager.register(adapter));
  }

  return manager;
}

function Preview() {
  const manager = useMemo(() => createPreviewManager(), []);
  const ui = useMemo(() => createDefaultWalletUiConfig({
    layout: "list",
    presentation: "grouped",
    themeMode: "light"
  }), []);
  const button = useMemo(() => createDefaultWalletButtonConfig({
    themeMode: "light",
    theme: ui.theme
  }), [ui.theme]);

  return (
    <WalletKitProvider manager={manager} ui={ui}>
      <main className="app">
        <section className="toolbar">
          <div>
            <h1>XRPL Wallet Kit React</h1>
            <p>React button uses the same wallet-ui engine as the vanilla preview.</p>
          </div>
          <WalletButton
            {...button}
          />
        </section>
        <ReactStatePanel />
      </main>
    </WalletKitProvider>
  );
}

function ReactStatePanel() {
  const { session, wallets, openModal } = useWalletKit();
  return (
    <>
      <section className="panel">
        <h2>React Controls</h2>
        <button type="button" onClick={openModal}>Open modal directly</button>
      </section>
      <section className="panel">
        <h2>Wallets</h2>
        <div className="wallet-list">
          {wallets.map((wallet) => (
            <div className="wallet-row" key={wallet.id}>
              {wallet.icon ? <img className="wallet-icon" src={wallet.icon} alt="" /> : <span className="wallet-icon wallet-icon-fallback">{wallet.name.slice(0, 1)}</span>}
              <div className="wallet-info">
                <strong>{wallet.name}</strong>
                <span>{wallet.group ?? wallet.type} · {wallet.id}</span>
              </div>
            </div>
          ))}
        </div>
      </section>
      <section className="panel">
        <h2>Session</h2>
        <pre>{session ? JSON.stringify(session, null, 2) : "No wallet connected."}</pre>
      </section>
    </>
  );
}

createRoot(document.querySelector("#root")!).render(<Preview />);
