import assert from "node:assert/strict";
import test from "node:test";
import { createWalletError } from "@xrpl-wallet-kit/core";
import { WalletKitErrorCode, type WalletMetadata, type WalletSession } from "../packages/core/src";
import { WalletButton, WalletButtonController, WalletInline, XrplWalletInline } from "../packages/ui/src/index";
import { WalletModal } from "../packages/ui/src/modal";
import { WalletToast } from "../packages/ui/src/toast";
import { QR_LIGHT } from "../packages/ui/src/icons";
import { darkTheme, glassTheme, lightTheme, resolveWalletTheme } from "../packages/ui/src/themes";

const manager = {
  on: () => () => undefined,
  cancelPendingConnection: async () => undefined,
  getNetwork: () => ({ id: "mainnet", name: "XRPL Mainnet", networkType: "MAINNET" }),
  getSession: () => null,
  getAccount: () => null,
  getWallets: () => [],
  getAdapter: () => undefined
};

test("UI package exports WalletButton alias for vanilla imports", () => {
  assert.equal(WalletButton, WalletButtonController);
});

test("close controls use color-only hover/active feedback in light and dark themes", () => {
  for (const [mode, theme] of [["light", lightTheme], ["dark", darkTheme]] as const) {
    const modal = new WalletModal({ manager: manager as never, themeMode: mode }) as unknown as {
      renderStyles(theme: typeof lightTheme, layout: "list", size: "default", textSize: "sm"): string;
    };
    const button = new WalletButtonController({ manager: manager as never, modal: modal as unknown as WalletModal, themeMode: mode }) as unknown as { renderStyles(): string };
    const toast = new WalletToast({ manager: manager as never, themeMode: mode }) as unknown as { renderStyles(): string };
    for (const [styles, selector] of [
      [modal.renderStyles(theme, "list", "default", "sm"), ".xwk-close:hover,.xwk-back:hover,.xwk-close:active,.xwk-back:active"],
      [button.renderStyles(), ".xwk-account-close:hover,.xwk-account-back:hover,.xwk-account-close:active,.xwk-account-back:active"],
      [toast.renderStyles(), ".xwk-toast-dismiss:hover,.xwk-toast-dismiss:active"],
    ]) {
      assert.ok(styles.includes(`${selector}{`));
      const rule = styles.split(`${selector}{`)[1].split("}")[0];
      assert.match(rule, /background:transparent!important/);
      assert.ok(rule.includes(`color:${theme.foreground}`));
      assert.match(rule, /box-shadow:none/);
      assert.match(rule, /transform:none/);
      assert.match(styles, /:focus-visible/);
    }
    assert.match(button.renderStyles(), /\.xwk-account-close,\.xwk-account-back\{[^}]*box-sizing:border-box/);
    assert.match(toast.renderStyles(), /\.xwk-toast-dismiss\{[^}]*border:0!important/);
  }
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
  assert.match(styles, /\.xwk-grid\{display:grid;[^}]*gap:7px\}/);
  assert.match(styles, /\.xwk-overlay\[data-xwk-view="qr"\] \.xwk-qr\{display:block\}\.xwk-grid\{/);
  assert.doesNotMatch(styles, /xwk-network-badge|xwk-network-row/);
});

test("wallet list shows network only in the footer for mainnet, testnet and devnet", () => {
  for (const family of ["xrpl", "xahau"] as const) {
    for (const networkType of ["MAINNET", "TESTNET", "DEVNET"] as const) {
      const name = `${family === "xahau" ? "Xahau" : "XRPL"} ${networkType}`;
      const modal = new WalletModal({
        manager: { ...manager, getNetwork: () => ({ id: name, name, family, networkType }) } as never
      }) as unknown as { renderShell(): string };
      const shell = modal.renderShell();
      assert.doesNotMatch(shell, /xwk-network-row|xwk-network-badge/);
      assert.match(shell, /xwk-footer-network/);
      assert.equal(shell.split(name).length - 1, 1);
      assert.equal(shell.includes("xwk-footer-network-test"), networkType !== "MAINNET");
    }
  }
});

