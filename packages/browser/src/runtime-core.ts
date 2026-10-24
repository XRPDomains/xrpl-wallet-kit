import type * as Core from "@xrpl-wallet-kit/core";

// Share error identity with the host IIFE rather than bundling a second core class.
const core = (globalThis as typeof globalThis & { XRPLWalletKit?: typeof Core }).XRPLWalletKit;
if (!core?.WalletKitError || !core.WalletKitErrorCode) throw new Error("Load XRPL Wallet Kit before its Xahau runtime.");
export const WalletKitError = core.WalletKitError;
export const WalletKitErrorCode = core.WalletKitErrorCode;
export const assertWalletRequestActive = core.assertWalletRequestActive;
