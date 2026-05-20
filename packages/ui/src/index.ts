import QRCodeStyling from "qr-code-styling";
import QRCode from "qrcode";
import type { WalletAvailabilityMap, WalletManager, WalletMetadata, WalletSession } from "@xrpl-wallet-kit/core";

export type WalletUiLayout = "list" | "card" | "grid" | "icon";
export type WalletUiSize = "compact" | "default" | "wide";
export type WalletUiThemeMode = "light" | "dark" | "auto";
export type WalletUiTextSize = "sm" | "md" | "lg";
export type WalletUiPresentation = "flat" | "grouped";

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
  presentation?: WalletUiPresentation;
  themeMode?: WalletUiThemeMode;
  theme?: WalletUiTheme;
  wallets?: string[];
  groups?: WalletUiGroup[];
  title?: string;
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

export interface WalletButtonOptions {
  manager: WalletManager;
  modal: WalletModal;
  target?: WalletButtonTarget;
  label?: string;
  showAdapterIcon?: boolean;
  showChevron?: boolean;
  showWeb3Name?: boolean;
  showXrpName?: boolean;
  fallbackToAddress?: boolean;
  copyAddress?: boolean;
  explorer?: boolean;
  disconnect?: boolean;
  accountPanel?: boolean;
  accountPanelMode?: WalletAccountPanelMode;
  size?: WalletButtonSize;
  variant?: WalletButtonVariant;
  themeMode?: WalletUiThemeMode;
  theme?: WalletUiTheme;
  identityResolver?: WalletIdentityResolver;
  explorerUrl?: (session: WalletSession) => string | undefined;
  formatAddress?: (address: string) => string;
}

export interface XrpDomainsResolverOptions {
  endpoint?: string;
  profileEndpoint?: string;
  timeoutMs?: number;
  cacheTtlMs?: number;
}

export type WalletUiConfig = Partial<Omit<WalletUiOptions, "manager" | "mount">>;
export type WalletButtonConfig = Partial<Omit<WalletButtonOptions, "manager" | "modal" | "target">>;

type ResolvedTheme = Required<WalletUiTheme>;

const QR_SIZE = 304;
const QR_DARK = "#111827";
const QR_LIGHT = "#ffffff";
const WALLETCONNECT_GROUP_ICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='18' fill='%233396ff'/%3E%3Cpath d='M18.5 27.2c7.5-7.1 19.5-7.1 27 0l.9.9c.4.4.4 1 0 1.4l-3 2.9c-.4.4-.9.4-1.3 0l-1.2-1.1c-4.9-4.6-12.8-4.6-17.7 0l-1.2 1.1c-.4.4-.9.4-1.3 0l-3-2.9c-.4-.4-.4-1 0-1.4l.8-.9Zm33.2 6.1 2.7 2.6c.4.4.4 1 0 1.4L42 49.2c-.4.4-1 .4-1.4 0L32.5 41c-.3-.3-.7-.3-1 0l-8.1 8.2c-.4.4-1 .4-1.4 0L9.6 37.3c-.4-.4-.4-1 0-1.4l2.7-2.6c.4-.4 1-.4 1.4 0l8.1 7.8c.3.3.7.3 1 0l8.1-7.8c.4-.4 1-.4 1.4 0l8.1 7.8c.3.3.7.3 1 0l8.1-7.8c.2-.2.5-.3.7-.3s.5.1.7.3Z' fill='white'/%3E%3C/svg%3E";
const DEFAULT_WALLET_ICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='18' fill='%23f1f5f9'/%3E%3Cpath d='M17 22.5c0-3 2.4-5.5 5.5-5.5h24c2.5 0 4.5 2 4.5 4.5V25H22.5A5.5 5.5 0 0 1 17 19.5v3Z' fill='%23cbd5e1'/%3E%3Cpath d='M13 25.5c0-3 2.4-5.5 5.5-5.5h28c3 0 5.5 2.4 5.5 5.5v17c0 3-2.4 5.5-5.5 5.5h-28c-3 0-5.5-2.4-5.5-5.5v-17Z' fill='%23ffffff' stroke='%2394a3b8' stroke-width='2'/%3E%3Cpath d='M42 34a4 4 0 1 0 0 8h10v-8H42Z' fill='%23e2e8f0' stroke='%2394a3b8' stroke-width='2'/%3E%3Ccircle cx='42' cy='38' r='1.8' fill='%2364748b'/%3E%3C/svg%3E";

const lightTheme: ResolvedTheme = {
  accent: "#0078ae",
  background: "#ffffff",
  foreground: "#111827",
  muted: "#64748b",
  border: "#e5e7eb",
  overlay: "rgba(15,23,42,.46)",
  surface: "#f8fafc",
  surfaceHover: "#f1f5f9",
  shadow: "none",
  radius: "14px",
  walletRadius: "10px",
  fontFamily: "Inter, system-ui, sans-serif"
};

const darkTheme: ResolvedTheme = {
  accent: "#4aa3ff",
  background: "#111827",
  foreground: "#f8fafc",
  muted: "#94a3b8",
  border: "#334155",
  overlay: "rgba(2,6,23,.72)",
  surface: "#1f2937",
  surfaceHover: "#263244",
  shadow: "none",
  radius: "14px",
  walletRadius: "10px",
  fontFamily: "Inter, system-ui, sans-serif"
};

const defaultFontFamily = "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

export const walletUiThemes = {
  light: (overrides: WalletUiTheme = {}): WalletUiTheme => ({ ...lightTheme, ...overrides }),
  dark: (overrides: WalletUiTheme = {}): WalletUiTheme => ({ ...darkTheme, ...overrides }),
  xrpl: (overrides: WalletUiTheme = {}): WalletUiTheme => ({
    ...lightTheme,
    accent: "#0078ae",
    radius: "12px",
    walletRadius: "10px",
    ...overrides
  }),
  minimal: (overrides: WalletUiTheme = {}): WalletUiTheme => ({
    ...lightTheme,
    background: "#ffffff",
    surface: "#ffffff",
    border: "#d7dee8",
    radius: "8px",
    walletRadius: "8px",
    shadow: "none",
    ...overrides
  })
};

