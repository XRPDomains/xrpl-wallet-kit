import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { act, create } from "react-test-renderer";
import { WalletManager, type WalletAdapter } from "../packages/core/src/index";
import { WalletKitProvider, useWalletKit } from "../packages/react/src/index";

test("React manager replacement synchronizes session and ignores the previous manager", async () => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const makeManager = (id: string) => {
    const adapter: WalletAdapter = {
      metadata: { id, name: id, type: "extension" }, capabilities: { connect: true },
      async connect() { return { account: { address: "r" + id } }; }
    };
    return new WalletManager({ adapters: [adapter], accountStatus: { enabled: false } });
  };
  const first = makeManager("first");
  const second = makeManager("second");
  await first.connect("first");
  let current!: ReturnType<typeof useWalletKit>;
  function Consumer() { current = useWalletKit(); return null; }
  const tree = (manager: WalletManager) => React.createElement(WalletKitProvider, { manager }, React.createElement(Consumer));
  let renderer!: ReturnType<typeof create>;
  try {
    await act(async () => { renderer = create(tree(first)); });
    assert.equal(current.account?.address, "rfirst");
    await act(async () => { renderer.update(tree(second)); });
    assert.equal(current.manager, second);
    assert.equal(current.session, null);
    assert.equal(current.status, "disconnected");
    await act(async () => { first.emit("connected", { adapterId: "first", account: first.getAccount()!, session: first.getSession()! }); });
    assert.equal(current.session, null);
    await act(async () => { await second.connect("second"); });
    assert.equal(current.account?.address, "rsecond");
    await act(async () => { renderer.update(tree(first)); });
    assert.equal(current.account?.address, "rfirst");
    assert.equal(current.status, "connected");
  } finally {
    if (renderer) await act(async () => renderer.unmount());
    first.destroy(); second.destroy();
    delete (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
  }
});

test("React wallet lists react to late registration and unregistration", async () => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const manager = new WalletManager({ accountStatus: { enabled: false } });
  let current!: ReturnType<typeof useWalletKit>;
  function Consumer() { current = useWalletKit(); return null; }
  let renderer!: ReturnType<typeof create>;
  try {
    await act(async () => { renderer = create(React.createElement(WalletKitProvider, { manager }, React.createElement(Consumer))); });
    assert.equal(current.wallets.length, 0);
    await act(async () => { manager.register({ metadata: { id: "late", name: "Late", type: "extension" }, capabilities: { connect: true },
      isAvailable: () => true, connect: async () => ({ account: { address: "rLate" } }) }); });
    assert.equal(current.wallets[0].id, "late"); assert.equal(current.availability.late, true);
    await act(async () => { manager.unregister("late"); });
    assert.equal(current.wallets.length, 0); assert.deepEqual(current.availability, {});
  } finally {
    if (renderer) await act(async () => renderer.unmount());
    manager.destroy(); delete (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
  }
});
