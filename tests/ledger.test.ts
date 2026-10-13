import assert from "node:assert/strict";
import test from "node:test";
import { LedgerAdapter } from "../packages/adapters/ledger/src/index";
import { WalletKitErrorCode } from "../packages/core/src/index";
import { Client, decode, Wallet, encodeForMultiSigning, verifyKeypairSignature } from "xrpl";

const network = {
  id: "mainnet",
  name: "XRPL Mainnet",
  networkType: "MAINNET",
  rpcUrl: "wss://xrplcluster.com",
  walletConnectChainId: "xrpl:0"
} as const;

test("Ledger disconnect invalidates pending connection and account discovery", async () => {
  let finish!: (session: { address: string; signTransaction(): Promise<{ txBlob: string }> }) => void;
  const adapter = new LedgerAdapter({ connectLedger: () => new Promise(resolve => { finish = resolve; }) });
  const connecting = adapter.connect({ network });
  await adapter.disconnect();
  finish({ address: "late", signTransaction: async () => ({ txBlob: "late" }) });
  await assert.rejects(connecting, { code: WalletKitErrorCode.NOT_CONNECTED });
  await assert.rejects(adapter.signTransaction({ txJson: {} }), { code: WalletKitErrorCode.NOT_CONNECTED });
  await assert.rejects(adapter.getAccounts(-1), { code: WalletKitErrorCode.INVALID_REQUEST });
  await assert.rejects(adapter.getAccounts(1, 0x80000000), { code: WalletKitErrorCode.INVALID_REQUEST });
  assert.deepEqual(await adapter.getAccounts(0), []);
  (adapter as unknown as { xrp: unknown }).xrp = { getAddress: async () => {
    await adapter.disconnect();
    return { address: "stale", publicKey: "stale" };
  } };
  await assert.rejects(adapter.getAccounts(1), { code: WalletKitErrorCode.NOT_CONNECTED });
});

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

test("Ledger default signing sets canonical bit, preserves flags and does not submit sign-only", async (t) => {
  const wallet = Wallet.generate("ecdsa-secp256k1");
  const source = wallet.address;
  const destination = "rLhi87aSCyNW88tW4632yLiwinbghFZNue";
  let flags = 0;
  let submits = 0;
  let deviceFailure = false;
  let invalidSignature = false;
  let disconnectDuringSign = false;
  let rpcError: Error | undefined;
  const payment = { TransactionType: "Payment", Account: source, Destination: destination, Amount: "10000", DestinationTag: 0 };
  t.mock.method(Client.prototype, "connect", async () => {});
  t.mock.method(Client.prototype, "disconnect", async () => {});
  t.mock.method(Client.prototype, "autofill", async (tx: Record<string, unknown>) => {
    if (rpcError) throw rpcError;
    return { ...tx, Flags: flags, Fee: "12", Sequence: 7, LastLedgerSequence: 100 };
  });
  t.mock.method(Client.prototype, "submitAndWait", async () => {
    submits++;
    return { result: { hash: "TEST_HASH", meta: { TransactionResult: "tesSUCCESS" } } };
  });
  type DeviceHarness = {
    signWithDefaultLedger(tx: unknown, submit?: boolean): Promise<{ txBlob?: string }>;
    signMultisignWithDefaultLedger(tx: unknown): Promise<{ txBlob?: string }>;
    xrp: { signTransaction(path: string, blob: string): Promise<string> };
  };
  const adapter = new LedgerAdapter({ connectLedger: async () => ({
    address: source,
    publicKey: wallet.publicKey,
    appVersion: "2.3.2",
    signTransaction: (tx, submit) => (adapter as unknown as DeviceHarness).signWithDefaultLedger(tx, submit),
    signMultisignTransaction: tx => (adapter as unknown as DeviceHarness).signMultisignWithDefaultLedger(tx)
  }) });
  await adapter.connect({ network });
  (adapter as unknown as DeviceHarness).xrp = { signTransaction: async (_path, blob) => {
    const tx = decode(blob);
    if (tx.SigningPubKey !== "") assert.equal(tx.Flags, (flags | 0x80000000) >>> 0);
    assert.equal(tx.Destination, destination);
    assert.equal(tx.Amount, "10000");
    assert.equal(tx.DestinationTag, 0);
    if (deviceFailure) throw Object.assign(new Error("Missing critical parameter (0x6800)"), { statusCode: 0x6800 });
    if (disconnectDuringSign) await adapter.disconnect();
    if (invalidSignature) return "AA";
    const signed = decode(wallet.sign(tx as never, tx.SigningPubKey === "").tx_blob);
    return tx.SigningPubKey === ""
      ? (signed.Signers as { Signer: { TxnSignature: string } }[])[0].Signer.TxnSignature
      : signed.TxnSignature as string;
  } };

  for (flags of [0, 0x00020000, 0x80020000]) {
    const request = { ...payment, Flags: flags };
    const result = await adapter.signTransaction({ txJson: request });
    assert.equal(decode(result.txBlob!).Flags, (flags | 0x80000000) >>> 0);
    assert.equal(request.Flags, flags);
    assert.equal(submits, 0);
  }
  const submitted = await adapter.signAndSubmit({ txJson: payment });
  assert.equal(submitted.hash, "TEST_HASH");
  assert.equal(submits, 1);

  const multisignRequest = { ...payment, Account: destination, SigningPubKey: "", Fee: "24", Sequence: 7, LastLedgerSequence: 100, Flags: 0x80000000 };
  const multisigned = await adapter.signTransaction({ txJson: multisignRequest });
  const decodedMulti = decode(multisigned.txBlob!);
  assert.equal(decodedMulti.Account, destination);
  assert.equal(decodedMulti.SigningPubKey, "");
  assert.equal(decodedMulti.Fee, "24");
  const signer = (decodedMulti.Signers as { Signer: { Account: string; SigningPubKey: string; TxnSignature: string } }[])[0].Signer;
  assert.equal(signer.Account, source);
  assert.equal(verifyKeypairSignature(encodeForMultiSigning(multisignRequest as never, source), signer.TxnSignature, signer.SigningPubKey), true);
  assert.equal(submits, 1);

  rpcError = new Error("Account not found: actNotFound");
  await assert.rejects(() => adapter.signAndSubmit({ txJson: payment }), error => error === rpcError);
  rpcError = undefined;
  invalidSignature = true;
  await assert.rejects(() => adapter.signAndSubmit({ txJson: payment }), /invalid transaction signature/);
  invalidSignature = false;
  assert.equal(submits, 1);

  deviceFailure = true;
  await assert.rejects(() => adapter.signAndSubmit({ txJson: payment }), error => {
    const details = (error as { details?: Record<string, unknown> }).details!;
    assert.equal(details.stage, "device-signing");
    assert.equal(details.ledgerStatusCode, 0x6800);
    assert.equal(details.appVersion, "2.3.2");
    assert.equal(details.submitAttempted, false);
    assert.equal((details.preparedTransaction as Record<string, unknown>).Flags, 0x80020000);
    return true;
  });
  assert.equal(submits, 1);
  deviceFailure = false;
  disconnectDuringSign = true;
  await assert.rejects(() => adapter.signAndSubmit({ txJson: payment }), error =>
    (error as { code?: string }).code === WalletKitErrorCode.NOT_CONNECTED);
  assert.equal(submits, 1);
});
