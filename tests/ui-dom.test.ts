import assert from "node:assert/strict";
import test from "node:test";
import { ensureWalletStyle } from "../packages/ui/src/dom";

type FakeStyleElement = {
  attributes: Record<string, string>;
  dataset: Record<string, string>;
  textContent: string;
  nextSibling: FakeStyleElement | null;
  getAttribute(name: string): string | null;
  removeAttribute(name: string): void;
  setAttribute(name: string, value: string): void;
};

function installFakeDocument() {
  const children: FakeStyleElement[] = [];
  const head = {
    children,
    querySelector(selector: string) {
      const id = selector.match(/style\[data-xwk-style="([^"]+)"\]/)?.[1];
      return children.find((child) => child.dataset.xwkStyle === id) ?? null;
    },
    appendChild(element: FakeStyleElement) {
      const currentIndex = children.indexOf(element);
      if (currentIndex >= 0) children.splice(currentIndex, 1);
      children.push(element);
      children.forEach((child, index) => {
        child.nextSibling = children[index + 1] ?? null;
      });
      return element;
    }
  };
  const document = {
    head,
    createElement() {
      const element: FakeStyleElement = {
        attributes: {},
        dataset: {},
        textContent: "",
        nextSibling: null,
        getAttribute(name: string) {
          return this.attributes[name] ?? null;
        },
        removeAttribute(name: string) {
          delete this.attributes[name];
        },
        setAttribute(name: string, value: string) {
          this.attributes[name] = value;
        }
      };
      return element;
    }
  };
  const previousDocument = globalThis.document;
  (globalThis as typeof globalThis & { document: unknown }).document = document;
  return {
    children,
    restore() {
      if (previousDocument === undefined) {
        delete (globalThis as typeof globalThis & { document?: unknown }).document;
      } else {
        globalThis.document = previousDocument;
      }
    }
  };
}

test("ensureWalletStyle reuses stable style nodes and updates their content", () => {
  const dom = installFakeDocument();
  try {
    ensureWalletStyle("xwk-button", ".xwk-account-button{color:black}");
    ensureWalletStyle("xwk-modal", ".xwk-modal{color:black}");
    ensureWalletStyle("xwk-button", ".xwk-account-button{color:white}");

    assert.deepEqual(dom.children.map((child) => child.dataset.xwkStyle), [
      "xwk-modal",
      "xwk-button"
    ]);
    assert.equal(dom.children.length, 2);
    assert.equal(dom.children[1]?.textContent, ".xwk-account-button{color:white}");
  } finally {
    dom.restore();
  }
});

test("ensureWalletStyle applies and clears CSP nonce on reused style nodes", () => {
  const dom = installFakeDocument();
  try {
    ensureWalletStyle("xwk-modal", ".xwk-modal{color:black}", "nonce-123");

    assert.equal(dom.children[0]?.getAttribute("nonce"), "nonce-123");

    ensureWalletStyle("xwk-modal", ".xwk-modal{color:white}", "nonce-456");

    assert.equal(dom.children[0]?.getAttribute("nonce"), "nonce-456");
    assert.equal(dom.children[0]?.textContent, ".xwk-modal{color:white}");

    ensureWalletStyle("xwk-modal", ".xwk-modal{color:white}");

    assert.equal(dom.children[0]?.getAttribute("nonce"), null);
  } finally {
    dom.restore();
  }
});
