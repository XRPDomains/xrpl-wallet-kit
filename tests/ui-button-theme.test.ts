import assert from "node:assert/strict";
import test from "node:test";
import type { WalletSession } from "../packages/core/src/types";
import { WalletButtonController } from "../packages/ui/src/button";

function createButton(theme: Record<string, unknown>, overrides: Record<string, unknown> = {}) {
  const manager = {
    on: () => () => undefined,
    getSession: () => null,
    getAccount: () => null
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
    theme,
    ...overrides
  });
}

function createSession(): WalletSession {
  return {
    adapterId: "test",
    account: {
      address: "rTestAddress1234567890",
      network: {
        id: "mainnet",
        name: "Mainnet",
        networkType: "MAINNET",
        rpcUrl: "wss://xrplcluster.com"
      }
    },
    connectedAt: Date.now()
  };
}

function waitForMicrotasks() {
  return new Promise((resolve) => setTimeout(resolve, 0));
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
  assert.match(styles, /\.xwk-address-qr-trigger\{[^}]*height:36px/);
  assert.match(styles, /\.xwk-address-qr-trigger svg\{height:16px;width:16px/);
  assert.match(styles, /\.xwk-account-close,\.xwk-account-back\{[^}]*appearance:none/);
  assert.match(styles, /\.xwk-account-close:focus-visible,\.xwk-account-back:focus-visible\{outline:2px solid/);
});

test("WalletButton account modal reserves stable height across account and address QR views", () => {
  const button = createButton({}) as unknown as { renderStyles(): string };
  const styles = button.renderStyles();

  assert.match(styles, /\.xwk-account-panel\{[^}]*box-sizing:border-box/);
  assert.match(styles, /\.xwk-account-panel-modal\{[^}]*grid-template-rows:auto minmax\(0,1fr\)/);
  assert.match(styles, /\.xwk-account-panel-modal\{[^}]*height:min\(527px,calc\(100dvh - 48px - env\(safe-area-inset-top\) - env\(safe-area-inset-bottom\)\)\)/);
  assert.match(styles, /\.xwk-account-modal-body\{[^}]*min-height:0/);
  assert.match(styles, /\.xwk-address-qr-content\{[^}]*min-height:100%/);
  assert.match(styles, /@media\(max-width:520px\).*\.xwk-account-panel-modal\{[^}]*height:min\(527px,calc\(100dvh - env\(safe-area-inset-top\)\)\)/);
});

test("WalletButton pre-connect fallback icon renders SVG instead of label text", () => {
  const button = createButton({}) as unknown as { renderButton(): string };
  const html = button.renderButton();

  assert.match(html, /xwk-button-icon-svg-fallback/);
  assert.match(html, /<svg[^>]*viewBox="0 0 24 24"/);
  assert.doesNotMatch(html, /xwk-button-icon[^>]*>Connect Wallet</);
});

test("WalletButton copied icon follows theme accent", () => {
  const button = createButton({
    accent: "#123abc"
  }) as unknown as { renderStyles(): string; copiedIcon(): string };
  const styles = button.renderStyles();

  assert.match(styles, /\.xwk-copied-icon\{color:#123abc/);
  assert.match(button.copiedIcon(), /fill="currentColor"/);
  assert.doesNotMatch(button.copiedIcon(), /#1d9bf0/);
});

test("WalletButton balance loading uses a stable small spinner", () => {
  const session = createSession();
  const button = createButton({}, {
    showBalance: true,
    manager: {
      on: () => () => undefined,
      getSession: () => session,
      getAccount: () => session.account
    }
  }) as unknown as { renderButton(): string; renderStyles(): string; balanceLoading: boolean };

  button.balanceLoading = true;
  assert.match(button.renderButton(), /xwk-button-balance-loading/);
  assert.match(button.renderButton(), /xwk-balance-spinner/);
  assert.match(button.renderStyles(), /\.xwk-balance-spinner\{[^}]*height:13px/);
});

test("WalletButton exposes resolved balance on session only when showBalance is enabled", async () => {
  const session = createSession();
  const button = createButton({}, {
    showBalance: true,
    manager: {
      on: () => () => undefined,
      getSession: () => session,
      getAccount: () => session.account
    },
    balanceResolver: async () => ({
      value: "12.5",
      formatted: "12.5 XRP",
      symbol: "XRP",
      total: "22.5",
      totalFormatted: "22.5 XRP"
    })
  }) as unknown as { resolveBalance(session: WalletSession | null): Promise<void> };

  await button.resolveBalance(session);

  assert.equal(session.balance?.value, "12.5");
  assert.equal(session.balance?.formatted, "12.5 XRP");
  assert.equal(session.balance?.total, "22.5");
});

test("WalletButton preserves spendable balance metadata on session", async () => {
  const session = createSession();
  const button = createButton({}, {
    showBalance: true,
    manager: {
      on: () => () => undefined,
      getSession: () => session,
      getAccount: () => session.account
    },
    balanceResolver: async () => ({
      value: "0",
      formatted: "0 XRP",
      symbol: "XRP",
      total: "1.199917",
      totalFormatted: "1.199917 XRP",
      reserve: "1.2",
      ownerCount: 1,
      spendable: false,
      reserveLocked: true
    })
  }) as unknown as { resolveBalance(session: WalletSession | null): Promise<void> };

  await button.resolveBalance(session);

  assert.equal(session.balance?.spendable, false);
  assert.equal(session.balance?.reserveLocked, true);
  assert.equal(session.balance?.reserve, "1.2");
});

test("WalletButton refreshIdentity bypasses cached identity", async () => {
  const session = createSession();
  const calls: Array<{ force?: boolean }> = [];
  const button = createButton({}, {
    manager: {
      on: () => () => undefined,
      getSession: () => session,
      getAccount: () => session.account
    },
    identityResolver: async (_address: string, _session: WalletSession, context?: { force?: boolean }) => {
      calls.push({ force: context?.force });
      return { name: context?.force ? "fresh.xrp" : "cached.xrp" };
    },
    onIdentityChange: () => undefined
  }) as unknown as {
    resolveIdentity(session: WalletSession | null): Promise<void>;
    refreshIdentity(): Promise<void>;
    identityName: string | null;
  };

  await button.resolveIdentity(session);
  await button.refreshIdentity();

  assert.deepEqual(calls, [{ force: undefined }, { force: true }]);
  assert.equal(button.identityName, "fresh.xrp");
});

test("WalletButton balance refresh is event-driven when showBalance is enabled", async () => {
  const originalWindow = (globalThis as { window?: unknown }).window;
  (globalThis as { window?: unknown }).window = {
    setTimeout: (handler: () => void) => {
      handler();
      return 1;
    },
    clearTimeout: () => undefined
  };

  try {
    const session = createSession();
    const handlers = new Map<string, (event?: unknown) => void>();
    let calls = 0;
    const button = createButton({}, {
      showBalance: true,
      manager: {
        on: (event: string, handler: (event?: unknown) => void) => {
          handlers.set(event, handler);
          return () => undefined;
        },
        getSession: () => session,
        getAccount: () => session.account
      },
      balanceResolver: async () => ({
        value: String(++calls),
        formatted: `${calls} XRP`,
        symbol: "XRP"
      })
    }) as unknown as { resolveBalance(session: WalletSession | null): Promise<void> };

    await button.resolveBalance(session);
    handlers.get("tx_confirmed")?.();
    await waitForMicrotasks();
    handlers.get("accountChanged")?.();
    await waitForMicrotasks();
    handlers.get("networkChanged")?.();
    await waitForMicrotasks();
    handlers.get("tx_submitted")?.();
    await waitForMicrotasks();

    assert.equal(calls, 6);
    assert.equal(session.balance?.value, "6");
  } finally {
    (globalThis as { window?: unknown }).window = originalWindow;
  }
});

test("WalletButton account panel can show address QR without duplicating identity layout", () => {
  const session = createSession();
  const button = createButton({}, {
    manager: {
      on: () => () => undefined,
      getSession: () => session,
      getAccount: () => session.account
    }
  }) as unknown as {
    renderPanelContent(session: WalletSession): string;
    renderAddressQrPanelContent(session: WalletSession): string;
    renderPanel(): string;
    identityName: string | null;
    addressQrOpen: boolean;
  };

  const noIdentityHtml = button.renderPanelContent(session);
  assert.match(noIdentityHtml, /xwk-account-name-with-qr/);
  assert.match(noIdentityHtml, /data-xwk-address-qr/);
  assert.doesNotMatch(noIdentityHtml, /xwk-account-address/);

  button.identityName = "xrpdomains.xrp";
  const identityHtml = button.renderPanelContent(session);
  assert.match(identityHtml, /xwk-account-address/);
  assert.match(identityHtml, /data-xwk-address-qr/);
  assert.doesNotMatch(identityHtml, /xwk-account-name-with-qr/);

  const qrHtml = button.renderAddressQrPanelContent(session);
  assert.match(qrHtml, /xwk-address-qr-code/);
  assert.match(qrHtml, /rTestAddress1234567890/);
  assert.match(qrHtml, /Copy address/);

  button.addressQrOpen = true;
  assert.match(button.renderPanel(), /data-xwk-account-back/);
  assert.match(button.renderPanel(), /Address QR/);
});

test("WalletButton address QR render is defensive when session address is missing", () => {
  const session = createSession();
  const missingAddressSession = {
    ...session,
    account: {
      ...session.account,
      address: undefined
    }
  } as unknown as WalletSession;
  const classicAddressSession = {
    ...session,
    account: {
      ...session.account,
      address: undefined,
      classicAddress: "rClassicAddress1234567890"
    }
  } as unknown as WalletSession;
  const button = createButton({}, {
    manager: {
      on: () => () => undefined,
      getSession: () => missingAddressSession,
      getAccount: () => missingAddressSession.account
    }
  }) as unknown as {
    renderPanelContent(session: WalletSession): string;
    renderAddressQrPanelContent(session: WalletSession): string;
    escapeHtml(value: unknown): string;
  };

  assert.doesNotThrow(() => button.renderPanelContent(missingAddressSession));
  assert.doesNotMatch(button.renderPanelContent(missingAddressSession), /data-xwk-address-qr/);
  assert.equal(button.renderAddressQrPanelContent(missingAddressSession), "");
  assert.equal(button.escapeHtml(undefined), "");

  const fallbackHtml = button.renderPanelContent(classicAddressSession);
  assert.match(fallbackHtml, /data-xwk-address-qr/);
  assert.match(button.renderAddressQrPanelContent(classicAddressSession), /rClassicAddress1234567890/);
});

test("WalletButton address QR trigger can be disabled", () => {
  const session = createSession();
  const button = createButton({}, {
    showAddressQr: false,
    manager: {
      on: () => () => undefined,
      getSession: () => session,
      getAccount: () => session.account
    }
  }) as unknown as {
    renderPanelContent(session: WalletSession): string;
  };

  assert.doesNotMatch(button.renderPanelContent(session), /data-xwk-address-qr/);
});
