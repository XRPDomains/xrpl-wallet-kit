import { getExplorerTxUrl } from "@xrpl-wallet-kit/core";
import type { WalletNetwork, WalletTransaction } from "@xrpl-wallet-kit/core";
import { resolveWalletUiMessages } from "./locales";
import { darkTheme, lightTheme } from "./themes";
import type { ResolvedTheme } from "./themes";
import type { WalletToastOptions, WalletToastPosition, WalletUiThemeMode } from "./types";

type ToastState = WalletTransaction;

const DEFAULT_AUTO_DISMISS_MS = 5000;
const DEFAULT_MAX_VISIBLE = 3;

export class WalletToast {
  private root?: HTMLDivElement;
  private readonly offEvents: Array<() => void> = [];
  private readonly dismissTimers = new Map<string, number>();
  private readonly toasts = new Map<string, ToastState>();

  constructor(private options: WalletToastOptions) {
    this.offEvents.push(
      options.manager.on("tx_submitted", ({ hash, transaction }) => this.upsert(hash, transaction ?? {
        hash,
        status: "submitted",
        submittedAt: Date.now()
      })),
      options.manager.on("tx_confirmed", ({ hash, transaction }) => this.upsert(hash, transaction ?? {
        hash,
        status: "confirmed",
        submittedAt: Date.now(),
        confirmedAt: Date.now()
      })),
      options.manager.on("tx_failed", ({ hash, transaction, error }) => {
        if (!hash) return;
        this.upsert(hash, transaction ?? {
          hash,
          status: "failed",
          submittedAt: Date.now(),
          failedAt: Date.now(),
          error
        });
      }),
      options.manager.on("disconnected", () => this.clearAll())
    );
  }

  mount(container: HTMLElement = this.options.mount ?? document.body): void {
    if (this.root?.isConnected) return;
    this.root = document.createElement("div");
    this.root.className = `xwk-toast-root xwk-toast-root--${this.position()}`;
    this.root.setAttribute("aria-live", "polite");
    this.root.setAttribute("aria-label", "Transaction notifications");
    this.root.innerHTML = `<style>${this.renderStyles()}</style>`;
    container.appendChild(this.root);
    this.render();
  }

  destroy(): void {
    this.clearTimers();
    this.offEvents.splice(0).forEach((off) => off());
    this.root?.remove();
    this.root = undefined;
    this.toasts.clear();
  }

  clearAll(): void {
    this.clearTimers();
    this.toasts.clear();
    this.render();
  }

  private upsert(hash: string, transaction: WalletTransaction): void {
    this.toasts.set(hash, transaction);
    if (!this.root?.isConnected && typeof document !== "undefined") this.mount();
    this.enforceLimit();
    this.render();
    if (transaction.status === "confirmed" || transaction.status === "failed") {
      this.scheduleDismiss(hash);
    }
  }

  private enforceLimit(): void {
    const maxVisible = this.options.maxVisible ?? DEFAULT_MAX_VISIBLE;
    const entries = [...this.toasts.entries()].sort((a, b) => this.getTimestamp(b[1]) - this.getTimestamp(a[1]));
    entries.slice(maxVisible).forEach(([hash]) => this.remove(hash));
  }

  private scheduleDismiss(hash: string): void {
    const autoDismissMs = this.options.autoDismissMs ?? DEFAULT_AUTO_DISMISS_MS;
    if (autoDismissMs <= 0) return;
    const previous = this.dismissTimers.get(hash);
    if (previous) window.clearTimeout(previous);
    const timer = window.setTimeout(() => this.remove(hash), autoDismissMs);
    this.dismissTimers.set(hash, timer);
  }

  private remove(hash: string): void {
    const timer = this.dismissTimers.get(hash);
    if (timer) window.clearTimeout(timer);
    this.dismissTimers.delete(hash);
    this.toasts.delete(hash);
    this.render();
  }

