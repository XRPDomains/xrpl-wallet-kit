<template>
  <div class="tb-root">
    <!-- Topbar — overlays VitePress nav, provides its own back button -->
    <div class="tb-topbar">
      <button class="tb-back-btn" @click="goBack">← Back</button>
      <span class="tb-brand">XRPL Wallet Kit</span>
    </div>

    <div class="tb-inner">
      <!-- Header -->
      <header class="tb-header">
        <div class="tb-header-left">
          <h1 class="tb-title">Theme Builder</h1>
          <p class="tb-subtitle">Configure the wallet modal live — copy the generated config when you're done.</p>
        </div>
        <div class="tb-presets">
          <span class="tb-presets-label">Presets</span>
          <button
            v-for="p in presets" :key="p.id"
            class="tb-preset-btn" :class="{ active: activePreset === p.id }"
            @click="applyPreset(p)"
          >{{ p.label }}</button>
        </div>
      </header>

      <!-- Main: accordion controls + preview -->
      <div class="tb-main">
        <aside class="tb-controls">

          <!-- Group: Display -->
          <div class="tb-group">
            <button class="tb-group-hd" @click="toggle('display')">
              <span>Display</span>
              <span class="tb-arrow" :class="{ open: !collapsed.display }">▾</span>
            </button>
            <div v-show="!collapsed.display" class="tb-group-bd">
              <div class="tb-section">
                <div class="tb-section-title">Layout</div>
                <select class="tb-select" :value="config.layout"
                  @change="setConfig('layout', ($event.target as HTMLSelectElement).value)">
                  <option v-for="opt in layouts" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
                </select>
              </div>
              <div class="tb-section">
                <div class="tb-section-title">Mode</div>
                <div class="tb-chips">
                  <button v-for="opt in modes" :key="opt.value" class="tb-chip"
                    :class="{ active: config.mode === opt.value }"
                    @click="setConfig('mode', opt.value)">{{ opt.label }}</button>
                </div>
              </div>
              <div class="tb-section">
                <div class="tb-section-title">Modal Size</div>
                <div class="tb-chips">
                  <button v-for="opt in sizes" :key="opt.value" class="tb-chip"
                    :class="{ active: config.size === opt.value }"
                    @click="setConfig('size', opt.value)">{{ opt.label }}</button>
                </div>
              </div>
              <div class="tb-section">
                <div class="tb-section-title">Font</div>
                <select class="tb-select" :value="config.fontFamily"
                  @change="setConfig('fontFamily', ($event.target as HTMLSelectElement).value)">
                  <option v-for="opt in fontOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
                </select>
              </div>
            </div>
          </div>

          <!-- Group: Connect Button -->
          <div class="tb-group">
            <button class="tb-group-hd" @click="toggle('button')">
              <span>Connect Button</span>
              <span class="tb-arrow" :class="{ open: !collapsed.button }">▾</span>
            </button>
            <div v-show="!collapsed.button" class="tb-group-bd">
              <div class="tb-section">
                <div class="tb-section-title">Style</div>
                <select class="tb-select" :value="config.btnVariant"
                  @change="setConfig('btnVariant', ($event.target as HTMLSelectElement).value)">
                  <option v-for="opt in btnVariants" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
                </select>
              </div>
              <div class="tb-section">
                <div class="tb-section-title">Size</div>
                <div class="tb-chips">
                  <button v-for="opt in btnSizes" :key="opt.value" class="tb-chip"
                    :class="{ active: config.btnSize === opt.value }"
                    @click="setConfig('btnSize', opt.value)">{{ opt.label }}</button>
                </div>
              </div>
            </div>
          </div>

          <!-- Group: Colors -->
          <div class="tb-group">
            <button class="tb-group-hd" @click="toggle('colors')">
              <span>Colors</span>
              <span class="tb-arrow" :class="{ open: !collapsed.colors }">▾</span>
            </button>
            <div v-show="!collapsed.colors" class="tb-group-bd">
              <div class="tb-section">
                <div class="tb-section-title">Accent</div>
                <div class="tb-swatches">
                  <button v-for="sw in swatches" :key="sw.value" class="tb-swatch"
                    :class="{ active: config.accent === sw.value }"
                    :style="{ background: sw.value }" :title="sw.label"
                    @click="setConfig('accent', sw.value)"></button>
                  <input type="color" class="tb-color-input" :value="config.accent"
                    @input="setConfig('accent', ($event.target as HTMLInputElement).value)" />
                </div>
              </div>
              <div class="tb-section">
                <div class="tb-section-title">Accent Text</div>
                <div class="tb-color-row">
                  <input type="color" class="tb-color-input" :value="config.accentText || '#ffffff'"
                    @input="setConfig('accentText', ($event.target as HTMLInputElement).value)" />
                  <input type="text" class="tb-color-text" :value="config.accentText" placeholder="default"
                    @input="setConfig('accentText', ($event.target as HTMLInputElement).value)" />
                  <button v-if="config.accentText" class="tb-reset-btn" @click="setConfig('accentText', '')">✕</button>
                </div>
              </div>
              <div class="tb-section">
                <div class="tb-section-title">Success</div>
                <div class="tb-color-row">
                  <input type="color" class="tb-color-input" :value="config.success || (config.mode === 'dark' ? '#34d399' : '#059669')"
                    @input="setConfig('success', ($event.target as HTMLInputElement).value)" />
                  <input type="text" class="tb-color-text" :value="config.success" placeholder="default"
                    @input="setConfig('success', ($event.target as HTMLInputElement).value)" />
                  <button v-if="config.success" class="tb-reset-btn" @click="setConfig('success', '')">✕</button>
                </div>
              </div>
              <div class="tb-section">
                <div class="tb-section-title">Error</div>
                <div class="tb-color-row">
                  <input type="color" class="tb-color-input" :value="config.error || (config.mode === 'dark' ? '#fbbf24' : '#b45309')"
                    @input="setConfig('error', ($event.target as HTMLInputElement).value)" />
                  <input type="text" class="tb-color-text" :value="config.error" placeholder="default"
                    @input="setConfig('error', ($event.target as HTMLInputElement).value)" />
                  <button v-if="config.error" class="tb-reset-btn" @click="setConfig('error', '')">✕</button>
                </div>
              </div>
              <div class="tb-section">
                <div class="tb-section-title">Background</div>
                <div class="tb-color-row">
                  <input type="color" class="tb-color-input"
                    :value="config.background || (config.mode === 'dark' ? '#111827' : '#ffffff')"
                    @input="setConfig('background', ($event.target as HTMLInputElement).value)" />
                  <input type="text" class="tb-color-text" :value="config.background" placeholder="default"
                    @input="setConfig('background', ($event.target as HTMLInputElement).value)" />
                  <button v-if="config.background" class="tb-reset-btn" @click="setConfig('background', '')">✕</button>
                </div>
              </div>
              <div class="tb-section">
                <div class="tb-section-title">Text</div>
                <div class="tb-color-row">
                  <input type="color" class="tb-color-input"
                    :value="config.foreground || (config.mode === 'dark' ? '#f8fafc' : '#111827')"
                    @input="setConfig('foreground', ($event.target as HTMLInputElement).value)" />
                  <input type="text" class="tb-color-text" :value="config.foreground" placeholder="default"
                    @input="setConfig('foreground', ($event.target as HTMLInputElement).value)" />
                  <button v-if="config.foreground" class="tb-reset-btn" @click="setConfig('foreground', '')">✕</button>
                </div>
              </div>
              <div class="tb-section">
                <div class="tb-section-title">Muted</div>
                <div class="tb-color-row">
                  <input type="color" class="tb-color-input" :value="config.muted || '#64748b'"
                    @input="setConfig('muted', ($event.target as HTMLInputElement).value)" />
                  <input type="text" class="tb-color-text" :value="config.muted" placeholder="default"
                    @input="setConfig('muted', ($event.target as HTMLInputElement).value)" />
                  <button v-if="config.muted" class="tb-reset-btn" @click="setConfig('muted', '')">✕</button>
                </div>
              </div>
              <div class="tb-section">
                <div class="tb-section-title">Surface</div>
                <div class="tb-color-row">
                  <input type="color" class="tb-color-input"
                    :value="config.surface || (config.mode === 'dark' ? '#1e293b' : '#f8fafc')"
                    @input="setConfig('surface', ($event.target as HTMLInputElement).value)" />
                  <input type="text" class="tb-color-text" :value="config.surface" placeholder="default"
                    @input="setConfig('surface', ($event.target as HTMLInputElement).value)" />
                  <button v-if="config.surface" class="tb-reset-btn" @click="setConfig('surface', '')">✕</button>
                </div>
              </div>
              <div class="tb-section">
                <div class="tb-section-title">Surface Hover</div>
                <div class="tb-color-row">
                  <input type="color" class="tb-color-input"
                    :value="config.surfaceHover || (config.mode === 'dark' ? '#263244' : '#f1f5f9')"
                    @input="setConfig('surfaceHover', ($event.target as HTMLInputElement).value)" />
                  <input type="text" class="tb-color-text" :value="config.surfaceHover" placeholder="default"
                    @input="setConfig('surfaceHover', ($event.target as HTMLInputElement).value)" />
                  <button v-if="config.surfaceHover" class="tb-reset-btn" @click="setConfig('surfaceHover', '')">✕</button>
                </div>
              </div>
              <div class="tb-section">
                <div class="tb-section-title">Border</div>
                <div class="tb-color-row">
                  <input type="color" class="tb-color-input" :value="config.border || '#e2e8f0'"
                    @input="setConfig('border', ($event.target as HTMLInputElement).value)" />
                  <input type="text" class="tb-color-text" :value="config.border" placeholder="default"
                    @input="setConfig('border', ($event.target as HTMLInputElement).value)" />
                  <button v-if="config.border" class="tb-reset-btn" @click="setConfig('border', '')">✕</button>
                </div>
              </div>
              <div class="tb-section">
                <div class="tb-section-title">Backdrop</div>
                <div class="tb-color-row">
                  <input type="color" class="tb-color-input" :value="config.overlay || '#00000080'"
                    @input="setConfig('overlay', ($event.target as HTMLInputElement).value)" />
                  <input type="text" class="tb-color-text" :value="config.overlay" placeholder="rgba(0,0,0,0.5)"
                    @input="setConfig('overlay', ($event.target as HTMLInputElement).value)" />
                  <button v-if="config.overlay" class="tb-reset-btn" @click="setConfig('overlay', '')">✕</button>
                </div>
              </div>
              <div class="tb-section">
                <div class="tb-section-title">Overlay Blur <span class="tb-value">{{ config.overlayBlur }}px</span></div>
                <input type="range" min="0" max="24" step="2" :value="config.overlayBlur"
                  @input="setNumberConfig('overlayBlur', Number(($event.target as HTMLInputElement).value))"
                  class="tb-range" />
              </div>
              <div class="tb-section">
                <div class="tb-section-title">Header Background</div>
                <div class="tb-color-row">
                  <input type="color" class="tb-color-input"
                    :value="config.headerBackground || (config.mode === 'dark' ? '#111827' : '#ffffff')"
                    @input="setConfig('headerBackground', ($event.target as HTMLInputElement).value)" />
                  <input type="text" class="tb-color-text" :value="config.headerBackground" placeholder="default"
                    @input="setConfig('headerBackground', ($event.target as HTMLInputElement).value)" />
                  <button v-if="config.headerBackground" class="tb-reset-btn" @click="setConfig('headerBackground', '')">✕</button>
                </div>
              </div>
              <div class="tb-section">
                <div class="tb-section-title">Spinner Trail</div>
                <div class="tb-color-row">
                  <input type="color" class="tb-color-input"
                    :value="config.spinnerTrail || (config.mode === 'dark' ? '#1f2937' : '#e5e7eb')"
                    @input="setConfig('spinnerTrail', ($event.target as HTMLInputElement).value)" />
                  <input type="text" class="tb-color-text" :value="config.spinnerTrail" placeholder="default"
                    @input="setConfig('spinnerTrail', ($event.target as HTMLInputElement).value)" />
                  <button v-if="config.spinnerTrail" class="tb-reset-btn" @click="setConfig('spinnerTrail', '')">✕</button>
                </div>
              </div>
            </div>
          </div>

          <!-- Group: Radius -->
          <div class="tb-group">
            <button class="tb-group-hd" @click="toggle('radius')">
              <span>Radius</span>
              <span class="tb-arrow" :class="{ open: !collapsed.radius }">▾</span>
            </button>
            <div v-show="!collapsed.radius" class="tb-group-bd">
              <div class="tb-section">
                <div class="tb-section-title">Modal <span class="tb-value">{{ config.radius }}</span></div>
                <input type="range" min="0" max="24" step="2" :value="parseInt(config.radius)"
                  @input="setConfig('radius', ($event.target as HTMLInputElement).value + 'px')"
                  class="tb-range" />
              </div>
              <div class="tb-section">
                <div class="tb-section-title">Item <span class="tb-value">{{ config.walletRadius }}</span></div>
                <input type="range" min="0" max="20" step="2" :value="parseInt(config.walletRadius)"
                  @input="setConfig('walletRadius', ($event.target as HTMLInputElement).value + 'px')"
                  class="tb-range" />
              </div>
            </div>
          </div>

        </aside>

        <!-- Preview column -->
        <div class="tb-preview-col">
          <div class="tb-preview-bar">
            <div class="tb-view-toggle">
              <button class="tb-view-btn" :class="{ active: previewDevice === 'desktop' }" @click="previewDevice = 'desktop'">🖥 Desktop</button>
              <button class="tb-view-btn" :class="{ active: previewDevice === 'mobile' }" @click="previewDevice = 'mobile'">📱 Mobile</button>
            </div>
          </div>
          <div class="tb-preview-outer" :class="previewDevice === 'mobile' ? 'tb-mobile' : 'tb-desktop'">
            <!-- Phone bezel (mobile only) -->
            <template v-if="previewDevice === 'mobile'">
              <div class="tb-phone">
                <div class="tb-phone-screen">
                  <!-- Status bar: time | island | icons — all on one row -->
                  <div class="tb-phone-top" :class="config.mode === 'dark' ? 'tb-dark-bg' : 'tb-light-bg'">
                    <div class="tb-phone-sb">
                      <span class="tb-phone-time">9:41</span>
                      <div class="tb-phone-island"></div>
                      <div class="tb-phone-right">
                        <span class="tb-sig">
                          <span></span><span></span><span></span><span></span>
                        </span>
                        <svg class="tb-ico" viewBox="0 0 15 11" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                          <path d="M7.5 2C9.4 2 11.2 2.8 12.5 4.1L14 2.6C12.3 1 10 0 7.5 0S2.7 1 1 2.6L2.5 4.1C3.8 2.8 5.6 2 7.5 2ZM7.5 5C8.7 5 9.8 5.5 10.6 6.3L12.1 4.9C10.9 3.8 9.3 3.1 7.5 3.1S4.1 3.8 2.9 4.9L4.4 6.3C5.2 5.5 6.3 5 7.5 5ZM7.5 8C8.1 8 8.7 8.3 9.1 8.7L10.5 7.3C9.7 6.5 8.7 6 7.5 6S5.3 6.5 4.5 7.3L5.9 8.7C6.3 8.3 6.9 8 7.5 8ZM7.5 11L9 9.5C8.6 9.1 8.1 8.9 7.5 8.9S6.4 9.1 6 9.5L7.5 11Z"/>
                        </svg>
                        <span class="tb-batt"><span class="tb-batt-fill"></span></span>
                      </div>
                    </div>
                  </div>
                  <!-- Wallet content -->
                  <div class="tb-preview-frame" :class="config.mode === 'dark' ? 'tb-dark-bg' : 'tb-light-bg'">
                    <div ref="mountRef" class="tb-mount tb-preview-mobile"></div>
                  </div>
                  <!-- Home indicator -->
                  <div class="tb-phone-btm" :class="config.mode === 'dark' ? 'tb-dark-bg' : 'tb-light-bg'">
                    <span class="tb-home-bar"></span>
                  </div>
                </div>
              </div>
            </template>
            <!-- Desktop: plain frame -->
            <template v-else>
              <div class="tb-preview-frame" :class="config.mode === 'dark' ? 'tb-dark-bg' : 'tb-light-bg'">
                <div ref="mountRef" class="tb-mount"></div>
              </div>
            </template>
          </div>
        </div>
      </div>

      <!-- Code panel -->
      <div class="tb-code-panel">
        <div class="tb-code-header">
          <span class="tb-code-label">Generated Config</span>
          <button class="tb-copy-btn" @click="copyCode">{{ copied ? '✓ Copied!' : 'Copy Code' }}</button>
        </div>
        <pre class="tb-code"><code>{{ codeSnippet }}</code></pre>
      </div>
    </div><!-- /.tb-inner -->
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'

