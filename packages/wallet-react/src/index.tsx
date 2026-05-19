import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { WalletAccount, WalletManager, WalletMetadata, WalletSession } from "@xrpname/wallet-core";

export interface XrplWalletContextValue {
  manager: WalletManager;
  account: WalletAccount | null;
  session: WalletSession | null;
  wallets: WalletMetadata[];
  connect: (adapterId: string) => Promise<WalletSession>;
  disconnect: () => Promise<void>;
}

const XrplWalletContext = createContext<XrplWalletContextValue | null>(null);

export function XrplWalletProvider(props: { manager: WalletManager; children: React.ReactNode }) {
  const [session, setSession] = useState<WalletSession | null>(props.manager.getSession());
  useEffect(() => {
    const offConnected = props.manager.on("connected", (event) => setSession(event.session ?? null));
    const offDisconnected = props.manager.on("disconnected", () => setSession(null));
    void props.manager.autoReconnect();
    return () => { offConnected(); offDisconnected(); };
  }, [props.manager]);
  const value = useMemo<XrplWalletContextValue>(() => ({
    manager: props.manager,
    account: session?.account ?? null,
    session,
    wallets: props.manager.getWallets(),
    connect: (adapterId) => props.manager.connect(adapterId),
    disconnect: () => props.manager.disconnect()
  }), [props.manager, session]);
  return <XrplWalletContext.Provider value={value}>{props.children}</XrplWalletContext.Provider>;
}
export function useXrplWallet(): XrplWalletContextValue {
  const value = useContext(XrplWalletContext);
  if (!value) throw new Error("useXrplWallet must be used inside XrplWalletProvider");
  return value;
}
