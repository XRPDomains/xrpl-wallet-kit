import assert from "node:assert/strict";
import test from "node:test";
import { assertWalletAdapter, isWalletKitError, WalletKitErrorCode } from "@xrpl-wallet-kit/core";
import { OtsuAdapter } from "../packages/adapters/otsu/src/index";
import type { OtsuProvider } from "../packages/adapters/otsu/src/index";

// Mock provider

function makeMockProvider(overrides: Partial<OtsuProvider> = {}): OtsuProvider {
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
    on: () => {},
    off: () => {},
    ...overrides
  };
}

const testNetwork = {
  id: "mainnet",
  name: "XRPL Mainnet",
  family: "xrpl" as const,
  networkType: "MAINNET" as const,
  nativeAsset: "XRP",
  nativeAssetDecimals: 6,
  rpcUrl: "wss://xrplcluster.com",
  httpRpcUrl: "https://xrplcluster.com",
  walletConnectChainId: "xrpl:0"
};

const paymentTx = {
  TransactionType: "Payment",
  Account: "rOtsuMockAddress1234567890",
  Destination: "rDestination1234567890",
  Amount: "1000000"
};

// Contract

test("OtsuAdapter passes contract validation", () => {
  assertWalletAdapter(new OtsuAdapter({ provider: makeMockProvider() }));
});

test("adapter id is stable lowercase", () => {
  const adapter = new OtsuAdapter({ provider: makeMockProvider() });
  assert.match(adapter.metadata.id, /^[a-z0-9][a-z0-9-]*$/);
  assert.equal(adapter.metadata.id, "otsu");
});

// isAvailable

test("isAvailable returns true when provider.isOtsu is true", () => {
  const adapter = new OtsuAdapter({ provider: makeMockProvider() });
  assert.equal(adapter.isAvailable(), true);
});

test("isAvailable returns false when no provider injected", () => {
  const adapter = new OtsuAdapter({ provider: undefined });
  assert.equal(adapter.isAvailable(), false);
});

test("isAvailable returns false when provider.isOtsu is falsy", () => {
  const adapter = new OtsuAdapter({
    provider: { ...makeMockProvider(), isOtsu: false as unknown as true }
  });
  assert.equal(adapter.isAvailable(), false);
});

// connect

test("connect returns account with correct address", async () => {
  const adapter = new OtsuAdapter({ provider: makeMockProvider() });
  const result = await adapter.connect({ network: testNetwork });
  assert.equal(result.account.address, "rOtsuMockAddress1234567890");
  assert.equal(result.account.networkType, "MAINNET");
});

test("connect passes network from options when provided", async () => {
  const adapter = new OtsuAdapter({ provider: makeMockProvider() });
  const result = await adapter.connect({ network: testNetwork });
  assert.deepEqual(result.account.network, testNetwork);
});

test("connect uses custom scopes from options", async () => {
  let capturedScopes: string[] | undefined;
  const provider = makeMockProvider({
    connect: async (params) => {
      capturedScopes = params?.scopes;
      return { address: "rOtsuMockAddress1234567890" };
    }
  });
  const adapter = new OtsuAdapter({ provider, scopes: ["read"] });
  await adapter.connect({ network: testNetwork });
  assert.deepEqual(capturedScopes, ["read"]);
});

test("connect uses default scopes when none specified", async () => {
  let capturedScopes: string[] | undefined;
  const provider = makeMockProvider({
    connect: async (params) => {
      capturedScopes = params?.scopes;
      return { address: "rOtsuMockAddress1234567890" };
    }
  });
  const adapter = new OtsuAdapter({ provider });
  await adapter.connect({ network: testNetwork });
  assert.deepEqual(capturedScopes, ["read", "sign", "submit", "switchNetwork"]);
});

test("connect throws WALLET_NOT_AVAILABLE when provider is missing", async () => {
  const adapter = new OtsuAdapter({ provider: undefined });
  await assert.rejects(
    () => adapter.connect({ network: testNetwork }),
    (error) => isWalletKitError(error) && error.code === WalletKitErrorCode.WALLET_NOT_AVAILABLE
  );
});

test("connect throws CONNECTION_REJECTED when user cancels", async () => {
  const provider = makeMockProvider({
    connect: async () => { throw new Error("User rejected the request"); }
  });
  const adapter = new OtsuAdapter({ provider });
  await assert.rejects(
    () => adapter.connect({ network: testNetwork }),
    (error) => isWalletKitError(error) && error.code === WalletKitErrorCode.CONNECTION_REJECTED
  );
});

test("connect throws CONNECTION_FAILED on unexpected provider error", async () => {
  const provider = makeMockProvider({
    connect: async () => { throw new Error("Extension internal error"); }
  });
  const adapter = new OtsuAdapter({ provider });
  await assert.rejects(
    () => adapter.connect({ network: testNetwork }),
    (error) => isWalletKitError(error) && error.code === WalletKitErrorCode.CONNECTION_FAILED
  );
});

test("connect respects AbortSignal already aborted", async () => {
  const controller = new AbortController();
  controller.abort();
  const adapter = new OtsuAdapter({ provider: makeMockProvider() });
  await assert.rejects(
    () => adapter.connect({ network: testNetwork, signal: controller.signal }),
    (error) => isWalletKitError(error) && error.code === WalletKitErrorCode.CONNECTION_REJECTED
  );
});

// disconnect

