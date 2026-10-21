<template>
  <div class="xahau-page" :data-keyboard="keyboardFocus" @pointerdown.capture="keyboardFocus = false" @keydown.tab.capture="keyboardFocus = true">
    <header class="xahau-intro">
      <p class="xahau-brand">XRPL Wallet Kit</p>
      <h1>Xahau Network</h1>
      <p class="xahau-lede">Connect wallets. Send XAH. Call Hooks.<br>One API for your Xahau dApp.</p>
      <nav class="xahau-actions" aria-label="Xahau integration">
        <a class="xahau-primary" :href="withBase('/docs/configuration/xahau')">Integration docs</a>
        <a :href="withBase('/docs/theme-builder?chain=xahau')">Theme Builder <span aria-hidden="true">&rarr;</span></a>
      </nav>
    </header>

    <div class="xahau-workbench">
    <section class="xahau-demo" aria-label="Xahau wallet connection">
      <div class="xahau-demo-toolbar">
        <h2>Try It Out</h2>
        <select id="xahau-network" v-model="network" aria-label="Network">
          <option value="xahau-mainnet">Xahau Mainnet</option>
          <option value="xahau-testnet">Xahau Testnet</option>
        </select>
      </div>
      <div class="xahau-demo-frame">
      <div class="xahau-preview-area" :data-mode="previewMode">
      <div class="xahau-mode-switch" role="group" aria-label="Preview color mode">
        <button type="button" :aria-pressed="mode === 'light'" aria-label="Light preview" title="Light" @click="mode = 'light'">
          <span class="vpi-sun" aria-hidden="true"></span>
        </button>
        <button type="button" :aria-pressed="mode === 'dark'" aria-label="Dark preview" title="Dark" @click="mode = 'dark'">
          <span class="vpi-moon" aria-hidden="true"></span>
        </button>
        <button type="button" :aria-pressed="mode === 'auto'" aria-label="Follow website theme" title="Follow website theme" @click="mode = 'auto'">Auto</button>
      </div>
      <div ref="walletMount" class="xahau-wallet-mount" :aria-busy="loading">
        <p v-if="loading" class="xahau-loading" role="status">Loading wallets...</p>
      </div>
      </div>
      <div class="xahau-demo-options" role="group" aria-label="Wallet interface options">
        <label for="xahau-layout"><span>Layout</span>
          <select id="xahau-layout" v-model="layout">
            <option value="list">List</option><option value="grid">Grid</option>
            <option value="card">Card</option><option value="icon">Icon</option>
          </select>
        </label>
        <label for="xahau-button"><span>Button</span>
          <select id="xahau-button" v-model="buttonStyle">
            <option value="default">Default</option><option value="pill">Pill</option>
            <option value="minimal">Minimal</option><option value="outline">Outline</option>
          </select>
        </label>
      </div>
      </div>
      <div v-if="connectedAddress" class="xahau-session" role="status">
        <span>Connected <code>{{ connectedAddress }}</code></span>
        <button type="button" @click="disconnect">Disconnect</button>
      </div>
      <p v-if="error" class="xahau-error" role="alert">{{ error }}</p>
      <p v-if="error && !manager"><button type="button" @click="loadPreview">Retry loading wallets</button></p>
    </section>

    <section class="xahau-section xahau-integration" aria-labelledby="xahau-code-heading">
      <div class="xahau-section-heading">
        <h2 id="xahau-code-heading">Start with a network.</h2>
        <p>The full client includes Xahau presets and loads its signing runtime on demand.</p>
      </div>
      <div class="xahau-install"><code>npm install @xrpl-wallet-kit/client</code></div>
      <div class="xahau-code-toolbar">
        <div class="xahau-tabs" role="tablist" aria-label="Integration examples">
          <button v-for="tab in tabs" :id="`xahau-tab-${tab.id}`" :key="tab.id" type="button" role="tab"
            :aria-selected="activeTab === tab.id" aria-controls="xahau-code-panel" :tabindex="activeTab === tab.id ? 0 : -1"
            @click="activeTab = tab.id" @keydown="navigateTabs($event, tab.id)">{{ tab.label }}</button>
        </div>
        <button type="button" class="xahau-copy" @click="copyCode">{{ copyLabel }}</button>
      </div>
      <div id="xahau-code-panel" class="xahau-code-panel" role="tabpanel" :aria-labelledby="`xahau-tab-${activeTab}`" tabindex="0">
        <pre><code>{{ snippets[activeTab] }}</code></pre>
      </div>
      <p class="xahau-code-note">{{ exampleNote }}</p>
      <span class="xahau-sr-only" role="status">{{ copyStatus }}</span>
    </section>
    </div>

    <section class="xahau-section" aria-labelledby="xahau-wallets-heading">
      <h2 id="xahau-wallets-heading">Your users' wallets, one connection flow.</h2>
      <div class="xahau-wallet-directory">
        <a v-for="wallet in wallets" :key="wallet.id" :href="withBase(`/docs/adapters/${wallet.id}`)">
          <span class="xahau-wallet-logo" aria-hidden="true">
            <img v-if="walletIcons[wallet.id]" :src="walletIcons[wallet.id]" alt="" width="40" height="40">
          </span>
          <strong>{{ wallet.name }}</strong><span class="xahau-wallet-detail">{{ wallet.detail }}</span><span class="xahau-wallet-arrow" aria-hidden="true">&rarr;</span>
        </a>
      </div>
    </section>

    <section class="xahau-section" aria-labelledby="xahau-transactions-heading">
      <h2 id="xahau-transactions-heading">From payments to Hook calls.</h2>
      <dl class="xahau-operations">
        <div><dt>XAH &amp; tokens</dt><dd>Payment, TrustSet, OfferCreate, OfferCancel and AccountSet.</dd></div>
        <div><dt>Hooks</dt><dd>Invoke an existing Hook or attach HookParameters to a supported transaction.</dd></div>
        <div><dt>URITokens</dt><dd>Mint, create or cancel a sell offer, buy and burn. Use URIToken IDs, not XRPL NFToken offers.</dd></div>
        <div><dt>Signing</dt><dd>Return a signed blob without broadcasting, or verify and submit through the same API.</dd></div>
      </dl>
      <p class="xahau-scope">Master-key single-sign. SetHook, Batch and multisign are not supported on Xahau. Wallet support depends on the transaction and fields requested.</p>
    </section>

    <footer class="xahau-resources">
      <a :href="withBase('/docs/configuration/xahau')">Full Xahau guide <span aria-hidden="true">&rarr;</span></a>
      <a :href="withBase('/docs/frameworks/legacy-cdn')">HTML / CDN</a>
      <a :href="withBase('/docs/frameworks/react')">React</a>
      <a :href="withBase('/docs/frameworks/next')">Next.js</a>
      <a href="https://github.com/XRPDomains/xrpl-wallet-kit">GitHub</a>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useData, withBase } from 'vitepress'
