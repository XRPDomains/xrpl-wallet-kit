import assert from "node:assert/strict";
import test from "node:test";
import type { WalletMetadata } from "../packages/core/src";
import { WalletButton, WalletButtonController, WalletInline, XrplWalletInline } from "../packages/ui/src/index";
import { WalletModal } from "../packages/ui/src/modal";
import { WalletToast } from "../packages/ui/src/toast";
import { lightTheme, resolveWalletTheme } from "../packages/ui/src/themes";

const manager = {
  on: () => () => undefined,
  cancelPendingConnection: async () => undefined,
  getNetwork: () => ({ id: "mainnet", name: "XRPL Mainnet", networkType: "MAINNET" }),
  getWallets: () => [],
  getAdapter: () => undefined
};

test("UI package exports WalletButton alias for vanilla imports", () => {
  assert.equal(WalletButton, WalletButtonController);
});

test("UI package exports WalletInline and its XRPL alias", () => {
  assert.equal(WalletInline, XrplWalletInline);
});

test("WalletInline reuses wallet rendering without modal-only chrome", () => {
  const wallet: WalletMetadata = {
    id: "xaman",
    name: "Xaman",
    type: "mobile",
    group: "Recommended",
    recommended: true
  };
  const modal = new WalletModal({
    manager: manager as never,
    themeMode: "light"
  }) as unknown as {
    renderWallet(wallet: WalletMetadata, layout: "list"): string;
  };
  const inline = new WalletInline({
    manager: manager as never,
    themeMode: "light"
  }) as unknown as {
    renderShell(): string;
    renderWallet(wallet: WalletMetadata, layout: "list"): string;
    renderMobileSheetOverrides(theme: typeof lightTheme): string;
  };

  assert.equal(inline.renderWallet(wallet, "list"), modal.renderWallet(wallet, "list"));
  assert.match(inline.renderShell(), /role="region"/);
  assert.doesNotMatch(inline.renderShell(), /aria-modal="true"|data-xwk-close/);
  assert.match(inline.renderMobileSheetOverrides(lightTheme), /\.xwk-inline\{[^}]*position:relative!important/);
  assert.match(inline.renderMobileSheetOverrides(lightTheme), /\.xwk-inline \.xwk-modal\{[^}]*width:100%!important/);
});

test("WalletModal buttons defend against host button CSS", () => {
  const modal = new WalletModal({
    manager: manager as never,
    themeMode: "light"
  }) as unknown as {
    renderStyles(theme: typeof lightTheme, layout: "list", size: "default", textSize: "sm"): string;
  };
  const styles = modal.renderStyles(lightTheme, "list", "default", "sm");

  assert.match(styles, /\.xwk-close,\.xwk-back\{[^}]*appearance:none/);
  assert.match(styles, /\.xwk-close,\.xwk-back\{[^}]*box-sizing:border-box/);
  assert.match(styles, /\.xwk-wallet\{[^}]*appearance:none/);
  assert.match(styles, /\.xwk-wallet\{[^}]*box-sizing:border-box/);
  assert.match(styles, /\.xwk-wallet\{[^}]*line-height:1\.2/);
  assert.match(styles, /\.xwk-action\{[^}]*appearance:none/);
  assert.match(styles, /\.xwk-action\{[^}]*box-sizing:border-box/);
  assert.match(styles, /\.xwk-action\{[^}]*line-height:1\.2/);
  assert.match(styles, /\.xwk-action\{[^}]*width:100%/);
});

test("WalletModal uses subtle motion without animating modal dimensions", () => {
  const modal = new WalletModal({
    manager: manager as never,
    themeMode: "light"
  }) as unknown as {
    renderStyles(theme: typeof lightTheme, layout: "list", size: "default", textSize: "sm"): string;
  };
  const styles = modal.renderStyles(lightTheme, "list", "default", "sm");

  assert.match(styles, /\.xwk-overlay\{[^}]*transition:opacity \.2s ease-out/);
  assert.match(styles, /\.xwk-overlay\[data-xwk-state="closing"\]\{[^}]*transition-duration:\.18s/);
  assert.match(styles, /\.xwk-modal\{[^}]*transition:opacity \.24s[^}]*transform \.24s/);
  assert.match(styles, /@media\(prefers-reduced-motion:reduce\)/);
  assert.doesNotMatch(styles, /transition:[^}]*height/);
  assert.doesNotMatch(styles, /xwk-view-forward/);
});

