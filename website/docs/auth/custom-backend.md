# Custom Backend (Express)

Integrate **Sign In with XRPL Wallet** into an existing Express server. This guide covers nonce generation, message validation, signature verification, and session management with `express-session`.

## Install

```sh
# On your server — NOT the browser bundle
npm install @xrpl-wallet-kit/auth
npm install ripple-keypairs@^3 xrpl@^4
npm install express express-session
```

## Server setup

Implement the application-specific `nonceStore` used below. `issue(nonce,
expiresAt, sessionId)` stores an unused challenge; `consumeIssuedChallenge(parsed, sessionId)` must
atomically consume an issued, unexpired nonce only if it is still unused. Bind
the nonce to the requesting session/context. Clearing a session field alone
does not prevent parallel replay.

### Create the verifier

Create the verifier once when the server starts. Signed transaction proofs are
verified locally; `nodeUrl` is an optional fallback for compact proofs without
a public key, not a persistent WebSocket connection.

```ts
// auth/verifier.ts (or auth/verifier.js)
import { createXrplSignatureVerifier } from "@xrpl-wallet-kit/auth/verifiers";

export const verifier = createXrplSignatureVerifier({
  nodeUrl: process.env.XRPL_NODE_URL ?? "wss://xrplcluster.com",
  nodeTimeout: 5000,
});
```

### Auth routes

```ts
// auth/routes.ts
import { Router, type Request, type Response } from "express";
import {
  generateNonce,
  parseAuthMessage,
  validateAuthMessage,
} from "@xrpl-wallet-kit/auth";
import { verifier } from "./verifier";
import { nonceStore } from "./nonce-store";

const router = Router();

// ── GET /api/auth/nonce ─────────────────────────────────────────
// Issues a fresh nonce and stores it in the server session.
// Client must call this first, then build the sign-in message.
router.get("/nonce", async (req: Request, res: Response) => {
  const nonce = generateNonce();   // 24-byte hex, crypto-secure
  await nonceStore.issue(nonce, Date.now() + 300000, req.sessionID);

  req.session.pendingNonce = nonce;
  req.session.nonceIssuedAt = Date.now();

  res.json({ nonce });
});

// ── POST /api/auth/verify ───────────────────────────────────────
// Verifies the signed message and creates an authenticated session.
router.post("/verify", async (req: Request, res: Response) => {
  const {
    message,
    signatureKind,    // "signature" | "signedTx"
    signature,        // compact signature when the selected wallet supports it
    txBlob,           // signed transaction proof; use signatureKind to choose
    address,
    publicKey,        // optional — forwarded when adapter provides it
  } = req.body;

  // 1 — Nonce must exist
  if (!req.session.pendingNonce) {
    return res.status(400).json({ error: "No pending nonce. Request /nonce first." });
  }

  // Optional: reject stale nonces older than 5 minutes
  if (req.session.nonceIssuedAt && Date.now() - req.session.nonceIssuedAt > 5 * 60 * 1000) {
    req.session.pendingNonce = undefined;
    return res.status(400).json({ error: "Nonce expired." });
  }

  // 2 — Parse the message
  let parsed: ReturnType<typeof parseAuthMessage>;
  try {
    parsed = parseAuthMessage(message);
  } catch {
    return res.status(400).json({ error: "Invalid message format." });
  }

  // 3 — Validate domain, age, nonce
  const { valid, errors } = await validateAuthMessage(message, {
    expectedDomain: new URL(process.env.APP_ORIGIN!).host,
    expectedUri: process.env.APP_ORIGIN!, // Trusted canonical origin, no trailing slash
    expectedChainId: "xrpl:0", // Match your configured XRPL network
    expectedAddress: address,
    maxAgeSeconds: 300,
    isNonceUsed: nonce => nonce !== req.session.pendingNonce,
  });

  if (!valid) {
    return res.status(400).json({ error: errors });
  }

  // 4 — Verify cryptographic signature
  //     verifier branches automatically on signatureKind
  try {
    const ok = await verifier.verify({
      message,
      signatureKind,
      signature,
      txBlob,
      address,
      publicKey,
    });

    if (!ok) {
      return res.status(401).json({ error: "Signature verification failed." });
    }
  } catch (err) {
    console.error("[auth/verify] verifier error:", err);
    return res.status(500).json({ error: "Verification service unavailable." });
  }

  if (!await nonceStore.consumeIssuedChallenge(parsed, req.sessionID)) {
    return res.status(401).json({ error: "Nonce used or expired." });
  }
  // 5 — Mark session as authenticated
  req.session.pendingNonce = undefined;   // one-time use — invalidate
  req.session.address = address;
  req.session.authenticatedAt = Date.now();

  res.json({ ok: true, address });
});

// ── POST /api/auth/signout ──────────────────────────────────────
router.post("/signout", (req: Request, res: Response) => {
  req.session.destroy((err) => {
    if (err) console.error("[auth/signout]", err);
    res.clearCookie("connect.sid");
    res.json({ ok: true });
  });
});

export default router;
```