import { loadWalletKit } from '../loadWalletKit'
import '../xahau.css'

const { isDark } = useData()
const keyboardFocus = ref(false)
const network = ref('xahau-mainnet')
const layout = ref<'list' | 'grid' | 'card' | 'icon'>('list')
const mode = ref<'auto' | 'light' | 'dark'>('auto')
const buttonStyle = ref<'default' | 'pill' | 'minimal' | 'outline'>('default')
const previewMode = computed(() => mode.value === 'auto' ? (isDark.value ? 'dark' : 'light') : mode.value)
const walletMount = ref<HTMLElement | null>(null)
const loading = ref(true)
const error = ref('')
const connectedAddress = ref('')
const walletIcons = ref<Record<string, string>>({})
const wallets = [
  { id: 'xaman', name: 'Xaman', detail: 'Mobile app / QR' },
  { id: 'gemwallet', name: 'GemWallet', detail: 'Browser extension' },
  { id: 'xyra', name: 'Xyra', detail: 'Web wallet' },
  { id: 'ledger', name: 'Ledger', detail: 'Hardware / explicit opt-in' },
]
const tabs = [
  { id: 'configure', label: 'Configure' }, { id: 'payment', label: 'Payment' },
  { id: 'invoke', label: 'Invoke' }, { id: 'uritoken', label: 'URIToken' },
] as const
type Example = typeof tabs[number]['id']
const activeTab = ref<Example>('configure')
const copyStatus = ref('')
const copyLabel = computed(() => copyStatus.value === 'Code copied.' ? 'Copied' : 'Copy code')
let copyTimer: ReturnType<typeof setTimeout> | undefined
let bundle: any
let manager: any = null
let picker: any = null
let connectButton: any = null
let disposed = false
let pendingLoad: Promise<void> | undefined

