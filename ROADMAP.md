# XRPL Wallet Kit Roadmap

## UI Internationalization

Status: planned

Direction:

- Follow a ConnectKit-style translation model: consumers pass a `language` option and the kit selects a built-in translation preset.
- Do not call external translation APIs at runtime. Wallet UI copy should remain deterministic, fast, and reviewable.
- Start with built-in `en-US` and `vi-VN`.
- Support `language: "auto"` by reading `navigator.language` and falling back to `en-US`.
- Allow partial custom overrides through a `translations` object.
- Keep one shared translation schema for `wallet-ui`, `client`, and `react`.

Proposed API:

```ts
createWalletKit({
  ui: {
    language: "vi-VN",
    translations: {
      connectWallet: "Kết nối ví"
    }
  }
});
```

Planned schema areas:

- Modal title and wallet list labels
- QR panel copy
- Connecting/loading/error states
- Connect button states
- Account panel actions
- Installed/recommended badges
- Accessibility labels for close/back/copy buttons

Initial language targets:

- `en-US`
- `vi-VN`
- `auto`

Later candidates:

- `ja-JP`
- `ko-KR`
- `zh-CN`
- `th-TH`
- `id-ID`
- `es-ES`
- `fr-FR`

## Xaman xApp Environment Support

Status: later / post-beta

Reason:

- dApps using XRPL Wallet Kit can also be opened directly inside the Xaman wallet as xApps.
- This is valuable, but should not be pulled into the current beta scope until existing connect, signing, WalletConnect, mobile, and legacy HTML issues are stable.

Direction:

- Add environment detection for Xaman xApp runtime without making the core Xaman-only.
- Allow the Xaman adapter to run in `browser`, `xapp`, or `auto` mode.
- In xApp mode, hydrate the active account from Xaman xApp context instead of showing normal connect/QR/deeplink UX.
- Map `xAppStyle` (`LIGHT`, `DARK`, `MOONLIGHT`, `ROYAL`) to wallet-kit theme defaults.
- Support `xumm.xapp.ready()` so apps can avoid a double loader inside Xaman.
- Prefer Xaman-native UI actions where appropriate, such as `openBrowser`, QR scanner, and destination picker.
- Consider a Xaman userstore-backed storage adapter for xApp sessions/preferences.

Possible package/API:

```ts
createWalletKit({
  xaman: {
    mode: "auto",
    xApp: true,
    apiKey: "..."
  },
  ui: {
    themeName: "auto"
  }
});
```

Possible future package:

```txt
@xrpl-wallet-kit/xaman-xapp
```

Deferred until:

- Current wallet adapters are stable across desktop/mobile.
- WalletConnect custom/default flows are stable.
- Connect Button and Account Panel beta UX are stable.
- Legacy HTML/browser bundle integration is stable enough for real deployments.

## Xahau Network Support

Status: later / post-beta

Reason:

- Xahau is growing in the XRPL ecosystem and is based on the XRPL protocol family, but it has important network-level differences.
- It should be supported as a first-class XRPL-family network, not patched in as a one-off custom RPC.
- Current beta priority remains stabilizing existing XRPL wallet connect, signing, WalletConnect, mobile, and legacy HTML flows.

Known network presets:

```ts
{
  id: "xahau-mainnet",
  name: "Xahau Mainnet",
  family: "xrpl",
  nativeAsset: "XAH",
  rpcUrl: "wss://xahau.network",
  httpRpcUrl: "https://xahau.network",
  networkId: 21337,
  definitionsUrl: "https://xahau.network/server_definitions.json",
  explorerTxUrl: "https://explorer.xahau.network/transactions/{hash}"
}

{
  id: "xahau-testnet",
  name: "Xahau Testnet",
  family: "xrpl",
  nativeAsset: "XAH",
  rpcUrl: "wss://xahau-test.net",
  httpRpcUrl: "https://xahau-test.net",
  networkId: 21338,
  definitionsUrl: "https://xahau-test.net/server_definitions.json"
}
```

Phase 1:

- Extend the network registry with Xahau mainnet/testnet presets.
- Add `nativeAsset`, `networkId`, `httpRpcUrl`, and `definitionsUrl` to network metadata.
- Make UI labels and balance formatting use `network.nativeAsset` instead of assuming XRP.
- Test basic connect, balance, and payment flows where wallet adapters support Xahau.

Phase 2:

- Add adapter-level supported network metadata, e.g. `supportedNetworks` / `unsupportedReason`.
- Check Xaman, GemWallet, Crossmark, and WalletConnect wallet support for Xahau before exposing those options.
- Show clear UI states when a selected wallet does not support the active Xahau network.

Phase 3:

- Add dynamic network definitions loading from `server_definitions.json` for Hooks-enabled networks.
- Ensure Xahau transactions include `NetworkID` to prevent replay across networks.
- Add advanced fee estimation support for Hook execution where needed.

Phase 4:

- Add Hook-aware transaction helpers for `SetHook`, `Invoke`, and related Xahau transaction flows.
- Consider a dedicated package:

```txt
@xrpl-wallet-kit/network-xahau
```

Docs/examples:

- Add `Using Wallet Kit with Xahau` guide.
- Add example network switcher for XRPL Mainnet/Testnet and Xahau Mainnet/Testnet.
- Document limitations per wallet adapter.
