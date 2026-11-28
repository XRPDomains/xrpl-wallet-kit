import {
  isKyraAvailable,
  type KyraConnector,
  type KyraChainId,
  type KyraSignedMessage,
  KyraRequestError,
  openKyra,
} from "@kyrawallet/sdk";
import type {
  ConnectOptions,
  ConnectResult,
  SignAndSubmitRequest,
  SignInRequest,
  SignInResult,
  SignMessageRequest,
  SignMessageResult,
  TxResult,
  WalletAccount,
  WalletCapabilities,
  WalletMetadata,
  WalletNetwork,
  WalletSession,
} from "@xrpl-wallet-kit/core";
import {
  assertSignInRequest,
  BaseWalletAdapter,
  createWalletError,
  getNetworkChainId,
  XRPL_TESTNET,
  WALLET_ADAPTER_API_VERSION,
  WalletKitError,
  WalletKitErrorCode,
} from "@xrpl-wallet-kit/core";

/**
 * Kyra Wallet: a passkey web wallet reached through a popup (`/connect`) with @kyrawallet/sdk. The
 * wallet prepares, reviews, signs and submits; this adapter maps the kit's contract onto the SDK and
 * the SDK's outcomes onto the kit's errors. No signing logic lives here.
 */

import { KYRA_ICON } from "./icon";

const NAME = "Kyra Wallet";

/** Transaction types Kyra signs for sites today; others are shown to the user and refused. */
export const KYRA_SIGNABLE_TRANSACTION_TYPES = [
  "Payment",
  "TrustSet",
  "AccountSet",
  "TicketCreate",
  "OfferCancel",
  "CheckCancel",
  "NFTokenCancelOffer",
  "NFTokenBurn",
  "NFTokenAcceptOffer",
] as const;

/** Kyra sets these from one validated ledger snapshot; a request carrying them is refused. */
const WALLET_OWNED = [
  "Fee",
  "Sequence",
  "LastLedgerSequence",
  "SigningPubKey",
  "TxnSignature",
  "Signers",
  "NetworkID",
  "TicketSequence",
] as const;

export interface KyraAdapterOptions {
  /** The wallet's origin, e.g. `http://localhost:5173` for a local wallet (default the published one). */
  walletOrigin?: string;
  /** How long a request may wait for the user (the wallet submits nothing after it). */
  requestTimeoutMs?: number;
  /** How long the window may take to load. */
  readyTimeoutMs?: number;
  /** The page's window (tests). */
  scope?: Window;
  icon?: string;
}

function networkOf(network: WalletNetwork | undefined): KyraChainId {
  if (network?.family === "xahau") {
    if (network.id === "xahau-mainnet" && network.networkType === "MAINNET" && network.networkId === 21337) return "xrpl:21337";
    if (network.id === "xahau-testnet" && network.networkType === "TESTNET" && network.networkId === 21338) return "xrpl:21338";
  }
  if (network && (network.family ?? "xrpl") === "xrpl") {
    const chain = getNetworkChainId(network);
    if ((network.id === "mainnet" && network.networkType === "MAINNET" && chain === "xrpl:0") ||
        (network.id === "testnet" && network.networkType === "TESTNET" && chain === "xrpl:1")) return chain;
  }
  throw createWalletError.networkNotSupported(NAME, network?.id);
}
export class KyraAdapter extends BaseWalletAdapter {
  adapterApiVersion = WALLET_ADAPTER_API_VERSION;
  metadata: WalletMetadata;
  private static readonly baseCapabilities: WalletCapabilities = {
    connect: true,
    disconnect: true,
    signMessage: true,
    signIn: true,
    signTransaction: false,
    signAndSubmit: true,

    payments: true,
    nftOffers: false,
    details: {
      supportedNetworks: ["mainnet", "testnet", "xahau-mainnet", "xahau-testnet"],
      supportedChains: { families: ["xrpl", "xahau"], networkIds: ["mainnet", "testnet", "xahau-mainnet", "xahau-testnet"] },
      walletManagesFees: true,
      supportedTransactionTypes: KYRA_SIGNABLE_TRANSACTION_TYPES,
      transactionModes: ["sign-and-submit"],
    },
  };
  capabilities = structuredClone(KyraAdapter.baseCapabilities);
  private account?: WalletAccount;
  private network?: KyraChainId;
  private pending?: { connector: KyraConnector; abort: AbortController; cleanup: () => void };

