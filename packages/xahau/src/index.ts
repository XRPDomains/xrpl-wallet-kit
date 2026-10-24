import { XrplDefinitions, encode, decode, encodeForSigning } from "xahau-binary-codec";
import definitionsData from "xahau-binary-codec/dist/enums/definitions.json" with { type: "json" };
import { deriveAddress, verify } from "ripple-keypairs";
import { sha512 } from "@noble/hashes/sha512";
import { isValidClassicAddress } from "xahau-address-codec";
import { WalletKitError, WalletKitErrorCode, assertWalletRequestActive } from "@xrpl-wallet-kit/core";
import type { TransactionPayload, WalletAccount, WalletNetwork, WalletProtocol, WalletProtocolOptions } from "@xrpl-wallet-kit/core";

import { XAHAU_NETWORKS, XAHAU_TRANSACTION_TYPES } from "./networks";
export { XAHAU_MAINNET, XAHAU_TESTNET, XAHAU_NETWORKS } from "./networks";
type Json = Record<string, unknown>;
const POST_SIGN_MAX_AGE_MS = 5000;
export type XahauRpcRequest = (network: WalletNetwork, method: string, params: Json, signal?: AbortSignal) => Promise<Json>;
const invalid = (message: string, cause?: unknown) => new WalletKitError(WalletKitErrorCode.INVALID_REQUEST, message, { cause });
const plain = (value: unknown): value is Json => value !== null && typeof value === "object" && !Array.isArray(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value));
function same(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (!a || !b || typeof a !== "object" || typeof b !== "object" || Array.isArray(a) !== Array.isArray(b)) return false;
  const left = a as Json; const right = b as Json;
  return Object.keys(left).length === Object.keys(right).length && Object.keys(left).every(key => Object.prototype.hasOwnProperty.call(right, key) && same(left[key], right[key]));
}
const drops = (value: unknown): value is string => typeof value === "string" && /^[1-9][0-9]{0,17}$/.test(value);
const uint = (value: unknown): value is number => Number.isInteger(value) && Number(value) >= 0 && Number(value) <= 0xffffffff;
function hash(blob: string): string {
  return Array.from(sha512(Uint8Array.from(("54584E00" + blob).match(/../g)!, byte => parseInt(byte, 16))).slice(0, 32), byte => byte.toString(16).padStart(2, "0")).join("").toUpperCase();
}
export async function requestXahauRpc(network: WalletNetwork, method: string, params: Json, signal?: AbortSignal): Promise<Json> {
  const controller = new AbortController();
  const abort = () => controller.abort(signal?.reason);
  signal?.addEventListener("abort", abort, { once: true });
  if (signal?.aborted) abort();
  const timer = setTimeout(() => controller.abort(new Error("Xahau RPC timed out")), 10000);
  try {
    const response = await fetch(network.httpRpcUrl!, { method: "POST", redirect: "error", headers: { "content-type": "application/json" }, body: JSON.stringify({ method, params: [params] }), signal: controller.signal });
    if (!response.ok) throw new WalletKitError(WalletKitErrorCode.PREFLIGHT_FAILED, `Xahau RPC HTTP ${response.status}`);
    const body: unknown = await response.json();
    if (!plain(body) || !plain(body.result) || body.result.error || body.error) throw new WalletKitError(WalletKitErrorCode.PREFLIGHT_FAILED, `Xahau RPC failed: ${plain(body) && plain(body.result) ? String(body.result.error ?? "missing result") : "invalid response"}`);
    return body.result;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", abort);
  }
}

