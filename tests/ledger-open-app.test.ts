import assert from "node:assert/strict";
import test from "node:test";
import { Buffer } from "buffer";
import { ensureLedgerApp, ensureLedgerXrpApp } from "../packages/adapters/ledger/src/device-app";
import type { LedgerAppTransport } from "../packages/adapters/ledger/src/device-app";
import { LedgerAdapter, LedgerDeviceState } from "../packages/adapters/ledger/src/index";
import { XAHAU_MAINNET } from "../packages/xahau/src/networks";
import { createLazyXahauProtocol } from "../packages/xahau/src/lazy";

function info(name: string) {
  return Buffer.concat([Buffer.from([1, name.length]), Buffer.from(name), Buffer.from([1, 49, 0x90, 0])]);
}

test("Ledger app instructions follow the requested chain even when the device SDK mentions XRP", async () => {
  for (const target of ["XRP", "XAH"] as const) {
    const adapter = new LedgerAdapter({ supportedChains: { families: ["xrpl", "xahau"] },
      connectLedger: async () => { throw new Error("Please open the XRP app and reconnect"); } });
    await assert.rejects(adapter.connect(target === "XAH" ? { network: XAHAU_MAINNET,
      protocolContext: { network: XAHAU_MAINNET, protocol: createLazyXahauProtocol() } } : {}), (error: any) => {
      assert.match(error.message, new RegExp(`Open ${target} on Ledger. Reconnect.`));
      if (target === "XAH") assert.doesNotMatch(error.message, /Open XRP/);
      return true;
    });
  }
});
const osError = (statusCode: number) => Object.assign(new Error(`Status ${statusCode.toString(16)}`), { statusCode });
function fixture(initial = "BOLOS", target: "XRP" | "XAH" = "XRP") {
  let app = initial;
  let closeCount = 0;
  let opening = 0;
  const calls: number[][] = [];
  const transport: LedgerAppTransport = {
    close: async () => { closeCount++; },
    send: async (cla, ins, p1, p2, data) => {
      calls.push([cla, ins, p1, p2]);
      if (cla === 0xb0 && ins === 1) return info(app);
      if (cla === 0xb0 && ins === 0xa7) { app = "BOLOS"; return Buffer.from([0x90, 0]); }
      assert.equal(cla, 0xe0); assert.equal(ins, 0xd8);
      assert.equal(data?.toString("ascii"), target);
      app = target; return Buffer.from([0x90, 0]);
    }
  };
  const options: Parameters<typeof ensureLedgerXrpApp>[1] = { timeoutMs: 1000, assertCurrent() {}, onOpening() { opening++; },
    onTransport() {}, reopen: async () => transport };
  return { transport, options, calls, get opening() { return opening; }, get closeCount() { return closeCount; } };
}

test("Ledger requests XRP directly on the device from dashboard, never a desktop URL", async () => {
  const f = fixture();
  assert.equal(await ensureLedgerXrpApp(f.transport, f.options), f.transport);
  assert.deepEqual(f.calls, [[0xb0, 1, 0, 0], [0xe0, 0xd8, 0, 0], [0xb0, 1, 0, 0]]);
  assert.equal(f.opening, 1);
});

test("Ledger does not switch apps when XRP is already open", async () => {
  const f = fixture("XRP");
  await ensureLedgerXrpApp(f.transport, f.options);
  assert.deepEqual(f.calls, [[0xb0, 1, 0, 0]]);
  assert.equal(f.opening, 0);
});

test("Ledger Xahau launch requests XAH on the device, preserves an open XAH app and never falls back to XRP", async () => {
  for (const initial of ["BOLOS", "XAH", "XRP"]) {
    const f = fixture(initial, "XAH");
    await ensureLedgerApp(f.transport, { ...f.options, app: "XAH" });
    assert.equal(f.calls.some(call => call[1] === 0xd8), initial !== "XAH");
  }
  const f = fixture("BOLOS", "XAH");
  f.transport.send = async (_cla, ins) => { if (ins === 1) return info("BOLOS"); throw osError(0x6807); };
  await assert.rejects(ensureLedgerApp(f.transport, { ...f.options, app: "XAH" }), /Open XAH on Ledger/);
});

