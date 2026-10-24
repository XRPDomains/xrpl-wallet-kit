import { version } from '../../../packages/browser/package.json'

const latestUrl = 'https://cdn.jsdelivr.net/npm/@xrpl-wallet-kit/browser@latest/dist/xrpl-wallet-kit.iife.min.js'
const releaseUrl = latestUrl.replace('@latest/', `@${version}/`)
const fallbackUrl = `https://unpkg.com/@xrpl-wallet-kit/browser@${version}/dist/xrpl-wallet-kit.iife.min.js`
let pending: Promise<any> | null = null

function hasReleaseFeatures(bundle: any): boolean {
  return typeof bundle?.createGhostsigAdapter === 'function' &&
    typeof bundle?.createJoeyWalletAdapter === 'function' &&
    typeof bundle?.createXyraAdapter === 'function' &&
    bundle?.XAHAU_NETWORKS?.some((network: any) => network.id === 'xahau-mainnet')
}

export async function loadWalletKit(): Promise<any> {
  const host = window as any
  if (hasReleaseFeatures(host.XRPLWalletKit) &&
      [releaseUrl, fallbackUrl].includes(host.__XRPL_WALLET_KIT_WEBSITE_BUNDLE_URL__)) {
    return host.XRPLWalletKit
  }
  if (pending) return pending
  if (host.XRPLWalletKit) throw new Error('Reload the page to refresh the XRPL Wallet Kit bundle')

  pending = (async () => {
    // Pin the website release: @latest may still serve a feature-compatible older SDK.
    const loadScript = (url: string) => new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = url
      script.onload = () => {
        if (!hasReleaseFeatures(host.XRPLWalletKit)) {
          script.remove()
          reject(new Error('XRPL Wallet Kit bundle is missing current wallet or chain support'))
          return
        }
        host.__XRPL_WALLET_KIT_WEBSITE_BUNDLE_URL__ = url
        resolve(host.XRPLWalletKit)
      }
      script.onerror = () => {
        script.remove()
        reject(new Error(`Failed to load XRPL Wallet Kit: ${url}. Check Network/CSP or content blockers.`))
      }
      document.head.appendChild(script)
    })
    try {
      return await loadScript(releaseUrl)
    } catch (error) {
      // Never execute another SDK after partial execution or a feature mismatch.
      if (host.XRPLWalletKit) throw error
      return loadScript(fallbackUrl)
    }
  })()
  try {
    return await pending
  } finally {
    pending = null
  }
}
