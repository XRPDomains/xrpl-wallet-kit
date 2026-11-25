import assert from "node:assert/strict";
import test from "node:test";
import { WalletModal } from "../packages/ui/src/modal";

test("wallet refresh preserves unchanged buttons and defers replacement until a press ends", () => {
  const picker = new WalletModal({ manager: {
    on: () => () => undefined,
    getNetwork: () => ({ id: "mainnet", name: "XRPL Mainnet", networkType: "MAINNET" })
  } as never, layout: "list" }) as unknown as {
    root: unknown;
    ensureStyles: () => void;
    resolveTheme: () => object;
    renderWalletList: () => string;
    bindGroupButtons: () => void;
    bindWalletButtons: () => void;
    scheduleAdaptiveLayout: () => void;
    refreshWalletList: (schedule?: boolean) => void;
  };
  let markup = '<button data-wallet-id="clasp">Clasp</button>';
  let pressed = false;
  let writes = 0;
  let bindings = 0;
  let frameId = 0;
  const frames = new Map<number, FrameRequestCallback>();
  const grid = {
    scrollTop: 0,
    set innerHTML(_value: string) { writes++; }
  };
  picker.root = {
    dataset: { xwkView: "list" },
    querySelector: (selector: string) => selector.includes(":active") ? (pressed ? {} : null)
      : selector === ".xwk-grid" ? grid : null
  };
  picker.ensureStyles = () => undefined;
  picker.resolveTheme = () => ({});
  picker.renderWalletList = () => markup;
  picker.bindGroupButtons = () => undefined;
  picker.bindWalletButtons = () => { bindings++; };
  picker.scheduleAdaptiveLayout = () => undefined;
  const previous = new Map(["window", "document", "HTMLElement"].map(key =>
    [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  Object.defineProperty(globalThis, "window", { configurable: true, value: {
    requestAnimationFrame: (callback: FrameRequestCallback) => {
      frames.set(++frameId, callback);
      return frameId;
    }
  } });
  Object.defineProperty(globalThis, "document", { configurable: true, value: { activeElement: null } });
  Object.defineProperty(globalThis, "HTMLElement", { configurable: true, value: class {} });
  const nextFrame = () => {
    const pending = [...frames.values()];
    frames.clear();
    for (const callback of pending) callback(0);
  };
  try {
    picker.refreshWalletList(false);
    picker.refreshWalletList(false);
    assert.equal(writes, 1, "unchanged availability must preserve button DOM/listeners");
    assert.equal(bindings, 1);
    markup = '<button data-wallet-id="clasp">Clasp available</button>';
    pressed = true;
    picker.refreshWalletList();
    picker.refreshWalletList();
    assert.equal(writes, 1, "pressed target must not be replaced");
    assert.equal(frames.size, 1, "concurrent refreshes share one deferred frame");
    nextFrame();
    assert.equal(writes, 1, "a held press remains stable across frames");
    pressed = false;
    nextFrame();
    assert.equal(writes, 2, "new availability is applied after release");
    assert.equal(bindings, 2);
    assert.equal(frames.size, 0);
  } finally {
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});
