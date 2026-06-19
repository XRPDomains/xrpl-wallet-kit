import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToString } from "react-dom/server";
import { WalletButton, WalletKitProvider, useWalletKit } from "../packages/react/src/index";

function makeManager() {
  return {
    getSession() {
      return null;
    }
  };
}

test("WalletKitProvider does not create UI or throw during server render", () => {
  const html = renderToString(
    React.createElement(
      WalletKitProvider,
      { manager: makeManager() as never },
      React.createElement("div", null, "Wallet UI")
    )
  );

  assert.equal(html, "");
});

test("useWalletKit still guards usage outside WalletKitProvider", () => {
  function Consumer() {
    useWalletKit();
    return React.createElement("div");
  }

  assert.throws(
    () => renderToString(React.createElement(Consumer)),
    /useWalletKit must be used inside WalletKitProvider/
  );
});

test("React package exports WalletButton component", () => {
  assert.equal(typeof WalletButton, "function");
});
