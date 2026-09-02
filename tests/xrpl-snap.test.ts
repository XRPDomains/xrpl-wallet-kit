import assert from "node:assert/strict";
import test from "node:test";
import { XrplSnapAdapter, type Eip1193Provider } from "../packages/adapters/xrpl-snap/src/index";
import { WalletKitErrorCode } from "../packages/core/src/index";

test("XRPL Snap is unavailable when provider does not support Snaps methods", async () => {
  const provider: Eip1193Provider = {
    request: async () => {
      throw { code: -32601, message: "the method wallet_getSnaps does not exist/is not available" };
    }
  };

  assert.equal(await new XrplSnapAdapter({ ethereum: provider }).isAvailable(), false);
});

test("XRPL Snap connect fails before requesting Snap install when Snaps are unavailable", async () => {
  const calls: unknown[] = [];
  const provider: Eip1193Provider = {
    request: async (args) => {
      calls.push(args);
      throw { code: -32601, message: "the method wallet_requestSnaps does not exist/is not available" };
    }
  };

  await assert.rejects(
    () => new XrplSnapAdapter({ ethereum: provider }).connect({}),
    (error) => {
      assert.equal((error as { code?: string }).code, WalletKitErrorCode.WALLET_NOT_AVAILABLE);
      assert.match(error.message, /MetaMask Snaps provider is not available/);
      return true;
    }
  );

  assert.deepEqual(calls, [{ method: "wallet_getSnaps" }]);
});

test("XRPL Snap does not trust a root provider that only exposes wallet_getSnaps", async () => {
  const previous = {
    ethereum: (globalThis as unknown as { ethereum?: Eip1193Provider }).ethereum,
    addEventListener: (globalThis as unknown as { addEventListener?: unknown }).addEventListener,
    removeEventListener: (globalThis as unknown as { removeEventListener?: unknown }).removeEventListener,
    dispatchEvent: (globalThis as unknown as { dispatchEvent?: unknown }).dispatchEvent
  };
  const calls: string[] = [];
  const rootProvider: Eip1193Provider = {
    isMetaMask: true,
    request: async (args) => {
      calls.push((args as { method?: string }).method ?? "unknown");
      if ((args as { method?: string }).method === "wallet_getSnaps") return {};
      throw { code: -32601, message: "the method wallet_requestSnaps does not exist/is not available" };
    }
  };
  const globals = globalThis as unknown as {
    ethereum?: Eip1193Provider;
    addEventListener?: (type: string, listener: EventListener) => void;
    removeEventListener?: (type: string, listener: EventListener) => void;
    dispatchEvent?: (event: Event) => boolean;
  };

  globals.ethereum = rootProvider;
  globals.addEventListener = () => undefined;
  globals.removeEventListener = () => undefined;
  globals.dispatchEvent = () => true;

  try {
    const adapter = new XrplSnapAdapter({ providerDiscoveryTimeoutMs: 0 });
    assert.equal(await adapter.isAvailable(), false);
    assert.deepEqual(calls, []);
  } finally {
    globals.ethereum = previous.ethereum;
    globals.addEventListener = previous.addEventListener as typeof globals.addEventListener;
    globals.removeEventListener = previous.removeEventListener as typeof globals.removeEventListener;
    globals.dispatchEvent = previous.dispatchEvent as typeof globals.dispatchEvent;
  }
});

