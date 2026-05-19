import * as GemWalletApi from "@gemwallet/api";
import { BaseWalletAdapter, normalizeTxResult } from "@xrpl-wallet-kit/core";
import type { ConnectOptions, SignAndSubmitRequest, SignMessageRequest, WalletCapabilities, WalletMetadata } from "@xrpl-wallet-kit/core";

export const GEMWALLET_ICON = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGcgZmlsbD0ibm9uZSI+PHBhdGggZmlsbD0iIzAwQThFQSIgZD0iTTIwIDM5LjkxMS41OTMgMTcuNDIyaDM4LjgxNHoiLz48cGF0aCBmaWxsPSIjMzNEM0Y0IiBkPSJNMzMuMTg1IDUuMzMzSDYuODE1TC41OTMgMTcuNDIzaDM4LjgxNHoiLz48cGF0aCBmaWxsPSIjNDBFRUZGIiBkPSJtMjAgMzkuOTExLTcuMDM3LTIyLjQ4OWgxNC4wNzR6TTE0LjIyMiAxNC40IDguNjY3IDUuMzMzSDIwem0xMS4yNTkgMEwyMCA1LjMzM2gxMS4zMzN6Ii8+PHBhdGggZmlsbD0iI0ZGRiIgZD0iTTYuMjk2IDYuNDg5IDMuNDA3IDUuMzMzbDIuODktMS4xNTVMNy4yNTguNzFsLjk2MyAzLjQ2NyAyLjg5IDEuMTU1LTIuODkgMS4xNTYtLjk2MyAzLjQ2N3ptMjcuNDA4IDExLjI4OS0xLjg1Mi0uNzExIDEuODUyLS44LjY2Ni0yLjIyMy41OTMgMi4yMjMgMS44NTIuOC0xLjg1Mi43MUwzNC4zNyAyMHoiLz48cGF0aCBkPSJNMjEuODUyIDUuMzMzIDYuMjk2IDI0LjA5bC0xLjMzMy0xLjUxMSAxNC4zNy0xNy4yNDV6bTguNzQxIDBMMTAuNzQgMjkuMTU2IDcuNjMgMjUuNiAyNC40NDQgNS4zMzN6IiBvcGFjaXR5PSIuMiIgZmlsbD0iI0ZGRiIvPjwvZz48L3N2Zz4=";

export interface GemWalletProvider {
  isInstalled(): Promise<boolean | { result?: { isInstalled?: boolean } }>;
  getAddress(): Promise<{ result?: { address?: string } }>;
  getNetwork(): Promise<{ result?: { network?: string | { name?: string } } }>;
  signMessage(message: string): Promise<{ result?: { signedMessage?: string } }>;
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
    const result = await this.getProvider(false)?.isInstalled();
    return this.isInstalledResult(result);
  }
  async connect(options: ConnectOptions) {
    const provider = this.getProvider();
    if (!this.isInstalledResult(await provider.isInstalled())) throw new Error("Please install GemWallet Extension");
    const [address, network] = await Promise.all([provider.getAddress(), provider.getNetwork()]);
    return { account: { address: address.result?.address ?? "", network: options.network, networkType: this.networkName(network.result?.network) }, raw: { address, network } };
  }
  async signMessage(request: SignMessageRequest) {
    const result = await this.getProvider().signMessage(request.message);
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
  private isInstalledResult(result: Awaited<ReturnType<GemWalletProvider["isInstalled"]>> | undefined): boolean {
    return typeof result === "boolean" ? result : Boolean(result?.result?.isInstalled);
  }
  private networkName(network?: string | { name?: string }): string | undefined {
    return typeof network === "string" ? network : network?.name;
  }
}
export function createGemWalletAdapter(options?: { provider?: GemWalletProvider }) { return new GemWalletAdapter(options); }