test("disconnect calls provider.disconnect", async () => {
  let called = false;
  const provider = makeMockProvider({ disconnect: async () => { called = true; } });
  const adapter = new OtsuAdapter({ provider });
  await adapter.connect({ network: testNetwork });
  await adapter.disconnect();
  assert.equal(called, true);
});

test("disconnect does not throw when no provider", async () => {
  const adapter = new OtsuAdapter({ provider: undefined });
  await assert.doesNotReject(() => adapter.disconnect());
});

// restoreSession

const mockSession = {
  adapterId: "otsu",
  account: { address: "rOtsuMockAddress1234567890", network: testNetwork },
  connectedAt: Date.now()
};

test("restoreSession returns result when provider is connected", async () => {
  const adapter = new OtsuAdapter({ provider: makeMockProvider({ isConnected: () => true }) });
  const result = await adapter.restoreSession(mockSession);
  assert.ok(result !== null);
  assert.equal(result?.account.address, "rOtsuMockAddress1234567890");
});

test("restoreSession returns null when provider.isConnected() is false", async () => {
  const adapter = new OtsuAdapter({ provider: makeMockProvider({ isConnected: () => false }) });
  const result = await adapter.restoreSession(mockSession);
  assert.equal(result, null);
});

test("restoreSession returns null when no provider", async () => {
  const adapter = new OtsuAdapter({ provider: undefined });
  const result = await adapter.restoreSession(mockSession);
  assert.equal(result, null);
});

test("restoreSession returns null when getAddress throws", async () => {
  const provider = makeMockProvider({
    isConnected: () => true,
    getAddress: async () => { throw new Error("Extension locked"); }
  });
  const adapter = new OtsuAdapter({ provider });
  const result = await adapter.restoreSession(mockSession);
  assert.equal(result, null);
});

test("restoreSession uses fresh address from getAddress()", async () => {
  const provider = makeMockProvider({
    isConnected: () => true,
    getAddress: async () => ({ address: "rFreshAddress9999" })
  });
  const adapter = new OtsuAdapter({ provider });
  const result = await adapter.restoreSession(mockSession);
  assert.equal(result?.account.address, "rFreshAddress9999");
});

// signMessage

test("signMessage returns signature", async () => {
  const adapter = new OtsuAdapter({ provider: makeMockProvider() });
  const result = await adapter.signMessage({ message: "Login to My App" });
  assert.ok("signature" in result);
  assert.ok(typeof result.signature === "string" && result.signature.length > 0);
});

test("signMessage throws SIGN_REJECTED when user denies", async () => {
  const provider = makeMockProvider({
    signMessage: async () => { throw new Error("User denied message signature"); }
  });
  const adapter = new OtsuAdapter({ provider });
  await assert.rejects(
    () => adapter.signMessage({ message: "Login" }),
    (error) => isWalletKitError(error) && error.code === WalletKitErrorCode.SIGN_REJECTED
  );
});

// signTransaction

test("signTransaction returns txBlob and hash without submitting", async () => {
  const adapter = new OtsuAdapter({ provider: makeMockProvider() });
  const result = await adapter.signTransaction({ methodHint: "payment", txJson: paymentTx });
  assert.ok("txBlob" in result, "result must contain txBlob");
  assert.ok("tx_blob" in result, "result must contain tx_blob for compatibility");
  assert.ok("hash" in result, "result must contain hash");
  assert.equal(result.txBlob, "12000022800000002400000001");
});

test("signTransaction throws SIGN_REJECTED when user cancels", async () => {
  const provider = makeMockProvider({
    signTransaction: async () => { throw new Error("Transaction signing rejected by user"); }
  });
  const adapter = new OtsuAdapter({ provider });
  await assert.rejects(
    () => adapter.signTransaction({ methodHint: "payment", txJson: paymentTx }),
    (error) => isWalletKitError(error) && error.code === WalletKitErrorCode.SIGN_REJECTED
  );
});

// signAndSubmit

test("signAndSubmit returns normalized hash", async () => {
  const adapter = new OtsuAdapter({ provider: makeMockProvider() });
  const result = await adapter.signAndSubmit({ methodHint: "payment", submit: true, txJson: paymentTx });
  assert.ok("hash" in result, "result must contain hash");
  assert.equal(result.hash, "ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890");
});

test("signAndSubmit routes to signTransaction when submit=false", async () => {
  let signTxCalled = false;
  let signAndSubmitCalled = false;
  const provider = makeMockProvider({
    signTransaction: async () => { signTxCalled = true; return { tx_blob: "BLOB", hash: "SIGNHASH" }; },
    signAndSubmit: async () => { signAndSubmitCalled = true; return { tx_blob: "BLOB", hash: "SUBMITHASH" }; }
  });
  const adapter = new OtsuAdapter({ provider });
  const result = await adapter.signAndSubmit({ methodHint: "payment", submit: false, txJson: paymentTx });
  assert.equal(signTxCalled, true, "should delegate to signTransaction");
  assert.equal(signAndSubmitCalled, false, "should NOT call provider.signAndSubmit");
  assert.ok("txBlob" in result);
});

test("signAndSubmit throws SIGN_REJECTED when user cancels", async () => {
  const provider = makeMockProvider({
    signAndSubmit: async () => { throw new Error("Transaction rejected by user"); }
  });
  const adapter = new OtsuAdapter({ provider });
  await assert.rejects(
    () => adapter.signAndSubmit({ methodHint: "payment", submit: true, txJson: paymentTx }),
    (error) => isWalletKitError(error) && error.code === WalletKitErrorCode.SIGN_REJECTED
  );
});
