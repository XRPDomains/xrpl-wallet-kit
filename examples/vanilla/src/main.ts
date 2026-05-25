import { WalletManager, createBrowserWalletStorage } from "../../../packages/core/src";
import { Buffer } from "buffer";
import { createDefaultWalletButtonConfig, createDefaultWalletUiConfig } from "../../../packages/ui/src";
import type { TransactionPayload, WalletAdapter } from "../../../packages/core/src";
import type { WalletUiLayout, WalletUiThemeMode } from "../../../packages/ui/src";

import "./styles.css";

if (!("Buffer" in globalThis)) {
  (globalThis as typeof globalThis & { Buffer: typeof Buffer }).Buffer = Buffer;
}

const PREVIEW_CONFIG = {
  xamanClientId: import.meta.env.VITE_XAMAN_CLIENT_ID ?? "",
  walletConnectProjectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID ?? "",
  walletConnectSignMessageDestination: import.meta.env.VITE_WALLETCONNECT_SIGN_MESSAGE_DESTINATION ?? "raAyazbgEkwzLByXipQuPLWFfnsPS1v1q9",
  metadata: {
    name: import.meta.env.VITE_XRPL_WALLET_KIT_APP_NAME ?? "XRPL Wallet Kit Preview",
    description: import.meta.env.VITE_XRPL_WALLET_KIT_APP_DESCRIPTION ?? "XRPL wallet adapter integration preview",
    url: import.meta.env.VITE_XRPL_WALLET_KIT_APP_URL ?? "http://127.0.0.1:5173",
    icons: []
  }
};

const events = document.querySelector<HTMLPreElement>("#events")!;
const session = document.querySelector<HTMLPreElement>("#session")!;
const walletConnectMode = document.querySelector<HTMLSelectElement>("#walletconnect-mode")!;
const walletLayout = document.querySelector<HTMLSelectElement>("#wallet-layout")!;
const uiTheme = document.querySelector<HTMLSelectElement>("#ui-theme")!;
const networkSelect = document.querySelector<HTMLSelectElement>("#network")!;
const paymentDestinationInput = document.querySelector<HTMLInputElement>("#payment-destination")!;
const paymentAmountInput = document.querySelector<HTMLInputElement>("#payment-amount")!;
const paymentSubmitButton = document.querySelector<HTMLButtonElement>("#payment-submit-button")!;
const paymentResult = document.querySelector<HTMLPreElement>("#payment-result")!;
const nftTokenIdInput = document.querySelector<HTMLInputElement>("#nft-token-id")!;
const nftOfferType = document.querySelector<HTMLSelectElement>("#nft-offer-type")!;
const nftOfferAmountInput = document.querySelector<HTMLInputElement>("#nft-offer-amount")!;
const nftOwnerInput = document.querySelector<HTMLInputElement>("#nft-owner")!;
const nftDestinationInput = document.querySelector<HTMLInputElement>("#nft-destination")!;
const nftOfferSubmitButton = document.querySelector<HTMLButtonElement>("#nft-offer-submit-button")!;
const nftOfferResult = document.querySelector<HTMLPreElement>("#nft-offer-result")!;
const nftSellOfferInput = document.querySelector<HTMLInputElement>("#nft-sell-offer")!;
const nftBuyOfferInput = document.querySelector<HTMLInputElement>("#nft-buy-offer")!;
const nftBrokerFeeInput = document.querySelector<HTMLInputElement>("#nft-broker-fee")!;
const nftAcceptSubmitButton = document.querySelector<HTMLButtonElement>("#nft-accept-submit-button")!;
const nftAcceptResult = document.querySelector<HTMLPreElement>("#nft-accept-result")!;
const signMessageInput = document.querySelector<HTMLTextAreaElement>("#sign-message")!;
const signMessageButton = document.querySelector<HTMLButtonElement>("#sign-message-button")!;
const resetMessageButton = document.querySelector<HTMLButtonElement>("#reset-message-button")!;
const signResult = document.querySelector<HTMLPreElement>("#sign-result")!;

