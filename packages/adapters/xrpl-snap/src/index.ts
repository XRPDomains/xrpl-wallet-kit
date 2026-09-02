import { BaseWalletAdapter, createWalletError, normalizeTxResult, utf8ToHex } from "@xrpl-wallet-kit/core";
import type { ConnectOptions, SignAndSubmitRequest, SignMessageRequest, WalletCapabilities, WalletMetadata, WalletSession } from "@xrpl-wallet-kit/core";

export const METAMASK_ICON = "data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0idXRmLTgiPz4KPHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHhtbDpzcGFjZT0icHJlc2VydmUiIGlkPSJMYXllcl8xIiB4PSIwIiB5PSIwIiB2ZXJzaW9uPSIxLjEiIHZpZXdCb3g9IjAgMCAzMTguNiAzMTguNiI+CiAgPHN0eWxlPgogICAgLnN0MSwuc3Q2e2ZpbGw6I2U0NzYxYjtzdHJva2U6I2U0NzYxYjtzdHJva2UtbGluZWNhcDpyb3VuZDtzdHJva2UtbGluZWpvaW46cm91bmR9LnN0NntmaWxsOiNmNjg1MWI7c3Ryb2tlOiNmNjg1MWJ9CiAgPC9zdHlsZT4KICA8cGF0aCBmaWxsPSIjZTI3NjFiIiBzdHJva2U9IiNlMjc2MWIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIgZD0ibTI3NC4xIDM1LjUtOTkuNSA3My45TDE5MyA2NS44eiIvPgogIDxwYXRoIGQ9Im00NC40IDM1LjUgOTguNyA3NC42LTE3LjUtNDQuM3ptMTkzLjkgMTcxLjMtMjYuNSA0MC42IDU2LjcgMTUuNiAxNi4zLTU1LjN6bS0yMDQuNC45TDUwLjEgMjYzbDU2LjctMTUuNi0yNi41LTQwLjZ6IiBjbGFzcz0ic3QxIi8+CiAgPHBhdGggZD0ibTEwMy42IDEzOC4yLTE1LjggMjMuOSA1Ni4zIDIuNS0yLTYwLjV6bTExMS4zIDAtMzktMzQuOC0xLjMgNjEuMiA1Ni4yLTIuNXpNMTA2LjggMjQ3LjRsMzMuOC0xNi41LTI5LjItMjIuOHptNzEuMS0xNi41IDMzLjkgMTYuNS00LjctMzkuM3oiIGNsYXNzPSJzdDEiLz4KICA8cGF0aCBmaWxsPSIjZDdjMWIzIiBzdHJva2U9IiNkN2MxYjMiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIgZD0ibTIxMS44IDI0Ny40LTMzLjktMTYuNSAyLjcgMjIuMS0uMyA5LjN6bS0xMDUgMCAzMS41IDE0LjktLjItOS4zIDIuNS0yMi4xeiIvPgogIDxwYXRoIGZpbGw9IiMyMzM0NDciIHN0cm9rZT0iIzIzMzQ0NyIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIiBkPSJtMTM4LjggMTkzLjUtMjguMi04LjMgMTkuOS05LjF6bTQwLjkgMCA4LjMtMTcuNCAyMCA5LjF6Ii8+CiAgPHBhdGggZmlsbD0iI2NkNjExNiIgc3Ryb2tlPSIjY2Q2MTE2IiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiIGQ9Im0xMDYuOCAyNDcuNCA0LjgtNDAuNi0zMS4zLjl6TTIwNyAyMDYuOGw0LjggNDAuNiAyNi41LTM5Ljd6bTIzLjgtNDQuNy01Ni4yIDIuNSA1LjIgMjguOSA4LjMtMTcuNCAyMCA5LjF6bS0xMjAuMiAyMy4xIDIwLTkuMSA4LjIgMTcuNCA1LjMtMjguOS01Ni4zLTIuNXoiLz4KICA8cGF0aCBmaWxsPSIjZTQ3NTFmIiBzdHJva2U9IiNlNDc1MWYiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIgZD0ibTg3LjggMTYyLjEgMjMuNiA0Ni0uOC0yMi45em0xMjAuMyAyMy4xLTEgMjIuOSAyMy43LTQ2em0tNjQtMjAuNi01LjMgMjguOSA2LjYgMzQuMSAxLjUtNDQuOXptMzAuNSAwLTIuNyAxOCAxLjIgNDUgNi43LTM0LjF6Ii8+CiAgPHBhdGggZD0ibTE3OS44IDE5My41LTYuNyAzNC4xIDQuOCAzLjMgMjkuMi0yMi44IDEtMjIuOXptLTY5LjItOC4zLjggMjIuOSAyOS4yIDIyLjggNC44LTMuMy02LjYtMzQuMXoiIGNsYXNzPSJzdDYiLz4KICA8cGF0aCBmaWxsPSIjYzBhZDllIiBzdHJva2U9IiNjMGFkOWUiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIgZD0ibTE4MC4zIDI2Mi4zLjMtOS4zLTIuNS0yLjJoLTM3LjdsLTIuMyAyLjIuMiA5LjMtMzEuNS0xNC45IDExIDkgMjIuMyAxNS41aDM4LjNsMjIuNC0xNS41IDExLTl6Ii8+CiAgPHBhdGggZmlsbD0iIzE2MTYxNiIgc3Ryb2tlPSIjMTYxNjE2IiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiIGQ9Im0xNzcuOSAyMzAuOS00LjgtMy4zaC0yNy43bC00LjggMy4zLTIuNSAyMi4xIDIuMy0yLjJoMzcuN2wyLjUgMi4yeiIvPgogIDxwYXRoIGZpbGw9IiM3NjNkMTYiIHN0cm9rZT0iIzc2M2QxNiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIiBkPSJtMjc4LjMgMTE0LjIgOC41LTQwLjgtMTIuNy0zNy45LTk2LjIgNzEuNCAzNyAzMS4zIDUyLjMgMTUuMyAxMS42LTEzLjUtNS0zLjYgOC03LjMtNi4yLTQuOCA4LTYuMXpNMzEuOCA3My40bDguNSA0MC44LTUuNCA0IDggNi4xLTYuMSA0LjggOCA3LjMtNSAzLjYgMTEuNSAxMy41IDUyLjMtMTUuMyAzNy0zMS4zLTk2LjItNzEuNHoiLz4KICA8cGF0aCBkPSJtMjY3LjIgMTUzLjUtNTIuMy0xNS4zIDE1LjkgMjMuOS0yMy43IDQ2IDMxLjItLjRoNDYuNXptLTE2My42LTE1LjMtNTIuMyAxNS4zLTE3LjQgNTQuMmg0Ni40bDMxLjEuNC0yMy42LTQ2em03MSAyNi40IDMuMy01Ny43IDE1LjItNDEuMWgtNjcuNWwxNSA0MS4xIDMuNSA1Ny43IDEuMiAxOC4yLjEgNDQuOGgyNy43bC4yLTQ0Ljh6IiBjbGFzcz0ic3Q2Ii8+Cjwvc3ZnPg==";
export const XRPLSNAP_ICON = METAMASK_ICON;

