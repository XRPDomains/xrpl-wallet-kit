import { getExplorerAccountUrl, getNativeAsset, isMainnetNetwork } from "@xrpl-wallet-kit/core";
import type { WalletSession } from "@xrpl-wallet-kit/core";
import { createXrpBalanceResolver } from "./balance";
import { lockPageScroll, unlockPageScroll } from "./dom";
import { darkTheme, lightTheme } from "./themes";
import type { ResolvedTheme } from "./themes";
import type { WalletAccountPanelMode, WalletBalance, WalletButtonOptions, WalletButtonTarget, WalletIdentity, WalletIdentityResolver, XrpDomainsResolverOptions } from "./types";
import type { WalletMetadata } from "@xrpl-wallet-kit/core";
export class WalletButtonController {
  private target?: HTMLElement;
  private options: WalletButtonOptions & Required<Pick<WalletButtonOptions, "label" | "showAdapterIcon" | "showChevron" | "showWeb3Name" | "fallbackToAddress" | "copyAddress" | "explorer" | "disconnect" | "accountPanel" | "accountPanelMode" | "showBalance" | "size" | "variant" | "themeMode" | "theme">>;
  private identityName: string | null = null;
  private identityAvatar: string | null = null;
  private identityRequest = 0;
  private balance: WalletBalance | null = null;
  private activationStatus: "active" | "unfunded" | "unknown" = "unknown";
  private balanceRequest = 0;
  private panelOpen = false;
  private panelScrollLocked = false;
  private connecting = false;
  private copied = false;
  private accountAction: "copy" | "disconnect" | null = null;
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
      accountPanelMode: "modal",
      showBalance: false,
      size: "md",
      variant: "default",
      themeMode: "light",
      theme: {},
      identityResolver: options.identityResolver ?? createXrpDomainsResolver(),
      balanceResolver: options.balanceResolver ?? createXrpBalanceResolver(),
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
      void this.resolveBalance(session ?? options.manager.getSession());
      this.render();
    }));
    this.offEvents.push(options.manager.on("session_restored", ({ session }) => {
      this.connecting = false;
      void this.resolveIdentity(session);
      void this.resolveBalance(session);
      this.render();
    }));
    this.offEvents.push(options.manager.on("session_stale", () => {
      this.connecting = false;
      this.render();
    }));
    this.offEvents.push(options.manager.on("session_expired", () => {
      this.connecting = false;
      this.render();
    }));
    this.offEvents.push(options.manager.on("disconnected", () => {
      this.connecting = false;
      this.panelOpen = false;
      this.identityName = null;
      this.identityAvatar = null;
      this.balance = null;
      this.activationStatus = "unknown";
      this.render();
    }));
    this.offEvents.push(options.manager.on("signed", () => {
      void this.resolveBalance(options.manager.getSession());
      window.setTimeout(() => void this.resolveBalance(options.manager.getSession()), 1600);
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
    void this.resolveBalance(this.options.manager.getSession());
  }

  updateOptions(options: Partial<Omit<WalletButtonOptions, "manager" | "modal" | "target">>): void {
    this.options = { ...this.options, ...options };
    if ("showWeb3Name" in options || "identityResolver" in options) {
      void this.resolveIdentity(this.options.manager.getSession());
    }
    if ("showBalance" in options || "balanceResolver" in options) {
      void this.resolveBalance(this.options.manager.getSession());
    }
    this.render();
  }

  refreshIdentity(): Promise<void> {
    return this.resolveIdentity(this.options.manager.getSession());
  }

  refreshBalance(): Promise<void> {
    return this.resolveBalance(this.options.manager.getSession());
  }

  async refreshAccount(): Promise<void> {
    await Promise.all([this.refreshIdentity(), this.refreshBalance()]);
  }

  destroy(): void {
    this.removePanelListeners();
    this.syncPanelScrollLock(false);
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
    if (!this.panelOpen) return;
    if (event.key === "Escape") {
      this.panelOpen = false;
      this.render();
      return;
    }
    if (event.key !== "Tab" || this.options.accountPanelMode !== "modal") return;
    const focusable = this.getAccountPanelFocusableElements();
    if (!focusable.length) {
      event.preventDefault();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;
    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
      return;
    }
    if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  private syncPanelListeners(): void {
    this.removePanelListeners();
    this.syncPanelScrollLock(this.panelOpen && this.options.accountPanelMode === "modal");
    if (!this.panelOpen) return;
    document.addEventListener("pointerdown", this.onDocumentPointerDown);
    document.addEventListener("keydown", this.onDocumentKeyDown);
    if (this.options.accountPanelMode === "modal") {
      window.setTimeout(() => {
        this.target?.querySelector<HTMLElement>(".xwk-account-panel-modal")?.focus({ preventScroll: true });
      }, 0);
    }
  }

  private removePanelListeners(): void {
    document.removeEventListener("pointerdown", this.onDocumentPointerDown);
    document.removeEventListener("keydown", this.onDocumentKeyDown);
  }

  private syncPanelScrollLock(shouldLock: boolean): void {
    if (shouldLock === this.panelScrollLocked) return;
    this.panelScrollLocked = shouldLock;
    if (shouldLock) {
      lockPageScroll();
    } else {
      unlockPageScroll();
    }
  }

  private async disconnect(): Promise<void> {
    if (this.accountAction) return;
    this.accountAction = "disconnect";
    this.render();
    try {
      await Promise.all([this.options.manager.disconnect(), this.delay(450)]);
      this.options.modal.close();
    } finally {
      this.accountAction = null;
      this.render();
    }
  }

  private async copyAddress(): Promise<void> {
    if (this.accountAction) return;
    const address = this.options.manager.getSession()?.account.address;
    if (!address) return;
    this.accountAction = "copy";
    this.render();
    try {
      await Promise.all([this.copyText(address), this.delay(220)]);
      this.copied = true;
      if (this.copyResetTimer) window.clearTimeout(this.copyResetTimer);
      this.copyResetTimer = window.setTimeout(() => {
        this.copied = false;
        this.render();
      }, 1400);
    } finally {
      this.accountAction = null;
      this.render();
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  private async copyText(value: string): Promise<void> {
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(value);
        return;
      } catch {
        // Fall back for non-HTTPS legacy pages and embedded mobile browsers.
      }
    }
    const input = document.createElement("textarea");
    input.value = value;
    input.setAttribute("readonly", "true");
    input.style.position = "fixed";
    input.style.left = "-9999px";
    document.body.appendChild(input);
    try {
      input.select();
      input.setSelectionRange(0, input.value.length);
      document.execCommand("copy");
    } finally {
      input.remove();
    }
  }

  private async resolveIdentity(session: WalletSession | null): Promise<void> {
    if (!session || !this.shouldShowWeb3Name() || !this.options.identityResolver) {
      this.identityName = null;
      this.identityAvatar = null;
      this.options.onIdentityChange?.(null, session);
      return;
    }
    const requestId = ++this.identityRequest;
    try {
      const result = await this.options.identityResolver(session.account.address, session);
      if (requestId !== this.identityRequest) return;
      const identity = typeof result === "string" ? { name: result } : result ?? null;
      this.identityName = identity?.name ?? null;
      this.identityAvatar = identity?.avatar ?? null;
      this.options.onIdentityChange?.(identity, session);
      this.render();
    } catch {
      if (requestId === this.identityRequest) {
        this.identityName = null;
        this.identityAvatar = null;
        this.options.onIdentityChange?.(null, session);
      }
    }
  }

  private async resolveBalance(session: WalletSession | null): Promise<void> {
    if (!session || !this.options.showBalance || !this.options.balanceResolver) {
      this.balance = null;
      this.activationStatus = "unknown";
      this.options.onBalanceChange?.(null, session);
      return;
    }
    const requestId = ++this.balanceRequest;
    try {
      const result = await this.options.balanceResolver({
        address: session.account.address,
        network: session.account.network,
        session
      });
      if (requestId !== this.balanceRequest) return;
      this.balance = this.normalizeBalance(result);
      this.activationStatus = this.balance?.activationStatus ?? (this.balance ? "active" : "unknown");
      session.account.activationStatus = this.activationStatus;
      this.options.onBalanceChange?.(this.balance, session);
      this.render();
    } catch {
      if (requestId === this.balanceRequest) {
        this.balance = null;
        this.activationStatus = "unknown";
        this.options.onBalanceChange?.(null, session);
        this.render();
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
    const balance = session && this.options.showBalance && this.activationStatus === "unfunded"
      ? `<span class="xwk-button-balance">(Not activated)</span>`
      : session && this.options.showBalance && this.balance?.formatted
      ? `<span class="xwk-button-balance">(${this.escapeHtml(this.balance.formatted)})</span>`
      : "";
    const icon = this.options.showAdapterIcon
      ? this.renderWalletIcon(connected ? session?.wallet : undefined)
      : "";
    const chevron = connected && this.options.showChevron && this.options.accountPanel
      ? `<span class="xwk-button-chevron" aria-hidden="true">${this.chevronIcon()}</span>`
      : "";

    return `<button class="xwk-account-button" data-xwk-wallet-button type="button">${icon}<span class="xwk-button-label">${this.escapeHtml(label)}${balance}</span>${chevron}</button>`;
  }

  private renderPanel(): string {
    const session = this.options.manager.getSession();
    if (!session) return "";
    const content = this.renderPanelContent(session);
    if (this.options.accountPanelMode === "modal") {
      return `<div class="xwk-account-overlay" data-xwk-account-overlay role="presentation"><section class="xwk-account-panel xwk-account-panel-modal" role="dialog" aria-modal="true" aria-label="Connected account" tabindex="-1"><div class="xwk-account-modal-header"><span></span><h2>Connected</h2><button class="xwk-account-close" type="button" data-xwk-account-close aria-label="Close">&times;</button></div><div class="xwk-account-modal-body">${content}</div></section></div>`;
    }

    return `<div class="xwk-account-panel xwk-account-panel-dropdown" role="dialog" aria-label="Connected account">${content}</div>`;
  }

  private renderPanelContent(session: WalletSession): string {
    const address = session.account.address;
    const label = this.getAccountLabel(session);
    const explorerUrl = this.getExplorerUrl(session);
    const copyBusy = this.accountAction === "copy";
    const disconnectBusy = this.accountAction === "disconnect";
    const copyFeedbackIcon = copyBusy ? this.spinnerIcon() : this.copied ? this.copiedIcon() : this.copyIcon();
    const disconnectIcon = disconnectBusy ? this.spinnerIcon() : this.logoutIcon();
    const copy = this.options.copyAddress ? `<button type="button" data-xwk-copy-address${copyBusy || disconnectBusy ? " disabled" : ""}>${copyFeedbackIcon}<span>${copyBusy ? "Copying..." : this.copied ? "Copied" : "Copy address"}</span></button>` : "";
    const explorer = this.options.explorer && explorerUrl ? `<a href="${this.escapeHtml(explorerUrl)}" target="_blank" rel="noreferrer">${this.externalIcon()}<span>View explorer</span></a>` : "";
    const disconnect = this.options.disconnect ? `<button type="button" data-xwk-disconnect${copyBusy || disconnectBusy ? " disabled" : ""}>${disconnectIcon}<span>${disconnectBusy ? "Disconnecting..." : "Disconnect"}</span></button>` : "";
    const nativeAsset = getNativeAsset(session.account.network);
    const notActivated = this.options.showBalance && this.activationStatus === "unfunded"
      ? `<div class="xwk-account-warning">Account not activated. Send ${this.escapeHtml(nativeAsset)} to activate.</div>`
      : "";
    const balance = this.options.showBalance && this.activationStatus !== "unfunded" && this.balance?.formatted
      ? `<div class="xwk-account-balance">${this.escapeHtml(this.balance.formatted)}</div>`
      : "";
    const addressLabel = this.shouldShowWeb3Name() && this.identityName
      ? `<div class="xwk-account-address">${this.escapeHtml(this.formatAddress(address))}</div>`
      : "";
    const actions = `<div class="xwk-account-panel-actions">${copy}${explorer}${disconnect}</div>`;
    return `<div class="xwk-account-hero">${this.renderAccountAvatar(session)}</div><div class="xwk-account-name">${this.escapeHtml(label)}</div>${addressLabel}${balance}${notActivated}${actions}`;
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
    const configured = getExplorerAccountUrl(session.account.network, session.account.address);
    if (configured) return configured;
    const networkType = session.account.network?.networkType ?? session.account.networkType;
    if (networkType === "TESTNET") return `https://testnet.xrpl.org/accounts/${encodeURIComponent(session.account.address)}`;
    if (networkType === "DEVNET") return `https://devnet.xrpl.org/accounts/${encodeURIComponent(session.account.address)}`;
    return `https://livenet.xrpl.org/accounts/${encodeURIComponent(session.account.address)}`;
  }

  private shouldShowWeb3Name(): boolean {
    return this.options.showWeb3Name ?? true;
  }

  private renderWalletIcon(wallet?: WalletMetadata, fallbackIcon?: string): string {
    const icon = wallet?.icon ?? fallbackIcon;
    if (icon) return `<img class="xwk-button-icon" src="${this.escapeHtml(icon)}" alt="">`;
    if (!wallet) return `<span class="xwk-button-icon xwk-button-icon-fallback">${this.walletIcon()}</span>`;
    const label = wallet.name.slice(0, 1).toUpperCase();
    return `<span class="xwk-button-icon xwk-button-icon-fallback">${this.escapeHtml(label)}</span>`;
  }

  private getAccountPanelFocusableElements(): HTMLElement[] {
    const panel = this.target?.querySelector<HTMLElement>(".xwk-account-panel-modal");
    if (!panel) return [];
    const selectors = [
      "button:not([disabled])",
      "a[href]",
      "input:not([disabled])",
      "select:not([disabled])",
      "textarea:not([disabled])",
      "[tabindex]:not([tabindex='-1'])"
    ].join(",");
    return Array.from(panel.querySelectorAll<HTMLElement>(selectors))
      .filter((element) => element.offsetParent !== null);
  }

  private walletIcon(): string {
    return `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4.5 7.5A2.5 2.5 0 0 1 7 5h11.5A1.5 1.5 0 0 1 20 6.5V9H7A2.5 2.5 0 0 1 4.5 6.5v1Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M4 9h15.5A2.5 2.5 0 0 1 22 11.5v5A2.5 2.5 0 0 1 19.5 19h-13A2.5 2.5 0 0 1 4 16.5V9Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M17 13.5h5V17h-5a1.75 1.75 0 1 1 0-3.5Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>`;
  }

  private normalizeBalance(result: WalletBalance | string | number | null): WalletBalance | null {
    if (result == null) return null;
    const symbol = getNativeAsset(this.options.manager.getSession()?.account.network);
    if (typeof result === "string" || typeof result === "number") {
      return { value: String(result), formatted: `${result} ${symbol}`, symbol };
    }
    return {
      ...result,
      formatted: result.formatted || result.availableFormatted || `${result.value} ${result.symbol || symbol}`,
      symbol: result.symbol || symbol,
      activationStatus: result.activationStatus
    };
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

  private spinnerIcon(): string {
    return `<span class="xwk-action-spinner" aria-hidden="true"></span>`;
  }

  private renderStyles(): string {
    const theme = this.resolveTheme();
    const themeMode = this.resolveThemeMode();
    const height = this.options.size === "lg" ? "50px" : this.options.size === "sm" ? "44px" : "46px";
    const radius = this.options.variant === "pill" ? "999px" : theme.walletRadius ?? "10px";
    const background = this.options.variant === "default" || this.options.variant === "pill" ? theme.surface : theme.background;
    const hoverBackground = this.options.variant === "default" || this.options.variant === "pill" ? theme.surfaceHover : theme.surface;
    const border = this.options.variant === "minimal" ? "transparent" : theme.border;
    const actionBorder = themeMode === "dark" ? "rgba(255,255,255,.10)" : "rgba(15,23,42,.08)";
    const fallbackIconBackground = theme.surfaceHover;
    const fallbackIconColor = theme.muted;

    return `.xwk-button-root{display:inline-block;max-width:100%;position:relative;font-family:${theme.fontFamily};font-size:14px}.xwk-account-button{align-items:center;background:${background};border:1px solid ${border};border-radius:${radius};box-shadow:none;box-sizing:border-box;color:${theme.foreground};cursor:pointer;display:inline-flex;gap:8px;font:inherit;font-weight:560;max-width:100%;min-height:${height};padding:0 12px 0 10px;touch-action:manipulation;transition:background-color .16s ease,border-color .16s ease;white-space:nowrap;-webkit-tap-highlight-color:transparent;transform:none}.xwk-account-button:hover{background:${hoverBackground};box-shadow:none;opacity:1;transform:none}.xwk-account-button:active{background:${hoverBackground};opacity:1;transform:none}.xwk-account-button:focus-visible,.xwk-button-chevron:focus-visible,.xwk-account-panel-actions button:focus-visible,.xwk-account-panel-actions a:focus-visible{outline:2px solid ${theme.accent};outline-offset:2px}.xwk-button-icon{background:${theme.background};border:1px solid ${theme.border};border-radius:10px;box-sizing:border-box;display:inline-flex;flex:0 0 auto;height:28px;object-fit:contain;overflow:hidden;width:28px}.xwk-button-icon-fallback{align-items:center;background:${fallbackIconBackground};color:${fallbackIconColor};font-size:12px;justify-content:center}.xwk-button-label{display:inline-block;font-size:13px;font-weight:560;line-height:1.1;max-width:220px;min-width:0;overflow:hidden;padding-right:2px;text-overflow:ellipsis;white-space:nowrap}.xwk-button-balance{color:${theme.muted};font-weight:500;margin-left:4px}.xwk-button-chevron{align-items:center;background:${theme.background};border:1px solid ${theme.border};border-radius:999px;color:${theme.muted};display:inline-flex;flex:0 0 auto;height:26px;justify-content:center;line-height:1;touch-action:manipulation;width:26px}.xwk-button-chevron:hover{background:${theme.surfaceHover};color:${theme.foreground}}.xwk-account-overlay{align-items:center;background:${theme.overlay};display:flex;inset:0;justify-content:center;overscroll-behavior:contain;padding:max(24px,env(safe-area-inset-top)) max(24px,env(safe-area-inset-right)) max(24px,env(safe-area-inset-bottom)) max(24px,env(safe-area-inset-left));position:fixed;z-index:2147483647}.xwk-account-panel{background:${theme.background};border:1px solid ${theme.border};border-radius:${theme.radius};box-shadow:${theme.shadow};color:${theme.foreground};display:grid;gap:12px;overflow:hidden;z-index:2147483647}.xwk-account-panel-dropdown{box-shadow:none;justify-items:center;margin-top:10px;min-width:320px;padding:18px;position:absolute;right:0;top:100%;width:min(360px,calc(100vw - 32px))}.xwk-account-panel-modal{gap:0;max-height:calc(100dvh - 48px - env(safe-area-inset-top) - env(safe-area-inset-bottom));max-width:520px;position:relative;width:min(520px,100%)}.xwk-account-modal-header{align-items:center;border-bottom:1px solid ${theme.border};display:grid;grid-template-columns:44px minmax(0,1fr) 44px;column-gap:8px;padding:8px 18px}.xwk-account-modal-header h2{color:${theme.foreground};font-size:16px;font-weight:500;line-height:1.2;margin:0;min-width:0;overflow:hidden;text-align:center;text-overflow:ellipsis;white-space:nowrap}.xwk-account-modal-body{-webkit-overflow-scrolling:touch;display:grid;gap:12px;justify-items:center;min-height:390px;overflow:auto;overscroll-behavior:contain;padding:22px 28px 28px}.xwk-account-close{-webkit-appearance:none;-webkit-tap-highlight-color:transparent;align-items:center;appearance:none;background:transparent!important;border:0!important;border-radius:999px;box-shadow:none!important;color:${theme.muted};cursor:pointer;display:inline-flex;font-size:26px;font-weight:500;height:44px;justify-content:center;line-height:1;margin:0;min-height:0;outline:none!important;padding:0;touch-action:manipulation;transform:none;width:44px}.xwk-account-close:hover{background:${theme.surfaceHover}!important;box-shadow:none!important;color:${theme.foreground};transform:none}.xwk-account-close:focus-visible{outline:2px solid ${theme.border}!important;outline-offset:0}.xwk-account-hero{height:154px;margin-top:4px;position:relative;width:180px}.xwk-account-panel-dropdown .xwk-account-hero{height:132px;width:160px}.xwk-account-art,.xwk-account-avatar{border-radius:999px;height:118px;left:31px;position:absolute;top:8px;width:118px}.xwk-account-panel-dropdown .xwk-account-art,.xwk-account-panel-dropdown .xwk-account-avatar{height:104px;left:28px;width:104px}.xwk-account-art{align-items:center;background:radial-gradient(circle at 58% 38%,var(--xwk-avatar-spot),transparent 0 22%,transparent 23%),linear-gradient(160deg,var(--xwk-avatar-from),var(--xwk-avatar-to));display:flex;justify-content:center}.xwk-account-art span{background:rgba(255,255,255,.18);border-radius:999px;height:50px;width:50px}.xwk-account-panel-dropdown .xwk-account-art span{height:42px;width:42px}.xwk-account-avatar{background:${theme.surface};border:1px solid ${theme.border};box-sizing:border-box;display:block;object-fit:cover;overflow:hidden}.xwk-account-name{color:${theme.foreground};font-size:21px;font-weight:650;line-height:1.2;max-width:100%;overflow:hidden;text-align:center;text-overflow:ellipsis;white-space:nowrap}.xwk-account-panel-dropdown .xwk-account-name{font-size:18px}.xwk-account-address{background:${theme.surface};border:1px solid ${theme.border};border-radius:12px;color:${theme.muted};font-size:14px;font-weight:520;line-height:1.25;max-width:100%;overflow:hidden;padding:8px 12px;text-align:center;text-overflow:ellipsis;white-space:nowrap}.xwk-account-balance{background:${theme.surface};border:1px solid ${theme.border};border-radius:999px;color:${theme.foreground};font-size:13px;font-weight:560;line-height:1.2;padding:7px 12px;text-align:center}.xwk-account-warning{background:${theme.surface};border:1px solid ${actionBorder};border-radius:12px;box-sizing:border-box;color:${theme.muted};font-size:13px;font-weight:520;line-height:1.35;padding:9px 12px;text-align:center;width:100%}.xwk-account-panel-actions{display:grid;gap:10px;grid-template-columns:1fr;width:100%}.xwk-account-modal-body .xwk-account-panel-actions{margin-top:auto}.xwk-account-panel-actions button,.xwk-account-panel-actions a{align-items:center;background:${theme.surface};border:1px solid ${actionBorder};border-radius:${theme.walletRadius};box-shadow:none;color:${theme.foreground};cursor:pointer;display:flex;font:inherit;font-size:14px;font-weight:560;gap:8px;justify-content:center;min-height:46px;padding:0 12px;text-decoration:none;touch-action:manipulation;-webkit-tap-highlight-color:transparent;transform:none;transition:background-color .16s ease,border-color .16s ease}.xwk-account-panel-actions button:disabled{cursor:wait;opacity:1}.xwk-account-panel-actions svg{flex:0 0 auto;opacity:.58}.xwk-account-panel-actions button:hover,.xwk-account-panel-actions a:hover{background:${theme.surfaceHover};border-color:${actionBorder};box-shadow:none;transform:none}.xwk-account-panel-actions button:active,.xwk-account-panel-actions a:active{background:${theme.surfaceHover};opacity:1;transform:none}.xwk-copied-icon{opacity:1!important}.xwk-action-spinner{animation:xwk-action-spin .8s linear infinite;border:2px solid ${theme.border};border-top-color:${theme.muted};border-radius:999px;box-sizing:border-box;display:inline-block;height:17px;width:17px}@keyframes xwk-action-spin{to{transform:rotate(360deg)}}@media(prefers-reduced-motion:reduce){.xwk-account-button,.xwk-account-panel-actions button,.xwk-account-panel-actions a{transition:none}.xwk-action-spinner{animation:none}}@media(max-width:520px){.xwk-account-panel-dropdown{bottom:0;left:0;margin-top:0;min-width:0;position:fixed;right:0;top:auto;width:100vw}.xwk-account-overlay{align-items:flex-end;padding:max(12px,env(safe-area-inset-top)) 0 0}.xwk-account-panel-modal{align-self:flex-end;border-bottom:0;border-bottom-left-radius:0;border-bottom-right-radius:0;border-left:0;border-right:0;border-top-left-radius:${theme.radius};border-top-right-radius:${theme.radius};height:auto;max-height:calc(100dvh - env(safe-area-inset-top));max-width:none;width:100vw}.xwk-account-modal-header{border-top-left-radius:${theme.radius};border-top-right-radius:${theme.radius};grid-template-columns:44px minmax(0,1fr) 44px;padding:10px 16px}.xwk-account-modal-body{min-height:340px;padding:18px 20px max(22px,calc(22px + env(safe-area-inset-bottom)))}.xwk-button-label{max-width:min(150px,calc(100vw - 140px))}}`;
  }

  private resolveTheme(): ResolvedTheme {
    const mode = this.resolveThemeMode();
    const base = mode === "dark" ? darkTheme : lightTheme;
    return { ...base, ...this.options.theme };
  }

  private resolveThemeMode(): "light" | "dark" {
    return this.options.themeMode === "auto" ? this.getSystemThemeMode() : this.options.themeMode;
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

  return async (address, session) => {
    if (!session || !isMainnetNetwork(session.account.network)) return null;
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

export function createWalletButton(options: WalletButtonOptions) {
  const button = new WalletButtonController(options);
  if (options.target) button.mount(options.target);
  return button;
}


