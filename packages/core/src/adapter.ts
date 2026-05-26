import type { WalletAdapter, WalletAdapterType, WalletMetadata } from "./types";
import { createWalletError } from "./errors";

export const WALLET_ADAPTER_API_VERSION = "1.0";

export type AdapterValidationSeverity = "error" | "warning";

export interface AdapterValidationIssue {
  severity: AdapterValidationSeverity;
  field: string;
  message: string;
}

export interface AdapterValidationResult {
  valid: boolean;
  issues: AdapterValidationIssue[];
}

const adapterTypes: WalletAdapterType[] = ["mobile", "extension", "walletconnect", "snap", "hardware", "embedded"];

function isFunction(value: unknown): value is (...args: unknown[]) => unknown {
  return typeof value === "function";
}

function addIssue(
  issues: AdapterValidationIssue[],
  severity: AdapterValidationSeverity,
  field: string,
  message: string
) {
  issues.push({ severity, field, message });
}

export function validateWalletAdapter(adapter: unknown): AdapterValidationResult {
  const issues: AdapterValidationIssue[] = [];

  if (!adapter || typeof adapter !== "object") {
    return {
      valid: false,
      issues: [{ severity: "error", field: "adapter", message: "Adapter must be an object." }]
    };
  }

  const walletAdapter = adapter as Partial<WalletAdapter>;
  const adapterId = walletAdapter.metadata?.id || "unknown";

  if (walletAdapter.adapterApiVersion && !walletAdapter.adapterApiVersion.startsWith("1.")) {
    addIssue(
      issues,
      "warning",
      "adapterApiVersion",
      `Adapter ${adapterId} declares API ${walletAdapter.adapterApiVersion}; this core expects ${WALLET_ADAPTER_API_VERSION}.`
    );
  }

  if (!walletAdapter.metadata || typeof walletAdapter.metadata !== "object") {
    addIssue(issues, "error", "metadata", "metadata is required.");
  } else {
    if (!walletAdapter.metadata.id || !/^[a-z0-9][a-z0-9-]*$/.test(walletAdapter.metadata.id)) {
      addIssue(issues, "error", "metadata.id", "metadata.id must be a stable lowercase id using letters, numbers, or hyphens.");
    }
    if (!walletAdapter.metadata.name) {
      addIssue(issues, "error", "metadata.name", "metadata.name is required.");
    }
    if (!walletAdapter.metadata.type || !adapterTypes.includes(walletAdapter.metadata.type)) {
      addIssue(issues, "error", "metadata.type", `metadata.type must be one of: ${adapterTypes.join(", ")}.`);
    }
    if (!walletAdapter.metadata.icon) {
      addIssue(issues, "warning", "metadata.icon", "metadata.icon is recommended so UI packages can render the wallet consistently.");
    }
  }

  if (!walletAdapter.capabilities || typeof walletAdapter.capabilities !== "object") {
    addIssue(issues, "error", "capabilities", "capabilities is required.");
  } else {
    if (walletAdapter.capabilities.connect !== true) {
      addIssue(issues, "error", "capabilities.connect", "capabilities.connect must be true for a registered adapter.");
    }
    if (walletAdapter.capabilities.disconnect && !isFunction(walletAdapter.disconnect)) {
      addIssue(issues, "error", "disconnect", "capabilities.disconnect is true but disconnect() is not implemented.");
    }
    if (walletAdapter.capabilities.signMessage && !isFunction(walletAdapter.signMessage)) {
      addIssue(issues, "error", "signMessage", "capabilities.signMessage is true but signMessage() is not implemented.");
    }
    if (walletAdapter.capabilities.signAndSubmit && !isFunction(walletAdapter.signAndSubmit)) {
      addIssue(issues, "error", "signAndSubmit", "capabilities.signAndSubmit is true but signAndSubmit() is not implemented.");
    }
  }

  if (!isFunction(walletAdapter.connect)) {
    addIssue(issues, "error", "connect", "connect(options) is required.");
  }
  if (walletAdapter.isAvailable && !isFunction(walletAdapter.isAvailable)) {
    addIssue(issues, "error", "isAvailable", "isAvailable must be a function when provided.");
  }
  if (walletAdapter.recoverSession && !isFunction(walletAdapter.canRecoverSession)) {
    addIssue(issues, "error", "canRecoverSession", "recoverSession() requires canRecoverSession() so recovery can be gated safely.");
  }
  if (walletAdapter.cancelPendingConnection && !isFunction(walletAdapter.cancelPendingConnection)) {
    addIssue(issues, "error", "cancelPendingConnection", "cancelPendingConnection must be a function when provided.");
  }
  if (walletAdapter.restoreSession && !isFunction(walletAdapter.restoreSession)) {
    addIssue(issues, "error", "restoreSession", "restoreSession must be a function when provided.");
  }

  return {
    valid: !issues.some((issue) => issue.severity === "error"),
    issues
  };
}

export function assertWalletAdapter(adapter: unknown): void {
  const result = validateWalletAdapter(adapter);
  if (!result.valid) {
    const walletAdapter = adapter && typeof adapter === "object" ? adapter as Partial<WalletAdapter> : undefined;
    throw createWalletError.invalidAdapter(
      walletAdapter?.metadata?.id || "unknown",
      result.issues.map((issue) => `${issue.field}: ${issue.message}`)
    );
  }
}

export abstract class BaseWalletAdapter implements WalletAdapter {
  adapterApiVersion = WALLET_ADAPTER_API_VERSION;
  abstract metadata: WalletMetadata;
  abstract capabilities: WalletAdapter["capabilities"];
  abstract connect(...args: Parameters<WalletAdapter["connect"]>): ReturnType<WalletAdapter["connect"]>;
  private cleanupHandlers: Array<() => void | Promise<void>> = [];

  async disconnect(): Promise<void> {
    await this.runCleanup();
  }

  protected unsupported(method: string): never {
    throw createWalletError.unsupportedMethod(method, this.metadata.name);
  }

  protected addCleanup(handler: () => void | Promise<void>): () => void {
    this.cleanupHandlers.push(handler);
    return () => {
      this.cleanupHandlers = this.cleanupHandlers.filter((item) => item !== handler);
    };
  }

  protected async runCleanup(): Promise<void> {
    const handlers = [...this.cleanupHandlers].reverse();
    this.cleanupHandlers = [];
    for (const handler of handlers) {
      await handler();
    }
  }
}
