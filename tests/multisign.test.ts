import assert from "node:assert/strict";
import test from "node:test";
import { decode, encode, Wallet } from "xrpl";
import type { Transaction } from "xrpl";
import { combineMultisignContributions, submitMultisignTransaction, validateMultisignTransaction, WalletKitErrorCode } from "../packages/core/src/index";
import type { MultisignPolicy } from "../packages/core/src/index";
import { LedgerAdapter } from "../packages/adapters/ledger/src/index";

const owner = Wallet.generate();
const first = Wallet.generate();
const second = Wallet.generate("ecdsa-secp256k1" as Parameters<typeof Wallet.generate>[0]);
const tx = { TransactionType: "Payment", Account: owner.classicAddress, Destination: Wallet.generate().classicAddress,
  Amount: "1000000", Fee: "30", Sequence: 1, LastLedgerSequence: 1000, SigningPubKey: "" };
const policy: MultisignPolicy = { account: owner.classicAddress, quorum: 3, baseFeeDrops: "10",
  signers: [{ account: first.classicAddress, weight: 1, publicKeys: [first.publicKey] },
    { account: second.classicAddress, weight: 2, publicKeys: [second.publicKey] }] };
const sign = (wallet: Wallet, input = tx) => wallet.sign(input as Transaction, true).tx_blob;
const contributions = [sign(first), sign(second)];
const invalid = (error: unknown) => (error as { code?: string }).code === WalletKitErrorCode.INVALID_REQUEST;

test("multisign verifies both key algorithms, canonical ordering and immutable intent", async () => {
  const original = structuredClone(tx);
  const result = await combineMultisignContributions(tx, contributions, policy);
  const reversed = await combineMultisignContributions(tx, [{ txBlob: contributions[1] }, contributions[0]], policy);
  assert.equal(result.txBlob, reversed.txBlob);
  assert.equal(result.weight, 3);
  assert.equal(result.quorumMet, true);
  assert.equal(result.feeSufficient, true);
  const { Signers, ...intent } = result.txJson;
  assert.equal((Signers as unknown[]).length, 2);
  assert.equal(encode(intent as Transaction), encode(tx as Transaction));
  assert.deepEqual(tx, original);
});

test("multisign reports partial quorum without submission", async () => {
  const partial = await combineMultisignContributions(tx, [contributions[0]], policy);
  assert.equal(partial.quorumMet, false);
  let calls = 0;
  await assert.rejects(submitMultisignTransaction(tx, [contributions[0]], policy, async () => { calls++; }), invalid);
  assert.equal(calls, 0);
});

test("multisign rejects changed intent, duplicates, malformed and combined contributions", async () => {
  for (const entries of [[], ["BAD"], [contributions[0], contributions[0]],
    [sign(first, { ...tx, Amount: "2" })]]) {
    await assert.rejects(combineMultisignContributions(tx, entries, policy), invalid);
  }
  const combined = await combineMultisignContributions(tx, contributions, policy);
  await assert.rejects(combineMultisignContributions(tx, [combined.txBlob], policy), invalid);
});

test("multisign rejects forged signatures and unauthorized keys/accounts", async () => {
  const forged = decode(contributions[0]);
  const signer = (forged.Signers as { Signer: { TxnSignature: string } }[])[0].Signer;
  signer.TxnSignature = "00".repeat(64);
  await assert.rejects(combineMultisignContributions(tx, [encode(forged as Transaction)], policy), invalid);
  await assert.rejects(combineMultisignContributions(tx, [sign(Wallet.generate())], policy), invalid);
  const wrongKeys = structuredClone(policy);
  wrongKeys.signers[0].publicKeys = [second.publicKey];
  await assert.rejects(combineMultisignContributions(tx, [contributions[0]], wrongKeys), invalid);
});

test("multisign supports explicitly authorized regular keys", async () => {
  const regular = Wallet.generate();
  const signingWallet = new Wallet(regular.publicKey, regular.privateKey, { masterAddress: first.classicAddress });
  const trusted = structuredClone(policy);
  trusted.signers[0].publicKeys = [regular.publicKey];
  const result = await combineMultisignContributions(tx, [sign(signingWallet), contributions[1]], trusted);
  assert.equal(result.quorumMet, true);
});

test("multisign rejects invalid policy weights, quorum, signer entries and source account", async () => {
  const policies = [ { ...policy, account: first.classicAddress }, { ...policy, quorum: 4 }, { ...policy, quorum: 0 },
    { ...policy, signers: [policy.signers[0], policy.signers[0]] },
    { ...policy, signers: [{ ...policy.signers[0], weight: 0 }] }, { ...policy, baseFeeDrops: "0" } ];
  for (const trusted of policies) await assert.rejects(combineMultisignContributions(tx, contributions, trusted), invalid);
});

