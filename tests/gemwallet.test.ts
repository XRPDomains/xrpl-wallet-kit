import assert from "node:assert/strict";
import test from "node:test";
import { GemWalletAdapter, type GemWalletProvider } from "../packages/adapters/gemwallet/src/index";

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
