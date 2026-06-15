# @xrpl-wallet-kit/adapter-gemwallet

GemWallet adapter for XRPL Wallet Kit.

GemWallet is an XRPL browser extension wallet. This adapter wraps the `@gemwallet/api` package and normalizes account, message signing, payment, and NFT offer results into the XRPL Wallet Kit adapter contract.

## Capabilities

- `connect`
- `signMessage`
- `signAndSubmit`
- `payments`
- `nftOffers`

## Install

```bash
npm install @xrpl-wallet-kit/adapter-gemwallet
```

## Usage

```ts
import { createWalletKit } from "@xrpl-wallet-kit/client";
import { createGemWalletAdapter } from "@xrpl-wallet-kit/adapter-gemwallet";

const kit = createWalletKit({
  adapters: [createGemWalletAdapter()]
});
```

When using `@xrpl-wallet-kit/client` defaults, GemWallet is already included.

## Runtime Notes

- Requires the GemWallet browser extension.
- Availability is detected with `provider.isInstalled()`.
- `connect()` reads the active extension address and network.
- `restoreSession()` is passive-only. It reads the current extension address with `getAddress()` and restores only when that address matches the stored session address.
- If GemWallet cannot provide a current address during restore, the adapter returns `null` instead of reviving the stored session blindly.
- `signAndSubmit()` routes by `methodHint`:
  - `payment` -> `sendPayment`
  - `createNFTOffer` -> `createNFTOffer`
  - `acceptNFTOffer` -> `acceptNFTOffer`
  - `cancelNFTOffer` -> `cancelNFTOffer`
  - `burnNFT` or `NFTokenBurn` tx type -> `burnNFT`
  - `trustSet`, `setTrustline`, `trustset`, or `TrustSet` tx type -> `setTrustline`
- GemWallet trust line APIs expect `limitAmount`, `qualityIn`, `qualityOut`, and `flags`, so the adapter maps XRPL `TrustSet` fields such as `LimitAmount`, `QualityIn`, `QualityOut`, and `Flags` into the provider's native payload format.
- Transaction responses are normalized with `normalizeTxResult()` so submitted hashes can drive lifecycle events and WalletToast.

## Auto Reconnect

GemWallet restore is intentionally conservative. The stored dApp session is not treated as proof that the extension is still connected. On reload, the adapter must read the active GemWallet address and compare it with the stored XRPL address.

`restoreSession()` does not call connect, open extension UI, ask the user to sign in, or submit any wallet request beyond passive address inspection. Normal stale or unavailable states return `null` so the manager can emit stale/expired session events and let the user reconnect manually.

## Testing

Pass a mock provider for isolated tests:

```ts
import { assertWalletAdapter } from "@xrpl-wallet-kit/core";
import { createGemWalletAdapter } from "@xrpl-wallet-kit/adapter-gemwallet";

assertWalletAdapter(createGemWalletAdapter({ provider: mockGemWallet }));
```

## Links

- GemWallet: https://gemwallet.app
- XRPL Wallet Kit: https://github.com/XRPDomains/xrpl-wallet-kit
