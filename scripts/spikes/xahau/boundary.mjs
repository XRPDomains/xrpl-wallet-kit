import { sameValue as isDeepStrictEqual, transactionHash } from "./portable.mjs";
import { deriveAddress, verify } from "ripple-keypairs";
import { isValidClassicAddress } from "xrpl";
import { WalletKitError, WalletKitErrorCode } from "../../../packages/core/src/errors.ts";

// Private M0 subset: fully prepared, single-sign, native Payment/Invoke only.
const common = ["TransactionType", "Account", "Destination", "Fee", "Sequence",
  "LastLedgerSequence", "NetworkID", "Flags", "SigningPubKey", "SourceTag",
  "DestinationTag", "HookParameters", "Memos"];
const uint32 = new Set(["Sequence", "LastLedgerSequence", "NetworkID", "Flags", "SourceTag", "DestinationTag"]);
const hex = new Set(["SigningPubKey", "HookParameterName", "HookParameterValue", "MemoType", "MemoData", "MemoFormat"]);
const shapes = {
  HookParameters: { wrapper: "HookParameter", fields: ["HookParameterName", "HookParameterValue"] },
  Memos: { wrapper: "Memo", fields: ["MemoType", "MemoData", "MemoFormat"] }
};
const invalid = message => new WalletKitError(WalletKitErrorCode.INVALID_REQUEST, message);
const plain = value => value !== null && typeof value === "object" &&
  (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);

export function prepareIntent(runtime, definitions, input, policy) {
  const type = plain(input) ? Object.getOwnPropertyDescriptor(input, "TransactionType") : undefined;
  if (!type || !Object.hasOwn(type, "value") || !["Payment", "Invoke"].includes(type.value)) {
    throw invalid("M0 requires a prepared Payment or Invoke");
  }
  const allowed = new Set([...common, ...(input.TransactionType === "Payment" ? ["Amount"] : [])]);
  function visit(object, fields, path) {
    if (!plain(object)) throw invalid(`${path}: expected a plain object`);
    for (const name of Reflect.ownKeys(object)) {
      const descriptor = Object.getOwnPropertyDescriptor(object, name);
      if (typeof name !== "string" || !fields.has(name) || !descriptor.enumerable || !Object.hasOwn(descriptor, "value")) {
        throw invalid(`${path}: unexpected field or property descriptor`);
      }
      const value = descriptor.value;
      if (!definitions.field[name]?.isSerialized || value === undefined) throw invalid(`${path}.${name}: invalid field`);
      if (Object.hasOwn(shapes, name)) {
        if (!Array.isArray(value) || value.length > 16 || Object.keys(value).length !== value.length) throw invalid(`${path}.${name}: invalid array`);
        const shape = shapes[name];
        for (const [index, item] of value.entries()) {
          if (!plain(item) || Reflect.ownKeys(item).length !== 1 || !Object.hasOwn(item, shape.wrapper)) throw invalid(`${path}.${name}[${index}]: invalid wrapper`);
          const wrapper = Object.getOwnPropertyDescriptor(item, shape.wrapper);
          if (!wrapper.enumerable || !Object.hasOwn(wrapper, "value")) throw invalid(`${path}.${name}: invalid wrapper descriptor`);
          visit(wrapper.value, new Set(shape.fields), `${path}.${name}[${index}].${shape.wrapper}`);
          if (name === "HookParameters" && !shape.fields.every(field => Object.hasOwn(wrapper.value, field))) throw invalid("HookParameter requires name and value");
        }
      } else if (uint32.has(name)) {
        if (!Number.isInteger(value) || value < 0 || value > 0xFFFFFFFF) throw invalid(`${path}.${name}: expected uint32`);
      } else if (name === "Account" || name === "Destination") {
        if (typeof value !== "string" || !isValidClassicAddress(value)) throw invalid(`${path}.${name}: use a classic address and explicit tag`);
      } else if (hex.has(name)) {
        if (typeof value !== "string" || !/^(?:[0-9A-F]{2})*$/.test(value)) throw invalid(`${path}.${name}: expected uppercase even-length hex`);
      } else if (name === "Fee" || name === "Amount") {
        if (typeof value !== "string" || !/^(0|[1-9][0-9]{0,17})$/.test(value)) throw invalid(`${path}.${name}: expected canonical native drops`);
      } else if (typeof value !== "string") throw invalid(`${path}.${name}: invalid value`);
    }
  }
  visit(input, allowed, "tx");
  for (const field of ["Account", "Fee", "Sequence", "LastLedgerSequence", "NetworkID", "SigningPubKey", ...(input.TransactionType === "Payment" ? ["Destination", "Amount"] : [])]) {
    if (!Object.hasOwn(input, field)) throw invalid(`Missing prepared field: ${field}`);
  }
  if (!plain(policy) || !Number.isInteger(policy.networkId) || policy.networkId <= 1024 || policy.networkId > 0xFFFFFFFF ||
      typeof policy.maxFeeDrops !== "string" || !/^[1-9][0-9]{0,17}$/.test(policy.maxFeeDrops) || !isValidClassicAddress(policy.account)) throw invalid("Invalid M0 policy");
  if (input.NetworkID !== policy.networkId || input.Account !== policy.account) throw invalid("Prepared account/network differs from policy");
  if (BigInt(input.Fee) <= 0n || BigInt(input.Fee) > BigInt(policy.maxFeeDrops)) throw invalid("Fee exceeds the explicit policy or is zero");
  const snapshot = structuredClone(input);
  try {
    if (!isDeepStrictEqual(runtime.decode(runtime.encode(snapshot)), snapshot)) throw invalid("Codec changed prepared intent");
    if (deriveAddress(snapshot.SigningPubKey) !== snapshot.Account) throw invalid("M0 only supports the account's single signing key");
  } catch (cause) {
    if (cause instanceof WalletKitError) throw cause;
    throw new WalletKitError(WalletKitErrorCode.INVALID_REQUEST, "Prepared intent cannot be encoded", { cause });
  }
  return snapshot;
}

export function verifySignedBlob(runtime, definitions, blob, input, policy, claimedHash) {
  const expected = prepareIntent(runtime, definitions, input, policy);
  try {
    if (typeof blob !== "string" || blob.length > 262144 || !/^(?:[0-9A-F]{2})+$/.test(blob)) throw invalid("Expected a canonical full signed blob");
    const signed = runtime.decode(blob);
    const { TxnSignature, ...intent } = signed;
    if (typeof TxnSignature !== "string" || !TxnSignature || !isDeepStrictEqual(intent, expected)) throw invalid("Signed blob changed prepared intent or has no signature");
    if (runtime.encode(signed) !== blob) throw invalid("Signed blob is not canonical");
    if (!verify(runtime.signingData(intent), TxnSignature, intent.SigningPubKey)) throw invalid("Invalid transaction signature");
    const hash = transactionHash(blob);
    if (claimedHash !== undefined && claimedHash !== hash) throw invalid("Wallet hash does not match signed blob");
    return { txBlob: blob, hash };
  } catch (cause) {
    throw new WalletKitError(WalletKitErrorCode.PREFLIGHT_FAILED, "Wallet result failed M0 signed-blob verification", { cause });
  }
}
