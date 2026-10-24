import { computed, defineComponent, h, inject, onBeforeUnmount, onMounted, readonly, shallowReadonly, shallowRef, watch } from "vue";
import type { App, InjectionKey, Plugin, PropType } from "vue";
import type { WalletAccount, WalletManager, WalletSession } from "@xrpl-wallet-kit/core";
import { createWalletButton, createWalletModal, resolveWalletButtonOptions } from "@xrpl-wallet-kit/ui";
import type { WalletButtonController, WalletButtonOptions, WalletModal, WalletUiConfig } from "@xrpl-wallet-kit/ui";

export interface WalletKitVueOptions {
  manager: WalletManager;
  ui?: WalletUiConfig;
  /** Explicit opt-in; restoration never occurs during server rendering. */
  autoReconnect?: boolean;
}

function createState(options: WalletKitVueOptions) {
  const session = shallowRef<WalletSession | null>(null);
  const status = shallowRef<"disconnected" | "connecting" | "connected">("disconnected");
  const wallets = shallowRef(options.manager.getWallets());
  const availability = shallowRef<Record<string, boolean | "unknown">>({});
  const modal = shallowRef<WalletModal | null>(null);
  let started = false;
  let disposed = false;
  let refreshVersion = 0;
  const off: (() => void)[] = [];
  const sync = () => {
    session.value = options.manager.getSession();
    status.value = session.value ? "connected" : "disconnected";
  };
  const refreshAvailability = async () => {
    if (!started || disposed) return;
    const version = ++refreshVersion;
    try {
      const value = await options.manager.getWalletAvailability({ refresh: true });
      if (!disposed && version === refreshVersion) availability.value = value;
    } catch {
      if (!disposed && version === refreshVersion) availability.value = {};
    }
  };
  const start = () => {
    if (started || disposed || typeof document === "undefined") return;
    started = true;
    sync();
    modal.value = createWalletModal({ manager: options.manager, ...options.ui });
    off.push(options.manager.on("connecting", () => { status.value = "connecting"; }));
    for (const event of ["connected", "disconnected", "session_restored", "session_stale", "session_expired", "accountChanged", "networkChanged", "error"] as const) {
      off.push(options.manager.on(event, sync));
    }
    off.push(options.manager.on("walletsChanged", () => {
      wallets.value = options.manager.getWallets();
      availability.value = Object.fromEntries(wallets.value.map(wallet => [wallet.id, "unknown"]));
      void refreshAvailability();
    }));
    availability.value = Object.fromEntries(wallets.value.map(wallet => [wallet.id, "unknown"]));
    void refreshAvailability();
    if (options.autoReconnect) void options.manager.autoReconnect().catch(sync);
  };
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    refreshVersion++;
    off.splice(0).forEach(stop => stop());
    modal.value?.destroy();
    modal.value = null;
    session.value = null;
    status.value = "disconnected";
    // The caller owns the manager; unmount must not revoke wallet authorization.
  };
  const manager = options.manager;
  return {
    buttonOptions: (overrides: Partial<Omit<WalletButtonOptions, "manager" | "modal" | "target">>) => resolveWalletButtonOptions(options.ui, overrides),
    manager, session: readonly(session), status: readonly(status), wallets: readonly(wallets),
    availability: readonly(availability), modal: shallowReadonly(modal),
    account: computed<WalletAccount | null>(() => session.value?.account ?? null),
    start, dispose, refreshAvailability,
    connect: (id: string) => manager.connect(id), disconnect: () => manager.disconnect(),
    signTransaction: manager.signTransaction.bind(manager), signAndSubmit: manager.signAndSubmit.bind(manager),
    signMessage: manager.signMessage.bind(manager),
    signIn: manager.signIn.bind(manager),
    openModal: () => { start(); modal.value?.open(); },
    openAndWait: (): Promise<WalletSession> => {
      start();
      if (!modal.value) return Promise.reject(new Error("Wallet modal is available only in the browser."));
      return modal.value.openAndWait();
    },
    closeModal: () => modal.value?.close()
  };
}

export type WalletKitVue = ReturnType<typeof createState>;
export const WalletKitKey: InjectionKey<WalletKitVue> = Symbol("XRPLWalletKit");

export function createWalletKitPlugin(options: WalletKitVueOptions): Plugin {
  return { install(app: App) {
    const state = createState(options);
    app.provide(WalletKitKey, state);
    const unmount = app.unmount.bind(app);
    app.unmount = () => { state.dispose(); unmount(); };
  } };
}

export function useWalletKit(): WalletKitVue {
  const state = inject(WalletKitKey);
  if (!state) throw new Error("Install createWalletKitPlugin before using useWalletKit.");
  onMounted(state.start);
  return state;
}

export function useWalletModal() {
  const kit = useWalletKit();
  return { modal: kit.modal, open: kit.openModal, openAndWait: kit.openAndWait, close: kit.closeModal };
}

export const WalletButton = defineComponent({
  name: "WalletKitButton",
  inheritAttrs: false,
  props: { options: { type: Object as PropType<Partial<Omit<WalletButtonOptions, "manager" | "modal" | "target">>>, default: () => ({}) } },
  setup(props, { attrs, expose }) {
    const kit = useWalletKit();
    const element = shallowRef<HTMLElement | null>(null);
    let controller: WalletButtonController | undefined;
    onMounted(() => {
      if (!element.value || !kit.modal.value) return;
      controller = createWalletButton({ ...kit.buttonOptions(props.options), manager: kit.manager, modal: kit.modal.value as WalletModal, target: element.value });
    });
    watch(() => props.options, options => controller?.updateOptions(kit.buttonOptions(options)), { deep: true });
    onBeforeUnmount(() => controller?.destroy());
    expose({ element, get controller() { return controller; } });
    return () => h("span", { ...attrs, ref: element });
  }
});
