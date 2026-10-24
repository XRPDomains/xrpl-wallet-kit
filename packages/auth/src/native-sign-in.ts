import { assertSignInContext } from "@xrpl-wallet-kit/core";
import type { SignInContext, SignInResult } from "@xrpl-wallet-kit/core";

export interface WalletSignInServerOptions extends SignInContext {
  /** Atomically consume an outstanding, unexpired nonce scoped to this context. */
  consumeNonce: (context: SignInContext) => boolean | Promise<boolean>;
}

/** Server-side native sign-in verification. Never use the client's context as expected values. */
export async function verifyWalletSignIn(result: SignInResult, options: WalletSignInServerOptions): Promise<boolean> {
  if (!options || typeof options.consumeNonce !== "function") throw new Error("Wallet sign-in requires an atomic server nonce consumer.");
  const context = { ...options, resources: options.resources ? [...options.resources] : undefined };
  let snapshot: SignInResult;
  try { snapshot = structuredClone(result); } catch { return false; }
  try {
    const { deriveAddress, verify } = await import("ripple-keypairs");
    if (snapshot.mode === "caip122") {
      assertSignInContext(snapshot, context);
      const messageHex = Array.from(new TextEncoder().encode(snapshot.message), byte => byte.toString(16).padStart(2, "0")).join("");
      if (deriveAddress(snapshot.publicKey) !== context.address || !verify(messageHex, snapshot.signature, snapshot.publicKey)) return false;
    } else {
      const { decode, verifySignature } = await import("xrpl");
      const tx = decode(snapshot.txBlob) as Record<string, unknown>;
      assertSignInContext(snapshot, context, tx);
      if (typeof tx.SigningPubKey !== "string" || deriveAddress(tx.SigningPubKey) !== context.address || !verifySignature(snapshot.txBlob)) return false;
    }
  } catch { return false; }
  return await options.consumeNonce(context) === true;
}