test("XRPL Snap discovers MetaMask with EIP-6963 when another wallet owns window.ethereum", async () => {
  const previous = {
    ethereum: (globalThis as unknown as { ethereum?: Eip1193Provider }).ethereum,
    addEventListener: (globalThis as unknown as { addEventListener?: unknown }).addEventListener,
    removeEventListener: (globalThis as unknown as { removeEventListener?: unknown }).removeEventListener,
    dispatchEvent: (globalThis as unknown as { dispatchEvent?: unknown }).dispatchEvent
  };
  const okxProvider: Eip1193Provider = {
    request: async () => {
      throw { code: -32601, message: "the method wallet_getSnaps does not exist/is not available" };
    }
  };
  const metamaskCalls: unknown[] = [];
  const metamaskProvider: Eip1193Provider = {
    isMetaMask: true,
    request: async (args) => {
      metamaskCalls.push(args);
      const method = (args as { method?: string }).method;
      if (method === "wallet_getSnaps") return {};
      if (method === "wallet_requestSnaps") return {};
      if (method === "wallet_invokeSnap") return { account: "rSnapAddress" };
      throw new Error(`Unexpected method: ${method}`);
    }
  };
  const listeners = new Map<string, EventListener[]>();
  const globals = globalThis as unknown as {
    ethereum?: Eip1193Provider;
    addEventListener?: (type: string, listener: EventListener) => void;
    removeEventListener?: (type: string, listener: EventListener) => void;
    dispatchEvent?: (event: Event) => boolean;
  };

  globals.ethereum = okxProvider;
  globals.addEventListener = (type, listener) => {
    listeners.set(type, [...listeners.get(type) ?? [], listener]);
  };
  globals.removeEventListener = (type, listener) => {
    listeners.set(type, (listeners.get(type) ?? []).filter((item) => item !== listener));
  };
  globals.dispatchEvent = (event) => {
    if (event.type === "eip6963:requestProvider") {
      for (const listener of listeners.get("eip6963:announceProvider") ?? []) {
        listener({
          type: "eip6963:announceProvider",
          detail: {
            info: { rdns: "io.metamask", name: "MetaMask" },
            provider: metamaskProvider
          }
        } as Event);
      }
    }
    return true;
  };

  try {
    const adapter = new XrplSnapAdapter({ providerDiscoveryTimeoutMs: 0 });
    assert.equal(await adapter.isAvailable(), true);
    const result = await adapter.connect({});
    assert.equal(result.account.address, "rSnapAddress");
    assert.deepEqual(metamaskCalls.map((call) => (call as { method?: string }).method), [
      "wallet_requestSnaps",
      "wallet_invokeSnap"
    ]);
  } finally {
    globals.ethereum = previous.ethereum;
    globals.addEventListener = previous.addEventListener as typeof globals.addEventListener;
    globals.removeEventListener = previous.removeEventListener as typeof globals.removeEventListener;
    globals.dispatchEvent = previous.dispatchEvent as typeof globals.dispatchEvent;
  }
});

test("XRPL Snap ignores OKX providers that spoof isMetaMask", async () => {
  const previous = {
    ethereum: (globalThis as unknown as { ethereum?: Eip1193Provider }).ethereum,
    addEventListener: (globalThis as unknown as { addEventListener?: unknown }).addEventListener,
    removeEventListener: (globalThis as unknown as { removeEventListener?: unknown }).removeEventListener,
    dispatchEvent: (globalThis as unknown as { dispatchEvent?: unknown }).dispatchEvent
  };
  const okxCalls: string[] = [];
  const metamaskCalls: string[] = [];
  const okxProvider = {
    isMetaMask: true,
    isOkxWallet: true,
    request: async (args: unknown) => {
      okxCalls.push((args as { method?: string }).method ?? "unknown");
      throw { code: -32601, message: "the method wallet_requestSnaps does not exist/is not available" };
    }
  } as Eip1193Provider;
  const metamaskProvider: Eip1193Provider = {
    isMetaMask: true,
    request: async (args) => {
      const method = (args as { method?: string }).method;
      metamaskCalls.push(method ?? "unknown");
      if (method === "wallet_requestSnaps") return {};
      if (method === "wallet_invokeSnap") return { account: "rSnapAddress" };
      if (method === "wallet_getSnaps") return {};
      throw new Error(`Unexpected method: ${method}`);
    }
  };
  const listeners = new Map<string, EventListener[]>();
  const globals = globalThis as unknown as {
    ethereum?: Eip1193Provider;
    addEventListener?: (type: string, listener: EventListener) => void;
    removeEventListener?: (type: string, listener: EventListener) => void;
    dispatchEvent?: (event: Event) => boolean;
  };

  globals.ethereum = okxProvider;
  globals.addEventListener = (type, listener) => {
    listeners.set(type, [...listeners.get(type) ?? [], listener]);
  };
  globals.removeEventListener = (type, listener) => {
    listeners.set(type, (listeners.get(type) ?? []).filter((item) => item !== listener));
  };
  globals.dispatchEvent = (event) => {
    if (event.type === "eip6963:requestProvider") {
      for (const listener of listeners.get("eip6963:announceProvider") ?? []) {
        listener({
          type: "eip6963:announceProvider",
          detail: {
            info: { rdns: "io.metamask", name: "MetaMask" },
            provider: metamaskProvider
          }
        } as Event);
      }
    }
    return true;
  };

  try {
    const adapter = new XrplSnapAdapter({ providerDiscoveryTimeoutMs: 0 });
    assert.equal(await adapter.isAvailable(), true);
    const result = await adapter.connect({});
    assert.equal(result.account.address, "rSnapAddress");
    assert.ok(!okxCalls.includes("wallet_requestSnaps"));
    assert.ok(!okxCalls.includes("wallet_invokeSnap"));
    assert.ok(
      metamaskCalls.length === 0 || metamaskCalls.includes("wallet_requestSnaps"),
      "uses either the cached EIP-6963 MetaMask provider or the newly announced one"
    );
  } finally {
    globals.ethereum = previous.ethereum;
    globals.addEventListener = previous.addEventListener as typeof globals.addEventListener;
    globals.removeEventListener = previous.removeEventListener as typeof globals.removeEventListener;
    globals.dispatchEvent = previous.dispatchEvent as typeof globals.dispatchEvent;
  }
});

