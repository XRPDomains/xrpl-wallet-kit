import assert from "node:assert/strict";
import test from "node:test";
import { ensureWalletStyle } from "../packages/ui/src/dom";

type FakeStyleElement = {
  dataset: Record<string, string>;
  textContent: string;
  nextSibling: FakeStyleElement | null;
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
      return { dataset: {}, textContent: "", nextSibling: null } satisfies FakeStyleElement;
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

test("ensureWalletStyle moves reused active styles to the end of head", () => {
  const dom = installFakeDocument();
  try {
    ensureWalletStyle("xwk-button-light", ".xwk-account-button{color:black}");
    ensureWalletStyle("xwk-button-dark", ".xwk-account-button{color:white}");
    ensureWalletStyle("xwk-button-light", ".xwk-account-button{color:black}");

    assert.deepEqual(dom.children.map((child) => child.dataset.xwkStyle), [
      "xwk-button-dark",
      "xwk-button-light"
    ]);
  } finally {
    dom.restore();
  }
});
