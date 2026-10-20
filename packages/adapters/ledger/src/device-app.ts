import { Buffer } from "buffer";
import { waitForWalletRequest, WalletKitError, WalletKitErrorCode } from "@xrpl-wallet-kit/core";

export interface LedgerAppTransport {
  close(): Promise<void>;
  send?(cla: number, ins: number, p1: number, p2: number, data?: Buffer): Promise<Uint8Array>;
}

interface OpenAppOptions {
  app?: "XRP" | "XAH";
  signal?: AbortSignal;
  timeoutMs: number;
  assertCurrent(): void;
  onOpening(): void;
  onTransport(transport: LedgerAppTransport): void;
  reopen(transport: LedgerAppTransport): Promise<LedgerAppTransport>;
}

const manual = (app: "XRP" | "XAH") => new Error(`Open ${app} on Ledger. Reconnect.`);
const status = (error: unknown) => (error as { statusCode?: number } | null)?.statusCode;
const unsupported = (error: unknown) => [0x6d00, 0x6e00, 0x6511, 0x650f, 0x6807].includes(status(error) ?? 0);
const disconnected = (error: unknown) => status(error) === undefined && /disconnect|device.*lost|device.*not.*found/i.test(String(error));
const isDashboard = (name: string) => ["BOLOS", "OLOS", "OLOS\0", "DASHBOARD"].includes(name);

function appName(response: Uint8Array, target: "XRP" | "XAH"): string {
  const length = response[1];
  if (response[0] !== 1 || !length || length + 4 > response.length) throw manual(target);
  return Buffer.from(response.subarray(2, length + 2)).toString("ascii").toUpperCase();
}

/** Ledger OS APDUs, not Ledger Live: B0/01 query, B0/A7 close, E0/D8 open. */
export async function ensureLedgerApp(initial: LedgerAppTransport, options: OpenAppOptions): Promise<LedgerAppTransport> {
  const target = options.app ?? "XRP";
  if (!initial.send) return initial;
  let transport = initial;
  const deadline = Date.now() + options.timeoutMs;
  const active = () => {
    options.assertCurrent();
    if (options.signal?.aborted) throw new WalletKitError(WalletKitErrorCode.REQUEST_CANCELLED, "Ledger connection cancelled.");
    if (Date.now() >= deadline) throw new WalletKitError(WalletKitErrorCode.REQUEST_TIMEOUT, "Ledger timed out. Check device.");
  };
  const bounded = async <T>(operation: () => Promise<T>): Promise<T> => {
    active();
    const value = await waitForWalletRequest(operation, { signal: options.signal, timeoutMs: Math.max(1, deadline - Date.now()) });
    active();
    return value;
  };
  const send = (cla: number, ins: number, data?: Buffer) => bounded(() => transport.send!(cla, ins, 0, 0, data));
  const reopen = async () => {
    // Closing can wait for a cancelled exchange; never let cleanup extend our deadline.
    void transport.close().catch(() => {});
    const previous = transport;
    await bounded(async () => {
      const next = await options.reopen(previous);
      try { active(); }
      catch (error) { void next.close().catch(() => {}); throw error; }
      transport = next;
      options.onTransport(next);
    });
  };
  const waitForApp = async (expected: string) => {
    const readyDeadline = Math.min(deadline, Date.now() + 5000);
    while (true) {
      active();
      try {
        const name = appName(await send(0xb0, 0x01), target);
        if (name === expected || expected === "BOLOS" && isDashboard(name)) return;
      }
      catch (error) {
        if (!disconnected(error) && !unsupported(error)) throw error;
        if (disconnected(error)) {
          try { await reopen(); }
          catch (reopenError) { active(); if (!disconnected(reopenError)) throw reopenError; }
        }
      }
      if (Date.now() >= readyDeadline) throw manual(target);
      await bounded(() => new Promise<void>(resolve => setTimeout(resolve, 250)));
    }
  };
  let name: string;
  try { name = appName(await send(0xb0, 0x01), target); }
  catch (error) {
    // Older apps may lack the OS query. Let the selected app's address API report readiness.
    if (unsupported(error)) return initial;
    throw error;
  }
  if (name === target) return transport;
  options.onOpening();
  const switchApp = async (cla: number, ins: number, data?: Buffer) => {
    try { await send(cla, ins, data); }
    catch (error) {
      if (unsupported(error)) throw manual(target);
      if (!disconnected(error)) throw error; // Never retry a rejection or locked-device error.
    }
  };
  if (!isDashboard(name)) {
    await switchApp(0xb0, 0xa7);
    await waitForApp("BOLOS");
  }
  await switchApp(0xe0, 0xd8, Buffer.from(target, "ascii"));
  await waitForApp(target);
  return transport;
}

export const ensureLedgerXrpApp = (initial: LedgerAppTransport, options: OpenAppOptions) =>
  ensureLedgerApp(initial, { ...options, app: "XRP" });
