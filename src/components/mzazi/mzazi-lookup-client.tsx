"use client";

/**
 * G.13 — Mzazi public balance lookup (client). Mobile-first, glass-friendly,
 * works on a cheap phone browser. 4 states: idle → checking → revealed / wrong
 * phone. No login. Balance only after the guardian phone challenge passes.
 */
import * as React from "react";
import { ShieldCheck, Loader2, Phone, Wallet, CheckCircle2, AlertCircle, Smartphone } from "lucide-react";

const kes = (n: number) => `KES ${n.toLocaleString("en-KE")}`;

interface Result {
  found: boolean;
  schoolName?: string;
  learner?: string | null;
  admissionNo?: string;
  className?: string | null;
  balanceKes?: number;
  paybill?: string | null;
  accountNo?: string;
  ok?: boolean;
}

export function MzaziLookupClient({ code }: { code: string }) {
  const [phone, setPhone] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [res, setRes] = React.useState<Result | null>(null);
  const [err, setErr] = React.useState<string | null>(null);
  const [payAmount, setPayAmount] = React.useState("");
  const [paying, setPaying] = React.useState(false);
  const [payMsg, setPayMsg] = React.useState<string | null>(null);

  async function check(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      const r = await fetch(`/api/mzazi/${code}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const json = await r.json();
      if (json.ok) setRes(json.data);
      else setErr(json.error?.message || "Could not check right now.");
    } catch { setErr("Network problem. Try again."); }
    finally { setBusy(false); }
  }



  async function payNow() {
    if (!res?.ok || !phone) return;
    setPaying(true); setErr(null); setPayMsg(null);
    try {
      const r = await fetch(`/api/mzazi/${code}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, amountKes: Number(payAmount || res.balanceKes || 0) }),
      });
      const json = await r.json();
      if (json.ok) {
        setPayMsg("M-Pesa prompt sent. Enter your PIN on the phone to complete payment.");
      } else {
        setErr(json.error?.message || "Could not send M-Pesa prompt.");
      }
    } catch { setErr("Network problem. Try again."); }
    finally { setPaying(false); }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-warm-100 px-4 py-10 dark:bg-navy-950">
      <div className="w-full max-w-sm rounded-2xl border border-navy-100 bg-white p-7 shadow-card dark:border-navy-800 dark:bg-navy-900">
        <div className="mb-5 flex items-center justify-center gap-1.5 text-navy-400">
          <ShieldCheck className="h-4 w-4" />
          <span className="text-xs font-semibold uppercase tracking-wider">Mzazi Fee Card</span>
        </div>

        {/* revealed balance */}
        {res?.ok ? (
          <div className="text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/40">
              <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
            <h1 className="mt-4 text-base font-semibold text-navy-900 dark:text-navy-50">{res.learner}</h1>
            <p className="text-xs text-navy-400">{res.admissionNo}{res.className ? ` · ${res.className}` : ""} · {res.schoolName}</p>

            <div className="mt-5 rounded-xl bg-warm-50 p-4 dark:bg-navy-800">
              <p className="flex items-center justify-center gap-1.5 text-xs text-navy-400"><Wallet className="h-3.5 w-3.5" /> Current fee balance</p>
              <p className={"mt-1 text-3xl font-bold " + ((res.balanceKes ?? 0) > 0 ? "text-red-600" : "text-green-600")}>
                {(res.balanceKes ?? 0) > 0 ? kes(res.balanceKes ?? 0) : "Cleared ✓"}
              </p>
            </div>

            {(res.balanceKes ?? 0) > 0 && (
              <div className="mt-4 space-y-3 rounded-xl border border-green-200 bg-green-50/60 p-4 text-left dark:border-green-900 dark:bg-green-900/10">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-green-800 dark:text-green-300"><Smartphone className="h-3.5 w-3.5" /> Pay directly with M-Pesa</p>
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-navy-600 dark:text-navy-300">Amount to pay</label>
                  <input
                    type="number"
                    min={1}
                    max={res.balanceKes ?? 1}
                    value={payAmount || String(res.balanceKes ?? "")}
                    onChange={(e) => setPayAmount(e.target.value)}
                    className="w-full rounded-xl border border-green-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-500/30 dark:border-green-900 dark:bg-navy-900"
                  />
                </div>
                <button
                  onClick={payNow}
                  disabled={paying}
                  className="flex w-full items-center justify-center gap-2 rounded-full bg-green-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-green-700 disabled:opacity-50"
                >
                  {paying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Smartphone className="h-4 w-4" />}
                  Send M-Pesa prompt
                </button>
                {payMsg && <p className="rounded-lg bg-white/70 px-3 py-2 text-xs font-medium text-green-700 dark:bg-navy-900/70 dark:text-green-300">{payMsg}</p>}
                <div className="border-t border-green-200/70 pt-3 dark:border-green-900/70">
                  <p className="text-[11px] font-semibold text-navy-500 dark:text-navy-400">Or pay manually:</p>
                  <ol className="mt-1 space-y-1 text-xs text-navy-600 dark:text-navy-300">
                    <li>1. Go to <strong>Lipa na M-Pesa → Pay Bill</strong></li>
                    <li>2. Business no. (Paybill): <strong>{res.paybill ?? "ask the school office"}</strong></li>
                    <li>3. Account no.: <strong>{res.accountNo}</strong></li>
                    <li>4. Enter the amount and your PIN.</li>
                  </ol>
                </div>
              </div>
            )}
            <button onClick={() => { setRes(null); setPhone(""); }} className="mt-5 text-xs font-medium text-navy-400 hover:text-navy-600">Check another phone</button>
          </div>
        ) : res && res.found === false ? (
          <div className="text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/40">
              <AlertCircle className="h-8 w-8 text-red-600 dark:text-red-400" />
            </div>
            <h1 className="mt-4 text-base font-semibold text-navy-900 dark:text-navy-50">Card not found</h1>
            <p className="mt-1 text-sm text-navy-500 dark:text-navy-400">This card code isn&apos;t recognised. It may be mistyped.</p>
          </div>
        ) : (
          /* challenge form (idle / wrong-phone) */
          <form onSubmit={check}>
            {res && res.ok === false && res.learner ? (
              <div className="mb-4 rounded-xl bg-amber-50 p-3 text-center dark:bg-amber-900/20">
                <p className="text-sm font-medium text-navy-900 dark:text-navy-50">{res.learner} · {res.schoolName}</p>
                <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">That phone isn&apos;t on this learner&apos;s record. Enter the parent/guardian phone the school has.</p>
              </div>
            ) : (
              <p className="mb-4 text-center text-sm text-navy-500 dark:text-navy-400">
                Enter the parent&apos;s phone number on record to see this learner&apos;s fee balance.
              </p>
            )}
            <label className="mb-1 block text-xs font-medium text-navy-600 dark:text-navy-300">Parent / guardian phone</label>
            <div className="flex items-center gap-2 rounded-xl border border-navy-200 bg-white px-3 dark:border-navy-700 dark:bg-navy-900">
              <Phone className="h-4 w-4 text-navy-400" />
              <input
                value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel"
                placeholder="07XX XXX XXX" autoComplete="tel"
                className="w-full bg-transparent py-2.5 text-sm outline-none"
              />
            </div>
            {err && <p className="mt-2 text-xs text-red-600">{err}</p>}
            <button type="submit" disabled={busy || phone.trim().length < 7}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-navy-900 py-2.5 text-sm font-medium text-white transition-colors hover:bg-navy-800 disabled:opacity-50 dark:bg-navy-50 dark:text-navy-900">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />} Check balance
            </button>
            <p className="mt-3 text-center text-[11px] text-navy-400">Your number is only used to confirm you&apos;re the parent. We never show it.</p>
          </form>
        )}

        <p className="mt-6 text-center text-xs text-navy-400 dark:text-navy-600">Powered by NEYO</p>
      </div>
    </div>
  );
}
