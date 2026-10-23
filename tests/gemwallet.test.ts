import assert from "node:assert/strict";
import test from "node:test";
import { GemWalletAdapter, type GemWalletProvider } from "../packages/adapters/gemwallet/src/index";
import { XAHAU_MAINNET } from "../packages/xahau/src/networks";
import { createLazyXahauProtocol } from "../packages/xahau/src/lazy";
import { createXahauProtocol } from "../packages/xahau/src/index";
import { XRPL_MAINNET } from "../packages/core/src/index";
import { Wallet, decode } from "xrpl";
import { sign } from "ripple-keypairs";
import { XrplDefinitions, encodeForSigning } from "xahau-binary-codec";
import definitionsData from "xahau-binary-codec/dist/enums/definitions.json" with { type: "json" };

test("GemWallet advertises only transaction modes supplied by an injected provider", () => {
  const submitOnly = new GemWalletAdapter({ provider: { sendPayment: async () => ({}) }, supportedChains: { families: ["xrpl"] } });
  assert.equal(submitOnly.capabilities.signTransaction, false);
  assert.deepEqual(submitOnly.capabilities.details?.transactionModes, ["sign-and-submit"]);
  assert.equal(new GemWalletAdapter().capabilities.signTransaction, true);
});

test("GemWallet XRPL sign-only enforces a documented configurable fee limit without submitting", async () => {
  const wallet = Wallet.generate();
  const provider: GemWalletProvider = {
    isInstalled: async () => true,
    getAddress: async () => ({ result: { address: wallet.address } }),
    getPublicKey: async () => ({ result: { address: wallet.address, publicKey: wallet.publicKey } }),
    signTransaction: async (payload: any) => ({ result: { signature: wallet.sign({ ...payload.transaction,
      Fee: "1500000", Sequence: 1, LastLedgerSequence: 100 } as never).tx_blob } })
  };
  const adapter = new GemWalletAdapter({ provider });
  await adapter.connect({ network: XRPL_MAINNET });
  const request = { txJson: { TransactionType: "Payment", Destination: Wallet.generate().address, Amount: "1" } };
  await assert.rejects(adapter.signTransaction(request), /XRP fee limit/);
  const signed = await adapter.signTransaction({ ...request, maxFeeDrops: "2000000" });
  assert.equal(decode(signed.txBlob!).Fee, "1500000");
  const strict = new GemWalletAdapter({ provider, xrplMaxFeeDrops: "100" });
  await strict.connect({ network: XRPL_MAINNET });
  await assert.rejects(strict.signTransaction({ ...request, maxFeeDrops: "2000000" }), /XRP fee limit/);
});

test("GemWallet URITokenBuy accepts bounded autofilled expiry only, preserving the free offer amount", async () => {
  const wallet = Wallet.generate();
  const definitions = new XrplDefinitions(structuredClone(definitionsData));
  let extension = 3;
  let mutateAmount = false;
  let submissions = 0;
  const protocol = createXahauProtocol({ request: async (_network, method) => {
    if (method === "server_info") return { info: { network_id: 21337, validated_ledger: { seq: 26631218, age: 1 } } };
    if (method === "account_info") return { account_data: { Account: wallet.address, Sequence: 1 } };
    if (method === "fee") return { drops: { base_fee: "10", open_ledger_fee: "10" } };
    if (method === "submit") { submissions++; return { engine_result: "tesSUCCESS" }; }
    throw new Error(`Unexpected RPC: ${method}`);
  } });
  const provider: GemWalletProvider = {
    isInstalled: async () => true,
    getAddress: async () => ({ result: { address: wallet.address } }),
    getPublicKey: async () => ({ result: { address: wallet.address, publicKey: wallet.publicKey } }),
    getNetwork: async () => ({ result: { chain: "XAHAU", network: "Mainnet" } }),
    signTransaction: async (payload: any) => {
      const tx = payload.transaction;
      tx.LastLedgerSequence += extension;
      if (mutateAmount) tx.Amount = "1";
      const signed = { ...tx, TxnSignature: sign(encodeForSigning(tx, definitions), wallet.privateKey) };
      return { result: { signature: protocol.encode(signed) } };
    }
  };
  const adapter = new GemWalletAdapter({ provider, supportedChains: { families: ["xahau"] } });
  const context = { network: XAHAU_MAINNET, protocol };
  await adapter.connect({ network: XAHAU_MAINNET, protocolContext: context });
  const request = { txJson: { TransactionType: "URITokenBuy", URITokenID: "AB".repeat(32), Amount: "0" }, maxFeeDrops: "50000" };
  const signed = await adapter.signTransaction(request);
  assert.equal(protocol.decode(signed.txBlob!).LastLedgerSequence, 26631241);
  assert.equal(protocol.decode(signed.txBlob!).Amount, "0");
  assert.equal(submissions, 0);
  await adapter.signAndSubmit(request);
  assert.equal(submissions, 1);
  await assert.rejects(adapter.signAndSubmit({ ...request, txJson: { ...request.txJson, LastLedgerSequence: 26631238 } }), /LastLedgerSequence/);
  mutateAmount = true;
  await assert.rejects(adapter.signAndSubmit(request), /Amount/);
  assert.equal(request.txJson.Amount, "0");
  mutateAmount = false;
  extension = 51;
  await assert.rejects(adapter.signAndSubmit(request), /LastLedgerSequence/);
  extension = 31;
  await assert.rejects(adapter.signAndSubmit(request), /expiry is outside/);
  extension = 3;
  const strict = new GemWalletAdapter({ provider, supportedChains: { families: ["xahau"] }, maxLastLedgerSequenceExtension: 0 });
  await strict.connect({ network: XAHAU_MAINNET, protocolContext: context });
  await assert.rejects(strict.signAndSubmit(request), /LastLedgerSequence/);
  assert.equal(submissions, 1);
});

