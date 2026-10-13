import React from "react";
import { createRoot } from "react-dom/client";
import { createPortal } from "react-dom";
import type { WalletManager } from "../../../packages/core/src";
import { WalletButton, WalletKitProvider } from "../../../packages/react/src";
import type { ReactWalletButtonProps } from "../../../packages/react/src";
import type { WalletUiConfig } from "../../../packages/ui/src";
import { BatchPanel } from "../../shared/BatchPanel";

export function mountReactPreview(manager: WalletManager, ui: WalletUiConfig, button: ReactWalletButtonProps) {
  const root = createRoot(document.querySelector("#wallet-button")!);
  const batchTarget = document.querySelector("#batch-test")!;
  function updateOptions(nextUi: WalletUiConfig, nextButton: ReactWalletButtonProps) {
    root.render(
      <WalletKitProvider manager={manager} ui={nextUi}>
        <WalletButton {...nextButton} />
        {createPortal(<BatchPanel />, batchTarget)}
      </WalletKitProvider>
    );
  }
  updateOptions(ui, button);
  return { updateOptions, destroy: () => root.unmount() };
}
