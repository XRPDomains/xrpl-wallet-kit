import React, { useEffect, useRef, useState } from "react";
import { Client, isValidClassicAddress, xrpToDrops } from "xrpl";
import { prepareBatchTransaction } from "../../packages/core/src";
import type { WalletSession, WalletTransaction } from "../../packages/core/src";
import { useWalletKit } from "../../packages/react/src";
import "./batch.css";

export const BATCH_TEST_ADAPTERS = ["xaman", "ghostsig", "xyra"];
type Prepared = Awaited<ReturnType<typeof prepareBatchTransaction>>;
type PaymentInput = { destination: string; amount: string; tag: string };
const sessionKey = (session: WalletSession | null) => session ? `${session.adapterId}:${session.account.address}:${session.account.network?.id}:${session.account.network?.rpcUrl}` : "";
const PREPARED_TTL_MS = 45_000;

function paymentsFrom(inputs: PaymentInput[]) {
  return inputs.map((input, index) => {
    const destination = input.destination.trim();
    if (!isValidClassicAddress(destination)) throw new Error(`Payment ${index + 1}: enter a classic XRPL address.`);
    if (!/^\d+(?:\.\d{1,6})?$/.test(input.amount) || BigInt(xrpToDrops(input.amount)) <= 0n) throw new Error(`Payment ${index + 1}: enter a positive XRP amount with at most 6 decimals.`);
    const tag = input.tag.trim();
    if (tag && (!/^\d+$/.test(tag) || BigInt(tag) > 0xffffffffn)) throw new Error(`Payment ${index + 1}: destination tag must be uint32.`);
    return { TransactionType: "Payment", Destination: destination, Amount: xrpToDrops(input.amount),
      ...(tag ? { DestinationTag: Number(tag) } : {}) };
  });
}

function errorText(error: unknown) {
  if (error instanceof Error) return JSON.stringify({ name: error.name, message: error.message,
    code: (error as { code?: string }).code, details: (error as { details?: unknown }).details }, null, 2);
  return String(error);
}