const NETWORK_TO_SNAP_CHAIN_ID: Record<string, number> = {
  mainnet: 0,
  testnet: 1,
  devnet: 2
};

export interface Eip1193Provider {
  request(args: unknown): Promise<unknown>;
  isMetaMask?: boolean;
  _metamask?: unknown;
  providers?: Eip1193Provider[];
}

interface Eip6963ProviderInfo {
  rdns?: string;
  name?: string;
}

interface Eip6963ProviderDetail {
  info?: Eip6963ProviderInfo;
  provider?: Eip1193Provider;
}

const discoveredMetaMaskProviders = new Set<Eip1193Provider>();
let eip6963DiscoveryStarted = false;

export interface XrplSnapAdapterOptions {
  ethereum?: Eip1193Provider;
  snapId?: string;
  icon?: string;
  signMessageDestination?: string;
  signMessageMethods?: string[];
  providerDiscoveryTimeoutMs?: number;
  snapRequestRetryDelaysMs?: number[];
}

export class XrplSnapAdapter extends BaseWalletAdapter {
  metadata: WalletMetadata;
  capabilities: WalletCapabilities = { connect: true, signMessage: true, signAndSubmit: true, payments: true, nftOffers: true };
  private snapId: string;
  private activeAddress?: string;
  private activeProvider?: Eip1193Provider;

