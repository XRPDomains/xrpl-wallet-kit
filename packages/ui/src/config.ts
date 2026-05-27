import type { WalletButtonConfig, WalletUiConfig, WalletUiOptions } from "./types";
import { resolveWalletUiMessages } from "./locales";
import { defaultFontFamily } from "./themes";
export function resolveWalletUiOptions(overrides: (WalletUiConfig & Partial<Omit<WalletUiOptions, "manager" | "mount">>) = {}): Partial<Omit<WalletUiOptions, "manager" | "mount">> {
  const {
    mode,
    customTheme,
    modal,
    walletList,
    walletConnect,
    connectButton: _connectButton,
    accountPanel: _accountPanel,
    identity: _identity,
    themeName: _themeName,
    language,
    messages,
    transactionPreview
  } = overrides;
  const resolvedMessages = resolveWalletUiMessages(language, messages);
  const walletConnectUiMode = walletConnect?.mode ?? overrides.walletConnectUiMode;
  const wallets = walletList?.wallets === "all" ? undefined : walletList?.wallets;

  return {
    layout: walletList?.layout ?? overrides.layout ?? "list",
    walletConnectUiMode,
    themeMode: mode ?? overrides.themeMode ?? "light",
    size: modal?.width ?? overrides.size ?? "default",
    textSize: overrides.textSize ?? "sm",
    wallets: wallets ?? overrides.wallets,
    groups: walletList?.groups ?? overrides.groups,
    language,
    messages: resolvedMessages,
    transactionPreview,
    title: modal?.title ?? overrides.title ?? resolvedMessages.connectWallet,
    footerText: modal?.footerText ?? overrides.footerText ?? "XRPL Wallet Kit",
    showWalletGroup: walletList?.showGroup ?? overrides.showWalletGroup ?? true,
    theme: {
      accent: "#0078ae",
      radius: "14px",
      walletRadius: "10px",
      fontFamily: defaultFontFamily,
      shadow: "none",
      ...(overrides.theme ?? {}),
      ...(customTheme ?? {})
    }
  };
}
export function createDefaultWalletUiConfig(overrides: WalletUiConfig = {}): Partial<Omit<WalletUiOptions, "manager" | "mount">> {
  return resolveWalletUiOptions(overrides);
}

export function resolveWalletButtonOptions(ui: WalletUiConfig = {}, overrides: WalletButtonConfig = {}): WalletButtonConfig {
  const connectButton = ui.connectButton ?? {};
  const accountPanel = ui.accountPanel ?? {};
  const identity = ui.identity ?? {};
  const theme = {
    accent: "#0078ae",
    radius: "14px",
    walletRadius: "10px",
    fontFamily: defaultFontFamily,
    shadow: "none",
    ...(ui.customTheme ?? {}),
    ...(overrides.theme ?? {})
  };

  return createDefaultWalletButtonConfig({
    language: ui.language,
    messages: resolveWalletUiMessages(ui.language, ui.messages),
    label: connectButton.label,
    showAdapterIcon: connectButton.showAdapterIcon,
    showChevron: connectButton.showChevron,
    showBalance: connectButton.showBalance,
    size: connectButton.size,
    variant: connectButton.variant,
    accountPanelMode: accountPanel.mode,
    copyAddress: accountPanel.copyAddress,
    disconnect: accountPanel.disconnect,
    explorer: accountPanel.explorer,
    showWeb3Name: identity.enabled ?? true,
    fallbackToAddress: identity.fallbackToAddress,
    identityResolver: identity.resolver,
    themeMode: ui.mode,
    ...overrides,
    theme
  });
}

export function createDefaultWalletButtonConfig(overrides: WalletButtonConfig = {}): WalletButtonConfig {
  const { theme, ...rest } = overrides;
  const messages = resolveWalletUiMessages(overrides.language, overrides.messages);
  return {
    showWeb3Name: true,
    showAdapterIcon: true,
    showChevron: true,
    showBalance: false,
    fallbackToAddress: true,
    copyAddress: true,
    explorer: false,
    disconnect: true,
    accountPanel: true,
    accountPanelMode: "modal",
    themeMode: "light",
    ...rest,
    language: rest.language ?? overrides.language,
    messages,
    label: rest.label ?? messages.connectWallet,
    theme: {
      accent: "#0078ae",
      radius: "14px",
      walletRadius: "10px",
      fontFamily: defaultFontFamily,
      shadow: "none",
      ...(theme ?? {})
    }
  };
}

