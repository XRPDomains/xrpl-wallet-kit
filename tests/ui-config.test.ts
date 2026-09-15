import assert from "node:assert/strict";
import test from "node:test";
import { resolveWalletButtonOptions, resolveWalletUiOptions } from "../packages/ui/src/config";

test("resolveWalletButtonOptions defaults account panel mode to modal", () => {
  const options = resolveWalletButtonOptions();

  assert.equal(options.accountPanelMode, "modal");
});

test("resolveWalletButtonOptions preserves default button and account panel affordances", () => {
  const options = resolveWalletButtonOptions({}, {
    showBalance: true,
    showRecentTransactions: true
  });

  assert.equal(options.showAdapterIcon, true);
  assert.equal(options.showChevron, true);
  assert.equal(options.copyAddress, true);
  assert.equal(options.disconnect, true);
  assert.equal(options.showAddressQr, true);
  assert.equal(options.showBalance, true);
  assert.equal(options.showRecentTransactions, true);
});

test("resolveWalletButtonOptions maps ui.accountPanel.mode to the button accountPanelMode", () => {
  const options = resolveWalletButtonOptions({
    accountPanel: {
      mode: "dropdown"
    }
  });

  assert.equal(options.accountPanelMode, "dropdown");
});

test("resolveWalletButtonOptions lets direct button accountPanelMode override app-level config", () => {
  const options = resolveWalletButtonOptions({
    accountPanel: {
      mode: "dropdown"
    }
  }, {
    accountPanelMode: "modal"
  });

  assert.equal(options.accountPanelMode, "modal");
});

test("resolveWalletButtonOptions maps account panel address QR config", () => {
  assert.equal(resolveWalletButtonOptions().showAddressQr, true);
  assert.equal(resolveWalletButtonOptions({ accountPanel: { showAddressQr: false } }).showAddressQr, false);
});

test("resolveWalletButtonOptions maps account panel recent transaction config", () => {
  const options = resolveWalletButtonOptions({
    accountPanel: {
      showRecentTransactions: true,
      maxVisibleTransactions: 3
    }
  });

  assert.equal(options.showRecentTransactions, true);
  assert.equal(options.maxVisibleTransactions, 3);
});

test("resolveWalletButtonOptions maps connect button custom icon config", () => {
  const options = resolveWalletButtonOptions({
    connectButton: {
      icon: {
        type: "image",
        src: "/brand.svg",
        alt: "Brand"
      }
    }
  });

  assert.deepEqual(options.icon, {
    type: "image",
    src: "/brand.svg",
    alt: "Brand"
  });
});

test("resolveWalletButtonOptions inherits shared theme mode and tokens", () => {
  const options = resolveWalletButtonOptions({
    themeMode: "dark",
    theme: {
      accent: "#123456"
    },
    customTheme: {
      surface: "#0b1020"
    }
  });

  assert.equal(options.themeMode, "dark");
  assert.equal(options.theme?.accent, "#123456");
  assert.equal(options.theme?.surface, "#0b1020");
});

test("resolveWalletButtonOptions lets direct button theme override shared theme", () => {
  const options = resolveWalletButtonOptions({
    themeMode: "dark",
    theme: {
      accent: "#123456"
    }
  }, {
    themeMode: "light",
    theme: {
      accent: "#abcdef"
    }
  });

  assert.equal(options.themeMode, "light");
  assert.equal(options.theme?.accent, "#abcdef");
});

test("wallet UI config forwards CSP nonce to modal and button surfaces", () => {
  const modalOptions = resolveWalletUiOptions({
    nonce: "nonce-123"
  });
  const buttonOptions = resolveWalletButtonOptions({
    nonce: "nonce-123"
  });

  assert.equal(modalOptions.nonce, "nonce-123");
  assert.equal(buttonOptions.nonce, "nonce-123");
});
