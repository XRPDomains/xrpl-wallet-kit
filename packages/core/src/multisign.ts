import { WalletKitError, WalletKitErrorCode } from "./errors";
import { assertWalletRequestActive, waitForWalletRequest } from "./request";
import type { SignTransactionResult, WalletRequestOptions } from "./types";
import type { Transaction } from "xrpl";

export interface MultisignSigner {
  account: string;
  weight: number;
  /** Keys authorized by trusted ledger state, including RegularKey/master-key rules. */
  publicKeys: readonly string[];
}

export interface MultisignPolicy {
  account: string;
  quorum: number;
  signers: readonly MultisignSigner[];
  /** Current base transaction fee in drops, obtained from the target network. */
  baseFeeDrops: string;
}

export type MultisignContribution = string | Pick<SignTransactionResult, "txBlob">;

export interface MultisignResult {
  txBlob: string;
  txJson: Record<string, unknown>;
  signerAccounts: string[];
  weight: number;
  quorum: number;
  quorumMet: boolean;
  feeSufficient: boolean;
}

function invalid(message: string, cause?: unknown): never {
  throw new WalletKitError(WalletKitErrorCode.INVALID_REQUEST, message, { cause });
}

function drops(value: unknown): bigint {
  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) invalid("Multisign fees must be positive integer drops.");
  return BigInt(value);
}

/** No autofill: every signer must sign the same already-prepared transaction. */
export async function validateMultisignTransaction(txJson: Record<string, unknown>): Promise<Record<string, unknown>> {
  const tx = structuredClone(txJson);
  try {
    const xrpl = await import("xrpl");
    if (tx.SigningPubKey !== "" || "TxnSignature" in tx || "Signers" in tx) invalid("Expected an unsigned multisign transaction with SigningPubKey empty and no signature fields.");
    if (!Number.isInteger(tx.Sequence) || (tx.Sequence as number) < 0 ||
      !Number.isInteger(tx.LastLedgerSequence) || (tx.LastLedgerSequence as number) <= 0) {
      invalid("Prepare Sequence and LastLedgerSequence before collecting multisign contributions.");
    }
    drops(tx.Fee);
    xrpl.validate(tx);
    return xrpl.decode(xrpl.encode(tx as unknown as Transaction)) as Record<string, unknown>;
  } catch (cause) {
    if (cause instanceof WalletKitError) throw cause;
    invalid("Invalid prepared multisign transaction.", cause);
  }
}

/** Validates signatures and intent; quorum is relative to the supplied trusted policy. */
export async function combineMultisignContributions(
  txJson: Record<string, unknown>, contributions: readonly MultisignContribution[], policy: MultisignPolicy
): Promise<MultisignResult> {
  const input = structuredClone(txJson);
  const entries = contributions.map(value => typeof value === "string" ? value : value.txBlob);
  const trusted = structuredClone(policy);
  try {
    const prepared = await validateMultisignTransaction(input);
    const xrpl = await import("xrpl");
    const { verify } = await import("ripple-keypairs");
    if (prepared.Account !== trusted.account || !Number.isInteger(trusted.quorum) || trusted.quorum <= 0 || trusted.quorum > 0xffffffff) invalid("Invalid multisign account or quorum.");
    if (!Array.isArray(trusted.signers) || trusted.signers.length < 1 || trusted.signers.length > 32) invalid("Expected between 1 and 32 authorized signers.");
    const allowed = new Map<string, MultisignSigner>();
    let totalWeight = 0;
    for (const signer of trusted.signers) {
      if (!xrpl.isValidClassicAddress(signer.account) || signer.account === trusted.account || allowed.has(signer.account) ||
        !Number.isInteger(signer.weight) || signer.weight < 1 || signer.weight > 65535 ||
        !Array.isArray(signer.publicKeys) || !signer.publicKeys.length || signer.publicKeys.some((key: string) => typeof key !== "string" || !/^(ED|02|03)[0-9a-f]{64}$/i.test(key))) invalid("Invalid authorized signer policy.");
      allowed.set(signer.account, signer);
      totalWeight += signer.weight;
    }
    if (trusted.quorum > totalWeight) invalid("Quorum exceeds authorized signer weight.");
    const baseFee = drops(trusted.baseFeeDrops);
    if (entries.length < 1 || entries.length > 32) invalid("Expected between 1 and 32 signer contributions.");
    const expectedBlob = xrpl.encode(prepared as unknown as Transaction);
    const seen = new Set<string>();
    let weight = 0;
    const blobs: string[] = [];
    for (const blob of entries) {
      if (typeof blob !== "string" || !/^(?:[0-9a-f]{2})+$/i.test(blob)) invalid("A contribution must contain a hexadecimal txBlob.");
      const signed = xrpl.decode(blob) as Record<string, unknown>;
      if (!Array.isArray(signed.Signers) || signed.Signers.length !== 1) invalid("Each contribution must contain exactly one signer.");
      const { Signers, ...intent } = signed;
      if (xrpl.encode(intent as unknown as Transaction) !== expectedBlob) invalid("Signer contribution changes the prepared transaction.");
      const signer = (Signers[0] as { Signer?: Record<string, unknown> }).Signer;
      if (!signer || typeof signer.Account !== "string" || typeof signer.SigningPubKey !== "string" || typeof signer.TxnSignature !== "string") invalid("Malformed signer contribution.");
      const authorization = allowed.get(signer.Account);
      if (!authorization || seen.has(signer.Account)) invalid("Unauthorized or duplicate multisign signer.");
      if (!authorization.publicKeys.some(key => key.toUpperCase() === (signer.SigningPubKey as string).toUpperCase())) invalid("Signer public key is not authorized by the supplied policy.");
      if (!verify(xrpl.encodeForMultiSigning(prepared as unknown as Transaction, signer.Account), signer.TxnSignature, signer.SigningPubKey)) invalid("Invalid multisign signature.");
      seen.add(signer.Account);
      weight += authorization.weight;
      blobs.push(blob);
    }
    const txBlob = xrpl.multisign(blobs);
    const combined = xrpl.decode(txBlob) as Record<string, unknown>;
    const signerAccounts = (combined.Signers as { Signer: { Account: string } }[]).map(entry => entry.Signer.Account);
    return { txBlob, txJson: combined, signerAccounts, weight, quorum: trusted.quorum,
      quorumMet: weight >= trusted.quorum, feeSufficient: drops(prepared.Fee) >= baseFee * BigInt(seen.size + 1) };
  } catch (cause) {
    if (cause instanceof WalletKitError) throw cause;
    invalid("Invalid multisign contribution or policy.", cause);
  }
}

/** Submit once through caller-owned transport; does not connect, autofill, retry or await validation. */
export function submitMultisignTransaction<T>(
  txJson: Record<string, unknown>, contributions: readonly MultisignContribution[], policy: MultisignPolicy,
  submit: (txBlob: string) => Promise<T>, options: Pick<WalletRequestOptions, "signal" | "timeoutMs"> = {}
): Promise<T> {
  const controls = { signal: options.signal, timeoutMs: options.timeoutMs };
  let stopped: WalletKitError | undefined;
  return waitForWalletRequest(async () => {
    const combined = await combineMultisignContributions(txJson, contributions, policy);
    if (stopped) throw stopped;
    assertWalletRequestActive(controls.signal);
    if (!combined.quorumMet) invalid("Multisign quorum has not been reached.");
    if (!combined.feeSufficient) invalid("Prepared Fee is insufficient for the collected signers; prepare and sign a new transaction.");
    return submit(combined.txBlob);
  }, controls, error => { stopped = error; });
}