// ── Config state ──────────────────────────────────────────────
const config = reactive({
  layout:       'list',
  mode:         'light',
  themeName:    'default',
  size:         'default',
  btnVariant:   'default',
  btnSize:      'md',
  accent:       '#0078ae',
  accentText:   '',
  success:      '',
  error:        '',
  background:   '',
  foreground:   '',
  muted:        '',
  surface:      '',
  surfaceHover: '',
  border:       '',
  overlay:      '',
  overlayBlur:  0,
  radius:       '14px',
  walletRadius: '10px',
  spinnerTrail: '',
  headerBackground: '',
  fontFamily:   '',
})

// ── Accordion collapsed state ─────────────────────────────────
const collapsed = reactive({
  display: false,
  button:  false,
  colors:  false,
  radius:  false,
})

function toggle(key: keyof typeof collapsed) {
  collapsed[key] = !collapsed[key]
}

function goBack() {
  if (window.history.length > 1) {
    window.history.back()
  } else {
    window.location.href = '/docs/playground'
  }
}

const previewDevice = ref<'desktop' | 'mobile'>('desktop')
const activePreset  = ref<string>('default')
const copied        = ref(false)
const kitLoaded     = ref(false)
const mountRef      = ref<HTMLElement | null>(null)

let modalInstance:  any = null
let buttonInstance: any = null
let kitBundle:      any = null
const KIT_BUNDLE_VERSION = '0.1.3'
let inlineObserver: MutationObserver | null = null