type WalletConnectMode = "default" | "list" | "group";
type SignMessagePreviewAdapter = WalletAdapter & {
  getSignMessageRequestPreview?: (request: { message: string; account?: { address: string } }) => unknown;
};

let manager: WalletManager;
let modal: { open(): void; updateOptions(options: Record<string, unknown>): void; destroy(): void } | undefined;
let walletButton: { updateOptions(options: Record<string, unknown>): void; destroy(): void } | undefined;
let bootstrapRun = 0;

[uiTheme, walletLayout].forEach((control) => {
  control.addEventListener("change", () => {
    modal?.updateOptions(getWalletUiOptions());
    walletButton?.updateOptions(getWalletButtonOptions());
    log("ui_config", getWalletUiOptions());
  });
});

walletConnectMode.addEventListener("change", () => {
  resetPreview().catch((error) => {
    log("bootstrap_error", { message: formatError(error) });
  });
});

[networkSelect].forEach((control) => control.addEventListener("change", () => {
  setDefaultSignMessage();
  resetPreview().catch((error) => {
    log("bootstrap_error", { message: formatError(error) });
  });
}));

paymentSubmitButton.addEventListener("click", () => {
  submitPayment().catch((error) => {
    const message = formatError(error);
    paymentResult.textContent = message;
    log("payment_error", { message });
  });
});

nftOfferSubmitButton.addEventListener("click", () => {
  submitNftOffer().catch((error) => {
    const message = formatError(error);
    nftOfferResult.textContent = message;
    log("nft_offer_error", { message });
  });
});

nftAcceptSubmitButton.addEventListener("click", () => {
  acceptNftOffer().catch((error) => {
    const message = formatError(error);
    nftAcceptResult.textContent = message;
    log("nft_accept_error", { message });
  });
});

signMessageButton.addEventListener("click", () => {
  signMessage().catch((error) => {
    const message = formatError(error);
    signResult.textContent = message;
    log("sign_message_error", { message });
  });
});

resetMessageButton.addEventListener("click", () => {
  setDefaultSignMessage();
});

setDefaultSignMessage();

async function resetPreview() {
  bootstrapRun += 1;
  modal?.destroy();
  walletButton?.destroy();
  modal = undefined;
  walletButton = undefined;
  document.querySelectorAll(".xwk-overlay").forEach((node) => node.remove());
  await bootstrap(bootstrapRun);
}

