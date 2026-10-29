import assert from "node:assert/strict";
import test from "node:test";
import type { WalletSession } from "../packages/core/src/types";
import { XAHAU_MAINNET, XAHAU_TESTNET } from "../packages/xahau/src/networks";
import { createXahauNameResolverWithLoader } from "../packages/ui/src/xahauname";
import type { XahauNameSdk } from "../packages/ui/src/xahauname-loader";
import { createDefaultWalletIdentityResolver, WalletButtonController } from "../packages/ui/src/button";

const address = "r3H41K9PG8gz44ZCJcDKC1MMLuaVM3n9jE";
function session(network = XAHAU_TESTNET): WalletSession {
  return { adapterId: "gemwallet", account: { address, network: { ...network } }, connectedAt: Date.now() };
}
type Read = Parameters<InstanceType<XahauNameSdk["XahauNameClient"]>["read"]["getName"]>[0];
function fixture(read: (request: Read) => Promise<string | null> = async () => "alice.xah") {
  const calls: Read[] = [];
  const configs: Parameters<XahauNameSdk["resolveNetworkConfig"]>[0][] = [];
  let loads = 0, closes = 0;
  const load = async (): Promise<XahauNameSdk> => {
    loads++;
    return {
      resolveNetworkConfig: config => {
        configs.push(config);
        return { wss: config.wss!, treasury: address, namespaceId: "A".repeat(64) };
      },
      XahauNameClient: class {
        read = { getName: async (request: Read) => { calls.push(request); return read(request); } };
        async disconnect() { closes++; }
      }
    };
  };
  return { load, calls, configs, counts: () => ({ loads, closes }) };
}

test("XahauName only loads on matching Testnet; Mainnet fails closed without deployment", async () => {
  const mock = fixture();
  const resolve = createXahauNameResolverWithLoader({}, mock.load);
  for (const network of [XAHAU_MAINNET, { ...XAHAU_TESTNET, family: "xrpl" },
    { ...XAHAU_TESTNET, networkId: 21337 }, { ...XAHAU_TESTNET, id: "custom" }]) {
    assert.equal(await resolve(address, session(network)), null);
  }
  assert.equal(await resolve("another-address", session()), null);
  assert.equal(mock.counts().loads, 0);
  assert.deepEqual(await resolve(address, session()), { name: "alice.xah", source: "xahauname", verified: true });
  assert.equal(mock.configs[0].network, "testnet");
  assert.equal(mock.configs[0].wss, XAHAU_TESTNET.rpcUrl);
  assert.equal(mock.calls[0].bypassCache, false);
  assert.equal(mock.counts().closes, 1);
});

test("XahauName coalesces reads, caches verified names and refreshes explicitly", async () => {
  const mock = fixture(async request => request.bypassCache ? "new.xah" : "alice.xah");
  const resolve = createXahauNameResolverWithLoader({}, mock.load);
  await Promise.all([resolve(address, session()), resolve(address, session())]);
  await resolve(address, session());
  assert.equal(mock.calls.length, 1);
  assert.deepEqual(await resolve(address, session(), { force: true }), { name: "new.xah", source: "xahauname", verified: true });
  assert.equal(mock.calls.length, 2);
  await resolve(address, session({ ...XAHAU_TESTNET, rpcUrl: "wss://other.example" }));
  assert.equal(mock.calls.length, 3);
});

test("missing Primary returns null; RPC failure is not cached as a missing name", async () => {
  let attempt = 0;
  const mock = fixture(async () => { if (++attempt === 1) throw new Error("RPC offline"); return null; });
  const resolve = createXahauNameResolverWithLoader({}, mock.load);
  await assert.rejects(resolve(address, session()), /RPC offline/);
  assert.equal(await resolve(address, session()), null);
  assert.equal(await resolve(address, session()), null);
  assert.equal(mock.calls.length, 2);
  assert.equal(mock.counts().closes, 2);
});

test("Mainnet uses its explicit deployment, never Testnet configuration", async () => {
  const mock = fixture();
  const deployment = { treasury: address, namespaceId: "B".repeat(64), hookHashes: { control: "C".repeat(64) }, expectedNetworkId: 21337 };
  const resolve = createXahauNameResolverWithLoader({ mainnet: deployment, testnet: false }, mock.load);
  deployment.namespaceId = "D".repeat(64);
  assert.equal(await resolve(address, session()), null);
  await resolve(address, session(XAHAU_MAINNET));
  assert.equal(mock.configs[0].network, "mainnet");
  assert.equal(mock.configs[0].deployment?.namespaceId, "B".repeat(64));
  assert.equal(mock.configs[0].deployment?.expectedNetworkId, 21337);
});

test("lookup timeout aborts the read and closes its SDK client", async () => {
  const mock = fixture(request => new Promise((_, reject) => {
    request.signal!.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
  }));
  const resolve = createXahauNameResolverWithLoader({ timeoutMs: 20 }, mock.load);
  await assert.rejects(resolve(address, session()), /timed out|aborted/);
  await new Promise(done => setTimeout(done, 0));
  assert.equal(mock.calls[0].signal?.aborted, true);
  assert.equal(mock.counts().closes, 1);
});

test("forced refresh supersedes an older result without poisoning cache", async () => {
  let finish!: (name: string) => void;
  const mock = fixture(request => request.bypassCache ? Promise.resolve("fresh.xah") : new Promise(done => { finish = done; }));
  const resolve = createXahauNameResolverWithLoader({}, mock.load);
  const old = resolve(address, session());
  await new Promise(done => setTimeout(done, 0));
  await resolve(address, session(), { force: true });
  finish("old.xah");
  await old;
  assert.equal((await resolve(address, session()) as { name: string }).name, "fresh.xah");
});

test("default identity keeps XRPL testnet and unconfigured Xahau Mainnet on address fallback", async () => {
  const resolve = createDefaultWalletIdentityResolver();
  assert.equal(await resolve(address, session(XAHAU_MAINNET)), null);
  assert.equal(await resolve(address, session({ ...XAHAU_TESTNET, family: "xrpl" })), null);
});

test("disabling identity while a Primary read is pending ignores the late result", async () => {
  let finish!: (identity: { name: string }) => void;
  const current = session();
  const button = new WalletButtonController({
    manager: { on: () => () => undefined, getSession: () => current } as never,
    modal: { onClose: () => () => undefined } as never,
    identityResolver: () => new Promise(done => { finish = done; })
  }) as unknown as { options: { showWeb3Name: boolean }; identityName: string | null; resolveIdentity(session: WalletSession): Promise<void> };
  const read = button.resolveIdentity(current);
  button.options.showWeb3Name = false;
  await button.resolveIdentity(current);
  finish({ name: "late.xah" });
  await read;
  assert.equal(button.identityName, null);
});
