import assert from "node:assert/strict";
import test from "node:test";
import { WalletManager } from "../packages/core/src/index";
import type { WalletAdapter, WalletMetadata, WalletNetwork } from "../packages/core/src/types";
import { WalletModal } from "../packages/ui/src/modal";

test("modal filters by active network, respects wallet order and refreshes on network change", async () => {
  const mainnet: WalletNetwork = { id: "mainnet", name: "XRPL", family: "xrpl", networkType: "MAINNET", rpcUrl: "wss://example.invalid" };
  const xahau: WalletNetwork = { ...mainnet, id: "xahau-mainnet", family: "xahau", networkId: 21337 };
  const legacy: WalletAdapter = { metadata: { id: "legacy", name: "Legacy", type: "extension" }, capabilities: { connect: true },
    connect: async options => ({ account: { address: "rFixture", network: options.network } }) };
  const multi: WalletAdapter = { ...legacy, metadata: { ...legacy.metadata, id: "multi" },
    capabilities: { connect: true, details: { supportedChains: { families: ["xrpl", "xahau"] } } } };
  const kit = new WalletManager({ adapters: [legacy, multi], networks: [mainnet, xahau], accountStatus: { enabled: false } });
  await kit.connect("multi");
  // Exercise list selection and the event subscription without constructing a browser DOM.
  const modal = new WalletModal({ manager: kit, wallets: ["legacy", "multi"] }) as unknown as {
    getWallets(): WalletMetadata[];
    root: { dataset: { xwkView: string }; querySelector(selector: string): null };
    renderView(view: string): void;
  };
  assert.deepEqual(modal.getWallets().map(wallet => wallet.id), ["legacy", "multi"]);
  modal.root = { dataset: { xwkView: "list" }, querySelector: () => null };
  const rendered: string[][] = [];
  modal.renderView = () => { rendered.push(modal.getWallets().map(wallet => wallet.id)); };
  kit.emitNetworkChanged("multi", xahau);
  assert.deepEqual(rendered, [["multi"]]);
  kit.emitNetworkChanged("multi", mainnet);
  assert.deepEqual(rendered, [["multi"], ["legacy", "multi"]]);
  kit.destroy();
});
