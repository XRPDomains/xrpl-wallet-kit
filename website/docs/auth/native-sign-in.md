# Wallet-Native Sign In

Use `manager.signIn()` or `kit.signIn()` when a wallet provides its own login
protocol. Joey Wallet uses its native `signIn()` API; Kit does not replace it
with a synthetic transaction or generic message signature.

## Choose the Right API

| Purpose | API |
|---|---|
| Sign the exact text supplied by your dApp | `signMessage({ message })` |
| Request the wallet's native login proof | `signIn({ nonce, statement, resources })` |
| Keep an existing Kit message-authentication integration | Existing `authenticate()` or `createWalletAuth()` flow |

These operations are not interchangeable. Check `manager.can("signIn")` and
`manager.can("signMessage")` independently. Unsupported wallets return
`UNSUPPORTED_METHOD`; Kit never silently falls back between the two APIs.
Connecting a wallet or receiving a signature does not establish a server session.

## Browser

```ts
import { createWalletKit } from "@xrpl-wallet-kit/client";

const kit = createWalletKit({
  network: "mainnet",
  wallets: ["joey-wallet"],
});
await kit.connect("joey-wallet");

if (kit.manager.can("signIn")) {
  // Your server stores this nonce with the intended address, site, chain,
  // statement/resources, browser login session and a short expiry.
  const challenge = await fetch("/api/sign-in/nonce", {
    method: "POST",
    credentials: "same-origin",
  }).then(response => response.json());

  const proof = await kit.signIn({
    nonce: challenge.nonce,
    statement: challenge.statement,
    resources: challenge.resources,
    timeoutMs: 300000,
  });

  const response = await fetch("/api/sign-in/verify", {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(proof),
  });
  if (!response.ok) throw new Error("Sign-in verification failed");
  // Only the verified server response may establish the application session.
}
```

`nonce` is required: 8-128 printable non-space ASCII characters. Use a
cryptographically random server nonce (for example 24 random bytes encoded as
hex), not a timestamp. `statement` supports up to 512 characters; `resources`
supports up to 16 absolute URIs. `signal`, `timeoutMs`, `requestId` and request
progress follow the existing Kit request lifecycle. Local cancellation does
not necessarily close the wallet's approval screen; late results are ignored.

## Server Verification

Install server peers:

```sh
npm install @xrpl-wallet-kit/auth ripple-keypairs@^3 xrpl@^4
```

```ts
import { verifyWalletSignIn } from "@xrpl-wallet-kit/auth/verifiers";

// Load trusted, unexpired context from YOUR nonce store, scoped to the browser
// login session. Never derive expected values from the submitted proof.
const expected = await nonceStore.findForSession(loginSessionId, proof.nonce);
if (!expected) throw new Error("Invalid sign-in challenge");

const verified = await verifyWalletSignIn(proof, {
  address: expected.address,
  chainId: expected.chainId,
  domain: expected.domain,       // example.com (include port if applicable)
  uri: expected.uri,             // https://example.com, matching the wallet origin
  nonce: expected.nonce,
  statement: expected.statement,
  resources: expected.resources,
  maxAgeMs: 300000,
  consumeNonce: context => nonceStore.consumeOutstanding(loginSessionId, context),
});
if (!verified) throw new Error("Invalid or replayed sign-in proof");
// Issue your application's secure session cookie for expected.address here.
```

`nonceStore` represents your backend storage. `consumeOutstanding()` must
atomically succeed only once, check expiry and match the stored login context.
It must return `false` for consumed or expired challenges, including concurrent
requests. The helper requires this callback; signature verification alone is
not replay protection. Protect these endpoints with your normal session,
origin/CSRF controls, body-size limits and rate limits.

## Proof Types

| Mode | Result | Verification |
|---|---|---|
| `caip122` | `signatureKind: "signature"`, `message`, `signature`, `publicKey` | Exact message, site, chain, nonce, statement/resources, issue time, signature and account-key binding |
| `challenge-v1` | `signatureKind: "signedTx"`, `txBlob` | Joey's canonical self-Payment challenge, memo nonce, signature and account-key binding |

Both results include `address`, `chainId`, `nonce` and `proof`. The challenge
branch is used for Ledger accounts inside Joey; the transaction is signed but
never submitted. Do not submit an authentication proof yourself.

The hardware challenge directly signs the nonce, not a CAIP-122 message or its
statement/resources. Site, chain and freshness must therefore be bound to the
one-time nonce in the server's login session. Do not treat it as signed consent
to arbitrary resource permissions.

The existing `verifyWalletAuth()` message-auth verifier does not verify these
native formats. Use `verifyWalletSignIn()` for native proofs and retain the
existing verifier for existing message-auth flows. This helper currently
supports Joey's CAIP-122 template and `challenge-v1` format.
