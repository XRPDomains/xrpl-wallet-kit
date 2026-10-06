import React, { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { Buffer } from "buffer";
import { WalletManager, createBrowserWalletStorage } from "../../../packages/core/src";
import { createCrossmarkAdapter } from "../../../packages/adapters/crossmark/src";
import { createDropFiAdapter } from "../../../packages/adapters/dropfi/src";
import { createGhostsigAdapter } from "../../../packages/adapters/ghostsig/src";
import { createGemWalletAdapter } from "../../../packages/adapters/gemwallet/src";
import { createLedgerAdapter } from "../../../packages/adapters/ledger/src";
import { createOtsuAdapter } from "../../../packages/adapters/otsu/src";
import { createWalletConnectAdapters, createWalletConnectMetadata } from "../../../packages/adapters/walletconnect/src";
import { createXamanAdapter } from "../../../packages/adapters/xaman/src";
import { createXrplSnapAdapter } from "../../../packages/adapters/xrpl-snap/src";
import { createDefaultWalletUiConfig, resolveWalletButtonOptions } from "../../../packages/ui/src";
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
    createXrplSnapAdapter(),
    createLedgerAdapter(),
    createOtsuAdapter(),
    createGhostsigAdapter()
  ];

  let manager: WalletManager;
  if (PREVIEW_CONFIG.xamanClientId) {
    adapters.unshift(createXamanAdapter({
      apiKey: PREVIEW_CONFIG.xamanClientId,
      onQr: ({ adapterId, uri, deeplink }) => manager.emitQr(adapterId, uri, deeplink)
    }));
  }

  manager = new WalletManager({
    metadata: PREVIEW_CONFIG.metadata,
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
  const [visibleWallets, setVisibleWallets] = useState(() => manager.getWallets().map(wallet => wallet.id));
  const ui = useMemo(() => createDefaultWalletUiConfig({
    mode: "light",
    modal: {
      title: "Connect Wallet",
      width: "default",
      footerText: "XRPL Wallet Kit"
    },
    walletList: {
      layout: "list",
      wallets: visibleWallets,
      showGroup: true
    },
    walletConnect: {
      mode: "group",
      cta: "both",
      qr: {
        style: "dots",
        showLogo: false
      }
    }
  }), [visibleWallets]);
  const button = useMemo(() => resolveWalletButtonOptions({ mode: "light" }, { showBalance: true }), []);

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
        <ReactStatePanel visibleWallets={visibleWallets} onToggleWallet={(id, visible) => {
          setVisibleWallets(current => visible ? [...new Set([...current, id])] : current.filter(walletId => walletId !== id));
        }} />
      </main>
    </WalletKitProvider>
  );
}

function ReactStatePanel({ visibleWallets, onToggleWallet }: {
  visibleWallets: string[];
  onToggleWallet: (id: string, visible: boolean) => void;
}) {
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
            <label className="wallet-row" key={wallet.id}>
              <input
                type="checkbox"
                checked={visibleWallets.includes(wallet.id)}
                onChange={event => onToggleWallet(wallet.id, event.target.checked)}
                aria-label={`Show ${wallet.name}`}
              />
              {wallet.icon ? <img className="wallet-icon" src={wallet.icon} alt="" /> : <span className="wallet-icon wallet-icon-fallback">{wallet.name.slice(0, 1)}</span>}
              <div className="wallet-info">
                <strong>{wallet.name}</strong>
                <span>{wallet.group ?? wallet.type} | {wallet.id}</span>
              </div>
            </label>
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
