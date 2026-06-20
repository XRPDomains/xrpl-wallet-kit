# Next.js — Sign In with Wallet

This guide shows how to add **Sign In with XRPL Wallet** to a Next.js App Router project using [`iron-session`](https://github.com/vvo/iron-session) for encrypted server-side sessions.

## Install

```sh
npm install @xrpl-wallet-kit/next @xrpl-wallet-kit/client @xrpl-wallet-kit/auth
npm install iron-session

# Server-only peer deps — required on the backend
npm install ripple-keypairs verify-xrpl-signature xrpl
```

## 1. Session configuration

Create a shared session config file. The password must be at least 32 characters.

```ts
// lib/session.ts
import type { SessionOptions } from "iron-session";

export interface SessionData {
  address?: string;
  authenticatedAt?: number;
  pendingNonce?: string;
  nonceIssuedAt?: number;
}

export const sessionOptions: SessionOptions = {
  password: process.env.SESSION_SECRET!,        // min 32 chars
  cookieName: "xrpl-wallet-session",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    maxAge: 60 * 30,   // 30 minutes
  },
};
```

Add `SESSION_SECRET` to `.env.local`:

```bash
# .env.local
SESSION_SECRET=at-least-32-characters-random-secret-here
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id
NEXT_PUBLIC_XAMAN_CLIENT_ID=your_xaman_client_id
XRPL_NODE_URL=wss://xrplcluster.com
```

## 2. API routes

### GET /api/auth/nonce

```ts
// app/api/auth/nonce/route.ts
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { generateNonce } from "@xrpl-wallet-kit/auth";
import { sessionOptions, type SessionData } from "@/lib/session";

export async function GET() {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);

  const nonce = generateNonce();
  session.pendingNonce = nonce;
  session.nonceIssuedAt = Date.now();
  await session.save();

  return NextResponse.json({ nonce });
}
```

### POST /api/auth/verify

```ts
// app/api/auth/verify/route.ts
import { getIronSession } from "iron-session";
import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";
import { parseAuthMessage, validateAuthMessage } from "@xrpl-wallet-kit/auth";
import { createXrplSignatureVerifier } from "@xrpl-wallet-kit/auth/verifiers";
import { sessionOptions, type SessionData } from "@/lib/session";

// Create verifier once — reused across requests
const verifier = createXrplSignatureVerifier({
  nodeUrl: process.env.XRPL_NODE_URL ?? "wss://xrplcluster.com",
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { message, signatureKind, signature, txBlob, address, publicKey } = body;

    const session = await getIronSession<SessionData>(await cookies(), sessionOptions);

    if (!session.pendingNonce) {
      return NextResponse.json({ error: "No pending nonce." }, { status: 400 });
    }

    // Parse & validate message
    let parsed: ReturnType<typeof parseAuthMessage>;
    try {
      parsed = parseAuthMessage(message);
    } catch {
      return NextResponse.json({ error: "Invalid message format." }, { status: 400 });
    }

    const hostname = (await headers()).get("host")?.split(":")[0] ?? "";
    const { valid, reason } = validateAuthMessage(parsed, {
      expectedDomain: hostname,
      maxAge: 300,
      usedNonces: new Set([session.pendingNonce]),
    });

    if (!valid) {
      return NextResponse.json({ error: reason }, { status: 400 });
    }

    // Verify signature
    const ok = await verifier.verify({ message, signatureKind, signature, txBlob, address, publicKey });

    if (!ok) {
      return NextResponse.json({ error: "Signature verification failed." }, { status: 401 });
    }

    // Persist authenticated session
    session.pendingNonce = undefined;
    session.address = address;
    session.authenticatedAt = Date.now();
    await session.save();

    return NextResponse.json({ ok: true, address });
  } catch (err) {
    console.error("[auth/verify]", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
```

### POST /api/auth/signout

```ts
// app/api/auth/signout/route.ts
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { sessionOptions, type SessionData } from "@/lib/session";

export async function POST() {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  session.destroy();
  return NextResponse.json({ ok: true });
}
```

### GET /api/auth/me (protected route example)

```ts
// app/api/auth/me/route.ts
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { sessionOptions, type SessionData } from "@/lib/session";

export async function GET() {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);

  if (!session.address) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  return NextResponse.json({ address: session.address });
}
```

## 3. WalletAuthAdapter (client-side)

Create a shared adapter that talks to the API routes above.

```ts
// lib/wallet-auth-adapter.ts
import { formatAuthMessage, type WalletAuthAdapter } from "@xrpl-wallet-kit/auth";

export const walletAuthAdapter: WalletAuthAdapter = {
  async getNonce() {
    const res = await fetch("/api/auth/nonce");
    const data = await res.json();
    return data.nonce as string;
  },

  createMessage(params) {
    return formatAuthMessage(params);
  },

  async verify(params) {
    const res = await fetch("/api/auth/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    return res.ok;
  },

  async signOut() {
    await fetch("/api/auth/signout", { method: "POST" });
  },
};
```

## 4. Client component

```tsx
// components/WalletSignIn.tsx
"use client";

import { useState, useEffect } from "react";
import { useWalletKit } from "@xrpl-wallet-kit/next";
import { createWalletAuth, type WalletAuth } from "@xrpl-wallet-kit/auth";
import { walletAuthAdapter } from "@/lib/wallet-auth-adapter";

export function WalletSignIn() {
  const { manager, openModal, session } = useWalletKit();
  const [auth, setAuth] = useState<WalletAuth | null>(null);
  const [authState, setAuthState] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Create auth controller when wallet connects
  useEffect(() => {
    if (!session || !manager) {
      if (auth) { auth.destroy(); setAuth(null); }
      return;
    }

    const controller = createWalletAuth(manager, walletAuthAdapter, {
      chainId: "xrpl:0",
      statement: "Sign in to access the app.",
      expiresIn: 3600,
    });

    const off = controller.on("change", setAuthState);
    setAuth(controller);
    setAuthState(controller.getState());

    return () => { off(); controller.destroy(); };
  }, [session, manager]);

  async function handleSignIn() {
    if (!auth) return;
    setLoading(true);
    setError(null);
    try {
      await auth.signIn();
    } catch (err: any) {
      setError(err.message ?? "Sign-in failed.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSignOut() {
    if (!auth) return;
    await auth.signOut();
  }

  if (!session) {
    return <button onClick={openModal}>Connect Wallet</button>;
  }

  if (authState?.status === "authenticated") {
    return (
      <div>
        <p>Signed in as: {authState.address}</p>
        <button onClick={handleSignOut}>Sign Out</button>
      </div>
    );
  }

  return (
    <div>
      <p>Wallet: {session.account.address}</p>
      {error && <p style={{ color: "red" }}>{error}</p>}
      <button onClick={handleSignIn} disabled={loading}>
        {loading ? "Signing…" : "Sign In with Wallet"}
      </button>
    </div>
  );
}
```

## 5. Root layout

```tsx
// app/layout.tsx
import { WalletKitProvider } from "@xrpl-wallet-kit/next";
import { createWalletKit } from "@xrpl-wallet-kit/client";

// Build manager once (singleton outside component)
const kit = createWalletKit({
  adapters: [
    // ...your adapters
  ],
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <WalletKitProvider kit={kit}>
          {children}
        </WalletKitProvider>
      </body>
    </html>
  );
}
```

## Security checklist

- `SESSION_SECRET` must be at least 32 random characters — never commit to git.
- Set `secure: true` in `cookieOptions` in production (requires HTTPS).
- Invalidate `pendingNonce` after use — the example does this at step 4.
- Validate `expectedDomain` in `validateAuthMessage` — prevents cross-origin replay.
- `verifier` is created once at module load, not per request.

## See also

- [Sign In with XRPL — Introduction](/docs/auth/introduction)
- [Custom Backend (Express)](/docs/auth/custom-backend)
- [Next.js Framework Guide](/docs/frameworks/next)
