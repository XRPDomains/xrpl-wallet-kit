import assert from "node:assert/strict";
import test from "node:test";
import { WalletButtonController } from "../packages/ui/src/button";

function createButton(theme: Record<string, unknown>) {
  const manager = {
    on: () => () => undefined,
    getSession: () => null
  };
  const modal = {
    open: () => undefined,
    close: () => undefined,
    isOpen: () => false,
    on: () => () => undefined,
    onClose: () => () => undefined
  };
  return new WalletButtonController({
    manager: manager as never,
    modal,
    themeMode: "dark",
    theme
  });
}

test("WalletButton fallback icon keeps contrast with incomplete custom dark theme", () => {
  const button = createButton({
    background: "#050608",
    foreground: "#f8fafc",
    accent: "#4aa3ff",
    border: "transparent"
  }) as unknown as { renderStyles(): string };

  const styles = button.renderStyles();

  assert.match(styles, /\.xwk-button-icon-fallback\{[^}]*background:rgba\(255,255,255,\.10\)/);
  assert.match(styles, /\.xwk-button-icon-fallback\{[^}]*color:#f8fafc/);
  assert.match(styles, /\.xwk-button-icon\{[^}]*border:1px solid rgba\(255,255,255,\.12\)/);
});

test("WalletButton pre-connect layout clips and shrinks flex children defensively", () => {
  const button = createButton({}) as unknown as { renderStyles(): string };
  const styles = button.renderStyles();

  assert.match(styles, /\.xwk-account-button\{[^}]*overflow:hidden/);
  assert.match(styles, /\.xwk-button-icon\{[^}]*flex:0 0 28px/);
  assert.match(styles, /\.xwk-button-icon\{[^}]*min-width:28px/);
  assert.match(styles, /\.xwk-button-icon-svg-fallback svg\{[^}]*height:17px/);
  assert.match(styles, /\.xwk-button-label\{[^}]*flex:1 1 0/);
});

test("WalletButton account actions defend against host button CSS", () => {
  const button = createButton({}) as unknown as { renderStyles(): string };
  const styles = button.renderStyles();

  assert.match(styles, /\.xwk-account-panel-actions button,\.xwk-account-panel-actions a\{[^}]*appearance:none/);
  assert.match(styles, /\.xwk-account-panel-actions button,\.xwk-account-panel-actions a\{[^}]*box-sizing:border-box/);
  assert.match(styles, /\.xwk-account-panel-actions button,\.xwk-account-panel-actions a\{[^}]*line-height:1\.2/);
  assert.match(styles, /\.xwk-account-panel-actions button,\.xwk-account-panel-actions a\{[^}]*width:100%/);
  assert.match(styles, /\.xwk-account-panel-actions span\{[^}]*text-overflow:ellipsis/);
});

test("WalletButton pre-connect fallback icon renders SVG instead of label text", () => {
  const button = createButton({}) as unknown as { renderButton(): string };
  const html = button.renderButton();

  assert.match(html, /xwk-button-icon-svg-fallback/);
  assert.match(html, /<svg[^>]*viewBox="0 0 24 24"/);
  assert.doesNotMatch(html, /xwk-button-icon[^>]*>Connect Wallet</);
});
