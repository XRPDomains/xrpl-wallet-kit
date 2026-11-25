export async function loadClaspAdapterFactory(bundle: any) {
  const { createClaspAdapter } = await import('@xrpl-wallet-kit/adapter-clasp')
  return () => {
    const adapter = createClaspAdapter()
    const call = async <T>(operation: () => Promise<T>): Promise<T> => {
      try { return await operation() }
      catch (error) {
        // The standalone chunk and CDN bundle have separate core class identities.
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
      connect: (options: Parameters<typeof adapter.connect>[0]) => call(() => adapter.connect(options)),
      signTransaction: (request: Parameters<typeof adapter.signTransaction>[0]) => call(() => adapter.signTransaction(request)),
      signAndSubmit: (request: Parameters<typeof adapter.signAndSubmit>[0]) => call(() => adapter.signAndSubmit(request)),
      disconnect: () => call(() => adapter.disconnect()),
      cancelPendingConnection: () => adapter.cancelPendingConnection(),
    }
  }
}
