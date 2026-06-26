"use client";

import * as React from "react";
import { CreditCard, Smartphone, Loader2, Sparkles, LogOut, Check } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function formatKES(val: number) {
  return "KES " + val.toLocaleString("en-KE");
}

export function ExpiredCheckoutClient({
  tenantId,
  schoolName,
  price,
}: {
  tenantId: string;
  schoolName: string;
  price: number;
}) {
  const { toast } = useToast();
  const [phone, setPhone] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [isPolling, setIsPolling] = React.useState(false);
  const [paymentDone, setPaymentDone] = React.useState(false);

  // Play a beautiful success chime completely client-side via Web Audio API
  function playSuccessChime() {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      const now = ctx.currentTime;
      
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(523.25, now); // C5 note
      osc.frequency.exponentialRampToValueAtTime(1046.50, now + 0.15); // C6 slide
      
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.15, now + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.6);
    } catch {
      // Audio unsupported or blocked
    }
  }

  // Polling loop to check if database subscription status changed to ACTIVE
  React.useEffect(() => {
    if (!isPolling) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/billing/status?tenantId=${tenantId}`);
        const json = await res.json();

        if (json.ok && json.data?.active) {
          clearInterval(interval);
          setPaymentDone(true);
          playSuccessChime();
          toast({
            title: "SaaS Subscription Active!",
            description: "Central M-Pesa payment received. Reconnecting you to your School OS dashboard...",
            tone: "success",
          });
          
          // Instantly and automatically reload/reconnect the user!
          setTimeout(() => {
            window.location.reload();
          }, 2000);
        }
      } catch {
        /* Ignore network failures during polling */
      }
    }, 2500);

    return () => clearInterval(interval);
  }, [isPolling, tenantId, toast]);

  async function handlePayment(e: React.FormEvent) {
    e.preventDefault();
    if (!phone) return;

    setLoading(true);
    try {
      const res = await fetch("/api/billing/public-stk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId, phone }),
      });
      const json = await res.json();

      if (json.ok) {
        setIsPolling(true);
        toast({
          title: "M-Pesa STK Push Sent!",
          description: "Enter your M-Pesa PIN on your phone to complete the subscription renewal.",
          tone: "success",
        });
      } else {
        toast({
          title: json.error?.message || "Failed to trigger payment. Please try again.",
          tone: "error",
        });
        setLoading(false);
      }
    } catch {
      toast({
        title: "Network error triggering payment.",
        tone: "error",
      });
      setLoading(false);
    }
  }

  async function handleLogout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      window.location.assign("/login");
    } catch {
      window.location.assign("/login");
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-warm-100 px-4 text-center dark:bg-navy-950 font-sans">
      <div className="w-full max-w-md rounded-3xl border border-white/70 bg-white/70 p-8 shadow-pop backdrop-blur-xl dark:border-white/10 dark:bg-navy-900/60">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/10 text-red-600 dark:bg-red-500/20 dark:text-red-400">
          <CreditCard className="h-7 w-7 animate-pulse" />
        </div>

        <h1 className="mt-5 text-xl font-bold tracking-tight text-navy-950 dark:text-white">
          SaaS License Expired
        </h1>
        <p className="mt-1 text-xs text-navy-400 dark:text-navy-500 uppercase tracking-wider font-semibold">
          School OS: {schoolName}
        </p>

        {paymentDone ? (
          <div className="mt-6 p-4 rounded-2xl bg-green-500/10 border border-green-200 text-center animate-fade-in">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-green-500 text-white shadow-sm mb-2">
              <Check className="h-5 w-5" />
            </div>
            <p className="text-xs font-bold text-green-700 dark:text-green-400">
              Payment Confirmed!
            </p>
            <p className="text-[10px] text-navy-500 dark:text-navy-400 mt-1">
              Reconnecting to your dashboard in a second...
            </p>
          </div>
        ) : isPolling ? (
          <div className="mt-6 p-5 rounded-2xl border border-green-200 bg-green-50/20 text-center animate-fade-in space-y-3">
            <Loader2 className="mx-auto h-7 w-7 animate-spin text-green-600" />
            <div>
              <p className="text-xs font-bold text-navy-800 dark:text-navy-200">
                Awaiting M-Pesa PIN Authorization
              </p>
              <p className="text-[10px] text-navy-500 dark:text-navy-400 mt-1">
                Please authorize the prompt on your phone. Once you enter your PIN, NEYO central billing will automatically reconnect you.
              </p>
            </div>
          </div>
        ) : (
          <form onSubmit={handlePayment} className="mt-6 text-left space-y-4">
            <div className="rounded-2xl border border-navy-50 bg-navy-50/40 p-4 text-xs text-navy-600 dark:border-navy-800">
              <div className="flex justify-between items-center font-bold">
                <span>Grandfathered Rate:</span>
                <span className="text-sm text-green-700 dark:text-green-400 font-mono">
                  {formatKES(price === 0 ? 15000 : price)}
                </span>
              </div>
              <p className="text-[10px] text-navy-400 mt-1">
                Your price is grandfathered and locked forever against inflation.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="checkout-phone">Billing Phone Number (M-Pesa)</Label>
              <div className="relative">
                <Input
                  id="checkout-phone"
                  required
                  placeholder="07XX XXX XXX"
                  value={phone}
                  onChange={(e: any) => setPhone(e.target.value)}
                  disabled={loading}
                  className="h-10 text-xs pl-8"
                />
                <Smartphone className="absolute left-2.5 top-3 h-4 w-4 text-navy-300" />
              </div>
              <p className="text-[10px] text-navy-400">
                We will send a Safaricom M-Pesa STK PIN prompt from NEYO central billing.
              </p>
            </div>

            <Button type="submit" className="w-full h-10 text-xs font-bold" disabled={loading || !phone}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4 text-green-400" />}
              Renew Subscription Instantly
            </Button>
          </form>
        )}

        <div className="mt-6 border-t border-navy-100 pt-4 flex gap-3 justify-center text-xs dark:border-navy-800">
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 text-navy-400 hover:text-navy-700 dark:hover:text-white"
          >
            <LogOut className="h-4 w-4" /> Log Out
          </button>
        </div>
      </div>
      <p className="mt-6 text-xs text-navy-400 dark:text-navy-600 uppercase tracking-[0.2em] font-bold">
        Powered by NEYO
      </p>
    </div>
  );
}