  constructor(private readonly options: KyraAdapterOptions = {}) {
    super();
    this.metadata = {
      id: "kyra",
      name: NAME,
      type: "web",
      group: "Web wallets",
      homepage: "https://kyrawallet.app/",
      icon: options.icon ?? KYRA_ICON,
    };
  }

  isAvailable(): boolean {
    return isKyraAvailable(this.options.scope);
  }

  /** Opens (or reuses) the wallet window; call from a user gesture. */
  private open(signal?: AbortSignal) {
    if (signal?.aborted) {
      throw new WalletKitError(WalletKitErrorCode.REQUEST_CANCELLED, "Kyra request cancelled.");
    }
    if (this.pending) {
      throw new WalletKitError(WalletKitErrorCode.INVALID_REQUEST, "A Kyra popup request is already active.");
    }
    const abort = new AbortController();
    const cancel = () => abort.abort();
    const connector = openKyra({
      ...(this.options.walletOrigin ? { walletOrigin: this.options.walletOrigin } : {}),
      ...(this.options.requestTimeoutMs ? { requestTimeoutMs: this.options.requestTimeoutMs } : {}),
      ...(this.options.readyTimeoutMs ? { readyTimeoutMs: this.options.readyTimeoutMs } : {}),
      ...(this.options.scope ? { scope: this.options.scope } : {}),
    });
    signal?.addEventListener("abort", cancel, { once: true });
    this.pending = { connector, abort, cleanup: () => signal?.removeEventListener("abort", cancel) };
    return this.pending;
  }

  /**
   * The wallet window stays open after an answer (it tells the user they can close it); the next
   * request reuses it by name. It is closed only on cancel and disconnect.
   */
  private done(pending: NonNullable<KyraAdapter["pending"]>) {
    pending.cleanup();
    if (this.pending === pending) this.pending = undefined;
  }

  async connect(options: ConnectOptions = {}): Promise<ConnectResult> {
    const network = options.network ?? XRPL_TESTNET;
    const kyraNetwork = networkOf(network);
    let pending: KyraAdapter["pending"];
    try {
      pending = this.open(options.signal);
      const result = await pending.connector.connect(kyraNetwork, { signal: pending.abort.signal });
      const shared = result.accounts[0];
      if (pending.abort.signal.aborted || this.pending !== pending) {
        throw new WalletKitError(WalletKitErrorCode.REQUEST_CANCELLED, "Kyra connection cancelled.");
      }
      if (!shared || shared.chain !== kyraNetwork) throw createWalletError.connectionFailed(NAME, new Error("No account shared."));
      const account: WalletAccount = {
        address: shared.address,
        ...(shared.publicKey ? { publicKey: shared.publicKey } : {}),
        ...(network ? { network, networkType: network.networkType } : {}),
      };
      this.account = account;
      this.network = kyraNetwork;
      const methods = result.scopes[kyraNetwork]?.methods ?? [];
      const signAndSubmit = methods.includes("xrpl_signAndSubmit");
      this.capabilities = {
        ...structuredClone(KyraAdapter.baseCapabilities),
        signAndSubmit,
        payments: signAndSubmit,
        signMessage: methods.includes("xrpl_signMessage"),
        signIn: network.family !== "xahau" && methods.includes("xrpl_signIn"),
        details: {
          ...KyraAdapter.baseCapabilities.details,
          supportedTransactionTypes: !signAndSubmit ? [] : network.family === "xahau" ? ["Payment"] : KYRA_SIGNABLE_TRANSACTION_TYPES,
          transactionModes: signAndSubmit ? ["sign-and-submit"] : [],
        },
      };
      const session: WalletSession = {
        adapterId: this.metadata.id,
        wallet: this.metadata,
        account: structuredClone(account),
        connectedAt: Date.now(),
      };
      return { account: structuredClone(account), session, raw: result };
    } catch (error) {
      throw this.connectError(error);
    } finally {
      if (pending) this.done(pending);
    }
  }

