export function utf8ToHex(value: string): string {
  const encoder = new TextEncoder();
  return [...encoder.encode(value)].map((byte) => byte.toString(16).padStart(2, "0")).join("").toUpperCase();
}

const EXECUTABLE_URL_PROTOCOLS = new Set(["blob:", "data:", "file:", "javascript:", "vbscript:"]);
const SAFE_DATA_IMAGE_PATTERN = /^data:image\/(?:avif|gif|jpeg|jpg|png|svg\+xml|webp);base64,[a-z0-9+/]+=*$/i;

export function isSafeWalletUrl(value: unknown, options: { allowDataImage?: boolean } = {}): value is string {
  if (typeof value !== "string") return false;
  const url = value.trim();
  if (!url) return false;
  if (options.allowDataImage && SAFE_DATA_IMAGE_PATTERN.test(url)) return true;
  const protocol = url.match(/^([a-z][a-z0-9+.-]*):/i)?.[1]?.toLowerCase();
  if (!protocol) return true;
  return !EXECUTABLE_URL_PROTOCOLS.has(`${protocol}:`);
}

export function sanitizeWalletUrl(value: unknown, options: { allowDataImage?: boolean } = {}): string | undefined {
  return isSafeWalletUrl(value, options) ? value.trim() : undefined;
}
