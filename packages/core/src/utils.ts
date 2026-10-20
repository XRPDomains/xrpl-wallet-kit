import type { WalletAdapter, WalletChainFilter, WalletNetwork } from "./types";

const LEGACY_NETWORK_FAMILY = "xrpl";

/** The sole legacy family default; new chain decisions use network metadata. */
export function getNetworkFamily(network: WalletNetwork): string {
  return network.family ?? LEGACY_NETWORK_FAMILY;
}

export function isLegacyNetwork(network: WalletNetwork): boolean {
  return getNetworkFamily(network) === LEGACY_NETWORK_FAMILY;
}

/** Authentication identity, independent of a wallet provider's wire namespace. */
export function getNetworkChainId(network: WalletNetwork): string {
  return isLegacyNetwork(network) && network.walletConnectChainId
    ? network.walletConnectChainId : `${getNetworkFamily(network)}:${network.networkId ?? network.id}`;
}

function matchesCriterion<T>(values: readonly T[] | undefined, value: T): boolean {
  return values === undefined || values.includes(value);
}

export function matchesChainFilter(filter: WalletChainFilter, network: WalletNetwork): boolean {
  // An entirely empty declaration is not evidence of support for every chain.
  if (filter.families === undefined && filter.networkIds === undefined && filter.networkTypes === undefined) return false;
  return matchesCriterion(filter.families, getNetworkFamily(network))
    && matchesCriterion(filter.networkIds, network.id)
    && matchesCriterion(filter.networkTypes, network.networkType);
}

function intersectCriterion<T>(left?: readonly T[], right?: readonly T[]): readonly T[] | undefined {
  if (left === undefined) return right === undefined ? undefined : [...new Set(right)];
  return [...new Set(right === undefined ? left : left.filter(value => right.includes(value)))];
}

/** A disjoint intersection remains deny-all, never a wildcard. Copies caller lists. */
export function intersectChainFilter(max: WalletChainFilter, requested: WalletChainFilter): WalletChainFilter {
  if ([max, requested].some(filter => filter.families === undefined && filter.networkIds === undefined && filter.networkTypes === undefined)) return { families: [] };
  return {
    families: intersectCriterion(max.families, requested.families),
    networkIds: intersectCriterion(max.networkIds, requested.networkIds),
    networkTypes: intersectCriterion(max.networkTypes, requested.networkTypes)
  };
}

/** Declaration gating only: not proof of provider authorization or protocol readiness. */
export function adapterSupportsNetwork(adapter: WalletAdapter, network: WalletNetwork): boolean {
  const details = adapter.capabilities.details;
  const legacy = details?.supportedNetworks;
  if (legacy !== undefined && !legacy.includes(network.id)) return false;
  if (details?.supportedChains !== undefined) return matchesChainFilter(details.supportedChains, network);
  return getNetworkFamily(network) === LEGACY_NETWORK_FAMILY;
}

export function utf8ToHex(value: string): string {
  const encoder = new TextEncoder();
  return [...encoder.encode(value)].map((byte) => byte.toString(16).padStart(2, "0")).join("").toUpperCase();
}

const SAFE_WALLET_PROTOCOLS = new Set(["http:", "https:", "wc:", "xumm:", "xaman:", "gemwallet:", "crossmark:",
  "metamask:", "trust:", "rainbow:", "bitget:", "bitkeep:", "okex:", "okx:", "lobstr:", "joey:", "girin:", "bifrostwallet:", "dropfi:", "ghostsig:", "xyra:"]);
const SAFE_DATA_IMAGE_PATTERN = /^data:image\/(?:avif|gif|jpeg|jpg|png|svg\+xml|webp);base64,[a-z0-9+/]+=*$/i;

export function isSafeWalletUrl(value: unknown, options: { allowDataImage?: boolean } = {}): value is string {
  if (typeof value !== "string") return false;
  const url = value.trim();
  if (!url || /[\u0000-\u0020\u007f]/.test(url)) return false;
  if (options.allowDataImage && SAFE_DATA_IMAGE_PATTERN.test(url)) return true;
  try { return SAFE_WALLET_PROTOCOLS.has(new URL(url, "https://wallet-kit.invalid/").protocol.toLowerCase()); }
  catch { return false; }
}

export function sanitizeWalletUrl(value: unknown, options: { allowDataImage?: boolean } = {}): string | undefined {
  return isSafeWalletUrl(value, options) ? value.trim() : undefined;
}
