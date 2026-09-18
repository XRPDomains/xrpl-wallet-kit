import assert from "node:assert/strict";
import test from "node:test";
import { LedgerAdapter } from "../packages/adapters/ledger/src/index";
import { WalletKitErrorCode } from "../packages/core/src/index";

const network = {
  id: "mainnet",
  name: "XRPL Mainnet",
  networkType: "MAINNET",
  rpcUrl: "wss://xrplcluster.com",
  walletConnectChainId: "xrpl:0"
} as const;

test("Ledger returns a signer contribution for multisign sign-only requests", async () => {
  let multisignCalls = 0;
  const adapter = new LedgerAdapter({
    connectLedger: async () => ({
      address: "rLedgerAddress",
      publicKey: "ED".padEnd(66, "0"),
      signTransaction: async () => {
        return { txBlob: "SIGNED" };
      },
      signMultisignTransaction: async () => {
        multisignCalls += 1;
        return {
          txBlob: "MULTISIGNED",
          signed: true,
          raw: { signer: { Signer: { Account: "rLedgerAddress", SigningPubKey: "ED00", TxnSignature: "AA" } } }
        };
      }
    })
  });

  await adapter.connect({ network });

  const result = await adapter.signTransaction({
    txJson: {
      TransactionType: "Payment",
      Account: "rSourceAccount",
      SigningPubKey: ""
    }
  });

  assert.equal(result.txBlob, "MULTISIGNED");
  assert.equal(result.signed, true);
  assert.equal(multisignCalls, 1);
});

test("Ledger rejects multisign submission before delegating signing", async () => {
  let signCalls = 0;
  const adapter = new LedgerAdapter({
    connectLedger: async () => ({
      address: "rLedgerAddress",
      publicKey: "ED".padEnd(66, "0"),
      signTransaction: async () => {
        signCalls += 1;
        return { txBlob: "SIGNED" };
      }
    })
  });
  await adapter.connect({ network });

  await assert.rejects(
    () => adapter.signAndSubmit({ txJson: { TransactionType: "Payment", SigningPubKey: "" } }),
    (error) => {
      assert.equal((error as { code?: string }).code, WalletKitErrorCode.UNSUPPORTED_METHOD);
      return true;
    }
  );
  assert.equal(signCalls, 0);
});
