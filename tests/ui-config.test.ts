import assert from "node:assert/strict";
import test from "node:test";
import { resolveWalletButtonOptions } from "../packages/ui/src/config";

test("resolveWalletButtonOptions defaults account panel mode to modal", () => {
  const options = resolveWalletButtonOptions();

  assert.equal(options.accountPanelMode, "modal");
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
