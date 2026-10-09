import { version } from '../../../packages/browser/package.json'

const latestUrl = 'https://cdn.jsdelivr.net/npm/@xrpl-wallet-kit/browser@latest/dist/xrpl-wallet-kit.iife.min.js'
const releaseUrl = latestUrl.replace('@latest/', `@${version}/`)
let pending: Promise<any> | null = null

export async function loadWalletKit(): Promise<any> {
  const host = window as any
  if (typeof host.XRPLWalletKit?.createGhostsigAdapter === 'function' &&
      [latestUrl, releaseUrl].includes(host.__XRPL_WALLET_KIT_WEBSITE_BUNDLE_URL__)) {
    return host.XRPLWalletKit
  }
  if (pending) return pending
  if (host.XRPLWalletKit) throw new Error('Reload the page to refresh the XRPL Wallet Kit bundle')

  pending = (async () => {
    // Probe before execution: loading two SDK versions duplicates custom elements.
    const hasGhostsig = await fetch(latestUrl)
      .then(async response => response.ok && (await response.text()).includes('createGhostsigAdapter'))
      .catch(() => false)
    const url = hasGhostsig ? latestUrl : releaseUrl
    return new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = url
      script.onload = () => {
        if (typeof host.XRPLWalletKit?.createGhostsigAdapter !== 'function') {
          script.remove()
          reject(new Error('XRPL Wallet Kit bundle is missing the GhostSig adapter'))
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
