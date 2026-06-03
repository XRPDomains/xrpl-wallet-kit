import assert from "node:assert/strict";
import test from "node:test";
import { assertWalletAdapter, isWalletKitError, WalletKitErrorCode } from "../packages/core/src/index";
import { OtsuAdapter } from "../packages/adapters/otsu/src/index";
import type { OtsuProvider } from "../packages/adapters/otsu/src/index";

function makeMockProvider(overrides = {}) {
  return {
    isOtsu: true,
    isConnected: () => true,
    connect: async () => ({ address: "rOtsuMockAddress1234567890" }),
    disconnect: async () => {},
    getAddress: async () => ({ address: "rOtsuMockAddress1234567890" }),
    getNetwork: async () => ({ network: "mainnet" }),
    signTransaction: async () => ({ tx_blob: "12000022800000002400000001", hash: "SIGNONLYHASH0000" }),
    signAndSubmit: async () => ({ tx_blob: "12000022800000002400000001", hash: "ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890" }),
    signMessage: async (msg) => ({ signature: "mock-sig-" + msg.slice(0, 4) }),
    on: () => {}, off: () => {},
    ...overrides
  };
}

const testNetwork = { id: "mainnet", name: "XRPL Mainnet", family: "xrpl", networkType: "MAINNET", nativeAsset: "XRP", nativeAssetDecimals: 6, rpcUrl: "wss://xrplcluster.com", httpRpcUrl: "https://xrplcluster.com", walletConnectChainId: "xrpl:0" };
const paymentTx = { TransactionType: "Payment", Account: "rOtsuMockAddress1234567890", Destination: "rDestination1234567890", Amount: "1000000" };
const mockSession = { adapterId: "otsu", account: { address: "rOtsuMockAddress1234567890", network: testNetwork }, connectedAt: Date.now() };

// ─── Contract
test("OtsuAdapter passes assertWalletAdapter", () => { assertWalletAdapter(new OtsuAdapter({ provider: makeMockProvider() })); });
test("metadata.id is stable lowercase", () => { assert.equal(new OtsuAdapter({ provider: makeMockProvider() }).metadata.id, "otsu"); });
test("capabilities does not claim nftOffers or payments", () => {
  const a = new OtsuAdapter({ provider: makeMockProvider() });
  assert.equal(a.capabilities.nftOffers, undefined);
  assert.equal(a.capabilities.payments, undefined);
  assert.equal(a.capabilities.connect, true);
  assert.equal(a.capabilities.signTransaction, true);
});

// ─── isAvailable
test("isAvailable true when provider.isOtsu=true", () => { assert.equal(new OtsuAdapter({ provider: makeMockProvider() }).isAvailable(), true); });
test("isAvailable false when no provider", () => { assert.equal(new OtsuAdapter({ provider: undefined }).isAvailable(), false); });
test("isAvailable false when isOtsu=false", () => { assert.equal(new OtsuAdapter({ provider: { ...makeMockProvider(), isOtsu: false } }).isAvailable(), false); });

// ─── connect
test("connect returns correct address and networkType", async () => {
  const r = await new OtsuAdapter({ provider: makeMockProvider() }).connect({ network: testNetwork });
  assert.equal(r.account.address, "rOtsuMockAddress1234567890");
  assert.equal(r.account.networkType, "MAINNET");
});
test("connect uses custom scopes", async () => {
  let captured;
  const p = makeMockProvider({ connect: async (params) => { captured = params?.scopes; return { address: "rA" }; } });
  await new OtsuAdapter({ provider: p, scopes: ["read"] }).connect({ network: testNetwork });
  assert.deepEqual(captured, ["read"]);
});
test("connect default scopes include sign+submit", async () => {
  let captured;
  const p = makeMockProvider({ connect: async (params) => { captured = params?.scopes; return { address: "rA" }; } });
  await new OtsuAdapter({ provider: p }).connect({ network: testNetwork });
  assert.ok(captured.includes("sign") && captured.includes("submit"));
});
test("connect WALLET_NOT_AVAILABLE when no provider", async () => {
  await assert.rejects(() => new OtsuAdapter({ provider: undefined }).connect({ network: testNetwork }),
    e => isWalletKitError(e) && e.code === WalletKitErrorCode.WALLET_NOT_AVAILABLE);
});
test("connect CONNECTION_REJECTED when user cancels", async () => {
  const p = makeMockProvider({ connect: async () => { throw new Error("User rejected the request"); } });
  await assert.rejects(() => new OtsuAdapter({ provider: p }).connect({ network: testNetwork }),
    e => isWalletKitError(e) && e.code === WalletKitErrorCode.CONNECTION_REJECTED);
});
test("connect CONNECTION_FAILED on unexpected error", async () => {
  const p = makeMockProvider({ connect: async () => { throw new Error("Extension internal error"); } });
  await assert.rejects(() => new OtsuAdapter({ provider: p }).connect({ network: testNetwork }),
    e => isWalletKitError(e) && e.code === WalletKitErrorCode.CONNECTION_FAILED);
});
test("connect AbortSignal already aborted", async () => {
  const ctrl = new AbortController(); ctrl.abort();
  await assert.rejects(() => new OtsuAdapter({ provider: makeMockProvider() }).connect({ network: testNetwork, signal: ctrl.signal }),
    e => isWalletKitError(e) && e.code === WalletKitErrorCode.CONNECTION_REJECTED);
});