  constructor(private options: XrplSnapAdapterOptions = {}) {
    super();
    this.snapId = options.snapId ?? "npm:xrpl-snap";
    this.metadata = {
      id: "xrplsnap",
      name: "MetaMask",
      type: "snap",
      group: "XRPL Snap",
      icon: options.icon ?? METAMASK_ICON
    };
  }

  async isAvailable(): Promise<boolean> {
    return Boolean(await this.ethereumCandidate(false));
  }

  async connect(options: ConnectOptions) {
    const ethereum = await this.ethereumCandidate().catch((error) => {
      throw createWalletError.walletNotAvailable("MetaMask Snaps", error);
    });
    await this.withAbort(
      ethereum.request({ method: "wallet_requestSnaps", params: { [this.snapId]: {} } }).catch((error) => {
        if (this.isSnapsUnsupportedError(error)) {
          throw createWalletError.walletNotAvailable("MetaMask Snaps", error);
        }
        throw error;
      }),
      options.signal
    );
    this.activeAddress = undefined;
    this.activeProvider = ethereum;
    await this.selectSnapNetwork(options);
    const snap = await this.withAbort(this.invokeSnap("xrpl_getAccount", undefined), options.signal);
    const address = (snap as { account?: string }).account;
    const publicKey = (snap as { publicKey?: string }).publicKey;
    if (!address) throw new Error("XRPL Snap did not return an XRPL address");
    this.activeAddress = address;
    this.activeProvider = ethereum;
    return { account: { address, publicKey, network: options.network, networkType: options.network?.networkType }, raw: snap };
  }

  async restoreSession(session: WalletSession) {
    const ethereum = await this.ethereum(false);
    if (!ethereum || !await this.providerSupportsSnaps(ethereum)) return null;
    this.activeAddress = session.account.address;
    this.activeProvider = ethereum;
    return { account: session.account, session, raw: null };
  }

  async signMessage(request: SignMessageRequest) {
    const txJson = this.createSignMessagePaymentTx(request);
    const methods = this.options.signMessageMethods ?? ["xrpl_signMessage", "xrpl_sign", "xrpl_signTransaction", "npm:xrpl-snap"];
    const errors: unknown[] = [];

    for (const method of methods) {
      try {
        const params = method === "xrpl_signMessage" ? { message: request.message } : txJson;
        const result = await this.invokeSnap(method, params);
        const signature = this.pickString(result, [
          "signature",
          "signedMessage",
          "result.signature",
          "result.signedMessage",
          "response.signature",
          "response.signedMessage",
          "response.data.signature",
          "response.data.signedMessage"
        ]);
        if (method === "xrpl_signMessage" && signature) {
          return { signatureKind: "signature" as const, proof: signature, signature, publicKey: request.account?.publicKey, raw: result };
        }
        const txBlob = this.pickString(result, [
          "tx_blob",
          "txBlob",
          "hex",
          "signedTransaction",
          "signed_transaction",
          "result.tx_blob",
          "result.txBlob",
          "result.hex",
          "result.signedTransaction",
          "result.signed_transaction",
          "response.tx_blob",
          "response.txBlob",
          "response.hex",
          "response.signedTransaction",
          "response.signed_transaction",
          "response.data.tx_blob",
          "response.data.txBlob",
          "response.data.hex",
          "response.data.signedTransaction",
          "response.data.signed_transaction",
          "signature",
          "signedMessage",
          "result.signature",
          "result.signedMessage"
        ]);
        if (!txBlob) throw new Error(`XRPL Snap ${method} did not return a signature or signed transaction`);
        return { signatureKind: "signedTx" as const, proof: txBlob, txBlob, raw: result };
      } catch (error) {
        errors.push({ method, error: this.formatError(error) });
      }
    }

    throw this.toSnapSignError(errors, "XRPL Snap could not sign the message.");
  }