// ── Options ───────────────────────────────────────────────────
const layouts = [
  { value: 'list', label: 'List' },
  { value: 'grid', label: 'Grid' },
  { value: 'card', label: 'Card' },
  { value: 'icon', label: 'Icon' },
]
const modes = [
  { value: 'light', label: 'Light' },
  { value: 'dark',  label: 'Dark'  },
  { value: 'auto',  label: 'Auto'  },
]
const sizes = [
  { value: 'compact', label: 'Compact' },
  { value: 'default', label: 'Default' },
  { value: 'wide',    label: 'Wide'    },
]
const btnVariants = [
  { value: 'default', label: 'Default' },
  { value: 'pill',    label: 'Pill'    },
  { value: 'minimal', label: 'Minimal' },
  { value: 'outline', label: 'Outline' },
]
const btnSizes = [
  { value: 'sm', label: 'SM' },
  { value: 'md', label: 'MD' },
  { value: 'lg', label: 'LG' },
]
const swatches = [
  { value: '#0078ae', label: 'XRPL Blue' },
  { value: '#2563eb', label: 'Blue'      },
  { value: '#7c3aed', label: 'Violet'    },
  { value: '#059669', label: 'Emerald'   },
  { value: '#dc2626', label: 'Red'       },
  { value: '#0891b2', label: 'Cyan'      },
  { value: '#d97706', label: 'Amber'     },
  { value: '#6b7280', label: 'Slate'     },
]
const fontOptions = [
  { value: '',                                                    label: 'System (default)' },
  { value: 'Inter, sans-serif',                                   label: 'Inter' },
  { value: 'Roboto, sans-serif',                                  label: 'Roboto' },
  { value: '"Open Sans", sans-serif',                             label: 'Open Sans' },
  { value: 'Lato, sans-serif',                                    label: 'Lato' },
  { value: 'Poppins, sans-serif',                                 label: 'Poppins' },
  { value: 'Montserrat, sans-serif',                              label: 'Montserrat' },
  { value: 'Nunito, sans-serif',                                  label: 'Nunito' },
  { value: '"DM Sans", sans-serif',                               label: 'DM Sans' },
  { value: '"Plus Jakarta Sans", sans-serif',                     label: 'Plus Jakarta Sans' },
  { value: 'Outfit, sans-serif',                                  label: 'Outfit' },
  { value: 'Geist, sans-serif',                                   label: 'Geist' },
  { value: '"IBM Plex Sans", sans-serif',                         label: 'IBM Plex Sans' },
  { value: '"Source Sans 3", sans-serif',                         label: 'Source Sans 3' },
  { value: '"Noto Sans", sans-serif',                             label: 'Noto Sans' },
  { value: 'Raleway, sans-serif',                                 label: 'Raleway' },
  { value: 'Rubik, sans-serif',                                   label: 'Rubik' },
  { value: 'Manrope, sans-serif',                                 label: 'Manrope' },
  { value: 'Figtree, sans-serif',                                 label: 'Figtree' },
  { value: '"Space Grotesk", sans-serif',                         label: 'Space Grotesk' },
  { value: 'Sora, sans-serif',                                    label: 'Sora' },
  { value: '"Bricolage Grotesque", sans-serif',                   label: 'Bricolage Grotesque' },
  { value: '"Josefin Sans", sans-serif',                          label: 'Josefin Sans' },
  { value: 'Urbanist, sans-serif',                                label: 'Urbanist' },
  { value: '"ui-monospace", "Cascadia Code", Consolas, monospace', label: 'Monospace' },
  { value: '"JetBrains Mono", monospace',                         label: 'JetBrains Mono' },
  { value: '"Fira Code", monospace',                              label: 'Fira Code' },
]