test("GemWallet Xahau message signing uses the native signature API without submitting", async () => {
  const wallet = Wallet.generate();
  const provider: GemWalletProvider = {
    isInstalled: async () => true,
    getAddress: async () => ({ result: { address: wallet.address } }),
    getPublicKey: async () => ({ result: { address: wallet.address, publicKey: wallet.publicKey } }),
    getNetwork: async () => ({ result: { chain: "XAHAU", network: "Mainnet" } }),
    signMessage: async message => { assert.equal(message, "Network: xahau-mainnet"); return { result: { signedMessage: "native-proof" } }; }
  };
  const adapter = new GemWalletAdapter({ provider, supportedChains: { families: ["xahau"] } });
  await adapter.connect({ network: XAHAU_MAINNET, protocolContext: { network: XAHAU_MAINNET, protocol: createLazyXahauProtocol() } });
  const result = await adapter.signMessage({ message: "Network: xahau-mainnet" });
  assert.equal(result.signatureKind, "signature");
  assert.equal(result.signature, "native-proof");
  assert.equal(result.publicKey, wallet.publicKey);
});

test("GemWallet reads Xahau network after address/key approval, not while authorization is pending", async () => {
  let release!: () => void;
  const approval = new Promise<void>(resolve => { release = resolve; });
  const calls: string[] = [];
  let chain = "XRPL";
  const provider: GemWalletProvider = {
    isInstalled: async () => true,
    getAddress: async () => { calls.push("address"); await approval; return { result: { address: "rGemAddress" } }; },
    getPublicKey: async () => {
      calls.push("publicKey"); chain = "XAHAU";
      return { result: { address: "rGemAddress", publicKey: "EDGEMPUBLICKEY" } };
    },
    getNetwork: async () => { calls.push("network"); return { result: { chain, network: "Mainnet" } }; }
  };
  const adapter = new GemWalletAdapter({ provider, supportedChains: { families: ["xrpl", "xahau"] } });
  const connecting = adapter.connect({ network: XAHAU_MAINNET, protocolContext: { network: XAHAU_MAINNET, protocol: createLazyXahauProtocol() } });
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(calls, ["address"]);
  release();
  const connected = await connecting;
  assert.equal(connected.account.network?.id, "xahau-mainnet");
  assert.deepEqual(calls, ["address", "publicKey", "network"]);
  await adapter.disconnect();
});

