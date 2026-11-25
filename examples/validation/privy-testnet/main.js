import { Buffer } from 'buffer'

globalThis.Buffer ??= Buffer

const appId = import.meta.env.VITE_PRIVY_APP_ID?.trim()
const byId = (id) => document.getElementById(id)
const session = byId('session')
const result = byId('result')

if (!appId) {
  session.textContent = 'Set VITE_PRIVY_APP_ID in .env.local and restart the demo.'
} else {
  start().catch((error) => {
    session.textContent = 'Could not initialize the Privy demo.'
    result.textContent = error instanceof Error ? error.message : String(error)
  })
}

async function start() {
  const [{ WalletManager }, { PrivyAdapter }, { isValidClassicAddress, xrpToDrops }] = await Promise.all([
    import('xrpl-connect'),
    import('@xrpl-commons/xrpl-connect-privy'),
    import('xrpl'),
  ])
  const privy = new PrivyAdapter({
    appId,
    clientId: import.meta.env.VITE_PRIVY_CLIENT_ID?.trim() || undefined,
    redirectUri: new URL('/wallet/privy', location.origin).href,
  })
  const manager = new WalletManager({ adapters: [privy], network: 'testnet', autoConnect: false })
  const connector = byId('connector')
  connector.setWalletManager(manager)
  let restoring = true
  let busy = false
  let sessionChanged = false

  function render() {
    const address = manager.connected ? manager.account?.address : undefined
    connector.hidden = false
    session.textContent = restoring
      ? 'Checking the Privy session and wallet...'
      : address ? `XRPL Testnet wallet: ${address}` : 'No XRPL wallet connected.'
    byId('logout').disabled = busy || (!address && !(restoring && privy.hasPendingConnection()))
    byId('logout').textContent = restoring ? 'Cancel sign-in' : 'Log out'
    byId('fund').disabled = restoring || busy || !address
    byId('operations').disabled = restoring || busy || !address
  }

  async function run(operation) {
    if (busy) return
    busy = true
    result.textContent = 'Working...'
    render()
    try {
      result.textContent = JSON.stringify(await operation(), null, 2)
    } catch (error) {
      result.textContent = error instanceof Error ? error.message : String(error)
    } finally {
      busy = false
      render()
    }
  }

  manager.on('connect', render)
  manager.on('disconnect', render)
  manager.on('error', (error) => { result.textContent = error.message })

  byId('logout').addEventListener('click', () => run(async () => {
    sessionChanged = true
    try {
      await manager.disconnect()
      return { connected: manager.connected }
    } finally {
      restoring = false
    }
  }))

  byId('fund').addEventListener('click', () => run(async () => {
    const address = manager.account.address
    const response = await fetch('https://faucet.altnet.rippletest.net/accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ destination: address }),
      signal: AbortSignal.timeout(20_000),
    })
    if (!response.ok) throw new Error(`Testnet faucet returned HTTP ${response.status}.`)
    return { faucetRequestedFor: address }
  }))

  byId('payment').addEventListener('submit', (event) => {
    event.preventDefault()
    void run(async () => {
      if (!manager.connected || restoring) throw new Error('Connect a Testnet wallet first.')
      const destination = byId('destination').value.trim()
      const account = manager.account.address
      if (!isValidClassicAddress(destination) || destination === account) {
        throw new Error('Enter a different funded XRPL Testnet classic address.')
      }
      const amount = byId('amount').value.trim()
      if (!/^\d{1,9}(?:\.\d{1,6})?$/.test(amount) || !/[1-9]/.test(amount)) {
        throw new Error('Enter a positive XRP amount with up to six decimal places.')
      }
      const tx = { TransactionType: 'Payment', Account: account, Destination: destination, Amount: xrpToDrops(amount) }
      if (event.submitter?.id !== 'send') {
        const signed = await manager.sign(tx)
        return { mode: 'sign-only', hash: signed.hash, signedBlobReturned: Boolean(signed.tx_blob) }
      }
      const submitted = await manager.signAndSubmit(tx)
      return {
        mode: 'submit',
        hash: submitted.hash,
        transactionResult: submitted.transactionResult,
        success: submitted.transactionResult === 'tesSUCCESS',
      }
    })
  })

  render()
  try {
    await manager.reconnect()
  } catch (error) {
    if (!sessionChanged) result.textContent = error instanceof Error ? error.message : String(error)
  } finally {
    restoring = false
    render()
  }
}
