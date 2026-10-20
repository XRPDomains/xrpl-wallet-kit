import { sha512 } from "@xrplf/isomorphic/dist/sha512/browser.js";

// JSON-shaped data only; validation rejects accessors and unsupported values first.
export function sameValue(first, second) {
  if (Object.is(first, second)) return true;
  if (!first || !second || typeof first !== "object" || typeof second !== "object" ||
      Array.isArray(first) !== Array.isArray(second)) return false;
  const keys = Object.keys(first);
  return keys.length === Object.keys(second).length && keys.every(key => Object.hasOwn(second, key) && sameValue(first[key], second[key]));
}

export function transactionHash(blob) {
  const bytes = Uint8Array.from(("54584E00" + blob).match(/../g), byte => parseInt(byte, 16));
  return Array.from(sha512(bytes).slice(0, 32), byte => byte.toString(16).padStart(2, "0")).join("").toUpperCase();
}
