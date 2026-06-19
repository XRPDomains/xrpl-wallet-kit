# @xrpl-wallet-kit/auth

Sign-In with Wallet helpers for XRPL Wallet Kit.

This package is intentionally split from `@xrpl-wallet-kit/core`: core signs messages, while auth handles nonce, message formatting, server verification, auth state, and sign-out. The main entry is client-safe. XRPL verifier dependencies live behind the `./verifiers` subpath and should only be imported on the server.

## Install

```bash
npm install @xrpl-wallet-kit/auth @xrpl-wallet-kit/core
```

For server-side XRPL verification, install the optional peers in your server package:

```bash
npm install ripple-keypairs verify-xrpl-signature xrpl
```

## Client Usage

```ts
import { createWalletAuth, formatAuthMessage } from "@xrpl-wallet-kit/auth";

const auth = createWalletAuth(manager, {
  async getNonce() {
    const res = await fetch("/api/auth/nonce", { credentials: "include" });
    const body = await res.json();
    return body.nonce;
  },
  createMessage(params) {
    return formatAuthMessage(params);
  },
  async verify(params) {
    const res = await fetch("/api/auth/verify", {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(params)
    });
    return res.ok;
  },
  async signOut() {
    await fetch("/api/auth/signout", { method: "POST", credentials: "include" });
  }
}, {
  domain: window.location.host,
  uri: window.location.origin,
  chainId: "xrpl:0",
  statement: "Sign in to Example App"
});

auth.on("change", (state) => {
  console.log(state.status, state.address);
});

await auth.signIn();
```

The dApp does not branch by wallet id. `manager.signMessage()` delegates to the active adapter and returns the normalized proof shape:

```ts
{
  signatureKind: "signature" | "signedTx",
  proof: string,
  signature?: string,
  txBlob?: string,
  publicKey?: string
}
```

## Pre-Issued Nonce

If your dApp already issued a nonce before the user clicks sign-in, return that nonce from `getNonce()`. This is common in SSR pages, legacy apps, or flows where the nonce is rendered into the page by the server.

```ts
import { createWalletAuth, formatAuthMessage } from "@xrpl-wallet-kit/auth";

const preIssuedNonce = window.__AUTH_NONCE__;

const auth = createWalletAuth(manager, {
  async getNonce() {
    return preIssuedNonce;
  },
  createMessage(params) {
    return formatAuthMessage(params);
  },
  async verify(params) {
    const res = await fetch("/api/auth/verify", {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(params)
    });
    return res.ok;
  }
}, {
  domain: window.location.host,
  uri: window.location.origin,
  chainId: "xrpl:0",
  statement: "Sign in to Example App"
});

await auth.signIn();
```

The server must still generate, store, validate, and invalidate the nonce. Do not treat a browser-generated nonce as trusted authentication state.

```js
app.get("/login", (req, res) => {
  const nonce = createSecureNonce();
  req.session.authNonce = nonce;
  res.render("login", { authNonce: nonce });
});

app.post("/api/auth/verify", async (req, res) => {
  const parsed = parseAuthMessage(req.body.message);

  if (parsed.nonce !== req.session.authNonce) {
    return res.status(400).json({ ok: false, error: "Invalid nonce" });
  }

  // Verify req.body proof here, then create the app session.
  req.session.authNonce = null;
  res.json({ ok: true });
});
```

## Server Verification

```ts
import { createXrplSignatureVerifier } from "@xrpl-wallet-kit/auth/verifiers";

const verifier = createXrplSignatureVerifier({
  nodeUrl: "wss://xrplcluster.com"
});

const ok = await verifier.verify({
  address: body.address,
  message: body.message,
  signatureKind: body.signatureKind,
  proof: body.proof,
  signature: body.signature,
  txBlob: body.txBlob,
  publicKey: body.publicKey
});
```

For `signatureKind: "signature"`, `publicKey` should be provided by the wallet/sign result. Ledger lookup via `account_info.account_data.PublicKey` is only a fallback. Do not use `RegularKey` as a public key.

For `signatureKind: "signedTx"`, the verifier checks the signed transaction blob, signer address, transaction `Account`, and first memo text against the original auth message.

## Legacy HTML / jQuery Pattern

Legacy pages can use the same API from the browser bundle or ESM build. Keep the server verification endpoint separate:

```js
async function signInWithWalletKit(manager) {
  const auth = XRPLWalletKitAuth.createWalletAuth(manager, {
    async getNonce() {
      return (await fetch("/api/auth/nonce", { credentials: "include" }).then((r) => r.json())).nonce;
    },
    createMessage(params) {
      return XRPLWalletKitAuth.formatAuthMessage(params);
    },
    async verify(params) {
      const response = await fetch("/api/auth/verify", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(params)
      });
      return response.ok;
    }
  }, {
    domain: location.host,
    uri: location.origin,
    chainId: "xrpl:0"
  });

  return auth.signIn();
}
```

Do not verify signatures in browser-only legacy code. The nonce must be generated, stored, validated, and invalidated by the server.
