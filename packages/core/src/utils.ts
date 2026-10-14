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