const snippets = computed<Record<Example, string>>(() => ({
  configure: `import { createWalletKit } from "@xrpl-wallet-kit/client";

const kit = createWalletKit({
  network: "${network.value}",
  wallets: ["xaman", "gemwallet", "xyra", "ledger"],
  xamanClientId: "YOUR_XAMAN_CLIENT_ID",
  preflight: { maxFeeDrops: "50000" },
  connectButton: "#connect-wallet",
  ui: {
    mode: "${mode.value}",
    walletList: { layout: "${layout.value}" },
    connectButton: { variant: "${buttonStyle.value}" },
  },
});`,
  payment: `// After connecting with the kit configured above:
const result = await kit.signAndSubmit({
  txJson: {
    TransactionType: "Payment",
    Destination: "<recipient_address>",
    Amount: "1000000", // 1 XAH
  },
});
console.log(result.hash);`,
  invoke: `const result = await kit.signAndSubmit({
  txJson: {
    TransactionType: "Invoke",
    Destination: "<hook_account_address>",
    HookParameters: [{
      HookParameter: {
        HookParameterName: "617070", // "app"
        HookParameterValue: "70696E67", // "ping"
      },
    }],
  },
});`,
  uritoken: `const result = await kit.signAndSubmit({
  txJson: {
    TransactionType: "URITokenBuy",
    URITokenID: "<64_character_hex_token_id>",
    Amount: "1000000", // Existing offer for 1 XAH
  },
});`,
}))
const exampleNote = computed(() => ({
  configure: 'Mount an element with id="connect-wallet". Ledger is included explicitly in this wallet list. The fee ceiling is an application limit, not a fixed fee.',
  payment: 'Replace the recipient and add DestinationTag when required. For a signed blob without broadcast, use kit.signTransaction instead.',
  invoke: 'Use the destination and parameter schema of your Hook. Parameters are uppercase hex. An Invoke may change state or emit transactions.',
  uritoken: 'Use the token ID and match the current sell-offer amount and designated buyer. Submission is not final confirmation; check the validated result.',
}[activeTab.value]))

function destroyPreview() {
  connectButton?.destroy()
  connectButton = null
  picker?.destroy()
  picker = null
  manager?.destroy()
  manager = null
  connectedAddress.value = ''
}

function renderPreview() {
  if (!bundle || !walletMount.value || disposed) return
  destroyPreview()
  error.value = ''
  manager = bundle.createWalletClient({
    network: network.value,
    wallets: wallets.map(wallet => wallet.id),
    xamanClientId: '1c7dfba7-aadd-4b03-bafb-ca5c8f84bb4f',
    preflight: { maxFeeDrops: '50000' },
    storage: 'memory',
    autoReconnect: false,
    accountStatus: { enabled: false },
  })
  walletIcons.value = Object.fromEntries(manager.getWallets().map((wallet: { id: string; icon?: string }) => [wallet.id, wallet.icon ?? '']))
  manager.on('connected', ({ account }: any) => { connectedAddress.value = account.address })
  manager.on('disconnected', () => { connectedAddress.value = '' })
  renderPreviewUi()
}

function renderPreviewUi() {
  if (!manager || !walletMount.value || disposed) return
  const wasOpen = picker?.isOpen() ?? false
  connectButton?.destroy()
  picker?.destroy()
  picker = new bundle.WalletModal({
    manager, title: 'Connect Wallet', layout: layout.value, size: 'compact', textSize: 'sm',
    themeMode: previewMode.value,
    showWalletGroup: false,
  })
  connectButton = new bundle.WalletButtonController({
    manager, modal: picker, variant: buttonStyle.value, themeMode: previewMode.value,
    showWeb3Name: false, showBalance: false, identityResolver: async () => null,
  })
  connectButton.mount(walletMount.value)
  if (wasOpen) picker.open()
}

async function loadPreview() {
  if (pendingLoad) return pendingLoad
  loading.value = true
  error.value = ''
  pendingLoad = (async () => {
    try {
      bundle = await loadWalletKit()
      if (disposed) return
      loading.value = false
      await nextTick()
      renderPreview()
    } catch {
      if (!disposed) {
        destroyPreview()
        error.value = 'Wallets could not load. Please try again.'
      }
    } finally {
      loading.value = false
      pendingLoad = undefined
    }
  })()
  return pendingLoad
}

async function disconnect() {
  try {
    await manager?.disconnect()
    renderPreview()
  } catch { error.value = 'Could not disconnect. Please try again.' }
}

function navigateTabs(event: KeyboardEvent, id: Example) {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
  event.preventDefault()
  const index = tabs.findIndex(tab => tab.id === id)
  const target = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1
    : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length
  activeTab.value = tabs[target].id
  document.getElementById(`xahau-tab-${activeTab.value}`)?.focus({ preventScroll: true })
}

async function copyCode() {
  try {
    await navigator.clipboard.writeText(snippets.value[activeTab.value])
    copyStatus.value = 'Code copied.'
  } catch { copyStatus.value = 'Copy failed. Select the code to copy it.' }
  clearTimeout(copyTimer)
  copyTimer = setTimeout(() => { copyStatus.value = '' }, 2500)
}

watch(network, () => { if (bundle) renderPreview() })
watch([layout, previewMode, buttonStyle], () => { if (manager) renderPreviewUi() })
onMounted(() => { void loadPreview() })
onUnmounted(() => {
  disposed = true
  clearTimeout(copyTimer)
  destroyPreview()
})
</script>