  getSignMessageRequestPreview(request: SignMessageRequest) {
    return {
      method: "wallet_invokeSnap",
      params: {
        snapId: this.snapId,
        request: {
          method: this.options.signMessageMethods?.[0] ?? "xrpl_signMessage",
          params: this.options.signMessageMethods?.[0] === "xrpl_sign" || this.options.signMessageMethods?.[0] === "xrpl_signTransaction"
            ? this.createSignMessagePaymentTx(request)
            : { message: request.message }
        }
      }
    };
  }

  async signAndSubmit(request: SignAndSubmitRequest) {
    try {
      const result = await this.invokeSnap("xrpl_signAndSubmit", request.txJson);
      this.assertSuccessfulSubmit(result);
      return normalizeTxResult(result);
    } catch (error) {
      throw this.toSnapSignError(error, "XRPL Snap could not submit this transaction.");
    }
  }

  private async invokeSnap(method: string, params: unknown) {
    const ethereum = await this.ethereum();
    const request = () => ethereum.request({
      method: "wallet_invokeSnap",
      params: { snapId: this.snapId, request: { method, params } }
    });
    const retryDelays = this.options.snapRequestRetryDelaysMs ?? [120, 350, 800];

    try {
      return await request();
    } catch (error) {
      if (!this.isSnapKeyringHydratingError(error)) throw error;
      let lastError = error;
      for (const delayMs of retryDelays) {
        await this.delay(delayMs);
        try {
          return await request();
        } catch (retryError) {
          lastError = retryError;
          if (!this.isSnapKeyringHydratingError(retryError)) throw retryError;
        }
      }
      throw lastError;
    }
  }

  private createSignMessagePaymentTx(request: SignMessageRequest) {
    const account = request.account?.address ?? this.activeAddress;
    if (!account) throw new Error("XRPL Snap account is not connected");
    return {
      TransactionType: "Payment",
      Account: account,
      Destination: this.options.signMessageDestination ?? account,
      Amount: "1",
      Fee: "15",
      Memos: [{ Memo: { MemoData: utf8ToHex(request.message) } }]
    };
  }

  private async selectSnapNetwork(options: ConnectOptions) {
    const networkId = options.network?.id;
    if (!networkId) return;
    const chainId = NETWORK_TO_SNAP_CHAIN_ID[networkId];
    if (chainId === undefined) return;

    try {
      const active = await this.invokeSnap("xrpl_getActiveNetwork", undefined) as { chainId?: number };
      if (active?.chainId !== chainId) await this.invokeSnap("xrpl_changeNetwork", { chainId });
      const applied = await this.invokeSnap("xrpl_getActiveNetwork", undefined) as { chainId?: number };
      if (applied?.chainId !== chainId) {
        throw new Error(`XRPL Snap network mismatch: expected chain ${chainId}, got ${String(applied?.chainId)}`);
      }
    } catch (error) {
      if (/unknown method|method not found|not supported|unsupported/i.test(this.getErrorMessage(error))) return;
      throw error;
    }
  }

  private assertSuccessfulSubmit(result: unknown) {
    const engineResult = this.pickString(result, [
      "engine_result",
      "result.engine_result",
      "response.engine_result",
      "response.data.engine_result",
      "response.data.result.engine_result"
    ]);
    if (!engineResult) return;
    if (engineResult === "tesSUCCESS" || engineResult === "terQUEUED") return;
    const message = this.pickString(result, [
      "engine_result_message",
      "result.engine_result_message",
      "response.engine_result_message",
      "response.data.engine_result_message",
      "response.data.result.engine_result_message"
    ]);
    throw new Error(message ? `XRPL Snap submission failed: ${message}` : `XRPL Snap submission failed: ${engineResult}`);
  }

  private pickString(value: unknown, paths: string[]) {
    for (const path of paths) {
      const found = path.split(".").reduce<unknown>((current, key) => {
        if (current && typeof current === "object" && key in current) return (current as Record<string, unknown>)[key];
        return undefined;
      }, value);
      if (typeof found === "string") return found;
    }
    return undefined;
  }

  private formatError(error: unknown) {
    if (error instanceof Error) return { name: error.name, message: error.message };
    return error;
  }

