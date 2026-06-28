import type { WalletButtonConfig, WalletUiConfig, WalletUiOptions } from "./types";
import { resolveWalletUiMessages } from "./locales";
import { resolveWalletTheme } from "./themes";
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
    themeName,
    language,
    messages,
    transactionPreview
  } = overrides;
  const resolvedMessages = resolveWalletUiMessages(language, messages);
  const walletConnectUiMode = walletConnect?.mode ?? overrides.walletConnectUiMode ?? "default";
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
    showWalletGroup: walletList?.showGroup ?? overrides.showWalletGroup ?? false,
    themeName,
    theme: {
      ...resolveWalletTheme({ mode: mode ?? overrides.themeMode ?? "light", themeName }),
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
  const { accountPanelMode: overrideAccountPanelMode, ...restOverrides } = overrides;
  const theme = {
    ...resolveWalletTheme({ mode: ui.mode ?? overrides.themeMode ?? "light", themeName: ui.themeName }),
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
    copyAddress: accountPanel.copyAddress,
    showAddressQr: accountPanel.showAddressQr,
    showRecentTransactions: accountPanel.showRecentTransactions,
    maxVisibleTransactions: accountPanel.maxVisibleTransactions,
    disconnect: accountPanel.disconnect,
    explorer: accountPanel.explorer,
    showWeb3Name: identity.enabled ?? true,
    fallbackToAddress: identity.fallbackToAddress,
    identityResolver: identity.resolver,
    themeMode: ui.mode,
    themeName: ui.themeName,
    ...restOverrides,
    accountPanelMode: overrideAccountPanelMode ?? accountPanel.mode ?? "modal",
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
    showRecentTransactions: false,
    maxVisibleTransactions: 5,
    fallbackToAddress: true,
    copyAddress: true,
    explorer: false,
    disconnect: true,
    accountPanel: true,
    accountPanelMode: "modal",
    themeMode: "light",
    ...rest,
    showAddressQr: rest.showAddressQr ?? true,
    language: rest.language ?? overrides.language,
    messages,
    label: rest.label ?? messages.connectWallet,
    theme: {
      ...resolveWalletTheme({ mode: rest.themeMode ?? "light", themeName: rest.themeName }),
      ...(theme ?? {})
    }
  };
}