export function BatchPanel() {
  const { manager, session } = useWalletKit();
  const [inputs, setInputs] = useState<PaymentInput[]>([{ destination: "", amount: "0.01", tag: "" }, { destination: "", amount: "0.01", tag: "" }]);
  const [maxFee, setMaxFee] = useState("1000");
  const [prepared, setPrepared] = useState<{ tx: Prepared; key: string; at: number; ledger: number }>();
  const [reviewed, setReviewed] = useState(false);
  const [authorizeSubmit, setAuthorizeSubmit] = useState(false);
  const [busy, setBusy] = useState<"prepare" | "sign" | "submit" | null>(null);
  const [status, setStatus] = useState("Not prepared");
  const [output, setOutput] = useState("");
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [now, setNow] = useState(Date.now());
  const generation = useRef(0);
  const activeOperation = useRef(false);
  const alive = useRef(true);
  const key = sessionKey(session);
  const supported = !!session && BATCH_TEST_ADAPTERS.includes(session.adapterId);
  const fresh = !!prepared && prepared.key === key && now - prepared.at < PREPARED_TTL_MS;

  function invalidate() {
    generation.current++;
    setPrepared(undefined); setReviewed(false); setAuthorizeSubmit(false);
  }

  useEffect(() => {
    invalidate(); setOutput(""); setTransactions([]); setStatus("Not prepared");
  }, [key]);

  useEffect(() => {
    alive.current = true;
    const timer = setInterval(() => {
      setNow(Date.now());
      const address = manager.getAccount()?.address;
      const network = manager.getAccount()?.network?.id;
      setTransactions(manager.getTransactions().filter(tx => tx.batch && tx.account?.address === address && tx.account?.network?.id === network));
    }, 1000);
    return () => { alive.current = false; generation.current++; clearInterval(timer); };
  }, [manager]);

  async function prepare() {
    if (activeOperation.current) return;
    invalidate();
    const current = manager.getSession();
    if (!current || !BATCH_TEST_ADAPTERS.includes(current.adapterId)) { setOutput("Connect Xaman, GhostSig or Xyra before preparing Batch."); return; }
    const capturedKey = sessionKey(current);
    const version = generation.current;
    let client: Client | undefined;
    activeOperation.current = true; setBusy("prepare"); setOutput(""); setStatus("Preparing");
    try {
      if (!/^[1-9]\d*$/.test(maxFee)) throw new Error("Fee ceiling must be a positive integer drops string.");
      const transactions = paymentsFrom(inputs);
      const rpc = current.account.network?.rpcUrl;
      if (!rpc) throw new Error("Connected wallet has no RPC network.");
      client = new Client(rpc, { connectionTimeout: 10000, timeout: 10000 });
      await client.connect();
      const tx = await prepareBatchTransaction(client, { account: current.account.address, transactions, maxFeeDrops: maxFee, sourceTag: 0 });
      const ledger = await client.getLedgerIndex();
      if (tx.LastLedgerSequence! <= ledger) throw new Error("Prepared Batch has expired. Prepare again.");
      if (!alive.current || version !== generation.current || capturedKey !== sessionKey(manager.getSession())) return;
      const at = Date.now(); setNow(at); setPrepared({ tx, at, key: capturedKey, ledger }); setStatus("Ready for review");
    } catch (error) {
      if (alive.current && version === generation.current) { setStatus("Preparation failed"); setOutput(errorText(error)); }
    } finally {
      try { if (client?.isConnected()) await client.disconnect(); }
      catch (error) { console.warn("Batch preparation RPC disconnect failed", error); }
      finally { activeOperation.current = false; if (alive.current) setBusy(null); }
    }
  }

  async function sign(submit: boolean) {
    if (activeOperation.current || !prepared || !reviewed || (submit && !authorizeSubmit)) return;
    const snapshot = prepared;
    if (snapshot.key !== sessionKey(manager.getSession()) || Date.now() - snapshot.at >= PREPARED_TTL_MS) {
      invalidate(); setStatus("Prepare again"); return;
    }
    // Keep the wallet invocation in this click handler; no preparation RPC before the prompt.
    activeOperation.current = true; setBusy(submit ? "submit" : "sign"); setStatus(submit ? "Awaiting signature and submission" : "Awaiting signature"); setOutput("");
    setReviewed(false); setAuthorizeSubmit(false); setPrepared(undefined);
    try {
      const preflight = { allowedTransactionTypes: ["Batch", "Payment"], maxFeeDrops: maxFee,
        requireLastLedgerSequence: true, validatedLedgerIndex: snapshot.ledger };
      const result = submit ? await manager.signAndSubmit({ txJson: snapshot.tx, preflight }) : await manager.signTransaction({ txJson: snapshot.tx, preflight });
      if (!alive.current) return;
      setStatus(submit ? "Submitted; checking inner results" : "Signed only; not submitted");
      setOutput(JSON.stringify({ account: snapshot.tx.Account, network: snapshot.key, submit, result }, null, 2));
    } catch (error) {
      if (alive.current) { setStatus(submit ? "Submission not confirmed; inspect result before retrying" : "Signing did not complete"); setOutput(errorText(error)); }
    } finally { activeOperation.current = false; if (alive.current) setBusy(null); }
  }

  return <section className="batch-panel" aria-labelledby="batch-title">
    <div className="batch-heading"><h2 id="batch-title">Batch</h2><span>Experimental · All-or-Nothing · {session?.account.network?.id ?? "mainnet"}</span></div>
    <p className="batch-warning">Mainnet payments spend real XRP. Batch support is not yet verified with these wallets.</p>
    <div className="batch-context">{session ? `${session.adapterId} · ${session.account.address}` : "No wallet connected"}</div>
    <fieldset disabled={!!busy} className="batch-inputs"><legend>Payments</legend>
      {inputs.map((input, index) => <div className="batch-payment" key={index}>
        <strong>{index + 1}</strong>
        <label>Recipient<input aria-label={`Payment ${index + 1} recipient`} value={input.destination} placeholder="r..." autoComplete="off" spellCheck={false}
          onChange={event => { invalidate(); setInputs(current => current.map((row, i) => i === index ? { ...row, destination: event.target.value } : row)); }} /></label>
        <label>XRP<input aria-label={`Payment ${index + 1} XRP`} value={input.amount} inputMode="decimal"
          onChange={event => { invalidate(); setInputs(current => current.map((row, i) => i === index ? { ...row, amount: event.target.value } : row)); }} /></label>
        <label>Destination tag<input aria-label={`Payment ${index + 1} destination tag`} value={input.tag} placeholder="Optional" inputMode="numeric"
          onChange={event => { invalidate(); setInputs(current => current.map((row, i) => i === index ? { ...row, tag: event.target.value } : row)); }} /></label>
      </div>)}
      <label className="batch-fee">Fee ceiling (drops)<input value={maxFee} inputMode="numeric" onChange={event => { invalidate(); setMaxFee(event.target.value); }} /></label>
    </fieldset>
    <div className="batch-actions"><button type="button" disabled={!!busy || !supported} onClick={() => void prepare()}>{busy === "prepare" ? "Preparing..." : "Prepare Batch"}</button>
      <span role="status">{prepared && !fresh ? "Preparation expired; prepare again" : status}</span>
    </div>
    {session && !supported && <p className="batch-warning">Batch testing is enabled for Xaman, GhostSig and Xyra only.</p>}
    {prepared && <div className="batch-review">
      <h3>Review</h3>
      <dl><div><dt>Account</dt><dd>{prepared.tx.Account}</dd></div><div><dt>Network</dt><dd>{session?.account.network?.id}</dd></div>
        <div><dt>Fee</dt><dd>{prepared.tx.Fee} drops</dd></div><div><dt>Expiry ledger</dt><dd>{prepared.tx.LastLedgerSequence}</dd></div>
        <div><dt>Total amount</dt><dd>{inputs.reduce((sum, input) => sum + BigInt(xrpToDrops(input.amount)), 0n).toString()} drops</dd></div></dl>
      <div className="batch-table-wrap"><table><thead><tr><th>Operation</th><th>Recipient</th><th>Amount (drops)</th><th>Tag</th></tr></thead><tbody>
        {prepared.tx.RawTransactions.map(({ RawTransaction: tx }, index) => {
          const payment = tx as unknown as Record<string, unknown>;
          return <tr key={index}><td>{index + 1}. {tx.TransactionType}</td><td>{String(payment.Destination)}</td><td>{String(payment.Amount)}</td><td>{String(payment.DestinationTag ?? "None")}</td></tr>;
        })}
      </tbody></table></div>
      <details><summary>Prepared JSON</summary><pre>{JSON.stringify(prepared.tx, null, 2)}</pre></details>
      <label className="batch-check"><input type="checkbox" checked={reviewed} disabled={!!busy || !fresh} onChange={event => setReviewed(event.target.checked)} />I reviewed both payments, network, fee and All-or-Nothing mode.</label>
      <label className="batch-check"><input type="checkbox" checked={authorizeSubmit} disabled={!!busy || !fresh} onChange={event => setAuthorizeSubmit(event.target.checked)} />I authorize submission and spending real funds on this network.</label>
      <div className="batch-actions"><button type="button" disabled={!!busy || !fresh || !reviewed} onClick={() => void sign(false)}>Sign only</button>
        <button type="button" disabled={!!busy || !fresh || !reviewed || !authorizeSubmit} onClick={() => void sign(true)}>Sign and submit</button></div>
    </div>}
    {output && <div className="batch-output"><h3>Request result</h3><pre>{output}</pre></div>}
    {transactions.length > 0 && <div className="batch-output"><h3>Batch confirmation</h3>{transactions.map(tx => <div key={tx.hash} className="batch-transaction">
      <strong>{tx.status}</strong><code>{tx.hash}</code><ul>{tx.batch?.innerTransactions.map(inner => <li key={inner.index}>{inner.index + 1}. {inner.status}{inner.resultCode ? ` · ${inner.resultCode}` : ""}<code>{inner.hash}</code></li>)}</ul>
    </div>)}</div>}
  </section>;
}
