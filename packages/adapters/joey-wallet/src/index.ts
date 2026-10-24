import { createJoeyClient, getJoey, isChallengeSignIn } from "@joeywallet/wallet-sdk";
import type { Joey, JoeyInjectedProvider, JoeyChain } from "@joeywallet/wallet-sdk";
import { BaseWalletAdapter, DEFAULT_XRPL_NETWORKS, WalletKitError, WalletKitErrorCode, assertWalletRequestActive, createWalletError, assertSignInRequest, assertSignInContext } from "@xrpl-wallet-kit/core";
import type { SignInRequest, SignInResult } from "@xrpl-wallet-kit/core";
import type { ConnectOptions, WalletAccount, WalletCapabilities, WalletMetadata, WalletNetwork, WalletSession, SignTransactionRequest, SignAndSubmitRequest } from "@xrpl-wallet-kit/core";
import { decode, encode, hashes, isValidClassicAddress, verifySignature, type Transaction } from "xrpl";
import { deriveAddress, verify } from "ripple-keypairs";
import { JOEY_ICON } from "./icon";

export interface JoeyWalletAdapterOptions {
  provider?: JoeyInjectedProvider;
  maxFeeDrops?: string;
  /** Reconnect after the wallet changes account/network or revokes access. */
  onDisconnected?: () => void;
}

function invalid(message: string): never { throw new WalletKitError(WalletKitErrorCode.INVALID_REQUEST, message); }
function fee(value: unknown): bigint {
  if (typeof value !== "string" || !/^[1-9]\d{0,17}$/.test(value)) invalid("Joey requires a positive fee limit in drops.");
  return BigInt(value);
}
function networkFor(network?: WalletNetwork): WalletNetwork {
  const known = DEFAULT_XRPL_NETWORKS.find(item => item.id === (network?.id ?? "mainnet"));
  if (!known || (network && ((network.family ?? "xrpl") !== "xrpl" || network.networkType !== known.networkType ||
    network.rpcUrl !== known.rpcUrl || network.networkId !== known.networkId))) throw createWalletError.networkNotSupported("Joey Wallet", network?.id);
  return { ...known };
}
function chainFor(network: WalletNetwork): JoeyChain { return network.walletConnectChainId as JoeyChain; }

