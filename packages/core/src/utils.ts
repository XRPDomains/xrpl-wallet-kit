export function utf8ToHex(value: string): string {
  const encoder = new TextEncoder();
  return [...encoder.encode(value)].map((byte) => byte.toString(16).padStart(2, "0")).join("").toUpperCase();
}
