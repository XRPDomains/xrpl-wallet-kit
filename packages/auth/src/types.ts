import type { SignatureKind, SignMessageResult, WalletManager } from "@xrpl-wallet-kit/core";

export interface WalletAuthMessageParams {
  address: string;
  nonce: string;
  domain: string;
  uri: string;
  chainId?: string;
  statement?: string;
  issuedAt: string;
  expirationTime?: string;
  version: string;
}

export interface ParsedWalletAuthMessage extends WalletAuthMessageParams {}

export interface WalletAuthVerifyParams {
  message: string;
  signatureKind: SignatureKind;
  proof: string;
  signature?: string;
  txBlob?: string;
  address: string;
  publicKey?: string;
  raw?: unknown;
}

export interface WalletAuthAdapter {
  getNonce(): Promise<string>;
  createMessage(params: WalletAuthMessageParams): string;
  verify(params: WalletAuthVerifyParams): Promise<boolean>;
  signOut?(): Promise<void>;
}

export type WalletAuthStatus = "unauthenticated" | "loading" | "authenticated" | "error";

export interface WalletAuthState {
  status: WalletAuthStatus;
  address: string | null;
  error: unknown | null;
}

export interface WalletAuthOptions {
  domain?: string;
  uri?: string;
  chainId?: string;
  statement?: string;
  expiresIn?: number;
}

export interface WalletAuthSignInResult {
  address: string;
  message: string;
  signatureKind: SignatureKind;
  proof: string;
  signature?: string;
  txBlob?: string;
  publicKey?: string;
  raw?: unknown;
}

export type WalletAuthChangeHandler = (state: WalletAuthState) => void;

export interface WalletAuth {
  getState(): WalletAuthState;
  signIn(options?: WalletAuthOptions): Promise<WalletAuthSignInResult>;
  signOut(): Promise<void>;
  on(event: "change", handler: WalletAuthChangeHandler): () => void;
  off(event: "change", handler: WalletAuthChangeHandler): void;
  destroy(): void;
}

export interface SignatureVerifier {
  verify(params: WalletAuthVerifyParams): Promise<boolean>;
}

export interface WalletAuthManager extends Pick<WalletManager, "getAccount" | "getCapabilities" | "getSession" | "signMessage"> {}

export function isWalletAuthSignInResult(value: SignMessageResult): value is SignMessageResult & { proof: string } {
  return typeof value.proof === "string" && value.proof.trim().length > 0;
}
