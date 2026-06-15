export type WalletUiLocale =
  | "en-US"
  | "vi-VN"
  | "ja-JP"
  | "ko-KR"
  | "zh-CN"
  | "zh-TW"
  | "en"
  | "vi"
  | "ja"
  | "ko"
  | "zh"
  | (string & {});

export interface WalletUiMessages {
  connectWallet: string;
  connect: string;
  connected: string;
  connectedAccount: string;
  close: string;
  back: string;
  approveRequest: string;
  walletFallbackName: string;
  connecting: string;
  retrying: string;
  tryAgain: string;
  connectionCanceledTitle: string;
  requestRejected: string;
  connectionTimedOutTitle: string;
  requestTimedOut: string;
  connectionFailedTitle: string;
  helpScan: string;
  helpTryAgainNewRequest: string;
  pleaseTryAgain: string;
  waitingForWalletConnectUri: string;
  qrSrHint: string;
  generatingQr: string;
  copied: string;
  copyUri: string;
  openWallet: string;
  qrUriCopied: string;
  installed: string;
  copyAddress: string;
  addressQr: string;
  showAddressQr: string;
  copying: string;
  viewExplorer: string;
  disconnect: string;
  disconnecting: string;
  notActivated: string;
  connectWalletAria: (walletName: string) => string;
  confirmOnDevice: (walletName: string) => string;
  openWalletAppApprove: (walletName: string) => string;
  approveBrowserWallet: () => string;
  clickConnectPopup: (walletName: string) => string;
  walletCount: (count: number) => string;
  moreWallets: (count: number) => string;
  accountNotActivated: (asset: string) => string;
}

export type WalletUiMessagesInput = Partial<WalletUiMessages>;
