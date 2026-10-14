import { validateAuthMessage } from "./message";
import type { SignatureVerifier, ParsedWalletAuthMessage, WalletAuthVerifyParams } from "./types";

export interface WalletAuthServerOptions {
  expectedDomain: string;
  expectedUri: string;
  maxAgeSeconds?: number;
  verifier: SignatureVerifier;
  /** Atomically accept only an issued, unexpired, unused challenge bound to this context. */
  consumeNonce: (challenge: ParsedWalletAuthMessage) => boolean | Promise<boolean>;
}

/** Verify proof first, then atomically consume the server-issued challenge before issuing a session. */
export async function verifyWalletAuth(params: WalletAuthVerifyParams, options: WalletAuthServerOptions): Promise<boolean> {
  if (!options.expectedDomain || !options.expectedUri || typeof options.consumeNonce !== "function") {
    throw new Error("Wallet authentication requires domain, URI and atomic consumeNonce.");
  }
  const request = { ...params };
  const validationOptions = { expectedDomain: options.expectedDomain, expectedUri: options.expectedUri,
    expectedAddress: request.address, maxAgeSeconds: options.maxAgeSeconds ?? 300, noncePolicy: "format-only" as const };
  const validation = await validateAuthMessage(request.message, validationOptions);
  if (!validation.valid || !validation.message || await options.verifier.verify(request) !== true) return false;
  const current = await validateAuthMessage(request.message, validationOptions);
  if (!current.valid) return false;
  return await options.consumeNonce(validation.message) === true;
}