async function bootstrap(run = bootstrapRun) {
  const [
    { createCrossmarkAdapter },
    { createDropFiAdapter },
    { createGemWalletAdapter },
    { createWalletConnectAdapters, createWalletConnectMetadata },
    { createXamanAdapter },
    { createXrplSnapAdapter }
  ] = await Promise.all([
    import("../../../packages/adapters/crossmark/src"),
    import("../../../packages/adapters/dropfi/src"),
    import("../../../packages/adapters/gemwallet/src"),
    import("../../../packages/adapters/walletconnect/src"),
    import("../../../packages/adapters/xaman/src"),
    import("../../../packages/adapters/xrpl-snap/src")
  ]);

  const WALLETCONNECT_METADATA = createWalletConnectMetadata(PREVIEW_CONFIG.metadata);
  const mode = getWalletConnectMode();
  const walletConnectAdapterMode = mode === "default" ? "default" : "details";
  const adapters: WalletAdapter[] = [];

  if (PREVIEW_CONFIG.xamanClientId) {
    adapters.push(createXamanAdapter({
      apiKey: PREVIEW_CONFIG.xamanClientId,
      onQr: ({ adapterId, uri, deeplink }) => manager.emitQr(adapterId, uri, deeplink)
    }));
  } else {
    log("config_warning", { message: "VITE_XAMAN_CLIENT_ID is not set; Xaman preview adapter is disabled." });
  }

  adapters.push(createGemWalletAdapter());
  adapters.push(createCrossmarkAdapter());
  adapters.push(createDropFiAdapter());
  adapters.push(createXrplSnapAdapter({
    signMessageDestination: PREVIEW_CONFIG.walletConnectSignMessageDestination
  }));

  manager = new WalletManager({
    appName: PREVIEW_CONFIG.metadata.name,
    appDescription: PREVIEW_CONFIG.metadata.description,
    appUrl: PREVIEW_CONFIG.metadata.url,
    appIcons: PREVIEW_CONFIG.metadata.icons,
    network: getSelectedNetwork(),
    autoReconnect: true,
    storage: createBrowserWalletStorage("xwk.preview."),
    adapters
  });

  if (PREVIEW_CONFIG.walletConnectProjectId) {
    createWalletConnectAdapters({
      projectId: PREVIEW_CONFIG.walletConnectProjectId,
      metadata: WALLETCONNECT_METADATA,
      mode: walletConnectAdapterMode,
      wallets: "all",
      signMessageDestination: PREVIEW_CONFIG.walletConnectSignMessageDestination,
      onQr: ({ adapterId, uri, deeplink }) => manager.emitQr(adapterId, uri, deeplink)
    }).forEach((adapter) => manager.register(adapter));
  } else {
    log("config_warning", { message: "VITE_WALLETCONNECT_PROJECT_ID is not set; WalletConnect preview adapters are disabled." });
  }

  const { createWalletButton, createWalletModal } = await import("../../../packages/ui/src");
  if (run !== bootstrapRun) return;
  modal = createWalletModal({
    manager,
    ...getWalletUiOptions()
  });
  walletButton = createWalletButton({
    manager,
    modal,
    target: "#wallet-button",
    ...getWalletButtonOptions()
  });

  manager.on("connecting", (event) => log("connecting", event));
  manager.on("connected", (event) => {
    log("connected", event);
    renderSession();
    renderTransactionState();
    renderSigningState();
  });
  manager.on("disconnected", (event) => {
    log("disconnected", event);
    renderSession();
    renderTransactionState();
    renderSigningState();
  });
  manager.on("qr", (event) => log("qr", { adapterId: event.adapterId, uriLength: event.uri.length, deeplink: event.deeplink }));
  manager.on("signing", (event) => log("signing", event));
  manager.on("signed", (event) => log("signed", event));
  manager.on("error", (event) => log("error", { message: formatError(event.error) }));

  await manager.autoReconnect();
  renderSession();
  renderTransactionState();
  renderSigningState();
  log("ready", { walletConnectMode: mode, wallets: manager.getWallets().map((wallet) => wallet.id) });
}

bootstrap().catch((error) => {
  log("bootstrap_error", { message: formatError(error) });
});

function renderSession() {
  const current = manager.getSession();
  session.textContent = current ? JSON.stringify(current, null, 2) : "No wallet connected.";
}

function renderTransactionState() {
  const current = manager.getSession();
  const adapter = manager.getAdapter();
  const canSignAndSubmit = Boolean(current && adapter?.capabilities.signAndSubmit);
  paymentSubmitButton.disabled = !canSignAndSubmit;
  nftOfferSubmitButton.disabled = !canSignAndSubmit;
  nftAcceptSubmitButton.disabled = !canSignAndSubmit;

  if (!current) {
    paymentResult.textContent = "Connect a wallet to test Payment signAndSubmit.";
    nftOfferResult.textContent = "Connect a wallet to test NFT Offer signAndSubmit.";
    nftAcceptResult.textContent = "Connect a wallet to test NFT Offer accept.";
    return;
  }

  if (!adapter?.capabilities.signAndSubmit) {
    const message = `${current.wallet?.name ?? current.adapterId} does not support signAndSubmit.`;
    paymentResult.textContent = message;
    nftOfferResult.textContent = message;
    nftAcceptResult.textContent = message;
  }
}

function renderSigningState() {
  const current = manager.getSession();
  const adapter = manager.getAdapter();
  const canSignMessage = Boolean(current && adapter?.capabilities.signMessage);
  signMessageButton.disabled = !canSignMessage;
  if (!current) {
    signResult.textContent = "Connect a wallet to test message signing.";
    return;
  }
  if (!adapter?.capabilities.signMessage) {
    signResult.textContent = `${current.wallet?.name ?? current.adapterId} does not support signMessage.`;
  }
}

