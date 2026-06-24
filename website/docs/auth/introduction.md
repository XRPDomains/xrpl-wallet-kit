# Sign-In with Wallet

`@xrpl-wallet-kit/auth` adds Sign-In with Wallet (SIWW) to any XRPL dApp — framework-agnostic, headless, with pluggable server-side verification.

::: info Stable public release
`@xrpl-wallet-kit/auth` is available on npm as part of the `0.1.3` stable public release. The project is still pre-`1.0.0`, so minor API additions may land before the long-term stable API.
:::

## What it does

Instead of asking users to trust a password-based login, Sign-In with Wallet lets users prove ownership of their XRPL address by signing a human-readable message. The server verifies the signature — no private key ever leaves the user's wallet.

The flow:

```
Browser                              Your Server
  │                                       │
  │── signIn() ──────────────────────────>│
  │                    ← getNonce() call  │
  │<─── nonce ─────────────────────────── │
  │                                       │
  │  [shows wallet prompt]                │
  │  user signs message                   │
  │                                       │
  │── proof ────────────────────────────>│
  │             verify(proof) ───────────>│ (checks signature)
  │<── session token ─────────────────── │
```

## Installation

```bash
npm install @xrpl-wallet-kit/auth
```

Server-side verifier (optional — install on your backend only):

```bash
npm install @xrpl-wallet-kit/auth ripple-keypairs verify-xrpl-signature xrpl
```

## Quick Start

### 1. Implement a `WalletAuthAdapter`

The adapter is how the auth package talks to your backend. You provide three methods:

```ts
import type { WalletAuthAdapter } from "@xrpl-wallet-kit/auth";

const authAdapter: WalletAuthAdapter = {
  // Ask your server for a one-time nonce
  async getNonce() {
    const res = await fetch("/api/auth/nonce");
    const { nonce } = await res.json();
    return nonce;
  },

  // Format the message the user will sign (default: EIP-4361-style human-readable text)
  createMessage(params) {
    // Use the built-in formatter, or return your own string
    return formatAuthMessage(params);
  },

  // Send the signed proof to your server for verification
  async verify(params) {
    const res = await fetch("/api/auth/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    return res.ok;
  },

  // Optional: notify server on sign-out
  async signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
  },
};
```

### 2. Create the auth instance

```ts
import { createWalletAuth } from "@xrpl-wallet-kit/auth";

// `manager` is a connected WalletManager
const auth = createWalletAuth(manager, authAdapter, {
  domain: window.location.host,
  uri: window.location.origin,
  chainId: "xrpl:0",
  statement: "Sign in to MyApp",
});
```

### 3. Sign in

```ts
auth.on("change", (state) => {
  console.log("Auth state:", state.status); // "loading" | "authenticated" | "unauthenticated" | "error"
  console.log("Address:", state.address);
});

document.getElementById("sign-in-btn")!.addEventListener("click", async () => {
  try {
    const result = await auth.signIn();
    console.log("Signed in as:", result.address);
    console.log("Proof:", result.proof);
  } catch (err) {
    console.error("Sign-in failed:", err);
  }
});

document.getElementById("sign-out-btn")!.addEventListener("click", async () => {
  await auth.signOut();
});
```

## Server-Side Verification

On your backend, install the peer packages and use the built-in XRPL verifier:

```ts
import { createXrplSignatureVerifier } from "@xrpl-wallet-kit/auth/verifiers";
import { validateAuthMessage } from "@xrpl-wallet-kit/auth";

const verifier = createXrplSignatureVerifier();

// In your /api/auth/verify endpoint:
app.post("/api/auth/verify", async (req, res) => {
  const { message, signatureKind, proof, signature, txBlob, address, publicKey } = req.body;

  // 1. Validate the message structure
  const validation = await validateAuthMessage(message, {
    expectedDomain: "yourapp.com",
    maxAgeSeconds: 300,
    isNonceUsed: (nonce) => db.nonceIsUsed(nonce), // prevent replay attacks
  });

  if (!validation.valid) {
    return res.status(400).json({ error: validation.errors });
  }

  // 2. Verify the cryptographic signature
  const valid = await verifier.verify({
    message,
    signatureKind,  // "signature" | "signedTx"
    proof,
    signature,
    txBlob,
    address,
    publicKey,
  });

  if (!valid) {
    return res.status(401).json({ error: "Invalid signature" });
  }

  // 3. Mark nonce as used & issue session
  await db.markNonceUsed(validation.message!.nonce);
  const token = issueSessionToken(address);
  res.json({ token });
});
```

