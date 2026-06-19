export interface GenerateNonceOptions {
  bytes?: number;
}

export function generateNonce(options: GenerateNonceOptions = {}): string {
  const byteLength = Math.max(16, options.bytes ?? 24);
  const cryptoApi = globalThis.crypto;

  if (cryptoApi?.randomUUID && byteLength <= 16) {
    return cryptoApi.randomUUID().replace(/-/g, "");
  }

  if (!cryptoApi?.getRandomValues) {
    throw new Error("Secure random nonce generation requires crypto.getRandomValues().");
  }

  const bytes = new Uint8Array(byteLength);
  cryptoApi.getRandomValues(bytes);
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
