import assert from "node:assert/strict";
import test from "node:test";
import { KyraAdapter } from "../packages/adapters/kyra/src/index";
import {
  assertWalletAdapter,
  DEFAULT_XRPL_NETWORKS,
  WalletKitErrorCode,
  WalletManager,
} from "../packages/core/src/index";
import { XAHAU_TESTNET } from "../packages/xahau/src/networks";
import { createXahauProtocol } from "../packages/xahau/src/index";

const WALLET = "http://localhost:5173";
const PROTOCOL = { protocol: "kyra-wallet", version: 2 };
const ADDRESS = "rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh";
const HASH = "AB".repeat(32);
function preset(id: string) {
  const network = DEFAULT_XRPL_NETWORKS.find((item) => item.id === id);
  if (!network) throw new Error(`No ${id} preset.`);
  return network;
}
const testnet = preset("testnet");
const devnet = preset("devnet");
const mainnet = preset("mainnet");

type Reply = (request: Record<string, unknown>) => readonly Record<string, unknown>[] | "close";

/** A page and the Kyra window it opens; `reply` plays the wallet for each request. */
function page(reply: Reply) {
  const target = new EventTarget();
  const sent: Record<string, unknown>[] = [];
  const popup = {
    closed: false,
    close() {
      this.closed = true;
    },
    postMessage(message: Record<string, unknown>) {
      sent.push(message);
      const answers = reply(message);
      setTimeout(() => {
        if (answers === "close") {
          popup.closed = true;
          return;
        }
        for (const body of answers) emit({ ...PROTOCOL, id: message.id, ...body });
      }, 0);
    },
  };
  const emit = (data: unknown) =>
    target.dispatchEvent(
      Object.assign(new Event("message"), { data, origin: WALLET, source: popup }),
    );
  const scope = {
    open: () => {
      setTimeout(() => emit({ ...PROTOCOL, ready: true }), 0);
      return popup;
    },
    addEventListener: target.addEventListener.bind(target),
    removeEventListener: target.removeEventListener.bind(target),
  } as unknown as Window;
  return { scope, sent };
}

const connected = {
  ok: true,
  result: { accounts: [{ account: "xrpl:1:" + ADDRESS }], scopes: { "xrpl:1": { methods: ["xrpl_signAndSubmit", "xrpl_signMessage", "xrpl_signIn"] } } },
};

async function connectedAdapter(reply: Reply) {
  const { scope, sent } = page((request) =>
    request.method === "connect" ? [connected] : reply(request),
  );
  const adapter = new KyraAdapter({ walletOrigin: WALLET, scope, readyTimeoutMs: 200 });
  await adapter.connect({ network: testnet });
  return { adapter, sent };
}

test("Kyra adapter passes the core contract validator", () => {
  assertWalletAdapter(new KyraAdapter());
});

test("connect returns the shared account; other networks are refused before opening", async () => {
  const { scope, sent } = page(() => [connected]);
  const adapter = new KyraAdapter({ walletOrigin: WALLET, scope });
  const { account, session } = await adapter.connect({ network: testnet });
  assert.equal(account.address, ADDRESS);
  assert.equal(account.network?.id, "testnet");
  assert.equal(session?.adapterId, "kyra");
  assert.deepEqual(sent[0]?.params, { chains: ["xrpl:1"] });
  await assert.rejects(adapter.connect({ network: devnet }), {
    code: WalletKitErrorCode.NETWORK_NOT_SUPPORTED,
  });
  await assert.rejects(adapter.connect({ network: { ...mainnet, family: "xahau", networkId: 21337 } }), {
    code: WalletKitErrorCode.NETWORK_NOT_SUPPORTED,
  });
  assert.equal(sent.length, 1);
  assert.equal(await adapter.restoreSession(), null);
});