async function signMessage() {
  const current = manager.getSession();
  if (!current) throw new Error("Connect a wallet before signing a message.");
  const adapter = manager.getAdapter();
  if (!adapter?.capabilities.signMessage) throw new Error(`${current.wallet?.name ?? current.adapterId} does not support signMessage.`);
  const message = signMessageInput.value.trim();
  if (!message) throw new Error("Message is required.");
  const requestPreview = createSignMessageRequestPreview(adapter, current, message);
  signResult.textContent = JSON.stringify({
    status: "Requesting signature...",
    requestPreview
  }, null, 2);
  log("sign_message_request", requestPreview);
  const result = await manager.signMessage({ message });
  signResult.textContent = JSON.stringify({ requestPreview, result }, null, 2);
}

async function submitPayment() {
  const current = requireActiveSignAndSubmitWallet();
  const destination = paymentDestinationInput.value.trim();
  const amount = paymentAmountInput.value.trim();
  if (!destination) throw new Error("Destination address is required.");
  const drops = xrpToDrops(amount);
  const txJson: TransactionPayload = {
    TransactionType: "Payment",
    Account: current.account.address,
    Destination: destination,
    Amount: drops
  };
  const walletPayload = {
    amount: drops,
    destination
  };

  paymentResult.textContent = "Requesting Payment signature and submit...";
  const result = await manager.signAndSubmit({ txJson, walletPayload, methodHint: "payment", submit: true });
  paymentResult.textContent = JSON.stringify({ txJson, result }, null, 2);
}

async function submitNftOffer() {
  const current = requireActiveSignAndSubmitWallet();
  const tokenId = nftTokenIdInput.value.trim();
  const amount = nftOfferAmountInput.value.trim();
  const owner = nftOwnerInput.value.trim();
  const destination = nftDestinationInput.value.trim();
  const offerType = nftOfferType.value === "buy" ? "buy" : "sell";
  if (!tokenId) throw new Error("NFTokenID is required.");
  if (!/^\d+$/.test(amount)) throw new Error("NFT offer amount must be drops.");
  if (offerType === "buy" && !owner) throw new Error("Owner address is required for buy offers.");

  const txJson: TransactionPayload = {
    TransactionType: "NFTokenCreateOffer",
    Account: current.account.address,
    NFTokenID: tokenId,
    Amount: amount,
    ...(offerType === "sell" ? { Flags: 1 } : { Owner: owner }),
    ...(destination ? { Destination: destination } : {})
  };
  const walletPayload = {
    NFTokenID: tokenId,
    amount,
    ...(offerType === "sell" ? { flags: 1 } : { owner }),
    ...(destination ? { destination } : {})
  };

  nftOfferResult.textContent = "Requesting NFT Offer signature and submit...";
  const result = await manager.signAndSubmit({ txJson, walletPayload, methodHint: "createNFTOffer", submit: true });
  nftOfferResult.textContent = JSON.stringify({ txJson, result }, null, 2);
}

async function acceptNftOffer() {
  const current = requireActiveSignAndSubmitWallet();
  const sellOffer = nftSellOfferInput.value.trim();
  const buyOffer = nftBuyOfferInput.value.trim();
  const brokerFee = nftBrokerFeeInput.value.trim();
  if (!sellOffer && !buyOffer) throw new Error("Enter a sell offer ID or buy offer ID.");
  if (brokerFee && !/^\d+$/.test(brokerFee)) throw new Error("Broker fee must be drops.");

  const txJson: TransactionPayload = {
    TransactionType: "NFTokenAcceptOffer",
    Account: current.account.address,
    ...(sellOffer ? { NFTokenSellOffer: sellOffer } : {}),
    ...(buyOffer ? { NFTokenBuyOffer: buyOffer } : {}),
    ...(brokerFee ? { NFTokenBrokerFee: brokerFee } : {})
  };
  const walletPayload = {
    ...(sellOffer ? { NFTokenSellOffer: sellOffer } : {}),
    ...(buyOffer ? { NFTokenBuyOffer: buyOffer } : {}),
    ...(brokerFee ? { NFTokenBrokerFee: brokerFee } : {})
  };

  nftAcceptResult.textContent = "Requesting NFT Offer accept signature and submit...";
  const result = await manager.signAndSubmit({ txJson, walletPayload, methodHint: "acceptNFTOffer", submit: true });
  nftAcceptResult.textContent = JSON.stringify({ txJson, result }, null, 2);
}