test("GemWallet still rejects genuine chain mismatch and cannot activate a cancelled connection", async () => {
  let networkCalls = 0;
  const provider: GemWalletProvider = {
    isInstalled: async () => true,
    getAddress: async () => ({ result: { address: "rGemAddress" } }),
    getNetwork: async () => { networkCalls++; return { result: { chain: "XRPL", network: "Mainnet" } }; }
  };
  const adapter = new GemWalletAdapter({ provider, supportedChains: { families: ["xrpl", "xahau"] } });
  const options = { network: XAHAU_MAINNET, protocolContext: { network: XAHAU_MAINNET, protocol: createLazyXahauProtocol() } };
  await assert.rejects(adapter.connect(options), (error: any) => {
    assert.equal(error.code, "NETWORK_MISMATCH");
    assert.equal(error.details.expected, "XAHAU/Mainnet");
    assert.equal(error.details.actual, "XRPL/Mainnet");
    return true;
  });
  const controller = new AbortController();
  provider.getAddress = async () => { controller.abort(); return { result: { address: "rGemAddress" } }; };
  await assert.rejects(adapter.connect({ ...options, signal: controller.signal }));
  assert.equal(networkCalls, 1);
  await adapter.disconnect();
});

test("GemWallet treats rejected Xahau metadata as unreported, without retries or a verified-network claim", async () => {
  let reads = 0;
  let approvals = 0;
  const provider: GemWalletProvider = {
    isInstalled: async () => true,
    getAddress: async () => { approvals++; return { result: { address: "rGemAddress" } }; },
    getNetwork: async () => { reads++; return { type: "reject" }; }
  };
  const adapter = new GemWalletAdapter({ provider, supportedChains: { families: ["xahau"] } });
  const options = { network: XAHAU_MAINNET, protocolContext: { network: XAHAU_MAINNET, protocol: createLazyXahauProtocol() } };
  const connected = await adapter.connect(options);
  assert.equal(connected.account.network?.id, "xahau-mainnet");
  assert.equal(connected.session?.metadata?.networkSource, "configured-preset");
  assert.equal(connected.session?.metadata?.providerNetworkAvailable, false);
  assert.equal(reads, 1);
  assert.equal(approvals, 1);
  await adapter.disconnect();
  const xrpl = new GemWalletAdapter({ provider, supportedChains: { families: ["xrpl"] } });
  await assert.rejects(xrpl.connect({ network: XRPL_MAINNET }), (error: any) => {
    assert.equal(error.code, "CONNECTION_FAILED");
    assert.equal(error.details.providerMethod, "getNetwork");
    assert.equal(error.details.response.type, "reject");
    return true;
  });
  assert.equal(reads, 2);
  const controller = new AbortController();
  provider.getNetwork = async () => { reads++; controller.abort(); return { type: "reject" }; };
  await assert.rejects(adapter.connect({ ...options, signal: controller.signal }));
  assert.equal(reads, 3);
  await adapter.disconnect();
  await xrpl.disconnect();
});

test("GemWallet Xahau avoids repeated approval getters while verifying blobs and cancelled requests", async () => {
  const wallet = Wallet.generate();
  let changedNetwork = false;
  let submissions = 0;
  let signingCalls = 0;
  let rpcNetwork = 21337;
  const reads = { address: 0, publicKey: 0, network: 0 };
  const controller = new AbortController();
  let cancelSigning = false;
  const protocol = createXahauProtocol({ request: async (_network, method) => {
    if (method === "server_info") return { info: { network_id: rpcNetwork, validated_ledger: { seq: 100, age: 1 } } };
    if (method === "account_info") return { account_data: { Account: wallet.address, Sequence: 1 }, queue_data: { txn_count: 0 } };
    if (method === "fee") return { drops: { base_fee: "10", open_ledger_fee: "10" } };
    if (method === "submit") { submissions++; return { engine_result: "tesSUCCESS" }; }
    throw new Error(`Unexpected RPC ${method}`);
  } });
  const provider: GemWalletProvider = {
    isInstalled: async () => true,
    getAddress: async () => { reads.address++; return { result: { address: wallet.address } }; },
    getPublicKey: async () => { reads.publicKey++; return { result: { address: wallet.address, publicKey: wallet.publicKey } }; },
    getNetwork: async () => { reads.network++; return { type: "reject" }; },
    signTransaction: async payload => {
      signingCalls++;
      if (cancelSigning) controller.abort();
      const tx = (payload as { transaction: Record<string, unknown> }).transaction;
      return { result: { signature: wallet.sign({ ...tx, ...(changedNetwork ? { NetworkID: 21338 } : {}) } as never).tx_blob } };
    }
  };
  const adapter = new GemWalletAdapter({ provider, supportedChains: { families: ["xahau"] } });
  await adapter.connect({ network: XAHAU_MAINNET, protocolContext: { network: XAHAU_MAINNET, protocol } });
  const request = { txJson: { TransactionType: "Payment", Destination: Wallet.generate().address, Amount: "1" }, maxFeeDrops: "100" };
  const signed = await adapter.signTransaction(request);
  assert.equal(decode(signed.txBlob).NetworkID, 21337);
  assert.equal(submissions, 0);
  await adapter.signAndSubmit(request);
  assert.equal(signingCalls, 2);
  assert.equal(submissions, 1);
  assert.deepEqual(reads, { address: 1, publicKey: 1, network: 1 });
  changedNetwork = true;
  await assert.rejects(adapter.signAndSubmit(request), { code: "SIGN_FAILED" });
  assert.equal(submissions, 1);
  rpcNetwork = 21338;
  await assert.rejects(adapter.signTransaction(request), { code: "NETWORK_MISMATCH" });
  assert.equal(signingCalls, 3);
  assert.equal(submissions, 1);
  rpcNetwork = 21337;
  changedNetwork = false;
  cancelSigning = true;
  await assert.rejects(adapter.signAndSubmit({ ...request, signal: controller.signal }));
  assert.equal(signingCalls, 4);
  assert.equal(submissions, 1);
  assert.deepEqual(reads, { address: 1, publicKey: 1, network: 1 });
  await adapter.disconnect();
});

