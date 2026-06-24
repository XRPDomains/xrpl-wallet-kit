import QRCodeStyling from "qr-code-styling";
import QRCode from "qrcode";
import { WalletKitErrorCode, getErrorMessage, isWalletKitError } from "@xrpl-wallet-kit/core";
import type { WalletAdapter, WalletMetadata, WalletNetwork, WalletSession } from "@xrpl-wallet-kit/core";
import { resolveWalletUiOptions } from "./config";
import { resolveWalletUiMessages } from "./locales";
import { darkTheme, lightTheme } from "./themes";
import { ensureWalletStyle, getWalletStyleId, lockPageScroll, unlockPageScroll } from "./dom";
import { QR_DARK, QR_LIGHT, QR_SIZE, WALLETCONNECT_GROUP_ICON } from "./icons";
import type { WalletInlineOptions, WalletInlineTarget, WalletUiConfig, WalletUiGroup, WalletUiLayout, WalletUiOptions, WalletUiSize, WalletUiTextSize, WalletUiTheme, WalletUiThemeMode } from "./types";

type WalletModalView = "list" | "connect" | "qr";

interface NetworkBadgeStyle {
    label: string;
    dotColor: string;
    badgeBg: string;
    badgeBorder: string;
    textColor: string;
}

type WalletQrState =
    | { status: "loading"; adapterId: string; walletName: string }
    | { status: "ready"; adapterId: string; walletName: string; uri: string; deeplink?: string; copied: boolean }
    | { status: "rejected"; adapterId?: string; walletName: string }
    | { status: "timeout"; adapterId?: string; walletName: string }
    | { status: "error"; adapterId?: string; walletName: string; message: string; uri?: string; deeplink?: string };

type WalletPickerPresentation = "modal" | "inline";
let walletPickerInstanceId = 0;

class WalletPickerView {
    protected options: WalletUiOptions;
    protected root?: HTMLDivElement;
    protected readonly presentation: WalletPickerPresentation;
    private readonly titleId: string;
    private qrUri: string;
    private qrCopied: boolean;
    private qrLightMode: boolean;
    private qrState?: WalletQrState;
    private pendingQr?: { adapterId: string; uri: string; deeplink?: string };
    private availability: Record<string, boolean>;
    private offEvents: Array<() => void>;
    private openHandlers: Set<() => void>;
    private closeHandlers: Set<() => void>;
    private connectHandlers: Set<(session: WalletSession) => void>;
    private onDocumentKeyDown: (event: KeyboardEvent) => void;
    private lastFocusedElement: HTMLElement | null = null;
    private qrCopyResetTimer?: number;
    private activeRequestAdapterId?: string;
    private activeGroupId?: string;
    private cachedStyleKey = "";
    private cachedStyle = "";
    private closeTimer?: number;