export function createXahauProtocol(options: { readonly request?: XahauRpcRequest } = {}): WalletProtocol {
  const definitions = new XrplDefinitions(structuredClone(definitionsData));
  const request = options.request ?? requestXahauRpc;
  const types = XAHAU_TRANSACTION_TYPES;
  const enc = (tx: TransactionPayload) => encode(tx, definitions);
  const dec = (blob: string): TransactionPayload => decode(blob, definitions) as TransactionPayload;
  function networkCheck(network: WalletNetwork) {
    const preset = XAHAU_NETWORKS.find(item => item.id === network.id);
    if (!preset || network.family !== "xahau" || network.networkId !== preset.networkId || network.rpcUrl !== preset.rpcUrl || network.httpRpcUrl !== preset.httpRpcUrl) throw new WalletKitError(WalletKitErrorCode.NETWORK_NOT_SUPPORTED, "Use a registered Xahau mainnet/testnet preset");
  }
  function validate(input: unknown, path = "tx"): asserts input is Json {
    if (!plain(input)) throw invalid(`${path}: expected an object`);
    for (const key of Reflect.ownKeys(input)) {
      if (typeof key !== "string") throw invalid(`${path}: symbol field is not supported`);
      const property = Object.getOwnPropertyDescriptor(input, key)!;
      const field = (definitions.field as unknown as Record<string, { isSerialized: boolean; type: { name: string } }>)[key];
      if (!Object.prototype.hasOwnProperty.call(property, "value") || !property.enumerable || !field?.isSerialized || property.value === undefined) throw invalid(`${path}.${key}: unknown or unsupported field`);
      const value: unknown = property.value;
      if (field.type.name === "STArray") {
        if (!Array.isArray(value) || value.length > 32 || Object.keys(value).length !== value.length) throw invalid(`${path}.${key}: invalid array`);
        for (const [index, wrapper] of value.entries()) {
          if (!plain(wrapper) || Object.keys(wrapper).length !== 1) throw invalid(`${path}.${key}[${index}]: expected one wrapper`);
          const expectedWrapper = key === "HookParameters" ? "HookParameter" : key === "Memos" ? "Memo" : undefined;
          if (!expectedWrapper || !Object.prototype.hasOwnProperty.call(wrapper, expectedWrapper)) throw invalid(`${path}.${key}: array not supported by this runtime`);
          validate(wrapper, `${path}.${key}[${index}]`);
        }
      } else if (field.type.name === "STObject") {
        const allowed = key === "HookParameter" ? ["HookParameterName", "HookParameterValue"] : key === "Memo" ? ["MemoType", "MemoData", "MemoFormat"] : undefined;
        if (!allowed || !plain(value) || Object.keys(value).some(name => !allowed.includes(name))) throw invalid(`${path}.${key}: unsupported object fields`);
        validate(value, `${path}.${key}`);
      } else if (field.type.name === "AccountID") {
        if (typeof value !== "string" || !isValidClassicAddress(value)) throw invalid(`${path}.${key}: use classic address and explicit tag`);
      } else if (["Blob", "Hash128", "Hash160", "Hash256"].includes(field.type.name) &&
        (typeof value !== "string" || !/^(?:[0-9A-F]{2})*$/.test(value))) throw invalid(`${path}.${key}: use canonical uppercase hex`);
    }
  }
  function strict(tx: TransactionPayload) {
    validate(tx);
    if (!types.includes(String(tx.TransactionType)) || tx.TxnSignature !== undefined || tx.Signers !== undefined) throw invalid("Unsupported Xahau transaction type or signing mode");
    if (!same(dec(enc(tx)), tx)) throw invalid("Xahau codec would drop or normalize request fields");
  }
  async function ledger(network: WalletNetwork, signal?: AbortSignal) {
    networkCheck(network);
    const result = await request(network, "server_info", {}, signal);
    const info = plain(result.info) ? result.info : {};
    const validated = plain(info.validated_ledger) ? info.validated_ledger : {};
    if (info.network_id !== network.networkId) throw new WalletKitError(WalletKitErrorCode.NETWORK_MISMATCH, "RPC network_id differs from selected chain");
    if (!uint(validated.seq) || typeof validated.age !== "number" || validated.age < 0 || validated.age > 30) throw invalid("RPC has no recent validated ledger");
    return validated.seq;
  }
  async function prepareTransaction(input: TransactionPayload, account: WalletAccount, network: WalletNetwork, policy: WalletProtocolOptions) {
    networkCheck(network);
    if (!drops(policy.maxFeeDrops)) throw invalid("Xahau requires an explicit positive maxFeeDrops");
    validate(input);
    const tx = structuredClone(input);
    if (tx.Account !== undefined && tx.Account !== account.address || tx.NetworkID !== undefined && tx.NetworkID !== network.networkId) throw invalid("Account/NetworkID conflicts with connected chain");
    tx.Account = account.address; tx.NetworkID = network.networkId;
    if (tx.TransactionType === "Invoke" && tx.Destination === account.address) throw invalid("Invoke Destination must differ from Account");
    tx.SigningPubKey ??= account.publicKey?.toUpperCase() ?? "";
    if (tx.SigningPubKey !== "" && (typeof tx.SigningPubKey !== "string" || deriveAddress(tx.SigningPubKey) !== account.address)) throw invalid("SigningPubKey does not belong to the connected account");
    tx.Flags ??= 2147483648;
    if (tx.TransactionType === "Payment" && (typeof tx.Amount === "string" && (!drops(tx.Amount)) || tx.Amount === undefined)) throw invalid("Payment requires a positive Amount");
    if (tx.TransactionType === "URITokenMint" && (typeof tx.URI !== "string" || !/^(?:[0-9A-F]{2}){1,256}$/.test(tx.URI))) throw invalid("URIToken URI must be 1-256 bytes of uppercase hex");
    if (String(tx.TransactionType).startsWith("URIToken") && tx.TransactionType !== "URITokenMint" &&
      (typeof tx.URITokenID !== "string" || !/^[0-9A-F]{64}$/.test(tx.URITokenID))) throw invalid("URITokenID must be 32 bytes of uppercase hex");
    if (["URITokenBuy", "URITokenCreateSellOffer"].includes(String(tx.TransactionType)) && tx.Amount === undefined) throw invalid("URIToken buy/sell requires Amount");
    strict(tx);
    const feeParams = () => ({ tx_blob: enc({ ...tx, Fee: "0", SigningPubKey: "" }) });
    const [index, data, knownFee] = await Promise.all([
      ledger(network, policy.signal),
      request(network, "account_info", { account: account.address, ledger_index: "current", queue: true }, policy.signal),
      // A fully prepared signed intent already has the fields needed for its fee quote.
      tx.Sequence !== undefined && tx.LastLedgerSequence !== undefined
        ? request(network, "fee", feeParams(), policy.signal) : Promise.resolve(undefined)
    ]);
    assertWalletRequestActive(policy.signal);
    const state = plain(data.account_data) ? data.account_data : {};
    if (state.Account !== account.address || !uint(state.Sequence) || state.Sequence < 1) throw invalid("Current funded account required");
    const queue = plain(data.queue_data) ? data.queue_data : undefined;
    let sequence = state.Sequence;
    if (queue && queue.txn_count !== 0) {
      if (!uint(queue.txn_count) || !uint(queue.highest_sequence) || queue.highest_sequence < sequence || queue.auth_change_queued === true || queue.highest_sequence === 0xffffffff) throw invalid("Account queue is incomplete or changes authorization; wait for validation");
      sequence = queue.highest_sequence + 1;
    }
    if (tx.Sequence !== undefined && tx.Sequence !== sequence) throw invalid("Prepared Sequence is stale");
    tx.Sequence ??= sequence; tx.LastLedgerSequence ??= index + 20;
    if (!uint(tx.LastLedgerSequence) || tx.LastLedgerSequence <= index || tx.LastLedgerSequence > index + 50) throw invalid("Transaction expiry is outside the permitted window");
    const fee = knownFee ?? await request(network, "fee", feeParams(), policy.signal);
    assertWalletRequestActive(policy.signal);
    const values = plain(fee.drops) ? fee.drops : {};
    if (!drops(values.base_fee) || !drops(values.open_ledger_fee)) throw invalid("Transaction-aware fee response required");
    const required = BigInt(values.base_fee) > BigInt(values.open_ledger_fee) ? values.base_fee : values.open_ledger_fee;
    tx.Fee ??= required;
    if (!drops(tx.Fee) || BigInt(tx.Fee) < BigInt(required) || BigInt(tx.Fee) > BigInt(policy.maxFeeDrops)) throw invalid("Prepared fee is invalid, below estimate, or exceeds maxFeeDrops");
    strict(tx);
    return { tx, index };
  }
  async function submitAtHead(blob: string, network: WalletNetwork, policy: WalletProtocolOptions, index: number) {
    const tx = dec(blob);
    if (tx.NetworkID !== network.networkId || !drops(policy.maxFeeDrops) || !drops(tx.Fee) || BigInt(tx.Fee) > BigInt(policy.maxFeeDrops)) throw invalid("Submission fee/network mismatch");
    if (!uint(tx.LastLedgerSequence) || tx.LastLedgerSequence <= index) throw invalid("Signed transaction expired before submission");
    const txHash = hash(blob);
    let result: Json;
    try { result = await request(network, "submit", { tx_blob: blob }, policy.signal); }
    catch (cause) { throw new WalletKitError(WalletKitErrorCode.SUBMIT_FAILED, "Submission outcome unknown; check the hash before retrying", { cause, details: { hash: txHash, outcomeUnknown: true } }); }
    if (result.engine_result !== "tesSUCCESS" && result.engine_result !== "terQUEUED") {
      const code = typeof result.engine_result === "string" ? result.engine_result : "unknown";
      // Only malformed transactions are unconditionally final. Other responses are local/provisional.
      const final = code.startsWith("tem");
      const rejected = /^(tem|tef|tel)/.test(code);
      const outcomeUnknown = !final && (!rejected || result.relayed === true || ["tefALREADY", "tefPAST_SEQ"].includes(code));
      throw new WalletKitError(WalletKitErrorCode.SUBMIT_FAILED, `Xahau submission: ${code}`, {
        details: { hash: txHash, engineResult: code, submissionRejected: rejected, final, outcomeUnknown, raw: result }
      });
    }
    return { hash: txHash, txBlob: blob, signed: true, status: "submitted", raw: result };
  }
  const protocol: WalletProtocol = {
    family: "xahau", networks: XAHAU_NETWORKS, transactionTypes: types, encode: enc, decode: dec,
    async lookupTransaction(txHash, network, signal) {
      await ledger(network, signal);
      return request(network, "tx", { transaction: txHash, binary: false }, signal);
    },
    async prepare(input, account, network, policy) {
      return (await prepareTransaction(input, account, network, policy)).tx;
    },
    verify(blob, expected, account, network, policy) {
      networkCheck(network);
      try {
        if (!/^(?:[0-9A-F]{2})+$/i.test(blob) || blob.length > 262144) throw invalid("Expected a complete signed blob");
        const signed = dec(blob.toUpperCase());
        const { TxnSignature, ...intent } = signed;
        const key = signed.SigningPubKey;
        const wanted: Json = { ...expected, SigningPubKey: expected.SigningPubKey || key };
        if (typeof key !== "string" || typeof TxnSignature !== "string" || deriveAddress(key) !== account.address ||
          signed.Account !== account.address) throw invalid("Signed account or signing key mismatch");
        if (signed.NetworkID !== network.networkId) throw invalid("Signed NetworkID mismatch");
        if (!same(intent, wanted)) {
          const changedFields = [...new Set([...Object.keys(wanted), ...Object.keys(intent)])]
            .filter(field => !same(wanted[field], intent[field]));
          // Omit cryptographic material; retain transaction fields for local integration diagnostics.
          const changes = changedFields.filter(field => field !== "SigningPubKey" && field !== "Signers")
            .map(field => ({ field, expected: wanted[field] ?? null, actual: intent[field] ?? null }));
          throw new WalletKitError(WalletKitErrorCode.INVALID_REQUEST,
            `Signed fields changed: ${changedFields.join(", ")}`, { details: { changedFields, changes } });
        }
        if (enc(signed) !== blob.toUpperCase()) throw invalid("Signed blob is not canonical");
        if (!verify(encodeForSigning(intent, definitions), TxnSignature, key)) throw invalid("Invalid transaction signature");
        if (!drops(policy.maxFeeDrops) || !drops(signed.Fee) || BigInt(signed.Fee) > BigInt(policy.maxFeeDrops)) throw invalid("Signed fee exceeds the permitted limit");
        return { txBlob: blob.toUpperCase(), hash: hash(blob) };
      } catch (cause) {
        throw new WalletKitError(WalletKitErrorCode.SIGN_FAILED,
          cause instanceof WalletKitError ? `Xahau verification failed: ${cause.message}` : "Xahau signed result failed verification",
          { cause, details: cause instanceof WalletKitError ? cause.details : undefined });
      }
    },
    async verifyAndSubmit(blob, expected, account, network, policy, assertCurrent) {
      // No reusable proof escapes this operation. Snapshot inputs before any RPC can yield.
      const selected = structuredClone(network);
      const signer = structuredClone(account);
      const intent = structuredClone(expected);
      const limits = { maxFeeDrops: policy.maxFeeDrops, signal: policy.signal };
      assertCurrent();
      assertWalletRequestActive(limits.signal);
      const verified = protocol.verify(blob, intent, signer, selected, limits);
      for (let attempt = 0; attempt < 2; attempt++) {
        const started = Date.now();
        const fresh = await prepareTransaction(intent, signer, selected, limits);
        assertCurrent();
        assertWalletRequestActive(limits.signal);
        const age = Date.now() - started;
        if (age >= 0 && age <= POST_SIGN_MAX_AGE_MS) return submitAtHead(verified.txBlob, selected, limits, fresh.index);
      }
      throw new WalletKitError(WalletKitErrorCode.PREFLIGHT_FAILED, "Post-sign validation expired; retry signing.");
    },
    async submit(blob, network, policy) {
      assertWalletRequestActive(policy.signal);
      const index = await ledger(network, policy.signal);
      assertWalletRequestActive(policy.signal);
      return submitAtHead(blob, network, policy, index);
    }
  };
  return protocol;
}