test("connect and sign-and-submit use the selected Mainnet chain", async () => {
  const { scope, sent } = page(request => request.method === "connect" ? [{
    ok: true,
    result: { accounts: [{ account: "xrpl:0:" + ADDRESS }], scopes: { "xrpl:0": { methods: ["xrpl_signAndSubmit"] } } },
  }] : [{ ok: true, result: { hash: HASH, outcome: "confirmed" } }]);
  const adapter = new KyraAdapter({ walletOrigin: WALLET, scope });
  const { account } = await adapter.connect({ network: mainnet });
  assert.equal(account.network?.id, "mainnet");
  assert.deepEqual(sent[0]?.params, { chains: ["xrpl:0"] });
  await adapter.signAndSubmit({ txJson: { TransactionType: "TicketCreate", TicketCount: 1 } });
  assert.equal(sent[1]?.chain, "xrpl:0");
});

test("Xahau Payment goes through the manager as intent and rejects an app fee ceiling", async () => {
  const chain = "xrpl:21338";
  const { scope, sent } = page(request => request.method === "connect" ? [{
    ok: true,
    result: { accounts: [{ account: chain + ":" + ADDRESS }], scopes: { [chain]: { methods: ["xrpl_signAndSubmit"] } } },
  }] : [{ ok: true, result: { hash: HASH, outcome: "confirmed" } }]);
  const adapter = new KyraAdapter({ walletOrigin: WALLET, scope });
  const protocol = createXahauProtocol({ request: async () => { throw new Error("Kyra owns transaction preparation"); } });
  const manager = new WalletManager({ adapters: [adapter], networks: [XAHAU_TESTNET], network: "xahau-testnet", protocols: [protocol] });
  try {
    await manager.connect("kyra");
    assert.deepEqual(sent[0]?.params, { chains: [chain] });
    assert.equal(adapter.capabilities.signMessage, false);
    assert.deepEqual(adapter.capabilities.details?.supportedTransactionTypes, ["Payment"]);
    const txJson = { TransactionType: "Payment", Destination: "rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe", Amount: "1250000" } as const;
    await assert.rejects(manager.signAndSubmit({ txJson, maxFeeDrops: "50" }), { code: WalletKitErrorCode.INVALID_REQUEST });
    assert.equal(sent.length, 1);
    const result = await manager.signAndSubmit({ txJson });
    assert.equal(result.hash, HASH);
    assert.equal(sent[1]?.chain, chain);
    assert.deepEqual(sent[1]?.params, { tx: { ...txJson, Account: ADDRESS } });
  } finally {
    await manager.destroy();
  }
});

test("a confirmed sign-and-submit returns the hash; wallet-owned fields are refused", async () => {
  const { adapter, sent } = await connectedAdapter(() => [
    { progress: { submitting: HASH } },
    { ok: true, result: { hash: HASH, outcome: "confirmed" } },
  ]);
  const result = await adapter.signAndSubmit({
    txJson: { TransactionType: "TicketCreate", TicketCount: 1 } as never,
  });
  assert.equal(result.hash, HASH);
  assert.equal(result.status, "tesSUCCESS");
  assert.equal(sent.at(-1)?.method, "xrpl_signAndSubmit");
  await assert.rejects(
    adapter.signAndSubmit({
      txJson: { TransactionType: "TicketCreate", TicketCount: 1, Fee: "12" } as never,
    }),
    { code: WalletKitErrorCode.INVALID_REQUEST },
  );
  await assert.rejects(
    adapter.signAndSubmit({ txJson: { TransactionType: "TicketCreate" } as never, submit: false }),
    { code: WalletKitErrorCode.UNSUPPORTED_METHOD },
  );
});

