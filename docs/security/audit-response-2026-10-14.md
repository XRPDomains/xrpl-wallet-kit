# Security audit response - 2026-10-14

Changes remain local and are not in npm 0.1.22.

1. Core no longer promotes a stored session when an adapter lacks passive
   `restoreSession`. Restoration also rejects changed address/adapter identity.
   The current GemWallet, Crossmark, DropFi and Otsu adapters already implement
   passive restore; the reported missing hooks were inaccurate. localStorage is
   origin-scoped, not shared with sibling subdomains by default. Wallet session
   state is never a replacement for backend authentication.
2. Both verifier paths bind the real signing public key to the requested address.
   Legacy boolean results or missing `signedBy` cannot bypass ownership checks.
   No first-Signer.Account-only fallback is used: that field does not prove key ownership.
3. Message validation rejects missing nonce checks by default. The new server
   `verifyWalletAuth` helper requires atomic consumption of a server-issued nonce
   after signature verification. Backend stores must bind challenges to the
   requester/context and reject unknown, expired or concurrently consumed nonces.
   Applications issuing sessions must migrate; an optional check alone is insufficient.
4. WalletConnect selects an account on the requested CAIP chain and validates
   classic-address checksum/format before accepting it.
5. Xaman local JWT decoding is not signature verification and does not authorize
   a login. The existing issuer `/userinfo` check remains mandatory; an issuer
   rejection regression already covers it. No unverified JWT trust was introduced.
6. URL safety uses supported wallet schemes and real URL parsing, rejects control
   characters and retains existing Bitget/Joey/Girin/Bifrost native links. Unknown
   OS/custom handlers are intentionally blocked.
7. Xyra's protocol does not echo request IDs. Existing fresh-window, exact-origin,
   source/type and single-request guards remain. Fabricating an ID would not add
   protocol security; an echoed nonce requires upstream support.

Verification uses focused core/adapter/auth regression tests and type checking.
No live transactions, npm publication, commits or deployment are part of this change.