test("XRPL Snap finds a Snaps-capable provider in window.ethereum.providers without isMetaMask", async () => {
  const calls: string[] = [];
  const okxProvider: Eip1193Provider = {
    request: async (args) => {
      calls.push(`okx:${(args as { method?: string }).method ?? "unknown"}`);
      throw { code: -32601, message: "the method wallet_getSnaps does not exist/is not available" };
    }
  };
  const snapProvider: Eip1193Provider = {
    request: async (args) => {
      calls.push((args as { method?: string }).method ?? "unknown");
      const method = (args as { method?: string }).method;
      if (method === "wallet_getSnaps") return {};
      if (method === "wallet_requestSnaps") return {};
      if (method === "wallet_invokeSnap") return { account: "rSnapAddress" };
      throw new Error(`Unexpected method: ${method}`);
    }
  };
  const injected = Object.assign(okxProvider, { providers: [okxProvider, snapProvider] });

  const adapter = new XrplSnapAdapter({ ethereum: injected });
  assert.equal(await adapter.isAvailable(), true);
  const result = await adapter.connect({});
  assert.equal(result.account.address, "rSnapAddress");
  assert.ok(calls.includes("wallet_requestSnaps"));
  assert.ok(calls.includes("wallet_invokeSnap"));
  assert.ok(!calls.includes("okx:wallet_requestSnaps"));
});

test("XRPL Snap availability does not block MetaMask candidate when wallet_getSnaps is unavailable before connect", async () => {
  const calls: string[] = [];
  const provider: Eip1193Provider = {
    isMetaMask: true,
    _metamask: {},
    request: async (args) => {
      const method = (args as { method?: string }).method;
      calls.push(method ?? "unknown");
      if (method === "wallet_getSnaps") {
        throw { code: -32601, message: "wallet_getSnaps is not available yet" };
      }
      if (method === "wallet_requestSnaps") return {};
      if (method === "wallet_invokeSnap") return { account: "rSnapAddress" };
      throw new Error(`Unexpected method: ${method}`);
    }
  };
  const adapter = new XrplSnapAdapter({ ethereum: provider });

  assert.equal(await adapter.isAvailable(), true);
  const result = await adapter.connect({});
  assert.equal(result.account.address, "rSnapAddress");
  assert.deepEqual(calls, ["wallet_getSnaps", "wallet_getSnaps", "wallet_requestSnaps", "wallet_invokeSnap"]);
});

test("XRPL Snap retries transient keyring hydration after first install", async () => {
  const calls: string[] = [];
  let invokeAttempts = 0;
  const provider: Eip1193Provider = {
    isMetaMask: true,
    _metamask: {},
    request: async (args) => {
      const method = (args as { method?: string }).method;
      calls.push(method ?? "unknown");
      if (method === "wallet_getSnaps") return {};
      if (method === "wallet_requestSnaps") return {};
      if (method === "wallet_invokeSnap") {
        invokeAttempts += 1;
        if (invokeAttempts === 1) {
          throw { code: -32602, message: "KeyringController - Keyring not found." };
        }
        return { account: "rSnapAddress" };
      }
      throw new Error(`Unexpected method: ${method}`);
    }
  };

  const result = await new XrplSnapAdapter({ ethereum: provider, snapRequestRetryDelaysMs: [0] }).connect({});

  assert.equal(result.account.address, "rSnapAddress");
  assert.equal(invokeAttempts, 2);
  assert.deepEqual(calls, ["wallet_getSnaps", "wallet_requestSnaps", "wallet_invokeSnap", "wallet_invokeSnap"]);
});

test("XRPL Snap can reuse a previously announced EIP-6963 MetaMask provider", async () => {
  const previous = {
    ethereum: (globalThis as unknown as { ethereum?: Eip1193Provider }).ethereum,
    addEventListener: (globalThis as unknown as { addEventListener?: unknown }).addEventListener,
    dispatchEvent: (globalThis as unknown as { dispatchEvent?: unknown }).dispatchEvent
  };
  const okxProvider: Eip1193Provider = {
    request: async () => {
      throw { code: -32601, message: "the method wallet_getSnaps does not exist/is not available" };
    }
  };
  const metamaskProvider: Eip1193Provider = {
    isMetaMask: true,
    request: async (args) => {
      const method = (args as { method?: string }).method;
      if (method === "wallet_getSnaps") return {};
      throw new Error(`Unexpected method: ${method}`);
    }
  };
  const listeners = new Map<string, EventListener[]>();
  const globals = globalThis as unknown as {
    ethereum?: Eip1193Provider;
    addEventListener?: (type: string, listener: EventListener) => void;
    dispatchEvent?: (event: Event) => boolean;
  };

  globals.ethereum = okxProvider;
  globals.addEventListener = (type, listener) => {
    listeners.set(type, [...listeners.get(type) ?? [], listener]);
  };
  globals.dispatchEvent = (event) => {
    if (event.type === "eip6963:requestProvider") {
      for (const listener of listeners.get("eip6963:announceProvider") ?? []) {
        listener({
          type: "eip6963:announceProvider",
          detail: {
            info: { rdns: "io.metamask", name: "MetaMask" },
            provider: metamaskProvider
          }
        } as Event);
      }
    }
    return true;
  };

  try {
    assert.equal(await new XrplSnapAdapter({ providerDiscoveryTimeoutMs: 0 }).isAvailable(), true);
    globals.dispatchEvent = () => true;
    assert.equal(await new XrplSnapAdapter({ providerDiscoveryTimeoutMs: 0 }).isAvailable(), true);
  } finally {
    globals.ethereum = previous.ethereum;
    globals.addEventListener = previous.addEventListener as typeof globals.addEventListener;
    globals.dispatchEvent = previous.dispatchEvent as typeof globals.dispatchEvent;
  }
});

