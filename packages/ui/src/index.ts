import QRCode from "qrcode";
import type { WalletAvailabilityMap, WalletManager, WalletMetadata } from "@xrpl-wallet-kit/core";

export type WalletUiLayout = "list" | "grid" | "icon";
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

type ResolvedTheme = Required<WalletUiTheme>;

const QR_SIZE = 304;
const QR_DARK = "#111827";
const WALLETCONNECT_GROUP_ICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='18' fill='%233396ff'/%3E%3Cpath d='M18.5 27.2c7.5-7.1 19.5-7.1 27 0l.9.9c.4.4.4 1 0 1.4l-3 2.9c-.4.4-.9.4-1.3 0l-1.2-1.1c-4.9-4.6-12.8-4.6-17.7 0l-1.2 1.1c-.4.4-.9.4-1.3 0l-3-2.9c-.4-.4-.4-1 0-1.4l.8-.9Zm33.2 6.1 2.7 2.6c.4.4.4 1 0 1.4L42 49.2c-.4.4-1 .4-1.4 0L32.5 41c-.3-.3-.7-.3-1 0l-8.1 8.2c-.4.4-1 .4-1.4 0L9.6 37.3c-.4-.4-.4-1 0-1.4l2.7-2.6c.4-.4 1-.4 1.4 0l8.1 7.8c.3.3.7.3 1 0l8.1-7.8c.4-.4 1-.4 1.4 0l8.1 7.8c.3.3.7.3 1 0l8.1-7.8c.2-.2.5-.3.7-.3s.5.1.7.3Z' fill='white'/%3E%3C/svg%3E";

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

export class XrplWalletModal {
  private root?: HTMLElement;
  private qrUri = "";
  private pendingQr?: { adapterId: string; uri: string; deeplink?: string };
  private options: WalletUiOptions;
  private availability: WalletAvailabilityMap = {};
  private activeGroupId?: string;

