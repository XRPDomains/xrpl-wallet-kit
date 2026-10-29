import type { NetworkOptions } from "@xahauname/sdk";
import type { WalletIdentity, WalletIdentityResolver } from "./types";
import { loadXahauNameSdk } from "./xahauname-loader";
import type { XahauNameSdk } from "./xahauname-loader";

export type XahauNameDeployment = NonNullable<NetworkOptions["deployment"]>;

export interface XahauNameResolverOptions {
  /** Explicit trusted deployment; Mainnet is disabled when omitted. */
  mainnet?: XahauNameDeployment;
  /** Uses the SDK's bundled Testnet deployment unless overridden or disabled. */
  testnet?: XahauNameDeployment | false;
  timeoutMs?: number;
  cacheTtlMs?: number;
}

export function createXahauNameResolver(options: XahauNameResolverOptions = {}): WalletIdentityResolver {
  return createXahauNameResolverWithLoader(options, loadXahauNameSdk);
}

// Internal injection point keeps tests independent of live RPC and SDK transport.
export function createXahauNameResolverWithLoader(
  options: XahauNameResolverOptions,
  load: () => Promise<XahauNameSdk>
): WalletIdentityResolver {
  const settings = structuredClone(options);
  const timeoutMs = settings.timeoutMs ?? 15_000;
  const cacheTtlMs = settings.cacheTtlMs ?? 60_000;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0 || timeoutMs > 2147483647 || !Number.isFinite(cacheTtlMs) || cacheTtlMs < 0) {
    throw new TypeError("Invalid XahauName timeout or cache TTL.");
  }
  const cache = new Map<string, { value: WalletIdentity | null; expiresAt: number }>();
  const pending = new Map<string, Promise<WalletIdentity | null>>();

  return async (address, session, context) => {
    const network = session.account.network;
    if (!network || network.family !== "xahau" || address !== session.account.address) return null;
    const testnet = network.id === "xahau-testnet" && network.networkId === 21338 && network.networkType === "TESTNET";
    const mainnet = network.id === "xahau-mainnet" && network.networkId === 21337 && network.networkType === "MAINNET";
    if ((!testnet && !mainnet) || testnet && settings.testnet === false || mainnet && !settings.mainnet) return null;
    const deployment = mainnet ? settings.mainnet : settings.testnet || undefined;
    const key = JSON.stringify([network.id, network.networkId, network.rpcUrl, address]);
    if (context?.force) cache.delete(key);
    const cached = cache.get(key);
    if (!context?.force && cached && cached.expiresAt > Date.now()) return cached.value;
    if (!context?.force && pending.has(key)) return pending.get(key)!;

    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const started = Date.now();
    const work = async (): Promise<WalletIdentity | null> => {
      const sdk = await load();
      if (controller.signal.aborted) throw new Error("XahauName lookup timed out.");
      const config = sdk.resolveNetworkConfig({ network: mainnet ? "mainnet" : "testnet", deployment, wss: network.rpcUrl });
      const client = new sdk.XahauNameClient({ ...config, connectionTimeoutMs: timeoutMs, connectionAttempts: 1 });
      try {
        // SDK 0.4 verifies Primary and current native ownership at one ledger, independently of receiving records.
        const name = await client.read.getName({
          address, bypassCache: context?.force === true,
          timeoutMs: Math.max(1, timeoutMs - (Date.now() - started)), signal: controller.signal
        });
        return name ? { name, source: "xahauname", verified: true } : null;
      } finally {
        await client.disconnect().catch(() => undefined);
      }
    };
    const deadline = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new Error("XahauName lookup timed out."));
      }, timeoutMs);
    });
    const result = Promise.race([work(), deadline]).then(value => {
      // A forced refresh supersedes an older in-flight read for this identity.
      if (pending.get(key) === result) {
        if (cache.size >= 128) cache.delete(cache.keys().next().value!);
        cache.set(key, { value, expiresAt: Date.now() + (value ? cacheTtlMs : Math.min(cacheTtlMs, 5000)) });
      }
      return value;
    }).finally(() => {
      clearTimeout(timer!);
      if (pending.get(key) === result) pending.delete(key);
    });
    pending.set(key, result);
    return result;
  };
}
