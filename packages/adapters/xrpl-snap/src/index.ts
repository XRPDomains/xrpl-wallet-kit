import { BaseWalletAdapter, normalizeTxResult } from "@xrpl-wallet-kit/core";
import type { ConnectOptions, SignAndSubmitRequest, SignMessageRequest, WalletCapabilities, WalletMetadata, WalletSession } from "@xrpl-wallet-kit/core";

export const METAMASK_ICON = "data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0idXRmLTgiPz4KPHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHhtbDpzcGFjZT0icHJlc2VydmUiIGlkPSJMYXllcl8xIiB4PSIwIiB5PSIwIiB2ZXJzaW9uPSIxLjEiIHZpZXdCb3g9IjAgMCAzMTguNiAzMTguNiI+CiAgPHN0eWxlPgogICAgLnN0MSwuc3Q2e2ZpbGw6I2U0NzYxYjtzdHJva2U6I2U0NzYxYjtzdHJva2UtbGluZWNhcDpyb3VuZDtzdHJva2UtbGluZWpvaW46cm91bmR9LnN0NntmaWxsOiNmNjg1MWI7c3Ryb2tlOiNmNjg1MWJ9CiAgPC9zdHlsZT4KICA8cGF0aCBmaWxsPSIjZTI3NjFiIiBzdHJva2U9IiNlMjc2MWIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIgZD0ibTI3NC4xIDM1LjUtOTkuNSA3My45TDE5MyA2NS44eiIvPgogIDxwYXRoIGQ9Im00NC40IDM1LjUgOTguNyA3NC42LTE3LjUtNDQuM3ptMTkzLjkgMTcxLjMtMjYuNSA0MC42IDU2LjcgMTUuNiAxNi4zLTU1LjN6bS0yMDQuNC45TDUwLjEgMjYzbDU2LjctMTUuNi0yNi41LTQwLjZ6IiBjbGFzcz0ic3QxIi8+CiAgPHBhdGggZD0ibTEwMy42IDEzOC4yLTE1LjggMjMuOSA1Ni4zIDIuNS0yLTYwLjV6bTExMS4zIDAtMzktMzQuOC0xLjMgNjEuMiA1Ni4yLTIuNXpNMTA2LjggMjQ3LjRsMzMuOC0xNi41LTI5LjItMjIuOHptNzEuMS0xNi41IDMzLjkgMTYuNS00LjctMzkuM3oiIGNsYXNzPSJzdDEiLz4KICA8cGF0aCBmaWxsPSIjZDdjMWIzIiBzdHJva2U9IiNkN2MxYjMiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIgZD0ibTIxMS44IDI0Ny40LTMzLjktMTYuNSAyLjcgMjIuMS0uMyA5LjN6bS0xMDUgMCAzMS41IDE0LjktLjItOS4zIDIuNS0yMi4xeiIvPgogIDxwYXRoIGZpbGw9IiMyMzM0NDciIHN0cm9rZT0iIzIzMzQ0NyIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIiBkPSJtMTM4LjggMTkzLjUtMjguMi04LjMgMTkuOS05LjF6bTQwLjkgMCA4LjMtMTcuNCAyMCA5LjF6Ii8+CiAgPHBhdGggZmlsbD0iI2NkNjExNiIgc3Ryb2tlPSIjY2Q2MTE2IiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiIGQ9Im0xMDYuOCAyNDcuNCA0LjgtNDAuNi0zMS4zLjl6TTIwNyAyMDYuOGw0LjggNDAuNiAyNi41LTM5Ljd6bTIzLjgtNDQuNy01Ni4yIDIuNSA1LjIgMjguOSA4LjMtMTcuNCAyMCA5LjF6bS0xMjAuMiAyMy4xIDIwLTkuMSA4LjIgMTcuNCA1LjMtMjguOS01Ni4zLTIuNXoiLz4KICA8cGF0aCBmaWxsPSIjZTQ3NTFmIiBzdHJva2U9IiNlNDc1MWYiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIgZD0ibTg3LjggMTYyLjEgMjMuNiA0Ni0uOC0yMi45em0xMjAuMyAyMy4xLTEgMjIuOSAyMy43LTQ2em0tNjQtMjAuNi01LjMgMjguOSA2LjYgMzQuMSAxLjUtNDQuOXptMzAuNSAwLTIuNyAxOCAxLjIgNDUgNi43LTM0LjF6Ii8+CiAgPHBhdGggZD0ibTE3OS44IDE5My41LTYuNyAzNC4xIDQuOCAzLjMgMjkuMi0yMi44IDEtMjIuOXptLTY5LjItOC4zLjggMjIuOSAyOS4yIDIyLjggNC44LTMuMy02LjYtMzQuMXoiIGNsYXNzPSJzdDYiLz4KICA8cGF0aCBmaWxsPSIjYzBhZDllIiBzdHJva2U9IiNjMGFkOWUiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIgZD0ibTE4MC4zIDI2Mi4zLjMtOS4zLTIuNS0yLjJoLTM3LjdsLTIuMyAyLjIuMiA5LjMtMzEuNS0xNC45IDExIDkgMjIuMyAxNS41aDM4LjNsMjIuNC0xNS41IDExLTl6Ii8+CiAgPHBhdGggZmlsbD0iIzE2MTYxNiIgc3Ryb2tlPSIjMTYxNjE2IiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiIGQ9Im0xNzcuOSAyMzAuOS00LjgtMy4zaC0yNy43bC00LjggMy4zLTIuNSAyMi4xIDIuMy0yLjJoMzcuN2wyLjUgMi4yeiIvPgogIDxwYXRoIGZpbGw9IiM3NjNkMTYiIHN0cm9rZT0iIzc2M2QxNiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIiBkPSJtMjc4LjMgMTE0LjIgOC41LTQwLjgtMTIuNy0zNy45LTk2LjIgNzEuNCAzNyAzMS4zIDUyLjMgMTUuMyAxMS42LTEzLjUtNS0zLjYgOC03LjMtNi4yLTQuOCA4LTYuMXpNMzEuOCA3My40bDguNSA0MC44LTUuNCA0IDggNi4xLTYuMSA0LjggOCA3LjMtNSAzLjYgMTEuNSAxMy41IDUyLjMtMTUuMyAzNy0zMS4zLTk2LjItNzEuNHoiLz4KICA8cGF0aCBkPSJtMjY3LjIgMTUzLjUtNTIuMy0xNS4zIDE1LjkgMjMuOS0yMy43IDQ2IDMxLjItLjRoNDYuNXptLTE2My42LTE1LjMtNTIuMyAxNS4zLTE3LjQgNTQuMmg0Ni40bDMxLjEuNC0yMy42LTQ2em03MSAyNi40IDMuMy01Ny43IDE1LjItNDEuMWgtNjcuNWwxNSA0MS4xIDMuNSA1Ny43IDEuMiAxOC4yLjEgNDQuOGgyNy43bC4yLTQ0Ljh6IiBjbGFzcz0ic3Q2Ii8+Cjwvc3ZnPg==";
export const XRPLSNAP_ICON = METAMASK_ICON;

