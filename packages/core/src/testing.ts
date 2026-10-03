import { validateWalletAdapter } from "./adapter";
import { normalizeWalletError, WalletKitErrorCategory } from "./errors";
import { normalizeSignTransactionResult, normalizeTxResult } from "./result";
import type { ConnectOptions, ConnectResult, SignMessageRequest, SignTransactionRequest, WalletAdapter, WalletSession } from "./types";

export type AdapterConformanceCase = "shape" | "availability" | "connect" | "disconnect" | "restore"
  | "sign-message" | "sign-only" | "sign-and-submit" | "rejection" | "timeout" | "cleanup" | "events";

/** Each factory call must create isolated provider state, never a live wallet. */
export interface AdapterConformanceFixture {
  adapter: WalletAdapter;
  connectOptions: ConnectOptions;
  expectedAddress: string;
  transaction: SignTransactionRequest;
  message: SignMessageRequest;
  /** Hardware adapters may deliberately refuse passive restore. */
  restoreExpected?: "connected" | "unavailable";
  /** Inspect provider-owned listeners/timers/transports after disconnect. */
  remainingResources?: () => number | Promise<number>;
  /** Exercise the provider event bridge and assert observed account/network updates. */
  exerciseEvents?: () => void | Promise<void>;
  /** Always releases fixture-owned resources, including on a failed case. */
  dispose?: () => void | Promise<void>;
}

export interface AdapterConformanceOptions {
  createFixture: (scenario: AdapterConformanceCase) => AdapterConformanceFixture | Promise<AdapterConformanceFixture>;
  /** Watchdog only; not a substitute for testing provider timeout behavior. */
  caseTimeoutMs?: number;
}

export interface AdapterConformanceResult {
  scenario: AdapterConformanceCase;
  status: "passed" | "failed" | "skipped";
  message?: string;
}

export interface AdapterConformanceReport {
  passed: boolean;
  results: AdapterConformanceResult[];
}

const scenarios: AdapterConformanceCase[] = ["shape", "availability", "connect", "disconnect", "restore",
  "sign-message", "sign-only", "sign-and-submit", "rejection", "timeout", "cleanup", "events"];

function requireContract(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function bounded<T>(operation: () => Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([Promise.resolve().then(operation), new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("Conformance watchdog expired; operation did not settle.")), timeoutMs);
    })]);
  } finally { if (timer !== undefined) clearTimeout(timer); }
}

function validateConnection(result: ConnectResult, fixture: AdapterConformanceFixture): void {
  requireContract(result?.account?.address === fixture.expectedAddress, "connect.account.address must match the provider account.");
  if (fixture.connectOptions.network) requireContract(result.account.network?.id === fixture.connectOptions.network.id,
    "connect.account.network must preserve the selected network.");
  if (result.session) {
    requireContract(result.session.adapterId === fixture.adapter.metadata.id, "session.adapterId must match adapter metadata.");
    requireContract(result.session.account.address === result.account.address, "session and connect account must agree.");
    requireContract(Number.isFinite(result.session.connectedAt), "session.connectedAt must be a finite timestamp.");
  }
}