// ── Presets ───────────────────────────────────────────────────
const BLANK = {
  accentText: '',
  success: '',
  error: '',
  background: '',
  foreground: '',
  muted: '',
  surface: '',
  surfaceHover: '',
  border: '',
  overlay: '',
  overlayBlur: 0,
  spinnerTrail: '',
  headerBackground: '',
  fontFamily: '',
}

const presets = [
  { id: 'default',  label: 'Default',  config: { layout: 'list', mode: 'light', themeName: 'default', size: 'default', btnVariant: 'default', btnSize: 'md', accent: '#0078ae', radius: '14px', walletRadius: '10px', ...BLANK } },
  { id: 'dark',     label: 'Dark',     config: { layout: 'list', mode: 'dark',  themeName: 'dark',    size: 'default', btnVariant: 'default', btnSize: 'md', accent: '#4aa3ff', radius: '14px', walletRadius: '10px', ...BLANK } },
  { id: 'xrpl',     label: 'XRPL',     config: { layout: 'list', mode: 'light', themeName: 'xrpl',    size: 'default', btnVariant: 'default', btnSize: 'md', accent: '#0078ae', radius: '12px', walletRadius: '10px', ...BLANK } },
  { id: 'minimal',  label: 'Minimal',  config: { layout: 'list', mode: 'light', themeName: 'minimal', size: 'compact', btnVariant: 'minimal', btnSize: 'sm', accent: '#0078ae', radius: '8px',  walletRadius: '8px',  ...BLANK } },
  { id: 'midnight', label: 'Midnight', config: { layout: 'list', mode: 'dark',  themeName: 'midnight', size: 'default', btnVariant: 'pill',    btnSize: 'md', accent: '#3b82f6', radius: '16px', walletRadius: '12px', ...BLANK, overlayBlur: 12 } },
  { id: 'glass',    label: 'Glass',    config: { layout: 'grid', mode: 'light', themeName: 'glass',   size: 'default', btnVariant: 'pill',    btnSize: 'md', accent: '#6366f1', radius: '20px', walletRadius: '14px', ...BLANK, overlayBlur: 20 } },
  { id: 'rounded',  label: 'Rounded',  config: { layout: 'card', mode: 'light', themeName: 'rounded', size: 'default', btnVariant: 'pill',    btnSize: 'lg', accent: '#7c3aed', radius: '24px', walletRadius: '16px', ...BLANK } },
  { id: 'crisp',    label: 'Crisp',    config: { layout: 'list', mode: 'light', themeName: 'crisp',   size: 'default', btnVariant: 'outline', btnSize: 'md', accent: '#111827', radius: '4px',  walletRadius: '4px',  ...BLANK } },
  { id: 'soft',     label: 'Soft',     config: { layout: 'grid', mode: 'light', themeName: 'soft',    size: 'default', btnVariant: 'default', btnSize: 'md', accent: '#7c3aed', radius: '16px', walletRadius: '12px', ...BLANK } },
]

function applyPreset(p: (typeof presets)[0]) {
  activePreset.value = p.id
  Object.assign(config, p.config)
}

function setConfig(key: keyof typeof config, value: string) {
  activePreset.value = 'custom'
  ;(config as any)[key] = value
}

function setNumberConfig(key: keyof typeof config, value: number) {
  activePreset.value = 'custom'
  ;(config as any)[key] = value
}

// ── Code snippet ──────────────────────────────────────────────
const codeSnippet = computed(() => {
  const themeLines: string[] = []
  const showThemeOverrides = activePreset.value === 'custom' ||
    config.themeName === 'default' ||
    config.themeName === 'light'
  if (showThemeOverrides) {
    if (config.accent       !== '#0078ae') themeLines.push(`    accent: "${config.accent}",`)
    if (config.accentText)                 themeLines.push(`    accentText: "${config.accentText}",`)
    if (config.success)                    themeLines.push(`    success: "${config.success}",`)
    if (config.error)                      themeLines.push(`    error: "${config.error}",`)
    if (config.radius       !== '14px')    themeLines.push(`    radius: "${config.radius}",`)
    if (config.walletRadius !== '10px')    themeLines.push(`    walletRadius: "${config.walletRadius}",`)
    if (config.background)                 themeLines.push(`    background: "${config.background}",`)
    if (config.foreground)                 themeLines.push(`    foreground: "${config.foreground}",`)
    if (config.muted)                      themeLines.push(`    muted: "${config.muted}",`)
    if (config.surface)                    themeLines.push(`    surface: "${config.surface}",`)
    if (config.surfaceHover)               themeLines.push(`    surfaceHover: "${config.surfaceHover}",`)
    if (config.border)                     themeLines.push(`    border: "${config.border}",`)
    if (config.overlay)                    themeLines.push(`    overlay: "${config.overlay}",`)
    if (config.overlayBlur)                themeLines.push(`    overlayBlur: ${config.overlayBlur},`)
    if (config.spinnerTrail)               themeLines.push(`    spinnerTrail: "${config.spinnerTrail}",`)
    if (config.headerBackground)           themeLines.push(`    headerBackground: "${config.headerBackground}",`)
    if (config.fontFamily)                 themeLines.push(`    fontFamily: "${config.fontFamily}",`)
  }

  const themeModeLine = config.mode   !== 'light'   ? `\n  themeMode: "${config.mode}",`   : ''
  const themeNameLine = config.themeName !== 'default' && config.themeName !== 'light' ? `\n  themeName: "${config.themeName}",` : ''
  const layoutLine    = config.layout !== 'list'    ? `\n  layout: "${config.layout}",`    : ''
  const sizeLine      = config.size   !== 'default' ? `\n  size: "${config.size}",`        : ''
  const themePart     = themeLines.length ? `\n  theme: {\n${themeLines.join('\n')}\n  },` : ''

  const modalSnippet = `const modal = new WalletModal({\n  manager,${themeModeLine}${themeNameLine}${layoutLine}${sizeLine}${themePart}\n})`

  const btnLines: string[] = []
  if (config.themeName !== 'default' && config.themeName !== 'light') btnLines.push(`  themeName: "${config.themeName}",`)
  if (config.btnVariant !== 'default') btnLines.push(`  variant: "${config.btnVariant}",`)
  if (config.btnSize    !== 'md')      btnLines.push(`  size: "${config.btnSize}",`)

  const btnSnippet = btnLines.length
    ? `\n\nconst button = new WalletButtonController({\n  manager,\n  modal,\n${btnLines.join('\n')}\n})\nbutton.mount('#connect-btn')`
    : ''

  return modalSnippet + btnSnippet
})