export function createDefaultWalletUiConfig(overrides: WalletUiConfig = {}): WalletUiConfig {
  const { theme, ...rest } = overrides;
  return {
    layout: "list",
    presentation: "flat",
    themeMode: "light",
    size: "default",
    textSize: "sm",
    showWalletGroup: true,
    ...rest,
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

export function createDefaultWalletButtonConfig(overrides: WalletButtonConfig = {}): WalletButtonConfig {
  const { theme, ...rest } = overrides;
  return {
    showWeb3Name: true,
    showAdapterIcon: true,
    showChevron: true,
    fallbackToAddress: true,
    copyAddress: true,
    explorer: false,
    disconnect: true,
    accountPanel: true,
    accountPanelMode: "dropdown",
    themeMode: "light",
    ...rest,
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

export class WalletModal {
  private root?: HTMLElement;
  private qrUri = "";
  private pendingQr?: { adapterId: string; uri: string; deeplink?: string };
  private options: WalletUiOptions;
  private availability: WalletAvailabilityMap = {};
  private activeGroupId?: string;
  private readonly offEvents: Array<() => void> = [];
  private readonly closeHandlers = new Set<() => void>();

  constructor(options: WalletUiOptions) {
    this.options = { layout: "list", presentation: "flat", size: "default", textSize: "sm", themeMode: "light", title: "Connect Wallet", ...options };
    this.offEvents.push(
      options.manager.on("qr", ({ adapterId, uri, deeplink }) => this.showQr(adapterId, uri, deeplink)),
      options.manager.on("connecting", ({ adapterId }) => this.setLoading(adapterId)),
      options.manager.on("connected", () => this.close(false)),
      options.manager.on("error", ({ error }) => this.setError(error))
    );
  }

  autoOpen(): void {
    this.open();
  }

  open(): void {
    this.activeGroupId = undefined;
    this.mount("list");
    void this.refreshAvailability();
    if (this.pendingQr) {
      const { adapterId, uri, deeplink } = this.pendingQr;
      this.pendingQr = undefined;
      this.showQr(adapterId, uri, deeplink);
    }
  }

  close(notify = true): void {
    this.root?.remove();
    this.root = undefined;
    if (notify) this.closeHandlers.forEach((handler) => handler());
  }

  destroy(): void {
    this.close(false);
    this.offEvents.splice(0).forEach((off) => off());
    this.closeHandlers.clear();
  }

  onClose(handler: () => void): () => void {
    this.closeHandlers.add(handler);
    return () => this.closeHandlers.delete(handler);
  }

  updateOptions(options: Partial<Omit<WalletUiOptions, "manager" | "mount">>): void {
    this.options = { ...this.options, ...options };
    this.activeGroupId = undefined;
  }

  private bind(): void {
    this.root?.querySelector("[data-xwk-close]")?.addEventListener("click", () => this.close());
    this.root?.querySelector("[data-xwk-back]")?.addEventListener("click", () => this.showList());
    this.root?.querySelector("[data-xwk-copy]")?.addEventListener("click", async () => {
      if (this.qrUri) await navigator.clipboard.writeText(this.qrUri);
    });
    this.bindGroupButtons();
    this.bindWalletButtons();
  }

  private bindGroupButtons(): void {
    this.root?.querySelectorAll<HTMLElement>("[data-wallet-group-id]").forEach((button) => button.addEventListener("click", () => {
      const id = button.dataset.walletGroupId;
      if (id) this.showWalletGroup(id);
    }));
  }

  private bindWalletButtons(): void {
    this.root?.querySelectorAll<HTMLElement>("[data-wallet-id]").forEach((button) => button.addEventListener("click", async () => {
      const id = button.dataset.walletId;
      if (!id) return;
      try {
        this.setLoading(id);
        await this.waitForPaint();
        await this.options.manager.connect(id);
      } catch {
        // WalletManager emits the detailed error event; this catch keeps the click handler settled.
      }
    }));
  }

  private bindChrome(): void {
    this.root?.querySelector("[data-xwk-close]")?.addEventListener("click", () => this.close());
    this.root?.querySelector("[data-xwk-back]")?.addEventListener("click", () => this.showList());
    this.root?.querySelector("[data-xwk-copy]")?.addEventListener("click", async () => {
      if (this.qrUri) await navigator.clipboard.writeText(this.qrUri);
    });
  }

  private mount(view: "list" | "connect" | "qr"): void {
    this.close(false);
    this.removeExistingOverlays();
    this.root = document.createElement("div");
    this.root.className = "xwk-overlay";
    this.root.dataset.xwkView = view;
    this.root.innerHTML = this.renderShell();
    (this.options.mount ?? document.body).appendChild(this.root);
    this.bind();
  }

  private ensureMounted(view: "list" | "connect" | "qr"): void {
    if (!this.root?.isConnected || !this.root.querySelector(".xwk-modal")) {
      this.mount(view);
      return;
    }
    this.setView(view);
  }

  private setView(view: "list" | "connect" | "qr"): void {
    if (this.root) this.root.dataset.xwkView = view;
  }

  private removeExistingOverlays(): void {
    const mount = this.options.mount ?? document.body;
    mount.querySelectorAll(".xwk-overlay").forEach((element) => element.remove());
  }

  private getGroups(): WalletUiGroup[] {
    if (this.options.presentation !== "grouped") return [];
    if (this.options.groups?.length) return this.options.groups;

    const walletConnectIds = this.getWallets()
      .filter((wallet) => wallet.group === "WalletConnect")
      .map((wallet) => wallet.id);

    return walletConnectIds.length
      ? [{ id: "walletconnect", name: "WalletConnect", icon: WALLETCONNECT_GROUP_ICON, walletIds: walletConnectIds, maxPreviewIcons: 5 }]
      : [];
  }

  private getWallets(): WalletMetadata[] {
    const wallets = this.options.manager.getWallets();
    const walletOrder = this.options.wallets;
    if (!walletOrder?.length) return wallets;

    const byId = new Map(wallets.map((wallet) => [wallet.id, wallet]));
    return walletOrder
      .map((id) => byId.get(id))
      .filter((wallet): wallet is WalletMetadata => Boolean(wallet));
  }

  private getGroupWallets(group: WalletUiGroup): WalletMetadata[] {
    const byId = new Map(this.getWallets().map((wallet) => [wallet.id, wallet]));
    return group.walletIds
      .map((id) => byId.get(id))
      .filter((wallet): wallet is WalletMetadata => Boolean(wallet));
  }

  private getUngroupedWallets(groups: WalletUiGroup[]): WalletMetadata[] {
    const groupedIds = new Set(groups.flatMap((group) => group.walletIds));
    return this.getWallets().filter((wallet) => !groupedIds.has(wallet.id));
  }

  private async refreshAvailability(): Promise<void> {
    this.availability = await this.options.manager.getWalletAvailability();
    if (this.root?.dataset.xwkView !== "list") return;

    const grid = this.root.querySelector(".xwk-grid");
    if (!grid) return;
    const layout = this.options.layout ?? "list";
    const activeGroup = this.activeGroupId ? this.getGroups().find((group) => group.id === this.activeGroupId) : undefined;
    grid.innerHTML = activeGroup
      ? this.getGroupWallets(activeGroup).map((wallet) => this.renderWallet(wallet, layout)).join("")
      : this.renderWalletList(layout);
    this.bindGroupButtons();
    this.bindWalletButtons();
  }

  private showList(): void {
    this.activeGroupId = undefined;
    if (!this.root?.querySelector(".xwk-list")) {
      this.mount("list");
      return;
    }
    this.ensureMounted("list");
    this.root?.querySelector(".xwk-list")?.classList.remove("xwk-hidden");
    this.root?.querySelector(".xwk-qr")?.classList.add("xwk-hidden");
    this.root?.querySelector(".xwk-connect")?.classList.add("xwk-hidden");
    this.root?.querySelector("[data-xwk-back]")?.classList.add("xwk-hidden");
    const title = this.root?.querySelector(".xwk-title");
    if (title) title.textContent = this.options.title ?? "Connect Wallet";
    const grid = this.root?.querySelector(".xwk-grid");
    if (grid) grid.innerHTML = this.renderWalletList(this.options.layout ?? "list");
    this.bindGroupButtons();
    this.bindWalletButtons();
  }

  private showWalletGroup(groupId: string): void {
    const group = this.getGroups().find((item) => item.id === groupId);
    if (!group || !this.root) return;

    this.activeGroupId = groupId;
    this.ensureMounted("list");
    this.root.querySelector(".xwk-list")?.classList.remove("xwk-hidden");
    this.root.querySelector(".xwk-qr")?.classList.add("xwk-hidden");
    this.root.querySelector(".xwk-connect")?.classList.add("xwk-hidden");
    this.root.querySelector("[data-xwk-back]")?.classList.remove("xwk-hidden");
    const title = this.root.querySelector(".xwk-title");
    if (title) title.textContent = group.name;
    const grid = this.root.querySelector(".xwk-grid");
    if (grid) grid.innerHTML = this.getGroupWallets(group).map((wallet) => this.renderWallet(wallet, this.options.layout ?? "list")).join("");
    this.bindWalletButtons();
  }

  private showQr(adapterId: string, uri: string, deeplink?: string): void {
    if (!this.root) {
      this.pendingQr = { adapterId, uri, deeplink };
      return;
    }
    this.qrUri = uri;
    const wallet = this.options.manager.getWallets().find((item) => item.id === adapterId);
    this.renderQrShell(wallet?.name ?? "WalletConnect", deeplink);
    const code = this.root?.querySelector(".xwk-qr-code");
    if (code instanceof HTMLElement) void this.renderQr(code, uri);
  }

  private setLoading(adapterId: string): void {
    const wallet = this.options.manager.getWallets().find((item) => item.id === adapterId);
    const adapter = this.options.manager.getAdapter(adapterId);

    if (adapter?.capabilities.qr && wallet?.group === "WalletConnect") {
      this.qrUri = "";
      this.renderQrShell(wallet?.name ?? adapterId);
      return;
    }

    this.renderConnectShell(wallet, adapterId);
  }

  private setError(error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);
    const status = this.root?.querySelector(".xwk-status");
    if (status) status.textContent = message;
    const connectStatus = this.root?.querySelector(".xwk-connect-status");
    if (connectStatus) connectStatus.textContent = message;
    const qrLoading = this.root?.querySelector(".xwk-qr-loading");
    if (qrLoading) qrLoading.textContent = message;
  }

  private renderShell(): string {
    const theme = this.resolveTheme();
    const layout = this.options.layout ?? "list";
    const size = this.options.size ?? "default";
    const textSize = this.options.textSize ?? "sm";

    return `<style>${this.renderStyles(theme, layout, size, textSize)}</style><section class="xwk-modal xwk-layout-${layout}" role="dialog" aria-modal="true"><div class="xwk-header"><button class="xwk-back xwk-hidden" data-xwk-back aria-label="Back">${this.backIcon()}</button><div class="xwk-title">${this.escapeHtml(this.options.title ?? "Connect Wallet")}</div><button class="xwk-close" data-xwk-close aria-label="Close">&times;</button></div><div class="xwk-body"><div class="xwk-list"><div class="xwk-grid">${this.renderWalletList(layout)}</div><div class="xwk-status"></div></div><div class="xwk-connect xwk-hidden"><div class="xwk-spinner"><div class="xwk-connect-icon"></div></div><strong class="xwk-connect-name"></strong><p class="xwk-connect-status">Click connect in your wallet popup.</p></div><div class="xwk-qr xwk-hidden"><h3 class="xwk-qr-title"></h3><div class="xwk-qr-code">${this.renderQrLoading()}</div><p class="xwk-qr-help">Scan this QR code from your mobile wallet or phone camera to connect.</p><div class="xwk-actions"><button class="xwk-action" data-xwk-copy>${this.linkIcon()} Copy QR URI</button><a class="xwk-action xwk-action-primary" data-xwk-open>Open Wallet</a></div></div></div><div class="xwk-footer">XRPL Wallet Kit</div></section>`;
  }

  private renderQrShell(walletName: string, deeplink?: string): void {
    const theme = this.resolveTheme();
    const layout = this.options.layout ?? "list";
    const size = this.options.size ?? "default";
    const textSize = this.options.textSize ?? "sm";
    const openAction = deeplink ? `<a class="xwk-action xwk-action-primary" data-xwk-open href="${this.escapeHtml(deeplink)}">Open Wallet</a>` : "";

    if (!this.root?.isConnected) {
      this.mount("qr");
    }

    if (!this.root) return;
    this.root.dataset.xwkView = "qr";
    this.root.innerHTML = `<style>${this.renderStyles(theme, layout, size, textSize)}</style><section class="xwk-modal xwk-qr-modal" role="dialog" aria-modal="true"><div class="xwk-header"><button class="xwk-back" data-xwk-back aria-label="Back">${this.backIcon()}</button><div class="xwk-title">${this.escapeHtml(walletName)}</div><button class="xwk-close" data-xwk-close aria-label="Close">&times;</button></div><div class="xwk-body"><div class="xwk-qr xwk-standalone-qr"><div class="xwk-qr-card"><div class="xwk-qr-code">${this.renderQrLoading()}</div><div class="xwk-qr-card-actions ${openAction ? "xwk-qr-card-actions-dual" : ""}"><button class="xwk-action xwk-copy-inside" data-xwk-copy>${this.linkIcon()} Copy QR URI</button>${openAction}</div></div><p class="xwk-qr-help">Scan with your wallet app to connect.</p></div></div><div class="xwk-footer">XRPL Wallet Kit</div></section>`;
    this.bindChrome();
  }

  private renderQrLoading(): string {
    return `<span class="xwk-qr-loading"><span class="xwk-qr-loading-spinner"></span><span>Generating QR...</span></span>`;
  }

  private renderConnectShell(wallet: WalletMetadata | undefined, adapterId: string): void {
    const theme = this.resolveTheme();
    const layout = this.options.layout ?? "list";
    const size = this.options.size ?? "default";
    const textSize = this.options.textSize ?? "sm";
    const walletName = wallet?.name ?? adapterId;

    if (!this.root?.isConnected) {
      this.mount("connect");
    }

    if (!this.root) return;
    this.root.dataset.xwkView = "connect";
    this.root.innerHTML = `<style>${this.renderStyles(theme, layout, size, textSize)}</style><section class="xwk-modal xwk-connect-modal" role="dialog" aria-modal="true"><div class="xwk-header"><button class="xwk-back" data-xwk-back aria-label="Back">${this.backIcon()}</button><div class="xwk-title">Connect</div><button class="xwk-close" data-xwk-close aria-label="Close">&times;</button></div><div class="xwk-body"><div class="xwk-connect xwk-standalone-connect"><div class="xwk-spinner"><div class="xwk-connect-icon">${this.renderWalletIcon(wallet)}</div></div><strong class="xwk-connect-name">${this.escapeHtml(walletName)}</strong><p class="xwk-connect-status">Click connect in your ${this.escapeHtml(walletName)} popup.</p></div></div><div class="xwk-footer">XRPL Wallet Kit</div></section>`;
    this.bindChrome();
  }

  private renderStyles(theme: ResolvedTheme, layout: WalletUiLayout, size: WalletUiSize, textSize: WalletUiTextSize): string {
    const cardLayout = layout === "card" || layout === "grid";
    const width = size === "wide" ? "640px" : size === "compact" ? "400px" : "520px";
    const gridColumns = layout === "icon" ? "repeat(4,minmax(0,1fr))" : cardLayout ? "repeat(3,minmax(0,1fr))" : "1fr";
    const textAlign = layout === "list" ? "left" : "center";
    const walletDirection = layout === "list" ? "row" : "column";
    const walletMinHeight = layout === "icon" ? "78px" : cardLayout ? "100px" : "64px";
    const iconSize = layout === "icon" ? "38px" : cardLayout ? "42px" : "40px";
    const groupDisplay = layout === "icon" ? "none" : "block";
    const titleFontSize = textSize === "lg" ? "20px" : textSize === "md" ? "18px" : "16px";
    const nameFontSize = textSize === "lg" ? "17px" : textSize === "md" ? "16px" : "15px";
    const gridNameFontSize = textSize === "lg" ? "14px" : textSize === "md" ? "13px" : "12px";
    const groupFontSize = textSize === "lg" ? "12px" : "11px";
    const bodyFontSize = textSize === "lg" ? "16px" : textSize === "md" ? "15px" : "14px";
    const walletNameColor = this.resolveThemeMode() === "dark" ? theme.foreground : "#333333";
    const badgeColor = this.resolveThemeMode() === "dark" ? "#cbd5e1" : "#6b7280";
    const badgeBackground = this.resolveThemeMode() === "dark" ? "rgba(255,255,255,.08)" : "#f0f1f3";
    const badgeDot = this.resolveThemeMode() === "dark" ? "#94a3b8" : "#9ca3af";
    const miniIconBorder = this.resolveThemeMode() === "dark" ? "rgba(255,255,255,.12)" : "rgba(15,23,42,.08)";

    return `.xwk-overlay{position:fixed;inset:0;background:${theme.overlay};display:grid;place-items:center;z-index:2147483647;font-family:${theme.fontFamily};font-size:${bodyFontSize};padding:16px}.xwk-modal{display:block;width:min(${width},100%);background:${theme.background};border:1px solid ${theme.border};border-radius:${theme.radius};box-shadow:${theme.shadow};color:${theme.foreground};overflow:hidden}.xwk-header{display:grid;grid-template-columns:36px minmax(0,1fr) 36px;align-items:center;column-gap:8px;padding:10px 18px;border-bottom:1px solid ${theme.border}}.xwk-title{font-size:${titleFontSize};font-weight:500;text-align:center;color:${theme.foreground};min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.xwk-close,.xwk-back{align-items:center;border:0;background:transparent;border-radius:999px;box-shadow:none;color:${theme.muted};cursor:pointer;display:inline-flex;height:32px;justify-content:center;min-height:0;padding:0;transform:none;width:32px}.xwk-back{justify-self:start}.xwk-close{font-size:24px;font-weight:500;justify-self:end;line-height:1}.xwk-close:hover,.xwk-back:hover{background:${theme.surfaceHover};box-shadow:none;color:${theme.foreground};transform:none}.xwk-body{max-height:min(620px,calc(100vh - 120px));overflow:auto;padding:12px 22px 18px}.xwk-list,.xwk-connect,.xwk-qr{display:none}.xwk-overlay[data-xwk-view="list"] .xwk-list{display:block}.xwk-overlay[data-xwk-view="connect"] .xwk-connect{display:block}.xwk-overlay[data-xwk-view="qr"] .xwk-qr{display:block}.xwk-grid{display:grid;grid-template-columns:${gridColumns};gap:7px}.xwk-wallet{align-items:center;background:${theme.surface};border:0;border-radius:16px;box-shadow:none;color:${theme.foreground};cursor:pointer;display:flex;flex-direction:${walletDirection};gap:12px;justify-content:${layout === "list" ? "flex-start" : "center"};min-height:${walletMinHeight};min-width:0;padding:${layout === "list" ? "12px 12px" : "12px 10px"};text-align:${textAlign};transform:none;transition:background-color .16s ease;width:100%}.xwk-wallet:hover{background:${theme.surfaceHover};box-shadow:none;transform:none}.xwk-wallet:active{background:${theme.surfaceHover};transform:none}.xwk-wallet img:not(.xwk-mini-icon),.xwk-icon-fallback{border-radius:12px;flex:0 0 auto;height:${iconSize};object-fit:contain;overflow:hidden;width:${iconSize}}.xwk-icon-fallback{align-items:center;background:${theme.accent};color:#fff;display:inline-flex;font-weight:700;justify-content:center}.xwk-wallet-group{margin-top:${layout === "list" ? "8px" : "0"};min-height:${walletMinHeight}}.xwk-wallet-group .xwk-wallet-info{align-items:center;display:${layout === "list" ? "flex" : "grid"};gap:${layout === "list" ? "10px" : "2px"}}.xwk-wallet-group .xwk-name{flex:1 1 auto}.xwk-wallet-group .xwk-group{display:${layout === "list" ? "none" : groupDisplay}}.xwk-group-placeholder{visibility:hidden}.xwk-wallet-info{display:grid;gap:2px;min-width:0;width:100%}.xwk-name{color:${walletNameColor};display:block;font-size:${layout === "list" ? nameFontSize : gridNameFontSize};font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.xwk-group{color:${theme.muted};display:${groupDisplay};font-size:${groupFontSize};font-weight:400;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.xwk-group-icons{align-items:center;display:${layout === "list" ? "inline-flex" : "none"};flex:0 0 auto;gap:4px;justify-content:flex-end;margin-left:auto;min-width:0}.xwk-mini-icon,.xwk-mini-fallback,.xwk-mini-more{align-items:center;border:1px solid ${miniIconBorder};border-radius:10px;box-sizing:border-box;display:inline-flex;flex:0 0 auto;height:32px;justify-content:center;object-fit:cover;overflow:hidden;width:32px}.xwk-mini-fallback,.xwk-mini-more{background:${theme.background};color:${theme.muted};font-size:12px;font-weight:600}.xwk-mini-more{border-radius:999px;width:auto;min-width:32px;padding:0 8px}.xwk-wallet-badge{align-items:center;background:${badgeBackground};border-radius:999px;color:${badgeColor};display:inline-flex;flex:0 0 auto;font-size:11px;font-weight:500;gap:6px;line-height:1;margin-left:auto;min-height:24px;padding:0 10px;visibility:hidden}.xwk-wallet-badge:before{background:${badgeDot};border-radius:999px;content:"";height:6px;width:6px}.xwk-wallet-badge.xwk-installed{visibility:visible}.xwk-status{color:${theme.accent};font-size:12px;margin-top:12px;min-height:18px}.xwk-hidden{display:none}.xwk-back.xwk-hidden{display:inline-flex;pointer-events:none;visibility:hidden}.xwk-connect{text-align:center;padding:30px 0 16px}.xwk-spinner{display:grid;margin:0 auto 16px;place-items:center;position:relative;width:104px;height:104px}.xwk-spinner:before{animation:xwk-spin 1s linear infinite;border:3px solid transparent;border-top-color:#cbd5e1;border-right-color:#e5e7eb;border-radius:50%;content:"";height:96px;position:absolute;width:96px}.xwk-connect-icon img,.xwk-connect-icon .xwk-icon-fallback{border-radius:16px;height:66px;object-fit:contain;overflow:hidden;width:66px}.xwk-connect-name{display:block;font-size:${nameFontSize};font-weight:600;margin-top:4px}.xwk-connect-status{color:${theme.muted};font-size:${bodyFontSize};font-weight:400;line-height:1.45;margin:14px auto 0;max-width:420px}.xwk-qr{text-align:center}.xwk-qr-title{color:${theme.foreground};font-size:${titleFontSize};font-weight:500;margin:0 0 14px}.xwk-qr-card{background:${theme.surface};border:1px solid ${theme.border};border-radius:14px;box-sizing:border-box;margin:0 auto 10px;padding:12px;width:min(332px,100%)}.xwk-qr-code{aspect-ratio:1/1;background:transparent;border:0;border-radius:10px;box-sizing:border-box;color:#64748b;display:grid;margin:0 auto 10px;padding:0;place-items:center;width:100%}.xwk-qr-code canvas,.xwk-qr-code img,.xwk-qr-code svg{aspect-ratio:1/1;display:block;height:auto;max-width:100%;width:100%}.xwk-qr-loading{align-items:center;color:#64748b;display:inline-flex;font-size:13px;gap:8px}.xwk-qr-loading-spinner{animation:xwk-spin 1s linear infinite;border:2px solid #e5e7eb;border-top-color:#cbd5e1;border-radius:999px;display:inline-block;height:18px;width:18px}.xwk-qr-help{color:${theme.muted};font-size:${bodyFontSize};font-weight:400;line-height:1.35;margin:10px auto 0;max-width:420px;white-space:nowrap}.xwk-qr-fallback{color:#334155;font-size:11px;line-height:1.5;overflow-wrap:anywhere}.xwk-actions{display:grid;gap:10px;grid-template-columns:1fr 1fr;margin-top:14px}.xwk-qr-card-actions{display:grid;gap:10px;grid-template-columns:1fr}.xwk-qr-card-actions-dual{grid-template-columns:1fr 1fr}.xwk-action{align-items:center;background:${theme.background};border:1px solid ${theme.border};border-radius:${theme.walletRadius};box-shadow:none;color:${theme.foreground};cursor:pointer;display:inline-flex;font:inherit;font-size:${bodyFontSize};font-weight:600;gap:8px;justify-content:center;min-height:44px;padding:10px 12px;text-decoration:none;transform:none}.xwk-copy-inside{background:${theme.background};border-color:${theme.border};color:${theme.foreground};font-size:${textSize === "lg" ? "17px" : textSize === "md" ? "16px" : "15px"};width:100%}.xwk-action:hover{background:${theme.surfaceHover};transform:none}.xwk-copy-inside:hover{background:${theme.surfaceHover}}.xwk-action-primary{background:${theme.accent};border-color:${theme.accent};color:#fff}.xwk-action-primary:hover{background:${theme.accent};color:#fff}.xwk-footer{border-top:0;color:${theme.muted};font-size:10px;font-weight:300;padding:12px 16px 14px;text-align:center}@keyframes xwk-spin{to{transform:rotate(360deg)}}@media(max-width:640px){.xwk-overlay{padding:12px}.xwk-modal{max-height:calc(100vh - 24px)}.xwk-header{grid-template-columns:40px minmax(0,1fr) 40px;column-gap:8px;padding:16px 18px}.xwk-body{max-height:calc(100vh - 120px);padding:16px 18px 18px}.xwk-grid{grid-template-columns:${layout === "icon" ? "repeat(3,minmax(0,1fr))" : "1fr"}}.xwk-actions,.xwk-qr-card-actions-dual{grid-template-columns:1fr}.xwk-qr-card{padding:12px;width:100%}.xwk-qr-code{width:100%}.xwk-qr-help{white-space:normal}}`;
  }

  private renderWalletList(layout: WalletUiLayout): string {
    const groups = this.getGroups();
    if (!groups.length) return this.getWallets().map((wallet) => this.renderWallet(wallet, layout)).join("");

    return [
      ...this.getUngroupedWallets(groups).map((wallet) => this.renderWallet(wallet, layout)),
      ...groups.map((group) => this.renderWalletGroup(group, layout))
    ].join("");
  }

  private renderWalletGroup(group: WalletUiGroup, layout: WalletUiLayout): string {
    const wallets = this.getGroupWallets(group);
    const previewLimit = group.maxPreviewIcons ?? 5;
    const previewWallets = wallets.slice(0, previewLimit);
    const overflow = wallets.length - previewWallets.length;
    const icon = group.icon
      ? `<img src="${this.escapeHtml(group.icon)}" alt="">`
      : `<span class="xwk-icon-fallback">${this.escapeHtml(group.name.slice(0, 1).toUpperCase())}</span>`;
    const secondary = layout === "list"
      ? `<span class="xwk-group">${wallets.length} wallets</span>`
      : layout === "card" || layout === "grid"
        ? `<span class="xwk-group">+${wallets.length} wallets</span>`
        : "";
    const preview = previewWallets.length
      ? `<span class="xwk-group-icons">${previewWallets.map((wallet) => this.renderMiniWalletIcon(wallet)).join("")}${overflow > 0 ? `<span class="xwk-mini-more">+${overflow}</span>` : ""}</span>`
      : "";

    return `<button class="xwk-wallet xwk-wallet-group" data-wallet-group-id="${this.escapeHtml(group.id)}">${icon}<span class="xwk-wallet-info"><span class="xwk-name">${this.escapeHtml(group.name)}</span>${secondary}${preview}</span></button>`;
  }

  private renderWallet(wallet: WalletMetadata, layout: WalletUiLayout): string {
    const icon = this.renderWalletIcon(wallet);
    const showGroup = this.options.showWalletGroup !== false && layout !== "icon";
    const secondary = showGroup ? `<span class="xwk-group">${this.escapeHtml(wallet.group ?? wallet.type)}</span>` : "";
    const badge = this.renderInstalledBadge(wallet, layout);

    return `<button class="xwk-wallet" data-wallet-id="${this.escapeHtml(wallet.id)}">${icon}<span class="xwk-wallet-info"><span class="xwk-name">${this.escapeHtml(wallet.name)}</span>${secondary}</span>${badge}</button>`;
  }

  private renderInstalledBadge(wallet: WalletMetadata, layout: WalletUiLayout): string {
    if (layout !== "list") return "";
    const isExtensionLike = wallet.group === "Extensions" || wallet.type === "snap";
    if (!isExtensionLike) return "";
    const className = this.availability[wallet.id] ? "xwk-wallet-badge xwk-installed" : "xwk-wallet-badge";
    return `<span class="${className}">Installed</span>`;
  }

  private renderWalletIcon(wallet?: WalletMetadata): string {
    if (wallet?.icon) return `<img src="${this.escapeHtml(wallet.icon)}" alt="">`;
    const letter = wallet?.name.slice(0, 1).toUpperCase() ?? "W";
    return `<span class="xwk-icon-fallback">${this.escapeHtml(letter)}</span>`;
  }

  private renderMiniWalletIcon(wallet: WalletMetadata): string {
    if (wallet.icon) return `<img class="xwk-mini-icon" src="${this.escapeHtml(wallet.icon)}" alt="">`;
    return `<span class="xwk-mini-icon xwk-mini-fallback">${this.escapeHtml(wallet.name.slice(0, 1).toUpperCase())}</span>`;
  }

  private backIcon(): string {
    return `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M15 18l-6-6 6-6" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  }

  private linkIcon(): string {
    return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.07 0l2-2a5 5 0 0 0-7.07-7.07l-1.15 1.15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M14 11a5 5 0 0 0-7.07 0l-2 2A5 5 0 0 0 12 20.07l1.15-1.15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;
  }

  private resolveTheme(): ResolvedTheme {
    const mode = this.resolveThemeMode();
    const base = mode === "dark" ? darkTheme : lightTheme;
    return { ...base, ...(this.options.theme ?? {}) };
  }

  private resolveThemeMode(): "light" | "dark" {
    return this.options.themeMode === "auto" ? this.getSystemThemeMode() : this.options.themeMode ?? "light";
  }

  private getSystemThemeMode(): "light" | "dark" {
    if (typeof window === "undefined" || !window.matchMedia) return "light";
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  private escapeHtml(value: string): string {
    return value.replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "\"": "&quot;",
      "'": "&#39;"
    })[char] ?? char);
  }

  private async renderQr(container: HTMLElement, uri: string): Promise<void> {
    container.replaceChildren();

    try {
      const isDark = this.resolveThemeMode() === "dark";
      const qrColor = isDark ? QR_LIGHT : QR_DARK;
      const qrCode = new QRCodeStyling({
        width: QR_SIZE,
        height: QR_SIZE,
        type: "svg",
        data: uri,
        margin: 4,
        qrOptions: {
          errorCorrectionLevel: "H"
        },
        dotsOptions: {
          type: "dots",
          color: qrColor,
          roundSize: true
        },
        cornersSquareOptions: {
          type: "extra-rounded",
          color: qrColor
        },
        cornersDotOptions: {
          type: "dot",
          color: qrColor
        },
        backgroundOptions: {
          color: "transparent"
        }
      });
      qrCode.append(container);
    } catch {
      try {
        const dataUrl = await QRCode.toDataURL(uri, {
          errorCorrectionLevel: "H",
          margin: 2,
          width: QR_SIZE,
          color: {
            dark: QR_DARK,
            light: "#ffffff"
          }
        });
        const image = document.createElement("img");
        image.src = dataUrl;
        image.alt = "WalletConnect QR code";
        image.width = QR_SIZE;
        image.height = QR_SIZE;
        container.replaceChildren(image);
      } catch {
        const fallback = document.createElement("div");
        fallback.className = "xwk-qr-fallback";
        fallback.textContent = uri;
        container.replaceChildren(fallback);
      }
    }
  }

  private waitForPaint(): Promise<void> {
    return new Promise((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });
  }

}

export class WalletButtonController {
  private target?: HTMLElement;
  private options: WalletButtonOptions & Required<Pick<WalletButtonOptions, "label" | "showAdapterIcon" | "showChevron" | "showWeb3Name" | "fallbackToAddress" | "copyAddress" | "explorer" | "disconnect" | "accountPanel" | "accountPanelMode" | "size" | "variant" | "themeMode" | "theme">>;
  private identityName: string | null = null;
  private identityAvatar: string | null = null;
  private identityRequest = 0;
  private panelOpen = false;
  private connecting = false;
  private copied = false;
  private copyResetTimer?: number;
  private readonly offEvents: Array<() => void> = [];
  private readonly onDocumentPointerDown = (event: PointerEvent) => this.handleDocumentPointerDown(event);
  private readonly onDocumentKeyDown = (event: KeyboardEvent) => this.handleDocumentKeyDown(event);

  constructor(options: WalletButtonOptions) {
    this.target = this.resolveTarget(options.target);
    this.options = {
      label: "Connect Wallet",
      showAdapterIcon: true,
      showChevron: true,
      showWeb3Name: true,
      fallbackToAddress: true,
      copyAddress: true,
      explorer: false,
      disconnect: true,
      accountPanel: true,
      accountPanelMode: "dropdown",
      size: "md",
      variant: "default",
      themeMode: "light",
      theme: {},
      identityResolver: options.identityResolver ?? createXrpDomainsResolver(),
      explorerUrl: options.explorerUrl,
      formatAddress: options.formatAddress,
      ...options
    };

    this.offEvents.push(options.manager.on("connecting", () => {
      this.connecting = true;
      this.render();
    }));
    this.offEvents.push(options.manager.on("connected", ({ session }) => {
      this.connecting = false;
      this.panelOpen = false;
      void this.resolveIdentity(session ?? options.manager.getSession());
      this.render();
    }));
    this.offEvents.push(options.manager.on("session_restored", ({ session }) => {
      void this.resolveIdentity(session);
      this.render();
    }));
    this.offEvents.push(options.manager.on("disconnected", () => {
      this.connecting = false;
      this.panelOpen = false;
      this.identityName = null;
      this.identityAvatar = null;
      this.render();
    }));
    this.offEvents.push(options.manager.on("error", () => {
      this.connecting = false;
      this.render();
    }));
    this.offEvents.push(options.modal.onClose(() => {
      if (this.options.manager.getSession()) return;
      this.connecting = false;
      this.render();
    }));
  }

  mount(target: WalletButtonTarget = document.body): void {
    const nextTarget = this.resolveTarget(target);
    if (!nextTarget) throw new Error("Wallet button target was not found");
    this.target = nextTarget;
    nextTarget.innerHTML = "";
    nextTarget.appendChild(this.createRoot());
    this.render();
    void this.resolveIdentity(this.options.manager.getSession());
  }

  updateOptions(options: Partial<Omit<WalletButtonOptions, "manager" | "modal" | "target">>): void {
    this.options = { ...this.options, ...options };
    this.render();
  }

  destroy(): void {
    this.removePanelListeners();
    if (this.copyResetTimer) window.clearTimeout(this.copyResetTimer);
    this.offEvents.splice(0).forEach((off) => off());
    if (this.target) this.target.innerHTML = "";
    this.target = undefined;
  }

  render(): void {
    if (!this.target) return;
    this.target.innerHTML = "";
    this.target.appendChild(this.createRoot());
    this.syncPanelListeners();
  }

  private createRoot(): HTMLElement {
    const root = document.createElement("div");
    root.className = "xwk-button-root";
    root.innerHTML = `<style>${this.renderStyles()}</style>${this.renderButton()}${this.panelOpen ? this.renderPanel() : ""}`;
    root.querySelector<HTMLButtonElement>("[data-xwk-wallet-button]")?.addEventListener("click", () => this.onButtonClick());
    root.querySelector<HTMLButtonElement>("[data-xwk-account-close]")?.addEventListener("click", () => this.closePanel());
    root.querySelector<HTMLElement>("[data-xwk-account-overlay]")?.addEventListener("click", (event) => {
      if (event.target === event.currentTarget) this.closePanel();
    });
    root.querySelector<HTMLButtonElement>("[data-xwk-copy-address]")?.addEventListener("click", () => this.copyAddress());
    root.querySelector<HTMLButtonElement>("[data-xwk-disconnect]")?.addEventListener("click", () => void this.disconnect());
    return root;
  }

  private onButtonClick(): void {
    const session = this.options.manager.getSession();
    if (!session) {
      this.options.modal.open();
      return;
    }
    if (!this.options.accountPanel) return;
    this.panelOpen = !this.panelOpen;
    this.render();
  }

  private closePanel(): void {
    this.panelOpen = false;
    this.render();
  }

  private handleDocumentPointerDown(event: PointerEvent): void {
    if (!this.panelOpen || !this.target) return;
    if (event.target instanceof Node && this.target.contains(event.target)) return;
    this.panelOpen = false;
    this.render();
  }

  private handleDocumentKeyDown(event: KeyboardEvent): void {
    if (!this.panelOpen || event.key !== "Escape") return;
    this.panelOpen = false;
    this.render();
  }

  private syncPanelListeners(): void {
    this.removePanelListeners();
    if (!this.panelOpen) return;
    document.addEventListener("pointerdown", this.onDocumentPointerDown);
    document.addEventListener("keydown", this.onDocumentKeyDown);
  }

  private removePanelListeners(): void {
    document.removeEventListener("pointerdown", this.onDocumentPointerDown);
    document.removeEventListener("keydown", this.onDocumentKeyDown);
  }

  private async disconnect(): Promise<void> {
    await this.options.manager.disconnect();
    this.options.modal.close();
  }

  private async copyAddress(): Promise<void> {
    const address = this.options.manager.getSession()?.account.address;
    if (!address) return;
    await navigator.clipboard.writeText(address);
    this.copied = true;
    if (this.copyResetTimer) window.clearTimeout(this.copyResetTimer);
    this.copyResetTimer = window.setTimeout(() => {
      this.copied = false;
      this.render();
    }, 1400);
    this.render();
  }

  private async resolveIdentity(session: WalletSession | null): Promise<void> {
    if (!session || !this.shouldShowWeb3Name() || !this.options.identityResolver) {
      this.identityName = null;
      this.identityAvatar = null;
      return;
    }
    const requestId = ++this.identityRequest;
    try {
      const result = await this.options.identityResolver(session.account.address, session);
      if (requestId !== this.identityRequest) return;
      this.identityName = typeof result === "string" ? result : result?.name ?? null;
      this.identityAvatar = typeof result === "string" ? null : result?.avatar ?? null;
      this.render();
    } catch {
      if (requestId === this.identityRequest) {
        this.identityName = null;
        this.identityAvatar = null;
      }
    }
  }

  private renderButton(): string {
    const session = this.options.manager.getSession();
    const connected = Boolean(session);
    const label = this.connecting
      ? "Connecting..."
      : session
        ? this.getAccountLabel(session)
        : this.options.label;
    const icon = this.options.showAdapterIcon
      ? this.renderWalletIcon(connected ? session?.wallet : undefined, connected ? undefined : DEFAULT_WALLET_ICON)
      : "";
    const chevron = connected && this.options.showChevron && this.options.accountPanel
      ? `<span class="xwk-button-chevron" aria-hidden="true">${this.chevronIcon()}</span>`
      : "";

    return `<button class="xwk-account-button" data-xwk-wallet-button type="button">${icon}<span class="xwk-button-label">${this.escapeHtml(label)}</span>${chevron}</button>`;
  }

  private renderPanel(): string {
    const session = this.options.manager.getSession();
    if (!session) return "";
    const walletName = session.wallet?.name ?? session.adapterId;
    const address = session.account.address;
    const label = this.getAccountLabel(session);
    const explorerUrl = this.getExplorerUrl(session);
    const copyFeedbackIcon = this.copied ? this.copiedIcon() : this.copyIcon();
    const copy = this.options.copyAddress ? `<button type="button" data-xwk-copy-address>${copyFeedbackIcon}<span>Copy address</span></button>` : "";
    const explorer = this.options.explorer && explorerUrl ? `<a href="${this.escapeHtml(explorerUrl)}" target="_blank" rel="noreferrer">${this.externalIcon()}<span>View explorer</span></a>` : "";
    const disconnect = this.options.disconnect ? `<button type="button" data-xwk-disconnect>${this.logoutIcon()}<span>Disconnect</span></button>` : "";
    const account = `<div class="xwk-account-hero">${this.renderAccountAvatar(session)}</div><div class="xwk-account-name">${this.escapeHtml(label)}</div><div class="xwk-account-address">${this.escapeHtml(this.formatAddress(address))}</div>`;
    const actions = `<div class="xwk-account-panel-actions">${copy}${explorer}${disconnect}</div>`;
    if (this.options.accountPanelMode === "modal") {
      return `<div class="xwk-account-overlay" data-xwk-account-overlay role="presentation"><section class="xwk-account-panel xwk-account-panel-modal" role="dialog" aria-modal="true"><div class="xwk-account-modal-header"><span></span><h2>Connected</h2><button class="xwk-account-close" type="button" data-xwk-account-close aria-label="Close">&times;</button></div><div class="xwk-account-modal-body">${account}${actions}</div></section></div>`;
    }

    return `<div class="xwk-account-panel xwk-account-panel-dropdown"><div class="xwk-account-panel-head">${this.renderWalletIcon(session.wallet)}<div class="xwk-account-panel-title"><strong>${this.escapeHtml(walletName)}</strong><span>${this.escapeHtml(label)}</span></div></div><code>${this.escapeHtml(address)}</code>${actions}</div>`;
  }

  private getAccountLabel(session: WalletSession): string {
    if (this.shouldShowWeb3Name() && this.identityName) return this.identityName;
    if (!this.options.fallbackToAddress) return session.wallet?.name ?? session.adapterId;
    return (this.options.formatAddress ?? this.formatAddress)(session.account.address);
  }

  private renderAccountAvatar(session: WalletSession): string {
    if (this.identityAvatar) {
      return `<img class="xwk-account-avatar" src="${this.escapeHtml(this.identityAvatar)}" alt="">`;
    }
    const [from, to, spot] = this.getAddressGradient(session.account.address);
    return `<div class="xwk-account-art" style="--xwk-avatar-from:${from};--xwk-avatar-to:${to};--xwk-avatar-spot:${spot}"><span></span></div>`;
  }

  private getExplorerUrl(session: WalletSession): string | undefined {
    if (this.options.explorerUrl) return this.options.explorerUrl(session);
    const configuredUrl = (session.account.network as { explorerAccountUrl?: string } | undefined)?.explorerAccountUrl;
    if (configuredUrl) return configuredUrl.replace("{address}", encodeURIComponent(session.account.address));
    const networkType = session.account.network?.networkType ?? session.account.networkType;
    if (networkType === "TESTNET") return `https://testnet.xrpl.org/accounts/${encodeURIComponent(session.account.address)}`;
    if (networkType === "DEVNET") return `https://devnet.xrpl.org/accounts/${encodeURIComponent(session.account.address)}`;
    return `https://livenet.xrpl.org/accounts/${encodeURIComponent(session.account.address)}`;
  }

  private shouldShowWeb3Name(): boolean {
    return this.options.showWeb3Name ?? this.options.showXrpName ?? true;
  }

  private renderWalletIcon(wallet?: WalletMetadata, fallbackIcon?: string): string {
    const icon = wallet?.icon ?? fallbackIcon;
    if (icon) return `<img class="xwk-button-icon" src="${this.escapeHtml(icon)}" alt="">`;
    const label = wallet?.name.slice(0, 1).toUpperCase() ?? "W";
    return `<span class="xwk-button-icon xwk-button-icon-fallback">${this.escapeHtml(label)}</span>`;
  }

  private chevronIcon(): string {
    return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="m6 9 6 6 6-6" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  }

  private copyIcon(): string {
    return `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="8" y="8" width="11" height="11" rx="2" stroke="currentColor" stroke-width="2"/><path d="M5 15H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;
  }

  private copiedIcon(): string {
    return `<svg class="xwk-copied-icon" width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="#1d9bf0"/><path d="m7.8 12.4 2.7 2.7 5.9-6.2" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  }

  private externalIcon(): string {
    return `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M14 4h6v6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M20 4 10 14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M11 5H7a3 3 0 0 0-3 3v9a3 3 0 0 0 3 3h9a3 3 0 0 0 3-3v-4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;
  }

  private logoutIcon(): string {
    return `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M10 6H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M15 8l4 4-4 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M19 12H9" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;
  }

  private renderStyles(): string {
    const theme = this.resolveTheme();
    const height = this.options.size === "lg" ? "48px" : this.options.size === "sm" ? "38px" : "42px";
    const radius = this.options.variant === "pill" ? "999px" : theme.walletRadius ?? "10px";
    const background = this.options.variant === "default" || this.options.variant === "pill" ? theme.surface : theme.background;
    const hoverBackground = this.options.variant === "default" || this.options.variant === "pill" ? theme.surfaceHover : theme.surface;
    const border = this.options.variant === "minimal" ? "transparent" : theme.border;

    return `.xwk-button-root{display:inline-block;position:relative;font-family:${theme.fontFamily};font-size:14px}.xwk-account-button{align-items:center;background:${background};border:1px solid ${border};border-radius:${radius};box-shadow:none;color:${theme.foreground};cursor:pointer;display:inline-flex;gap:8px;font:inherit;font-weight:560;min-height:${height};padding:0 8px 0 10px;transition:background-color .16s ease,opacity .16s ease;white-space:nowrap}.xwk-account-button:hover{background:${hoverBackground};box-shadow:none;opacity:1;transform:none}.xwk-account-button:active{opacity:.78;transform:none}.xwk-button-icon{background:${theme.background};border:1px solid ${theme.border};border-radius:10px;box-sizing:border-box;display:inline-flex;flex:0 0 auto;height:28px;object-fit:contain;overflow:hidden;width:28px}.xwk-button-icon-fallback{align-items:center;background:${theme.surfaceHover};color:${theme.muted};font-size:12px;justify-content:center}.xwk-button-label{display:inline-block;font-size:13px;font-weight:560;line-height:1.1;max-width:168px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.xwk-button-chevron{align-items:center;background:${theme.background};border:1px solid ${theme.border};border-radius:999px;color:${theme.muted};display:inline-flex;height:26px;justify-content:center;line-height:1;width:26px}.xwk-button-chevron:hover{background:${theme.surfaceHover};color:${theme.foreground}}.xwk-account-overlay{align-items:center;background:${theme.overlay};display:flex;inset:0;justify-content:center;padding:24px;position:fixed;z-index:2147483647}.xwk-account-panel{background:${theme.background};border:1px solid ${theme.border};border-radius:${theme.radius};box-shadow:${theme.shadow};color:${theme.foreground};display:grid;gap:12px;overflow:hidden;z-index:2147483647}.xwk-account-panel-dropdown{margin-top:10px;min-width:320px;padding:16px;position:absolute;right:0;top:100%}.xwk-account-panel-modal{gap:0;max-width:520px;position:relative;width:min(520px,100%)}.xwk-account-modal-header{align-items:center;border-bottom:1px solid ${theme.border};display:grid;grid-template-columns:36px minmax(0,1fr) 36px;column-gap:8px;padding:10px 18px}.xwk-account-modal-header h2{color:${theme.foreground};font-size:16px;font-weight:500;line-height:1.2;margin:0;min-width:0;overflow:hidden;text-align:center;text-overflow:ellipsis;white-space:nowrap}.xwk-account-modal-body{display:grid;gap:12px;justify-items:center;min-height:390px;padding:22px 28px 28px}.xwk-account-close{align-items:center;background:transparent;border:0;border-radius:999px;box-shadow:none;color:${theme.muted};cursor:pointer;display:inline-flex;font-size:24px;font-weight:500;height:32px;justify-content:center;line-height:1;min-height:0;padding:0;transform:none;width:32px}.xwk-account-close:hover{background:${theme.surfaceHover};box-shadow:none;color:${theme.foreground};transform:none}.xwk-account-panel-head{align-items:center;display:flex;gap:12px;min-width:0}.xwk-account-panel-head .xwk-button-icon{height:34px;width:34px}.xwk-account-panel-title{display:grid;gap:2px;min-width:0}.xwk-account-panel-title strong{color:${theme.foreground};display:block;font-size:15px;font-weight:640;line-height:1.2;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.xwk-account-panel-title span{color:${theme.muted};display:block;font-size:13px;line-height:1.25;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.xwk-account-panel code{background:${theme.surface};border:0;border-radius:12px;color:${theme.muted};display:block;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;line-height:1.4;overflow-wrap:anywhere;padding:11px 12px}.xwk-account-hero{height:154px;margin-top:4px;position:relative;width:180px}.xwk-account-art,.xwk-account-avatar{border-radius:999px;height:118px;left:31px;position:absolute;top:8px;width:118px}.xwk-account-art{align-items:center;background:radial-gradient(circle at 58% 38%,var(--xwk-avatar-spot),transparent 0 22%,transparent 23%),linear-gradient(160deg,var(--xwk-avatar-from),var(--xwk-avatar-to));display:flex;justify-content:center}.xwk-account-art span{background:rgba(255,255,255,.18);border-radius:999px;height:50px;width:50px}.xwk-account-avatar{background:${theme.surface};border:1px solid ${theme.border};box-sizing:border-box;display:block;object-fit:cover;overflow:hidden}.xwk-account-badge{align-items:center;background:${theme.background};border:1px solid ${theme.border};border-radius:999px;bottom:18px;display:flex;gap:6px;left:84px;padding:5px 9px 5px 5px;position:absolute}.xwk-account-badge .xwk-button-icon{height:30px;width:30px}.xwk-account-badge svg{color:${theme.muted};width:13px}.xwk-account-name{color:${theme.foreground};font-size:21px;font-weight:650;line-height:1.2;max-width:100%;overflow:hidden;text-align:center;text-overflow:ellipsis;white-space:nowrap}.xwk-account-address{background:${theme.surface};border:1px solid ${theme.border};border-radius:12px;color:${theme.muted};font-size:14px;font-weight:520;line-height:1.25;max-width:100%;overflow:hidden;padding:8px 12px;text-align:center;text-overflow:ellipsis;white-space:nowrap}.xwk-address-copy{align-items:center;background:transparent;border:0;border-radius:0;color:${theme.foreground};cursor:pointer;display:inline-flex;font:inherit;font-size:13px;font-weight:560;gap:7px;justify-content:center;line-height:1.2;min-height:24px;padding:0}.xwk-address-copy svg{height:16px;opacity:.55;width:16px}.xwk-address-copy:hover{color:${theme.foreground}}.xwk-account-panel-actions{display:grid;gap:10px;grid-template-columns:1fr;width:100%}.xwk-account-modal-body .xwk-account-panel-actions{margin-top:auto}.xwk-account-panel-actions button,.xwk-account-panel-actions a{align-items:center;background:${theme.surface};border:1px solid transparent;border-radius:${theme.walletRadius};box-shadow:none;color:${theme.foreground};cursor:pointer;display:flex;font:inherit;font-size:14px;font-weight:560;gap:8px;justify-content:center;min-height:46px;padding:0 12px;text-decoration:none;transition:background-color .16s ease,opacity .16s ease}.xwk-account-panel-actions svg{flex:0 0 auto;opacity:.58}.xwk-account-panel-actions button:hover,.xwk-account-panel-actions a:hover{background:${theme.surfaceHover};box-shadow:none;transform:none}.xwk-account-panel-actions button:active,.xwk-account-panel-actions a:active{opacity:.72;transform:none}.xwk-copied-icon{opacity:1!important}@media(max-width:420px){.xwk-account-panel-dropdown{left:0;min-width:min(320px,calc(100vw - 32px));right:auto}.xwk-account-overlay{padding:12px}.xwk-account-panel-modal{max-height:calc(100vh - 24px);width:100%}.xwk-account-modal-header{grid-template-columns:40px minmax(0,1fr) 40px;padding:16px 18px}.xwk-account-modal-body{min-height:360px;padding:18px 22px 24px}.xwk-button-label{max-width:132px}}`;
  }

  private resolveTheme(): ResolvedTheme {
    const mode = this.options.themeMode === "auto" ? this.getSystemThemeMode() : this.options.themeMode;
    const base = mode === "dark" ? darkTheme : lightTheme;
    return { ...base, ...this.options.theme };
  }

  private resolveTarget(target?: WalletButtonTarget): HTMLElement | undefined {
    if (!target) return undefined;
    if (typeof target !== "string") return target;
    const element = document.querySelector<HTMLElement>(target);
    if (!element) throw new Error(`Wallet button target was not found: ${target}`);
    return element;
  }

  private formatAddress(address: string): string {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }

  private getAddressGradient(address: string): [string, string, string] {
    const palette = [
      ["#0ea5e9", "#6366f1", "#93c5fd"],
      ["#14b8a6", "#2563eb", "#99f6e4"],
      ["#f97316", "#db2777", "#fed7aa"],
      ["#8b5cf6", "#06b6d4", "#ddd6fe"],
      ["#22c55e", "#0f766e", "#bbf7d0"],
      ["#f43f5e", "#7c3aed", "#fecdd3"]
    ] as const;
    let hash = 0;
    for (let index = 0; index < address.length; index += 1) {
      hash = ((hash << 5) - hash + address.charCodeAt(index)) | 0;
    }
    const colors = palette[Math.abs(hash) % palette.length];
    return [colors[0], colors[1], colors[2]];
  }

  private getSystemThemeMode(): "light" | "dark" {
    if (typeof window === "undefined" || !window.matchMedia) return "light";
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  private escapeHtml(value: string): string {
    return value.replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "\"": "&quot;",
      "'": "&#39;"
    })[char] ?? char);
  }
}

export function createXrpDomainsResolver(options: XrpDomainsResolverOptions = {}): WalletIdentityResolver {
  const endpoint = options.endpoint ?? "https://app.xrpdomains.xyz/api/xrplnft/getName";
  const profileEndpoint = options.profileEndpoint ?? "https://app.xrpdomains.xyz/api/xrplnft/getAddress";
  const timeoutMs = options.timeoutMs ?? 3000;
  const cacheTtlMs = options.cacheTtlMs ?? 600000;
  const cache = new Map<string, { value: WalletIdentity | null; expiresAt: number }>();

  return async (address) => {
    const cached = cache.get(address);
    if (cached && cached.expiresAt > Date.now()) return cached.value;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
    try {
      const url = `${endpoint}${endpoint.includes("?") ? "&" : "?"}address=${encodeURIComponent(address)}`;
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) return null;
      const json = await response.json() as { data?: unknown; name?: unknown };
      const name = typeof json.data === "string" ? json.data : typeof json.name === "string" ? json.name : null;
      const avatar = name ? await resolveXrpDomainAvatar(profileEndpoint, name, controller.signal) : undefined;
      const value = name ? { name, source: "xrpdomains", avatar, verified: true } : null;
      cache.set(address, { value, expiresAt: Date.now() + cacheTtlMs });
      return value;
    } finally {
      window.clearTimeout(timeout);
    }
  };
}

