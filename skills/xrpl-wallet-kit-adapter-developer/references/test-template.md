# Adapter Test Template

Use this template when writing unit tests for a new adapter package. Tests run with Node's built-in test runner via `tsx` — no Jest, no Vitest.

## Run tests

```powershell
npm.cmd test
```

The root `package.json` runs: `node --import tsx/esm --test tests/**/*.test.ts`

## Minimal test file

Place at `tests/<wallet-id>.test.ts` or inside the adapter package at `src/__tests__/adapter.test.ts`.

```ts
import assert from "node:assert/strict";
import test from "node:test";
import {
  assertWalletAdapter,
  isWalletKitError,
  WalletKitErrorCode
} from "../packages/core/src/index";
import { MyWalletAdapter } from "../packages/adapters/mywallet/src/index";

// ─── Mock provider ──────────────────────────────────────────────────────────

interface MockMyWalletProvider {
  connect: () => Promise<string>;
  disconnect?: () => Promise<void>;
  signMessage?: (message: string) => Promise<{ signature: string }>;
  signAndSubmit?: (txJson: Record<string, unknown>) => Promise<{ hash: string; status: string }>;
}

function makeMockProvider(overrides: Partial<MockMyWalletProvider> = {}): MockMyWalletProvider {
  return {
    connect: async () => "rMockAddress1234",
    disconnect: async () => {},
    signMessage: async (message) => ({ signature: "mock-sig-" + message.slice(0, 4) }),
    signAndSubmit: async () => ({ hash: "ABCDEF1234567890", status: "tesSUCCESS" }),
    ...overrides
  };
}

const testNetwork = {
  id: "mainnet",
  name: "XRPL Mainnet",
  networkType: "MAINNET" as const,
  rpcUrl: "wss://xrplcluster.com",
  walletConnectChainId: "xrpl:0"
};

// ─── Contract ───────────────────────────────────────────────────────────────

test("MyWalletAdapter passes contract validation", () => {
  assertWalletAdapter(new MyWalletAdapter({ provider: makeMockProvider() }));
});

// ─── isAvailable ────────────────────────────────────────────────────────────

test("isAvailable returns true when provider is injected", async () => {
  const adapter = new MyWalletAdapter({ provider: makeMockProvider() });
  assert.equal(await adapter.isAvailable(), true);
});

test("isAvailable returns false when provider is missing", async () => {
  const adapter = new MyWalletAdapter({ provider: undefined });
  assert.equal(await adapter.isAvailable(), false);
});

// ─── connect ────────────────────────────────────────────────────────────────

test("connect returns account with correct address", async () => {
  const adapter = new MyWalletAdapter({ provider: makeMockProvider() });
  const result = await adapter.connect({ network: testNetwork });

  assert.equal(result.account.address, "rMockAddress1234");
  assert.equal(result.session?.adapterId, "mywallet");
  assert.ok(typeof result.session?.connectedAt === "number");
});

test("connect throws WALLET_NOT_AVAILABLE when provider is missing", async () => {
  const adapter = new MyWalletAdapter({ provider: undefined });

  await assert.rejects(
    () => adapter.connect({ network: testNetwork }),
    (error) => isWalletKitError(error) && error.code === WalletKitErrorCode.WALLET_NOT_AVAILABLE
  );
});

test("connect throws CONNECTION_REJECTED when user cancels", async () => {
  const provider = makeMockProvider({
    connect: async () => { throw new Error("User rejected the request"); }
  });
  const adapter = new MyWalletAdapter({ provider });

  await assert.rejects(
    () => adapter.connect({ network: testNetwork }),
    (error) => {
      // adapter should normalize this — either WALLET_KIT error or message contains rejected/canceled
      if (isWalletKitError(error)) return error.code === WalletKitErrorCode.CONNECTION_REJECTED;
      return /rejected|canceled|cancelled|denied/i.test((error as Error).message);
    }
  );
});

// ─── disconnect ─────────────────────────────────────────────────────────────

test("disconnect calls provider.disconnect and runs cleanup", async () => {
  let disconnectCalled = false;
  const provider = makeMockProvider({
    disconnect: async () => { disconnectCalled = true; }
  });
  const adapter = new MyWalletAdapter({ provider });

  await adapter.connect({ network: testNetwork });
  await adapter.disconnect();

  assert.equal(disconnectCalled, true);
});

test("disconnect does not throw when provider.disconnect is missing", async () => {
  const provider = makeMockProvider({ disconnect: undefined });
  const adapter = new MyWalletAdapter({ provider });

  await adapter.connect({ network: testNetwork });
  await assert.doesNotReject(() => adapter.disconnect());
});

// ─── restoreSession ─────────────────────────────────────────────────────────

test("restoreSession returns result when provider is available", async () => {
  const adapter = new MyWalletAdapter({ provider: makeMockProvider() });
  const session = {
    adapterId: "mywallet",
    account: { address: "rMockAddress1234", network: testNetwork },
    connectedAt: Date.now()
  };

  const result = await adapter.restoreSession(session);

  assert.ok(result !== null);
  assert.equal(result?.account.address, "rMockAddress1234");
});

test("restoreSession returns null when provider is missing", async () => {
  const adapter = new MyWalletAdapter({ provider: undefined });
  const session = {
    adapterId: "mywallet",
    account: { address: "rMockAddress1234", network: testNetwork },
    connectedAt: Date.now()
  };

  const result = await adapter.restoreSession(session);
  assert.equal(result, null);
});

// ─── signMessage ─────────────────────────────────────────────────────────────

test("signMessage returns signature", async () => {
  const adapter = new MyWalletAdapter({ provider: makeMockProvider() });
  const result = await adapter.signMessage({ message: "Login to My App" });

  assert.ok("signature" in result || "txBlob" in result || "raw" in result,
    "signMessage result must contain signature, txBlob, or raw");
});

test("signMessage throws when user rejects", async () => {
  const provider = makeMockProvider({
    signMessage: async () => { throw new Error("User denied message signature"); }
  });
  const adapter = new MyWalletAdapter({ provider });

  await assert.rejects(
    () => adapter.signMessage({ message: "Login" }),
    (error) => /rejected|denied|canceled|cancelled/i.test((error as Error).message)
      || isWalletKitError(error)
  );
});

// ─── signAndSubmit ───────────────────────────────────────────────────────────

test("signAndSubmit returns hash for Payment transaction", async () => {
  const adapter = new MyWalletAdapter({ provider: makeMockProvider() });

  const result = await adapter.signAndSubmit({
    methodHint: "payment",
    submit: true,
    txJson: {
      TransactionType: "Payment",
      Account: "rMockAddress1234",
      Destination: "rDestination",
      Amount: "1000000"
    }
  });

  assert.ok("hash" in result || "raw" in result,
    "signAndSubmit result must contain hash or raw");
});

test("signAndSubmit throws when user rejects", async () => {
  const provider = makeMockProvider({
    signAndSubmit: async () => { throw new Error("Transaction rejected by user"); }
  });
  const adapter = new MyWalletAdapter({ provider });

  await assert.rejects(
    () => adapter.signAndSubmit({
      methodHint: "payment",
      submit: true,
      txJson: { TransactionType: "Payment", Account: "rTest", Destination: "rDest", Amount: "1000" }
    }),
    (error) => /rejected|denied|canceled|cancelled/i.test((error as Error).message)
      || isWalletKitError(error)
  );
});
```

