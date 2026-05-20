import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { WalletAccount, WalletManager, WalletMetadata, WalletSession } from "@xrpl-wallet-kit/core";
import { createWalletButton, createWalletModal } from "@xrpl-wallet-kit/ui";
import type { WalletButtonController, WalletButtonOptions, WalletModal, WalletUiOptions } from "@xrpl-wallet-kit/ui";

export interface WalletKitContextValue {
  manager: WalletManager;
  account: WalletAccount | null;
  session: WalletSession | null;
  wallets: WalletMetadata[];
  connect: (adapterId: string) => Promise<WalletSession>;
  disconnect: () => Promise<void>;
  openModal: () => void;
  closeModal: () => void;
  modal: WalletModal;
}

export interface WalletKitProviderProps {
  manager: WalletManager;
  children: React.ReactNode;
  ui?: Partial<Omit<WalletUiOptions, "manager" | "mount">>;
}

export type ReactWalletButtonProps = Partial<Omit<WalletButtonOptions, "manager" | "modal" | "target">>;

const WalletKitContext = createContext<WalletKitContextValue | null>(null);

export function WalletKitProvider(props: WalletKitProviderProps) {
  const [session, setSession] = useState<WalletSession | null>(props.manager.getSession());
  const modalRef = useRef<WalletModal | null>(null);

  if (!modalRef.current && typeof document !== "undefined") {
    modalRef.current = createWalletModal({ manager: props.manager, ...props.ui });
  }

  useEffect(() => {
    modalRef.current?.updateOptions(props.ui ?? {});
  }, [props.ui]);

  useEffect(() => {
    const offConnected = props.manager.on("connected", (event) => setSession(event.session ?? null));
    const offDisconnected = props.manager.on("disconnected", () => setSession(null));
    const offRestored = props.manager.on("session_restored", (event) => setSession(event.session));
    void props.manager.autoReconnect();
    return () => {
      offConnected();
      offDisconnected();
      offRestored();
      modalRef.current?.destroy();
      modalRef.current = null;
    };
  }, [props.manager]);

  const value = useMemo<WalletKitContextValue>(() => {
    const modal = modalRef.current;
    if (!modal) throw new Error("Wallet Kit React UI requires a browser document");
    return {
      manager: props.manager,
      account: session?.account ?? null,
      session,
      wallets: props.manager.getWallets(),
      connect: (adapterId) => props.manager.connect(adapterId),
      disconnect: () => props.manager.disconnect(),
      openModal: () => modal.open(),
      closeModal: () => modal.close(),
      modal
    };
  }, [props.manager, session]);

  return <WalletKitContext.Provider value={value}>{props.children}</WalletKitContext.Provider>;
}

export function useWalletKit(): WalletKitContextValue {
  const value = useContext(WalletKitContext);
  if (!value) throw new Error("useWalletKit must be used inside WalletKitProvider");
  return value;
}

export function WalletButton(props: ReactWalletButtonProps) {
  const { manager, modal } = useWalletKit();
  const targetRef = useRef<HTMLSpanElement | null>(null);
  const buttonRef = useRef<WalletButtonController | null>(null);

  useEffect(() => {
    if (!targetRef.current) return;
    buttonRef.current = createWalletButton({
      manager,
      modal,
      target: targetRef.current,
      ...props
    });
    return () => {
      buttonRef.current?.destroy();
      buttonRef.current = null;
    };
  }, [manager, modal]);

  useEffect(() => {
    buttonRef.current?.updateOptions(props);
  }, [props]);

  return <span ref={targetRef} />;
}

export type XrplWalletContextValue = WalletKitContextValue;
export type XrplWalletProviderProps = WalletKitProviderProps;
export const XrplWalletProvider = WalletKitProvider;
export const useXrplWallet = useWalletKit;
