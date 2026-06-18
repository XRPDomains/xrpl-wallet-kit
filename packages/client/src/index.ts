export * from "@xrpl-wallet-kit/core";
export * from "@xrpl-wallet-kit/adapter-crossmark";
export * from "@xrpl-wallet-kit/adapter-dropfi";
export * from "@xrpl-wallet-kit/adapter-gemwallet";
export * from "@xrpl-wallet-kit/adapter-ledger";
export * from "@xrpl-wallet-kit/adapter-walletconnect";
export * from "@xrpl-wallet-kit/adapter-xaman";
export * from "@xrpl-wallet-kit/adapter-xrpl-snap";
export * from "@xrpl-wallet-kit/ui";

import { WalletManager, createBrowserWalletStorage } from "@xrpl-wallet-kit/core";
import type { WalletAdapter, WalletManagerConfig } from "@xrpl-wallet-kit/core";
import { createCrossmarkAdapter } from "@xrpl-wallet-kit/adapter-crossmark";
import { createDropFiAdapter } from "@xrpl-wallet-kit/adapter-dropfi";
import { createGemWalletAdapter } from "@xrpl-wallet-kit/adapter-gemwallet";
import { createWalletConnectAdapters, createWalletConnectMetadata } from "@xrpl-wallet-kit/adapter-walletconnect";
import { createXamanAdapter } from "@xrpl-wallet-kit/adapter-xaman";
import { createXrplSnapAdapter } from "@xrpl-wallet-kit/adapter-xrpl-snap";
import { createDefaultWalletUiConfig, createWalletButton, createWalletModal, createWalletToast, resolveWalletButtonOptions as resolveUiWalletButtonOptions } from "@xrpl-wallet-kit/ui";
import type {
  WalletButtonConfig,
  WalletButtonTarget,
  WalletConnectUiMode,
  WalletToastConfig,
  WalletUiConfig,
  WalletUiOptions
} from "@xrpl-wallet-kit/ui";

export type WalletKitAdapterId =
  | "xaman"
  | "gemwallet"
  | "crossmark"
  | "dropfi"
  | "xrplsnap"
  | "staticbit"
  | "bitget"
  | "joey"
  | "girin"
  | "bifrost"
  | (string & {});

export type WalletConnectMode = WalletConnectUiMode;
export type ResponsiveValue<T> = T | { smallScreen?: T; largeScreen?: T };
export type WalletAccountStatus = "full" | "address" | "icon";

export type WalletKitUiConfig = WalletUiConfig;

export interface WalletKitConnectButtonConfig extends Omit<WalletButtonConfig, "accountPanelMode" | "showBalance"> {
  target?: WalletButtonTarget;
  accountStatus?: ResponsiveValue<WalletAccountStatus>;
  showBalance?: ResponsiveValue<boolean>;
}

export interface WalletKitIdentityConfig {
  web3Name?: boolean;
  fallbackToAddress?: boolean;
}

export interface CreateWalletClientOptions extends Omit<WalletManagerConfig, "adapters" | "storage"> {
  adapters?: WalletAdapter[];
  storage?: WalletManagerConfig["storage"] | "localStorage" | "memory";
  walletConnectProjectId?: string;
  walletConnectSignMessageDestination?: string;
  xamanClientId?: string;
  wallets?: "all" | WalletKitAdapterId[];
  ui?: WalletKitUiConfig;
}

export interface CreateWalletKitOptions extends CreateWalletClientOptions {
  identity?: WalletKitIdentityConfig;
  modal?: boolean | (WalletKitUiConfig & { autoOpen?: boolean });
  connectButton?: WalletButtonTarget | WalletKitConnectButtonConfig;
}

export function createWalletClient(options: CreateWalletClientOptions): WalletManager {
  let manager: WalletManager | undefined;
  const adapters = options.adapters ?? createDefaultAdapters(options, (event) => {
    manager?.emitQr(event.adapterId, event.uri, event.deeplink);
  });

  manager = new WalletManager({
    ...withoutKitOnlyOptions(options),
    adapters,
    storage: resolveStorage(options.storage)
  });

  return manager;
}