  private toSnapSignError(cause: unknown, fallback: string) {
    const message = this.getErrorMessage(cause);
    if (/reject|denied|cancelled|canceled|closed/i.test(message)) return createWalletError.signRejected(cause);
    if (/timeout|timed out/i.test(message)) return createWalletError.requestTimeout("XRPL Snap request timed out. Please try again.", cause);
    if (/not installed|not available|provider/i.test(message)) return createWalletError.walletNotAvailable("XRPL Snap", cause);
    if (/unsupported|not supported|unknown method|method not found/i.test(message)) return createWalletError.unsupportedMethod("XRPL Snap request", "MetaMask");
    const safeError = new Error(fallback) as Error & { cause?: unknown };
    safeError.cause = cause;
    return createWalletError.signFailed(safeError);
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    if (typeof error === "string") return error;
    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }

  private ethereum(required?: true): Promise<Eip1193Provider>;
  private ethereum(required: false): Promise<Eip1193Provider | undefined>;
  private async ethereum(required = true): Promise<Eip1193Provider | undefined> {
    const injected = (globalThis as unknown as { ethereum?: Eip1193Provider }).ethereum;
    this.startEip6963Discovery();
    const configured = this.options.ethereum;
    if (this.activeProvider) return this.activeProvider;
    if (configured) return await this.pickSnapProvider(configured, true) ?? this.pickStrongMetaMaskProvider(configured);
    const ethereum = await this.pickSnapProvider(injected, false)
      ?? await this.discoverMetaMaskProvider()
      ?? [...discoveredMetaMaskProviders][0]
      ?? this.pickStrongMetaMaskProvider(injected);
    if (!ethereum && required) throw new Error("No MetaMask provider installed");
    if (ethereum) this.activeProvider = ethereum;
    return ethereum;
  }

  private ethereumCandidate(required?: true): Promise<Eip1193Provider>;
  private ethereumCandidate(required: false): Promise<Eip1193Provider | undefined>;
  private async ethereumCandidate(required = true): Promise<Eip1193Provider | undefined> {
    const injected = (globalThis as unknown as { ethereum?: Eip1193Provider }).ethereum;
    this.startEip6963Discovery();
    const configured = this.options.ethereum;
    const ethereum = await this.pickSnapProvider(configured, true)
      ?? this.pickStrongMetaMaskProvider(configured)
      ?? this.activeProvider
      ?? await this.pickSnapProvider(injected, false)
      ?? this.pickStrongMetaMaskProvider(injected)
      ?? await this.discoverMetaMaskProvider()
      ?? [...discoveredMetaMaskProviders][0];
    if (!ethereum && required) throw new Error("No MetaMask provider installed");
    return ethereum;
  }

  private pickStrongMetaMaskProvider(injected?: Eip1193Provider): Eip1193Provider | undefined {
    if (!injected) return undefined;
    const providers = Array.isArray(injected.providers) ? injected.providers : [];
    return providers.find((provider) => this.hasMetaMaskProviderApi(provider))
      ?? (this.hasMetaMaskProviderApi(injected) ? injected : undefined);
  }

  private async pickSnapProvider(injected?: Eip1193Provider, allowRootProvider = false): Promise<Eip1193Provider | undefined> {
    const preferred = this.pickStrongMetaMaskProvider(injected);
    if (preferred && await this.providerSupportsSnaps(preferred)) return preferred;
    for (const provider of injected?.providers ?? []) {
      if (provider === preferred) continue;
      if (await this.providerSupportsSnaps(provider)) return provider;
    }
    if (allowRootProvider && injected && injected !== preferred && await this.providerSupportsSnaps(injected)) return injected;
    return undefined;
  }

  private startEip6963Discovery(): void {
    if (eip6963DiscoveryStarted) return;
    const scope = globalThis as unknown as {
      addEventListener?: (type: string, listener: EventListener) => void;
      dispatchEvent?: (event: Event) => boolean;
    };
    if (!scope.addEventListener || !scope.dispatchEvent) return;
    eip6963DiscoveryStarted = true;
    scope.addEventListener("eip6963:announceProvider", (event) => {
      const provider = this.pickMetaMaskProviderFromAnnounce(event);
      if (provider) discoveredMetaMaskProviders.add(provider);
    });
    try {
      scope.dispatchEvent(new Event("eip6963:requestProvider"));
    } catch {
      // Non-browser test/runtime shims may not implement DOM Event dispatch fully.
    }
  }