  /** Kyra has no passive account API: a reload needs a new connect (and the user's passkey). */
  async restoreSession(): Promise<ConnectResult | null> {
    return null;
  }

  cancelPendingConnection(): void {
    if (!this.pending) return;
    this.pending.cleanup();
    this.pending.abort.abort();
    this.pending.connector.close();
    this.pending = undefined;
  }

  /** Local: Kyra keeps no per-site grant to revoke. */
  async disconnect(): Promise<void> {
    this.cancelPendingConnection();
    this.account = undefined;
    this.network = undefined;
    this.capabilities = structuredClone(KyraAdapter.baseCapabilities);
    await super.disconnect();
  }

  async signAndSubmit(request: SignAndSubmitRequest): Promise<TxResult> {
    if (request.submit === false)
      throw createWalletError.unsupportedMethod("signTransaction", NAME);
    const account = this.account;
    const network = this.network;
    if (!account || !network) throw createWalletError.notConnected();
    if (!this.capabilities.signAndSubmit) throw createWalletError.unsupportedMethod("signAndSubmit", NAME);
    if (!request.txJson || typeof request.txJson !== "object" || Array.isArray(request.txJson)) {
      throw new WalletKitError(WalletKitErrorCode.INVALID_REQUEST, "Kyra requires a transaction intent object.");
    }
    if (request.maxFeeDrops !== undefined || request.walletPayload !== undefined) {
      throw new WalletKitError(WalletKitErrorCode.INVALID_REQUEST, "Kyra prepares fees itself and accepts txJson only.");
    }
    const tx = structuredClone(request.txJson) as Record<string, unknown>;
    if (tx.Account !== undefined && tx.Account !== account.address) {
      throw new WalletKitError(
        WalletKitErrorCode.INVALID_REQUEST,
        `${NAME}: the transaction's Account is not the connected account.`,
      );
    }
    tx.Account = account.address;
    const owned = WALLET_OWNED.filter((field) => tx[field] !== undefined);
    if (owned.length) {
      // A documented provider requirement: Kyra prepares these itself. Never stripped silently.
      throw new WalletKitError(
        WalletKitErrorCode.INVALID_REQUEST,
        `${NAME} sets ${owned.join(", ")} itself. Send the transaction without autofill.`,
      );
    }
    let pending: KyraAdapter["pending"];
    try {
      pending = this.open(request.signal);
      const result = await pending.connector.signAndSubmit(
        { chain: network, tx },
        { signal: pending.abort.signal },
      );
      switch (result.outcome) {
        case "confirmed":
          return { hash: result.hash, status: "tesSUCCESS", signed: true, raw: result };
        case "failed":
          throw new WalletKitError(
            WalletKitErrorCode.SUBMIT_FAILED,
            `${NAME}: transaction ${result.hash} failed on the ledger (${result.result ?? "unknown result"}).`,
            {
              details: {
                hash: result.hash,
                result: result.result,
                outcomeUnknown: false,
                raw: result,
              },
            },
          );
        case "expired":
          throw new WalletKitError(
            WalletKitErrorCode.REQUEST_EXPIRED,
            `${NAME}: transaction ${result.hash} expired without being included.`,
            { details: { hash: result.hash, outcomeUnknown: false, raw: result } },
          );
        default:
          throw new WalletKitError(
            WalletKitErrorCode.SIGN_FAILED,
            result.hash
              ? `${NAME}: the outcome of ${result.hash} is unknown. Check it on the ledger before retrying.`
              : `${NAME}: the request reached the wallet but its outcome is unknown. Check the account's history before retrying.`,
            { details: { hash: result.hash, outcomeUnknown: true, raw: result } },
          );
      }
    } catch (error) {
      throw this.signError(error);
    } finally {
      if (pending) this.done(pending);
    }
  }

  /** The connected account and chain; a request naming another account is refused. */
  private connected(requested?: WalletAccount): { account: WalletAccount; chain: KyraChainId } {
    const account = this.account;
    const chain = this.network;
    if (!account || !chain) throw createWalletError.notConnected();
    if (requested && requested.address !== account.address) {
      throw new WalletKitError(
        WalletKitErrorCode.INVALID_REQUEST,
        `${NAME}: the request's account is not the connected account.`,
      );
    }
    return { account, chain };
  }