async function copyCode() {
  try {
    await navigator.clipboard.writeText(codeSnippet.value)
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
  } catch {}
}

// ── IIFE loader ───────────────────────────────────────────────
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

function buildMockManager() {
  if (!kitBundle) return null
  const { WalletManager, createGemWalletAdapter, createCrossmarkAdapter, createDropFiAdapter,
          createXrplSnapAdapter, createXamanAdapter, createWalletConnectAdapter } = kitBundle

  const adapters: any[] = []
  try { adapters.push(createXamanAdapter({ apiKey: '1c7dfba7-aadd-4b03-bafb-ca5c8f84bb4f' })) } catch {}
  try { adapters.push(createGemWalletAdapter()) } catch {}
  try { adapters.push(createCrossmarkAdapter()) } catch {}
  try { adapters.push(createDropFiAdapter()) } catch {}
  try { adapters.push(createXrplSnapAdapter()) } catch {}
  try {
    adapters.push(createWalletConnectAdapter({ projectId: '7e0944cf9202885569eb41182016baed', useModal: true, modalMode: 'always' }))
  } catch {}

  return new WalletManager({ adapters, network: 'mainnet' })
}

function renderPreview() {
  if (!kitBundle || !mountRef.value) return

  if (inlineObserver) { inlineObserver.disconnect(); inlineObserver = null }
  if (buttonInstance) { try { buttonInstance.destroy() } catch {}; buttonInstance = null }
  if (modalInstance)  { try { modalInstance.destroy()  } catch {}; modalInstance  = null }
  document.querySelectorAll('.xwk-overlay').forEach(el => el.remove())
  document.head.querySelectorAll('style[data-xwk-style]').forEach(el => el.remove())

  const mount = mountRef.value
  mount.innerHTML = ''
  mount.style.position = 'relative'

  const { WalletModal, WalletButtonController } = kitBundle
  const manager = buildMockManager()
  if (!manager) return

  const btnWrap = document.createElement('div')
  btnWrap.style.cssText = 'display:flex;align-items:center;justify-content:center;padding:32px 24px 16px;'
  mount.appendChild(btnWrap)

  const themeObj: Record<string, string | number> = {
    accent:       config.accent,
    radius:       config.radius,
    walletRadius: config.walletRadius,
  }
  if (config.accentText) themeObj.accentText = config.accentText
  if (config.success)    themeObj.success    = config.success
  if (config.background) themeObj.background = config.background
  if (config.foreground) themeObj.foreground = config.foreground
  if (config.muted)      themeObj.muted      = config.muted
  if (config.surface)    themeObj.surface     = config.surface
  if (config.surfaceHover) themeObj.surfaceHover = config.surfaceHover
  if (config.border)     themeObj.border      = config.border
  if (config.overlay)    themeObj.overlay     = config.overlay
  if (config.overlayBlur) themeObj.overlayBlur = config.overlayBlur
  if (config.spinnerTrail) themeObj.spinnerTrail = config.spinnerTrail
  if (config.headerBackground) themeObj.headerBackground = config.headerBackground
  if (config.fontFamily) themeObj.fontFamily  = config.fontFamily

  modalInstance = new WalletModal({
    manager,
    layout:    config.layout as any,
    size:      config.size   as any,
    themeName: config.themeName as any,
    themeMode: config.mode   as any,
    theme:     themeObj,
    mount,
  })

  // Persistent observer: moves every overlay SDK creates (incl. internal nav) into preview frame
  const isMobile = previewDevice.value === 'mobile'
  inlineObserver = setupInlineObserver(mount, isMobile)

  buttonInstance = new WalletButtonController({
    manager,
    modal:     modalInstance,
    themeName: config.themeName as any,
    themeMode: config.mode     as any,
    variant:   config.btnVariant as any,
    size:      config.btnSize  as any,
    theme: themeObj,
  })
  buttonInstance.mount(btnWrap)

  // Auto-open modal (theme builder always shows full modal UI)
  requestAnimationFrame(() => {
    try { modalInstance?.open() } catch {}
  })
}


// ── Inline containment (persistent: catches every internal SDK mount() call) ──

/** WalletModal overlay — class: xwk-overlay, inner: .xwk-modal */
function applyOverlayContainment(overlay: HTMLElement, container: HTMLElement, isMobile: boolean) {
  if (overlay.parentElement !== container) container.appendChild(overlay)

  Object.assign(overlay.style, {
    position:        'relative',
    inset:           'unset',
    zIndex:          '1',
    backgroundColor: 'transparent',
    width:           '100%',
  })

  if (isMobile) {
    // flex:1 fills remaining height in mount (after btnWrap) — not height:100% which would overflow
    Object.assign(overlay.style, {
      display:        'flex',
      flexDirection:  'column',
      justifyContent: 'flex-end',
      alignItems:     'stretch',
      flex:           '1',
      height:         'unset',
      minHeight:      'unset',
      padding:        '0',
      overflowY:      'hidden',
    })
    const applyModal = () => {
      const modal = overlay.querySelector('.xwk-modal') as HTMLElement | null
      if (!modal) { requestAnimationFrame(applyModal); return }
      Object.assign(modal.style, {
        width:                   '100%',
        maxWidth:                'none',
        // Let SDK height logic control vertical size, but cap at container
        maxHeight:               '100%',
        borderBottomLeftRadius:  '0',
        borderBottomRightRadius: '0',
        borderBottom:            'none',
        borderLeft:              'none',
        borderRight:             'none',
        transform:               'none',
      })
    }
    requestAnimationFrame(applyModal)
  } else {
    Object.assign(overlay.style, {
      display:    'grid',
      placeItems: 'start center',
      minHeight:  '520px',
      padding:    '32px 16px 24px',
    })
  }
}

/** WalletButton account panel portal — class: xwk-account-portal
 *  Structure: xwk-account-portal > xwk-account-overlay (position:fixed) > xwk-account-panel-modal
 *  Always appended to document.body. Must fix ALL 3 layers.
 *  Called on initial containment AND re-called on every portal re-render (QR view, back button). */
