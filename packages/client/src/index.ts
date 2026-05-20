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
import { createDefaultWalletButtonConfig, createDefaultWalletUiConfig, createWalletButton, createWalletModal } from "@xrpl-wallet-kit/ui";
import type {
  WalletButtonConfig,
  WalletButtonOptions,
  WalletButtonTarget,
  WalletUiConfig,
  WalletUiOptions,
  WalletUiPresentation,
  WalletUiSize
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

export type WalletConnectMode = "default" | "list" | "group";
export type ResponsiveValue<T> = T | { smallScreen?: T; largeScreen?: T };
export type WalletAccountStatus = "full" | "address" | "icon";

export interface WalletKitUiConfig extends WalletUiConfig {
  walletConnectMode?: WalletConnectMode;
  modalSize?: WalletUiSize;
}

export interface WalletKitConnectButtonConfig extends WalletButtonConfig {
  target?: WalletButtonTarget;
  accountStatus?: ResponsiveValue<WalletAccountStatus>;
  showBalance?: ResponsiveValue<boolean>;
}

export interface WalletKitIdentityConfig {
  web3Name?: boolean;
  xrpName?: boolean;
  fallbackToAddress?: boolean;
}

export interface CreateWalletClientOptions extends Omit<WalletManagerConfig, "adapters" | "storage"> {
  adapters?: WalletAdapter[];
  storage?: WalletManagerConfig["storage"] | "localStorage" | "memory";
  walletConnectProjectId?: string;
  xamanClientId?: string;
  wallets?: "all" | WalletKitAdapterId[];
  walletConnectMode?: WalletConnectMode;
}

export interface CreateWalletKitOptions extends CreateWalletClientOptions {
  ui?: WalletKitUiConfig;
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
  const buttonOptions = resolveButtonOptions(options);
  const button = modal && buttonOptions
    ? createWalletButton({
      manager,
      modal,
      ...buttonOptions
    })
    : undefined;

  if (modal && modalOptions.autoOpen) {
    modal.autoOpen();
  }

  return {
    manager,
    modal,
    button,
    openModal: () => modal?.open(),
    closeModal: () => modal?.close()
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
    const walletConnectMode = options.walletConnectMode ?? "group";
    adapters.push(...createWalletConnectAdapters({
      projectId: options.walletConnectProjectId,
      mode: walletConnectMode === "default" ? "default" : "details",
      wallets: resolveWalletConnectWallets(ids),
      metadata: createWalletConnectMetadata({
        name: options.appName,
        description: options.appDescription ?? `${options.appName} XRPL wallet connection`,
        url: options.appUrl ?? getCurrentOrigin(),
        icons: options.appIcons ?? []
      }),
      onQr,
      useModal: walletConnectMode === "default" ? true : undefined,
      modalMode: walletConnectMode === "default" ? "always" : undefined
    }));
  }

  return adapters;
}

function resolveStorage(storage: CreateWalletClientOptions["storage"]): WalletManagerConfig["storage"] | undefined {
  if (storage === "localStorage") return createBrowserWalletStorage();
  if (storage === "memory") return undefined;
  return storage;
}

function resolveModalOptions(options: CreateWalletKitOptions): { ui: WalletUiConfig; autoOpen: boolean } {
  const modalConfig = typeof options.modal === "object" ? options.modal : {};
  const { autoOpen = false, walletConnectMode, modalSize, ...modalUi } = modalConfig;
  const merged: WalletKitUiConfig = {
    ...options.ui,
    ...modalUi,
    walletConnectMode: options.ui?.walletConnectMode ?? walletConnectMode ?? options.walletConnectMode,
    modalSize: options.ui?.modalSize ?? modalSize
  };
  const { walletConnectMode: resolvedWalletConnectMode = "group", modalSize: resolvedModalSize, ...ui } = merged;

  return {
    autoOpen,
    ui: createDefaultWalletUiConfig({
      ...ui,
      size: ui.size ?? resolvedModalSize,
      presentation: ui.presentation ?? walletConnectPresentation(resolvedWalletConnectMode)
    })
  };
}

function resolveButtonOptions(options: CreateWalletKitOptions): (WalletButtonConfig & { target: WalletButtonTarget }) | undefined {
  if (!options.connectButton) return undefined;
  const raw = isConnectButtonTarget(options.connectButton)
    ? { target: options.connectButton }
    : options.connectButton;
  if (!raw.target) return undefined;
  const {
    accountStatus: _accountStatus,
    showBalance: _showBalance,
    target,
    ...buttonConfig
  } = raw;
  const identity = options.identity ?? {};

  return {
    target,
    ...createDefaultWalletButtonConfig({
      ...buttonConfig,
      showWeb3Name: buttonConfig.showWeb3Name ?? buttonConfig.showXrpName ?? identity.web3Name ?? identity.xrpName ?? true,
      fallbackToAddress: buttonConfig.fallbackToAddress ?? identity.fallbackToAddress ?? true
    })
  };
}

function walletConnectPresentation(mode: WalletConnectMode): WalletUiPresentation {
  return mode === "group" ? "grouped" : "flat";
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
    xamanClientId: _xamanClientId,
    wallets: _wallets,
    walletConnectMode: _walletConnectMode,
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