test("WalletModal preserves custom mount through constructor and option updates", () => {
  const mount = {} as HTMLElement;
  const modal = new WalletModal({
    manager: manager as never,
    mount,
    themeMode: "light"
  }) as unknown as WalletModal & { options: { mount?: HTMLElement }; updateOptions(options: { themeMode?: "dark" | "light"; mount?: HTMLElement }): void };

  assert.equal(modal.options.mount, mount);

  modal.updateOptions({ themeMode: "dark" });
  assert.equal(modal.options.mount, mount);

  const nextMount = {} as HTMLElement;
  modal.updateOptions({ mount: nextMount });
  assert.equal(modal.options.mount, nextMount);
});

test("WalletModal clamps long adapter errors before display", () => {
  const modal = new WalletModal({
    manager: manager as never,
    themeMode: "light"
  }) as unknown as {
    getFriendlyErrorMessage(error: unknown): string;
    isTimeoutError(error: unknown, message: string): boolean;
    renderStyles(theme: typeof lightTheme, layout: "list", size: "default", textSize: "sm"): string;
  };
  const longJson = JSON.stringify({ message: "Snap failed", data: "x".repeat(900) });
  const message = modal.getFriendlyErrorMessage(new Error(longJson));
  const wrappedTimeout = new Error("Failed to connect Girin Wallet: WalletConnect connection timed out. Please try again.");
  const styles = modal.renderStyles(lightTheme, "list", "default", "sm");

  assert.equal(message, "Wallet request failed. Please try again.");
  assert.equal(modal.getFriendlyErrorMessage(wrappedTimeout), "Wallet request timed out. Please try again.");
  assert.equal(modal.isTimeoutError(wrappedTimeout, wrappedTimeout.message), true);
  assert.match(styles, /\.xwk-status\{[^}]*overflow-wrap:anywhere/);
  assert.match(styles, /\.xwk-qr-message span\{[^}]*overflow-wrap:anywhere/);
});