test("multisign requires prefilled transaction fields and never repairs a signed fee", async () => {
  for (const input of [{ ...tx, Sequence: undefined }, { ...tx, Fee: undefined },
    { ...tx, LastLedgerSequence: undefined }, { ...tx, SigningPubKey: first.publicKey }, { ...tx, Signers: [] }]) {
    await assert.rejects(validateMultisignTransaction(input), invalid);
  }
  const cheap = { ...tx, Fee: "10" };
  const entries = [sign(first, cheap), sign(second, cheap)];
  const result = await combineMultisignContributions(cheap, entries, policy);
  assert.equal(result.feeSufficient, false);
  await assert.rejects(submitMultisignTransaction(cheap, entries, policy, async () => assert.fail("must not submit")), invalid);
});

test("multisign submission dispatches once and passes through the transport response", async () => {
  let calls = 0;
  const response = { engine_result: "tesSUCCESS" };
  const result = await submitMultisignTransaction(tx, contributions, policy, async blob => {
    calls++;
    assert.equal((decode(blob).Signers as unknown[]).length, 2);
    return response;
  });
  assert.equal(result, response);
  assert.equal(calls, 1);
});

test("multisign pre-cancel and invalid timeout never dispatch", async () => {
  const controller = new AbortController();
  controller.abort();
  const submit = async () => assert.fail("must not submit");
  await assert.rejects(submitMultisignTransaction(tx, contributions, policy, submit, { signal: controller.signal }),
    (error: unknown) => (error as { code: string }).code === WalletKitErrorCode.REQUEST_CANCELLED);
  await assert.rejects(submitMultisignTransaction(tx, contributions, policy, submit, { timeoutMs: -1 }), invalid);
});

test("multisign cancellation during verification prevents dispatch", async () => {
  const controller = new AbortController();
  const pending = submitMultisignTransaction(tx, contributions, policy, async () => assert.fail("must not submit"), { signal: controller.signal });
  controller.abort();
  await assert.rejects(pending, (error: unknown) => (error as { code: string }).code === WalletKitErrorCode.REQUEST_CANCELLED);
  await new Promise(resolve => setTimeout(resolve, 10));
});

test("multisign timeout before verification finishes prevents dispatch", async context => {
  context.mock.timers.enable({ apis: ["setTimeout"] });
  let calls = 0;
  const pending = submitMultisignTransaction(tx, contributions, policy, async () => { calls++; }, { timeoutMs: 100 });
  context.mock.timers.tick(100);
  await assert.rejects(pending, (error: unknown) => (error as { code: string }).code === WalletKitErrorCode.REQUEST_TIMEOUT);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(calls, 0);
});

test("multisign timeout after dispatch settles locally without retrying", async context => {
  context.mock.timers.enable({ apis: ["setTimeout"] });
  let calls = 0;
  let finish: ((value: string) => void) | undefined;
  await assert.rejects(submitMultisignTransaction(tx, contributions, policy, () => {
    calls++;
    context.mock.timers.tick(100);
    return new Promise<string>(resolve => { finish = resolve; });
  }, { timeoutMs: 100 }), (error: unknown) => (error as { code: string }).code === WalletKitErrorCode.REQUEST_TIMEOUT);
  assert.equal(calls, 1);
  finish?.("late response");
});

test("multisign passes through transport failures without retrying", async () => {
  const failure = new Error("network unavailable");
  await assert.rejects(submitMultisignTransaction(tx, contributions, policy, async () => { throw failure; }), error => error === failure);
});

test("multisign captures inputs before asynchronous verification", async () => {
  const input = structuredClone(tx);
  const trusted = structuredClone(policy);
  const entries = [...contributions];
  const result = combineMultisignContributions(input, entries, trusted);
  input.Amount = "2";
  trusted.quorum = 99;
  entries.length = 0;
  assert.equal((await result).quorumMet, true);
});

test("default Ledger multisign uses prepared intent without RPC or autofill", async () => {
  const adapter = new LedgerAdapter({ connectLedger: async () => ({ address: first.classicAddress, publicKey: first.publicKey }) });
  await adapter.connect({ network: { id: "mainnet", name: "Mainnet", networkType: "MAINNET", rpcUrl: "wss://invalid.example", walletConnectChainId: "xrpl:0" } });
  const { sign: signBytes } = await import("ripple-keypairs");
  const internals = adapter as unknown as { xrp: unknown; signMultisignWithDefaultLedger(input: unknown): Promise<{ txBlob: string }> };
  internals.xrp = { signTransaction: async (_path: string, blob: string) => signBytes(blob, first.privateKey) };
  const contribution = await internals.signMultisignWithDefaultLedger(tx);
  assert.equal((await combineMultisignContributions(tx, [contribution.txBlob], policy)).weight, 1);
  await assert.rejects(internals.signMultisignWithDefaultLedger({ ...tx, Fee: undefined }), invalid);
  await adapter.disconnect();
});
