<template>
  <div class="pg-root">
    <!-- Controls panel -->
    <aside class="pg-controls">
      <div class="pg-section">
        <label class="pg-label">Layout</label>
        <div class="pg-chips">
          <button
            v-for="opt in layouts"
            :key="opt.value"
            class="pg-chip"
            :class="{ active: config.layout === opt.value }"
            @click="config.layout = opt.value"
          >{{ opt.label }}</button>
        </div>
      </div>

      <div class="pg-section">
        <label class="pg-label">Mode</label>
        <div class="pg-chips">
          <button
            v-for="opt in modes"
            :key="opt.value"
            class="pg-chip"
            :class="{ active: config.mode === opt.value }"
            @click="config.mode = opt.value"
          >{{ opt.label }}</button>
        </div>
      </div>

      <div class="pg-section">
        <label class="pg-label">Button Variant</label>
        <div class="pg-chips">
          <button
            v-for="opt in btnVariants"
            :key="opt.value"
            class="pg-chip"
            :class="{ active: config.btnVariant === opt.value }"
            @click="config.btnVariant = opt.value"
          >{{ opt.label }}</button>
        </div>
      </div>

    </aside>

    <!-- Preview panel -->
    <div class="pg-preview-wrap">
      <div
        class="pg-preview"
        :class="previewModeClass"
        ref="previewRef"
      >
        <div class="pg-preview-inner" ref="mountRef"></div>
      </div>

      <!-- Code snippet -->
      <div class="pg-code-wrap">
        <div class="pg-code-header">
          <span class="pg-code-label">Generated config</span>
          <button class="pg-copy-btn" @click="copyCode">
            {{ copied ? '✓ Copied' : 'Copy' }}
          </button>
        </div>
        <pre class="pg-code"><code>{{ codeSnippet }}</code></pre>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch, onMounted, onUnmounted } from 'vue'

// ── Config state ─────────────────────────────────────────────
const config = reactive({
  layout:      'list',
  mode:        'light',
  size:        'default',
  accent:      '#0078ae',   // lightTheme.accent default
  radius:      '14px',      // lightTheme.radius default
  walletRadius:'10px',      // lightTheme.walletRadius default
  btnVariant:  'default',   // WalletButtonController variant default
  btnSize:     'md',        // WalletButtonController size default
})

const layouts = [
  { value: 'list',  label: 'List' },
  { value: 'grid',  label: 'Grid' },
  { value: 'card',  label: 'Card' },
  { value: 'icon',  label: 'Icon' },
]
const modes  = [
  { value: 'light', label: 'Light' },
  { value: 'dark',  label: 'Dark' },
  { value: 'auto',  label: 'Auto' },
]
const btnVariants = [
  { value: 'default', label: 'Default' },
  { value: 'pill',    label: 'Pill'    },
  { value: 'minimal', label: 'Minimal' },
  { value: 'outline', label: 'Outline' },
]
// ── Refs ─────────────────────────────────────────────────────
const mountRef   = ref<HTMLElement | null>(null)
const previewRef = ref<HTMLElement | null>(null)
const copied     = ref(false)
const kitLoaded  = ref(false)
let modalInstance: any = null
let buttonInstance: any = null
let kitBundle: any = null
const KIT_BUNDLE_VERSION = '0.1.3'

// ── Preview mode CSS class ────────────────────────────────────
const previewModeClass = computed(() =>
  config.mode === 'dark' ? 'pg-preview--dark' : 'pg-preview--light'
)

// ── Code snippet ─────────────────────────────────────────────
const codeSnippet = computed(() => {
  // ── WalletModal options ──
  const themeLines: string[] = []
  if (config.accent      !== '#0078ae') themeLines.push(`    accent: "${config.accent}",`)
  if (config.radius      !== '14px')    themeLines.push(`    radius: "${config.radius}",`)
  if (config.walletRadius !== '10px')   themeLines.push(`    walletRadius: "${config.walletRadius}",`)

  const themeModeLine = config.mode   !== 'light'   ? `\n  themeMode: "${config.mode}",`   : ''
  const layoutLine    = config.layout !== 'list'    ? `\n  layout: "${config.layout}",`    : ''
  const sizeLine      = config.size   !== 'default' ? `\n  size: "${config.size}",`        : ''
  const themePart     = themeLines.length
    ? `\n  theme: {\n${themeLines.join('\n')}\n  },`
    : ''

  const modalSnippet = `const modal = new WalletModal({\n  manager,${themeModeLine}${layoutLine}${sizeLine}${themePart}\n})`

  // ── WalletButtonController options ──
  const btnLines: string[] = []
  if (config.btnVariant !== 'default') btnLines.push(`  variant: "${config.btnVariant}",`)
  if (config.btnSize    !== 'md')      btnLines.push(`  size: "${config.btnSize}",`)

  const btnSnippet = btnLines.length
    ? `\n\nconst button = new WalletButtonController({\n  manager,\n  modal,\n${btnLines.join('\n')}\n})\nbutton.mount('#connect-btn')`
    : ''

  return modalSnippet + btnSnippet
})