  /** A later popup may hold another wallet profile: its signature is not this account's. */
  private signedBy(signed: KyraSignedMessage, account: WalletAccount): KyraSignedMessage {
    if (signed.address !== account.address || signed.chain !== this.network) {
      throw new WalletKitError(
        WalletKitErrorCode.INVALID_REQUEST,
        `${NAME}: the wallet signed with another account than the connected one. Connect again.`,
      );
    }
    return signed;
  }

  async signMessage(request: SignMessageRequest): Promise<SignMessageResult> {
    const { account, chain } = this.connected(request.account);
    if (!this.capabilities.signMessage) throw createWalletError.unsupportedMethod("signMessage", NAME);
    const pending = this.open(request.signal);
    try {
      const signed = this.signedBy(
        await pending.connector.signMessage(
          { chain, message: request.message },
          { signal: pending.abort.signal },
        ),
        account,
      );
      return {
        signatureKind: "signature",
        signature: signed.signature,
        publicKey: signed.publicKey,
        proof: signed.signature,
        raw: signed,
      };
    } catch (error) {
      throw this.signError(error);
    } finally {
      this.done(pending);
    }
  }

  async signIn(request: SignInRequest): Promise<SignInResult> {
    assertSignInRequest(request);
    const { account, chain } = this.connected(request.account);
    if (!this.capabilities.signIn) throw createWalletError.unsupportedMethod("signIn", NAME);
    const pending = this.open(request.signal);
    try {
      const signed = this.signedBy(
        await pending.connector.signIn(
          {
            chain,
            nonce: request.nonce,
            ...(request.statement ? { statement: request.statement } : {}),
            ...(request.resources?.length ? { resources: request.resources } : {}),
          },
          { signal: pending.abort.signal },
        ),
        account,
      );
      return {
        address: account.address,
        chainId: chain,
        nonce: request.nonce,
        mode: "caip122",
        signatureKind: "signature",
        message: signed.message,
        signature: signed.signature,
        publicKey: signed.publicKey,
        proof: signed.signature,
        raw: signed,
      };
    } catch (error) {
      throw this.signError(error);
    } finally {
      this.done(pending);
    }
  }

  private connectError(error: unknown): unknown {
    if (!(error instanceof KyraRequestError)) return error;
    switch (error.code) {
      case "USER_REJECTED":
      case "WINDOW_CLOSED":
        return createWalletError.connectionRejected(NAME, error);
      case "UNSUPPORTED":
        return createWalletError.networkNotSupported(NAME, this.network, error);
      case "WRONG_CHAIN":
        return createWalletError.networkMismatch(NAME, undefined, undefined, error);
      default:
        return this.common(error);
    }
  }

  private signError(error: unknown): unknown {
    if (!(error instanceof KyraRequestError)) return error;
    switch (error.code) {
      case "USER_REJECTED":
      case "WINDOW_CLOSED":
        return createWalletError.signRejected(error);
      case "UNSUPPORTED":
        return new WalletKitError(
          WalletKitErrorCode.UNSUPPORTED_METHOD,
          `${NAME}: ${error.message}`,
          {
            cause: error,
          },
        );
      default:
        return this.common(error);
    }
  }

  private common(error: KyraRequestError): WalletKitError {
    switch (error.code) {
      case "POPUP_BLOCKED":
      case "NOT_READY":
        return createWalletError.walletNotAvailable(NAME, error);
      case "TIMEOUT":
        return createWalletError.requestTimeout(`${NAME} request timed out.`, error);
      case "ABORTED":
        return new WalletKitError(
          WalletKitErrorCode.REQUEST_CANCELLED,
          `${NAME} request cancelled.`,
          {
            cause: error,
          },
        );
      case "UNAUTHORIZED":
      case "INVALID_REQUEST":
        return new WalletKitError(WalletKitErrorCode.INVALID_REQUEST, `${NAME}: ${error.message}`, {
          cause: error,
        });
      default:
        return createWalletError.unknown(error);
    }
  }
}

export function kyra(options?: KyraAdapterOptions): KyraAdapter {
  return new KyraAdapter(options);
}