## Adapting for specific adapter types

### Extension adapter (GemWallet / Crossmark style)

- `provider` is `window.gemwallet` or `window.crossmarkSDK`
- Inject via constructor options for testability — `new GemWalletAdapter({ provider: mockGemWallet })`
- If adapter detects provider from `window` globally, need to set `(globalThis as any).gemwallet = mockProvider` before test

### Mobile / deeplink adapter (Xaman style)

- Test the happy path only with a mock that resolves immediately
- Recovery flow (PKCE redirect return) is hard to unit-test — cover in manual checklist instead
- `canRecoverSession` and `recoverSession` can be tested with a mock `localStorage` spy

### WalletConnect detail adapter

- Mock `SignClient` and `session` object
- Test that `disconnect` calls `client.disconnect({ topic })` and clears internal state
- Test that stale session (wrong address) returns `null` from `restoreSession`

### Hardware adapter (Ledger)

- Mock `@ledgerhq/hw-transport-webhid` and `@ledgerhq/hw-app-xrpl` entirely
- Test that `restoreSession` always returns `null` (hardware never auto-restores)
- Test that `parseLedgerError` maps status codes correctly: `0x6985` → rejected, `0x6804` → locked

## Important notes

- **Always include the contract test** (`assertWalletAdapter`) as the first test.
- **Test user rejection paths** — these must result in an error with `rejected`/`canceled` in the message, not a hanging promise.
- **Test missing provider** — `isAvailable()` must return `false` without throwing.
- **Do not import UI packages or WalletManager in adapter tests** — adapters are tested in isolation.
- The test runner is Node's built-in `node:test` — use `assert` from `node:assert/strict`. No `describe()` nesting needed unless grouping is useful.
