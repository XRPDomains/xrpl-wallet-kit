# Folder Structure

```text
.
|-- packages/
|   |-- wallet-core/
|   |   `-- src/
|   |       |-- adapter.ts
|   |       |-- events.ts
|   |       |-- manager.ts
|   |       |-- networks.ts
|   |       |-- result.ts
|   |       |-- storage.ts
|   |       `-- types.ts
|   |-- wallet-adapters/
|   |   |-- wallet-adapter-xaman/
|   |   |-- wallet-adapter-gemwallet/
|   |   |-- wallet-adapter-crossmark/
|   |   |-- wallet-adapter-walletconnect/
|   |   |-- wallet-adapter-dropfi/
|   |   |-- wallet-adapter-xrpl-snap/
|   |   `-- wallet-adapter-ledger/
|   |-- wallet-ui/
|   |-- wallet-react/
|   |-- wallet-next/
|   `-- wallet-kit/
|-- examples/
|   `-- vanilla/
`-- docs/
```

The package layout is intentionally publishable as separate npm modules. `wallet-kit` is the convenience aggregate package, but apps can install only the exact adapter packages they need.