export function createWalletKit(options: CreateWalletKitOptions) {
  const manager = createWalletClient(options);
  const modalOptions = resolveModalOptions(options);
  const modal = options.modal === false ? undefined : createWalletModal({ manager, ...modalOptions.ui });
  const toastOptions = resolveToastOptions(options, modalOptions.ui);
  const toast = toastOptions ? createWalletToast({ manager, ...toastOptions }) : undefined;
  toast?.mount();
  const buttonOptions = resolveButtonOptions(options);
  const button = modal && buttonOptions
    ? createWalletButton({
      manager,
      modal,
      ...buttonOptions
    })
    : undefined;

  if (options.autoReconnect) {
    scheduleAutoReconnect(manager);
  }

  if (modal && modalOptions.autoOpen) {
    modal.autoOpen();
  }

  return {
    manager,
    modal,
    button,
    openModal: () => modal?.open(),
    closeModal: () => modal?.close(),
    disconnect: () => manager.disconnect(),
    toast,
    refreshIdentity: () => button?.refreshIdentity(),
    refreshBalance: () => button?.refreshBalance(),
    refreshAccount: () => button?.refreshAccount(),
    getSession: () => manager.getSession(),
    signAndSubmit: manager.signAndSubmit.bind(manager),
    signTransaction: manager.signTransaction.bind(manager),
    signMessage: manager.signMessage.bind(manager)
  };
}

function scheduleAutoReconnect(manager: WalletManager): void {
  const run = () => {
    const requestFrame = typeof globalThis.requestAnimationFrame === "function"
      ? globalThis.requestAnimationFrame.bind(globalThis)
      : (callback: FrameRequestCallback) => globalThis.setTimeout(() => callback(Date.now()), 16);
    requestFrame(() => { void manager.autoReconnect(); });
  };
  if (typeof window !== "undefined" && typeof document !== "undefined" && document.readyState !== "complete") {
    window.addEventListener("load", run, { once: true });
    return;
  }
  run();
}

function resolveToastOptions(options: CreateWalletKitOptions, modalUi: Partial<Omit<WalletUiOptions, "manager" | "mount">>): WalletToastConfig | undefined {
  const modalConfig = typeof options.modal === "object" ? options.modal : {};
  const raw = modalConfig.toast ?? options.ui?.toast;
  if (!raw) return undefined;
  const toast = raw === true ? {} : raw;
  return {
    language: modalUi.language,
    messages: modalUi.messages,
    themeMode: modalUi.themeMode,
    theme: modalUi.theme,
    ...toast
  };
}

function createDefaultAdapters(options: CreateWalletClientOptions, onQr: (event: { adapterId: string; uri: string; deeplink?: string }) => void): WalletAdapter[] {
  const ids = options.wallets === "all" || !options.wallets ? undefined : new Set<string>(options.wallets);
  const adapters: WalletAdapter[] = [];

  if (shouldInclude(ids, "xaman") && options.xamanClientId) {
    adapters.push(createXamanAdapter({ apiKey: options.xamanClientId, onQr }));
  }

  if (shouldInclude(ids, "gemwallet")) adapters.push(createGemWalletAdapter());
  if (shouldInclude(ids, "crossmark")) adapters.push(createCrossmarkAdapter());
  if (shouldInclude(ids, "dropfi")) adapters.push(createDropFiAdapter());
  if (shouldInclude(ids, "xrplsnap")) adapters.push(createXrplSnapAdapter());

  if (options.walletConnectProjectId && shouldIncludeWalletConnect(ids)) {
    const walletConnectUiMode = getWalletConnectUiMode(options);
    adapters.push(...createWalletConnectAdapters({
      projectId: options.walletConnectProjectId,
      mode: walletConnectUiMode === "default" ? "default" : "details",
      wallets: resolveWalletConnectWallets(ids),
      metadata: createWalletConnectMetadata({
        name: options.appName,
        description: options.appDescription ?? `${options.appName} XRPL wallet connection`,
        url: options.appUrl ?? getCurrentOrigin(),
        icons: options.appIcons ?? []
      }),
      onQr,
      signMessageDestination: options.walletConnectSignMessageDestination,
      useModal: walletConnectUiMode === "default" ? true : undefined,
      modalMode: walletConnectUiMode === "default" ? "always" : undefined
    }));
  }

  return adapters;
}

function resolveStorage(storage: CreateWalletClientOptions["storage"]): WalletManagerConfig["storage"] | undefined {
  if (storage === "localStorage") return createBrowserWalletStorage();
  if (storage === "memory") return undefined;
  return storage;
}

function resolveModalOptions(options: CreateWalletKitOptions): { ui: Partial<Omit<WalletUiOptions, "manager" | "mount">>; autoOpen: boolean } {
  const modalConfig = typeof options.modal === "object" ? options.modal : {};
  const { autoOpen = false, ...modalUi } = modalConfig;
  const modalWidth = options.ui?.modal?.width ?? modalConfig.modal?.width;
  const walletConnectModeValue = options.ui?.walletConnect?.mode
    ?? modalConfig.walletConnect?.mode
    ?? "group";
  const merged: WalletKitUiConfig = {
    ...options.ui,
    ...modalUi,
    modal: {
      ...options.ui?.modal,
      ...modalConfig.modal,
      ...(modalWidth ? { width: modalWidth } : {})
    },
    walletConnect: {
      ...options.ui?.walletConnect,
      ...modalConfig.walletConnect,
      mode: walletConnectModeValue
    }
  };

  return {
    autoOpen,
    ui: createDefaultWalletUiConfig(merged)
  };
}

