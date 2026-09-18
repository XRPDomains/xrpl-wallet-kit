# Adapter network consistency

The network selected by `WalletManager` is authoritative for a connection attempt. Adapters should report wallet-observed network state on `account.network` or `account.networkType` whenever the provider exposes it.

- A reported network id or type that differs from the requested network fails with `NETWORK_MISMATCH` during connect, restore, or recovery.
- If a wallet does not expose network state, the manager associates the requested network with the session.
- Mutable providers must revalidate their active chain before signing. WalletConnect does this against the active CAIP chain and stored session; extension adapters query provider state where their SDK exposes it.
- Ledger uses the requested network because the XRP device app does not report a connected ledger network. Hardware sessions are never silently restored.

Adapters must not replace an unsupported requested network with a default network. Return a typed connection error or a wallet-reported mismatch instead.
