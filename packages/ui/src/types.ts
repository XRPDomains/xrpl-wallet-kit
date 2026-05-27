import type { WalletManager, WalletNetwork, WalletSession } from "@xrpl-wallet-kit/core";
import type { WalletUiLocale, WalletUiMessagesInput } from "./locales";
export type WalletUiLayout = "list" | "card" | "grid" | "icon";
export type WalletUiSize = "compact" | "default" | "wide";
export type WalletUiThemeMode = "light" | "dark" | "auto";
export type WalletUiTextSize = "sm" | "md" | "lg";
export type WalletUiThemeName = "default" | "minimal" | "rounded" | "compact" | (string & {});
export type WalletConnectUiMode = "default" | "list" | "group";
export type WalletConnectCta = "copy" | "open" | "both";
export type WalletQrStyle = "standard" | "dots";

export interface WalletUiTheme {
  accent?: string;
  background?: string;
  foreground?: string;
  muted?: string;
  border?: string;
  overlay?: string;
  surface?: string;
  surfaceHover?: string;
  shadow?: string;
  radius?: string;
  walletRadius?: string;
  fontFamily?: string;
}

export interface WalletUiGroup {
  id: string;
  name: string;
  icon?: string;
  walletIds: string[];
  maxPreviewIcons?: number;
}

export interface WalletUiOptions {
  manager: WalletManager;
  mount?: HTMLElement;
  layout?: WalletUiLayout;
  size?: WalletUiSize;
  textSize?: WalletUiTextSize;
  walletConnectUiMode?: WalletConnectUiMode;
  themeMode?: WalletUiThemeMode;
  theme?: WalletUiTheme;
  wallets?: string[];
  groups?: WalletUiGroup[];
  title?: string;
  footerText?: string;
  language?: WalletUiLocale;
  messages?: WalletUiMessagesInput;
  transactionPreview?: WalletTransactionPreviewResolver;
  showWalletGroup?: boolean;
}

export type WalletButtonTarget = string | HTMLElement;
export type WalletButtonSize = "sm" | "md" | "lg";
export type WalletButtonVariant = "default" | "pill" | "minimal" | "outline";
export type WalletAccountPanelMode = "dropdown" | "modal";

export interface WalletIdentity {
  name: string;
  source?: string;
  avatar?: string;
  verified?: boolean;
}

export type WalletIdentityResolver = (address: string, session: WalletSession) => Promise<WalletIdentity | string | null>;

export interface WalletBalance {
  value: string;
  formatted: string;
  symbol: string;
  activationStatus?: "active" | "unfunded" | "unknown";
  available?: string;
  availableFormatted?: string;
  total?: string;
  totalFormatted?: string;
  reserve?: string;
  ownerCount?: number;
  raw?: unknown;
}

export type WalletBalanceResolver = (context: {
  address: string;
  network?: WalletNetwork;
  session: WalletSession;
}) => Promise<WalletBalance | string | number | null>;

export interface WalletModalController {
  open(): void;
  close(notify?: boolean, restoreFocus?: boolean): void;
  isOpen(): boolean;
  on(event: "open" | "close", handler: () => void): () => void;
  onClose(handler: () => void): () => void;
}

export interface WalletButtonOptions {
  manager: WalletManager;
  modal: WalletModalController;
  target?: WalletButtonTarget;
  label?: string;
  showAdapterIcon?: boolean;
  showChevron?: boolean;
  showWeb3Name?: boolean;
  fallbackToAddress?: boolean;
  copyAddress?: boolean;
  explorer?: boolean;
  disconnect?: boolean;
  accountPanel?: boolean;
  accountPanelMode?: WalletAccountPanelMode;
  showBalance?: boolean;
  size?: WalletButtonSize;
  variant?: WalletButtonVariant;
  themeMode?: WalletUiThemeMode;
  theme?: WalletUiTheme;
  language?: WalletUiLocale;
  messages?: WalletUiMessagesInput;
  identityResolver?: WalletIdentityResolver;
  balanceResolver?: WalletBalanceResolver;
  onIdentityChange?: (identity: WalletIdentity | null, session: WalletSession | null) => void;
  onBalanceChange?: (balance: WalletBalance | null, session: WalletSession | null) => void;
  explorerUrl?: (session: WalletSession) => string | undefined;
  formatAddress?: (address: string) => string;
}

export interface XrpDomainsResolverOptions {
  endpoint?: string;
  profileEndpoint?: string;
  timeoutMs?: number;
  cacheTtlMs?: number;
}

export interface WalletModalConfig {
  title?: string;
  width?: WalletUiSize;
  footerText?: string;
  autoOpen?: boolean;
}

export interface WalletListConfig {
  layout?: WalletUiLayout;
  wallets?: "all" | string[];
  groups?: WalletUiGroup[];
  showGroup?: boolean;
  showInstalledBadge?: boolean;
}

export interface WalletConnectQrConfig {
  style?: WalletQrStyle;
  showLogo?: boolean;
}

export interface WalletConnectUiConfig {
  mode?: WalletConnectUiMode;
  cta?: WalletConnectCta;
  qr?: WalletConnectQrConfig;
}

export interface WalletConnectButtonUiConfig {
  label?: string;
  size?: WalletButtonSize;
  variant?: WalletButtonVariant;
  accountStatus?: "full" | "address" | "icon";
  showBalance?: boolean;
  showAdapterIcon?: boolean;
  showChevron?: boolean;
}

export interface WalletTransactionPreview {
  summary: string;
  details?: Array<{ label: string; value: string }>;
  raw?: unknown;
}

export type WalletTransactionPreviewResolver = (txJson: unknown) => WalletTransactionPreview | null | Promise<WalletTransactionPreview | null>;

export interface WalletAccountPanelUiConfig {
  mode?: WalletAccountPanelMode;
  showAvatar?: boolean;
  copyAddress?: boolean;
  disconnect?: boolean;
  explorer?: boolean;
}

export interface WalletIdentityUiConfig {
  enabled?: boolean;
  fallbackToAddress?: boolean;
  resolver?: WalletIdentityResolver;
}

export interface WalletUiConfig {
  mode?: WalletUiThemeMode;
  themeName?: WalletUiThemeName;
  language?: WalletUiLocale;
  messages?: WalletUiMessagesInput;
  customTheme?: WalletUiTheme;
  modal?: WalletModalConfig;
  walletList?: WalletListConfig;
  walletConnect?: WalletConnectUiConfig;
  connectButton?: WalletConnectButtonUiConfig;
  accountPanel?: WalletAccountPanelUiConfig;
  identity?: WalletIdentityUiConfig;
  transactionPreview?: WalletTransactionPreviewResolver;
}

export type WalletButtonConfig = Partial<Omit<WalletButtonOptions, "manager" | "modal" | "target">>;

