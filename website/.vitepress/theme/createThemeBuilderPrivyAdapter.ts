import { createPrivyAdapter } from '../../../packages/adapters/privy/src/index'

export function createThemeBuilderPrivyAdapter(bundle: any, options: Parameters<typeof createPrivyAdapter>[0]) {
  const adapter = createPrivyAdapter(options)
  const call = async <T>(operation: () => Promise<T>): Promise<T> => {
    try { return await operation() }
    catch (error) {
      // The CDN bundle and the standalone adapter have separate core class identities.
      if (error instanceof Error && error.name === 'WalletKitError' && 'code' in error) {
        const failure = error as Error & { code: string; details?: Record<string, unknown> }
        throw new bundle.WalletKitError(failure.code, failure.message, { cause: error, details: failure.details })
      }
      throw error
    }
  }
  return {
    adapterApiVersion: adapter.adapterApiVersion,
    metadata: adapter.metadata,
    capabilities: adapter.capabilities,
    isAvailable: () => adapter.isAvailable(),
    onInteraction: adapter.onInteraction.bind(adapter),
    connect: (request: Parameters<typeof adapter.connect>[0]) => call(() => adapter.connect(request)),
    canRecoverSession: () => call(() => adapter.canRecoverSession()),
    recoverSession: (request: Parameters<typeof adapter.recoverSession>[0]) => call(() => adapter.recoverSession(request)),
    signTransaction: (request: Parameters<typeof adapter.signTransaction>[0]) => call(() => adapter.signTransaction(request)),
    signAndSubmit: (request: Parameters<typeof adapter.signAndSubmit>[0]) => call(() => adapter.signAndSubmit(request)),
    disconnect: () => call(() => adapter.disconnect()),
    cancelPendingConnection: () => call(() => adapter.cancelPendingConnection()),
  }
}