test("an unknown outcome keeps the hash and never reports success", async () => {
  const { adapter } = await connectedAdapter(() => [{ progress: { submitting: HASH } }]);
  // The wallet reported the hash, then its window closed before the outcome.
  const closing = adapter.signAndSubmit({
    txJson: { TransactionType: "TicketCreate", TicketCount: 1 } as never,
  });
  setTimeout(() => adapter.cancelPendingConnection(), 30);
  await assert.rejects(
    closing,
    (error: { code: string; details?: { hash?: string; outcomeUnknown?: boolean } }) => {
      assert.equal(error.code, WalletKitErrorCode.SIGN_FAILED);
      assert.equal(error.details?.outcomeUnknown, true);
      assert.equal(error.details?.hash, HASH);
      return true;
    },
  );
});

test("rejection, ledger failure and unsupported requests map to kit errors", async () => {
  const rejecting = await connectedAdapter(() => [
    { ok: false, error: { code: "USER_REJECTED", message: "Rejected in the wallet." } },
  ]);
  await assert.rejects(
    rejecting.adapter.signAndSubmit({
      txJson: { TransactionType: "TicketCreate", TicketCount: 1 } as never,
    }),
    {
      code: WalletKitErrorCode.SIGN_REJECTED,
    },
  );
  const failing = await connectedAdapter(() => [
    { ok: true, result: { hash: HASH, outcome: "failed", result: "tecNO_PERMISSION" } },
  ]);
  await assert.rejects(
    failing.adapter.signAndSubmit({
      txJson: { TransactionType: "OfferCancel", OfferSequence: 3 } as never,
    }),
    {
      code: WalletKitErrorCode.SUBMIT_FAILED,
    },
  );
  const refusing = await connectedAdapter(() => [
    {
      ok: false,
      error: {
        code: "UNSUPPORTED",
        message: "Sites can't ask this wallet to sign this kind of transaction yet.",
      },
    },
  ]);
  await assert.rejects(
    refusing.adapter.signAndSubmit({
      txJson: { TransactionType: "Payment", Destination: ADDRESS, Amount: "1" } as never,
    }),
    {
      code: WalletKitErrorCode.UNSUPPORTED_METHOD,
    },
  );
});

test("signMessage and signIn return Kyra's signed text; another account's signature is refused", async () => {
  const signedText = (address: string, lines: readonly string[]) => ({
    ok: true,
    result: {
      account: `xrpl:1:${address}`,
      publicKey: `ED${"1".repeat(64)}`,
      message: [
        "localhost wants you to sign in with your XRPL account:",
        address,
        "",
        ...lines,
      ].join("\n"),
      signature: "AB".repeat(64),
    },
  });
  let signer = ADDRESS;
  const { adapter, sent } = await connectedAdapter((request) =>
    request.method === "xrpl_signIn"
      ? [signedText(signer, ["URI: http://localhost", "Nonce: n0nce-123", "Issued At: x"])]
      : [signedText(signer, ["Hello", "", "URI: http://localhost"])],
  );
  const message = await adapter.signMessage({ message: "Hello" });
  assert.equal(message.signatureKind, "signature");
  assert.equal(message.signature, "AB".repeat(64));
  assert.equal(message.proof, message.signature);
  assert.deepEqual(sent.at(-1)?.params, { message: "Hello" });
  const signIn = await adapter.signIn({ nonce: "n0nce-123", statement: "Hi" });
  assert.equal(signIn.mode, "caip122");
  assert.equal(signIn.address, ADDRESS);
  assert.equal(signIn.chainId, "xrpl:1");
  assert.equal(signIn.nonce, "n0nce-123");
  assert.deepEqual(sent.at(-1)?.params, { nonce: "n0nce-123", statement: "Hi" });
  // A short nonce never opens the wallet; a popup holding another profile signs as that account.
  const before = sent.length;
  await assert.rejects(adapter.signIn({ nonce: "short" }), {
    code: WalletKitErrorCode.INVALID_REQUEST,
  });
  assert.equal(sent.length, before);
  signer = "rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe";
  await assert.rejects(adapter.signMessage({ message: "Hello" }), {
    code: WalletKitErrorCode.INVALID_REQUEST,
  });
});