## Message Format

The default message format is human-readable and similar to EIP-4361 (Sign-In with Ethereum):

```
yourapp.com wants you to sign in with your wallet:
rMyXrplAddress

Sign in to MyApp

URI: https://yourapp.com
Version: 1
Nonce: a3f8b2e1c9d4
Issued At: 2026-06-19T10:00:00.000Z
Chain ID: xrpl:0
Expiration Time: 2026-06-19T11:00:00.000Z
```

Use `parseAuthMessage(message)` on the server to extract fields without re-implementing the parser.

## Nonce Generation

Generate cryptographically secure nonces on your server using the built-in helper:

```ts
import { generateNonce } from "@xrpl-wallet-kit/auth";

// Returns a 48-char hex string (192 bits of entropy)
const nonce = generateNonce();

// Or specify byte length
const nonce16 = generateNonce({ bytes: 16 }); // 32-char hex (128 bits)
```

## API Reference

### `createWalletAuth(manager, adapter, options?)`

```ts
function createWalletAuth(
  manager: WalletAuthManager,
  adapter: WalletAuthAdapter,
  options?: WalletAuthOptions
): WalletAuth
```

**`WalletAuthOptions`**

```ts
interface WalletAuthOptions {
  domain?: string;         // defaults to window.location.host
  uri?: string;            // defaults to window.location.origin
  chainId?: string;        // e.g. "xrpl:0"
  statement?: string;      // shown in the wallet prompt
  expiresIn?: number;      // seconds until message expires (default: 3600)
}
```

**`WalletAuth` interface**

```ts
interface WalletAuth {
  getState(): WalletAuthState;
  signIn(options?: WalletAuthOptions): Promise<WalletAuthSignInResult>;
  signOut(): Promise<void>;
  on(event: "change", handler: WalletAuthChangeHandler): () => void;
  off(event: "change", handler: WalletAuthChangeHandler): void;
  destroy(): void;
}
```

**`WalletAuthState`**

```ts
interface WalletAuthState {
  status: "unauthenticated" | "loading" | "authenticated" | "error";
  address: string | null;
  error: unknown;
}
```

### `WalletAuthAdapter`

```ts
interface WalletAuthAdapter {
  getNonce(): Promise<string>;
  createMessage(params: WalletAuthMessageParams): string;
  verify(params: WalletAuthVerifyParams): Promise<boolean>;
  signOut?(): Promise<void>;
}
```

### `createXrplSignatureVerifier(options?)`

```ts
import { createXrplSignatureVerifier } from "@xrpl-wallet-kit/auth/verifiers";

const verifier = createXrplSignatureVerifier({
  nodeUrl?: string;          // XRPL node URL for on-ledger pubkey lookup (compact sig without publicKey)
  nodeTimeout?: number;      // ms (default: 5000)
  hashMessage?: (msg: string) => string; // custom message hash function
});

// Returns a SignatureVerifier
interface SignatureVerifier {
  verify(params: WalletAuthVerifyParams): Promise<boolean>;
}
```

Supports both signature kinds:

- **`"signature"`** — compact hex signature from `signMessage`. Uses `ripple-keypairs` to verify.
- **`"signedTx"`** — a signed XRPL transaction blob with the message in `Memos[0]`. Uses `verify-xrpl-signature` + `xrpl`.

## Security Notes

- **Always validate nonces server-side** — mark each nonce as used immediately after the first successful verify to prevent replay attacks.
- **Set `expiresIn` to a short window** — 5–15 minutes for login flows, 1 hour for long sessions.
- **The verifier does not use `RegularKey`** — it verifies against the account's master public key only, as returned by `account_data.PublicKey` on the ledger.
- **Never trust `publicKey` from the client alone** — for highest security, resolve the public key from the ledger (`nodeUrl` option) rather than trusting the wallet-provided value.
