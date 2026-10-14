import { WalletManager } from "../../packages/core/src/index";
import { createWalletButton, createWalletModal } from "../../packages/ui/src/index";
import { createApp, defineComponent, h } from "vue";
import { createWalletKitPlugin, useWalletKit, WalletButton } from "../../packages/vue/src/index";

const network = { id: "mainnet", name: "Mainnet", networkType: "MAINNET", rpcUrl: "wss://example.invalid" };
const manager = new WalletManager({ network: "mainnet", accountStatus: { enabled: false }, adapters: [{
  metadata: { id: "mock", name: "Mock wallet", type: "extension" },
  capabilities: { connect: true },
  isAvailable: async () => true,
  connect: async () => ({ account: { address: "rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh", network, activationStatus: "active" } })
}] });
const nonce = new URL(location.href).searchParams.get("nonce") ?? undefined;
const modal = createWalletModal({ manager, nonce });
const button = createWalletButton({ manager, modal, nonce, target: document.querySelector<HTMLElement>("#button")!,
  showWeb3Name: false, showBalance: false, accountPanelMode: "modal" });
const violations: string[] = [];
document.addEventListener("securitypolicyviolation", event => { violations.push(event.violatedDirective); });
Object.assign(window, { fixture: { manager, modal, button, violations,
  mountVue: () => {
    const vueManager = new WalletManager({ network: "mainnet", accountStatus: { enabled: false }, adapters: [] });
    const app = createApp(defineComponent({ setup() {
      const kit = useWalletKit();
      return () => h("div", [h(WalletButton, { options: { showWeb3Name: false, showBalance: false } }), h("output", kit.status.value)]);
    } })).use(createWalletKitPlugin({ manager: vueManager, ui: { nonce } }));
    app.mount("#vue");
    return { dispose: () => app.unmount(), manager: vueManager };
  },
  qr: () => {
    manager.emit("connecting", { adapterId: "mock" });
    manager.emit("qr", { adapterId: "mock", uri: "wc:offline-test@2?relay-protocol=irn&symKey=0123456789" });
  } } });
