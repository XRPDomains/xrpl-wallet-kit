import QRCodeStyling from "qr-code-styling";
import { getExplorerAccountUrl, getExplorerTxUrl, getNativeAsset, isMainnetNetwork } from "@xrpl-wallet-kit/core";
import type { WalletSession, WalletTransaction } from "@xrpl-wallet-kit/core";
import { createXrpBalanceResolver } from "./balance";
import { ensureWalletStyle, getWalletStyleId, lockPageScroll, unlockPageScroll } from "./dom";
import { QR_DARK, QR_LIGHT, QR_SIZE } from "./icons";
import { resolveWalletUiMessages } from "./locales";
import { resolveWalletTheme } from "./themes";
import type { ResolvedTheme } from "./themes";
import type { WalletAccountPanelMode, WalletBalance, WalletButtonOptions, WalletButtonTarget, WalletIdentity, WalletIdentityResolver, XrpDomainsResolverOptions } from "./types";
import type { WalletMetadata } from "@xrpl-wallet-kit/core";
export class WalletButtonController {
  private target?: HTMLElement;
  private options: WalletButtonOptions & Required<Pick<WalletButtonOptions, "label" | "showAdapterIcon" | "showChevron" | "showWeb3Name" | "fallbackToAddress" | "copyAddress" | "showAddressQr" | "showRecentTransactions" | "maxVisibleTransactions" | "explorer" | "disconnect" | "accountPanel" | "accountPanelMode" | "showBalance" | "size" | "variant" | "themeMode" | "theme">>;
  private identityName: string | null = null;
  private identityAvatar: string | null = null;
  private identityRequest = 0;
  private identityResolvingKey?: string;
  private identitySettleTimer?: number;
  private readonly identityCache = new Map<string, WalletIdentity | null>();
  private balance: WalletBalance | null = null;
  private balanceLoading = false;
  private activationStatus: "active" | "unfunded" | "unknown" = "unknown";
  private balanceRequest = 0;
  private readonly balanceRefreshTimers = new Set<number>();
  private panelOpen = false;
  private addressQrOpen = false;
  private txSectionOpen = true;
  private panelScrollLocked = false;
  private connecting = false;
  private copied = false;
  private copyInProgress = false;
  private accountAction: "copy" | "disconnect" | null = null;
  private copyResetTimer?: number;
  private accountPanelPortal?: HTMLElement;
  private readonly offEvents: Array<() => void> = [];
  private readonly onDocumentPointerDown = (event: PointerEvent) => this.handleDocumentPointerDown(event);
  private readonly onDocumentKeyDown = (event: KeyboardEvent) => this.handleDocumentKeyDown(event);