test("Ledger connection errors name the selected device app, with explicit XRP compatibility override", async () => {
  for (const deviceApp of [undefined, "XRP"] as const) {
    const adapter = new LedgerAdapter({ deviceApp, supportedChains: { families: ["xahau"] },
      connectLedger: async () => { throw osError(0x6e00); } });
    await assert.rejects(adapter.connect({ network: XAHAU_MAINNET,
      protocolContext: { network: XAHAU_MAINNET, protocol: createLazyXahauProtocol() } }),
    deviceApp === "XRP" ? /Open XRP on Ledger/ : /Open XAH on Ledger/);
    await adapter.disconnect();
  }
});

test("Ledger recognizes current and legacy OS dashboard names", async () => {
  for (const name of ["OLOS", "OLOS\0", "DASHBOARD"]) {
    const f = fixture(name);
    await ensureLedgerXrpApp(f.transport, f.options);
    assert.equal(f.calls.some(call => call[1] === 0xa7), false);
    assert.equal(f.calls.some(call => call[1] === 0xd8), true);
  }
});

test("Ledger closes another device app before requesting XRP", async () => {
  const f = fixture("TRON");
  await ensureLedgerXrpApp(f.transport, f.options);
  assert.deepEqual(f.calls.map(call => call.slice(0, 2)), [[0xb0, 1], [0xb0, 0xa7], [0xb0, 1], [0xe0, 0xd8], [0xb0, 1]]);
});

test("Ledger preserves manual legacy path and rejects unsupported launch with device guidance", async () => {
  const f = fixture();
  f.transport.send = async () => { throw osError(0x6d00); };
  assert.equal(await ensureLedgerXrpApp(f.transport, f.options), f.transport);
  assert.equal(f.opening, 0);
  f.transport.send = async (_cla, ins) => { if (ins === 1) return info("BOLOS"); throw osError(0x6807); };
  await assert.rejects(ensureLedgerXrpApp(f.transport, f.options), /Open XRP on Ledger/);
});

for (const code of [0x6985, 0x6804]) {
  test(`Ledger never retries rejected/locked app launch (${code.toString(16)})`, async () => {
    const f = fixture();
    let launches = 0;
    f.transport.send = async (_cla, ins) => {
      if (ins === 1) return info("BOLOS");
      launches++; throw osError(code);
    };
    await assert.rejects(ensureLedgerXrpApp(f.transport, f.options), { statusCode: code });
    assert.equal(launches, 1);
  });
}

test("Ledger app switch reopens only the selected device transport after a disconnect", async () => {
  const f = fixture();
  let launched = false; let replaced = 0;
  f.transport.send = async (_cla, ins) => {
    if (launched) throw new Error("Device disconnected");
    if (ins === 1) return info("BOLOS");
    launched = true; throw new Error("Device disconnected");
  };
  const next: LedgerAppTransport = { close: async () => {}, send: async () => info("XRP") };
  f.options.reopen = async previous => { assert.equal(previous, f.transport); return next; };
  f.options.onTransport = () => { replaced++; };
  assert.equal(await ensureLedgerXrpApp(f.transport, f.options), next);
  assert.equal(replaced, 1);
});

test("Ledger tolerates a temporary OS not-ready response after launching XRP", async () => {
  const f = fixture();
  let launched = false; let warming = true;
  f.transport.send = async (_cla, ins) => {
    if (ins === 0xd8) { launched = true; return Buffer.from([0x90, 0]); }
    if (!launched) return info("BOLOS");
    if (warming) { warming = false; throw osError(0x6e00); }
    return info("XRP");
  };
  await ensureLedgerXrpApp(f.transport, f.options);
  assert.equal(warming, false);
});