  constructor(options: WalletUiOptions) {
    this.options = { layout: "list", presentation: "flat", size: "default", textSize: "sm", themeMode: "light", title: "Connect Wallet", ...options };
    options.manager.on("qr", ({ adapterId, uri, deeplink }) => this.showQr(adapterId, uri, deeplink));
    options.manager.on("connecting", ({ adapterId }) => this.setLoading(adapterId));
    options.manager.on("connected", () => this.close());
    options.manager.on("error", ({ error }) => this.setError(error));
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

  close(): void {
    this.root?.remove();
    this.root = undefined;
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
    this.close();
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
    const width = size === "wide" ? "640px" : size === "compact" ? "400px" : "520px";
    const gridColumns = layout === "icon" ? "repeat(4,minmax(0,1fr))" : layout === "grid" ? "repeat(3,minmax(0,1fr))" : "1fr";
    const textAlign = layout === "list" ? "left" : "center";
    const walletDirection = layout === "list" ? "row" : "column";
    const walletMinHeight = layout === "icon" ? "78px" : layout === "grid" ? "100px" : "64px";
    const iconSize = layout === "icon" ? "38px" : layout === "grid" ? "42px" : "36px";
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

    return `.xwk-overlay{position:fixed;inset:0;background:${theme.overlay};display:grid;place-items:center;z-index:2147483647;font-family:${theme.fontFamily};font-size:${bodyFontSize};padding:16px}.xwk-modal{display:block;width:min(${width},100%);background:${theme.background};border:1px solid ${theme.border};border-radius:${theme.radius};box-shadow:${theme.shadow};color:${theme.foreground};overflow:hidden}.xwk-header{display:grid;grid-template-columns:36px minmax(0,1fr) 36px;align-items:center;column-gap:8px;padding:10px 18px;border-bottom:1px solid ${theme.border}}.xwk-title{font-size:${titleFontSize};font-weight:500;text-align:center;color:${theme.foreground};min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.xwk-close,.xwk-back{align-items:center;border:0;background:transparent;border-radius:999px;box-shadow:none;color:${theme.muted};cursor:pointer;display:inline-flex;height:32px;justify-content:center;min-height:0;padding:0;transform:none;width:32px}.xwk-back{justify-self:start}.xwk-close{font-size:24px;font-weight:500;justify-self:end;line-height:1}.xwk-close:hover,.xwk-back:hover{background:${theme.surfaceHover};box-shadow:none;color:${theme.foreground};transform:none}.xwk-body{max-height:min(620px,calc(100vh - 120px));overflow:auto;padding:12px 22px 18px}.xwk-list,.xwk-connect,.xwk-qr{display:none}.xwk-overlay[data-xwk-view="list"] .xwk-list{display:block}.xwk-overlay[data-xwk-view="connect"] .xwk-connect{display:block}.xwk-overlay[data-xwk-view="qr"] .xwk-qr{display:block}.xwk-grid{display:grid;grid-template-columns:${gridColumns};gap:7px}.xwk-wallet{align-items:center;background:${theme.surface};border:0;border-radius:16px;box-shadow:none;color:${theme.foreground};cursor:pointer;display:flex;flex-direction:${walletDirection};gap:12px;justify-content:${layout === "list" ? "flex-start" : "center"};min-height:${walletMinHeight};min-width:0;padding:${layout === "list" ? "12px 12px" : "12px 10px"};text-align:${textAlign};transform:none;transition:background-color .16s ease;width:100%}.xwk-wallet:hover{background:${theme.surfaceHover};box-shadow:none;transform:none}.xwk-wallet:active{background:${theme.surfaceHover};transform:none}.xwk-wallet img,.xwk-icon-fallback{border-radius:12px;flex:0 0 auto;height:${iconSize};object-fit:contain;overflow:hidden;width:${iconSize}}.xwk-icon-fallback{align-items:center;background:${theme.accent};color:#fff;display:inline-flex;font-weight:700;justify-content:center}.xwk-wallet-group{margin-top:8px;min-height:${walletMinHeight}}.xwk-wallet-group .xwk-wallet-info{align-items:center;display:flex;gap:10px}.xwk-wallet-group .xwk-name{flex:1 1 auto}.xwk-wallet-group .xwk-group{display:none}.xwk-wallet-info{display:grid;gap:2px;min-width:0;width:100%}.xwk-name{color:${walletNameColor};display:block;font-size:${layout === "list" ? nameFontSize : gridNameFontSize};font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.xwk-group{color:${theme.muted};display:${groupDisplay};font-size:${groupFontSize};font-weight:400;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.xwk-group-icons{display:${layout === "list" ? "inline-flex" : "none"};flex:0 0 auto;gap:3px;justify-content:flex-end;margin-left:auto;min-width:0}.xwk-mini-icon,.xwk-mini-fallback,.xwk-mini-more{align-items:center;border-radius:999px;display:inline-flex;flex:0 0 auto;height:14px;justify-content:center;object-fit:cover;overflow:hidden;width:14px}.xwk-mini-fallback,.xwk-mini-more{background:${theme.background};color:${theme.muted};font-size:7px;font-weight:600}.xwk-mini-more{width:auto;min-width:14px;padding:0 4px}.xwk-wallet-badge{align-items:center;background:${badgeBackground};border-radius:999px;color:${badgeColor};display:inline-flex;flex:0 0 auto;font-size:11px;font-weight:500;gap:6px;line-height:1;margin-left:auto;min-height:24px;padding:0 10px;visibility:hidden}.xwk-wallet-badge:before{background:${badgeDot};border-radius:999px;content:"";height:6px;width:6px}.xwk-wallet-badge.xwk-installed{visibility:visible}.xwk-status{color:${theme.accent};font-size:12px;margin-top:12px;min-height:18px}.xwk-hidden{display:none}.xwk-back.xwk-hidden{display:inline-flex;pointer-events:none;visibility:hidden}.xwk-connect{text-align:center;padding:30px 0 16px}.xwk-spinner{display:grid;margin:0 auto 16px;place-items:center;position:relative;width:104px;height:104px}.xwk-spinner:before{animation:xwk-spin 1s linear infinite;border:3px solid transparent;border-top-color:#cbd5e1;border-right-color:#e5e7eb;border-radius:50%;content:"";height:96px;position:absolute;width:96px}.xwk-connect-icon img,.xwk-connect-icon .xwk-icon-fallback{border-radius:16px;height:66px;object-fit:contain;overflow:hidden;width:66px}.xwk-connect-name{display:block;font-size:${nameFontSize};font-weight:600;margin-top:4px}.xwk-connect-status{color:${theme.muted};font-size:${bodyFontSize};font-weight:400;line-height:1.45;margin:14px auto 0;max-width:420px}.xwk-qr{text-align:center}.xwk-qr-title{color:${theme.foreground};font-size:${titleFontSize};font-weight:500;margin:0 0 14px}.xwk-qr-card{background:#fff;border:1px solid ${theme.border};border-radius:14px;box-sizing:border-box;margin:0 auto 10px;padding:12px;width:min(332px,100%)}.xwk-qr-code{aspect-ratio:1/1;background:#fff;border:0;border-radius:10px;box-sizing:border-box;color:#64748b;display:grid;margin:0 auto 10px;padding:0;place-items:center;width:100%}.xwk-qr-code canvas,.xwk-qr-code img{aspect-ratio:1/1;display:block;height:auto;max-width:100%;width:100%}.xwk-qr-loading{align-items:center;color:#64748b;display:inline-flex;font-size:13px;gap:8px}.xwk-qr-loading-spinner{animation:xwk-spin 1s linear infinite;border:2px solid #e5e7eb;border-top-color:#cbd5e1;border-radius:999px;display:inline-block;height:18px;width:18px}.xwk-qr-help{color:${theme.muted};font-size:${bodyFontSize};font-weight:400;line-height:1.35;margin:10px auto 0;max-width:420px;white-space:nowrap}.xwk-qr-fallback{color:#334155;font-size:11px;line-height:1.5;overflow-wrap:anywhere}.xwk-actions{display:grid;gap:10px;grid-template-columns:1fr 1fr;margin-top:14px}.xwk-qr-card-actions{display:grid;gap:10px;grid-template-columns:1fr}.xwk-qr-card-actions-dual{grid-template-columns:1fr 1fr}.xwk-action{align-items:center;background:${theme.background};border:1px solid ${theme.border};border-radius:${theme.walletRadius};box-shadow:0 1px 2px rgba(15,23,42,.04);color:${theme.foreground};cursor:pointer;display:inline-flex;font:inherit;font-size:${bodyFontSize};font-weight:600;gap:8px;justify-content:center;min-height:44px;padding:10px 12px;text-decoration:none;transform:none}.xwk-copy-inside{background:#fff;border-color:#e5e7eb;color:#374151;font-size:${textSize === "lg" ? "17px" : textSize === "md" ? "16px" : "15px"};width:100%}.xwk-action:hover{background:${theme.surfaceHover};transform:none}.xwk-copy-inside:hover{background:#f8fafc}.xwk-action-primary{background:${theme.accent};border-color:${theme.accent};color:#fff}.xwk-action-primary:hover{background:${theme.accent};color:#fff}.xwk-footer{border-top:0;color:${theme.muted};font-size:10px;font-weight:300;padding:12px 16px 14px;text-align:center}@keyframes xwk-spin{to{transform:rotate(360deg)}}@media(max-width:640px){.xwk-overlay{padding:12px}.xwk-modal{max-height:calc(100vh - 24px)}.xwk-header{grid-template-columns:40px minmax(0,1fr) 40px;column-gap:8px;padding:16px 18px}.xwk-body{max-height:calc(100vh - 120px);padding:16px 18px 18px}.xwk-grid{grid-template-columns:${layout === "icon" ? "repeat(3,minmax(0,1fr))" : "1fr"}}.xwk-actions,.xwk-qr-card-actions-dual{grid-template-columns:1fr}.xwk-qr-card{padding:12px;width:100%}.xwk-qr-code{width:100%}.xwk-qr-help{white-space:normal}}`;
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
      try {
        const dataUrl = await QRCode.toDataURL(uri, {
          errorCorrectionLevel: "H",
          margin: 2,
          width: QR_SIZE,
          color: {
            dark: "#111827",
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

export function createWalletModal(options: WalletUiOptions) {
  return new XrplWalletModal(options);
}