function applyPortalInnerStyles(
  portal:   HTMLElement,
  backdrop: HTMLElement,
  panel:    HTMLElement,
  isMobile: boolean,
) {
  // Always: un-fix backdrop + clear overlay tint
  Object.assign(backdrop.style, {
    position:   'relative',
    inset:      'unset',
    background: 'transparent',
  })

  if (isMobile) {
    // flex:1 fills remaining height in mount (after btnWrap)
    Object.assign(portal.style, {
      flex:          '1',
      height:        'unset',
      minHeight:     'unset',
      display:       'flex',
      flexDirection: 'column',
    })
    // Backdrop fills portal → align-items:flex-end pushes panel to bottom
    Object.assign(backdrop.style, {
      width:          '100%',
      flex:           '1',
      height:         'unset',
      display:        'flex',
      alignItems:     'flex-end',
      justifyContent: 'stretch',
      padding:        '0',
    })
    // Panel: full-width bottom sheet, no border-radius at bottom
    Object.assign(panel.style, {
      width:                   '100%',
      maxWidth:                'none',
      maxHeight:               '100%',
      borderBottomLeftRadius:  '0',
      borderBottomRightRadius: '0',
      borderBottom:            'none',
      borderLeft:              'none',
      borderRight:             'none',
      transform:               'none',
    })
  } else {
    // Desktop: portal as grid, backdrop transparent pass-through
    Object.assign(portal.style, {
      minHeight:  '520px',
      display:    'grid',
      placeItems: 'start center',
      padding:    '32px 16px 24px',
    })
    Object.assign(backdrop.style, { display: 'contents' })
  }
}

function applyPortalContainment(portal: HTMLElement, container: HTMLElement, isMobile: boolean) {
  if (portal.parentElement !== container) container.appendChild(portal)

  Object.assign(portal.style, {
    position: 'relative',
    inset:    'unset',
    zIndex:   '1',
    width:    '100%',
  })

  const applyInner = () => {
    const backdrop = portal.querySelector('.xwk-account-overlay') as HTMLElement | null
    const panel    = portal.querySelector('.xwk-account-panel-modal') as HTMLElement | null
    if (!backdrop || !panel) { requestAnimationFrame(applyInner); return }
    applyPortalInnerStyles(portal, backdrop, panel, isMobile)
  }
  requestAnimationFrame(applyInner)
}

function setupInlineObserver(container: HTMLElement, isMobile: boolean): MutationObserver {
  // Watch BOTH container and document.body:
  // - WalletModal overlay (.xwk-overlay): SDK → appends to options.mount (container) ✓
  // - WalletButton account portal (.xwk-account-portal): always goes to document.body
  // - Portal inner refresh (.xwk-account-overlay): portal.innerHTML replaced on QR/back →
  //   new overlay added to portal childList — caught by per-portal observe below
  const mo = new MutationObserver((mutations) => {
    for (const mut of mutations) {
      for (const node of Array.from(mut.addedNodes)) {
        if (!(node instanceof HTMLElement)) continue

        if (node.classList.contains('xwk-overlay')) {
          applyOverlayContainment(node, container, isMobile)

        } else if (node.classList.contains('xwk-account-portal')) {
          applyPortalContainment(node, container, isMobile)
          // Also watch this portal's direct children so QR/back re-renders are caught
          mo.observe(node, { childList: true })

        } else if (node.classList.contains('xwk-account-overlay')) {
          // Portal innerHTML was replaced (QR view, back button) — re-apply inner styles
          const portal = node.parentElement
          if (portal?.classList.contains('xwk-account-portal')) {
            const panel = node.querySelector('.xwk-account-panel-modal') as HTMLElement | null
            if (panel) {
              applyPortalInnerStyles(portal, node, panel, isMobile)
            } else {
              // panel not yet in DOM — rAF fallback
              requestAnimationFrame(() => {
                const p = node.querySelector('.xwk-account-panel-modal') as HTMLElement | null
                if (p) applyPortalInnerStyles(portal, node, p, isMobile)
              })
            }
          }
        }
      }
    }
  })
  mo.observe(container, { childList: true })
  mo.observe(document.body, { childList: true })

  // Catch elements already in DOM at observer start (auto-open, leftover from previous render)
  for (const el of Array.from(document.querySelectorAll('.xwk-overlay')) as HTMLElement[]) {
    applyOverlayContainment(el, container, isMobile)
  }
  for (const el of Array.from(document.querySelectorAll('.xwk-account-portal')) as HTMLElement[]) {
    applyPortalContainment(el, container, isMobile)
    mo.observe(el, { childList: true })
  }

  return mo
}

watch(config, () => { if (kitLoaded.value) renderPreview() }, { deep: true })
watch(() => config.mode, () => { if (kitLoaded.value) renderPreview() })
watch(previewDevice, async () => {
  if (kitLoaded.value) {
    await nextTick()   // wait for phone/plain frame DOM swap
    renderPreview()
  }
})

onMounted(async () => {
  try {
    await loadKit()
    renderPreview()
  } catch (e) {
    console.warn('Theme Builder: XRPL Wallet Kit not available', e)
  }
})

onUnmounted(() => {
  if (inlineObserver) { inlineObserver.disconnect(); inlineObserver = null }
  if (buttonInstance) { try { buttonInstance.destroy() } catch {} }
  if (modalInstance)  { try { modalInstance.destroy()  } catch {} }
})
</script>

<style scoped>
/* ── Root: full-screen overlay (covers VitePress nav + sidebar) ── */
.tb-root {
  position: fixed;
  inset: 0;
  z-index: 100;
  overflow-y: auto;
  background: var(--vp-c-bg);
  font-family: var(--vp-font-family-base);
}

/* ── Topbar ──────────────────────────────────────────────────── */
.tb-topbar {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 0 24px;
  height: 48px;
  background: var(--vp-c-bg);
  border-bottom: 1px solid var(--vp-c-border);
}

.tb-back-btn {
  font-size: 13px;
  font-weight: 500;
  color: var(--vp-c-brand-1);
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 6px;
  transition: background 0.15s;
}
.tb-back-btn:hover { background: var(--vp-c-brand-soft); }

.tb-brand {
  font-size: 13px;
  font-weight: 600;
  color: var(--vp-c-text-2);
}

/* ── Inner scrollable content ────────────────────────────────── */
.tb-inner {
  max-width: 1400px;
  margin: 0 auto;
  padding: 32px 24px 80px;
}

/* ── Header ──────────────────────────────────────────────────── */
.tb-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 16px;
  margin-bottom: 28px;
}

.tb-title {
  font-size: 28px;
  font-weight: 700;
  color: var(--vp-c-text-1);
  margin: 0 0 4px;
}

.tb-subtitle {
  font-size: 14px;
  color: var(--vp-c-text-2);
  margin: 0;
}

.tb-presets {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.tb-presets-label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--vp-c-text-3);
}

.tb-preset-btn {
  padding: 6px 14px;
  border-radius: 8px;
  border: 1px solid var(--vp-c-border);
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}
.tb-preset-btn:hover,
.tb-preset-btn.active {
  background: var(--vp-c-brand-soft);
  border-color: var(--vp-c-brand-1);
  color: var(--vp-c-brand-1);
  font-weight: 600;
}

