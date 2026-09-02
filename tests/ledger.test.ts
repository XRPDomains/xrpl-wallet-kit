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

test("Ledger rejects multisign transaction shapes before delegating signing", async () => {
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
    () => adapter.signTransaction({
      txJson: {
        TransactionType: "Payment",
        Account: "rLedgerAddress",
        SigningPubKey: "",
        Signers: []
      }
    }),
    (error) => {
      assert.equal((error as { code?: string }).code, WalletKitErrorCode.UNSUPPORTED_METHOD);
      return true;
    }
  );
  assert.equal(signCalls, 0);
});