// ── Copy handler ─────────────────────────────────────────────
async function copyCode() {
  try {
    await navigator.clipboard.writeText(codeSnippet.value)
    copied.value = true
    setTimeout(() => copied.value = false, 2000)
  } catch {}
}

// ── Load IIFE bundle once ────────────────────────────────────
function loadKit(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (
      (window as any).XRPLWalletKit &&
      (window as any).__XRPL_WALLET_KIT_WEBSITE_BUNDLE_VERSION__ === KIT_BUNDLE_VERSION
    ) {
      kitBundle = (window as any).XRPLWalletKit
      kitLoaded.value = true
      return resolve()
    }
    // Served from website/public/ (built locally — no CDN dependency)
    const script = document.createElement('script')
    script.src = `${import.meta.env.BASE_URL}xrpl-wallet-kit.iife.min.js?v=${KIT_BUNDLE_VERSION}`
    script.onload = () => {
      kitBundle = (window as any).XRPLWalletKit
      ;(window as any).__XRPL_WALLET_KIT_WEBSITE_BUNDLE_VERSION__ = KIT_BUNDLE_VERSION
      kitLoaded.value = true
      resolve()
    }
    script.onerror = () => reject(new Error('Failed to load XRPL Wallet Kit'))
    document.head.appendChild(script)
  })
}

// ── Build demo manager — real adapter metadata, no live connections ──
function buildMockManager() {
  if (!kitBundle) return null
  const {
    WalletManager,
    createGemWalletAdapter,
    createCrossmarkAdapter,
    createDropFiAdapter,
    createXrplSnapAdapter,
    createXamanAdapter,
    createWalletConnectAdapter,
  } = kitBundle

  const adapters: any[] = []

  // Xaman first — most popular in XRPL ecosystem
  // Note: Xaman option is `apiKey`, not `clientId`
  try { adapters.push(createXamanAdapter({ apiKey: '1c7dfba7-aadd-4b03-bafb-ca5c8f84bb4f' })) } catch {}
  try { adapters.push(createGemWalletAdapter()) } catch {}
  try { adapters.push(createCrossmarkAdapter()) } catch {}
  try { adapters.push(createDropFiAdapter()) } catch {}
  try { adapters.push(createXrplSnapAdapter()) } catch {}
  try {
    adapters.push(createWalletConnectAdapter({
      projectId: '7e0944cf9202885569eb41182016baed',
      useModal:  true,       // use WalletConnect's native QR modal
      modalMode: 'always',   // show modal on both desktop + mobile
    }))
  } catch {}

  // network: string ID — mainnet is pre-registered in DEFAULT_XRPL_NETWORKS
  return new WalletManager({ adapters, network: 'mainnet' })
}

// ── Render connect button + modal in preview div ─────────────
function renderPreview() {
  if (!kitBundle || !mountRef.value) return

  // Cleanup previous instances
  if (buttonInstance) {
    try { buttonInstance.destroy() } catch {}
    buttonInstance = null
  }
  if (modalInstance) {
    try { modalInstance.destroy() } catch {}
    modalInstance = null
  }
  // Remove any lingering overlays before clearing (handles portal edge cases)
  document.querySelectorAll('.xwk-overlay').forEach(el => el.remove())

  // Root cause fix: ensureWalletStyle() (dom.js) deduplicates <style> tags by
  // content-hash. If dark styles were injected at position 1 and light at
  // position 2, switching back to light finds the existing light tag and
  // SKIPS reinsertion — leaving dark at position 2 winning the cascade.
  // Removing all xwk style tags forces fresh injection so the new theme's
  // styles always land last in <head> and win.
  document.head.querySelectorAll('style[data-xwk-style]').forEach(el => el.remove())

  const mount = mountRef.value
  mount.innerHTML = ''
  mount.style.position = 'relative'

  const { WalletModal, WalletButtonController } = kitBundle
  const manager = buildMockManager()
  if (!manager) return

  const isDark = config.mode === 'dark' ||
    (config.mode === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches)

  // Button mount target — centered in preview
  const btnWrap = document.createElement('div')
  btnWrap.style.cssText = 'display:flex;align-items:center;justify-content:center;padding:48px 24px;'
  mountRef.value.appendChild(btnWrap)

  // Create modal (not opened yet — button triggers it)
  modalInstance = new WalletModal({
    manager,
    layout:    config.layout as any,
    size:      config.size   as any,
    themeMode: config.mode   as any,
    theme: {
      accent:       config.accent,
      radius:       config.radius,
      walletRadius: config.walletRadius,
      background:   isDark ? '#111827' : '#ffffff',
      foreground:   isDark ? '#f8fafc' : '#111827',
    },
    mount: mountRef.value,
  })

  // Create connect button — clicking it opens the modal as a normal popup overlay
  // Constructor only wires event listeners; .mount() does the actual DOM render
  buttonInstance = new WalletButtonController({
    manager,
    modal:     modalInstance,
    themeMode: config.mode    as any,
    variant:   config.btnVariant as any,
    size:      config.btnSize as any,
    theme: { accent: config.accent, radius: config.radius },
  })
  buttonInstance.mount(btnWrap)
}