  private render(): void {
    if (!this.root) return;
    this.root.className = `xwk-toast-root xwk-toast-root--${this.position()}`;
    const style = this.root.querySelector("style")?.outerHTML ?? `<style>${this.renderStyles()}</style>`;
    const toasts = [...this.toasts.values()]
      .sort((a, b) => this.getTimestamp(a) - this.getTimestamp(b))
      .map((transaction) => this.renderToast(transaction))
      .join("");
    this.root.innerHTML = `${style}${toasts}`;
    this.root.querySelectorAll<HTMLButtonElement>("[data-xwk-toast-dismiss]").forEach((button) => {
      button.addEventListener("click", () => {
        const hash = button.dataset.xwkToastDismiss;
        if (hash) this.remove(hash);
      });
    });
  }

  private renderToast(transaction: WalletTransaction): string {
    const messages = this.messages();
    const hash = transaction.hash;
    const hashLabel = this.formatHash(hash);
    const label = transaction.status === "confirmed"
      ? "Transaction confirmed"
      : transaction.status === "failed"
        ? "Transaction failed"
        : "Transaction submitted";
    const explorerUrl = this.getExplorerUrl(hash, transaction.account?.network);
    const link = explorerUrl
      ? `<a class="xwk-toast-link" href="${this.escapeHtml(explorerUrl)}" target="_blank" rel="noopener">View ${this.externalIcon()}</a>`
      : "";
    return `<div class="xwk-toast xwk-toast--${transaction.status}" data-hash="${this.escapeHtml(hash)}" role="status"><div class="xwk-toast-icon">${this.renderStatusIcon(transaction.status)}</div><div class="xwk-toast-body"><span class="xwk-toast-label">${this.escapeHtml(label)}</span><span class="xwk-toast-hash">${this.escapeHtml(hashLabel)}</span></div>${link}<button class="xwk-toast-dismiss" data-xwk-toast-dismiss="${this.escapeHtml(hash)}" aria-label="${this.escapeHtml(messages.close)}" type="button">&times;</button></div>`;
  }

  private renderStatusIcon(status: WalletTransaction["status"]): string {
    if (status === "confirmed") return `<span class="xwk-toast-icon-mark" aria-hidden="true">${this.checkIcon()}</span>`;
    if (status === "failed") return `<span class="xwk-toast-icon-mark" aria-hidden="true">${this.closeIcon()}</span>`;
    return `<span class="xwk-toast-spinner" aria-hidden="true"></span>`;
  }

