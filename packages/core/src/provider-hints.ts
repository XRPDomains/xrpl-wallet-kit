import { DEFAULT_XRPL_NETWORKS } from "./networks";
import { isLegacyNetwork } from "./utils";
import { createWalletError } from "./errors";
import type { WalletNetwork, WalletProviderHints } from "./types";

/** Legacy preset fallback preserves callers that construct the standard XRPL networks themselves. */
export function getProviderHint<K extends keyof WalletProviderHints>(network: WalletNetwork, provider: K): NonNullable<WalletProviderHints[K]> {
  const fallback = isLegacyNetwork(network) ? DEFAULT_XRPL_NETWORKS.find(item => item.id === network.id)?.providerHints : undefined;
  const hint = network.providerHints?.[provider] ?? fallback?.[provider];
  const text = (value: unknown): value is string => typeof value === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(value);
  const valid = provider === "gemwallet" ? hint && typeof hint === "object" && "chain" in hint && "network" in hint && text(hint.chain) && text(hint.network)
    : provider === "ledgerApp" ? hint === "XRP" || hint === "XAH" : text(hint);
  if (!valid) throw createWalletError.networkNotSupported(String(provider), network.id, new Error(`Missing or invalid ${provider} network mapping`));
  return hint as NonNullable<WalletProviderHints[K]>;
}
