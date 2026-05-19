import { WalletManager, createBrowserWalletStorage } from "../../../packages/wallet-core/src";
import { Buffer } from "buffer";
import type { WalletAdapter } from "../../../packages/wallet-core/src";
import type { WalletUiLayout, WalletUiPresentation, WalletUiThemeMode } from "../../../packages/wallet-ui/src";

import "./styles.css";

if (!("Buffer" in globalThis)) {
  (globalThis as typeof globalThis & { Buffer: typeof Buffer }).Buffer = Buffer;
}

const PREVIEW_CONFIG = {
  xamanClientId: import.meta.env.VITE_XAMAN_CLIENT_ID ?? "",
  walletConnectProjectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID ?? "",
  metadata: {
    name: import.meta.env.VITE_XRPL_WALLET_KIT_APP_NAME ?? "XRPL Wallet Kit Preview",
    description: import.meta.env.VITE_XRPL_WALLET_KIT_APP_DESCRIPTION ?? "XRPL wallet adapter integration preview",
    url: import.meta.env.VITE_XRPL_WALLET_KIT_APP_URL ?? "http://127.0.0.1:5173",
    icons: []
  }
};

const events = document.querySelector<HTMLPreElement>("#events")!;
const session = document.querySelector<HTMLPreElement>("#session")!;
const connectButton = document.querySelector<HTMLButtonElement>("#connect")!;
const walletsList = document.querySelector<HTMLDivElement>("#wallets")!;
const uiLayout = document.querySelector<HTMLSelectElement>("#ui-layout")!;
const walletConnectMode = document.querySelector<HTMLSelectElement>("#walletconnect-mode")!;
const uiTheme = document.querySelector<HTMLSelectElement>("#ui-theme")!;

type WalletConnectMode = "default" | "list" | "group";

let manager: WalletManager;
let modal: { open(): void; updateOptions(options: Record<string, unknown>): void } | undefined;
let bootstrapRun = 0;

connectButton.disabled = false;
connectButton.addEventListener("click", () => {
  if (modal) {
    modal.updateOptions(getWalletUiOptions());
    modal.open();
    return;
  }
  log("loading", { message: "Wallet UI is still initializing." });
});

[uiLayout, uiTheme].forEach((control) => {
  control.addEventListener("change", () => {
    modal?.updateOptions(getWalletUiOptions());
    log("ui_config", getWalletUiOptions());
  });
});

walletConnectMode.addEventListener("change", () => {
  resetPreview().catch((error) => {
    connectButton.disabled = false;
    log("bootstrap_error", { message: error instanceof Error ? error.message : String(error) });
  });
});

async function resetPreview() {
  bootstrapRun += 1;
  modal = undefined;
  connectButton.disabled = true;
  document.querySelectorAll(".xwk-overlay").forEach((node) => node.remove());
  await bootstrap(bootstrapRun);
}