test("GemWallet payment converts XRPL txJson to sendPayment camelCase payload", async () => {
  let capturedPayload: unknown;
  const provider: GemWalletProvider = {
    sendPayment: async (payload) => {
      capturedPayload = payload;
      return { result: { hash: "ABC" } };
    }
  };

  await new GemWalletAdapter({ provider }).signAndSubmit({
    methodHint: "payment",
    submit: true,
    txJson: {
      TransactionType: "Payment",
      Account: "rSender",
      Destination: "rDestination",
      Amount: "1000000",
      DestinationTag: 123,
      Memos: [
        {
          Memo: {
            MemoData: "74657374",
            MemoType: "74657874"
          }
        }
      ]
    }
  });

  assert.deepEqual(capturedPayload, {
    amount: "1000000",
    destination: "rDestination",
    destinationTag: 123,
    memos: [
      {
        memo: {
          memoData: "74657374",
          memoType: "74657874"
        }
      }
    ]
  });
});

test("GemWallet payment preserves explicit walletPayload override", async () => {
  let capturedPayload: unknown;
  const provider: GemWalletProvider = {
    sendPayment: async (payload) => {
      capturedPayload = payload;
      return { result: { hash: "ABC" } };
    }
  };
  const walletPayload = { amount: "12", destination: "rCustom" };

  await new GemWalletAdapter({ provider }).signAndSubmit({
    methodHint: "payment",
    submit: true,
    txJson: {
      TransactionType: "Payment",
      Destination: "rDestination",
      Amount: "1000000"
    },
    walletPayload
  });

  assert.equal(capturedPayload, walletPayload);
});

test("GemWallet burnNFT routes NFTokenBurn txJson to burnNFT payload", async () => {
  let capturedPayload: unknown;
  const provider: GemWalletProvider = {
    burnNFT: async (payload) => {
      capturedPayload = payload;
      return { result: { hash: "BURN" } };
    }
  };

  const result = await new GemWalletAdapter({ provider }).signAndSubmit({
    submit: true,
    txJson: {
      TransactionType: "NFTokenBurn",
      Account: "rSender",
      NFTokenID: "00080000ABC",
      Owner: "rOwner"
    }
  });

  assert.equal(result.hash, "BURN");
  assert.deepEqual(capturedPayload, {
    NFTokenID: "00080000ABC",
    owner: "rOwner"
  });
});

test("GemWallet burnNFT methodHint preserves explicit walletPayload override", async () => {
  let capturedPayload: unknown;
  const provider: GemWalletProvider = {
    burnNFT: async (payload) => {
      capturedPayload = payload;
      return { result: { hash: "BURN" } };
    }
  };
  const walletPayload = { NFTokenID: "CUSTOM", owner: "rOwner" };

  await new GemWalletAdapter({ provider }).signAndSubmit({
    methodHint: "burnNFT",
    submit: true,
    txJson: {
      TransactionType: "NFTokenBurn",
      NFTokenID: "00080000ABC"
    },
    walletPayload
  });

  assert.equal(capturedPayload, walletPayload);
});

