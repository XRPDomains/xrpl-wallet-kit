import assert from "node:assert/strict";
import { test } from "node:test";
import { PrivyAdapter, createPrivyAdapter } from "../packages/adapters/privy/src/index";
import { XRPL_MAINNET, XRPL_TESTNET, XRPL_DEVNET, WalletKitErrorCode } from "../packages/core/src/index";

const address = "rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh";
const hash = "A".repeat(64);
const configuration = { appId: "test-app", redirectUri: "https://wallet.example/wallet/privy" };

function setup() {
  const connections: Array<{ network: { id: string; wss: string }; loginMethod?: string; privyWalletId?: string; privyUserId?: string }> = [];
  let loads = 0;
  let signs = 0;
  let submissions = 0;
  const adapter = new PrivyAdapter(configuration, async () => {
    loads += 1;
    return {
      on: () => undefined,
      onAuthPrompt: () => () => undefined,
      getLoginMethods: async () => [{ id: "email", label: "Email" }],
      connect: async options => {
        const network = options?.network;
        assert.ok(network && typeof network === "object");
        connections.push({ ...options, network });
        return { address, publicKey: "test-key", network };
      },
      disconnect: async () => undefined,
      serializeReconnectOptions: () => ({ privyWalletId: "wallet", privyUserId: "user" }),
      hasPendingConnection: () => false,
      sign: async () => { signs += 1; return { tx_blob: "DEADBEEF", hash }; },
      signAndSubmit: async () => { submissions += 1; return { hash }; }
    };
  });
  return { adapter, connections, counts: () => ({ loads, signs, submissions }) };
}

test("Privy is passive in Node and rejects invalid callback URLs", () => {
  assert.equal(createPrivyAdapter(configuration).isAvailable(), false);
  assert.throws(() => createPrivyAdapter({ ...configuration, redirectUri: "/wallet/privy" }), {
    code: WalletKitErrorCode.INVALID_REQUEST
  });
});

test("Privy uses Kit network settings and skips the picker for email-only apps", async () => {
  const { adapter, counts, connections } = setup();
  await assert.rejects(adapter.connect({ network: XRPL_DEVNET }), { code: WalletKitErrorCode.NETWORK_NOT_SUPPORTED });
  assert.equal(counts().loads, 0);
  const connected = await adapter.connect({ network: XRPL_TESTNET });
  assert.equal(connected.account.network?.id, "testnet");
  assert.equal(connections[0].loginMethod, "email");
  assert.equal(connections[0].network.wss, XRPL_TESTNET.rpcUrl);
  const mainnet = await adapter.connect({ network: XRPL_MAINNET });
  assert.equal(mainnet.account.network?.id, "mainnet");
  assert.equal(connections[1].network.wss, XRPL_MAINNET.rpcUrl);
  const restored = await adapter.restoreSession(connected.session, { network: XRPL_TESTNET });
  assert.equal(restored?.account.address, address);
  assert.equal(connections[2].privyWalletId, "wallet");
  assert.equal(connections[2].privyUserId, "user");
});

test("Privy preserves confirmation status and separates sign-only from submission", async () => {
  const { adapter, counts } = setup();
  const txJson = { TransactionType: "Payment" as const, Account: address, Destination: address, Amount: "1" };
  assert.deepEqual(await adapter.signAndSubmit({ txJson, submit: false }), { signed: true, raw: { txBlob: "DEADBEEF" } });
  assert.equal(counts().signs, 1);
  assert.equal(counts().submissions, 0);
  assert.equal((await adapter.signAndSubmit({ txJson })).status, "submitted");
});

test("Privy rejects malformed request fee limits", async () => {
  const { adapter } = setup();
  const txJson = { TransactionType: "Payment" as const, Account: address, Destination: address, Amount: "1" };
  await assert.rejects(adapter.signTransaction({ txJson, maxFeeDrops: "0" }), { code: WalletKitErrorCode.INVALID_REQUEST });
});