test("wallet footer identifies the active chain/network without a badge", () => {
  for (const family of ["xrpl", "xahau"] as const) {
    for (const networkType of ["MAINNET", "TESTNET"] as const) {
      const name = `${family === "xrpl" ? "XRPL" : "Xahau"} ${networkType === "MAINNET" ? "Mainnet" : "Testnet"}`;
      const modal = new WalletModal({ manager: { ...manager, getNetwork: () => ({ id: name, name, family, networkType }) } as never }) as unknown as { renderFooter(): string };
      const footer = modal.renderFooter();
      assert.match(footer, /XRPL Wallet Kit/);
      assert.ok(footer.includes(name));
      assert.match(footer, /&middot;/);
      assert.doesNotMatch(footer, /xwk-network-badge|style="/);
      assert.equal(footer.includes("xwk-footer-network-test"), networkType === "TESTNET");
    }
  }
});

test("wallet footer escapes custom branding/network names and permits empty branding", () => {
  const options = { manager: { ...manager, getNetwork: () => ({ id: "custom", name: '<img src=x onerror="bad">', family: "xahau", networkType: "MAINNET" }) } as never };
  const modal = new WalletModal({ ...options, footerText: "<b>My App</b>" }) as unknown as { renderFooter(): string };
  const footer = modal.renderFooter();
  assert.match(footer, /&lt;b&gt;My App&lt;\/b&gt;/);
  assert.match(footer, /Xahau &lt;img/);
  assert.doesNotMatch(footer, /<img|<b>/);
  const unbranded = new WalletModal({ ...options, footerText: "" }) as unknown as { renderFooter(): string };
  assert.doesNotMatch(unbranded.renderFooter(), /&middot;|xwk-footer-brand/);
});

test("wallet footer refreshes on network changes during QR or connection views", () => {
  let name = "XRPL Mainnet";
  let changed!: () => void;
  const modal = new WalletModal({ manager: { ...manager,
    on: (event: string, callback: () => void) => { if (event === "networkChanged") changed = callback; return () => {}; },
    getNetwork: () => ({ id: name, name, family: "xrpl", networkType: "TESTNET" })
  } as never }) as unknown as { root: unknown };
  const footer = { outerHTML: "" };
  for (const view of ["qr", "connect"]) {
    modal.root = { dataset: { xwkView: view }, querySelector: () => footer };
    name = "XRPL Testnet";
    changed();
    assert.match(footer.outerHTML, /XRPL Testnet/);
    assert.doesNotMatch(footer.outerHTML, /XRPL Mainnet/);
  }
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

test("WalletModal openAndWait resolves when a wallet connects", async () => {
  const modal = new WalletModal({
    manager: manager as never,
    themeMode: "light"
  }) as unknown as WalletModal & {
    activeRequestAdapterId?: string;
    handleConnected(adapterId: string, session: WalletSession): void;
    open(): void;
    close(): void;
  };
  const session: WalletSession = {
    adapterId: "xaman",
    account: { address: "rTEST" },
    connectedAt: Date.now()
  };

  modal.open = () => undefined;
  modal.close = () => undefined;
  modal.activeRequestAdapterId = "xaman";

  const pending = modal.openAndWait();
  modal.handleConnected("xaman", session);

  assert.equal(await pending, session);
});

test("WalletModal openAndWait resolves immediately when a session already exists", async () => {
  const session: WalletSession = {
    adapterId: "xaman",
    account: { address: "rCONNECTED" },
    connectedAt: Date.now()
  };
  const sessionManager = Object.create(manager) as typeof manager;
  sessionManager.getSession = () => session;
  const modal = new WalletModal({
    manager: sessionManager as never,
    themeMode: "light"
  });
  let opened = false;
  modal.open = () => { opened = true; };

  assert.equal(await modal.openAndWait(), session);
  assert.equal(opened, false);
});

test("WalletModal openAndWait rejects when the modal closes before connection", async () => {
  const previousDocument = globalThis.document;
  const previousWindow = globalThis.window;
  (globalThis as typeof globalThis & { document: unknown }).document = {
    removeEventListener: () => undefined
  };
  (globalThis as typeof globalThis & { window: unknown }).window = {
    removeEventListener: () => undefined,
    clearTimeout: () => undefined,
    matchMedia: () => ({ matches: true })
  };
  try {
    const modal = new WalletModal({
      manager: manager as never,
      themeMode: "light"
    });
    modal.open = () => undefined;

    const pending = modal.openAndWait();
    modal.close();

    await assert.rejects(pending, {
      name: "WalletKitError",
      code: WalletKitErrorCode.CONNECTION_REJECTED,
      message: "Wallet picker was closed before a wallet connected."
    });
  }
  finally {
    if (previousDocument === undefined)
      Reflect.deleteProperty(globalThis, "document");
    else
      globalThis.document = previousDocument;
    if (previousWindow === undefined)
      Reflect.deleteProperty(globalThis, "window");
    else
      globalThis.window = previousWindow;
  }
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

  assert.equal(message, "Request failed. Try again.");
  assert.equal(modal.getFriendlyErrorMessage(wrappedTimeout), "Timed out. Try again.");
  assert.equal(modal.isTimeoutError(wrappedTimeout, wrappedTimeout.message), true);
  assert.match(styles, /\.xwk-status\{[^}]*overflow-wrap:anywhere/);
  assert.match(styles, /\.xwk-qr-message span\{[^}]*overflow-wrap:anywhere/);
});

test("WalletModal uses concise shared prompts across wallets", () => {
  const modal = new WalletModal({ manager: manager as never }) as unknown as {
    getConnectStatusText(wallet: WalletMetadata, adapterId: string): string;
  };
  for (const [id, name, type, expected] of [
    ["gemwallet", "GemWallet", "extension", "Connect in GemWallet popup."],
    ["xaman", "Xaman", "mobile", "Open Xaman and approve."],
    ["ghostsig", "GhostSig", "web", "Connect in GhostSig popup."],
    ["ledger", "Ledger", "hardware", "Confirm on Ledger."]
  ] as const) {
    assert.equal(modal.getConnectStatusText({ id, name, type }, id), expected);
  }
});

test("WalletModal localizes short errors without changing diagnostic details", () => {
  const modal = new WalletModal({ manager: manager as never, language: "vi" }) as unknown as {
    getFriendlyErrorMessage(error: unknown): string;
  };
  const error = createWalletError.networkMismatch("GemWallet", "XAHAU/Mainnet", "XRPL/Mainnet");
  const original = error.message;
  assert.equal(modal.getFriendlyErrorMessage(error), "Chuyển ví sang XAHAU/Mainnet.");
  assert.equal(error.message, original);
  assert.equal(error.details?.actual, "XRPL/Mainnet");
  assert.equal(modal.getFriendlyErrorMessage(new Error("Xaman request timed out")), "Hết thời gian chờ. Thử lại.");
  const custom = new WalletModal({
    manager: manager as never,
    messages: { requestTimedOut: "Please retry approval." }
  }) as unknown as { getFriendlyErrorMessage(error: unknown): string };
  assert.equal(custom.getFriendlyErrorMessage(new Error("GemWallet timed out")), "Please retry approval.");
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
  assert.match(styles, /\.xwk-copied-icon\{--xwk-success-icon-foreground:#fbfcff;color:#11aa66/);
  assert.match(styles, /\.xwk-footer\{[^}]*font-size:11px/);
  assert.match(mobileOverrides, /\.xwk-error-text,\.xwk-connect-status\.xwk-error-text,\.xwk-qr-loading\.xwk-error-text\{color:#cc3344!important\}/);
  assert.match(mobileOverrides, /\.xwk-close:focus-visible,\.xwk-back:focus-visible\{outline:2px solid #123abc!important/);
  assert.match(modal.checkIcon(), /fill="currentColor"/);
  assert.match(modal.checkIcon(), /stroke="var\(--xwk-success-icon-foreground,currentColor\)"/);
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

test("theme presets use refined surface, border, and glass tokens", () => {
  assert.equal(lightTheme.border, "rgba(17,24,39,.08)");
  assert.equal(lightTheme.surface, "#f3f7fb");
  assert.equal(lightTheme.surfaceHover, "#edf3f8");
  assert.equal(darkTheme.border, "rgba(248,250,252,.10)");
  assert.equal(darkTheme.surfaceHover, "#263244");
  assert.equal(glassTheme.overlayBlur, 24);
  assert.equal(glassTheme.shadow, "0 0 0 1px rgba(255,255,255,.08), 0 12px 40px rgba(15,23,42,.24)");
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
  assert.match(styles, /\.xwk-wallet-badge\.xwk-recommended,\.xwk-wallet-badge\.xwk-recent\{[^}]*color:#0078ae/);
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

test("WalletModal sorts the most recently connected wallet first", () => {
  const wallets: WalletMetadata[] = [
    { id: "xaman", name: "Xaman", type: "mobile", recommended: true },
    { id: "gemwallet", name: "GemWallet", type: "extension", group: "Extensions" },
    { id: "joey", name: "Joey", type: "walletconnect", group: "WalletConnect" }
  ];
  const modal = new WalletModal({
    manager: {
      ...manager,
      getWallets: () => wallets,
      getAdapter: (id: string) => wallets.some((wallet) => wallet.id === id) ? { capabilities: {} } : undefined
    } as never,
    themeMode: "light"
  }) as unknown as {
    recentWalletId?: string;
    getWallets(): WalletMetadata[];
    renderWalletBadges(wallet: WalletMetadata, layout: "list"): string;
  };

  modal.recentWalletId = "joey";

  assert.deepEqual(modal.getWallets().map((wallet) => wallet.id), ["joey", "xaman", "gemwallet"]);
  assert.match(modal.renderWalletBadges(wallets[2], "list"), /class="xwk-wallet-badge xwk-recent">Recent<\/span>/);
});

test("WalletModal does not duplicate recent with stronger wallet badges", () => {
  const modal = new WalletModal({
    manager: manager as never,
    themeMode: "light"
  }) as unknown as {
    availability: Record<string, boolean>;
    availabilityLoading: boolean;
    recentWalletId?: string;
    renderWalletBadges(wallet: WalletMetadata, layout: "list"): string;
  };

  modal.recentWalletId = "xaman";
  const recommended = modal.renderWalletBadges({ id: "xaman", name: "Xaman", type: "mobile", recommended: true }, "list");
  assert.match(recommended, /Recommended/);
  assert.doesNotMatch(recommended, /Recent/);

  modal.recentWalletId = "gemwallet";
  modal.availabilityLoading = false;
  modal.availability = { gemwallet: true };
  const installed = modal.renderWalletBadges({ id: "gemwallet", name: "GemWallet", type: "extension", group: "Extensions" }, "list");
  assert.match(installed, /Installed/);
  assert.doesNotMatch(installed, /Recent/);
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
  assert.match(styles, new RegExp(`\\.xwk-qr-code-light\\{background:${QR_LIGHT};padding:8px\\}`));
  assert.match(styles, /\.xwk-qr-theme-action\{[^}]*position:absolute/);
  assert.match(styles, /\.xwk-qr-theme-action\{[^}]*height:34px/);
  assert.match(styles, /\.xwk-qr-theme-action\{[^}]*opacity:0/);
  assert.match(styles, /\.xwk-qr-theme-action\{[^}]*pointer-events:none/);
  assert.match(styles, /\.xwk-qr-code-wrap:hover \.xwk-qr-theme-action,[^}]*\.xwk-qr-theme-action:focus-visible\{opacity:1;pointer-events:auto\}/);
  assert.match(styles, /\.xwk-qr-card-actions-dual\{grid-template-columns:repeat\(auto-fit,minmax\(0,1fr\)\)\}/);
  assert.match(styles, /\.xwk-qr-card-actions-dual\{grid-template-columns:1fr\}/);
  assert.doesNotMatch(styles, /transition:[^}]*height/);
});

test("WalletModal custom QR loading uses a tokenized skeleton placeholder", () => {
  const modal = new WalletModal({
    manager: manager as never,
    themeMode: "light"
  }) as unknown as {
    renderQrLoading(): string;
    renderMobileSheetOverrides(theme: typeof lightTheme): string;
  };
  const html = modal.renderQrLoading();
  const overrides = modal.renderMobileSheetOverrides({
    ...lightTheme,
    surface: "#f8fafc",
    surfaceHover: "rgba(17,24,39,.04)"
  });

  assert.match(html, /xwk-qr-loading-skeleton/);
  assert.match(html, /xwk-qr-skeleton/);
  assert.match(html, /xwk-skeleton-qr/);
  assert.doesNotMatch(html, /class="[^"]*(^|\s)xwk-skeleton(\s|")/);
  assert.match(overrides, /\.xwk-qr-loading-skeleton\{display:grid;height:100%;place-items:stretch;width:100%\}/);
  assert.match(overrides, /\.xwk-skeleton\{[^}]*background:linear-gradient/);
  assert.match(overrides, /\.xwk-qr-skeleton\{[^}]*height:100%/);
  assert.match(overrides, /\.xwk-qr-skeleton\{[^}]*width:100%/);
  assert.match(overrides, /\.xwk-qr-skeleton\{[^}]*overflow:hidden/);
  assert.match(overrides, /\.xwk-qr-skeleton\{[^}]*border-radius:10px/);
  assert.match(overrides, /\.xwk-qr-skeleton:before\{[^}]*background:linear-gradient/);
  assert.match(overrides, /\.xwk-qr-skeleton:before\{[^}]*inset:0/);
  assert.match(overrides, /\.xwk-qr-skeleton:after\{[^}]*animation:xwk-qr-shimmer/);
  assert.match(overrides, /\.xwk-qr-skeleton:after\{[^}]*background:linear-gradient/);
  assert.match(overrides, /\.xwk-qr-skeleton:after\{[^}]*transform:translateX\(-115%\)/);
  assert.match(overrides, /@keyframes xwk-qr-skeleton-pulse/);
  assert.match(overrides, /@keyframes xwk-qr-shimmer\{0%\{transform:translateX\(-115%\)\}100%\{transform:translateX\(115%\)\}\}/);
  assert.match(overrides, /prefers-reduced-motion:reduce[^`]*\.xwk-skeleton,\.xwk-qr-skeleton,\.xwk-qr-skeleton:after\{animation:none!important/);
});

test("WalletModal wallet badge uses skeleton while availability is resolving", () => {
  const modal = new WalletModal({
    manager: manager as never,
    themeMode: "light"
  }) as unknown as {
    availability: Record<string, boolean>;
    availabilityLoading: boolean;
    renderWalletBadges(wallet: { id: string; name: string; type: string; group: string }, layout: string): string;
    renderMobileSheetOverrides(theme: typeof lightTheme): string;
  };

  modal.availabilityLoading = true;
  const html = modal.renderWalletBadges({ id: "gemwallet", name: "GemWallet", type: "extension", group: "Extensions" }, "list");
  const overrides = modal.renderMobileSheetOverrides(lightTheme);

  assert.match(html, /xwk-wallet-badge-loading/);
  assert.match(html, /xwk-skeleton-pill/);
  assert.doesNotMatch(html, /Installed/);
  assert.match(overrides, /\.xwk-wallet-badge-loading\{[^}]*min-width:72px/);
  modal.availability = { gemwallet: true };
  const known = modal.renderWalletBadges({ id: "gemwallet", name: "GemWallet", type: "extension", group: "Extensions" }, "list");
  assert.match(known, /xwk-installed/);
  assert.doesNotMatch(known, /xwk-skeleton/);
});

test("WalletModal refreshes discovery during initial injection then returns to five-second polling", t => {
  t.mock.timers.enable({ apis: ["setInterval"] });
  const modal = new WalletModal({ manager: manager as never }) as unknown as {
    root: unknown; renderView(): void; refreshAvailability(refresh: boolean): Promise<void>; open(): void;
  };
  const descriptors = ["document", "HTMLElement"].map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)] as const);
  const calls: boolean[] = [];
  modal.renderView = () => {};
  modal.refreshAvailability = async refresh => { calls.push(refresh); };
  modal.root = { dataset: { xwkView: "list" } };
  try {
    Object.defineProperty(globalThis, "document", { configurable: true, value: { activeElement: null } });
    Object.defineProperty(globalThis, "HTMLElement", { configurable: true, value: class {} });
    modal.open();
    t.mock.timers.tick(10000);
    assert.equal(calls.length, 11);
    assert.ok(calls.every(refresh => refresh));
    t.mock.timers.tick(4000);
    assert.equal(calls.length, 11);
    t.mock.timers.tick(1000);
    assert.equal(calls.length, 12);
    assert.equal(calls[11], false);
  } finally {
    for (const [name, descriptor] of descriptors) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else Reflect.deleteProperty(globalThis, name);
    }
  }
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