### Express app

```ts
// server.ts
import express from "express";
import session from "express-session";
import authRouter from "./auth/routes";

const app = express();
app.use(express.json());

app.use(
  session({
    secret: process.env.SESSION_SECRET!,   // min 32 random chars
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 30 * 60 * 1000,   // 30 minutes
    },
  })
);

// Mount auth routes
app.use("/api/auth", authRouter);

// Example protected route
app.get("/api/me", requireAuth, (req, res) => {
  res.json({ address: req.session.address });
});

function requireAuth(req: any, res: any, next: any) {
  if (!req.session?.address) {
    return res.status(401).json({ error: "Not authenticated." });
  }
  next();
}

app.listen(3000);
```

### TypeScript session augmentation

```ts
// types/express-session.d.ts
import "express-session";

declare module "express-session" {
  interface SessionData {
    pendingNonce?: string;
    nonceIssuedAt?: number;
    address?: string;
    authenticatedAt?: number;
  }
}
```

## Client-side `WalletAuthAdapter`

The adapter is what connects your frontend to the routes above.

```ts
// src/wallet-auth-adapter.ts
import { formatAuthMessage, type WalletAuthAdapter } from "@xrpl-wallet-kit/auth";

export const walletAuthAdapter: WalletAuthAdapter = {
  async getNonce() {
    const res = await fetch("/api/auth/nonce");
    if (!res.ok) throw new Error("Failed to get nonce.");
    const { nonce } = await res.json();
    return nonce as string;
  },

  createMessage(params) {
    // Use the built-in formatter or write your own string
    return formatAuthMessage(params);
  },

  async verify(params) {
    const res = await fetch("/api/auth/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    // Return true if server accepted the proof
    return res.ok;
  },

  async signOut() {
    await fetch("/api/auth/signout", { method: "POST" });
  },
};
```

Then wire it up:

```ts
import { createWalletAuth } from "@xrpl-wallet-kit/auth";
import { walletAuthAdapter } from "./wallet-auth-adapter";

// manager comes from createWalletKit() or WalletManager
const auth = createWalletAuth(manager, walletAuthAdapter, {
  chainId: "xrpl:0",
  statement: "Sign in to MyApp.",
  expiresIn: 3600,
});

await auth.signIn();
```

## Production checklist

This message-auth example is for wallets with `signMessage()`. GhostSig and Xyra
do not expose it; Joey Wallet uses the separate
[native sign-in API/verifier](/docs/auth/native-sign-in). Do not remap native
proofs to this endpoint or treat a Xahau connection as XRPL login proof.

- **`SESSION_SECRET`** — at least 32 random characters, stored in an environment variable, never committed.
- **`APP_ORIGIN`** - trusted canonical origin matching the signed URI/domain, including the port during local development.
- **Redis session store** — swap the default MemoryStore for [`connect-redis`](https://github.com/tj/connect-redis) in production. MemoryStore leaks memory and does not survive restarts.
- **HTTPS only** — set `cookie.secure: true` and serve behind a TLS terminator.
- **Rate-limit `/api/auth/nonce`** — prevents nonce exhaustion attacks. Add [`express-rate-limit`](https://github.com/express-rate-limit/express-rate-limit) to the nonce endpoint.
- **Nonce TTL** — reject nonces older than 5 minutes (example above already does this).
- **XRPL node** — prefer a private or dedicated node (`wss://s1.ripple.com`, Ripple's infra) over public clusters for reliability.

## See also

- [Sign In with XRPL — Introduction](/docs/auth/introduction)
- [Next.js Auth Guide](/docs/auth/nextjs)
- [HTML Legacy / CDN guide](/docs/frameworks/legacy-cdn) — plain HTML version with IIFE
