import React, { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { WalletAccount, WalletCapabilities, WalletManager, WalletMetadata, WalletSession } from "@xrpl-wallet-kit/core";
import { createWalletButton, createWalletModal } from "@xrpl-wallet-kit/ui";
import type { WalletButtonController, WalletButtonOptions, WalletModal, WalletUiConfig } from "@xrpl-wallet-kit/ui";

export type WalletKitStatus = "disconnected" | "connecting" | "connected";

export interface WalletKitContextValue {
  manager: WalletManager;
  account: WalletAccount | null;
  session: WalletSession | null;
  status: WalletKitStatus;
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
  ui?: WalletUiConfig;
}

export type ReactWalletButtonProps = Partial<Omit<WalletButtonOptions, "manager" | "modal" | "target">>;

const WalletKitContext = createContext<WalletKitContextValue | null>(null);
const useClientLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

export function WalletKitProvider(props: WalletKitProviderProps) {
  const [session, setSession] = useState<WalletSession | null>(props.manager.getSession());
  const [status, setStatus] = useState<WalletKitStatus>(props.manager.getSession() ? "connected" : "disconnected");
  const [modal, setModal] = useState<WalletModal | null>(null);
  const modalRef = useRef<WalletModal | null>(null);

  useClientLayoutEffect(() => {
    if (typeof document === "undefined") return;
    const nextModal = createWalletModal({ manager: props.manager, ...props.ui });
    modalRef.current = nextModal;
    setModal(nextModal);
    return () => {
      nextModal.destroy();
      if (modalRef.current === nextModal) modalRef.current = null;
      setModal(null);
    };
  }, [props.manager]);

  useEffect(() => {
    modalRef.current?.updateOptions(props.ui ?? {});
  }, [props.ui]);

  useEffect(() => {
    const syncSession = () => setSession(props.manager.getSession());
    const offConnecting = props.manager.on("connecting", () => setStatus("connecting"));
    const offConnected = props.manager.on("connected", (event) => {
      setSession(event.session ?? null);
      setStatus("connected");
    });
    const offDisconnected = props.manager.on("disconnected", () => {
      setSession(null);
      setStatus("disconnected");
    });
    const offRestored = props.manager.on("session_restored", (event) => {
      setSession(event.session);
      setStatus("connected");
    });
    const offAccountChanged = props.manager.on("accountChanged", syncSession);
    const offNetworkChanged = props.manager.on("networkChanged", syncSession);
    const offStale = props.manager.on("session_stale", () => {
      if (!props.manager.getSession()) setStatus("disconnected");
      syncSession();
    });
    const offExpired = props.manager.on("session_expired", () => {
      setSession(null);
      setStatus("disconnected");
    });
    const offError = props.manager.on("error", () => {
      if (!props.manager.getSession()) setStatus("disconnected");
    });
    void props.manager.autoReconnect();
    return () => {
      offConnecting();
      offConnected();
      offDisconnected();
      offRestored();
      offAccountChanged();
      offNetworkChanged();
      offStale();
      offExpired();
      offError();
    };
  }, [props.manager]);

  const value = useMemo<WalletKitContextValue | null>(() => {
    if (!modal) return null;
    return {
      manager: props.manager,
      account: session?.account ?? null,
      session,
      status,
      wallets: props.manager.getWallets(),
      connect: (adapterId) => props.manager.connect(adapterId),
      disconnect: () => props.manager.disconnect(),
      openModal: () => modal.open(),
      closeModal: () => modal.close(),
      modal
    };
  }, [props.manager, session, status, modal]);

  if (!value) return null;

  return <WalletKitContext.Provider value={value}>{props.children}</WalletKitContext.Provider>;
}

export function useWalletKit(): WalletKitContextValue {
  const value = useContext(WalletKitContext);
  if (!value) throw new Error("useWalletKit must be used inside WalletKitProvider");
  return value;
}

export function useWalletSession(): WalletSession | null {
  return useWalletKit().session;
}

export function useWalletAccount(): WalletAccount | null {
  return useWalletKit().account;
}

export function useWalletStatus(): WalletKitStatus {
  return useWalletKit().status;
}

export function useWalletCapabilities(): WalletCapabilities | undefined {
  const { manager, session } = useWalletKit();
  return session ? manager.getCapabilities(session.adapterId) : undefined;
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