test("XRPL Snap signMessage prefers the native xrpl_signMessage method", async () => {
  const calls: unknown[] = [];
  const provider: Eip1193Provider = {
    request: async (args) => {
      calls.push(args);
      if ((args as { method?: string }).method === "wallet_getSnaps") return {};
      const request = ((args as { params?: { request?: { method?: string } } }).params?.request);
      if (request?.method === "xrpl_signMessage") return { signature: "SNAP_SIGNATURE" };
      throw new Error(`Unexpected method: ${request?.method}`);
    }
  };

  const result = await new XrplSnapAdapter({ ethereum: provider }).signMessage({
    message: "hello",
    account: { address: "rSnapAddress", publicKey: "PUBKEY" }
  });

  assert.equal(result.signatureKind, "signature");
  assert.equal(result.proof, "SNAP_SIGNATURE");
  assert.equal(result.signature, "SNAP_SIGNATURE");
  assert.equal(result.txBlob, undefined);
  assert.deepEqual(
    calls
      .map((call) => (call as { params?: { request?: { method?: string } } }).params?.request?.method)
      .filter(Boolean),
    ["xrpl_signMessage"]
  );
});

test("XRPL Snap signAndSubmit rejects non-success ledger results even when a hash is present", async () => {
  const provider: Eip1193Provider = {
    request: async (args) => {
      if ((args as { method?: string }).method === "wallet_getSnaps") return {};
      return {
        result: {
          engine_result: "tecUNFUNDED_PAYMENT",
          engine_result_message: "Insufficient XRP balance",
          tx_json: { hash: "REJECTED_HASH" }
        }
      };
    }
  };

  await assert.rejects(
    () => new XrplSnapAdapter({ ethereum: provider }).signAndSubmit({
      methodHint: "payment",
      submit: true,
      txJson: { TransactionType: "Payment" }
    }),
    (error) => {
      assert.equal((error as { code?: string }).code, WalletKitErrorCode.SIGN_FAILED);
      return true;
    }
  );
});

test("XRPL Snap signAndSubmit reports a short user-safe error for long snap failures", async () => {
  const provider: Eip1193Provider = {
    request: async (args) => {
      if ((args as { method?: string }).method === "wallet_getSnaps") return {};
      throw new Error(`Snap failed: ${JSON.stringify({ error: "unsupported", data: "x".repeat(900) })}`);
    }
  };

  await assert.rejects(
    () => new XrplSnapAdapter({ ethereum: provider }).signAndSubmit({
      methodHint: "payment",
      submit: true,
      txJson: { TransactionType: "Payment" }
    }),
    (error) => {
      assert.equal((error as { code?: string }).code, WalletKitErrorCode.UNSUPPORTED_METHOD);
      assert.ok(error.message.length < 120);
      assert.doesNotMatch(error.message, /x{80}/);
      return true;
    }
  );
});

test("XRPL Snap signMessage keeps aggregate snap errors out of the display message", async () => {
  const provider: Eip1193Provider = {
    request: async (args) => {
      if ((args as { method?: string }).method === "wallet_getSnaps") return {};
      throw new Error(`method failed ${"details ".repeat(100)}`);
    }
  };

  await assert.rejects(
    () => new XrplSnapAdapter({ ethereum: provider, signMessageMethods: ["xrpl_sign", "xrpl_signTransaction"] }).signMessage({
      message: "hello",
      account: { address: "rSnapAddress" }
    }),
    (error) => {
      assert.equal((error as { code?: string }).code, WalletKitErrorCode.SIGN_FAILED);
      assert.match(error.message, /XRPL Snap could not sign the message/);
      assert.ok(error.message.length < 100);
      assert.doesNotMatch(error.message, /xrpl_signTransaction/);
      return true;
    }
  );
});
