# Cross-chain Bridge

Bridges connect XRPL to external networks (EVM chains, Cosmos, Solana, etc.). The wallet kit signs XRPL-side transactions — bridge protocol logic, destination-chain interactions, and claim flows are handled by the bridge's own SDK.

## Common Patterns

Most XRPL bridges use one of three mechanisms:

- **Lock-and-mint via Payment** — send XRP or IOU to a bridge custodial address; the bridge mints wrapped tokens on the destination chain
- **XRPL EVM Sidechain (XLS-38d)** — uses the native `XChainCommit` transaction to move assets to the XRPL EVM-compatible sidechain
- **Escrow / HTLC** — `EscrowCreate` with a cryptographic condition, released by the bridge when the destination-chain leg is confirmed

## Lock-and-Mint: Payment to Bridge

```ts
const evmRecipient = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045";

await manager.signAndSubmit({
  txJson: {
    TransactionType: "Payment",
    Account: manager.activeSession?.account.address,
    Destination: "<bridge_custodial_address>",
    Amount: "10000000",    // 10 XRP in drops
    DestinationTag: 0,     // check the bridge docs — many require a specific tag
    Memos: [
      {
        Memo: {
          MemoType: Buffer.from("destination_address").toString("hex").toUpperCase(),
          MemoData: Buffer.from(evmRecipient).toString("hex").toUpperCase(),
        },
      },
    ],
  },
});
```

> Memo format varies by bridge protocol. Always consult the bridge's integration docs before constructing Memo fields.

## XRPL EVM Sidechain (XLS-38d)

```ts
// Step 1: Create a claim ID on the destination chain first (bridge SDK call)
// Step 2: Commit assets on the XRPL mainchain

await manager.signAndSubmit({
  txJson: {
    TransactionType: "XChainCommit",
    Account: manager.activeSession?.account.address,
    XChainBridge: {
      LockingChainDoor:   "<mainchain_door_account>",
      LockingChainIssue:  { currency: "XRP" },
      IssuingChainDoor:   "<sidechain_door_account>",
      IssuingChainIssue:  { currency: "XRP" },
    },
    XChainClaimID:        "<claim_id>",        // obtained from bridge SDK
    Amount:               "5000000",           // 5 XRP in drops
    OtherChainDestination: "<evm_address>",
  },
});
```

## Escrow-based Bridge (HTLC)

```ts
// Step 1: Create time-locked escrow on XRPL
await manager.signAndSubmit({
  txJson: {
    TransactionType: "EscrowCreate",
    Account: manager.activeSession?.account.address,
    Destination: "<bridge_address>",
    Amount: "10000000",                                    // 10 XRP in drops
    Condition: "<crypto_condition_hex>",                   // PREIMAGE-SHA-256
    FinishAfter: Math.floor(Date.now() / 1000) + 3600,    // 1-hour window
  },
});

// Step 2: Bridge monitors the ledger, confirms destination chain, then releases
// EscrowFinish is called by the bridge (or user if bridge fails, after CancelAfter)
```

## Adapter Compatibility

| Adapter | Payment | XChainCommit | EscrowCreate | Notes |
|---------|---------|--------------|--------------|-------|
| Xaman | ✅ | ✅ | ✅ | |
| GemWallet | ✅ | ✅ | ✅ | |
| Crossmark | ✅ | ✅ | ✅ | |
| DropFi | ✅ | ✅ | ✅ | |
| WalletConnect | ✅ | ⚠️ | ✅ | `XChainCommit` support depends on the connected wallet app |
| XRPL Snap | ✅ | ✅ | ✅ | |
| Ledger | ✅ | ⚠️ | ✅ | `XChainCommit` requires XRPL app **v2.4.0+** |

## Tips

**The wallet kit signs XRPL transactions only.** Destination-chain claim transactions (claim wrapped tokens, finalise bridge) require the bridge's own SDK or UI — outside the scope of this kit.

**Always verify `DestinationTag` requirements before sending.** Sending to a bridge custodial address without the correct tag may result in permanently lost funds. The bridge documentation will specify the required tag value.

**Set a `CancelAfter` on escrow** to ensure funds are recoverable if the bridge fails to complete the destination-chain leg. After `CancelAfter`, the creator can reclaim via `EscrowCancel`.

**Test on Testnet first.** Bridge contracts on testnets are available for most major XRPL bridges. Validate the full round-trip before going live.

## Next Steps

- [Payments & Commerce](/docs/use-cases/payments) — XRP and IOU transfers
- [Events & Hooks](/docs/advanced/events-hooks) — handle `tx_confirmed` callbacks
- [Going Live](/docs/guides/going-live) — mainnet checklist