test("Ledger cancellation/timeout cannot issue a late open-app command", async () => {
  for (const cancel of [true, false]) {
    const f = fixture();
    let finish!: (value: Buffer) => void;
    let calls = 0;
    f.transport.send = () => { calls++; return new Promise(resolve => { finish = resolve; }); };
    const controller = new AbortController();
    const pending = ensureLedgerXrpApp(f.transport, { ...f.options, signal: controller.signal, timeoutMs: 20 });
    const rejected = assert.rejects(pending, { code: cancel ? "REQUEST_CANCELLED" : "REQUEST_TIMEOUT" });
    if (cancel) controller.abort();
    await rejected;
    finish(info("BOLOS"));
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(calls, 1);
  }
});

test("Ledger adapter supports autoOpenApp opt-out and leaves custom sessions untouched", async () => {
  for (const autoOpenApp of [true, false]) {
    let stateCalls = 0;
    const adapter = new LedgerAdapter({ autoOpenApp, onDeviceState: () => { stateCalls++; },
      connectLedger: async () => ({ address: "custom", signTransaction: async () => ({}) }) });
    assert.equal((await adapter.connect({})).account.address, "custom");
    assert.equal(stateCalls, 0);
    await adapter.disconnect();
  }
  assert.equal(LedgerDeviceState.OPENING_APP, "OPENING_APP");
});

test("Ledger pre-aborted connect does not open a picker or request a device app", async () => {
  let opened = false;
  const adapter = new LedgerAdapter({ connectLedger: async () => { opened = true; throw Error("Unexpected device request"); } });
  const controller = new AbortController(); controller.abort();
  await assert.rejects(adapter.connect({ signal: controller.signal }), { code: "REQUEST_CANCELLED" });
  assert.equal(opened, false);
});

test("Ledger default adapter opens the device app before XRP address retrieval, and supports opt-out", async () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: { hid: {} } });
  try {
    for (const target of ["XRP", "XAH"] as const) for (const autoOpenApp of [true, false]) {
      let app: string = autoOpenApp ? "BOLOS" : target;
      let launches = 0;
      let closed = 0;
      const states: LedgerDeviceState[] = [];
      const address = "rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh";
      const transport = { close: async () => { closed++; }, decorateAppAPIMethods() {},
        send: async (cla: number, ins: number, _p1: number, _p2: number, data?: Buffer) => {
          if (cla === 0xb0 && ins === 1) return info(app);
          if (cla === 0xe0 && ins === 0xd8) { assert.equal(data?.toString("ascii"), target); launches++; app = target; return Buffer.from([0x90, 0]); }
          assert.equal(app, target);
          if (ins === 6) return Buffer.from([0, 2, 5, 2, 0x90, 0]);
          assert.equal(ins, 2);
          const publicKey = Buffer.from("02" + "11".repeat(32), "hex");
          return Buffer.concat([Buffer.from([33]), publicKey, Buffer.from([address.length]), Buffer.from(address), Buffer.from([0x90, 0])]);
        } };
      const adapter = new LedgerAdapter({ autoOpenApp, supportedChains: { families: ["xrpl", "xahau"] }, onDeviceState: state => states.push(state) });
      (adapter as unknown as { createTransport(): Promise<LedgerAppTransport> }).createTransport = async () => transport;
      const result = await adapter.connect(target === "XAH" ? { network: XAHAU_MAINNET,
        protocolContext: { network: XAHAU_MAINNET, protocol: createLazyXahauProtocol() } } : {});
      assert.equal(result.account.address, address);
      assert.equal(result.session?.metadata?.requestedDeviceApp, target);
      assert.equal(launches, autoOpenApp ? 1 : 0);
      assert.deepEqual(states, autoOpenApp ? [LedgerDeviceState.OPENING_APP, LedgerDeviceState.READY] : [LedgerDeviceState.READY]);
      await adapter.disconnect();
      assert.equal(closed, 1);
    }
  } finally {
    if (descriptor) Object.defineProperty(globalThis, "navigator", descriptor);
    else Reflect.deleteProperty(globalThis, "navigator");
  }
});