    constructor(options: WalletUiOptions, presentation: WalletPickerPresentation) {
        this.qrUri = "";
        this.qrCopied = false;
        this.qrLightMode = false;
        this.availability = {};
        this.offEvents = [];
        this.openHandlers = new Set();
        this.closeHandlers = new Set();
        this.connectHandlers = new Set();
        this.presentation = presentation;
        this.titleId = `xwk-title-${++walletPickerInstanceId}`;
        this.onDocumentKeyDown = (event) => this.handleDocumentKeyDown(event);
        this.options = { manager: options.manager, mount: options.mount, ...resolveWalletUiOptions(options) };
        this.offEvents.push(options.manager.on("qr", ({ adapterId, uri, deeplink }) => this.showQr(adapterId, uri, deeplink)), options.manager.on("connecting", ({ adapterId, recovering }) => {
            if (!recovering)
                this.setLoading(adapterId);
        }), options.manager.on("connected", ({ adapterId, session }) => this.handleConnected(adapterId, session ?? options.manager.getSession())), options.manager.on("error", ({ adapterId, error }) => this.setError(error, adapterId)));
    }
    autoOpen() {
        this.open();
    }
    open() {
        this.activeGroupId = undefined;
        this.lastFocusedElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        this.renderView("list");
        this.openHandlers.forEach((handler) => handler());
        void this.refreshAvailability();
        if (this.pendingQr) {
            const { adapterId, uri, deeplink } = this.pendingQr;
            this.pendingQr = undefined;
            this.showQr(adapterId, uri, deeplink);
        }
    }
    close(notify = true, restoreFocus = notify, animate = true) {
        document.removeEventListener("keydown", this.onDocumentKeyDown);
        if (this.qrCopyResetTimer)
            window.clearTimeout(this.qrCopyResetTimer);
        if (notify)
            void this.options.manager.cancelPendingConnection();
        this.resetQrState();
        const root = this.root;
        if (!root?.isConnected) {
            this.root = undefined;
            if (this.presentation === "modal")
                unlockPageScroll();
            if (restoreFocus)
                this.restoreFocus();
            if (notify)
                this.closeHandlers.forEach((handler) => handler());
            return;
        }
        const finishClose = () => {
            if (this.closeTimer) {
                window.clearTimeout(this.closeTimer);
                this.closeTimer = undefined;
            }
            root.remove();
            if (this.root === root)
                this.root = undefined;
            if (this.presentation === "modal")
                unlockPageScroll();
            if (restoreFocus)
                this.restoreFocus();
            if (notify)
                this.closeHandlers.forEach((handler) => handler());
        };
        if (this.presentation === "inline" || !animate || this.prefersReducedMotion()) {
            finishClose();
            return;
        }
        root.dataset.xwkState = "closing";
        if (this.closeTimer)
            window.clearTimeout(this.closeTimer);
        this.closeTimer = window.setTimeout(finishClose, 190);
    }
    destroy() {
        void this.options.manager.cancelPendingConnection();
        this.close(false, false, false);
        if (this.qrCopyResetTimer)
            window.clearTimeout(this.qrCopyResetTimer);
        if (this.closeTimer)
            window.clearTimeout(this.closeTimer);
        this.offEvents.splice(0).forEach((off) => off());
        this.openHandlers.clear();
        this.closeHandlers.clear();
        this.connectHandlers.clear();
    }
    isOpen(): boolean {
        return Boolean(this.root?.isConnected);
    }
    on(event: "open" | "close", handler: () => void): () => void;
    on(event: "connect", handler: (session: WalletSession) => void): () => void;
    on(event: "open" | "close" | "connect", handler: (() => void) | ((session: WalletSession) => void)): () => void {
        if (event === "connect") {
            const connectHandler = handler as (session: WalletSession) => void;
            this.connectHandlers.add(connectHandler);
            return () => {
                this.connectHandlers.delete(connectHandler);
            };
        }
        const handlers = event === "open" ? this.openHandlers : this.closeHandlers;
        const lifecycleHandler = handler as () => void;
        handlers.add(lifecycleHandler);
        return () => {
            handlers.delete(lifecycleHandler);
        };
    }
    onClose(handler: () => void): () => void {
        return this.on("close", handler);
    }
    updateOptions(options: WalletUiConfig & Partial<Pick<WalletUiOptions, "mount">>) {
        this.options = { ...this.options, mount: options.mount ?? this.options.mount, ...resolveWalletUiOptions(options) };
        this.activeGroupId = undefined;
    }
    private bind() {
        this.root?.querySelector("[data-xwk-close]")?.addEventListener("click", () => this.close());
        this.root?.querySelector("[data-xwk-back]")?.addEventListener("click", () => this.handleBack());
        this.root?.querySelector("[data-xwk-copy]")?.addEventListener("click", () => void this.copyQrUri());
        this.root?.querySelector("[data-xwk-retry]")?.addEventListener("click", () => void this.retryQrConnection());
        this.bindGroupButtons();
        this.bindWalletButtons();
        this.focusInitialElement();
    }
    private bindGroupButtons() {
        this.root?.querySelectorAll<HTMLElement>("[data-wallet-group-id]").forEach((button) => button.addEventListener("click", () => {
            const id = button.dataset.walletGroupId;
            if (id)
                this.showWalletGroup(id);
        }));
    }
    private bindWalletButtons() {
        this.root?.querySelectorAll<HTMLElement>("[data-wallet-id]").forEach((button) => button.addEventListener("click", async () => {
            const id = button.dataset.walletId;
            if (!id)
                return;
            const wallet = this.options.manager.getWallets().find((item) => item.id === id);
            const adapter = this.options.manager.getAdapter(id);
            try {
                if (this.shouldDelegateToWalletConnectModal(wallet, adapter)) {
                    if (this.presentation === "modal")
                        this.close(false, false, false);
                    else
                        this.activeRequestAdapterId = id;
                    await this.waitForPaint();
                    await this.options.manager.connect(id);
                    return;
                }
                this.setLoading(id);
                await this.waitForPaint();
                await this.options.manager.connect(id);
            }
            catch {
                // WalletManager emits the detailed error event; this catch keeps the click handler settled.
            }
        }));
    }
    private shouldDelegateToWalletConnectModal(wallet: WalletMetadata | undefined, adapter: WalletAdapter | undefined): boolean {
        return Boolean(this.isDefaultWalletConnectUiMode() && wallet?.id === "walletconnect" && wallet.type === "walletconnect" && adapter);
    }
    private bindChrome() {
        this.root?.querySelector("[data-xwk-close]")?.addEventListener("click", () => this.close());
        this.root?.querySelector("[data-xwk-back]")?.addEventListener("click", () => this.handleBack());
        this.root?.querySelector("[data-xwk-copy]")?.addEventListener("click", () => void this.copyQrUri());
        this.root?.querySelector("[data-xwk-qr-theme]")?.addEventListener("click", () => this.toggleQrTheme());
        this.root?.querySelector("[data-xwk-retry]")?.addEventListener("click", () => void this.retryQrConnection());
        this.focusInitialElement();
    }
    private handleBack() {
        const groupId = this.activeGroupId;
        if (this.root?.dataset.xwkView === "qr" && groupId && this.getGroups().some((group) => group.id === groupId)) {
            void this.options.manager.cancelPendingConnection();
            this.resetQrState();
            this.renderView("list", false);
            this.showWalletGroup(groupId);
            return;
        }
        if (this.root?.dataset.xwkView === "qr" || this.root?.dataset.xwkView === "connect")
            void this.options.manager.cancelPendingConnection();
        this.showList();
    }
    private async retryQrConnection() {
        const adapterId = this.qrState?.adapterId;
        if (!adapterId)
            return;
        const button = this.root?.querySelector<HTMLButtonElement>("[data-xwk-retry]");
        if (button) {
            button.disabled = true;
            button.classList.add("xwk-retrying");
            button.innerHTML = `${this.refreshIcon()} ${this.escapeHtml(this.messages().retrying)}`;
        }
        try {
            await this.waitForPaint();
            this.setLoading(adapterId);
            await this.waitForPaint();
            await this.options.manager.connect(adapterId);
        }
        catch {
            // WalletManager emits the detailed error event; keep the retry handler settled.
        }
    }
    private async copyQrUri() {
        if (!this.qrUri)
            return;
        await this.copyText(this.qrUri);
        this.qrCopied = true;
        if (this.qrState?.status === "ready")
            this.qrState = { ...this.qrState, copied: true };
        this.updateQrCopyButton();
        if (this.qrCopyResetTimer)
            window.clearTimeout(this.qrCopyResetTimer);
        this.qrCopyResetTimer = window.setTimeout(() => {
            this.qrCopied = false;
            if (this.qrState?.status === "ready")
                this.qrState = { ...this.qrState, copied: false };
            this.updateQrCopyButton();
        }, 1400);
    }
    private toggleQrTheme() {
        if (this.qrState?.status !== "ready")
            return;
        this.qrLightMode = !this.qrLightMode;
        const code = this.root?.querySelector(".xwk-qr-code");
        if (code instanceof HTMLElement)
            void this.renderQr(code, this.qrState.uri);
        this.updateQrThemeButton();
    }
    private async copyText(value: string): Promise<void> {
        if (navigator.clipboard?.writeText) {
            try {
                await navigator.clipboard.writeText(value);
                return;
            }
            catch {
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
        }
        finally {
            input.remove();
        }
    }
    private resetQrState() {
        this.activeRequestAdapterId = undefined;
        if (this.qrCopyResetTimer) {
            window.clearTimeout(this.qrCopyResetTimer);
            this.qrCopyResetTimer = undefined;
        }
        this.qrUri = "";
        this.qrCopied = false;
        this.qrLightMode = false;
        this.pendingQr = undefined;
        this.qrState = undefined;
    }
    private updateQrCopyButton() {
        const button = this.root?.querySelector("[data-xwk-copy]");
        if (!button)
            return;
        button.innerHTML = this.renderQrCopyButtonContent();
        const liveRegion = this.root?.querySelector("[data-xwk-copy-live]");
        if (liveRegion)
            liveRegion.textContent = this.qrCopied ? this.messages().qrUriCopied : "";
    }
    private updateQrThemeButton() {
        const button = this.root?.querySelector("[data-xwk-qr-theme]");
        if (!button)
            return;
        button.innerHTML = this.qrThemeIcon();
        button.setAttribute("aria-label", this.qrLightMode ? "Use dark QR" : "Use light QR");
        button.setAttribute("title", this.qrLightMode ? "Use dark QR" : "Use light QR");
        button.setAttribute("aria-pressed", String(this.qrLightMode));
    }
    protected renderView(view: WalletModalView, animate = true) {
        const pendingQr = this.pendingQr;
        const activeRequestAdapterId = this.activeRequestAdapterId;
        this.close(false, false, false);
        this.pendingQr = pendingQr;
        this.activeRequestAdapterId = activeRequestAdapterId;
        if (this.presentation === "modal") {
            this.removeExistingOverlays();
            lockPageScroll();
        }
        this.root = document.createElement("div");
        this.root.className = this.presentation === "inline" ? "xwk-overlay xwk-inline" : "xwk-overlay";
        this.root.dataset.xwkView = view;
        this.root.dataset.xwkState = animate ? "opening" : "open";
        this.root.innerHTML = this.renderShell();
        (this.options.mount ?? document.body).appendChild(this.root);
        if (animate) {
            window.requestAnimationFrame(() => {
                if (this.root?.isConnected)
                    this.root.dataset.xwkState = "open";
            });
        }
        if (this.presentation === "modal") {
            this.root.addEventListener("click", (event) => {
                if (event.target === this.root)
                    this.close();
            });
            document.addEventListener("keydown", this.onDocumentKeyDown);
        }
        this.bind();
    }
    private ensureMounted(view: WalletModalView) {
        if (!this.root?.isConnected || !this.root.querySelector(".xwk-modal")) {
            this.renderView(view);
            return;
        }
        this.setView(view);
    }
    private setView(view: WalletModalView) {
        if (this.root)
            this.root.dataset.xwkView = view;
        this.focusInitialElement();
    }
    private handleDocumentKeyDown(event: KeyboardEvent) {
        if (!this.root?.isConnected)
            return;
        if (event.key === "Escape") {
            event.preventDefault();
            this.close();
            return;
        }
        if (event.key !== "Tab")
            return;
        const focusable = this.getFocusableElements();
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
    private focusInitialElement() {
        if (this.presentation === "inline")
            return;
        window.setTimeout(() => {
            if (!this.root?.isConnected)
                return;
            this.root.querySelector<HTMLElement>(".xwk-modal")?.focus({ preventScroll: true });
        }, 0);
    }
    private restoreFocus() {
        if (!this.lastFocusedElement?.isConnected)
            return;
        this.lastFocusedElement.focus({ preventScroll: true });
        this.lastFocusedElement = null;
    }
    private getFocusableElements(): HTMLElement[] {
        if (!this.root)
            return [];
        const selectors = [
            "button:not([disabled])",
            "a[href]",
            "input:not([disabled])",
            "select:not([disabled])",
            "textarea:not([disabled])",
            "[tabindex]:not([tabindex='-1'])"
        ].join(",");
        return Array.from(this.root.querySelectorAll<HTMLElement>(selectors))
            .filter((element) => element.offsetParent !== null && !element.classList.contains("xwk-hidden"));
    }
    private removeExistingOverlays() {
        const mount = this.options.mount ?? document.body;
        mount.querySelectorAll(".xwk-overlay").forEach((element) => element.remove());
    }
    private prefersReducedMotion(): boolean {
        return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    }
    private getGroups(): WalletUiGroup[] {
        if (this.options.walletConnectUiMode !== "group")
            return [];
        if (this.options.groups?.length)
            return this.options.groups;
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
        if (!walletOrder?.length)
            return wallets;
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
    private async refreshAvailability() {
        this.availability = await this.options.manager.getWalletAvailability();
        if (this.root?.dataset.xwkView !== "list")
            return;
        const grid = this.root.querySelector(".xwk-grid");
        if (!grid)
            return;
        const layout = this.options.layout ?? "list";
        const activeGroup = this.activeGroupId ? this.getGroups().find((group) => group.id === this.activeGroupId) : undefined;
        grid.innerHTML = activeGroup
            ? this.getGroupWallets(activeGroup).map((wallet) => this.renderWallet(wallet, layout)).join("")
            : this.renderWalletList(layout);
        this.bindGroupButtons();
        this.bindWalletButtons();
    }
    private showList() {
        this.activeGroupId = undefined;
        this.resetQrState();
        if (!this.root?.querySelector(".xwk-list")) {
            this.renderView("list", false);
            return;
        }
        this.ensureMounted("list");
        this.root?.querySelector(".xwk-list")?.classList.remove("xwk-hidden");
        this.root?.querySelector(".xwk-qr")?.classList.add("xwk-hidden");
        this.root?.querySelector(".xwk-connect")?.classList.add("xwk-hidden");
        this.root?.querySelector("[data-xwk-back]")?.classList.add("xwk-hidden");
        const title = this.root?.querySelector(".xwk-title");
        if (title)
            title.textContent = this.options.title ?? this.messages().connectWallet;
        const grid = this.root?.querySelector(".xwk-grid");
        if (grid)
            grid.innerHTML = this.renderWalletList(this.options.layout ?? "list");
        this.bindGroupButtons();
        this.bindWalletButtons();
    }
    private showWalletGroup(groupId: string) {
        const group = this.getGroups().find((item) => item.id === groupId);
        if (!group || !this.root)
            return;
        this.resetQrState();
        this.activeGroupId = groupId;
        this.ensureMounted("list");
        this.root.querySelector(".xwk-list")?.classList.remove("xwk-hidden");
        this.root.querySelector(".xwk-qr")?.classList.add("xwk-hidden");
        this.root.querySelector(".xwk-connect")?.classList.add("xwk-hidden");
        this.root.querySelector("[data-xwk-back]")?.classList.remove("xwk-hidden");
        const title = this.root.querySelector(".xwk-title");
        if (title)
            title.textContent = group.name;
        const grid = this.root.querySelector(".xwk-grid");
        if (grid)
            grid.innerHTML = this.getGroupWallets(group).map((wallet) => this.renderWallet(wallet, this.options.layout ?? "list")).join("");
        this.bindWalletButtons();
    }
    private showQr(adapterId: string, uri: string, deeplink?: string) {
        if (this.isStaleAdapterEvent(adapterId))
            return;
        if (!this.root) {
            this.pendingQr = { adapterId, uri, deeplink };
            return;
        }
        this.qrUri = uri;
        const wallet = this.options.manager.getWallets().find((item) => item.id === adapterId);
        this.qrCopied = false;
        this.qrLightMode = false;
        this.qrState = {
            status: "ready",
            adapterId,
            walletName: wallet?.name ?? "WalletConnect",
            uri,
            deeplink,
            copied: false
        };
        this.renderQrShell(this.qrState);
        const code = this.root?.querySelector(".xwk-qr-code");
        if (code instanceof HTMLElement)
            void this.renderQr(code, uri);
    }
    private setLoading(adapterId: string) {
        this.activeRequestAdapterId = adapterId;
        const wallet = this.options.manager.getWallets().find((item) => item.id === adapterId);
        const adapter = this.options.manager.getAdapter(adapterId);
        if (this.shouldUseCustomWalletConnectQr(wallet, adapter)) {
            this.qrUri = "";
            this.qrCopied = false;
            this.qrState = {
                status: "loading",
                adapterId,
                walletName: wallet?.name ?? adapterId
            };
            this.renderQrShell(this.qrState);
            return;
        }
        this.renderConnectShell(wallet, adapterId);
    }
    private setError(error: unknown, adapterId?: string) {
        if (adapterId && this.isStaleAdapterEvent(adapterId))
            return;
        if (!adapterId && !this.activeRequestAdapterId && this.root?.dataset.xwkView !== "qr")
            return;
        const message = this.getFriendlyErrorMessage(error);
        if (this.root?.dataset.xwkView === "qr" || this.qrState) {
            const previous = this.qrState;
            if (this.isRejectedError(error, message)) {
                this.qrUri = "";
                this.qrCopied = false;
                this.qrState = {
                    status: "rejected",
                    adapterId: previous?.adapterId,
                    walletName: previous?.walletName ?? "WalletConnect"
                };
                this.renderQrShell(this.qrState);
                return;
            }
            if (this.isTimeoutError(error, message)) {
                this.qrUri = "";
                this.qrCopied = false;
                this.qrState = {
                    status: "timeout",
                    adapterId: previous?.adapterId,
                    walletName: previous?.walletName ?? "WalletConnect"
                };
                this.renderQrShell(this.qrState);
                return;
            }
            this.qrState = {
                status: "error",
                adapterId: previous?.adapterId,
                walletName: previous?.walletName ?? "WalletConnect",
                message
            };
            this.renderQrShell(this.qrState);
            return;
        }
        const status = this.root?.querySelector(".xwk-status");
        if (status) {
            status.textContent = message;
            status.classList.add("xwk-error");
            status.setAttribute("role", "alert");
        }
        const connectStatus = this.root?.querySelector(".xwk-connect-status");
        if (connectStatus) {
            connectStatus.textContent = message;
            connectStatus.classList.add("xwk-error-text");
            connectStatus.setAttribute("role", "alert");
        }
        const qrLoading = this.root?.querySelector(".xwk-qr-loading");
        if (qrLoading) {
            qrLoading.textContent = message;
            qrLoading.classList.add("xwk-error-text");
            qrLoading.setAttribute("role", "alert");
        }
    }
    private shouldUseCustomWalletConnectQr(wallet: WalletMetadata | undefined, adapter: WalletAdapter | undefined): boolean {
        return Boolean(!this.isDefaultWalletConnectUiMode() && adapter?.capabilities.qr && wallet?.group === "WalletConnect");
    }
    private isDefaultWalletConnectUiMode(): boolean {
        return !this.options.walletConnectUiMode || this.options.walletConnectUiMode === "default";
    }
    private handleConnected(adapterId: string, session: WalletSession | null) {
        if (this.isStaleAdapterEvent(adapterId))
            return;
        this.activeRequestAdapterId = undefined;
        if (session)
            this.connectHandlers.forEach((handler) => handler(session));
        if (this.presentation === "inline") {
            this.showList();
            const status = this.root?.querySelector(".xwk-status");
            if (status)
                status.textContent = this.messages().connected;
            return;
        }
        this.close(false, true);
    }
    private isStaleAdapterEvent(adapterId: string) {
        return !this.activeRequestAdapterId || this.activeRequestAdapterId !== adapterId;
    }
    private isRejectedError(error: unknown, message: string): boolean {
        if (isWalletKitError(error)) {
            return error.code === WalletKitErrorCode.CONNECTION_REJECTED || error.code === WalletKitErrorCode.SIGN_REJECTED;
        }
        return /reject|denied|cancelled|canceled|closed|user rejected|proposal expired|expired/i.test(message);
    }
    private isTimeoutError(error: unknown, message: string): boolean {
        if (isWalletKitError(error) && error.code === WalletKitErrorCode.REQUEST_TIMEOUT)
            return true;
        return /timeout|timed out/i.test(message);
    }
    private getFriendlyErrorMessage(error: unknown): string {
        if (isWalletKitError(error)) {
            switch (error.code) {
                case WalletKitErrorCode.CONNECTION_REJECTED:
                    return "Connection was rejected in the wallet.";
                case WalletKitErrorCode.SIGN_REJECTED:
                    return "Request was rejected in the wallet.";
                case WalletKitErrorCode.REQUEST_TIMEOUT:
                    return "Wallet request timed out. Please try again.";
                case WalletKitErrorCode.WALLET_NOT_INSTALLED:
                case WalletKitErrorCode.WALLET_NOT_AVAILABLE:
                    return "Wallet is not available in this browser.";
                case WalletKitErrorCode.UNSUPPORTED_METHOD:
                    return "This wallet does not support the requested action.";
                case WalletKitErrorCode.NETWORK_MISMATCH:
                    return "Wallet network does not match this dApp.";
                default:
                    return this.formatDisplayErrorMessage(error.message);
            }
        }
        const message = getErrorMessage(error);
        if (/reject|denied|cancelled|canceled|closed|proposal expired|expired/i.test(message))
            return "Request was rejected in the wallet.";
        if (/timeout|timed out/i.test(message))
            return "Wallet request timed out. Please try again.";
        if (/not installed|provider is not available|not available/i.test(message))
            return "Wallet is not available in this browser.";
        return this.formatDisplayErrorMessage(message);
    }
    private formatDisplayErrorMessage(message: string): string {
        const normalized = message.replace(/\s+/g, " ").trim();
        if (!normalized)
            return "Wallet request failed. Please try again.";
        if (normalized.length <= 180 && !/^\[?\{/.test(normalized))
            return normalized;
        if (/^\[?\{/.test(normalized))
            return "Wallet request failed. Please try again.";
        return `${normalized.slice(0, 177).trimEnd()}...`;
    }
    private renderShellAttributes(className: string) {
        const semantics = this.presentation === "modal"
            ? `role="dialog" aria-modal="true"`
            : `role="region"`;
        return `class="${className}" ${semantics} aria-labelledby="${this.titleId}" tabindex="-1"`;
    }
    private renderHeaderEnd() {
        if (this.presentation === "inline")
            return `<span class="xwk-header-spacer" aria-hidden="true"></span>`;
        return `<button class="xwk-close" data-xwk-close aria-label="${this.escapeHtml(this.messages().close)}">&times;</button>`;
    }
    private renderShell() {
        const messages = this.messages();
        const theme = this.resolveTheme();
        const layout = this.options.layout ?? "list";
        const size = this.options.size ?? "default";
        const textSize = this.options.textSize ?? "sm";
        this.ensureStyles(theme, layout, size, textSize);
        return `<section ${this.renderShellAttributes(`xwk-modal xwk-layout-${layout}`)}><div class="xwk-header"><button class="xwk-back xwk-hidden" data-xwk-back aria-label="${this.escapeHtml(messages.back)}">${this.backIcon()}</button><div class="xwk-title" id="${this.titleId}">${this.escapeHtml(this.options.title ?? messages.connectWallet)}</div>${this.renderHeaderEnd()}</div><div class="xwk-body"><div class="xwk-list">${this.renderNetworkBadge()}<div class="xwk-grid">${this.renderWalletList(layout)}</div><div class="xwk-status" role="status" aria-live="polite"></div></div><div class="xwk-connect xwk-hidden"><div class="xwk-spinner" aria-hidden="true"><div class="xwk-connect-icon"></div></div><strong class="xwk-connect-name"></strong><p class="xwk-connect-status" role="status" aria-live="polite">${this.escapeHtml(messages.approveRequest)}</p></div><div class="xwk-qr xwk-hidden"><h3 class="xwk-qr-title"></h3><div class="xwk-qr-code">${this.renderQrLoading()}</div><p class="xwk-qr-help">${this.escapeHtml(messages.waitingForWalletConnectUri)}</p></div></div><div class="xwk-footer">${this.escapeHtml(this.options.footerText ?? "XRPL Wallet Kit")}</div></section>`;
    }
    private renderNetworkBadge() {
        const network = this.options.manager.getNetwork();
        if (!network || network.networkType === "MAINNET")
            return "";
        const { dotColor, badgeBg, badgeBorder, textColor, label } = this.resolveNetworkBadgeStyle(network);
        const badgeStyle = `background:${badgeBg};border-color:${badgeBorder};color:${textColor}`;
        const dot = `<span class="xwk-network-dot" style="background:${dotColor}" aria-hidden="true"></span>`;
        return `<div class="xwk-network-row"><span class="xwk-network-badge" style="${badgeStyle}">${dot}${this.escapeHtml(label)}</span></div>`;
    }
    private resolveNetworkBadgeStyle(network: WalletNetwork): NetworkBadgeStyle {
        const dark = this.resolveThemeMode() === "dark";
        const family = String(network.family ?? "xrpl").toLowerCase();
        const id = String(network.id ?? "").toLowerCase();
        const name = String(network.name ?? "").toLowerCase();
        const isEvm = family.includes("evm") || id.includes("evm") || name.includes("evm");
        if (isEvm) {
            return {
                label: "XRPL EVM",
                dotColor: "#a78bfa",
                badgeBg: dark ? "rgba(167,139,250,.10)" : "#f5f3ff",
                badgeBorder: dark ? "rgba(167,139,250,.20)" : "#ddd6fe",
                textColor: dark ? "#c4b5fd" : "#6d28d9"
            };
        }
        if (network.networkType === "DEVNET") {
            return {
                label: "DEVNET",
                dotColor: "#38bdf8",
                badgeBg: dark ? "rgba(56,189,248,.10)" : "#f0f9ff",
                badgeBorder: dark ? "rgba(56,189,248,.20)" : "#bae6fd",
                textColor: dark ? "#7dd3fc" : "#0369a1"
            };
        }
        if (network.networkType === "TESTNET") {
            return {
                label: "TESTNET",
                dotColor: dark ? "#fbbf24" : "#f59e0b",
                badgeBg: dark ? "rgba(245,158,11,.12)" : "#fef3c7",
                badgeBorder: dark ? "rgba(245,158,11,.20)" : "#fde68a",
                textColor: dark ? "#fbbf24" : "#92400e"
            };
        }
        const theme = this.resolveTheme();
        return {
            label: (network.name || "CUSTOM").toUpperCase().slice(0, 10),
            dotColor: theme.muted,
            badgeBg: theme.surface,
            badgeBorder: theme.border,
            textColor: theme.muted
        };
    }
    private renderQrShell(state: WalletQrState) {
        const messages = this.messages();
        const theme = this.resolveTheme();
        const layout = this.options.layout ?? "list";
        const size = this.options.size ?? "default";
        const textSize = this.options.textSize ?? "sm";
        const hasReadyUri = state.status === "ready" && Boolean(state.uri);
        const uri = state.status === "ready" ? state.uri : undefined;
        const deeplink = state.status === "ready" ? state.deeplink : undefined;
        const qrCodeAttributes = hasReadyUri ? ` aria-hidden="true"` : "";
        const openAction = hasReadyUri && deeplink
            ? `<a class="xwk-action xwk-action-primary" data-xwk-open href="${this.escapeHtml(deeplink)}">${this.escapeHtml(messages.openWallet)}</a>`
            : "";
        const copyAction = hasReadyUri
            ? `<button class="xwk-action xwk-copy-inside" data-xwk-copy type="button">${this.renderQrCopyButtonContent()}</button>`
            : "";
        const qrThemeToggle = hasReadyUri
            ? `<button class="xwk-qr-theme-action" data-xwk-qr-theme type="button" aria-label="${this.qrLightMode ? "Use dark QR" : "Use light QR"}" title="${this.qrLightMode ? "Use dark QR" : "Use light QR"}" aria-pressed="${this.qrLightMode ? "true" : "false"}">${this.qrThemeIcon()}</button>`
            : "";
        const retryAction = state.status === "rejected" || state.status === "timeout" || state.status === "error"
            ? `<button class="xwk-action xwk-action-primary" data-xwk-retry type="button">${this.refreshIcon()} ${this.escapeHtml(messages.tryAgain)}</button>`
            : "";
        const readyActionsCount = [copyAction, openAction].filter(Boolean).length;
        const actions = copyAction || openAction || retryAction
            ? `<div class="xwk-qr-card-actions ${readyActionsCount > 1 ? "xwk-qr-card-actions-dual" : ""}">${copyAction}${openAction}${retryAction}</div>`
            : `<div class="xwk-qr-card-actions xwk-qr-card-actions-placeholder" aria-hidden="true"><button class="xwk-action xwk-copy-inside" type="button" disabled>${this.renderQrCopyButtonContent()}</button></div>`;
        const qrContent = state.status === "rejected"
            ? `<div class="xwk-qr-message" role="alert"><strong>${this.escapeHtml(messages.connectionCanceledTitle)}</strong><span>${this.escapeHtml(messages.requestRejected)}</span></div>`
            : state.status === "timeout"
                ? `<div class="xwk-qr-message xwk-error-text" role="alert"><strong>${this.escapeHtml(messages.connectionTimedOutTitle)}</strong><span>${this.escapeHtml(messages.requestTimedOut)}</span></div>`
            : state.status === "error"
                ? `<div class="xwk-qr-message xwk-error-text" role="alert"><strong>${this.escapeHtml(messages.connectionFailedTitle)}</strong><span>${this.escapeHtml(state.message)}</span></div>`
                : this.renderQrLoading();
        const qrFallback = "";
        const helpText = hasReadyUri
            ? messages.helpScan
            : state.status === "rejected"
                ? messages.helpTryAgainNewRequest
                : state.status === "timeout"
                    ? messages.helpTryAgainNewRequest
                : state.status === "error"
                    ? messages.pleaseTryAgain
                    : messages.waitingForWalletConnectUri;
        if (!this.root?.isConnected) {
            this.renderView("qr");
        }
        if (!this.root)
            return;
        this.root.dataset.xwkView = "qr";
        this.ensureStyles(theme, layout, size, textSize);
        this.root.innerHTML = `<section ${this.renderShellAttributes("xwk-modal xwk-qr-modal")}><div class="xwk-header"><button class="xwk-back" data-xwk-back aria-label="${this.escapeHtml(messages.back)}">${this.backIcon()}</button><div class="xwk-title" id="${this.titleId}">${this.escapeHtml(state.walletName)}</div>${this.renderHeaderEnd()}</div><div class="xwk-body"><div class="xwk-qr xwk-standalone-qr"><div class="xwk-qr-card"><div class="xwk-qr-code-wrap"><div class="xwk-qr-code"${qrCodeAttributes}>${qrContent}</div>${qrThemeToggle}</div>${qrFallback}${actions}</div><p class="xwk-qr-help">${this.escapeHtml(helpText)}</p><span class="xwk-sr-only">${this.escapeHtml(messages.qrSrHint)}</span><span class="xwk-sr-only" aria-live="assertive" data-xwk-copy-live></span></div></div><div class="xwk-footer">${this.escapeHtml(this.options.footerText ?? "XRPL Wallet Kit")}</div></section>`;
        this.bindChrome();
    }
    private renderQrLoading() {
        return `<span class="xwk-qr-loading" role="status" aria-live="polite"><span class="xwk-qr-loading-spinner"></span><span>${this.escapeHtml(this.messages().generatingQr)}</span></span>`;
    }
    private renderQrCopyButtonContent() {
        const messages = this.messages();
        return this.qrCopied ? `${this.checkIcon()} ${this.escapeHtml(messages.copied)}` : `${this.linkIcon()} ${this.escapeHtml(messages.copyUri)}`;
    }
    private renderConnectShell(wallet: WalletMetadata | undefined, adapterId: string) {
        const messages = this.messages();
        const theme = this.resolveTheme();
        const layout = this.options.layout ?? "list";
        const size = this.options.size ?? "default";
        const textSize = this.options.textSize ?? "sm";
        const walletName = wallet?.name ?? adapterId;
        const statusText = this.getConnectStatusText(wallet, adapterId);
        if (!this.root?.isConnected) {
            this.renderView("connect");
        }
        if (!this.root)
            return;
        this.root.dataset.xwkView = "connect";
        this.ensureStyles(theme, layout, size, textSize);
        this.root.innerHTML = `<section ${this.renderShellAttributes("xwk-modal xwk-connect-modal")}><div class="xwk-header"><button class="xwk-back" data-xwk-back aria-label="${this.escapeHtml(messages.back)}">${this.backIcon()}</button><div class="xwk-title" id="${this.titleId}">${this.escapeHtml(messages.connect)}</div>${this.renderHeaderEnd()}</div><div class="xwk-body"><div class="xwk-connect xwk-standalone-connect"><div class="xwk-spinner" aria-hidden="true"><div class="xwk-connect-icon">${this.renderWalletIcon(wallet)}</div></div><strong class="xwk-connect-name">${this.escapeHtml(walletName)}</strong><p class="xwk-connect-status" role="status" aria-live="polite">${this.escapeHtml(statusText)}</p></div></div><div class="xwk-footer">${this.escapeHtml(this.options.footerText ?? "XRPL Wallet Kit")}</div></section>`;
        this.bindChrome();
    }
    private getConnectStatusText(wallet: WalletMetadata | undefined, adapterId: string) {
        const messages = this.messages();
        const adapter = this.options.manager.getAdapter(adapterId);
        const walletName = wallet?.name ?? adapter?.metadata.name ?? messages.walletFallbackName;
        if (wallet?.type === "hardware")
            return messages.confirmOnDevice(walletName);
        if (wallet?.type === "walletconnect" || wallet?.group === "WalletConnect")
            return messages.openWalletAppApprove(walletName);
        if (wallet?.type === "mobile" || adapter?.capabilities.qr || adapter?.capabilities.deeplink)
            return messages.openWalletAppApprove(walletName);
        if (wallet?.type === "snap")
            return messages.approveBrowserWallet();
        return messages.clickConnectPopup(walletName);
    }
    private renderStyles(theme: Required<WalletUiTheme>, layout: WalletUiLayout, size: WalletUiSize, textSize: WalletUiTextSize) {
        const styleKey = `${layout}|${size}|${textSize}|${this.resolveThemeMode()}|${JSON.stringify(theme)}`;
        if (styleKey === this.cachedStyleKey)
            return this.cachedStyle;
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
        const groupFontSize = textSize === "lg" ? "13px" : "12px";
        const bodyFontSize = textSize === "lg" ? "16px" : textSize === "md" ? "15px" : "14px";
        const walletNameColor = this.resolveThemeMode() === "dark" ? theme.foreground : "#333333";
        const badgeColor = this.resolveThemeMode() === "dark" ? "#cbd5e1" : "#5c6878";
        const badgeBackground = this.resolveThemeMode() === "dark" ? "rgba(255,255,255,.08)" : "#f0f1f3";
        const badgeBorder = this.resolveThemeMode() === "dark" ? "rgba(255,255,255,.10)" : "rgba(15,23,42,.08)";
        const badgeDot = this.resolveThemeMode() === "dark" ? "#94a3b8" : "#9ca3af";
        const recommendedBadgeBackground = this.resolveThemeMode() === "dark" ? "rgba(56,189,248,.12)" : "rgba(0,120,174,.10)";
        const recommendedBadgeBorder = this.resolveThemeMode() === "dark" ? "rgba(56,189,248,.22)" : "rgba(0,120,174,.18)";
        const miniIconBorder = this.resolveThemeMode() === "dark" ? "rgba(255,255,255,.12)" : "rgba(15,23,42,.08)";
        const actionBorder = this.resolveThemeMode() === "dark" ? "rgba(255,255,255,.10)" : "rgba(15,23,42,.08)";
        const spinnerPrimary = theme.muted;
        const spinnerSecondary = theme.border;
        const qrLoadingColor = theme.muted;
        const styles = `.xwk-overlay{position:fixed;inset:0;background:${theme.overlay};display:grid;overscroll-behavior:contain;place-items:center;z-index:2147483647;font-family:${theme.fontFamily};font-size:${bodyFontSize};opacity:0;padding:max(16px,env(safe-area-inset-top)) max(16px,env(safe-area-inset-right)) max(16px,env(safe-area-inset-bottom)) max(16px,env(safe-area-inset-left));transition:opacity .2s ease-out}.xwk-overlay[data-xwk-state="open"]{opacity:1}.xwk-overlay[data-xwk-state="closing"]{opacity:0;transition-duration:.18s;transition-timing-function:cubic-bezier(.4,0,1,1)}.xwk-modal{box-sizing:border-box;display:block;width:min(${width},100%);max-height:calc(100dvh - 32px - env(safe-area-inset-top) - env(safe-area-inset-bottom));background:${theme.background};border:1px solid ${theme.border};border-radius:${theme.radius};box-shadow:${theme.shadow};color:${theme.foreground};opacity:0;overflow:hidden;transform:translateY(8px) scale(.97);transform-origin:center bottom;transition:opacity .24s cubic-bezier(.22,1,.36,1),transform .24s cubic-bezier(.22,1,.36,1)}.xwk-overlay[data-xwk-state="open"] .xwk-modal{opacity:1;transform:translateY(0) scale(1)}.xwk-overlay[data-xwk-state="closing"] .xwk-modal{opacity:0;transform:translateY(6px) scale(.985);transition-duration:.18s;transition-timing-function:cubic-bezier(.4,0,1,1)}.xwk-header{display:grid;grid-template-columns:44px minmax(0,1fr) 44px;align-items:center;column-gap:8px;padding:8px 18px;border-bottom:1px solid ${theme.border}}.xwk-title{font-size:${titleFontSize};font-weight:500;text-align:center;color:${theme.foreground};min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.xwk-close,.xwk-back{-webkit-appearance:none;-webkit-tap-highlight-color:transparent;align-items:center;appearance:none;background:transparent;border:0;border-radius:999px;box-shadow:none;box-sizing:border-box;color:${theme.muted};cursor:pointer;display:inline-flex;font:inherit;height:44px;justify-content:center;margin:0;min-height:0;outline:none;overflow:hidden;padding:0;touch-action:manipulation;transform:none;width:44px}.xwk-back{justify-self:start}.xwk-close{font-size:26px;font-weight:500;justify-self:end;line-height:1}.xwk-close:hover,.xwk-back:hover{background:${theme.surfaceHover};box-shadow:none;color:${theme.foreground};transform:none}.xwk-close:focus-visible,.xwk-back:focus-visible,.xwk-wallet:focus-visible,.xwk-action:focus-visible,.xwk-qr-theme-action:focus-visible{outline:2px solid ${theme.accent};outline-offset:2px;text-decoration:none}.xwk-body{-webkit-overflow-scrolling:touch;box-sizing:border-box;max-height:min(620px,calc(100dvh - 120px - env(safe-area-inset-top) - env(safe-area-inset-bottom)));overscroll-behavior:contain;overflow:auto;padding:12px 22px 18px}.xwk-list,.xwk-connect,.xwk-qr{display:none}.xwk-overlay[data-xwk-view="list"] .xwk-list{display:block}.xwk-overlay[data-xwk-view="connect"] .xwk-connect{display:block}.xwk-overlay[data-xwk-view="qr"] .xwk-qr{display:block}.xwk-network-row{align-items:center;display:flex;justify-content:flex-end;margin:-2px 0 8px;min-height:22px}.xwk-network-badge{align-items:center;background:${this.resolveThemeMode() === "dark" ? "rgba(245,158,11,.12)" : "#fef3c7"};border:1px solid ${this.resolveThemeMode() === "dark" ? "rgba(245,158,11,.20)" : "#fde68a"};border-radius:999px;color:${this.resolveThemeMode() === "dark" ? "#fbbf24" : "#92400e"};display:inline-flex;font-size:10px;font-weight:560;letter-spacing:0;line-height:1;padding:5px 9px;text-transform:none}.xwk-network-dot{border-radius:999px;display:inline-block;height:6px;margin-right:5px;width:6px}.xwk-grid{display:grid;grid-template-columns:${gridColumns};gap:7px}.xwk-wallet{-webkit-appearance:none;-webkit-tap-highlight-color:transparent;align-items:center;appearance:none;background:${theme.surface};border:0;border-radius:${theme.walletRadius};box-shadow:none;box-sizing:border-box;color:${theme.foreground};cursor:pointer;display:flex;flex-direction:${walletDirection};font:inherit;gap:12px;justify-content:${layout === "list" ? "flex-start" : "center"};line-height:1.2;margin:0;min-height:${walletMinHeight};min-width:0;outline:none;overflow:hidden;padding:${layout === "list" ? "12px 12px" : "12px 10px"};text-align:${textAlign};touch-action:manipulation;transform:none;transition:background-color .16s ease;width:100%}.xwk-wallet:hover{background:${theme.surfaceHover};box-shadow:none;transform:none}.xwk-wallet:active{background:${theme.surfaceHover};transform:none}.xwk-wallet img:not(.xwk-mini-icon),.xwk-icon-fallback{border-radius:${theme.walletRadius};flex:0 0 auto;height:${iconSize};object-fit:contain;overflow:hidden;width:${iconSize}}.xwk-icon-fallback{align-items:center;background:${theme.accent};color:#fff;display:inline-flex;font-weight:700;justify-content:center}.xwk-wallet-group{margin-top:0;min-height:${walletMinHeight}}.xwk-wallet-group .xwk-wallet-info{align-items:center;display:${layout === "list" ? "flex" : "grid"};gap:${layout === "list" ? "10px" : "2px"}}.xwk-wallet-group .xwk-name{flex:1 1 auto}.xwk-wallet-group .xwk-group{display:${layout === "list" ? "none" : groupDisplay}}.xwk-group-placeholder{visibility:hidden}.xwk-wallet-info{display:grid;gap:2px;min-width:0;width:100%}.xwk-name{color:${walletNameColor};display:block;font-size:${layout === "list" ? nameFontSize : gridNameFontSize};font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.xwk-group{color:${theme.muted};display:${groupDisplay};font-size:${groupFontSize};font-weight:400;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.xwk-group-icons{align-items:center;display:${layout === "list" ? "inline-flex" : "none"};flex:0 0 auto;gap:4px;justify-content:flex-end;margin-left:auto;min-width:0}.xwk-mini-icon,.xwk-mini-fallback,.xwk-mini-more{align-items:center;border:1px solid ${miniIconBorder};border-radius:10px;box-sizing:border-box;display:inline-flex;flex:0 0 auto;height:32px;justify-content:center;object-fit:cover;overflow:hidden;width:32px}.xwk-mini-fallback,.xwk-mini-more{background:${theme.background};color:${theme.muted};font-size:12px;font-weight:600}.xwk-mini-more{border-radius:999px;width:auto;min-width:32px;padding:0 8px}.xwk-wallet-badges{align-items:center;display:inline-flex;flex:0 0 auto;gap:6px;justify-content:flex-end;margin-left:auto;min-width:0}.xwk-wallet-badge{align-items:center;background:${badgeBackground};border:1px solid ${badgeBorder};border-radius:999px;color:${badgeColor};display:inline-flex;flex:0 0 auto;font-size:11px;font-weight:500;gap:6px;line-height:1;min-height:24px;padding:0 10px;visibility:hidden}.xwk-wallet-badge:before{background:${badgeDot};border-radius:999px;content:"";height:6px;width:6px}.xwk-wallet-badge.xwk-installed,.xwk-wallet-badge.xwk-recommended{visibility:visible}.xwk-wallet-badge.xwk-recommended{background:${recommendedBadgeBackground};border-color:${recommendedBadgeBorder};color:${theme.accent}}.xwk-wallet-badge.xwk-recommended:before{background:currentColor}.xwk-status{color:${theme.accent};font-size:12px;margin-top:8px;min-height:0;max-width:100%;overflow-wrap:anywhere}.xwk-status.xwk-error,.xwk-error-text{color:${theme.error}}.xwk-status.xwk-error{background:${theme.surface};border:1px solid ${theme.border};border-radius:10px;box-sizing:border-box;line-height:1.35;padding:9px 10px}.xwk-hidden{display:none}.xwk-back.xwk-hidden{display:inline-flex;pointer-events:none;visibility:hidden}.xwk-connect{text-align:center;padding:30px 0 16px}.xwk-spinner{display:grid;margin:0 auto 16px;place-items:center;position:relative;width:104px;height:104px}.xwk-spinner:before{animation:xwk-spin 1s linear infinite;border:3px solid transparent;border-top-color:${spinnerPrimary};border-right-color:${spinnerSecondary};border-radius:50%;content:"";height:96px;position:absolute;width:96px}.xwk-connect-icon img,.xwk-connect-icon .xwk-icon-fallback{border-radius:${theme.walletRadius};height:66px;object-fit:contain;overflow:hidden;width:66px}.xwk-connect-name{display:block;font-size:${nameFontSize};font-weight:600;margin-top:4px}.xwk-connect-status{color:${theme.muted};font-size:${bodyFontSize};font-weight:400;line-height:1.45;margin:14px auto 0;max-width:420px}.xwk-qr{text-align:center}.xwk-qr-title{color:${theme.foreground};font-size:${titleFontSize};font-weight:500;margin:0 0 14px}.xwk-qr-card{background:${theme.surface};border:1px solid ${theme.border};border-radius:14px;box-sizing:border-box;display:flex;flex-direction:column;justify-content:space-between;margin:0 auto 10px;min-height:386px;padding:12px;width:min(332px,100%)}.xwk-qr-code-wrap{position:relative;flex:0 0 auto;margin:0 auto 10px;width:100%}.xwk-qr-code{aspect-ratio:1/1;background:transparent;border:0;border-radius:10px;box-sizing:border-box;color:${theme.muted};display:grid;min-height:0;padding:0;place-items:center;width:100%}.xwk-qr-code-light{background:#fff;padding:8px}.xwk-qr-theme-action{-webkit-appearance:none;-webkit-tap-highlight-color:transparent;align-items:center;appearance:none;background:${theme.background};border:1px solid ${actionBorder};border-radius:999px;box-shadow:none;box-sizing:border-box;color:${theme.muted};cursor:pointer;display:inline-flex;height:34px;justify-content:center;margin:0;min-height:0;opacity:0;outline:none;padding:0;pointer-events:none;position:absolute;right:8px;top:8px;touch-action:manipulation;transform:none;transition:opacity .14s ease,background-color .16s ease,border-color .16s ease,color .16s ease;width:34px}.xwk-qr-code-wrap:hover .xwk-qr-theme-action,.xwk-qr-code-wrap:focus-within .xwk-qr-theme-action,.xwk-qr-theme-action:focus-visible{opacity:1;pointer-events:auto}.xwk-qr-theme-action:hover{background:${theme.surfaceHover};border-color:${actionBorder};box-shadow:none;color:${theme.foreground};transform:none}.xwk-qr-theme-action svg{height:17px;width:17px}.xwk-qr-code canvas,.xwk-qr-code img,.xwk-qr-code svg{aspect-ratio:1/1;display:block;height:auto;max-width:100%;width:100%}.xwk-qr-loading{align-items:center;color:${qrLoadingColor};display:inline-flex;font-size:13px;gap:8px}.xwk-qr-message{align-items:center;color:${theme.muted};display:grid;font-size:${bodyFontSize};gap:7px;line-height:1.35;max-width:260px;text-align:center}.xwk-qr-message strong{color:${theme.foreground};font-size:${nameFontSize};font-weight:600}.xwk-qr-message span{display:block;max-width:100%;overflow-wrap:anywhere}.xwk-qr-loading-spinner{animation:xwk-spin 1s linear infinite;border:2px solid ${spinnerSecondary};border-top-color:${spinnerPrimary};border-radius:999px;display:inline-block;height:18px;width:18px}.xwk-qr-help{color:${theme.muted};font-size:${bodyFontSize};font-weight:400;line-height:1.35;margin:10px auto 0;max-width:420px;min-height:22px;white-space:nowrap}.xwk-qr-fallback{color:${theme.muted};font-size:11px;line-height:1.5;overflow-wrap:anywhere}.xwk-actions{display:grid;gap:10px;grid-template-columns:1fr 1fr;margin-top:14px}.xwk-qr-card-actions{display:grid;flex:0 0 auto;gap:10px;grid-template-columns:1fr;min-height:46px}.xwk-qr-card-actions-dual{grid-template-columns:repeat(auto-fit,minmax(0,1fr))}.xwk-qr-card-actions-placeholder{visibility:hidden}.xwk-action{-webkit-appearance:none;-webkit-tap-highlight-color:transparent;align-items:center;appearance:none;background:${theme.surface};border:1px solid ${actionBorder};border-radius:${theme.walletRadius};box-shadow:none;box-sizing:border-box;color:${theme.foreground};cursor:pointer;display:inline-flex;font:inherit;font-size:${bodyFontSize};font-weight:560;gap:8px;justify-content:center;line-height:1.2;margin:0;min-height:46px;min-width:0;outline:none;overflow:hidden;padding:0 12px;text-decoration:none;touch-action:manipulation;transform:none;transition:background-color .16s ease,border-color .16s ease;white-space:nowrap;width:100%}.xwk-copy-inside{background:${theme.surface};border-color:${actionBorder};color:${theme.foreground};font-size:${bodyFontSize};width:100%}.xwk-action:hover{background:${theme.surfaceHover};border-color:${actionBorder};box-shadow:none;text-decoration:none;transform:none}.xwk-action:active{background:${theme.surfaceHover};box-shadow:none;opacity:1;text-decoration:none;transform:none}.xwk-copy-inside:hover{background:${theme.surfaceHover};box-shadow:none;text-decoration:none}.xwk-action-primary{background:${theme.surface};border-color:${actionBorder};color:${theme.foreground}}.xwk-action-primary:hover{background:${theme.surfaceHover};border-color:${actionBorder};box-shadow:none;color:${theme.foreground};text-decoration:none}.xwk-action svg{flex:0 0 auto;opacity:.58}.xwk-copied-icon{color:${theme.accent};opacity:1!important}.xwk-action:disabled{cursor:default;opacity:.76}.xwk-retrying .xwk-refresh-icon{animation:xwk-spin .7s linear infinite}.xwk-footer{border-top:0;color:${theme.muted};font-size:11px;font-weight:400;padding:12px 16px 14px;text-align:center}@keyframes xwk-spin{to{transform:rotate(360deg)}}@media(prefers-reduced-motion:reduce){.xwk-overlay,.xwk-modal,.xwk-wallet,.xwk-action,.xwk-close,.xwk-back,.xwk-qr-theme-action{transition-duration:1ms!important;animation-duration:1ms!important}.xwk-spinner:before,.xwk-qr-loading-spinner{animation:none}}@media(max-width:640px){.xwk-overlay{padding:max(12px,env(safe-area-inset-top)) max(12px,env(safe-area-inset-right)) 0 max(12px,env(safe-area-inset-left));place-items:end center}.xwk-modal{border-bottom-left-radius:0;border-bottom-right-radius:0;max-height:calc(100dvh - 24px - env(safe-area-inset-top));transform:translateY(100%);width:100%}.xwk-overlay[data-xwk-state="open"] .xwk-modal{transform:translateY(0);transition-duration:.32s;transition-timing-function:cubic-bezier(.32,.72,0,1)}.xwk-overlay[data-xwk-state="closing"] .xwk-modal{transform:translateY(100%);transition-duration:.24s;transition-timing-function:cubic-bezier(.4,0,1,1)}.xwk-header{grid-template-columns:44px minmax(0,1fr) 44px;column-gap:8px;padding:10px 16px}.xwk-body{max-height:calc(100dvh - 112px - env(safe-area-inset-top) - env(safe-area-inset-bottom));padding:14px 16px 16px}.xwk-grid{grid-template-columns:${layout === "icon" ? "repeat(3,minmax(0,1fr))" : "1fr"}}.xwk-wallet-badges{gap:4px}.xwk-wallet-badge{font-size:10px;min-height:22px;padding:0 8px}.xwk-actions{grid-template-columns:1fr}.xwk-qr-card{min-height:358px;padding:12px;width:min(304px,100%)}.xwk-qr-code-wrap{width:100%}.xwk-action{font-size:clamp(12px,3.55vw,${bodyFontSize});gap:6px;padding:0 10px}.xwk-action svg{height:17px;width:17px;flex:0 0 auto}.xwk-qr-card-actions-dual{grid-template-columns:1fr}.xwk-qr-help{font-size:clamp(12px,3.45vw,${bodyFontSize});min-height:38px;white-space:normal}}@media(max-width:360px){.xwk-qr-card{min-height:354px;width:min(284px,100%)}}@media(max-height:560px){.xwk-body{max-height:calc(100dvh - 96px - env(safe-area-inset-top) - env(safe-area-inset-bottom));padding:10px 16px}.xwk-connect{padding:18px 0 10px}.xwk-spinner{height:82px;margin-bottom:12px;width:82px}.xwk-spinner:before{height:76px;width:76px}.xwk-connect-icon img,.xwk-connect-icon .xwk-icon-fallback{border-radius:${theme.walletRadius};height:54px;width:54px}.xwk-qr-card{min-height:320px;width:min(260px,100%)}.xwk-qr-title{margin-bottom:10px}.xwk-qr-help{margin-top:8px}.xwk-footer{padding:8px 16px 10px}}`;
        this.cachedStyleKey = styleKey;
        this.cachedStyle = styles;
        return styles;
    }
    private ensureStyles(theme: Required<WalletUiTheme>, layout: WalletUiLayout, size: WalletUiSize, textSize: WalletUiTextSize) {
        const styles = `${this.renderStyles(theme, layout, size, textSize)}${this.renderMobileSheetOverrides(theme)}`;
        ensureWalletStyle(getWalletStyleId("xwk-modal", styles), styles);
    }
    private renderMobileSheetOverrides(theme: Required<WalletUiTheme>) {
        const inlineOverrides = `.xwk-inline{background:transparent!important;display:block!important;inset:auto!important;opacity:1!important;overflow:visible!important;padding:0!important;place-items:initial!important;position:relative!important;z-index:auto!important}.xwk-inline .xwk-modal{border:1px solid ${theme.border}!important;border-radius:${theme.radius}!important;box-shadow:none!important;max-height:none!important;max-width:none!important;opacity:1!important;transform:none!important;transition:none!important;width:100%!important}.xwk-inline .xwk-body{max-height:none!important}.xwk-inline .xwk-header-spacer{display:block;height:44px;width:44px}.xwk-inline[data-xwk-state="closing"] .xwk-modal{opacity:1!important;transform:none!important}`;
        return `.xwk-modal:focus{outline:none}.xwk-sr-only{border:0!important;clip:rect(0 0 0 0)!important;height:1px!important;margin:-1px!important;overflow:hidden!important;padding:0!important;position:absolute!important;white-space:nowrap!important;width:1px!important}.xwk-error-text,.xwk-connect-status.xwk-error-text,.xwk-qr-loading.xwk-error-text{color:${theme.error}!important}.xwk-close,.xwk-back{-webkit-appearance:none;-webkit-tap-highlight-color:transparent;appearance:none;background:transparent!important;border:0!important;box-shadow:none!important;margin:0;outline:none!important}.xwk-close:focus-visible,.xwk-back:focus-visible{outline:2px solid ${theme.accent}!important;outline-offset:0}@media(max-width:640px){.xwk-overlay{padding:max(12px,env(safe-area-inset-top)) 0 0!important;place-items:end center!important}.xwk-modal{align-self:end!important;border-bottom:0!important;border-bottom-left-radius:0!important;border-bottom-right-radius:0!important;border-left:0!important;border-right:0!important;border-top-left-radius:${theme.radius}!important;border-top-right-radius:${theme.radius}!important;height:auto!important;max-height:calc(100dvh - env(safe-area-inset-top))!important;max-width:none!important;width:100vw!important}.xwk-header{border-top-left-radius:${theme.radius};border-top-right-radius:${theme.radius}}.xwk-body{padding-bottom:max(6px,calc(6px + env(safe-area-inset-bottom)))!important}.xwk-overlay[data-xwk-view="list"] .xwk-body{padding-bottom:max(2px,calc(2px + env(safe-area-inset-bottom)))!important}.xwk-network-row{margin:-4px 0 8px!important}.xwk-overlay[data-xwk-view="list"] .xwk-footer{padding-top:6px!important}}${inlineOverrides}`;
    }
    private renderWalletList(layout: WalletUiLayout) {
        const groups = this.getGroups();
        if (!groups.length)
            return this.getWallets().map((wallet) => this.renderWallet(wallet, layout)).join("");
        return [
            ...this.getUngroupedWallets(groups).map((wallet) => this.renderWallet(wallet, layout)),
            ...groups.map((group) => this.renderWalletGroup(group, layout))
        ].join("");
    }
    private renderWalletGroup(group: WalletUiGroup, layout: WalletUiLayout) {
        const messages = this.messages();
        const wallets = this.getGroupWallets(group);
        const previewLimit = group.maxPreviewIcons ?? 5;
        const previewWallets = wallets.slice(0, previewLimit);
        const overflow = wallets.length - previewWallets.length;
        const icon = group.icon
            ? `<img src="${this.escapeHtml(group.icon)}" alt="">`
            : `<span class="xwk-icon-fallback">${this.escapeHtml(group.name.slice(0, 1).toUpperCase())}</span>`;
        const secondary = layout === "list"
            ? `<span class="xwk-group">${this.escapeHtml(messages.walletCount(wallets.length))}</span>`
            : layout === "card" || layout === "grid"
                ? `<span class="xwk-group">+${this.escapeHtml(messages.walletCount(wallets.length))}</span>`
                : "";
        const preview = previewWallets.length
            ? `<span class="xwk-group-icons">${previewWallets.map((wallet) => this.renderMiniWalletIcon(wallet)).join("")}${overflow > 0 ? `<span class="xwk-mini-more" aria-label="${this.escapeHtml(messages.moreWallets(overflow))}">+${overflow}</span>` : ""}</span>`
            : "";
        return `<button class="xwk-wallet xwk-wallet-group" data-wallet-group-id="${this.escapeHtml(group.id)}">${icon}<span class="xwk-wallet-info"><span class="xwk-name">${this.escapeHtml(group.name)}</span>${secondary}${preview}</span></button>`;
    }
    private renderWallet(wallet: WalletMetadata, layout: WalletUiLayout) {
        const icon = this.renderWalletIcon(wallet);
        const showGroup = this.options.showWalletGroup !== false && layout !== "icon";
        const secondary = showGroup ? `<span class="xwk-group">${this.escapeHtml(this.getWalletSecondaryLabel(wallet))}</span>` : "";
        const badge = this.renderWalletBadges(wallet, layout);
        return `<button class="xwk-wallet" data-wallet-id="${this.escapeHtml(wallet.id)}">${icon}<span class="xwk-wallet-info"><span class="xwk-name">${this.escapeHtml(wallet.name)}</span>${secondary}</span>${badge}</button>`;
    }
    private renderWalletBadges(wallet: WalletMetadata, layout: WalletUiLayout) {
        if (layout !== "list")
            return "";
        const isExtensionLike = wallet.group === "Extensions" || wallet.type === "snap";
        const badges: string[] = [];
        const messages = this.messages();
        if (wallet.recommended)
            badges.push(`<span class="xwk-wallet-badge xwk-recommended">${this.escapeHtml(messages.recommended || "Recommended")}</span>`);
        if (isExtensionLike) {
            const className = this.availability[wallet.id] ? "xwk-wallet-badge xwk-installed" : "xwk-wallet-badge";
            badges.push(`<span class="${className}">${this.escapeHtml(messages.installed || "Installed")}</span>`);
        }
        if (!badges.length)
            return "";
        return `<span class="xwk-wallet-badges">${badges.join("")}</span>`;
    }
    private getWalletSecondaryLabel(wallet: WalletMetadata) {
        if (wallet.recommended && wallet.group === "Recommended")
            return this.humanizeWalletType(wallet.type);
        return wallet.group ?? this.humanizeWalletType(wallet.type);
    }
    private humanizeWalletType(type: WalletMetadata["type"]) {
        const messages = this.messages();
        switch (type) {
            case "mobile":
                return messages.mobileWallet;
            case "extension":
                return messages.extensionWallet;
            case "walletconnect":
                return messages.walletConnectWallet;
            case "snap":
                return messages.xrplSnapWallet;
            case "hardware":
                return messages.hardwareWallet;
            case "embedded":
                return messages.embeddedWallet;
            default:
                return String(type);
        }
    }
    private renderWalletIcon(wallet?: WalletMetadata) {
        if (wallet?.icon)
            return `<img src="${this.escapeHtml(wallet.icon)}" alt="">`;
        const letter = wallet?.name.slice(0, 1).toUpperCase() ?? "W";
        return `<span class="xwk-icon-fallback">${this.escapeHtml(letter)}</span>`;
    }
    private renderMiniWalletIcon(wallet: WalletMetadata) {
        if (wallet.icon)
            return `<img class="xwk-mini-icon" src="${this.escapeHtml(wallet.icon)}" alt="">`;
        return `<span class="xwk-mini-icon xwk-mini-fallback">${this.escapeHtml(wallet.name.slice(0, 1).toUpperCase())}</span>`;
    }
    private backIcon() {
        return `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M15 18l-6-6 6-6" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    }
    private linkIcon() {
        return this.copyActionIcon();
    }
    private copyActionIcon() {
        return `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="8" y="8" width="11" height="11" rx="2" stroke="currentColor" stroke-width="2"/><path d="M5 15H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;
    }
    private refreshIcon() {
        return `<svg class="xwk-refresh-icon" width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M20 11a8 8 0 1 0-2.34 5.66" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M20 5v6h-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    }
    private qrThemeIcon() {
        if (this.qrLightMode)
            return `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M20.2 14.4A7.4 7.4 0 0 1 9.6 3.8 8.3 8.3 0 1 0 20.2 14.4Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>`;
        return `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="4" stroke="currentColor" stroke-width="2"/><path d="M12 2v2.2M12 19.8V22M4.9 4.9l1.6 1.6M17.5 17.5l1.6 1.6M2 12h2.2M19.8 12H22M4.9 19.1l1.6-1.6M17.5 6.5l1.6-1.6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;
    }
    private checkIcon() {
        return `<svg class="xwk-copied-icon" width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="currentColor"/><path d="m7.8 12.4 2.7 2.7 5.9-6.2" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    }
    private messages() {
        return resolveWalletUiMessages(this.options.language, this.options.messages);
    }
    private resolveTheme(): Required<WalletUiTheme> {
        const mode = this.resolveThemeMode();
        const base = mode === "dark" ? darkTheme : lightTheme;
        return { ...base, ...(this.options.theme ?? {}) };
    }
    private resolveThemeMode(): WalletUiThemeMode {
        return this.options.themeMode === "auto" ? this.getSystemThemeMode() : this.options.themeMode ?? "light";
    }
    private getSystemThemeMode(): "light" | "dark" {
        if (typeof window === "undefined" || !window.matchMedia)
            return "light";
        return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    private escapeHtml(value: unknown) {
        return String(value ?? "").replace(/[&<>"']/g, (char) => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            "\"": "&quot;",
            "'": "&#39;"
        })[char] ?? char);
    }
    private async renderQr(container: HTMLElement, uri: string) {
        container.replaceChildren();
        try {
            container.classList.toggle("xwk-qr-code-light", this.qrLightMode);
            const isDark = this.resolveThemeMode() === "dark" && !this.qrLightMode;
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
                    color: this.qrLightMode ? "#ffffff" : "transparent"
                }
            });
            qrCode.append(container);
        }
        catch {
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
            }
            catch {
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

export class WalletModal extends WalletPickerView {
    constructor(options: WalletUiOptions) {
        super(options, "modal");
    }
}

export class WalletInline extends WalletPickerView {
    constructor(options: WalletInlineOptions) {
        super(options, "inline");
    }
    mount(target: WalletInlineTarget) {
        const element = typeof target === "string"
            ? document.querySelector<HTMLElement>(target)
            : target;
        if (!element)
            throw new Error(`WalletInline mount target was not found: ${String(target)}`);
        this.options = { ...this.options, mount: element };
        this.open();
    }
    isMounted() {
        return this.isOpen();
    }
}

export function createWalletModal(options: WalletUiOptions) {
    const modal = new WalletModal(options);
    return modal;
}

export function createWalletInline(options: WalletInlineOptions) {
    return new WalletInline(options);
}
