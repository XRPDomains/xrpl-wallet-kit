import assert from "node:assert/strict";
import test from "node:test";
import { WalletModal } from "../packages/ui/src/modal";
import { WalletToast } from "../packages/ui/src/toast";
import { lightTheme } from "../packages/ui/src/themes";

const manager = {
  on: () => () => undefined,
  getNetwork: () => ({ id: "mainnet", name: "XRPL Mainnet", networkType: "MAINNET" }),
  getWallets: () => [],
  getAdapter: () => undefined
};

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

test("WalletModal clamps long adapter errors before display", () => {
  const modal = new WalletModal({
    manager: manager as never,
    themeMode: "light"
  }) as unknown as {
    getFriendlyErrorMessage(error: unknown): string;
    renderStyles(theme: typeof lightTheme, layout: "list", size: "default", textSize: "sm"): string;
  };
  const longJson = JSON.stringify({ message: "Snap failed", data: "x".repeat(900) });
  const message = modal.getFriendlyErrorMessage(new Error(longJson));
  const styles = modal.renderStyles(lightTheme, "list", "default", "sm");

  assert.equal(message, "Wallet request failed. Please try again.");
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
    muted: "#556677",
    border: "#ddeeff"
  };
  const styles = modal.renderStyles(theme, "list", "default", "sm");
  const mobileOverrides = modal.renderMobileSheetOverrides(theme);

  assert.match(styles, /\.xwk-status\.xwk-error,\.xwk-error-text\{color:#cc3344\}/);
  assert.match(styles, /\.xwk-spinner:before\{[^}]*border-top-color:#556677/);
  assert.match(styles, /\.xwk-spinner:before\{[^}]*border-right-color:#ddeeff/);
  assert.match(styles, /\.xwk-qr-code\{[^}]*color:#556677/);
  assert.match(styles, /\.xwk-copied-icon\{color:#123abc/);
  assert.match(styles, /\.xwk-footer\{[^}]*font-size:11px/);
  assert.match(mobileOverrides, /\.xwk-error-text,\.xwk-connect-status\.xwk-error-text,\.xwk-qr-loading\.xwk-error-text\{color:#cc3344!important\}/);
  assert.match(mobileOverrides, /\.xwk-close:focus-visible,\.xwk-back:focus-visible\{outline:2px solid #123abc!important/);
  assert.match(modal.checkIcon(), /fill="currentColor"/);
  assert.doesNotMatch(styles, /#1d9bf0|#64748b|rgba\(148,163,184/);
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