async function bootstrap(run = bootstrapRun) {
  const [
    { createCrossmarkAdapter },
    { createDropFiAdapter },
    { createGemWalletAdapter },
    { createWalletConnectAdapters, createWalletConnectMetadata },
    { createXamanAdapter },
    { createXrplSnapAdapter }
  ] = await Promise.all([
    import("../../../packages/wallet-adapters/wallet-adapter-crossmark/src"),
    import("../../../packages/wallet-adapters/wallet-adapter-dropfi/src"),
    import("../../../packages/wallet-adapters/wallet-adapter-gemwallet/src"),
    import("../../../packages/wallet-adapters/wallet-adapter-walletconnect/src"),
    import("../../../packages/wallet-adapters/wallet-adapter-xaman/src"),
    import("../../../packages/wallet-adapters/wallet-adapter-xrpl-snap/src")
  ]);

  const WALLETCONNECT_METADATA = createWalletConnectMetadata(PREVIEW_CONFIG.metadata);
  const mode = getWalletConnectMode();
  const walletConnectAdapterMode = mode === "default" ? "default" : "details";
  const adapters: WalletAdapter[] = [];

  if (PREVIEW_CONFIG.xamanClientId) {
    adapters.push(createXamanAdapter({
      apiKey: PREVIEW_CONFIG.xamanClientId,
      onQr: ({ adapterId, uri, deeplink }) => manager.emitQr(adapterId, uri, deeplink)
    }));
  } else {
    log("config_warning", { message: "VITE_XAMAN_CLIENT_ID is not set; Xaman preview adapter is disabled." });
  }

  adapters.push(createGemWalletAdapter());
  adapters.push(createCrossmarkAdapter());
  adapters.push(createDropFiAdapter());
  adapters.push(createXrplSnapAdapter());

  manager = new WalletManager({
    appName: PREVIEW_CONFIG.metadata.name,
    appDescription: PREVIEW_CONFIG.metadata.description,
    appUrl: PREVIEW_CONFIG.metadata.url,
    appIcons: PREVIEW_CONFIG.metadata.icons,
    network: "mainnet",
    autoReconnect: true,
    storage: createBrowserWalletStorage("xwk.preview."),
    adapters
  });

  if (PREVIEW_CONFIG.walletConnectProjectId) {
    createWalletConnectAdapters({
      projectId: PREVIEW_CONFIG.walletConnectProjectId,
      metadata: WALLETCONNECT_METADATA,
      mode: walletConnectAdapterMode,
      wallets: "all",
      onQr: ({ adapterId, uri, deeplink }) => manager.emitQr(adapterId, uri, deeplink)
    }).forEach((adapter) => manager.register(adapter));
  } else {
    log("config_warning", { message: "VITE_WALLETCONNECT_PROJECT_ID is not set; WalletConnect preview adapters are disabled." });
  }

  const { createWalletModal } = await import("../../../packages/wallet-ui/src");
  if (run !== bootstrapRun) return;
  modal = createWalletModal({
    manager,
    ...getWalletUiOptions()
  });

  connectButton.disabled = false;
  renderWallets();

  manager.on("connecting", (event) => log("connecting", event));
  manager.on("connected", (event) => {
    log("connected", event);
    renderSession();
  });
  manager.on("disconnected", (event) => {
    log("disconnected", event);
    renderSession();
  });
  manager.on("qr", (event) => log("qr", { adapterId: event.adapterId, uriLength: event.uri.length, deeplink: event.deeplink }));
  manager.on("signing", (event) => log("signing", event));
  manager.on("signed", (event) => log("signed", event));
  manager.on("error", (event) => log("error", { message: event.error instanceof Error ? event.error.message : String(event.error) }));

  await manager.autoReconnect();
  renderSession();
  log("ready", { walletConnectMode: mode, wallets: manager.getWallets().map((wallet) => wallet.id) });
}

bootstrap().catch((error) => {
  connectButton.disabled = false;
  log("bootstrap_error", { message: error instanceof Error ? error.message : String(error) });
});

function renderSession() {
  const current = manager.getSession();
  session.textContent = current ? JSON.stringify(current, null, 2) : "No wallet connected.";
  connectButton.textContent = current ? "Connected" : "Connect Wallet";
}

function renderWallets() {
  walletsList.innerHTML = manager.getWallets().map((wallet) => {
    const icon = wallet.icon
      ? `<img class="wallet-icon" src="${escapeHtml(wallet.icon)}" alt="">`
      : `<span class="wallet-icon wallet-icon-fallback">${escapeHtml(wallet.name.slice(0, 1).toUpperCase())}</span>`;

    return `<div class="wallet-row">
      ${icon}
      <div class="wallet-info">
        <strong>${escapeHtml(wallet.name)}</strong>
        <span>${escapeHtml(wallet.group ?? wallet.type)} &middot; ${escapeHtml(wallet.id)}</span>
      </div>
    </div>`;
  }).join("");
}

function getWalletUiOptions() {
  return {
    layout: uiLayout.value as WalletUiLayout,
    presentation: getWalletUiPresentation(),
    themeMode: uiTheme.value as WalletUiThemeMode,
    size: "default" as const,
    textSize: "sm" as const,
    showWalletGroup: true,
    theme: {
      accent: "#0078ae",
      radius: "14px",
      walletRadius: "10px",
      fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      shadow: "none"
    }
  };
}

function getWalletConnectMode(): WalletConnectMode {
  const value = walletConnectMode.value;
  if (value === "list" || value === "group") return value;
  return "default";
}

function getWalletUiPresentation(): WalletUiPresentation {
  return getWalletConnectMode() === "group" ? "grouped" : "flat";
}

function log(name: string, payload: unknown) {
  events.textContent = `${new Date().toLocaleTimeString()} ${name} ${JSON.stringify(payload)}\n${events.textContent}`;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  })[char] ?? char);
}
