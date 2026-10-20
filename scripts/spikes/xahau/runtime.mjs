import { XrplDefinitions, encode, decode, encodeForSigning } from "xahau-binary-codec";
import bundled from "xahau-binary-codec/dist/enums/definitions.json" with { type: "json" };
import { prepareIntent } from "./boundary.mjs";
import { checkPreparedFee } from "./rpc-policy.mjs";

// Browser-safe entry for the local lab, not exported by any published package.
export function createLabRuntime() {
  const definitions = new XrplDefinitions(structuredClone(bundled));
  const runtime = {
    encode: tx => encode(tx, definitions),
    decode: blob => decode(blob, definitions),
    signingData: tx => encodeForSigning(tx, definitions)
  };
  return { runtime, definitions };
}

export async function prepareLiveIntent(runtime, definitions, template, account, maxFeeDrops, reader) {
  const allowed = new Set(["TransactionType", "Destination", "Amount", "SourceTag", "DestinationTag", "Memos", "HookParameters"]);
  if (!template || Object.keys(template).some(key => !allowed.has(key))) throw new Error("Only transaction intent fields are accepted by the lab");
  const policy = { account: account.address, networkId: 21338, maxFeeDrops };
  const tx = prepareIntent(runtime, definitions, {
    ...structuredClone(template), Account: account.address, SigningPubKey: account.publicKey,
    NetworkID: 21338, Flags: 2147483648, Sequence: 1, LastLedgerSequence: 1, Fee: maxFeeDrops
  }, policy);
  const { info } = await reader("server_info");
  if (info?.network_id !== 21338 || !Number.isInteger(info.validated_ledger?.seq) ||
      !Number.isFinite(info.validated_ledger.age) || info.validated_ledger.age < 0 || info.validated_ledger.age > 30) throw new Error("Expected recent validated Xahau testnet ledger");
  const result = await reader("account_info", { account: account.address, ledger_index: "validated" });
  if (result.validated !== true || result.account_data?.Account !== account.address ||
      !Number.isInteger(result.ledger_index) || result.ledger_index < info.validated_ledger.seq ||
      !Number.isInteger(result.account_data.Sequence) || result.account_data.Sequence < 1) throw new Error("Expected a funded, validated testnet account");
  tx.Sequence = result.account_data.Sequence;
  tx.LastLedgerSequence = info.validated_ledger.seq + 20;
  const fee = await reader("fee", { tx_blob: runtime.encode({ ...tx, Fee: "0", SigningPubKey: "" }) });
  const values = [fee.drops?.base_fee, fee.drops?.open_ledger_fee];
  if (!values.every(value => typeof value === "string" && /^[1-9][0-9]{0,17}$/.test(value))) throw new Error("Missing transaction-aware fee quote");
  tx.Fee = values.map(BigInt).reduce((a, b) => a > b ? a : b).toString();
  const prepared = prepareIntent(runtime, definitions, tx, policy);
  await checkPreparedFee(runtime, definitions, prepared, policy, reader);
  return { tx: prepared, policy };
}
