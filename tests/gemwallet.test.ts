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