export class JoeyWalletAdapter extends BaseWalletAdapter {
  override adapterApiVersion = "1.2" as const;
  metadata: WalletMetadata = { id: "joey-wallet", name: "Joey Wallet", type: "extension", group: "Extensions", icon: JOEY_ICON, homepage: "https://joeywallet.xyz/" };
  capabilities: WalletCapabilities = { connect: true, disconnect: true, signTransaction: true, signAndSubmit: true,
    signMessage: false, signIn: true, details: { supportedChains: { families: ["xrpl"], networkIds: ["mainnet", "testnet", "devnet"] }, transactionModes: ["sign-only", "sign-and-submit"] } };
  private client?: Joey;
  private account?: WalletAccount;
  private generation = 0;
  private readonly maxFee: bigint;
  constructor(private readonly options: JoeyWalletAdapterOptions = {}) { super(); this.maxFee = fee(options.maxFeeDrops ?? "1000000"); }
  isAvailable(): boolean { return Boolean(this.options.provider || getJoey()); }
  private provider(): Joey {
    const client = this.options.provider ? createJoeyClient(this.options.provider) : getJoey();
    if (!client) throw createWalletError.walletNotAvailable(this.metadata.name);
    return client;
  }
  async connect(options: ConnectOptions) {
    const network = networkFor(options.network);
    const generation = ++this.generation;
    await this.runCleanup();
    this.account = undefined;
    return this.withWalletRequest(options, async signal => {
      try {
        const client = this.provider();
        assertWalletRequestActive(signal);
        const result = await client.connect({ chain: chainFor(network) });
        const current = await client.getNetwork();
        assertWalletRequestActive(signal);
        this.assertGeneration(generation);
        if (result.chain !== chainFor(network) || current.chain !== result.chain) throw createWalletError.networkNotSupported(this.metadata.name, current.chain);
        const account = result.accounts[0];
        if (!account || !isValidClassicAddress(account.address) || (account.publicKey && deriveAddress(account.publicKey) !== account.address)) invalid("Invalid Joey account.");
        this.bind(client, { address: account.address, publicKey: account.publicKey, network, networkType: network.networkType });
        return { account: this.account!, raw: result };
      } catch (cause) { throw this.mapError(cause, false); }
    });
  }
  async restoreSession(session: WalletSession) {
    const generation = ++this.generation;
    await this.runCleanup();
    this.account = undefined;
    try {
      const network = networkFor(session.account.network);
      const client = this.provider();
      const accounts = await client.getAccounts();
      const current = await client.getNetwork();
      this.assertGeneration(generation);
      if (session.adapterId !== this.metadata.id || !isValidClassicAddress(session.account.address) ||
        !accounts.includes(session.account.address) || current.chain !== chainFor(network)) return null;
      this.bind(client, { address: session.account.address, network, networkType: network.networkType });
      return { account: this.account! };
    } catch { return null; }
  }
  cancelPendingConnection() { ++this.generation; }
  async disconnect() {
    const client = this.client;
    ++this.generation; this.account = undefined; this.client = undefined;
    await this.runCleanup();
    await client?.disconnect();
  }
  private bind(client: Joey, account: WalletAccount) {
    this.client = client; this.account = account;
    const invalidate = () => {
      if (this.client !== client || !this.account) return;
      ++this.generation; this.account = undefined;
      void this.runCleanup();
      this.options.onDisconnected?.();
    };
    this.addCleanup(client.on("disconnect", invalidate));
    this.addCleanup(client.on("accountsChanged", accounts => {
      if (!accounts.some(item => item.address === account.address)) invalidate();
    }));
    this.addCleanup(client.on("networkChanged", network => {
      if (network?.chain !== chainFor(account.network!)) invalidate();
    }));
  }
  private assertGeneration(generation: number) {
    if (generation !== this.generation) throw new WalletKitError(WalletKitErrorCode.REQUEST_CANCELLED, "Joey session changed. Reconnect.");
  }
  async signIn(request: SignInRequest): Promise<SignInResult> {
    assertSignInRequest(request);
    const account = this.account, client = this.client, generation = this.generation;
    if (!account?.network || !client) throw new WalletKitError(WalletKitErrorCode.NOT_CONNECTED, "Connect Joey Wallet first.");
    if (request.account && request.account.address !== account.address) invalid("Joey account mismatch.");
    if (typeof location === "undefined" || !/^https?:$/.test(location.protocol)) invalid("Joey sign-in requires a web origin.");
    const context = { address: account.address, chainId: chainFor(account.network), domain: location.host, uri: location.origin,
      nonce: request.nonce, statement: request.statement, resources: request.resources ? [...request.resources] : undefined };
    return this.withWalletRequest(request, async signal => {
      try {
        assertWalletRequestActive(signal); this.assertGeneration(generation);
        const raw = await client.signIn({ mode: "caip122", nonce: context.nonce, statement: context.statement, resources: context.resources });
        assertWalletRequestActive(signal); this.assertGeneration(generation);
        if (raw.address !== account.address) invalid("Joey sign-in account mismatch.");
        let result: SignInResult;
        if (isChallengeSignIn(raw)) {
          if (typeof raw.signedTx !== "string" || raw.signedTx.length > 262144) invalid("Invalid Joey challenge proof.");
          const txBlob = encode(JSON.parse(raw.signedTx) as Transaction);
          const tx = decode(txBlob) as Record<string, unknown>;
          result = { address: raw.address, chainId: context.chainId, nonce: context.nonce, mode: "challenge-v1", signatureKind: "signedTx", txBlob, proof: txBlob, raw };
          assertSignInContext(result, context, tx);
          if (typeof tx.SigningPubKey !== "string" || deriveAddress(tx.SigningPubKey) !== account.address || !verifySignature(txBlob)) invalid("Invalid Joey challenge signature.");
        } else {
          result = { address: raw.address, chainId: context.chainId, nonce: context.nonce, mode: "caip122", signatureKind: "signature",
            message: raw.message, signature: raw.signature, publicKey: raw.publicKey, proof: raw.signature, raw };
          assertSignInContext(result, context);
          const messageHex = Array.from(new TextEncoder().encode(raw.message), byte => byte.toString(16).padStart(2, "0")).join("");
          if (deriveAddress(raw.publicKey) !== account.address || !verify(messageHex, raw.signature, raw.publicKey)) invalid("Invalid Joey sign-in signature.");
        }
        return result;
      } catch (cause) { throw this.mapError(cause, true); }
    });
  }
  async signTransaction(request: SignTransactionRequest) {
    const result = await this.sign(request, false);
    return { txBlob: result.tx_blob, signed: true, raw: result };
  }
  async signAndSubmit(request: SignAndSubmitRequest) {
    if (request.submit === false) return this.signTransaction(request);
    const result = await this.sign(request, true);
    return { hash: result.hash, status: "submitted", signed: true, raw: result };
  }
  private async sign(request: SignTransactionRequest, submit: boolean) {
    const account = this.account; const client = this.client; const generation = this.generation;
    if (!account?.network || !client) throw new WalletKitError(WalletKitErrorCode.NOT_CONNECTED, "Connect Joey Wallet first.");
    const tx = structuredClone(request.txJson) as Record<string, unknown>;
    if (typeof tx.TransactionType !== "string") invalid("Joey requires a transaction type.");
    if (tx.Account !== undefined && tx.Account !== account.address) invalid("Joey account mismatch.");
    if (tx.NetworkID !== undefined && tx.NetworkID !== Number(chainFor(account.network).split(":")[1])) invalid("Joey network mismatch.");
    if (tx.TransactionType === "Batch" || tx.Signers !== undefined || tx.TxnSignature !== undefined || tx.SigningPubKey !== undefined) invalid("Joey supports unsigned single transactions only.");
    tx.Account = account.address;
    const limits = [this.maxFee, ...(request.maxFeeDrops === undefined ? [] : [fee(request.maxFeeDrops)]),
      ...(request.preflight && request.preflight.maxFeeDrops !== undefined ? [fee(request.preflight.maxFeeDrops)] : [])];
    const ceiling = limits.reduce((min, value) => value < min ? value : min);
    if (tx.Fee !== undefined && fee(tx.Fee) > ceiling) invalid("Joey fee exceeds the limit.");
    let dispatched = false;
    return this.withWalletRequest(request, async signal => {
      assertWalletRequestActive(signal); this.assertGeneration(generation);
      const params = { tx_json: tx as Record<string, unknown> & { TransactionType: string }, account: account.address, chain: chainFor(account.network!), autofill: true };
      dispatched = true;
      const result = submit ? await client.signAndSubmitTransaction(params) : await client.signTransaction(params);
      assertWalletRequestActive(signal); this.assertGeneration(generation);
      const signed = decode(result.tx_blob) as Record<string, unknown>;
      if (signed.Account !== account.address || typeof signed.SigningPubKey !== "string" || deriveAddress(signed.SigningPubKey) !== account.address ||
        !verifySignature(result.tx_blob) || hashes.hashSignedTx(result.tx_blob) !== result.hash.toUpperCase()) invalid("Invalid Joey signature or hash.");
      if (fee(signed.Fee) > ceiling) invalid("Joey fee exceeds the limit.");
      delete signed.SigningPubKey; delete signed.TxnSignature;
      for (const field of ["Fee", "Sequence", "LastLedgerSequence"]) if (!(field in tx)) delete signed[field];
      if (!("Flags" in tx) && (signed.Flags === 0 || signed.Flags === 2147483648)) delete signed.Flags;
      if (encode(signed as unknown as Transaction) !== encode(tx as unknown as Transaction)) invalid("Joey changed requested transaction fields.");
      const engine = "engine_result" in result ? result.engine_result : undefined;
      if (submit && engine !== undefined && engine !== "tesSUCCESS" && engine !== "terQUEUED") {
        throw new WalletKitError(WalletKitErrorCode.SUBMIT_FAILED, `Joey submission: ${engine}`, { details: { hash: result.hash, engineResult: engine, outcomeUnknown: !/^(tem|tef|tel)/.test(String(engine)) } });
      }
      return result;
    }).catch(cause => {
      const error = this.mapError(cause, true);
      // Local timeout/cancellation cannot recall a native wallet submission.
      if (submit && dispatched && ![WalletKitErrorCode.SIGN_REJECTED, WalletKitErrorCode.SUBMIT_FAILED].includes(error.code)) {
        throw new WalletKitError(error.code, error.message, { cause: error, details: { ...error.details, outcomeUnknown: true } });
      }
      throw error;
    });
  }
  private mapError(cause: unknown, signing: boolean): WalletKitError {
    if (cause instanceof WalletKitError) return cause;
    const code = (cause as { code?: unknown } | null)?.code;
    if (code === 4001) return new WalletKitError(signing ? WalletKitErrorCode.SIGN_REJECTED : WalletKitErrorCode.CONNECTION_REJECTED, "Joey request rejected.", { cause });
    if (code === 4901 || code === 4902) return new WalletKitError(WalletKitErrorCode.NETWORK_MISMATCH, "Select the requested network in Joey.", { cause });
    return new WalletKitError(signing ? WalletKitErrorCode.SIGN_FAILED : WalletKitErrorCode.CONNECTION_FAILED, signing ? "Joey signing failed." : "Joey connection failed.", { cause });
  }
}

export function createJoeyWalletAdapter(options?: JoeyWalletAdapterOptions) { return new JoeyWalletAdapter(options); }