/* ── Main 2-column ───────────────────────────────────────────── */
.tb-main {
  display: grid;
  grid-template-columns: 260px 1fr;
  gap: 24px;
  align-items: start;
}

@media (max-width: 900px) {
  .tb-main { grid-template-columns: 1fr; }
}

/* ── Controls sidebar ────────────────────────────────────────── */
.tb-controls {
  background: var(--vp-c-bg-soft);
  border: 1px solid var(--vp-c-border);
  border-radius: 12px;
  overflow: hidden;
  position: sticky;
  top: 64px;
  max-height: calc(100vh - 80px);
  overflow-y: auto;
}

/* ── Accordion group ─────────────────────────────────────────── */
.tb-group {
  border-bottom: 1px solid var(--vp-c-border);
}
.tb-group:last-child { border-bottom: none; }

.tb-group-hd {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 14px;
  background: none;
  border: none;
  cursor: pointer;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--vp-c-text-1);
  text-align: left;
  transition: background 0.15s;
}
.tb-group-hd:hover { background: var(--vp-c-bg-mute); }

.tb-arrow {
  font-size: 12px;
  transition: transform 0.2s;
  display: inline-block;
  color: var(--vp-c-text-3);
}
.tb-arrow.open { transform: rotate(0deg); }
.tb-arrow:not(.open) { transform: rotate(-90deg); }