  private discoverMetaMaskProvider(): Promise<Eip1193Provider | undefined> {
    const cached = [...discoveredMetaMaskProviders][0];
    if (cached) return Promise.resolve(cached);
    const scope = globalThis as unknown as {
      addEventListener?: (type: string, listener: EventListener) => void;
      removeEventListener?: (type: string, listener: EventListener) => void;
      dispatchEvent?: (event: Event) => boolean;
    };
    if (!scope.addEventListener || !scope.removeEventListener || !scope.dispatchEvent) return Promise.resolve(undefined);
    const addEventListener = scope.addEventListener.bind(scope);
    const removeEventListener = scope.removeEventListener.bind(scope);
    const dispatchEvent = scope.dispatchEvent.bind(scope);
    return new Promise((resolve) => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      let settled = false;
      const finish = (provider?: Eip1193Provider) => {
        if (settled) return;
        settled = true;
        if (timer) clearTimeout(timer);
        removeEventListener("eip6963:announceProvider", onAnnounce);
        resolve(provider);
      };
      const onAnnounce: EventListener = (event) => {
        const provider = this.pickMetaMaskProviderFromAnnounce(event);
        if (provider) {
          discoveredMetaMaskProviders.add(provider);
          finish(provider);
        }
      };

      addEventListener("eip6963:announceProvider", onAnnounce);
      try {
        dispatchEvent(new Event("eip6963:requestProvider"));
      } catch {
        finish(undefined);
        return;
      }
      timer = setTimeout(() => finish([...discoveredMetaMaskProviders][0]), this.options.providerDiscoveryTimeoutMs ?? 1000);
    });
  }

  private pickMetaMaskProviderFromAnnounce(event: Event): Eip1193Provider | undefined {
    const detail = (event as Event & { detail?: Eip6963ProviderDetail }).detail;
    const provider = detail?.provider;
    const rdns = detail?.info?.rdns?.toLowerCase() ?? "";
    const name = detail?.info?.name?.toLowerCase() ?? "";
    if (provider && (rdns.includes("metamask") || name.includes("metamask") || this.hasMetaMaskProviderApi(provider))) return provider;
    return undefined;
  }

  private async providerSupportsSnaps(ethereum: Eip1193Provider): Promise<boolean> {
    try {
      await ethereum.request({ method: "wallet_getSnaps" });
      return true;
    } catch (error) {
      if (this.isSnapsUnsupportedError(error)) return false;
      return false;
    }
  }

  private hasMetaMaskProviderApi(provider?: Eip1193Provider): boolean {
    return Boolean(provider && (provider as unknown as Record<string, unknown>)._metamask);
  }

  private isSnapsUnsupportedError(error: unknown): boolean {
    const message = this.getErrorMessage(error);
    return /-32601|wallet_requestSnaps|wallet_getSnaps|does not exist|not available|unsupported|method not found|unknown method/i.test(message);
  }

  private isSnapKeyringHydratingError(error: unknown): boolean {
    const message = this.getErrorMessage(error);
    return /KeyringController\s*-\s*Keyring not found|Keyring not found/i.test(message);
  }

  private delay(ms: number): Promise<void> {
    if (ms <= 0) return Promise.resolve();
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private withAbort<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
    if (!signal) return promise;
    if (signal.aborted) return Promise.reject(createWalletError.connectionRejected(this.metadata.name, new Error("Connection was cancelled")));
    return new Promise<T>((resolve, reject) => {
      let settled = false;
      const cleanup = () => signal.removeEventListener("abort", abort);
      const abort = () => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(createWalletError.connectionRejected(this.metadata.name, new Error("Connection was cancelled")));
      };
      signal.addEventListener("abort", abort, { once: true });
      promise.then(
        (value) => {
          if (settled) return;
          settled = true;
          cleanup();
          resolve(value);
        },
        (error) => {
          if (settled) return;
          settled = true;
          cleanup();
          reject(error);
        }
      );
    });
  }
}

export function createXrplSnapAdapter(options?: XrplSnapAdapterOptions) { return new XrplSnapAdapter(options); }