// ── Watch for config changes → re-render ─────────────────────
// Deep watch covers layout/size/accent/radius changes.
// Explicit watch on mode ensures dark→light transition is never missed
// (Vue may batch reactive-object watches differently from getter watches).
watch(config, () => {
  if (kitLoaded.value) renderPreview()
}, { deep: true })

watch(() => config.mode, () => {
  if (kitLoaded.value) renderPreview()
})

// ── Lifecycle ────────────────────────────────────────────────
onMounted(async () => {
  try {
    await loadKit()
    renderPreview()
  } catch (e) {
    console.warn('Playground: XRPL Wallet Kit not available', e)
  }
})

onUnmounted(() => {
  if (buttonInstance) {
    try { buttonInstance.destroy() } catch {}
  }
  if (modalInstance) {
    try { modalInstance.destroy() } catch {}
  }
})
</script>

<style scoped>
/* ── Root layout ─────────────────────────────────────────────── */
.pg-root {
  display: grid;
  grid-template-columns: 260px 1fr;
  gap: 24px;
  margin: 32px 0;
  font-family: var(--vp-font-family-base);
}

@media (max-width: 768px) {
  .pg-root {
    grid-template-columns: 1fr;
  }
}

/* ── Controls ─────────────────────────────────────────────── */
.pg-controls {
  display: flex;
  flex-direction: column;
  gap: 20px;
  background: var(--vp-c-bg-soft);
  border: 1px solid var(--vp-c-border);
  border-radius: 12px;
  padding: 20px;
}

.pg-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.pg-label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--vp-c-text-2);
}

/* ── Chip toggles ─────────────────────────────────────────── */
.pg-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.pg-chip {
  padding: 4px 12px;
  border-radius: 6px;
  border: 1px solid var(--vp-c-border);
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s, color 0.15s;
}

.pg-chip:hover {
  border-color: var(--vp-c-brand-1);
  color: var(--vp-c-brand-1);
}

.pg-chip.active {
  background: var(--vp-c-brand-soft);
  border-color: var(--vp-c-brand-1);
  color: var(--vp-c-brand-1);
  font-weight: 600;
}

/* ── Color swatches ───────────────────────────────────────── */
.pg-swatches {
  display: flex;
  gap: 8px;
  align-items: center;
}

.pg-swatch {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
  transition: transform 0.15s, border-color 0.15s;
}

.pg-swatch:hover {
  transform: scale(1.15);
}

.pg-swatch.active {
  border-color: var(--vp-c-text-1);
  transform: scale(1.15);
}

.pg-color-input {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 1px solid var(--vp-c-border);
  padding: 2px;
  cursor: pointer;
  background: none;
}

/* ── Range slider ─────────────────────────────────────────── */
.pg-range {
  width: 100%;
  accent-color: var(--vp-c-brand-1);
}

.pg-range-value {
  font-size: 11px;
  color: var(--vp-c-text-2);
  font-family: var(--vp-font-family-mono);
}

/* ── Preview ──────────────────────────────────────────────── */
.pg-preview-wrap {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.pg-preview {
  border-radius: 12px;
  border: 1px solid var(--vp-c-border);
  overflow: hidden;
  min-height: 420px;
}

.pg-preview--light {
  background: #ffffff;
}

.pg-preview--dark {
  background: #111827;  /* actual darkTheme.background */
}

.pg-preview-inner {
  padding: 16px;
  min-height: 420px;
}

/* ── Code block ───────────────────────────────────────────── */
.pg-code-wrap {
  border: 1px solid var(--vp-c-border);
  border-radius: 10px;
  overflow: hidden;
  background: var(--vp-c-bg-soft);
}

.pg-code-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 14px;
  border-bottom: 1px solid var(--vp-c-border);
  background: var(--vp-c-bg-mute);
}

.pg-code-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--vp-c-text-2);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.pg-copy-btn {
  font-size: 12px;
  padding: 3px 10px;
  border-radius: 6px;
  border: 1px solid var(--vp-c-border);
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
  cursor: pointer;
  transition: background 0.15s;
}

.pg-copy-btn:hover {
  background: var(--vp-c-bg-mute);
}

.pg-code {
  margin: 0;
  padding: 16px;
  font-size: 13px;
  line-height: 1.65;
  font-family: var(--vp-font-family-mono);
  color: var(--vp-c-text-1);
  white-space: pre;
  overflow-x: auto;
}
</style>