async function resolveXrpDomainAvatar(endpoint: string, domain: string, signal: AbortSignal): Promise<string | undefined> {
  try {
    const url = `${endpoint}${endpoint.includes("?") ? "&" : "?"}domain=${encodeURIComponent(domain)}`;
    const response = await fetch(url, { signal });
    if (!response.ok) return undefined;
    const json = await response.json();
    return findAvatarUrl(json);
  } catch {
    return undefined;
  }
}

function findAvatarUrl(value: unknown): string | undefined {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  const direct = record.avatar;
  if (typeof direct === "string" && direct.trim()) return direct.trim();
  const profileInfo = record.profile_info ?? record.profileInfo;
  const profileAvatar = findAvatarUrl(profileInfo);
  if (profileAvatar) return profileAvatar;
  const dataAvatar = findAvatarUrl(record.data);
  if (dataAvatar) return dataAvatar;
  const resultAvatar = findAvatarUrl(record.result);
  if (resultAvatar) return resultAvatar;
  return undefined;
}

export function createWalletModal(options: WalletUiOptions) {
  const modal = new WalletModal(options);
  return modal;
}

export function createWalletButton(options: WalletButtonOptions) {
  const button = new WalletButtonController(options);
  if (options.target) button.mount(options.target);
  return button;
}

export { WalletModal as XrplWalletModal, WalletButtonController as XrplWalletButton };





