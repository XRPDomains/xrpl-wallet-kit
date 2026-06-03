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