test("GemWallet TrustSet routes to setTrustline with GemWallet payload shape", async () => {
  let capturedPayload: unknown;
  const provider: GemWalletProvider = {
    setTrustline: async (payload) => {
      capturedPayload = payload;
      return { result: { hash: "TRUST" } };
    }
  };

  const result = await new GemWalletAdapter({ provider }).signAndSubmit({
    submit: true,
    txJson: {
      TransactionType: "TrustSet",
      Account: "rSender",
      LimitAmount: {
        currency: "USD",
        issuer: "rIssuer",
        value: "100"
      },
      Flags: 131072,
      QualityIn: 1,
      QualityOut: 2,
      LastLedgerSequence: 12345,
      Memos: [
        {
          Memo: {
            MemoData: "7472757374"
          }
        }
      ]
    }
  });

  assert.equal(result.hash, "TRUST");
  assert.deepEqual(capturedPayload, {
    limitAmount: {
      currency: "USD",
      issuer: "rIssuer",
      value: "100"
    },
    qualityIn: 1,
    qualityOut: 2,
    flags: 131072,
    lastLedgerSequence: 12345,
    memos: [
      {
        memo: {
          memoData: "7472757374"
        }
      }
    ]
  });
});

test("GemWallet TrustSet accepts legacy trustset hint and walletPayload override", async () => {
  let capturedPayload: unknown;
  const provider: GemWalletProvider = {
    setTrustline: async (payload) => {
      capturedPayload = payload;
      return { result: { hash: "TRUST" } };
    }
  };
  const walletPayload = {
    limitAmount: {
      currency: "EUR",
      issuer: "rIssuer",
      value: "0"
    }
  };

  await new GemWalletAdapter({ provider }).signAndSubmit({
    methodHint: "trustset" as never,
    submit: true,
    txJson: {
      TransactionType: "TrustSet",
      LimitAmount: {
        currency: "USD",
        issuer: "rIssuer",
        value: "100"
      }
    },
    walletPayload
  });

  assert.equal(capturedPayload, walletPayload);
});

test("GemWallet TrustSet falls back to deprecated addTrustline provider method", async () => {
  let capturedPayload: unknown;
  const provider: GemWalletProvider = {
    addTrustline: async (payload) => {
      capturedPayload = payload;
      return { result: { hash: "TRUST_OLD" } };
    }
  };

  const result = await new GemWalletAdapter({ provider }).signAndSubmit({
    methodHint: "trustSet",
    submit: true,
    txJson: {
      TransactionType: "TrustSet",
      LimitAmount: {
        currency: "USD",
        issuer: "rIssuer",
        value: "100"
      }
    }
  });

  assert.equal(result.hash, "TRUST_OLD");
  assert.deepEqual(capturedPayload, {
    limitAmount: {
      currency: "USD",
      issuer: "rIssuer",
      value: "100"
    }
  });
});

test("GemWallet connect and signMessage include publicKey when provider exposes it", async () => {
  const provider: GemWalletProvider = {
    isInstalled: async () => ({ result: { isInstalled: true } }),
    getAddress: async () => ({ result: { address: "rGemAddress" } }),
    getPublicKey: async () => ({ result: { address: "rGemAddress", publicKey: "EDGEMPUBLICKEY" } }),
    signMessage: async () => ({ result: { signedMessage: "GEM_SIGNATURE" } })
  };
  const adapter = new GemWalletAdapter({ provider });
  const connected = await adapter.connect({});

  assert.equal(connected.account.publicKey, "EDGEMPUBLICKEY");

  const signed = await adapter.signMessage({
    message: "Login",
    account: connected.account
  });

  assert.equal(signed.signatureKind, "signature");
  assert.equal(signed.proof, "GEM_SIGNATURE");
  assert.equal(signed.publicKey, "EDGEMPUBLICKEY");
});

test("GemWallet signMessage fetches publicKey when request account does not have it", async () => {
  const provider: GemWalletProvider = {
    getPublicKey: async () => ({ result: { address: "rGemAddress", publicKey: "EDGEMPUBLICKEY" } }),
    signMessage: async () => ({ result: { signedMessage: "GEM_SIGNATURE" } })
  };

  const signed = await new GemWalletAdapter({ provider }).signMessage({
    message: "Login",
    account: { address: "rGemAddress" }
  });

  assert.equal(signed.publicKey, "EDGEMPUBLICKEY");
});
