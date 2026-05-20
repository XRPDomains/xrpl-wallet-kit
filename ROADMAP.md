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
