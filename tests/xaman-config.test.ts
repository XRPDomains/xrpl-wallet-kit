import assert from "node:assert/strict";
import test from "node:test";
import { XamanAdapter } from "../packages/adapters/xaman/src/index.ts";

test("XamanAdapter warns once when explicitly created without configuration", () => {
  const warnings: unknown[][] = [];
  const originalWarn = console.warn;
  console.warn = (...args: unknown[]) => warnings.push(args);

  try {
    const first = new XamanAdapter({});
    const second = new XamanAdapter({});

    assert.equal(warnings.length, 1);
    assert.match(String(warnings[0]?.[0]), /public Xaman API key/);
    assert.equal(first.metadata.id, "xaman");
    assert.equal(second.metadata.id, "xaman");
  } finally {
    console.warn = originalWarn;
  }
});

test("XamanAdapter does not warn when an API key is provided", () => {
  const warnings: unknown[][] = [];
  const originalWarn = console.warn;
  console.warn = (...args: unknown[]) => warnings.push(args);

  try {
    new XamanAdapter({ apiKey: "public-app-key" });
    assert.equal(warnings.length, 0);
  } finally {
    console.warn = originalWarn;
  }
});
