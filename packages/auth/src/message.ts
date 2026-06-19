import type { ParsedWalletAuthMessage, WalletAuthMessageParams } from "./types";

export interface WalletAuthValidationOptions {
  expectedDomain?: string;
  expectedUri?: string;
  expectedAddress?: string;
  now?: Date;
  maxAgeSeconds?: number;
  isNonceUsed?: (nonce: string) => boolean | Promise<boolean>;
}

export interface WalletAuthValidationResult {
  valid: boolean;
  errors: string[];
  message?: ParsedWalletAuthMessage;
}

export function formatAuthMessage(params: WalletAuthMessageParams): string {
  const lines = [
    `${params.domain} wants you to sign in with your wallet:`,
    params.address,
    ""
  ];

  if (params.statement) {
    lines.push(params.statement, "");
  }

  lines.push(
    `URI: ${params.uri}`,
    `Version: ${params.version}`,
    `Nonce: ${params.nonce}`,
    `Issued At: ${params.issuedAt}`
  );

  if (params.chainId) lines.push(`Chain ID: ${params.chainId}`);
  if (params.expirationTime) lines.push(`Expiration Time: ${params.expirationTime}`);

  return lines.join("\n");
}

export function parseAuthMessage(message: string): ParsedWalletAuthMessage {
  const lines = message.split(/\r?\n/);
  const header = lines[0] ?? "";
  const domain = header.endsWith(" wants you to sign in with your wallet:")
    ? header.slice(0, -" wants you to sign in with your wallet:".length)
    : "";
  const address = lines[1] ?? "";
  const fields = new Map<string, string>();
  const statementLines: string[] = [];
  let inStatement = false;

  for (let index = 2; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    const fieldMatch = /^([A-Za-z ]+):\s*(.*)$/.exec(line);
    if (fieldMatch && ["URI", "Version", "Nonce", "Issued At", "Chain ID", "Expiration Time"].includes(fieldMatch[1])) {
      fields.set(fieldMatch[1], fieldMatch[2]);
      inStatement = false;
      continue;
    }
    if (line.length > 0 || inStatement) {
      statementLines.push(line);
      inStatement = true;
    }
  }

  const statement = trimBlankLines(statementLines).join("\n") || undefined;

  return {
    domain,
    address,
    statement,
    uri: fields.get("URI") ?? "",
    version: fields.get("Version") ?? "",
    nonce: fields.get("Nonce") ?? "",
    issuedAt: fields.get("Issued At") ?? "",
    chainId: fields.get("Chain ID") || undefined,
    expirationTime: fields.get("Expiration Time") || undefined
  };
}

export async function validateAuthMessage(message: string, options: WalletAuthValidationOptions = {}): Promise<WalletAuthValidationResult> {
  const parsed = parseAuthMessage(message);
  const errors: string[] = [];
  const now = options.now ?? new Date();

  if (!parsed.domain) errors.push("Missing or invalid domain.");
  if (!parsed.address) errors.push("Missing address.");
  if (!parsed.uri) errors.push("Missing URI.");
  if (!parsed.version) errors.push("Missing version.");
  if (!parsed.nonce) errors.push("Missing nonce.");
  if (!parsed.issuedAt || Number.isNaN(Date.parse(parsed.issuedAt))) errors.push("Missing or invalid issuedAt.");
  if (options.expectedDomain && parsed.domain !== options.expectedDomain) errors.push("Domain does not match.");
  if (options.expectedUri && parsed.uri !== options.expectedUri) errors.push("URI does not match.");
  if (options.expectedAddress && parsed.address !== options.expectedAddress) errors.push("Address does not match.");

  if (parsed.expirationTime) {
    const expiresAt = Date.parse(parsed.expirationTime);
    if (Number.isNaN(expiresAt)) {
      errors.push("Invalid expirationTime.");
    } else if (expiresAt <= now.getTime()) {
      errors.push("Message has expired.");
    }
  }

  if (parsed.issuedAt && !Number.isNaN(Date.parse(parsed.issuedAt)) && options.maxAgeSeconds !== undefined) {
    const issuedAt = Date.parse(parsed.issuedAt);
    if (now.getTime() - issuedAt > options.maxAgeSeconds * 1000) {
      errors.push("Message is older than maxAgeSeconds.");
    }
  }

  if (options.isNonceUsed && parsed.nonce && await options.isNonceUsed(parsed.nonce)) {
    errors.push("Nonce has already been used.");
  }

  return {
    valid: errors.length === 0,
    errors,
    message: parsed
  };
}

function trimBlankLines(lines: string[]): string[] {
  let start = 0;
  let end = lines.length;
  while (start < end && lines[start] === "") start += 1;
  while (end > start && lines[end - 1] === "") end -= 1;
  return lines.slice(start, end);
}
