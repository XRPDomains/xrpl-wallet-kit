import assert from "node:assert/strict";
import test from "node:test";
import { webcrypto } from "node:crypto";
import { XamanBrowserAuth } from "../packages/adapters/xaman/src/browser-auth";
import type { XamanSdkLike } from "../packages/adapters/xaman/src/index";

const address = "rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh";
const mockSdk: XamanSdkLike = { payload: { get: async () => null, createAndSubscribe: async () => { throw Error("Unexpected signing"); } } };
const token = (state: string, app = "app") => ["header", Buffer.from(JSON.stringify({ state, client_id: app, exp: Math.floor(Date.now() / 1000) + 60 })).toString("base64url"), "signature"].join(".");

function fixture() {
  const saved = new Map<string, string>();
  const browser = Object.assign(new EventTarget(), {
    location: { href: "https://dapp.example/checkout" }, crypto: webcrypto,
    localStorage: { getItem: (key: string) => saved.get(key) ?? null, setItem: (key: string, value: string) => saved.set(key, value),
      removeItem: (key: string) => saved.delete(key), get length() { return saved.size; }, key: (index: number) => [...saved.keys()][index] ?? null },
    history: { state: null, replaceState: (_state: unknown, _title: string, url: string) => { browser.location.href = url; } },
    opened: [] as URL[], open(url: string) { this.opened.push(new URL(url)); return { close() {} }; }
  });
  const descriptors = new Map(["window", "document", "fetch"].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  Object.defineProperty(globalThis, "window", { value: browser, configurable: true });
  Object.defineProperty(globalThis, "document", { value: new EventTarget(), configurable: true });
  let verified = 0;
  Object.defineProperty(globalThis, "fetch", { configurable: true, value: async (url: string) => {
    assert.equal(url, "https://oauth2.xumm.app/userinfo"); verified++;
    return { ok: true, json: async () => ({ account: address, sub: address }) };
  } });
  return { browser, saved, count: () => verified, restore: () => descriptors.forEach((descriptor, key) => {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key);
  }) };
}

test("Xaman separate-tab completion authenticates both consumers and clears token from return URL", async () => {
  const f = fixture();
  const original = new XamanBrowserAuth("app", () => mockSdk);
  try {
    const pending = original.authorize();
    const state = f.browser.opened[0].searchParams.get("state")!;
    f.browser.location.href += `?state=${state}&access_token=${token(state)}`;
    const returned = new XamanBrowserAuth("app", () => mockSdk);
    assert.equal(returned.canRecover(), true);
    assert.equal((await returned.authorize())?.me?.account, address);
    f.browser.dispatchEvent(new Event("storage"));
    assert.equal((await pending)?.me?.account, address);
    assert.equal(f.count(), 2);
    assert.equal(new URL(f.browser.location.href).searchParams.has("access_token"), false);
  } finally { original.cancelAuthorization(); f.restore(); }
});

test("Xaman rejects cancelled callbacks and foreign app tokens", async () => {
  const f = fixture();
  const original = new XamanBrowserAuth("app", () => mockSdk);
  try {
    const pending = original.authorize();
    const rejected = assert.rejects(pending, { code: "REQUEST_CANCELLED" });
    const state = f.browser.opened[0].searchParams.get("state")!;
    original.cancelAuthorization(); await rejected;
    f.browser.location.href += `?state=${state}&access_token=${token(state)}`;
    const returned = new XamanBrowserAuth("app", () => mockSdk);
    assert.equal(returned.canRecover(), false);
    await assert.rejects(returned.authorize());
    assert.equal(f.count(), 0);
    f.browser.location.href = "https://dapp.example/checkout";
    const next = new XamanBrowserAuth("app", () => mockSdk);
    const nextPending = next.authorize();
    const nextRejected = assert.rejects(nextPending);
    const nextState = f.browser.opened[1].searchParams.get("state")!;
    f.browser.location.href += `?state=${nextState}&access_token=${token(nextState, "another-app")}`;
    await assert.rejects(new XamanBrowserAuth("app", () => mockSdk).authorize(), /scope/);
    next.cancelAuthorization(); await nextRejected;
    assert.equal(f.count(), 0);
  } finally { original.cancelAuthorization(); f.restore(); }
});

test("Xaman never adopts a locally scoped token when issuer authentication fails", async () => {
  const f = fixture();
  const original = new XamanBrowserAuth("app", () => mockSdk);
  try {
    const pending = original.authorize();
    const rejected = assert.rejects(pending);
    const state = f.browser.opened[0].searchParams.get("state")!;
    f.browser.location.href += `?state=${state}&access_token=${token(state)}`;
    Object.defineProperty(globalThis, "fetch", { configurable: true, value: async () => ({ ok: false }) });
    await assert.rejects(new XamanBrowserAuth("app", () => mockSdk).authorize(), /issuer/);
    assert.equal(f.saved.has("xwk.xaman.oauth.session.app"), false);
    original.cancelAuthorization(); await rejected;
  } finally { original.cancelAuthorization(); f.restore(); }
});

test("late injected Xaman authorization cannot overwrite a newer connection", async () => {
  const { XamanAdapter } = await import("../packages/adapters/xaman/src/index");
  const callbacks: Array<(result: { me: { account: string }; sdk: XamanSdkLike }) => void> = [];
  const adapter = new XamanAdapter({ auth: { authorize: () => new Promise(resolve => callbacks.push(resolve)) } });
  const old = adapter.connect({});
  const oldRejected = assert.rejects(old, { code: "REQUEST_CANCELLED" });
  await new Promise(resolve => setImmediate(resolve));
  const next = adapter.connect({});
  await new Promise(resolve => setImmediate(resolve));
  callbacks[1]({ me: { account: address }, sdk: mockSdk });
  assert.equal((await next).account.address, address);
  callbacks[0]({ me: { account: "rStale" }, sdk: mockSdk });
  await oldRejected;
  await adapter.disconnect();
});