  constructor(options: WalletButtonOptions) {
    this.target = this.resolveTarget(options.target);
    const messages = resolveWalletUiMessages(options.language, options.messages);
    this.options = {
      language: options.language,
      messages,
      label: messages.connectWallet,
      showAdapterIcon: true,
      showChevron: true,
      showWeb3Name: true,
      fallbackToAddress: true,
      copyAddress: true,
      showAddressQr: true,
      showRecentTransactions: false,
      maxVisibleTransactions: 5,
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
      this.addressQrOpen = false;
      this.renderConnectedState(session ?? options.manager.getSession());
      void this.resolveBalance(session ?? options.manager.getSession());
    }));
    this.offEvents.push(options.manager.on("session_restored", ({ session }) => {
      this.connecting = false;
      this.renderConnectedState(session);
      void this.resolveBalance(session);
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
      this.addressQrOpen = false;
      this.identityName = null;
      this.identityAvatar = null;
      this.identityRequest += 1;
      this.identityResolvingKey = undefined;
      this.clearIdentitySettleTimer();
      this.clearBalanceRefreshTimers();
      this.balanceRequest += 1;
      this.balance = null;
      this.balanceLoading = false;
      this.activationStatus = "unknown";
      this.render();
    }));
    this.offEvents.push(options.manager.on("tx_submitted", () => {
      this.scheduleBalanceRefresh([1600, 4000]);
      this.render();
    }));
    this.offEvents.push(options.manager.on("tx_confirmed", () => {
      this.clearBalanceRefreshTimers();
      void this.resolveBalance(options.manager.getSession());
      this.render();
    }));
    this.offEvents.push(options.manager.on("tx_failed", () => {
      this.render();
    }));
    this.offEvents.push(options.manager.on("accountChanged", () => {
      this.clearBalanceRefreshTimers();
      void this.resolveBalance(options.manager.getSession());
    }));
    this.offEvents.push(options.manager.on("networkChanged", () => {
      this.clearBalanceRefreshTimers();
      void this.resolveBalance(options.manager.getSession());
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
    const nextMessages = "language" in options || "messages" in options
      ? resolveWalletUiMessages(options.language ?? this.options.language, options.messages ?? this.options.messages)
      : this.options.messages;
    this.options = { ...this.options, ...options, messages: nextMessages };
    if ("showWeb3Name" in options || "identityResolver" in options) {
      void this.resolveIdentity(this.options.manager.getSession());
    }
    if ("showBalance" in options || "balanceResolver" in options) {
      void this.resolveBalance(this.options.manager.getSession());
    }
    this.render();
  }

  refreshIdentity(): Promise<void> {
    return this.resolveIdentity(this.options.manager.getSession(), { force: true });
  }

  refreshBalance(): Promise<void> {
    return this.resolveBalance(this.options.manager.getSession());
  }

  async refreshAccount(): Promise<void> {
    await Promise.all([this.refreshIdentity(), this.refreshBalance()]);
  }

  destroy(): void {
    this.removePanelListeners();
    this.removeAccountPanelPortal();
    this.syncPanelScrollLock(false);
    this.identityRequest += 1;
    this.identityResolvingKey = undefined;
    this.clearBalanceRefreshTimers();
    if (this.copyResetTimer) window.clearTimeout(this.copyResetTimer);
    if (this.identitySettleTimer) window.clearTimeout(this.identitySettleTimer);
    this.offEvents.splice(0).forEach((off) => off());
    if (this.target) this.target.innerHTML = "";
    this.target = undefined;
  }

  render(): void {
    if (!this.target) return;
    this.target.innerHTML = "";
    this.target.appendChild(this.createRoot());
    this.syncAccountPanelPortal();
    this.syncPanelListeners();
  }

  private createRoot(): HTMLElement {
    const root = document.createElement("div");
    root.className = "xwk-button-root";
    const inlinePanel = this.panelOpen && this.options.accountPanelMode !== "modal" ? this.renderPanel() : "";
    this.ensureStyles();
    root.innerHTML = `${this.renderButton()}${inlinePanel}`;
    this.repairFallbackIcon(root);
    root.querySelector<HTMLButtonElement>("[data-xwk-wallet-button]")?.addEventListener("click", (event) => {
      event.stopPropagation();
      this.onButtonClick();
    });
    this.bindPanelActions(root);
    this.renderAddressQrIfNeeded(root);
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
    this.addressQrOpen = false;
    this.render();
  }

  private handleDocumentPointerDown(event: PointerEvent): void {
    if (!this.panelOpen || !this.target) return;
    if (event.target instanceof Node && this.target.contains(event.target)) return;
    if (event.target instanceof Node && this.accountPanelPortal?.contains(event.target)) return;
    this.panelOpen = false;
    this.addressQrOpen = false;
    this.render();
  }

  private handleDocumentKeyDown(event: KeyboardEvent): void {
    if (!this.panelOpen) return;
    if (event.key === "Escape") {
      this.panelOpen = false;
      this.addressQrOpen = false;
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
        this.getAccountPanelRoot()?.focus({ preventScroll: true });
      }, 0);
    }
  }

  private syncAccountPanelPortal(): void {
    if (!this.panelOpen || this.options.accountPanelMode !== "modal") {
      this.removeAccountPanelPortal();
      return;
    }
    const portal = this.accountPanelPortal ?? document.createElement("div");
    const entering = !this.accountPanelPortal;
    portal.className = "xwk-account-portal";
    portal.dataset.xwkEntering = entering ? "true" : "false";
    this.ensureStyles();
    portal.innerHTML = this.renderPanel();
    if (entering) document.body.appendChild(portal);
    this.accountPanelPortal = portal;
    this.bindPanelActions(portal);
    this.renderAddressQrIfNeeded(portal);
  }

  private removeAccountPanelPortal(): void {
    this.accountPanelPortal?.remove();
    this.accountPanelPortal = undefined;
  }

  private bindPanelActions(root: ParentNode): void {
    root.querySelector<HTMLButtonElement>("[data-xwk-account-close]")?.addEventListener("click", () => this.closePanel());
    root.querySelector<HTMLButtonElement>("[data-xwk-account-back]")?.addEventListener("click", (event) => {
      event.stopPropagation();
      this.closeAddressQr();
    });
    root.querySelector<HTMLElement>("[data-xwk-account-overlay]")?.addEventListener("click", (event) => {
      if (event.target === event.currentTarget) this.closePanel();
    });
    root.querySelector<HTMLButtonElement>("[data-xwk-copy-address]")?.addEventListener("click", (event) => {
      event.stopPropagation();
      void this.copyAddress();
    });
    root.querySelector<HTMLButtonElement>("[data-xwk-address-qr]")?.addEventListener("click", (event) => {
      event.stopPropagation();
      this.openAddressQr();
    });
    root.querySelector<HTMLButtonElement>("[data-xwk-tx-toggle]")?.addEventListener("click", (event) => {
      event.stopPropagation();
      this.txSectionOpen = !this.txSectionOpen;
      this.render();
    });
    root.querySelector<HTMLButtonElement>("[data-xwk-disconnect]")?.addEventListener("click", () => void this.disconnect());
  }

  private openAddressQr(): void {
    if (!this.options.manager.getSession()) return;
    this.panelOpen = true;
    this.addressQrOpen = true;
    this.render();
  }

  private closeAddressQr(): void {
    this.addressQrOpen = false;
    this.panelOpen = true;
    this.render();
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
    if (this.copyInProgress || this.accountAction) return;
    const address = this.getSessionAddress(this.options.manager.getSession());
    if (!address) return;
    this.copyInProgress = true;
    try {
      await this.copyText(address);
      this.copied = true;
      if (this.copyResetTimer) window.clearTimeout(this.copyResetTimer);
      this.copyResetTimer = window.setTimeout(() => {
        this.copied = false;
        this.render();
      }, 1400);
    } finally {
      this.copyInProgress = false;
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

  private async resolveIdentity(session: WalletSession | null, options: { force?: boolean } = {}): Promise<void> {
    const address = this.getSessionAddress(session);
    if (!session || !address || !this.shouldShowWeb3Name() || !this.options.identityResolver) {
      this.identityName = null;
      this.identityAvatar = null;
      this.identityResolvingKey = undefined;
      this.options.onIdentityChange?.(null, session);
      this.clearIdentitySettleTimer();
      return;
    }
    const requestId = ++this.identityRequest;
    const cacheKey = this.identityCacheKey(session);
    if (options.force) this.identityCache.delete(cacheKey);
    this.identityResolvingKey = cacheKey;
    try {
      const result = await this.options.identityResolver(address, session, { force: options.force });
      if (requestId !== this.identityRequest) return;
      const identity = typeof result === "string" ? { name: result } : result ?? null;
      this.identityName = identity?.name ?? null;
      this.identityAvatar = identity?.avatar ?? null;
      this.identityCache.set(cacheKey, identity);
      this.options.onIdentityChange?.(identity, session);
      this.clearIdentitySettleTimer();
      this.render();
    } catch {
      if (requestId === this.identityRequest) {
        this.identityName = null;
        this.identityAvatar = null;
        this.identityCache.set(cacheKey, null);
        this.options.onIdentityChange?.(null, session);
        this.clearIdentitySettleTimer();
        this.render();
      }
    } finally {
      if (requestId === this.identityRequest && this.identityResolvingKey === cacheKey) {
        this.identityResolvingKey = undefined;
      }
    }
  }

  private renderConnectedState(session: WalletSession | null): void {
    if (!session || !this.getSessionAddress(session) || !this.shouldShowWeb3Name() || !this.options.identityResolver) {
      this.clearIdentitySettleTimer();
      this.identityName = null;
      this.identityAvatar = null;
      this.render();
      return;
    }

    const cacheKey = this.identityCacheKey(session);
    const cached = this.identityCache.get(cacheKey);
    if (cached !== undefined) {
      this.identityName = cached?.name ?? null;
      this.identityAvatar = cached?.avatar ?? null;
      this.clearIdentitySettleTimer();
      this.render();
      if (this.identityResolvingKey !== cacheKey) void this.resolveIdentity(session);
      return;
    }

    this.identityName = null;
    this.identityAvatar = null;
    if (this.identityResolvingKey !== cacheKey) void this.resolveIdentity(session);
    this.clearIdentitySettleTimer();
    this.identitySettleTimer = window.setTimeout(() => {
      this.identitySettleTimer = undefined;
      this.render();
    }, 260);
  }

  private clearIdentitySettleTimer(): void {
    if (!this.identitySettleTimer) return;
    window.clearTimeout(this.identitySettleTimer);
    this.identitySettleTimer = undefined;
  }

  private identityCacheKey(session: WalletSession): string {
    return `${session.account.network?.id ?? session.account.networkType ?? "unknown"}:${this.getSessionAddress(session)}`;
  }

  private async resolveBalance(session: WalletSession | null): Promise<void> {
    if (!session || !this.options.showBalance || !this.options.balanceResolver) {
      this.balance = null;
      this.balanceLoading = false;
      this.activationStatus = "unknown";
      if (session) delete session.balance;
      this.options.onBalanceChange?.(null, session);
      return;
    }
    const requestId = ++this.balanceRequest;
    const address = this.getSessionAddress(session);
    if (!address) {
      this.balance = null;
      this.balanceLoading = false;
      this.activationStatus = "unknown";
      delete session.balance;
      this.options.onBalanceChange?.(null, session);
      return;
    }
    this.balanceLoading = true;
    this.render();
    try {
      const result = await this.options.balanceResolver({
        address,
        network: session.account.network,
        session
      });
      if (requestId !== this.balanceRequest) return;
      this.balance = this.normalizeBalance(result);
      this.activationStatus = this.balance?.activationStatus ?? (this.balance ? "active" : "unknown");
      session.account.activationStatus = this.activationStatus;
      if (this.balance) {
        session.balance = this.balance;
      } else {
        delete session.balance;
      }
      this.options.onBalanceChange?.(this.balance, session);
      this.balanceLoading = false;
      this.render();
    } catch {
      if (requestId === this.balanceRequest) {
        this.balance = null;
        this.balanceLoading = false;
        this.activationStatus = "unknown";
        delete session.balance;
        this.options.onBalanceChange?.(null, session);
        this.render();
      }
    } finally {
      if (requestId === this.balanceRequest) this.balanceLoading = false;
    }
  }

  private renderButton(): string {
    const messages = this.messages();
    const session = this.options.manager.getSession();
    const connected = Boolean(session);
    const label = this.connecting
      ? messages.connecting
      : session
        ? this.getAccountLabel(session)
        : this.options.label;
    const balance = session && this.options.showBalance && this.balanceLoading
      ? `<span class="xwk-button-balance xwk-button-balance-loading">${this.balanceSpinnerIcon()}</span>`
      : session && this.options.showBalance && this.activationStatus === "unfunded"
      ? `<span class="xwk-button-balance">(${this.escapeHtml(messages.notActivated)})</span>`
      : session && this.options.showBalance && this.balance?.formatted
      ? `<span class="xwk-button-balance">(${this.escapeHtml(this.balance.formatted)})</span>`
      : "";
    const icon = this.options.showAdapterIcon
      ? this.renderWalletIcon(connected ? session?.wallet : undefined)
      : "";
    const pendingDot = connected && this.options.showRecentTransactions && this.getPendingTransactionCount() > 0
      ? `<span class="xwk-button-pending-dot" aria-hidden="true"></span>`
      : "";
    const chevron = connected && this.options.showChevron && this.options.accountPanel
      ? `<span class="xwk-button-chevron" aria-hidden="true">${this.chevronIcon()}</span>`
      : "";

    return `<button class="xwk-account-button" data-xwk-wallet-button type="button">${icon}${pendingDot}<span class="xwk-button-label">${this.escapeHtml(label)}${balance}</span>${chevron}</button>`;
  }

  private renderPanel(): string {
    const messages = this.messages();
    const session = this.options.manager.getSession();
    if (!session) return "";
    const content = this.addressQrOpen ? this.renderAddressQrPanelContent(session) : this.renderPanelContent(session);
    const title = this.addressQrOpen ? messages.addressQr : messages.connected;
    const hasTransactions = !this.addressQrOpen && this.options.showRecentTransactions && this.getVisibleTransactions(session).length > 0;
    const panelStateClass = `${this.addressQrOpen ? " xwk-account-panel-address-qr" : ""}${hasTransactions ? " xwk-account-panel-with-transactions" : ""}`;
    const leading = this.addressQrOpen
      ? `<button class="xwk-account-back" type="button" data-xwk-account-back aria-label="${this.escapeHtml(messages.back)}">${this.backIcon()}</button>`
      : `<span></span>`;
    if (this.options.accountPanelMode === "modal") {
      return `<div class="xwk-account-overlay" data-xwk-account-overlay role="presentation"><section class="xwk-account-panel xwk-account-panel-modal${panelStateClass}" role="dialog" aria-modal="true" aria-label="${this.escapeHtml(title)}" tabindex="-1"><div class="xwk-account-modal-header">${leading}<h2>${this.escapeHtml(title)}</h2><button class="xwk-account-close" type="button" data-xwk-account-close aria-label="${this.escapeHtml(messages.close)}">&times;</button></div><div class="xwk-account-modal-body">${content}</div></section></div>`;
    }

    return `<div class="xwk-account-panel xwk-account-panel-dropdown${panelStateClass}" role="dialog" aria-label="${this.escapeHtml(title)}">${content}</div>`;
  }

  private renderPanelContent(session: WalletSession): string {
    const messages = this.messages();
    const address = this.getSessionAddress(session);
    const label = this.getAccountLabel(session);
    const explorerUrl = this.getExplorerUrl(session);
    const disconnectBusy = this.accountAction === "disconnect";
    const copyFeedbackIcon = this.copied ? this.copiedIcon() : this.copyIcon();
    const disconnectIcon = disconnectBusy ? this.spinnerIcon() : this.logoutIcon();
    const copy = this.options.copyAddress ? `<button type="button" data-xwk-copy-address${disconnectBusy ? " disabled" : ""}>${copyFeedbackIcon}<span>${this.copied ? this.escapeHtml(messages.copied) : this.escapeHtml(messages.copyAddress)}</span></button>` : "";
    const explorer = this.options.explorer && explorerUrl ? `<a href="${this.escapeHtml(explorerUrl)}" target="_blank" rel="noreferrer">${this.externalIcon()}<span>${this.escapeHtml(messages.viewExplorer)}</span></a>` : "";
    const disconnect = this.options.disconnect ? `<button type="button" data-xwk-disconnect${this.copyInProgress || disconnectBusy ? " disabled" : ""}>${disconnectIcon}<span>${disconnectBusy ? this.escapeHtml(messages.disconnecting) : this.escapeHtml(messages.disconnect)}</span></button>` : "";
    const nativeAsset = getNativeAsset(session.account.network);
    const notActivated = this.options.showBalance && this.activationStatus === "unfunded"
      ? `<div class="xwk-account-warning">${this.escapeHtml(messages.accountNotActivated(nativeAsset))}</div>`
      : "";
    const balance = this.options.showBalance && this.balanceLoading
      ? `<div class="xwk-account-balance xwk-account-balance-loading">${this.balanceSpinnerIcon()}<span>${this.escapeHtml(messages.connecting)}</span></div>`
      : this.options.showBalance && this.activationStatus !== "unfunded" && this.balance?.formatted
      ? `<div class="xwk-account-balance">${this.escapeHtml(this.balance.formatted)}</div>`
      : "";
    const metaRow = balance ? `<div class="xwk-account-meta-row">${balance}</div>` : "";
    const addressQrButton = this.renderAddressQrButton(address);
    const hasIdentity = this.shouldShowWeb3Name() && this.identityName;
    const addressLabel = hasIdentity && address
      ? `<div class="xwk-account-address">${this.escapeHtml(this.formatAddress(address))}${addressQrButton}</div>`
      : "";
    const actions = `<div class="xwk-account-panel-actions">${copy}${explorer}${disconnect}</div>`;
    const accountName = !hasIdentity && addressQrButton && this.options.fallbackToAddress
      ? `<div class="xwk-account-name xwk-account-name-with-qr xwk-account-name-address"><span>${this.escapeHtml(label)}</span>${addressQrButton}</div>`
      : `<div class="xwk-account-name">${this.escapeHtml(label)}</div>`;
    const transactions = this.renderTransactionHistory(session);
    return `<div class="xwk-account-hero">${this.renderAccountAvatar(session)}</div>${accountName}${addressLabel}${metaRow}${notActivated}${transactions}${actions}`;
  }

  private renderAddressQrPanelContent(session: WalletSession): string {
    const messages = this.messages();
    const address = this.getSessionAddress(session);
    if (!address) return "";
    const copyFeedbackIcon = this.copied ? this.copiedIcon() : this.copyIcon();
    const copy = this.options.copyAddress ? `<button type="button" data-xwk-copy-address>${copyFeedbackIcon}<span>${this.copied ? this.escapeHtml(messages.copied) : this.escapeHtml(messages.copyAddress)}</span></button>` : "";
    return `<div class="xwk-address-qr-content"><div class="xwk-address-qr-code" data-xwk-address-qr-code data-address="${this.escapeHtml(address)}" aria-hidden="true"></div><div class="xwk-address-qr-chip">${this.escapeHtml(address)}</div><div class="xwk-account-panel-actions">${copy}</div></div>`;
  }

  private renderAddressQrButton(address?: string): string {
    if (!this.options.showAddressQr || !address) return "";
    const messages = this.messages();
    return `<button class="xwk-address-qr-trigger" type="button" data-xwk-address-qr aria-label="${this.escapeHtml(messages.showAddressQr)}" title="${this.escapeHtml(messages.showAddressQr)}">${this.qrIcon()}</button>`;
  }

  private renderTransactionHistory(session: WalletSession): string {
    if (!this.options.showRecentTransactions) return "";
    const transactions = this.getVisibleTransactions(session);
    if (!transactions.length) return "";
    const messages = this.messages();
    const count = transactions.length > 9 ? "9+" : String(transactions.length);
    const chevronClass = this.txSectionOpen ? "open" : "closed";
    const list = this.txSectionOpen
      ? `<div class="xwk-tx-list" role="list">${transactions.map((transaction) => this.renderTransactionRow(transaction)).join("")}</div>`
      : "";
    return `<section class="xwk-tx-section" aria-label="${this.escapeHtml(messages.recentTransactions)}"><button class="xwk-tx-header" type="button" data-xwk-tx-toggle aria-expanded="${this.txSectionOpen ? "true" : "false"}"><span>${this.escapeHtml(messages.recentTransactions)}</span><span class="xwk-tx-count">${this.escapeHtml(count)}</span><span class="xwk-tx-chevron ${chevronClass}" aria-hidden="true">${this.chevronUpIcon()}</span></button>${list}</section>`;
  }

  private renderTransactionRow(transaction: WalletTransaction): string {
    const messages = this.messages();
    const label = this.transactionStatusLabel(transaction);
    const explorerUrl = this.getTransactionExplorerUrl(transaction);
    const link = explorerUrl
      ? `<a class="xwk-tx-link" href="${this.escapeHtml(explorerUrl)}" target="_blank" rel="noreferrer">${this.escapeHtml(messages.view)}${this.externalIcon()}</a>`
      : "";
    return `<div class="xwk-tx-row xwk-tx-row-${this.escapeHtml(transaction.status)}" role="listitem"><span class="xwk-tx-status" aria-hidden="true">${this.transactionStatusIcon(transaction.status)}</span><div class="xwk-tx-main"><span class="xwk-tx-label">${this.escapeHtml(label)}</span><span class="xwk-tx-hash">${this.escapeHtml(this.formatHash(transaction.hash))} &middot; ${this.escapeHtml(this.formatRelativeTime(transaction))}</span></div>${link}</div>`;
  }

  private transactionStatusLabel(transaction: WalletTransaction): string {
    const messages = this.messages();
    if (transaction.status === "confirmed") return messages.transactionConfirmed;
    if (transaction.status === "failed") return messages.transactionFailed;
    if (transaction.status === "unknown") return messages.transactionUnknown;
    return messages.transactionSubmitted;
  }

  private transactionStatusIcon(status: WalletTransaction["status"]): string {
    if (status === "confirmed") return this.checkIcon();
    if (status === "failed") return this.closeIcon();
    if (status === "unknown") return this.questionIcon();
    return `<span class="xwk-tx-spinner" aria-hidden="true"></span>`;
  }

  private getVisibleTransactions(session: WalletSession): WalletTransaction[] {
    const address = this.getSessionAddress(session);
    const max = Math.max(1, Math.floor(this.options.maxVisibleTransactions));
    return this.getRecentTransactions(session)
      .filter((transaction) => !address || !transaction.account?.address || transaction.account.address === address)
      .slice(0, max);
  }

  private getRecentTransactions(session?: WalletSession | null): WalletTransaction[] {
    const transactions = this.options.manager.getTransactions?.() ?? [];
    const networkId = session?.account.network?.id;
    return [...transactions].sort((a, b) => this.transactionTimestamp(b) - this.transactionTimestamp(a))
      .filter((transaction) => !networkId || !transaction.account?.network?.id || transaction.account.network.id === networkId);
  }

  private getPendingTransactionCount(): number {
    return this.getRecentTransactions(this.options.manager.getSession()).filter((transaction) => transaction.status === "submitted").length;
  }

  private transactionTimestamp(transaction: WalletTransaction): number {
    return transaction.confirmedAt ?? transaction.failedAt ?? transaction.submittedAt ?? 0;
  }

  private getTransactionExplorerUrl(transaction: WalletTransaction): string | undefined {
    const custom = this.options.transactionExplorerUrl?.(transaction.hash, transaction.account?.network);
    if (custom) return custom;
    return getExplorerTxUrl(transaction.account?.network, transaction.hash);
  }

  private formatHash(hash: string): string {
    return hash.length > 12 ? `${hash.slice(0, 6)}...${hash.slice(-6)}` : hash;
  }

  private formatRelativeTime(transaction: WalletTransaction): string {
    const timestamp = this.transactionTimestamp(transaction);
    if (!timestamp) return "";
    const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
    if (seconds < 60) return "just now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hr ago`;
    if (hours < 48) return "yesterday";
    return `${Math.floor(hours / 24)} days ago`;
  }

  private getAccountLabel(session: WalletSession): string {
    if (this.shouldShowWeb3Name() && this.identityName) return this.identityName;
    if (!this.options.fallbackToAddress) return session.wallet?.name ?? session.adapterId;
    const address = this.getSessionAddress(session);
    return address ? (this.options.formatAddress ?? this.formatAddress)(address) : session.wallet?.name ?? session.adapterId;
  }

  private renderAccountAvatar(session: WalletSession): string {
    if (this.identityAvatar) {
      return `<img class="xwk-account-avatar" src="${this.escapeHtml(this.identityAvatar)}" alt="">`;
    }
    const [from, to, spot] = this.getAddressGradient(this.getSessionAddress(session));
    return `<div class="xwk-account-art" style="--xwk-avatar-from:${from};--xwk-avatar-to:${to};--xwk-avatar-spot:${spot}"><span></span></div>`;
  }

  private getExplorerUrl(session: WalletSession): string | undefined {
    if (this.options.explorerUrl) return this.options.explorerUrl(session);
    const address = this.getSessionAddress(session);
    if (!address) return undefined;
    const configured = getExplorerAccountUrl(session.account.network, address);
    if (configured) return configured;
    const networkType = session.account.network?.networkType ?? session.account.networkType;
    if (networkType === "TESTNET") return `https://testnet.xrpl.org/accounts/${encodeURIComponent(address)}`;
    if (networkType === "DEVNET") return `https://devnet.xrpl.org/accounts/${encodeURIComponent(address)}`;
    return `https://livenet.xrpl.org/accounts/${encodeURIComponent(address)}`;
  }

  private getSessionAddress(session: WalletSession | null | undefined): string {
    const account = session?.account as ({ address?: unknown; classicAddress?: unknown } | undefined);
    const address = typeof account?.address === "string" ? account.address : "";
    if (address) return address;
    return typeof account?.classicAddress === "string" ? account.classicAddress : "";
  }

  private shouldShowWeb3Name(): boolean {
    return this.options.showWeb3Name ?? true;
  }

  private messages() {
    return resolveWalletUiMessages(this.options.language, this.options.messages);
  }

  private renderWalletIcon(wallet?: WalletMetadata, fallbackIcon?: string): string {
    const icon = wallet?.icon ?? fallbackIcon;
    if (icon) return `<img class="xwk-button-icon" src="${this.escapeHtml(icon)}" alt="">`;
    if (!wallet) return `<span class="xwk-button-icon xwk-button-icon-fallback xwk-button-icon-svg-fallback" aria-hidden="true">${this.walletIcon()}</span>`;
    const label = wallet.name.slice(0, 1).toUpperCase();
    return `<span class="xwk-button-icon xwk-button-icon-fallback xwk-button-icon-initial" aria-hidden="true">${this.escapeHtml(label)}</span>`;
  }

  private repairFallbackIcon(root: HTMLElement): void {
    root.querySelectorAll<HTMLElement>(".xwk-button-icon-svg-fallback").forEach((icon) => {
      if (icon.querySelector("svg")) return;
      icon.innerHTML = this.walletIcon();
    });
  }

  private getAccountPanelFocusableElements(): HTMLElement[] {
    const panel = this.getAccountPanelRoot();
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

  private getAccountPanelRoot(): HTMLElement | null {
    return this.accountPanelPortal?.querySelector<HTMLElement>(".xwk-account-panel-modal")
      ?? this.target?.querySelector<HTMLElement>(".xwk-account-panel-modal")
      ?? null;
  }

  private walletIcon(): string {
    return `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4.5 7.5A2.5 2.5 0 0 1 7 5h11.5A1.5 1.5 0 0 1 20 6.5V9H7A2.5 2.5 0 0 1 4.5 6.5v1Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M4 9h15.5A2.5 2.5 0 0 1 22 11.5v5A2.5 2.5 0 0 1 19.5 19h-13A2.5 2.5 0 0 1 4 16.5V9Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M17 13.5h5V17h-5a1.75 1.75 0 1 1 0-3.5Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>`;
  }

  private backIcon(): string {
    return `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M15 18l-6-6 6-6" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  }

  private qrIcon(): string {
    return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 4h6v6H4V4Zm10 0h6v6h-6V4ZM4 14h6v6H4v-6Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M14 14h2v2h-2v-2Zm4 0h2v2h-2v-2Zm-4 4h2v2h-2v-2Zm4 0h2v2h-2v-2Z" fill="currentColor"/></svg>`;
  }

  private renderAddressQrIfNeeded(root: ParentNode): void {
    if (!this.addressQrOpen) return;
    const container = root.querySelector<HTMLElement>("[data-xwk-address-qr-code]");
    const address = container?.dataset.address;
    if (!container || !address || container.dataset.xwkRendered === address) return;
    container.dataset.xwkRendered = address;
    container.replaceChildren();
    try {
      const qrColor = this.resolveThemeMode() === "dark" ? QR_LIGHT : QR_DARK;
      const qrCode = new QRCodeStyling({
        width: QR_SIZE,
        height: QR_SIZE,
        type: "svg",
        data: address,
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
      const fallback = document.createElement("div");
      fallback.className = "xwk-address-qr-fallback";
      fallback.textContent = address;
      container.replaceChildren(fallback);
    }
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

  private scheduleBalanceRefresh(delays: number[]): void {
    if (!this.options.showBalance || !this.options.balanceResolver) return;
    this.clearBalanceRefreshTimers();
    delays.forEach((delay) => {
      let timer = 0;
      timer = window.setTimeout(() => {
        this.balanceRefreshTimers.delete(timer);
        void this.resolveBalance(this.options.manager.getSession());
      }, delay);
      this.balanceRefreshTimers.add(timer);
    });
  }

  private clearBalanceRefreshTimers(): void {
    this.balanceRefreshTimers.forEach((timer) => window.clearTimeout(timer));
    this.balanceRefreshTimers.clear();
  }

  private chevronIcon(): string {
    return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="m6 9 6 6 6-6" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  }

  private chevronUpIcon(): string {
    return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="m18 15-6-6-6 6" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  }

  private checkIcon(): string {
    return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="m5 12.5 4.2 4.2L19 7" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  }

  private closeIcon(): string {
    return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="m7 7 10 10M17 7 7 17" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>`;
  }

  private questionIcon(): string {
    return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M9.7 9a2.4 2.4 0 1 1 3.8 2c-.9.6-1.5 1.1-1.5 2.4" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M12 17h.01" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>`;
  }

  private copyIcon(): string {
    return `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="8" y="8" width="11" height="11" rx="2" stroke="currentColor" stroke-width="2"/><path d="M5 15H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;
  }

  private copiedIcon(): string {
    return `<svg class="xwk-copied-icon" width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="currentColor"/><path d="m7.8 12.4 2.7 2.7 5.9-6.2" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
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

  private balanceSpinnerIcon(): string {
    return `<span class="xwk-balance-spinner" aria-hidden="true"></span>`;
  }

  private ensureStyles(): void {
    const styles = this.renderStyles();
    ensureWalletStyle(getWalletStyleId("xwk-button", styles), styles);
  }

  private renderStyles(): string {
        const theme = this.resolveTheme();
        const themeMode = this.resolveThemeMode();
        const height = this.options.size === "lg" ? "50px" : this.options.size === "sm" ? "44px" : "46px";
        const radius = this.options.variant === "pill" ? "999px" : theme.walletRadius ?? "10px";
        const background = this.options.variant === "default" || this.options.variant === "pill" ? theme.surface : theme.background;
        const hoverBackground = this.options.variant === "default" || this.options.variant === "pill" ? theme.surfaceHover : theme.surface;
        const border = this.options.variant === "minimal" ? "transparent" : theme.border;
        const iconBorder = this.resolveVisibleBorder(theme.border);
        const actionBorder = themeMode === "dark" ? "rgba(255,255,255,.10)" : "rgba(15,23,42,.08)";
        const fallbackIconBackground = theme.fallbackIconBackground;
        const fallbackIconColor = theme.fallbackIconColor;
        const overlayBlur = theme.overlayBlur > 0 ? `blur(${theme.overlayBlur}px)` : "none";
        return `.xwk-button-root{display:inline-block;max-width:100%;position:relative;font-family:${theme.fontFamily};font-size:14px}.xwk-account-button{align-items:center;background:${background};border:1px solid ${border};border-radius:${radius};box-shadow:none;box-sizing:border-box;color:${theme.foreground};cursor:pointer;display:inline-flex;gap:8px;font:inherit;font-weight:560;max-width:100%;min-height:${height};overflow:hidden;padding:0 12px 0 10px;touch-action:manipulation;transition:background-color .16s ease,border-color .16s ease;white-space:nowrap;-webkit-tap-highlight-color:transparent;transform:none}.xwk-account-button:hover{background:${hoverBackground};box-shadow:none;opacity:1;transform:none}.xwk-account-button:active{background:${hoverBackground};opacity:1;transform:none}.xwk-account-button:focus-visible,.xwk-button-chevron:focus-visible,.xwk-account-panel-actions button:focus-visible,.xwk-account-panel-actions a:focus-visible,.xwk-address-qr-trigger:focus-visible,.xwk-tx-header:focus-visible,.xwk-tx-link:focus-visible{outline:2px solid ${theme.accent};outline-offset:2px;text-decoration:none}.xwk-button-icon{background:${theme.background};border:1px solid ${iconBorder};border-radius:10px;box-sizing:border-box;display:inline-flex;flex:0 0 28px;height:28px;isolation:isolate;line-height:0;max-width:28px;min-width:28px;object-fit:contain;overflow:hidden;position:relative;width:28px}.xwk-button-icon-fallback{align-items:center;background:${fallbackIconBackground};color:${fallbackIconColor};justify-content:center}.xwk-button-icon-initial{font-size:12px;line-height:1}.xwk-button-icon-svg-fallback{font-size:0}.xwk-button-icon-svg-fallback svg{display:block;flex:0 0 17px;height:17px;max-height:17px;max-width:17px;min-height:17px;min-width:17px;width:17px}.xwk-button-pending-dot{background:${theme.accent};border:2px solid ${background};border-radius:999px;box-sizing:border-box;flex:0 0 9px;height:9px;margin-left:-13px;margin-right:4px;position:relative;width:9px;z-index:1}.xwk-button-label{display:inline-block;flex:1 1 0;font-size:13px;font-weight:560;line-height:1.1;max-width:220px;min-width:0;overflow:hidden;padding-right:2px;text-overflow:ellipsis;white-space:nowrap}.xwk-button-balance{color:${theme.muted};font-weight:500;margin-left:4px}.xwk-button-balance-loading{display:inline-flex;vertical-align:-2px}.xwk-balance-spinner{animation:xwk-action-spin .8s linear infinite;border:2px solid ${theme.spinnerTrail};border-top-color:${theme.muted};border-radius:999px;box-sizing:border-box;display:inline-block;flex:0 0 13px;height:13px;width:13px}.xwk-button-chevron{align-items:center;background:${theme.background};border:1px solid ${iconBorder};border-radius:999px;color:${theme.muted};display:inline-flex;flex:0 0 26px;height:26px;justify-content:center;line-height:1;touch-action:manipulation;width:26px}.xwk-button-chevron:hover{background:${theme.surfaceHover};color:${theme.foreground}}.xwk-account-overlay{align-items:center;background:${theme.overlay};-webkit-backdrop-filter:${overlayBlur};backdrop-filter:${overlayBlur};display:flex;inset:0;justify-content:center;overscroll-behavior:contain;padding:max(24px,env(safe-area-inset-top)) max(24px,env(safe-area-inset-right)) max(24px,env(safe-area-inset-bottom)) max(24px,env(safe-area-inset-left));position:fixed;z-index:2147483647}.xwk-account-portal[data-xwk-entering="true"] .xwk-account-overlay{animation:xwk-account-overlay-in .18s ease-out}.xwk-account-panel{background:${theme.background};border:1px solid ${theme.border};border-radius:${theme.radius};box-shadow:${theme.shadow};box-sizing:border-box;color:${theme.foreground};display:grid;gap:12px;overflow:hidden;z-index:2147483647}.xwk-account-panel:focus{outline:none}.xwk-account-panel-dropdown{box-shadow:none;justify-items:center;margin-top:10px;min-width:320px;padding:18px;position:absolute;right:0;top:100%;width:min(360px,calc(100vw - 32px))}.xwk-account-panel-modal{gap:0;grid-template-rows:auto minmax(0,1fr);height:min(527px,calc(100dvh - 48px - env(safe-area-inset-top) - env(safe-area-inset-bottom)));max-width:520px;position:relative;transform-origin:center bottom;width:min(520px,100%)}.xwk-account-panel-modal.xwk-account-panel-with-transactions{height:min(650px,calc(100dvh - 48px - env(safe-area-inset-top) - env(safe-area-inset-bottom)))}.xwk-account-portal[data-xwk-entering="true"] .xwk-account-panel-modal{animation:xwk-account-panel-in .22s cubic-bezier(.22,1,.36,1)}.xwk-account-modal-header{align-items:center;background:${theme.headerBackground};border-bottom:1px solid ${theme.border};display:grid;grid-template-columns:44px minmax(0,1fr) 44px;column-gap:8px;padding:8px 18px}.xwk-account-modal-header h2{color:${theme.foreground};font-size:16px;font-weight:500;line-height:1.2;margin:0;min-width:0;overflow:hidden;text-align:center;text-overflow:ellipsis;white-space:nowrap}.xwk-account-modal-body{-webkit-overflow-scrolling:touch;align-items:center;display:flex;flex-direction:column;gap:12px;min-height:0;overflow:hidden;overscroll-behavior:contain;padding:22px 28px 28px}.xwk-account-panel-with-transactions .xwk-account-modal-body{overflow:auto;padding-top:14px}.xwk-account-modal-body>.xwk-account-hero,.xwk-account-modal-body>.xwk-account-name,.xwk-account-modal-body>.xwk-account-address,.xwk-account-modal-body>.xwk-account-meta-row,.xwk-account-modal-body>.xwk-account-warning,.xwk-account-modal-body>.xwk-tx-section,.xwk-account-modal-body>.xwk-account-panel-actions{flex-shrink:0}.xwk-account-close,.xwk-account-back{-webkit-appearance:none;-webkit-tap-highlight-color:transparent;align-items:center;appearance:none;background:transparent!important;border:0!important;border-radius:999px;box-shadow:none!important;color:${theme.muted};cursor:pointer;display:inline-flex;font:inherit;font-size:26px;font-weight:500;height:44px;justify-content:center;line-height:1;margin:0;min-height:0;outline:none!important;padding:0;touch-action:manipulation;transform:none;width:44px}.xwk-account-back{font-size:0;justify-self:start}.xwk-account-close{justify-self:end}.xwk-account-close:hover,.xwk-account-back:hover{background:${theme.surfaceHover}!important;box-shadow:none!important;color:${theme.foreground};transform:none}.xwk-account-close:focus-visible,.xwk-account-back:focus-visible{outline:2px solid ${theme.accent}!important;outline-offset:0}.xwk-account-hero{height:154px;margin-top:4px;position:relative;width:180px}.xwk-account-panel-with-transactions .xwk-account-hero{height:126px;margin-bottom:0}.xwk-account-panel-with-transactions .xwk-account-art,.xwk-account-panel-with-transactions .xwk-account-avatar{top:0}.xwk-account-panel-dropdown .xwk-account-hero{height:132px;width:160px}.xwk-account-art,.xwk-account-avatar{border-radius:999px;height:118px;left:31px;position:absolute;top:8px;width:118px}.xwk-account-panel-dropdown .xwk-account-art,.xwk-account-panel-dropdown .xwk-account-avatar{height:104px;left:28px;width:104px}.xwk-account-art{align-items:center;background:radial-gradient(circle at 58% 38%,var(--xwk-avatar-spot),transparent 0 22%,transparent 23%),linear-gradient(160deg,var(--xwk-avatar-from),var(--xwk-avatar-to));display:flex;justify-content:center}.xwk-account-art span{background:rgba(255,255,255,.18);border-radius:999px;height:50px;width:50px}.xwk-account-panel-dropdown .xwk-account-art span{height:42px;width:42px}.xwk-account-avatar{background:${theme.surface};border:1px solid ${iconBorder};box-sizing:border-box;display:block;object-fit:cover;overflow:hidden}.xwk-account-panel-with-transactions .xwk-account-name{position:relative;z-index:1}.xwk-account-name{color:${theme.foreground};font-size:21px;font-weight:650;line-height:1.2;max-width:100%;overflow:hidden;text-align:center;text-overflow:ellipsis;white-space:nowrap}.xwk-account-panel-dropdown .xwk-account-name{font-size:18px}.xwk-account-name-with-qr,.xwk-account-address{align-items:center;display:inline-flex;gap:6px;justify-content:center}.xwk-account-name-with-qr span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.xwk-account-name-address{background:${theme.surface};border:1px solid ${theme.border};border-radius:14px;color:${theme.muted};font-size:16px;font-weight:600;line-height:1.2;max-width:min(260px,100%);padding:7px 6px 7px 14px}.xwk-account-address{background:${theme.surface};border:1px solid ${theme.border};border-radius:12px;color:${theme.muted};font-size:14px;font-weight:520;line-height:1.25;max-width:100%;overflow:hidden;padding:8px 8px 8px 12px;text-align:center;text-overflow:ellipsis;white-space:nowrap}.xwk-address-qr-trigger{-webkit-appearance:none;-webkit-tap-highlight-color:transparent;align-items:center;appearance:none;background:transparent;border:0;border-radius:10px;box-shadow:none;color:currentColor;cursor:pointer;display:inline-flex;flex:0 0 34px;height:34px;justify-content:center;margin:-4px -3px -4px 0;min-height:0;outline:none;overflow:visible;padding:0;touch-action:manipulation;transform:none;width:34px}.xwk-address-qr-trigger svg{display:block;height:17px;overflow:visible;width:17px}.xwk-address-qr-trigger:hover{background:${theme.surfaceHover};box-shadow:none;transform:none}.xwk-account-meta-row{align-items:center;display:flex;gap:8px;justify-content:center;max-width:100%;min-height:42px}.xwk-account-balance{align-items:center;background:${theme.surface};border:1px solid ${actionBorder};border-radius:999px;box-sizing:border-box;color:${theme.muted};display:inline-flex;font-size:13px;font-weight:560;height:42px;justify-content:center;letter-spacing:0;line-height:1;padding:0 14px;text-align:center}.xwk-account-balance-loading{align-items:center;display:inline-flex;gap:6px}.xwk-account-warning{align-items:center;background:${theme.surface};border:1px solid ${actionBorder};border-radius:12px;box-sizing:border-box;color:${theme.muted};display:flex;font-size:13px;font-weight:520;justify-content:center;line-height:1.25;min-height:54px;padding:0 14px;text-align:center;width:100%}.xwk-address-qr-content{align-content:center;display:grid;gap:14px;justify-items:center;min-height:100%;width:100%}.xwk-address-qr-code{aspect-ratio:1/1;background:${theme.surface};border:1px solid ${theme.border};border-radius:14px;box-sizing:border-box;display:grid;max-width:304px;padding:12px;place-items:center;width:min(304px,100%)}.xwk-address-qr-code svg,.xwk-address-qr-code canvas,.xwk-address-qr-code img{aspect-ratio:1/1;display:block;height:auto;max-width:100%;width:100%}.xwk-address-qr-chip{background:${theme.surface};border:1px solid ${theme.border};border-radius:12px;box-sizing:border-box;color:${theme.muted};font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:12px;font-weight:520;line-height:1.45;max-width:100%;overflow-wrap:anywhere;padding:9px 11px;text-align:center;width:100%}.xwk-address-qr-fallback{color:${theme.muted};font-size:12px;line-height:1.45;overflow-wrap:anywhere}.xwk-tx-section{background:${theme.surface};border:1px solid ${actionBorder};border-radius:${theme.walletRadius};box-sizing:border-box;display:grid;overflow:hidden;width:100%}.xwk-tx-header{-webkit-appearance:none;-webkit-tap-highlight-color:transparent;align-items:center;appearance:none;background:${theme.surface}!important;border:0!important;box-shadow:none!important;color:${theme.muted};cursor:pointer;display:flex;font:inherit;font-size:10px;font-weight:650;gap:6px;letter-spacing:.07em;line-height:1.2;margin:0;min-height:34px;outline:none;padding:0 12px;text-align:left;text-transform:uppercase;touch-action:manipulation;transform:none;transition:background-color .16s ease,color .16s ease;width:100%}.xwk-tx-header:hover,.xwk-tx-header:active{background:${theme.surfaceHover}!important;border:0!important;box-shadow:none!important;color:${theme.foreground};opacity:1;text-decoration:none;transform:none}.xwk-tx-count{align-items:center;background:${theme.background};border:1px solid ${actionBorder};border-radius:999px;box-sizing:border-box;color:${theme.muted};display:inline-flex;font-size:10px;font-weight:650;height:16px;justify-content:center;letter-spacing:0;line-height:1;min-width:18px;padding:0 5px;text-transform:none}.xwk-tx-chevron{align-items:center;color:${theme.muted};display:inline-flex;flex:0 0 16px;height:16px;justify-content:center;margin-left:auto;transition:transform .18s ease;width:16px}.xwk-tx-chevron.closed{transform:rotate(-90deg)}.xwk-tx-chevron svg{display:block;height:12px;width:12px}.xwk-tx-list{-webkit-overflow-scrolling:touch;display:grid;gap:0;max-height:86px;overflow:auto;overscroll-behavior:contain;scrollbar-color:${theme.muted} transparent;scrollbar-width:thin}.xwk-tx-list::-webkit-scrollbar{width:6px}.xwk-tx-list::-webkit-scrollbar-track{background:transparent}.xwk-tx-list::-webkit-scrollbar-thumb{background:${theme.muted};border-radius:999px}.xwk-tx-row{align-items:center;background:${theme.surface};border-top:1px solid ${actionBorder};box-sizing:border-box;display:grid;gap:8px;grid-template-columns:24px minmax(0,1fr) auto;min-height:42px;padding:7px 10px;transition:background-color .16s ease}.xwk-tx-row:hover{background:${theme.surface};box-shadow:none;transform:none}.xwk-tx-row:first-child{border-top:0}.xwk-tx-status{align-items:center;background:${theme.background};border-radius:999px;color:${theme.accent};display:inline-flex;height:24px;justify-content:center;width:24px}.xwk-tx-row-confirmed .xwk-tx-status{color:${theme.success}}.xwk-tx-row-failed .xwk-tx-status{color:${theme.error}}.xwk-tx-row-unknown .xwk-tx-status{color:${theme.muted}}.xwk-tx-main{display:grid;gap:2px;min-width:0}.xwk-tx-label{color:${theme.foreground};font-size:12px;font-weight:600;line-height:1.15;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.xwk-tx-hash{color:${theme.muted};font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:11px;line-height:1.15;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.xwk-tx-link{align-items:center;border-radius:9px;color:${theme.accent};display:inline-flex;font:inherit;font-size:12px;font-weight:650;gap:3px;line-height:1.2;min-height:28px;padding:0 6px;text-decoration:none}.xwk-tx-link:hover{background:${theme.surfaceHover};box-shadow:none;text-decoration:none;transform:none}.xwk-tx-link svg{height:12px;width:12px}.xwk-tx-empty{background:${theme.surface};border:1px solid ${actionBorder};border-radius:${theme.walletRadius};box-sizing:border-box;color:${theme.muted};font-size:13px;line-height:1.35;padding:14px;text-align:center;width:100%}.xwk-tx-spinner{animation:xwk-action-spin .8s linear infinite;border:2px solid ${theme.spinnerTrail};border-top-color:${theme.accent};border-radius:999px;box-sizing:border-box;display:block;height:14px;width:14px}.xwk-account-panel-actions{display:grid;gap:10px;grid-template-columns:1fr;width:100%}.xwk-account-modal-body .xwk-account-panel-actions{margin-top:auto}.xwk-account-panel-with-transactions .xwk-account-modal-body .xwk-account-panel-actions{margin-top:0}.xwk-account-panel-actions button,.xwk-account-panel-actions a{-webkit-appearance:none;-webkit-tap-highlight-color:transparent;align-items:center;appearance:none;background:${theme.surface};border:1px solid ${actionBorder};border-radius:${theme.walletRadius};box-shadow:none;box-sizing:border-box;color:${theme.foreground};cursor:pointer;display:flex;font:inherit;font-size:14px;font-weight:560;gap:8px;justify-content:center;line-height:1.2;min-height:46px;min-width:0;outline:none;overflow:hidden;padding:0 12px;text-decoration:none;touch-action:manipulation;transform:none;transition:background-color .16s ease,border-color .16s ease;width:100%}.xwk-account-panel-actions button:disabled{cursor:wait;opacity:1}.xwk-account-panel-actions svg{flex:0 0 auto;opacity:.58}.xwk-account-panel-actions span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.xwk-account-panel-actions button:hover,.xwk-account-panel-actions a:hover{background:${theme.surfaceHover};border-color:${actionBorder};box-shadow:none;text-decoration:none;transform:none}.xwk-account-panel-actions button:active,.xwk-account-panel-actions a:active{background:${theme.surfaceHover};opacity:1;text-decoration:none;transform:none}.xwk-copied-icon{color:${theme.success};opacity:1!important}.xwk-action-spinner{animation:xwk-action-spin .8s linear infinite;border:2px solid ${theme.spinnerTrail};border-top-color:${theme.muted};border-radius:999px;box-sizing:border-box;display:inline-block;height:17px;width:17px}@keyframes xwk-action-spin{to{transform:rotate(360deg)}}@keyframes xwk-account-overlay-in{from{opacity:0}to{opacity:1}}@keyframes xwk-account-panel-in{from{opacity:0;transform:translateY(8px) scale(.98)}to{opacity:1;transform:translateY(0) scale(1)}}@media(prefers-reduced-motion:reduce){.xwk-account-button,.xwk-tx-chevron,.xwk-account-panel-actions button,.xwk-account-panel-actions a{transition:none}.xwk-account-portal[data-xwk-entering="true"] .xwk-account-overlay,.xwk-account-portal[data-xwk-entering="true"] .xwk-account-panel-modal{animation-duration:1ms!important}.xwk-action-spinner,.xwk-balance-spinner,.xwk-tx-spinner{animation:none}}@media(max-width:520px){.xwk-account-panel-dropdown{bottom:0;left:0;margin-top:0;min-width:0;position:fixed;right:0;top:auto;width:100vw}.xwk-account-overlay{align-items:flex-end;padding:max(12px,env(safe-area-inset-top)) 0 0}.xwk-account-panel-modal{align-self:flex-end;border-bottom:0;border-bottom-left-radius:0;border-bottom-right-radius:0;border-left:0;border-right:0;border-top-left-radius:${theme.radius};border-top-right-radius:${theme.radius};height:min(527px,calc(100dvh - env(safe-area-inset-top)));max-width:none;width:100vw}.xwk-account-portal[data-xwk-entering="true"] .xwk-account-panel-modal{animation:xwk-account-sheet-in .28s cubic-bezier(.32,.72,0,1)}.xwk-account-modal-header{border-top-left-radius:${theme.radius};border-top-right-radius:${theme.radius};grid-template-columns:44px minmax(0,1fr) 44px;padding:10px 16px}.xwk-account-modal-body{min-height:0;padding:18px 20px max(22px,calc(22px + env(safe-area-inset-bottom)))}.xwk-button-label{max-width:min(150px,calc(100vw - 140px))}}@keyframes xwk-account-sheet-in{from{opacity:1;transform:translateY(100%)}to{opacity:1;transform:translateY(0)}}`;
  }
  private resolveTheme(): ResolvedTheme {
    return resolveWalletTheme({
      mode: this.resolveThemeMode(),
      themeName: this.options.themeName,
      theme: this.options.theme,
      customTheme: this.options.customTheme
    });
  }

  private resolveVisibleBorder(border: string | undefined): string {
    const value = typeof border === "string" ? border.trim().toLowerCase() : "";
    if (!value || value === "transparent" || value === "none") {
      return this.resolveThemeMode() === "dark" ? "rgba(255,255,255,.12)" : "rgba(15,23,42,.08)";
    }
    return border ?? (this.resolveThemeMode() === "dark" ? "rgba(255,255,255,.12)" : "rgba(15,23,42,.08)");
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

  private escapeHtml(value: unknown): string {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
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

  return async (address, session, context) => {
    if (!session || !isMainnetNetwork(session.account.network)) return null;
    const cached = cache.get(address);
    if (!context?.force && cached && cached.expiresAt > Date.now()) return cached.value;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
    try {
      const params = `address=${encodeURIComponent(address)}${context?.force ? `&_=${Date.now()}` : ""}`;
      const url = `${endpoint}${endpoint.includes("?") ? "&" : "?"}${params}`;
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
    return normalizeAvatarUrl(findAvatarUrl(json), endpoint);
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

function normalizeAvatarUrl(value: string | undefined, endpoint: string): string | undefined {
  if (!value) return undefined;
  if (/^(?:https?:|data:|blob:|ipfs:|ar:)/i.test(value)) return value;
  if (value.startsWith("//")) {
    try {
      return `${new URL(endpoint).protocol}${value}`;
    } catch {
      return value;
    }
  }
  try {
    const base = new URL(endpoint);
    return new URL(value.replace(/^\/+/, ""), `${base.origin}/`).toString();
  } catch {
    return value;
  }
}

export function createWalletButton(options: WalletButtonOptions) {
  const button = new WalletButtonController(options);
  if (options.target) button.mount(options.target);
  return button;
}



