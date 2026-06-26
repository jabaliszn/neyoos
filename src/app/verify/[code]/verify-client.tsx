"use client";

import * as React from "react";
import { Smartphone, Check, Loader2, Sparkles } from "lucide-react";
import { useToast } from "@/components/ui/toast";

export function VerifyClient({ verifyCode }: { verifyCode: string }) {
  const { toast } = useToast();
  const [phone, setPhone] = React.useState("");
  const [amount, setAmount] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [done, setDone] = React.useState(false);

  async function handlePay(e: React.FormEvent) {
    e.preventDefault();
    if (!phone || !amount) return;

    setLoading(true);
    try {
      const res = await fetch("/api/payments/public-stk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ verifyCode, phone, amount: Number(amount) }),
      });
      const json = await res.json();

      if (json.ok) {
        setDone(true);
        toast({
          title: "M-Pesa STK push sent!",
          description: "Check your phone to enter your M-Pesa PIN and authorize the payment.",
          tone: "success",
        });
      } else {
        toast({
          title: json.error?.message || "M-Pesa push failed. Please try again.",
          tone: "error",
        });
      }
    } catch {
      toast({
        title: "Network error triggering payment.",
        tone: "error",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-6 border-t border-navy-100 pt-5 text-left dark:border-navy-800">
      <div className="flex items-center gap-1.5 text-xs font-bold text-green-700 dark:text-green-400 uppercase tracking-wider mb-3">
        <Sparkles className="h-3.5 w-3.5 animate-pulse" />
        Instant M-Pesa Fee Payment
      </div>
      
      {done ? (
        <div className="rounded-2xl border border-green-200 bg-green-50/50 p-4 text-center dark:border-green-900/30 dark:bg-green-950/20">
          <div className="mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
            <Check className="h-4.5 w-4.5 text-green-600 dark:text-green-400" />
          </div>
          <p className="text-xs font-semibold text-navy-900 dark:text-navy-50">
            STK Push Sent!
          </p>
          <p className="mt-1 text-[11px] text-navy-500 dark:text-navy-400">
            Please check your mobile phone for the M-Pesa PIN entry prompt to complete transaction.
          </p>
          <button
            type="button"
            onClick={() => {
              setDone(false);
              setAmount("");
            }}
            className="mt-3 text-[11px] font-bold text-green-700 hover:text-green-800 underline block mx-auto dark:text-green-400"
          >
            Send another payment
          </button>
        </div>
      ) : (
        <form onSubmit={handlePay} className="space-y-3.5">
          <p className="text-[11px] leading-relaxed text-navy-500 dark:text-navy-400">
            Scan complete! Enter your M-Pesa phone number and payment amount to initiate a direct transaction to the school ledger for this student.
          </p>
          
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="pub-phone" className="block text-[10px] font-bold uppercase tracking-wider text-navy-400 mb-1">
                Parent Phone No.
              </label>
              <div className="relative">
                <input
                  id="pub-phone"
                  type="tel"
                  placeholder="07XX XXX XXX"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  disabled={loading}
                  className="h-10 w-full rounded-xl border border-navy-200 bg-white pl-8 pr-3 text-xs text-navy-900 transition-colors focus:border-green-500 focus:outline-none dark:border-navy-700 dark:bg-navy-950 dark:text-navy-50"
                />
                <Smartphone className="absolute left-2.5 top-3 h-4 w-4 text-navy-300" />
              </div>
            </div>

            <div>
              <label htmlFor="pub-amount" className="block text-[10px] font-bold uppercase tracking-wider text-navy-400 mb-1">
                Amount (KES)
              </label>
              <div className="relative">
                <input
                  id="pub-amount"
                  type="number"
                  placeholder="Enter amount"
                  required
                  min={1}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  disabled={loading}
                  className="h-10 w-full rounded-xl border border-navy-200 bg-white pl-8 pr-3 text-xs text-navy-900 transition-colors focus:border-green-500 focus:outline-none dark:border-navy-700 dark:bg-navy-950 dark:text-navy-50"
                />
                <span className="absolute left-2.5 top-3 text-[11px] font-bold text-navy-300 select-none">KES</span>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !phone || !amount}
            className="flex h-10 w-full items-center justify-center gap-1.5 rounded-full bg-green-500 text-xs font-bold text-white shadow-sm hover:bg-green-600 disabled:opacity-50 transition-all active:scale-[0.98]"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Smartphone className="h-4 w-4" />
                Trigger M-Pesa STK Push
              </>
            )}
          </button>
        </form>
      )}
    </div>
  );
}