function resolveButtonOptions(options: CreateWalletKitOptions): (WalletButtonConfig & { target: WalletButtonTarget }) | undefined {
  if (!options.connectButton) return undefined;
  const raw = isConnectButtonTarget(options.connectButton)
    ? { target: options.connectButton }
    : options.connectButton;
  const buttonInput = raw as WalletKitConnectButtonConfig & { accountPanelMode?: WalletButtonConfig["accountPanelMode"] };
  if (!buttonInput.target) return undefined;
  const {
    accountStatus: _accountStatus,
    accountPanelMode: _accountPanelMode,
    showBalance,
    target,
    ...buttonConfig
  } = buttonInput;
  const identity = options.identity ?? {};
  const modalConfig = typeof options.modal === "object" ? options.modal : {};
  const ui: WalletUiConfig = {
    ...options.ui,
    ...modalConfig,
    modal: {
      ...options.ui?.modal,
      ...modalConfig.modal
    },
    accountPanel: {
      ...options.ui?.accountPanel,
      ...modalConfig.accountPanel
    },
    connectButton: {
      ...options.ui?.connectButton,
      ...modalConfig.connectButton
    },
    identity: {
      ...options.ui?.identity,
      ...modalConfig.identity,
      enabled: options.ui?.identity?.enabled ?? modalConfig.identity?.enabled ?? identity.web3Name,
      fallbackToAddress: options.ui?.identity?.fallbackToAddress ?? modalConfig.identity?.fallbackToAddress ?? identity.fallbackToAddress
    }
  };

  const resolvedShowBalance = resolveResponsiveValue(showBalance);
  const resolvedButtonConfig = {
    ...buttonConfig,
    ...(resolvedShowBalance === undefined ? {} : { showBalance: resolvedShowBalance })
  };

  return {
    target,
    ...resolveUiWalletButtonOptions(ui, resolvedButtonConfig)
  };
}

function resolveResponsiveValue<T>(value: ResponsiveValue<T> | undefined): T | undefined {
  if (value == null || typeof value !== "object" || !("smallScreen" in value || "largeScreen" in value)) return value as T | undefined;
  const isSmallScreen = typeof window !== "undefined" && window.matchMedia?.("(max-width: 640px)").matches;
  return isSmallScreen ? value.smallScreen ?? value.largeScreen : value.largeScreen ?? value.smallScreen;
}

function getWalletConnectUiMode(options: Pick<CreateWalletClientOptions, "ui">): WalletConnectMode {
  return options.ui?.walletConnect?.mode ?? "group";
}

function shouldInclude(ids: Set<string> | undefined, id: string): boolean {
  return !ids || ids.has(id);
}

function shouldIncludeWalletConnect(ids: Set<string> | undefined): boolean {
  if (!ids) return true;
  return ids.has("walletconnect") || ["staticbit", "bitget", "joey", "girin", "bifrost"].some((id) => ids.has(id));
}

function resolveWalletConnectWallets(ids: Set<string> | undefined): "all" | string[] {
  if (!ids || ids.has("walletconnect")) return "all";
  const walletIds = ["staticbit", "bitget", "joey", "girin", "bifrost"].filter((id) => ids.has(id));
  return walletIds.length ? walletIds : "all";
}

function getCurrentOrigin(): string {
  return typeof window !== "undefined" ? window.location.origin : "https://xrpl.org";
}

function withoutKitOnlyOptions(options: CreateWalletClientOptions): WalletManagerConfig {
  const {
    adapters: _adapters,
    storage: _storage,
    walletConnectProjectId: _walletConnectProjectId,
    walletConnectSignMessageDestination: _walletConnectSignMessageDestination,
    xamanClientId: _xamanClientId,
    wallets: _wallets,
    ui: _ui,
    ...managerConfig
  } = options;
  return managerConfig;
}

export type XrplWalletKitAdapterId = WalletKitAdapterId;
export type CreateXrplWalletKitOptions = CreateWalletClientOptions;
export const createXrplWalletKit = createWalletClient;

function isConnectButtonTarget(value: CreateWalletKitOptions["connectButton"]): value is WalletButtonTarget {
  if (typeof value === "string") return true;
  return typeof HTMLElement !== "undefined" && value instanceof HTMLElement;
}