function requireActiveSignAndSubmitWallet() {
  const current = manager.getSession();
  if (!current) throw new Error("Connect a wallet before submitting a transaction.");
  const adapter = manager.getAdapter();
  if (!adapter?.capabilities.signAndSubmit) throw new Error(`${current.wallet?.name ?? current.adapterId} does not support signAndSubmit.`);
  return current;
}

function xrpToDrops(value: string) {
  if (!/^\d+(\.\d{1,6})?$/.test(value)) throw new Error("Amount XRP must be like 0.01, 0.1, or 1. Max 6 decimal places.");
  const [whole, fraction = ""] = value.split(".");
  const drops = `${whole}${fraction.padEnd(6, "0")}`.replace(/^0+(?=\d)/, "");
  if (drops === "0") throw new Error("Amount XRP must be greater than 0.");
  return drops;
}

function getWalletUiOptions() {
  return createDefaultWalletUiConfig({
    mode: uiTheme.value as WalletUiThemeMode,
    modal: {
      title: "Connect Wallet",
      width: "default",
      footerText: "XRPL Wallet Kit"
    },
    walletList: {
      layout: getWalletLayout(),
      wallets: "all",
      showGroup: true,
      showInstalledBadge: true
    },
    walletConnect: {
      mode: getWalletConnectMode(),
      cta: "both",
      qr: {
        style: "dots",
        showLogo: false
      }
    }
  });
}

function getWalletButtonOptions() {
  return createDefaultWalletButtonConfig({
    themeMode: uiTheme.value as WalletUiThemeMode,
    accountPanelMode: "modal",
    showBalance: true
  });
}

function getWalletLayout(): WalletUiLayout {
  const value = walletLayout.value;
  if (value === "card" || value === "icon") return value;
  return "list";
}

function getWalletConnectMode(): WalletConnectMode {
  const value = walletConnectMode.value;
  if (value === "list" || value === "group") return value;
  return "default";
}

function getSelectedNetwork() {
  const value = networkSelect.value;
  if (value === "testnet" || value === "devnet") return value;
  return "mainnet";
}

function setDefaultSignMessage() {
  signMessageInput.value = `Login to XRPL Wallet Kit\nNetwork: ${getSelectedNetwork()}\nTimestamp: ${new Date().toISOString()}`;
}

function createSignMessageRequestPreview(adapter: WalletAdapter, current: NonNullable<ReturnType<WalletManager["getSession"]>>, message: string) {
  const request = { message, account: current.account };
  const previewAdapter = adapter as SignMessagePreviewAdapter;
  if (typeof previewAdapter.getSignMessageRequestPreview === "function") {
    return previewAdapter.getSignMessageRequestPreview(request);
  }

  return {
    adapterId: current.adapterId,
    wallet: current.wallet?.name ?? adapter.metadata.name,
    request
  };
}

function log(name: string, payload: unknown) {
  events.textContent = `${new Date().toLocaleTimeString()} ${name} ${JSON.stringify(payload)}\n${events.textContent}`;
}

function formatError(error: unknown) {
  if (error instanceof Error) {
    const details = Object.fromEntries(Object.entries(error).filter(([, value]) => value !== undefined));
    return JSON.stringify({
      name: error.name,
      message: error.message,
      ...details
    }, null, 2);
  }

  if (typeof error === "string") return error;

  try {
    return JSON.stringify(error, null, 2);
  } catch {
    return String(error);
  }
}