// ─── disconnect
test("disconnect calls provider.disconnect", async () => {
  let called = false;
  const p = makeMockProvider({ disconnect: async () => { called = true; } });
  const a = new OtsuAdapter({ provider: p });
  await a.connect({ network: testNetwork }); await a.disconnect();
  assert.equal(called, true);
});
test("disconnect does not throw when no provider", async () => {
  await assert.doesNotReject(() => new OtsuAdapter({ provider: undefined }).disconnect());
});

// ─── restoreSession
test("restoreSession returns result when isConnected=true", async () => {
  const r = await new OtsuAdapter({ provider: makeMockProvider({ isConnected: () => true }) }).restoreSession(mockSession);
  assert.ok(r !== null); assert.equal(r.account.address, "rOtsuMockAddress1234567890");
});
test("restoreSession null when isConnected=false", async () => {
  assert.equal(await new OtsuAdapter({ provider: makeMockProvider({ isConnected: () => false }) }).restoreSession(mockSession), null);
});
test("restoreSession null when no provider", async () => {
  assert.equal(await new OtsuAdapter({ provider: undefined }).restoreSession(mockSession), null);
});
test("restoreSession null when getAddress throws", async () => {
  const p = makeMockProvider({ isConnected: () => true, getAddress: async () => { throw new Error("locked"); } });
  assert.equal(await new OtsuAdapter({ provider: p }).restoreSession(mockSession), null);
});
test("restoreSession uses fresh address from getAddress", async () => {
  const p = makeMockProvider({ isConnected: () => true, getAddress: async () => ({ address: "rFresh999" }) });
  assert.equal((await new OtsuAdapter({ provider: p }).restoreSession(mockSession))?.account.address, "rFresh999");
});

// ─── signMessage
test("signMessage returns non-empty signature", async () => {
  const r = await new OtsuAdapter({ provider: makeMockProvider() }).signMessage({ message: "hello" });
  assert.ok("signature" in r && r.signature.length > 0);
});
test("signMessage SIGN_REJECTED when user denies", async () => {
  const p = makeMockProvider({ signMessage: async () => { throw new Error("User denied message signature"); } });
  await assert.rejects(() => new OtsuAdapter({ provider: p }).signMessage({ message: "hi" }),
    e => isWalletKitError(e) && e.code === WalletKitErrorCode.SIGN_REJECTED);
});

// ─── signTransaction
test("signTransaction returns txBlob + tx_blob + hash (no submit)", async () => {
  const r = await new OtsuAdapter({ provider: makeMockProvider() }).signTransaction({ methodHint: "payment", txJson: paymentTx });
  assert.ok("txBlob" in r && "tx_blob" in r && "hash" in r);
  assert.equal(r.txBlob, "12000022800000002400000001");
});
test("signTransaction SIGN_REJECTED when user cancels", async () => {
  const p = makeMockProvider({ signTransaction: async () => { throw new Error("rejected by user"); } });
  await assert.rejects(() => new OtsuAdapter({ provider: p }).signTransaction({ methodHint: "payment", txJson: paymentTx }),
    e => isWalletKitError(e) && e.code === WalletKitErrorCode.SIGN_REJECTED);
});

// ─── signAndSubmit
test("signAndSubmit returns normalized hash", async () => {
  const r = await new OtsuAdapter({ provider: makeMockProvider() }).signAndSubmit({ methodHint: "payment", submit: true, txJson: paymentTx });
  assert.ok("hash" in r);
  assert.equal(r.hash, "ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890");
});
test("signAndSubmit submit=false routes to signTransaction", async () => {
  let signTxCalled = false; let signAndSubmitCalled = false;
  const p = makeMockProvider({
    signTransaction: async () => { signTxCalled = true; return { tx_blob: "BLOB", hash: "SH" }; },
    signAndSubmit: async () => { signAndSubmitCalled = true; return { tx_blob: "BLOB", hash: "SUB" }; }
  });
  const r = await new OtsuAdapter({ provider: p }).signAndSubmit({ methodHint: "payment", submit: false, txJson: paymentTx });
  assert.equal(signTxCalled, true);
  assert.equal(signAndSubmitCalled, false);
  assert.ok("txBlob" in r);
});
test("signAndSubmit SIGN_REJECTED when user cancels", async () => {
  const p = makeMockProvider({ signAndSubmit: async () => { throw new Error("Transaction rejected by user"); } });
  await assert.rejects(() => new OtsuAdapter({ provider: p }).signAndSubmit({ methodHint: "payment", submit: true, txJson: paymentTx }),
    e => isWalletKitError(e) && e.code === WalletKitErrorCode.SIGN_REJECTED);
});