export interface Eip1193Provider {
  request(args: unknown): Promise<unknown>;
}

export interface XrplSnapAdapterOptions {
  ethereum?: Eip1193Provider;
  snapId?: string;
  icon?: string;
  signMessageDestination?: string;
  signMessageMethods?: string[];
}

export class XrplSnapAdapter extends BaseWalletAdapter {
  metadata: WalletMetadata;
  capabilities: WalletCapabilities = { connect: true, signMessage: true, signAndSubmit: true, payments: true, nftOffers: true };
  private snapId: string;
  private activeAddress?: string;

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

  isAvailable(): boolean { return Boolean(this.ethereum(false)); }

  async connect(options: ConnectOptions) {
    const ethereum = this.ethereum();
    await ethereum.request({ method: "wallet_requestSnaps", params: { [this.snapId]: {} } });
    const snap = await ethereum.request({ method: "wallet_invokeSnap", params: { snapId: this.snapId, request: { method: "xrpl_getAccount" } } });
    const address = (snap as { account?: string }).account;
    if (!address) throw new Error("XRPL Snap did not return an XRPL address");
    this.activeAddress = address;
    return { account: { address, network: options.network, networkType: options.network?.networkType }, raw: snap };
  }

  async restoreSession(session: WalletSession) {
    if (!this.ethereum(false)) return null;
    this.activeAddress = session.account.address;
    return { account: session.account, session, raw: null };
  }

  async signMessage(request: SignMessageRequest) {
    const txJson = this.createSignMessagePaymentTx(request);
    const methods = this.options.signMessageMethods ?? ["xrpl_sign", "xrpl_signTransaction", "npm:xrpl-snap"];
    const errors: unknown[] = [];

    for (const method of methods) {
      try {
        const result = await this.invokeSnap(method, txJson);
        const signature = this.pickString(result, ["signature", "signedMessage", "tx_blob", "txBlob", "result.signature", "result.signedMessage", "result.tx_blob"]);
        return { signature, txBlob: signature, raw: result };
      } catch (error) {
        errors.push({ method, error: this.formatError(error) });
      }
    }

    throw new Error(`XRPL Snap signMessage failed: ${JSON.stringify(errors)}`);
  }

  getSignMessageRequestPreview(request: SignMessageRequest) {
    return {
      method: "wallet_invokeSnap",
      params: {
        snapId: this.snapId,
        request: {
          method: this.options.signMessageMethods?.[0] ?? "xrpl_sign",
          params: this.createSignMessagePaymentTx(request)
        }
      }
    };
  }

  async signAndSubmit(request: SignAndSubmitRequest) {
    const result = await this.invokeSnap("xrpl_signAndSubmit", request.txJson);
    return normalizeTxResult(result);
  }

  private invokeSnap(method: string, params: unknown) {
    return this.ethereum().request({
      method: "wallet_invokeSnap",
      params: { snapId: this.snapId, request: { method, params } }
    });
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
      Memos: [{ Memo: { MemoData: this.toHex(request.message) } }]
    };
  }

  private toHex(value: string): string {
    const encoder = new TextEncoder();
    return [...encoder.encode(value)].map((byte) => byte.toString(16).padStart(2, "0")).join("").toUpperCase();
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

  private ethereum(required?: true): Eip1193Provider;
  private ethereum(required: false): Eip1193Provider | undefined;
  private ethereum(required = true): Eip1193Provider | undefined {
    const ethereum = this.options.ethereum ?? (globalThis as unknown as { ethereum?: Eip1193Provider }).ethereum;
    if (!ethereum && required) throw new Error("No MetaMask provider installed");
    return ethereum;
  }
}

export function createXrplSnapAdapter(options?: XrplSnapAdapterOptions) { return new XrplSnapAdapter(options); }