  private renderStyles(): string {
    const theme = this.resolveTheme();
    return `.xwk-toast-root{bottom:24px;display:flex;flex-direction:column-reverse;font-family:${theme.fontFamily};gap:10px;pointer-events:none;position:fixed;z-index:2147483646}.xwk-toast-root--bottom-right{right:24px}.xwk-toast-root--bottom-left{left:24px}.xwk-toast-root--bottom-center{left:50%;transform:translateX(-50%)}.xwk-toast{align-items:center;animation:xwk-toast-in .18s ease-out both;background:${theme.background};border:1px solid ${theme.border};border-radius:${theme.radius};box-shadow:none;box-sizing:border-box;color:${theme.foreground};display:flex;gap:12px;max-width:420px;min-width:330px;padding:12px 12px 12px 16px;pointer-events:auto}.xwk-toast-icon{align-items:center;border-radius:999px;display:flex;flex:0 0 32px;height:32px;justify-content:center;width:32px}.xwk-toast-spinner{animation:xwk-spin .9s linear infinite;border:2px solid ${this.resolveThemeMode() === "dark" ? "rgba(74,163,255,.22)" : "rgba(0,120,174,.18)"};border-top-color:${theme.accent};border-radius:999px;display:block;height:18px;width:18px}.xwk-toast--submitted .xwk-toast-icon{background:${this.resolveThemeMode() === "dark" ? "rgba(74,163,255,.16)" : "rgba(0,120,174,.12)"};color:${theme.accent}}.xwk-toast--confirmed .xwk-toast-icon{background:${this.resolveThemeMode() === "dark" ? "rgba(16,185,129,.16)" : "rgba(16,185,129,.12)"};color:#10b981}.xwk-toast--failed .xwk-toast-icon{background:${this.resolveThemeMode() === "dark" ? "rgba(239,68,68,.16)" : "rgba(239,68,68,.12)"};color:#ef4444}.xwk-toast-icon-mark{display:inline-flex}.xwk-toast-body{display:flex;flex:1 1 auto;flex-direction:column;gap:2px;min-width:0}.xwk-toast-label{color:${theme.foreground};font-size:13px;font-weight:600;white-space:nowrap}.xwk-toast-hash{color:${theme.muted};font-family:ui-monospace,"Cascadia Code",monospace;font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.xwk-toast-link{align-items:center;border-radius:${theme.walletRadius};color:${theme.accent};display:inline-flex;flex:0 0 auto;font-size:12px;font-weight:600;gap:4px;min-height:32px;padding:0 6px;text-decoration:none;white-space:nowrap}.xwk-toast-link:hover{background:${theme.surfaceHover};text-decoration:none}.xwk-toast-link svg{height:13px;width:13px}.xwk-toast-dismiss{align-items:center;background:transparent;border:1px solid ${theme.border};border-radius:${theme.walletRadius};box-shadow:none;color:${theme.foreground};cursor:pointer;display:inline-flex;flex:0 0 auto;font-size:24px;font-weight:400;height:44px;justify-content:center;line-height:1;min-height:0;padding:0;touch-action:manipulation;transform:none;width:44px}.xwk-toast-dismiss:hover{background:${theme.surfaceHover};border-color:${theme.border};box-shadow:none;color:${theme.foreground};transform:none}.xwk-toast-dismiss:focus-visible,.xwk-toast-link:focus-visible{outline:2px solid ${theme.accent};outline-offset:2px}@keyframes xwk-toast-in{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}@keyframes xwk-spin{to{transform:rotate(360deg)}}@media(max-width:480px){.xwk-toast-root{bottom:max(12px,env(safe-area-inset-bottom));left:12px;right:12px;transform:none}.xwk-toast{max-width:100%;min-width:0;width:100%}}@media(prefers-reduced-motion:reduce){.xwk-toast,.xwk-toast-spinner{animation:none}}`;
  }

  private getExplorerUrl(hash: string, network?: WalletNetwork): string | undefined {
    const custom = this.options.explorerUrl?.(hash, network);
    if (custom) return custom;
    return getExplorerTxUrl(network, hash);
  }

  private getTimestamp(transaction: WalletTransaction): number {
    return transaction.confirmedAt ?? transaction.failedAt ?? transaction.submittedAt;
  }

  private formatHash(hash: string): string {
    return hash.length > 12 ? `${hash.slice(0, 6)}...${hash.slice(-6)}` : hash;
  }

  private position(): WalletToastPosition {
    return this.options.position ?? "bottom-right";
  }

  private messages() {
    return resolveWalletUiMessages(this.options.language, this.options.messages);
  }

  private resolveTheme(): ResolvedTheme {
    const base = this.resolveThemeMode() === "dark" ? darkTheme : lightTheme;
    return { ...base, ...(this.options.theme ?? {}) };
  }

  private resolveThemeMode(): WalletUiThemeMode {
    return this.options.themeMode === "auto" ? this.getSystemThemeMode() : this.options.themeMode ?? "light";
  }

  private getSystemThemeMode(): "light" | "dark" {
    if (typeof window === "undefined" || !window.matchMedia) return "light";
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  private clearTimers(): void {
    this.dismissTimers.forEach((timer) => window.clearTimeout(timer));
    this.dismissTimers.clear();
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

  private checkIcon(): string {
    return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m5 12 4 4 10-10" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  }

  private closeIcon(): string {
    return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>`;
  }

  private externalIcon(): string {
    return `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M14 5h5v5M10 14 19 5M19 14v4a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  }
}

export function createWalletToast(options: WalletToastOptions) {
  const toast = new WalletToast(options);
  if (options.mount) toast.mount(options.mount);
  return toast;
}
