import * as GemWalletApi from "@gemwallet/api";
import { BaseWalletAdapter, normalizeTxResult } from "@xrpl-wallet-kit/core";
import type { ConnectOptions, SignAndSubmitRequest, SignMessageRequest, WalletCapabilities, WalletMetadata, WalletSession } from "@xrpl-wallet-kit/core";

export const GEMWALLET_ICON = "data:image/png;base64,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";

export interface GemWalletProvider {
  isInstalled?: () => Promise<boolean | { result?: { isInstalled?: boolean } }>;
  getAddress?: () => Promise<{ result?: { address?: string } }>;
  getNetwork?: () => Promise<{ result?: { network?: string | { name?: string } } }>;
  signMessage?: (message: string) => Promise<{ result?: { signedMessage?: string } }>;
  sendPayment?(payload: unknown): Promise<unknown>;
  createNFTOffer?(payload: unknown): Promise<unknown>;
  acceptNFTOffer?(payload: unknown): Promise<unknown>;
  cancelNFTOffer?(payload: unknown): Promise<unknown>;
}

export class GemWalletAdapter extends BaseWalletAdapter {
  metadata: WalletMetadata = { id: "gemwallet", name: "GemWallet", type: "extension", group: "Extensions", icon: GEMWALLET_ICON };
  capabilities: WalletCapabilities = { connect: true, signMessage: true, signAndSubmit: true, nftOffers: true, payments: true };
  constructor(private options: { provider?: GemWalletProvider } = {}) { super(); }
  async isAvailable(): Promise<boolean> {
    const provider = this.getProvider(false);
    if (!provider?.isInstalled) return false;
    const result = await provider.isInstalled();
    return this.isInstalledResult(result);
  }
  async connect(options: ConnectOptions) {
    const provider = this.getProvider();
    if (!provider.isInstalled || !this.isInstalledResult(await provider.isInstalled())) throw new Error("Please install GemWallet Extension");
    if (!provider.getAddress) throw new Error("GemWallet provider is missing getAddress()");
    const [address, network] = await Promise.all([provider.getAddress(), provider.getNetwork?.()]);
    const accountAddress = address.result?.address;
    if (!accountAddress) throw new Error("GemWallet did not return an XRPL address");
    return { account: { address: accountAddress, network: options.network, networkType: this.networkName(network?.result?.network) }, raw: { address, network } };
  }
  async restoreSession(session: WalletSession) {
    if (!await this.isAvailable()) return null;
    const provider = this.getProvider();
    const address = await provider.getAddress?.();
    const accountAddress = address?.result?.address ?? session.account.address;
    return {
      account: { ...session.account, address: accountAddress },
      session: { ...session, account: { ...session.account, address: accountAddress } },
      raw: address
    };
  }

  async signMessage(request: SignMessageRequest) {
    const provider = this.getProvider();
    if (!provider.signMessage) throw new Error("GemWallet provider is missing signMessage()");
    const result = await provider.signMessage(request.message);
    return { signature: result.result?.signedMessage, raw: result };
  }
  async signAndSubmit(request: SignAndSubmitRequest) {
    const provider = this.getProvider();
    const payload = request.walletPayload ?? request.txJson;
    const raw =
      request.methodHint === "payment" && provider.sendPayment ? await provider.sendPayment(payload) :
      request.methodHint === "createNFTOffer" && provider.createNFTOffer ? await provider.createNFTOffer(payload) :
      request.methodHint === "acceptNFTOffer" && provider.acceptNFTOffer ? await provider.acceptNFTOffer(payload) :
      request.methodHint === "cancelNFTOffer" && provider.cancelNFTOffer ? await provider.cancelNFTOffer(payload) :
      this.unsupported(`GemWallet method: ${request.methodHint ?? "generic"}`);
    return normalizeTxResult(raw);
  }
  private getProvider(required = true): GemWalletProvider {
    const provider = this.options.provider ?? GemWalletApi as unknown as GemWalletProvider;
    if (!provider && required) throw new Error("GemWallet provider is not available");
    return provider as GemWalletProvider;
  }
  private isInstalledResult(result: boolean | { result?: { isInstalled?: boolean } } | undefined): boolean {
    return typeof result === "boolean" ? result : Boolean(result?.result?.isInstalled);
  }
  private networkName(network?: string | { name?: string }): string | undefined {
    return typeof network === "string" ? network : network?.name;
  }
}
export function createGemWalletAdapter(options?: { provider?: GemWalletProvider }) { return new GemWalletAdapter(options); }
