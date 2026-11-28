# Kyra Wallet adapter (local integration)

Opt-in hosted popup adapter for **XRPL and Xahau Mainnet and Testnet**. Kyra prepares, reviews, signs and submits transactions. The Kit receives the hash and validated outcome. The local package uses the partner SDK tarball from `vendor/` and is private pending the hosted integration.

## React preview

The Kyra team runs the wallet at `http://localhost:5173`. Set `VITE_KYRA_WALLET_ORIGIN=http://localhost:5173` and start the Kit preview on port 5174. In PowerShell:

```powershell
$env:PORT = "5174"
$env:VITE_KYRA_WALLET_ORIGIN = "http://localhost:5173"
npm run dev:react
```

Open `http://localhost:5174/?chain=xrpl&network=testnet` and select **Connect Wallet → Kyra Wallet**. Register with `kyra({ walletOrigin })` to use the adapter in another app. Use a bare wallet origin and serve the dApp on a separate origin. Leave `Cross-Origin-Opener-Policy` unset on the dApp or use `same-origin-allow-popups` so Kyra can reply to its opener.

SDK 0.4.1 uses the `kyra-wallet` channel. If the wallet does not load, times out during connection, or fails to display a balance, report the issue to the Kyra team with the dApp origin and the error shown.

## Transactions

Use **Payment** to enter a destination and amount in XRP. The local Kyra build reviews and submits direct XRP payments on XRPL Mainnet and Testnet. For the other supported transactions, open **Transaction JSON**, select **Sign and submit**, and provide intent fields only. For example, use `{"TransactionType":"TicketCreate","TicketCount":1}`. Kyra supplies fee, sequence and expiry. The supported transaction types are listed in `KYRA_SIGNABLE_TRANSACTION_TYPES`.

If a request may have been submitted and its result is unknown, check its hash or the account history before retrying. Creating and funding a local Testnet wallet and approving live transactions require an explicit test session.

## Message signing and sign-in

Use the **Message** and **Auth** tabs in the preview with an SDK 0.4.1-compatible Kyra wallet. Verify message signatures against the exact text returned in **raw.message**. Native sign-in returns a CAIP-122 message and signature. Submit a holder TrustSet through **Transaction JSON** with LimitAmount.

## Xahau

Select Xahau in the preview for direct XAH Payment and message signing. The wallet sets the fee and NetworkID. Use a wallet build that reports the corresponding methods in its connect scope. Xahau CAIP-122 sign-in is disabled in the Kit pending support for Kyra's XLS-72d chain ID in the auth flow.