.tb-group-bd {
  padding: 0 14px 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* ── Section ─────────────────────────────────────────────────── */
.tb-section {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.tb-section-title {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 10px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--vp-c-text-3);
}

.tb-value {
  font-size: 11px;
  font-weight: 500;
  color: var(--vp-c-brand-1);
  font-family: var(--vp-font-family-mono);
  text-transform: none;
  letter-spacing: 0;
}

/* ── Chips ───────────────────────────────────────────────────── */
.tb-chips { display: flex; flex-wrap: wrap; gap: 6px; }

.tb-chip {
  padding: 3px 9px;
  border-radius: 5px;
  border: 1px solid var(--vp-c-border);
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}
.tb-chip:hover { border-color: var(--vp-c-brand-1); color: var(--vp-c-brand-1); }
.tb-chip.active {
  background: var(--vp-c-brand-soft);
  border-color: var(--vp-c-brand-1);
  color: var(--vp-c-brand-1);
  font-weight: 600;
}

/* ── Swatches ────────────────────────────────────────────────── */
.tb-swatches { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }

.tb-swatch {
  width: 18px; height: 18px;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
  transition: transform 0.15s, border-color 0.15s;
}
.tb-swatch:hover { transform: scale(1.15); }
.tb-swatch.active { border-color: var(--vp-c-text-1); transform: scale(1.15); }

.tb-color-input {
  width: 22px; height: 22px;
  border-radius: 50%;
  border: 1px solid var(--vp-c-border);
  padding: 1px; cursor: pointer; background: none;
}

/* ── Range ───────────────────────────────────────────────────── */
.tb-range { width: 100%; accent-color: var(--vp-c-brand-1); }

/* ── Color row (picker + text + reset) ───────────────────────── */
.tb-color-row { display: flex; align-items: center; gap: 6px; }

.tb-color-text {
  flex: 1; min-width: 0;
  font-size: 11px;
  font-family: var(--vp-font-family-mono);
  color: var(--vp-c-text-1);
  background: var(--vp-c-bg);
  border: 1px solid var(--vp-c-border);
  border-radius: 5px;
  padding: 3px 6px;
  outline: none;
}
.tb-color-text:focus { border-color: var(--vp-c-brand-1); }
.tb-color-text::placeholder { color: var(--vp-c-text-3); }

.tb-reset-btn {
  flex-shrink: 0;
  width: 18px; height: 18px;
  border-radius: 50%;
  border: 1px solid var(--vp-c-border);
  background: var(--vp-c-bg-mute);
  color: var(--vp-c-text-3);
  font-size: 9px;
  cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  padding: 0; transition: all 0.15s;
}
.tb-reset-btn:hover { border-color: #dc2626; color: #dc2626; }

/* ── Preview column ──────────────────────────────────────────── */
.tb-preview-col { display: flex; flex-direction: column; gap: 16px; }

.tb-preview-bar { display: flex; justify-content: flex-end; }

.tb-view-toggle { display: flex; gap: 6px; }

.tb-view-btn {
  padding: 5px 14px;
  border-radius: 8px;
  border: 1px solid var(--vp-c-border);
  background: var(--vp-c-bg);
  color: var(--vp-c-text-2);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s;
}
.tb-view-btn.active,
.tb-view-btn:hover {
  border-color: var(--vp-c-brand-1);
  color: var(--vp-c-brand-1);
  background: var(--vp-c-brand-soft);
}

.tb-preview-outer { display: flex; justify-content: center; }
.tb-preview-outer.tb-desktop .tb-preview-frame { width: 100%; }
.tb-preview-outer.tb-mobile  .tb-preview-frame { width: 390px; max-width: 100%; }

.tb-preview-frame {
  border: 1px solid var(--vp-c-border);
  border-radius: 14px;
  overflow: hidden;
  min-height: 540px;
  transition: width 0.25s ease;
  isolation: isolate;
  transform: translateZ(0);
}

.tb-dark-bg  { background: #111827; }
.tb-light-bg { background: #f8fafc; }

.tb-mount { position: relative; min-height: 540px; }

/* ── Code panel ──────────────────────────────────────────────── */
.tb-code-panel {
  margin-top: 28px;
  border: 1px solid var(--vp-c-border);
  border-radius: 12px;
  overflow: hidden;
  background: var(--vp-c-bg-soft);
}

.tb-code-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  background: var(--vp-c-bg-mute);
  border-bottom: 1px solid var(--vp-c-border);
}

.tb-code-label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--vp-c-text-2);
}

.tb-copy-btn {
  font-size: 12px;
  font-weight: 600;
  padding: 4px 18px;
  border-radius: 6px;
  border: 1px solid var(--vp-c-brand-1);
  background: var(--vp-c-brand-1);
  color: #fff;
  cursor: pointer;
  transition: opacity 0.15s;
}
.tb-copy-btn:hover { opacity: 0.85; }

.tb-code {
  margin: 0;
  padding: 20px;
  font-size: 13px;
  line-height: 1.7;
  font-family: var(--vp-font-family-mono);
  color: var(--vp-c-text-1);
  white-space: pre;
  overflow-x: auto;
}

/* ── Select / dropdown ───────────────────────────────────────── */
.tb-select {
  width: 100%;
  padding: 4px 26px 4px 8px;
  border-radius: 6px;
  border: 1px solid var(--vp-c-border);
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
  font-size: 12px;
  font-family: var(--vp-font-family-base);
  cursor: pointer;
  outline: none;
  appearance: none;
  -webkit-appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath fill='%236b7280' d='M0 0l5 6 5-6z'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 9px center;
  transition: border-color 0.15s;
}
.tb-select:focus { border-color: var(--vp-c-brand-1); }
.tb-select:hover { border-color: var(--vp-c-brand-1); }

/* ── Phone bezel (mobile preview) ───────────────────────────── */
.tb-phone {
  width: 390px;
  max-width: 100%;
  background: #4a4a50;
  border-radius: 46px;
  padding: 10px;
  box-shadow:
    inset 0 0 0 1px rgba(255,255,255,0.13),
    0 0 0 1px rgba(0,0,0,0.55),
    0 18px 60px rgba(0,0,0,0.22),
    0 4px 12px rgba(0,0,0,0.16);
  position: relative;
}

/* Side buttons (decorative) */
.tb-phone::before {
  content: '';
  position: absolute;
  left: -2px;
  top: 90px;
  width: 2px;
  height: 26px;
  background: #5a5a60;
  border-radius: 2px 0 0 2px;
  box-shadow: 0 36px 0 #5a5a60, 0 70px 0 #5a5a60;
}
.tb-phone::after {
  content: '';
  position: absolute;
  right: -2px;
  top: 112px;
  width: 2px;
  height: 56px;
  background: #5a5a60;
  border-radius: 0 2px 2px 0;
}

.tb-phone-screen {
  border-radius: 37px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  /* Fixed height so the phone frame never jumps with content changes */
  height: 760px;
}

/* ── Status bar (inline: time | island | icons) ── */
.tb-phone-top {
  flex-shrink: 0;
  padding: 5px 20px 4px;
  display: flex;
  align-items: center;
}

.tb-phone-sb {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 4px;
  width: 100%;
  height: 22px; /* fixed row height so island clips exactly to row */
}

/* Island sits in the center between time and icons */
.tb-phone-island {
  width: 68px;
  height: 20px;
  background: #000;
  border-radius: 12px;
  flex-shrink: 0;
}

.tb-phone-time {
  font-size: 11px;
  font-weight: 700;
  line-height: 1;
  color: var(--vp-c-text-1);
  font-variant-numeric: tabular-nums;
  min-width: 28px;
}

.tb-phone-right {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 28px;
  justify-content: flex-end;
}

/* Signal bars */
.tb-sig {
  display: inline-flex;
  align-items: flex-end;
  gap: 1.5px;
}
.tb-sig span {
  display: block;
  width: 2px;
  background: var(--vp-c-text-1);
  border-radius: 1px;
}
.tb-sig span:nth-child(1) { height: 3px; }
.tb-sig span:nth-child(2) { height: 5px; }
.tb-sig span:nth-child(3) { height: 7px; }
.tb-sig span:nth-child(4) { height: 9px; }

/* WiFi icon */
.tb-ico {
  width: 11px;
  height: 9px;
  color: var(--vp-c-text-1);
  display: block;
}

/* Battery */
.tb-batt {
  display: inline-flex;
  align-items: center;
  width: 18px;
  height: 10px;
  border: 1px solid var(--vp-c-text-1);
  border-radius: 2px;
  padding: 1px;
  position: relative;
}
.tb-batt::after {
  content: '';
  position: absolute;
  right: -4px;
  top: 50%;
  transform: translateY(-50%);
  width: 2px;
  height: 5px;
  background: var(--vp-c-text-1);
  border-radius: 0 1px 1px 0;
}
.tb-batt-fill {
  display: block;
  width: 75%;
  height: 100%;
  background: #34c759;
  border-radius: 1px;
}

/* ── Content & home bar ── */
.tb-phone-btm {
  flex-shrink: 0;
  padding: 8px 0 10px;
  display: flex;
  justify-content: center;
}

.tb-home-bar {
  display: block;
  width: 90px;
  height: 3px;
  background: var(--vp-c-text-1);
  border-radius: 2px;
  opacity: 0.3;
}

/* Override: preview-frame inside phone needs no border-radius/border of its own */
.tb-phone .tb-preview-frame {
  border-radius: 0;
  border: none;
  border-top: 1px solid var(--vp-c-border);
  border-bottom: 1px solid var(--vp-c-border);
  flex: 1;          /* fill remaining height between status bar and home bar */
  min-height: 0;    /* allow shrinking below content size */
  overflow: hidden;
}

/* Mount inside phone fills the frame exactly — flex column so overlay takes remaining space */
.tb-phone .tb-mount {
  height: 100%;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* Mobile outer: center the phone */
.tb-preview-outer.tb-mobile {
  justify-content: center;
}

/* ── Status bar & home bar adapt to kit mode (not VitePress page theme) ── */
/* Dark kit mode → white icons/text */
.tb-dark-bg .tb-phone-time  { color: rgba(255,255,255,0.92); }
.tb-dark-bg .tb-sig span    { background: rgba(255,255,255,0.92); }
.tb-dark-bg .tb-ico         { color: rgba(255,255,255,0.92); }
.tb-dark-bg .tb-batt        { border-color: rgba(255,255,255,0.88); }
.tb-dark-bg .tb-batt::after { background: rgba(255,255,255,0.88); }
.tb-dark-bg .tb-home-bar    { background: rgba(255,255,255,0.8); }

/* Light kit mode → dark icons/text */
.tb-light-bg .tb-phone-time  { color: #111; }
.tb-light-bg .tb-sig span    { background: #111; }
.tb-light-bg .tb-ico         { color: #111; }
.tb-light-bg .tb-batt        { border-color: #111; }
.tb-light-bg .tb-batt::after { background: #111; }
.tb-light-bg .tb-home-bar    { background: #111; }

/* Separator line between status bar and modal content adapts too */
.tb-phone .tb-preview-frame.tb-dark-bg  { border-color: rgba(255,255,255,0.1); }
.tb-phone .tb-preview-frame.tb-light-bg { border-color: rgba(0,0,0,0.1); }

/* ── Inline overlay containment (replaces JS openInlineWorkaround) ─────────
   The SDK always mounts to options.mount (.tb-mount). These CSS rules ensure
   EVERY overlay the SDK creates — including from internal back/nav calls —
   stays contained inside the preview frame, regardless of JS patching. */

/* Base: desktop centered layout */
.tb-mount .xwk-overlay {
  position: relative !important;
  inset: unset !important;
  z-index: 1 !important;
  background: transparent !important;
  display: flex !important;
  flex-direction: column !important;
  align-items: center !important;
  justify-content: flex-start !important;
  padding: 0 16px 24px !important;
  min-height: 520px;
  width: 100%;
}

/* Mobile: bottom-sheet layout — mirrors SDK @media(max-width:640px) via class */
.tb-mount.tb-preview-mobile .xwk-overlay {
  align-items: flex-end !important;
  justify-content: stretch !important;
  padding: 0 !important;
  min-height: 480px;
}
.tb-mount.tb-preview-mobile .xwk-modal {
  width: 100% !important;
  max-width: none !important;
  border-bottom-left-radius: 0 !important;
  border-bottom-right-radius: 0 !important;
  border-bottom: none !important;
  border-left: none !important;
  border-right: none !important;
  transform: none !important;
}
</style>
