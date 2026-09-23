"use client";

import React, { createContext, forwardRef, useCallback, useContext, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { WalletAccount, WalletCapabilities, WalletManager, WalletMetadata, WalletSession } from "@xrpl-wallet-kit/core";
import { createWalletButton, createWalletModal } from "@xrpl-wallet-kit/ui";
import type { WalletButtonController, WalletButtonOptions, WalletModal, WalletUiConfig } from "@xrpl-wallet-kit/ui";

export type WalletKitStatus = "disconnected" | "connecting" | "connected";
export type WalletAvailabilityState = Record<string, boolean | "unknown">;

export interface WalletKitContextValue {
  manager: WalletManager;
  account: WalletAccount | null;
  session: WalletSession | null;
  status: WalletKitStatus;
  wallets: WalletMetadata[];
  availability: WalletAvailabilityState;
  refreshAvailability: () => Promise<void>;
  connect: (adapterId: string) => Promise<WalletSession>;
  disconnect: () => Promise<void>;
  openModal: () => void;
  closeModal: () => void;
  modal: WalletModal | null;
}

export interface WalletKitProviderProps {
  manager: WalletManager;
  children: React.ReactNode;
  ui?: WalletUiConfig;
}

type ManagedWalletButtonProps = Partial<Omit<WalletButtonOptions, "manager" | "modal" | "target">>;
export type ReactWalletButtonProps = ManagedWalletButtonProps & Omit<React.HTMLAttributes<HTMLSpanElement>, keyof ManagedWalletButtonProps | "children">;

export interface WalletButtonHandle {
  element: HTMLSpanElement | null;
  controller: WalletButtonController | null;
}

const WalletKitContext = createContext<WalletKitContextValue | null>(null);
const useClientLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

export function WalletKitProvider(props: WalletKitProviderProps) {
  const [session, setSession] = useState<WalletSession | null>(props.manager.getSession());
  const [status, setStatus] = useState<WalletKitStatus>(props.manager.getSession() ? "connected" : "disconnected");
  const [modal, setModal] = useState<WalletModal | null>(null);
  const [availability, setAvailability] = useState<WalletAvailabilityState>(() => createUnknownAvailability(props.manager));
  const modalRef = useRef<WalletModal | null>(null);
  const availabilityRequestRef = useRef(0);

  const refreshAvailability = useCallback(async () => {
    const requestId = ++availabilityRequestRef.current;
    try {
      const nextAvailability = await props.manager.getWalletAvailability();
      if (requestId === availabilityRequestRef.current) setAvailability(nextAvailability);
    } catch {
      if (requestId === availabilityRequestRef.current) setAvailability(createUnknownAvailability(props.manager));
    }
  }, [props.manager]);

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
    setAvailability(createUnknownAvailability(props.manager));
    void refreshAvailability();
    return () => {
      availabilityRequestRef.current += 1;
    };
  }, [props.manager, refreshAvailability]);

  useEffect(() => {
    const syncSession = () => setSession(props.manager.getSession());
    const offConnecting = props.manager.on("connecting", () => setStatus("connecting"));
    const offConnected = props.manager.on("connected", (event) => {
      setSession(event.session ?? null);
      setStatus("connected");
      void refreshAvailability();
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
  }, [props.manager, refreshAvailability]);

  const value = useMemo<WalletKitContextValue>(() => {
    return {
      manager: props.manager,
      account: session?.account ?? null,
      session,
      status,
      wallets: props.manager.getWallets(),
      availability,
      refreshAvailability,
      connect: (adapterId) => props.manager.connect(adapterId),
      disconnect: () => props.manager.disconnect(),
      openModal: () => modal?.open(),
      closeModal: () => modal?.close(),
      modal
    };
  }, [props.manager, session, status, availability, refreshAvailability, modal]);

  return <WalletKitContext.Provider value={value}>{props.children}</WalletKitContext.Provider>;
}

function createUnknownAvailability(manager: WalletManager): WalletAvailabilityState {
  return Object.fromEntries(manager.getWallets().map((wallet) => [wallet.id, "unknown"]));
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

const HOST_PROP_NAMES = new Set([
  "id", "className", "style", "role", "title", "tabIndex", "hidden", "dir", "lang",
  "accessKey", "contentEditable", "draggable", "spellCheck", "translate"
]);

export const WalletButton = forwardRef<WalletButtonHandle, ReactWalletButtonProps>(function WalletButton(props, ref) {
  const { manager, modal } = useWalletKit();
  const targetRef = useRef<HTMLSpanElement | null>(null);
  const buttonRef = useRef<WalletButtonController | null>(null);
  const hostProps: React.HTMLAttributes<HTMLSpanElement> = {};
  const controllerProps: ManagedWalletButtonProps = {};

  for (const [key, value] of Object.entries(props)) {
    if (HOST_PROP_NAMES.has(key) || /^on[A-Z]/.test(key) || key.startsWith("aria-") || key.startsWith("data-")) {
      (hostProps as Record<string, unknown>)[key] = value;
    } else {
      (controllerProps as Record<string, unknown>)[key] = value;
    }
  }

  useImperativeHandle(ref, () => ({
    get element() { return targetRef.current; },
    get controller() { return buttonRef.current; }
  }), []);

  useEffect(() => {
    if (!targetRef.current || !modal) return;
    buttonRef.current = createWalletButton({
      manager,
      modal,
      target: targetRef.current,
      ...controllerProps
    });
    return () => {
      buttonRef.current?.destroy();
      buttonRef.current = null;
    };
  }, [manager, modal]);

  useEffect(() => {
    buttonRef.current?.updateOptions(controllerProps);
  }, [props]);

  return <span {...hostProps} ref={targetRef} />;
});

export type XrplWalletContextValue = WalletKitContextValue;
export type XrplWalletProviderProps = WalletKitProviderProps;
export const XrplWalletProvider = WalletKitProvider;
export const useXrplWallet = useWalletKit;