async function runCase(scenario: AdapterConformanceCase, fixture: AdapterConformanceFixture): Promise<string | undefined> {
  const { adapter } = fixture;
  if (scenario === "shape") {
    const validation = validateWalletAdapter(adapter);
    requireContract(validation.valid, validation.issues.filter(issue => issue.severity === "error").map(issue => `${issue.field}: ${issue.message}`).join("; "));
    return;
  }
  if (scenario === "availability") {
    if (!adapter.isAvailable) return "isAvailable is optional and not implemented.";
    requireContract(typeof await adapter.isAvailable() === "boolean", "isAvailable must return a boolean.");
    return;
  }
  if (scenario === "rejection" || scenario === "timeout") {
    let failure: unknown;
    try { await adapter.connect(fixture.connectOptions); } catch (error) { failure = error; }
    requireContract(failure !== undefined, `connect must reject the provider's ${scenario} outcome.`);
    const category = normalizeWalletError(failure).category;
    requireContract(category === (scenario === "timeout" ? WalletKitErrorCategory.TIMEOUT : WalletKitErrorCategory.USER_ACTION),
      `Provider ${scenario} must normalize to ${scenario === "timeout" ? "TIMEOUT" : "USER_ACTION"}, got ${category}.`);
    return;
  }
  if (scenario === "events") {
    if (!fixture.exerciseEvents) return "No provider event bridge fixture supplied; event coverage is incomplete.";
    await fixture.exerciseEvents();
    return;
  }
  if (scenario === "restore" && !adapter.restoreSession) return "Passive restore is not implemented.";
  if (scenario === "sign-message" && !adapter.capabilities.signMessage) return "Message signing is not advertised.";
  const signOnly = Boolean(adapter.capabilities.signTransaction || adapter.capabilities.details?.transactionModes?.includes("sign-only"));
  if (scenario === "sign-only" && !signOnly) return "Sign-only is not advertised.";
  if (scenario === "sign-and-submit" && !adapter.capabilities.signAndSubmit) return "Submission is not advertised.";
  if ((scenario === "disconnect" || scenario === "cleanup") && !adapter.disconnect) return "Disconnect is not implemented.";
  const connected = await adapter.connect(fixture.connectOptions);
  validateConnection(connected, fixture);
  if (scenario === "connect") return;
  if (scenario === "restore") {
    const session: WalletSession = connected.session ?? { adapterId: adapter.metadata.id, account: connected.account, connectedAt: Date.now() };
    const restored = await adapter.restoreSession!(session);
    if (fixture.restoreExpected === "unavailable") requireContract(restored === null, "Passive restore must refuse an unverified connection.");
    else { requireContract(restored !== null, "Passive restore must recover the fixture's active account."); validateConnection(restored, fixture); }
  } else if (scenario === "sign-message") {
    const result = await adapter.signMessage!({ ...structuredClone(fixture.message), account: connected.account });
    requireContract(typeof result.proof === "string" && result.proof.length > 0, "Message result requires a non-empty proof.");
    requireContract(result.signatureKind === "signature" || result.signatureKind === "signedTx", "Message result must distinguish compact signatures from signed transactions.");
    requireContract(result.proof === (result.signatureKind === "signature" ? result.signature : result.txBlob), "Message proof must match its declared signature kind.");
  } else if (scenario === "sign-only") {
    const request = structuredClone(fixture.transaction);
    const raw = adapter.signTransaction ? await adapter.signTransaction(request) : await adapter.signAndSubmit!({ ...request, submit: false });
    const result = normalizeSignTransactionResult(raw);
    requireContract(typeof result.txBlob === "string" && result.txBlob.length > 0, "Sign-only must expose a signed blob, not only a submission hash.");
    requireContract(result.signed !== false && !result.rejected, "Sign-only success must not be marked unsigned or rejected.");
  } else if (scenario === "sign-and-submit") {
    const result = normalizeTxResult(await adapter.signAndSubmit!({ ...structuredClone(fixture.transaction), submit: true }));
    requireContract(typeof result.hash === "string" && result.hash.length > 0, "Submission must expose a transaction hash.");
    requireContract(!result.rejected, "Submission success must not be marked rejected.");
  } else {
    await adapter.disconnect!();
    await adapter.disconnect!();
    if (scenario === "cleanup") {
      if (!fixture.remainingResources) return "No resource counter supplied; provider cleanup coverage is incomplete.";
      requireContract(await fixture.remainingResources() === 0, "Disconnect must release provider listeners, timers and transports.");
    }
  }
}

/** Runner-neutral: compatible with node:test, Vitest, Jest, or a browser consumer. */
export async function runAdapterConformance(options: AdapterConformanceOptions): Promise<AdapterConformanceReport> {
  const timeoutMs = options.caseTimeoutMs ?? 2000;
  requireContract(Number.isFinite(timeoutMs) && timeoutMs > 0, "caseTimeoutMs must be positive and finite.");
  const results: AdapterConformanceResult[] = [];
  for (const scenario of scenarios) {
    let fixture: AdapterConformanceFixture | undefined;
    let result: AdapterConformanceResult;
    try {
      // Factory owns initialization time: do not race it and leak a late-created fixture.
      fixture = await options.createFixture(scenario);
      const reason = await bounded(() => runCase(scenario, fixture!), timeoutMs);
      result = { scenario, status: reason ? "skipped" : "passed", message: reason };
    } catch (error) {
      result = { scenario, status: "failed", message: error instanceof Error ? error.message : String(error) };
    } finally {
      if (fixture) {
        try {
          try {
            await bounded(async () => { await fixture!.adapter.cancelPendingConnection?.(); await fixture!.adapter.disconnect?.(); }, timeoutMs);
          } finally {
            await bounded(async () => { await fixture!.dispose?.(); }, timeoutMs);
          }
        } catch (error) {
          result = { scenario, status: "failed", message: `Fixture cleanup failed: ${error instanceof Error ? error.message : String(error)}` };
        }
      }
    }
    results.push(result!);
  }
  return { passed: results.every(result => result.status !== "failed"), results };
}

export function assertAdapterConformance(report: AdapterConformanceReport): void {
  const failures = report.results.filter(result => result.status === "failed");
  requireContract(report.passed && failures.length === 0, failures.map(result => `${result.scenario}: ${result.message}`).join("\n") || "Adapter conformance failed.");
}
