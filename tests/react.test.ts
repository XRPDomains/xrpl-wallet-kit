import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import React from "react";
import { renderToString } from "react-dom/server";
import { WalletButton, WalletKitProvider, useWalletKit } from "../packages/react/src/index";

function makeManager() {
  return {
    getSession() {
      return null;
    },
    getWallets() {
      return [{ id: "gemwallet", name: "GemWallet", icon: "" }];
    },
    async getWalletAvailability() {
      return { gemwallet: true };
    }
  };
}

test("WalletKitProvider preserves children during server render", () => {
  const html = renderToString(
    React.createElement(
      WalletKitProvider,
      { manager: makeManager() as never },
      React.createElement("div", null, "Wallet UI")
    )
  );

  assert.equal(html, "<div>Wallet UI</div>");
});

test("WalletKitProvider exposes deterministic context before the modal mounts", () => {
  function Consumer() {
    const value = useWalletKit();
    return React.createElement(
      "div",
      null,
      `${value.wallets.length}:${value.availability.gemwallet}:${value.modal === null}`
    );
  }

  const html = renderToString(
    React.createElement(
      WalletKitProvider,
      { manager: makeManager() as never },
      React.createElement(Consumer)
    )
  );

  assert.equal(html, "<div>1:unknown:true</div>");
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
  assert.ok(typeof WalletButton === "function" || typeof WalletButton === "object");
});

test("React and UI package outputs preserve the client boundary", () => {
  for (const file of ["packages/react/dist/index.js", "packages/ui/dist/index.js"]) {
    assert.match(readFileSync(file, "utf8"), /^"use client";/, `${file} must start with a client directive`);
  }
});