test("WalletModal visual states use semantic theme tokens", () => {
  const modal = new WalletModal({
    manager: manager as never,
    themeMode: "light"
  }) as unknown as {
    renderStyles(theme: typeof lightTheme, layout: "list", size: "default", textSize: "sm"): string;
    renderMobileSheetOverrides(theme: typeof lightTheme): string;
    checkIcon(): string;
  };
  const theme = {
    ...lightTheme,
    accent: "#123abc",
    error: "#cc3344",
    success: "#11aa66",
    muted: "#556677",
    border: "#ddeeff",
    spinnerTrail: "#ccddee",
    headerBackground: "#f9fafb",
    overlayBlur: 6
  };
  const styles = modal.renderStyles(theme, "list", "default", "sm");
  const mobileOverrides = modal.renderMobileSheetOverrides(theme);

  assert.match(styles, /\.xwk-overlay\{[^}]*backdrop-filter:blur\(6px\)/);
  assert.match(styles, /\.xwk-header\{[^}]*background:#f9fafb/);
  assert.match(styles, /\.xwk-status\.xwk-error,\.xwk-error-text\{color:#cc3344\}/);
  assert.match(styles, /\.xwk-spinner:before\{[^}]*border-top-color:#556677/);
  assert.match(styles, /\.xwk-spinner:before\{[^}]*border-right-color:#ccddee/);
  assert.match(styles, /\.xwk-qr-code\{[^}]*color:#556677/);
  assert.match(styles, /\.xwk-copied-icon\{color:#11aa66/);
  assert.match(styles, /\.xwk-footer\{[^}]*font-size:11px/);
  assert.match(mobileOverrides, /\.xwk-error-text,\.xwk-connect-status\.xwk-error-text,\.xwk-qr-loading\.xwk-error-text\{color:#cc3344!important\}/);
  assert.match(mobileOverrides, /\.xwk-close:focus-visible,\.xwk-back:focus-visible\{outline:2px solid #123abc!important/);
  assert.match(modal.checkIcon(), /fill="currentColor"/);
  assert.doesNotMatch(styles, /#1d9bf0|#64748b|rgba\(148,163,184/);
});

test("themeName presets resolve before token overrides", () => {
  const theme = resolveWalletTheme({
    mode: "light",
    themeName: "midnight",
    theme: { accent: "#abcdef" },
    customTheme: { success: "#00cc88" }
  });

  assert.equal(theme.background, "#0f1629");
  assert.equal(theme.overlayBlur, 12);
  assert.equal(theme.accent, "#abcdef");
  assert.equal(theme.success, "#00cc88");
});

test("WalletModal hides wallet group subtitles by default and keeps recommended badge", () => {
  const modal = new WalletModal({
    manager: manager as never,
    themeMode: "light"
  }) as unknown as {
    renderStyles(theme: typeof lightTheme, layout: "list", size: "default", textSize: "sm"): string;
    renderWallet(wallet: WalletMetadata, layout: "list" | "card" | "icon"): string;
  };
  const wallet: WalletMetadata = {
    id: "xaman",
    name: "Xaman",
    type: "mobile",
    group: "Recommended",
    recommended: true
  };
  const styles = modal.renderStyles(lightTheme, "list", "default", "sm");
  const html = modal.renderWallet(wallet, "list");

  assert.match(styles, /\.xwk-wallet-badges\{[^}]*margin-left:auto/);
  assert.match(styles, /\.xwk-wallet-badge\.xwk-recommended\{[^}]*color:#0078ae/);
  assert.match(html, /class="xwk-wallet-badge xwk-recommended">Recommended<\/span>/);
  assert.doesNotMatch(html, /<span class="xwk-group">Mobile wallet<\/span>/);
  assert.doesNotMatch(html, /<span class="xwk-group">Recommended<\/span>/);
});

test("WalletModal can opt in to wallet group subtitles", () => {
  const modal = new WalletModal({
    manager: manager as never,
    themeMode: "light",
    showWalletGroup: true
  }) as unknown as {
    renderWallet(wallet: WalletMetadata, layout: "list" | "card" | "icon"): string;
  };
  const wallet: WalletMetadata = {
    id: "xaman",
    name: "Xaman",
    type: "mobile",
    group: "Recommended",
    recommended: true
  };
  const html = modal.renderWallet(wallet, "list");

  assert.match(html, /<span class="xwk-group">Mobile wallet<\/span>/);
  assert.doesNotMatch(html, /<span class="xwk-group">Recommended<\/span>/);
  assert.doesNotMatch(modal.renderWallet(wallet, "icon"), /<span class="xwk-group">/);
});

test("WalletModal keeps recommended badge text when partial messages omit new labels", () => {
  const modal = new WalletModal({
    manager: manager as never,
    themeMode: "light",
    messages: { recommended: undefined, installed: undefined } as never
  }) as unknown as {
    renderWallet(wallet: WalletMetadata, layout: "list" | "card" | "icon"): string;
  };
  const wallet: WalletMetadata = {
    id: "xaman",
    name: "Xaman",
    type: "mobile",
    group: "Recommended",
    recommended: true
  };
  const html = modal.renderWallet(wallet, "list");

  assert.match(html, /class="xwk-wallet-badge xwk-recommended">Recommended<\/span>/);
});

test("WalletModal custom QR supports light QR mode without changing modal frame", () => {
  const modal = new WalletModal({
    manager: manager as never,
    themeMode: "dark"
  }) as unknown as {
    renderStyles(theme: typeof lightTheme, layout: "list", size: "default", textSize: "sm"): string;
  };
  const styles = modal.renderStyles(lightTheme, "list", "default", "sm");

  assert.match(styles, /\.xwk-qr-code-wrap\{position:relative/);
  assert.match(styles, /\.xwk-qr-code-light\{background:#fff;padding:8px\}/);
  assert.match(styles, /\.xwk-qr-theme-action\{[^}]*position:absolute/);
  assert.match(styles, /\.xwk-qr-theme-action\{[^}]*height:34px/);
  assert.match(styles, /\.xwk-qr-theme-action\{[^}]*opacity:0/);
  assert.match(styles, /\.xwk-qr-theme-action\{[^}]*pointer-events:none/);
  assert.match(styles, /\.xwk-qr-code-wrap:hover \.xwk-qr-theme-action,[^}]*\.xwk-qr-theme-action:focus-visible\{opacity:1;pointer-events:auto\}/);
  assert.match(styles, /\.xwk-qr-card-actions-dual\{grid-template-columns:repeat\(auto-fit,minmax\(0,1fr\)\)\}/);
  assert.match(styles, /\.xwk-qr-card-actions-dual\{grid-template-columns:1fr\}/);
  assert.doesNotMatch(styles, /transition:[^}]*height/);
});

test("WalletModal installs shared styles instead of reinjecting inline style tags", () => {
  const modal = new WalletModal({
    manager: manager as never,
    themeMode: "light"
  }) as unknown as {
    renderShell(): string;
  };

  assert.doesNotMatch(modal.renderShell(), /<style>/);
});

test("WalletModal delegates only WalletConnect default modal wallets", () => {
  const modal = new WalletModal({
    manager: manager as never,
    themeMode: "light"
  }) as unknown as {
    shouldDelegateToWalletConnectModal(wallet: unknown, adapter: unknown): boolean;
  };
  const appKitAdapter = { capabilities: { qr: false } };
  const customQrAdapter = { capabilities: { qr: true } };

  assert.equal(
    modal.shouldDelegateToWalletConnectModal(
      { id: "walletconnect", type: "walletconnect", group: "WalletConnect" },
      appKitAdapter
    ),
    true
  );
  assert.equal(
    modal.shouldDelegateToWalletConnectModal(
      { id: "bifrost", type: "walletconnect", group: "WalletConnect" },
      customQrAdapter
    ),
    false
  );
  assert.equal(
    modal.shouldDelegateToWalletConnectModal(
      { id: "xaman", type: "extension", group: "Recommended" },
      appKitAdapter
    ),
    false
  );
});

test("WalletModal uses custom QR only for WalletConnect list or group modes", () => {
  const defaultModal = new WalletModal({
    manager: manager as never,
    walletConnectUiMode: "default",
    themeMode: "light"
  }) as unknown as {
    shouldUseCustomWalletConnectQr(wallet: unknown, adapter: unknown): boolean;
  };
  const groupModal = new WalletModal({
    manager: manager as never,
    walletConnectUiMode: "group",
    themeMode: "light"
  }) as unknown as {
    shouldUseCustomWalletConnectQr(wallet: unknown, adapter: unknown): boolean;
  };
  const wallet = { id: "bifrost", type: "walletconnect", group: "WalletConnect" };
  const customQrAdapter = { capabilities: { qr: true } };

  assert.equal(defaultModal.shouldUseCustomWalletConnectQr(wallet, customQrAdapter), false);
  assert.equal(groupModal.shouldUseCustomWalletConnectQr(wallet, customQrAdapter), true);
});

test("WalletModal treats omitted WalletConnect mode as default AppKit mode", () => {
  const modal = new WalletModal({
    manager: manager as never,
    themeMode: "light"
  }) as unknown as {
    shouldDelegateToWalletConnectModal(wallet: unknown, adapter: unknown): boolean;
    shouldUseCustomWalletConnectQr(wallet: unknown, adapter: unknown): boolean;
  };
  const wallet = { id: "walletconnect", type: "walletconnect", group: "WalletConnect" };
  const adapter = { capabilities: { qr: true } };

  assert.equal(modal.shouldDelegateToWalletConnectModal(wallet, adapter), true);
  assert.equal(modal.shouldUseCustomWalletConnectQr(wallet, adapter), false);
});

test("WalletToast controls defend against host button and link CSS", () => {
  const toast = new WalletToast({
    manager: manager as never,
    themeMode: "light"
  }) as unknown as {
    renderStyles(): string;
  };
  const styles = toast.renderStyles();

  assert.match(styles, /\.xwk-toast-dismiss\{[^}]*appearance:none/);
  assert.match(styles, /\.xwk-toast-dismiss\{[^}]*box-sizing:border-box/);
  assert.match(styles, /\.xwk-toast-dismiss\{[^}]*flex:0 0 44px/);
  assert.match(styles, /\.xwk-toast-link\{[^}]*box-sizing:border-box/);
  assert.match(styles, /\.xwk-toast-link\{[^}]*line-height:1\.2/);
  assert.match(styles, /\.xwk-toast-link\{[^}]*transform:none/);
});
