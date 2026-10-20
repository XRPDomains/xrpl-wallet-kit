import { version } from '../../../packages/browser/package.json'

const latestUrl = 'https://cdn.jsdelivr.net/npm/@xrpl-wallet-kit/browser@latest/dist/xrpl-wallet-kit.iife.min.js'
const releaseUrl = latestUrl.replace('@latest/', `@${version}/`)
let pending: Promise<any> | null = null

function hasReleaseFeatures(bundle: any): boolean {
  return typeof bundle?.createGhostsigAdapter === 'function' &&
    typeof bundle?.createXyraAdapter === 'function' &&
    bundle?.XAHAU_NETWORKS?.some((network: any) => network.id === 'xahau-mainnet')
}

export async function loadWalletKit(): Promise<any> {
  const host = window as any
  if (hasReleaseFeatures(host.XRPLWalletKit) &&
      [latestUrl, releaseUrl].includes(host.__XRPL_WALLET_KIT_WEBSITE_BUNDLE_URL__)) {
    return host.XRPLWalletKit
  }
  if (pending) return pending
  if (host.XRPLWalletKit) throw new Error('Reload the page to refresh the XRPL Wallet Kit bundle')

  pending = (async () => {
    // Probe before execution: loading two SDK versions duplicates custom elements.
    const hasCurrentFeatures = await fetch(latestUrl)
      .then(async response => {
        if (!response.ok) return false
        const source = await response.text()
        return ['createGhostsigAdapter', 'createXyraAdapter', 'xahau-mainnet'].every(feature => source.includes(feature))
      })
      .catch(() => false)
    const url = hasCurrentFeatures ? latestUrl : releaseUrl
    return new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = url
      script.onload = () => {
        if (!hasReleaseFeatures(host.XRPLWalletKit)) {
          script.remove()
          reject(new Error('XRPL Wallet Kit bundle is missing Xyra or Xahau support'))
          return
        }
        host.__XRPL_WALLET_KIT_WEBSITE_BUNDLE_URL__ = url
        resolve(host.XRPLWalletKit)
      }
      script.onerror = () => {
        script.remove()
        reject(new Error('Failed to load XRPL Wallet Kit'))
      }
      document.head.appendChild(script)
    })
  })()
  try {
    return await pending
  } finally {
    pending = null
  }
}
