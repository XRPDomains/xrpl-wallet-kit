import { WalletKitError, WalletKitErrorCode } from "@xrpl-wallet-kit/core";
import type { WalletAuth, WalletAuthAdapter, WalletAuthChangeHandler, WalletAuthManager, WalletAuthOptions, WalletAuthSignInResult, WalletAuthState } from "./types";
import { isWalletAuthSignInResult } from "./types";

const DEFAULT_EXPIRES_IN_SECONDS = 3600;

export function createWalletAuth(
  manager: WalletAuthManager,
  adapter: WalletAuthAdapter,
  options: WalletAuthOptions = {}
): WalletAuth {
  return new WalletAuthController(manager, adapter, options);
}

class WalletAuthController implements WalletAuth {
  private state: WalletAuthState = {
    status: "unauthenticated",
    address: null,
    error: null
  };
  private listeners = new Set<WalletAuthChangeHandler>();
  private destroyed = false;
  private signing = false;

  constructor(
    private readonly manager: WalletAuthManager,
    private readonly adapter: WalletAuthAdapter,
    private readonly defaults: WalletAuthOptions
  ) {}

  getState(): WalletAuthState {
    return { ...this.state };
  }

  async signIn(options: WalletAuthOptions = {}): Promise<WalletAuthSignInResult> {
    this.ensureActive();
    if (this.signing) throw new Error("A sign-in request is already in progress.");

    const merged = { ...this.defaults, ...options };
    const initialSession = this.manager.getSession();
    const account = this.manager.getAccount();
    if (!account) throw new Error("No active wallet session. Connect a wallet first.");
    if (!this.manager.getCapabilities()?.signMessage) {
      throw new Error("Active wallet adapter does not support message signing.");
    }

    this.signing = true;
    this.setState({ status: "loading", address: account.address, error: null });

    try {
      const nonce = await this.adapter.getNonce();
      const issuedAt = new Date();
      const expirationTime = new Date(issuedAt.getTime() + (merged.expiresIn ?? DEFAULT_EXPIRES_IN_SECONDS) * 1000);
      const message = this.adapter.createMessage({
        address: account.address,
        nonce,
        domain: merged.domain ?? resolveDefaultDomain(),
        uri: merged.uri ?? resolveDefaultUri(),
        chainId: merged.chainId,
        statement: merged.statement,
        issuedAt: issuedAt.toISOString(),
        expirationTime: expirationTime.toISOString(),
        version: "1"
      });

      if (this.manager.getSession() !== initialSession) {
        throw new Error("Wallet session changed during sign-in.");
      }

      const signResult = await this.manager.signMessage({ message, account });
      if (!isWalletAuthSignInResult(signResult)) {
        throw new Error("Wallet did not return a verifiable signature proof.");
      }

      const verifyOk = await this.adapter.verify({
        message,
        signatureKind: signResult.signatureKind,
        proof: signResult.proof,
        signature: signResult.signature,
        txBlob: signResult.txBlob,
        address: account.address,
        publicKey: signResult.publicKey,
        raw: signResult.raw
      });
      if (!verifyOk) throw new Error("Authentication rejected by server.");

      const result = {
        address: account.address,
        message,
        signatureKind: signResult.signatureKind,
        proof: signResult.proof,
        signature: signResult.signature,
        txBlob: signResult.txBlob,
        publicKey: signResult.publicKey,
        raw: signResult.raw
      };
      this.setState({ status: "authenticated", address: account.address, error: null });
      return result;
    } catch (error) {
      this.setState({ status: "error", address: null, error });
      throw normalizeAuthError(error);
    } finally {
      this.signing = false;
    }
  }

  async signOut(): Promise<void> {
    try {
      await this.adapter.signOut?.();
    } finally {
      this.setState({ status: "unauthenticated", address: null, error: null });
    }
  }

  on(event: "change", handler: WalletAuthChangeHandler): () => void {
    this.ensureActive();
    if (event !== "change") return () => {};
    this.listeners.add(handler);
    return () => this.off(event, handler);
  }

  off(event: "change", handler: WalletAuthChangeHandler): void {
    if (event !== "change") return;
    this.listeners.delete(handler);
  }

  destroy(): void {
    this.destroyed = true;
    this.listeners.clear();
  }

  private setState(state: WalletAuthState): void {
    this.state = state;
    for (const listener of this.listeners) listener(this.getState());
  }

  private ensureActive(): void {
    if (this.destroyed) throw new Error("WalletAuth instance has been destroyed.");
  }
}

function resolveDefaultDomain(): string {
  if (typeof window !== "undefined" && window.location.host) return window.location.host;
  return "localhost";
}

function resolveDefaultUri(): string {
  if (typeof window !== "undefined" && window.location.origin) return window.location.origin;
  return "http://localhost";
}

function normalizeAuthError(error: unknown): unknown {
  if (error instanceof WalletKitError) return error;
  const message = error instanceof Error ? error.message : String(error);
  if (/reject|denied|cancelled|canceled|closed/i.test(message)) {
    return new WalletKitError(WalletKitErrorCode.SIGN_REJECTED, "Signing request was rejected", { cause: error });
  }
  return error;
}
