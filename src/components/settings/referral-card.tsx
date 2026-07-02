"use client";

/**
 * PART M.1 — School-side referral card (Settings → Billing).
 * A school sees its own referral code to share, applies a code it was given
 * (one-time), and sees every credit it has earned (as referrer or referred).
 */
import * as React from "react";
import { Gift, Copy, CheckCircle2, Loader2, Send } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";

interface ReferralCredit {
  id: string;
  role: string;
  counterpartName: string;
  discountPct: number;
  status: string;
  appliedAmountKes: number | null;
  appliedAt: string | null;
  createdAt: string;
}

interface ReferralStatus {
  referralCode: string;
  hasClaimedReferral: boolean;
  referredByTenantId: string | null;
  schoolsReferred: number;
  rulesActive: boolean;
  discountPct: number;
  credits: ReferralCredit[];
}

export function ReferralCard() {
  const { toast } = useToast();
  const [data, setData] = React.useState<ReferralStatus | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [code, setCode] = React.useState("");
  const [applying, setApplying] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  const load = React.useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/billing/referral");
      const json = await res.json();
      if (json.ok) setData(json.data);
      else setError(json.error?.message || "Could not load referral status.");
    } catch {
      setError("Could not load referral status.");
    }
  }, []);

  React.useEffect(() => { void load(); }, [load]);

  function copyCode() {
    if (!data?.referralCode) return;
    navigator.clipboard?.writeText(data.referralCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  async function applyCode() {
    if (!code.trim()) return;
    setApplying(true);
    try {
      const res = await fetch("/api/billing/referral", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const json = await res.json();
      if (json.ok) {
        toast({ title: `Referral applied — referred by ${json.data.appliedTo}`, tone: "success" });
        setCode("");
        await load();
      } else {
        toast({ title: json.error?.message || "Could not apply that referral code.", tone: "error" });
      }
    } finally {
      setApplying(false);
    }
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-4 text-sm font-semibold text-red-700 dark:text-red-300">
          {error} <Button size="sm" variant="secondary" className="ml-2" onClick={() => void load()}>Retry</Button>
        </CardContent>
      </Card>
    );
  }

  if (data === null) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="h-24 animate-pulse rounded-2xl bg-navy-100 dark:bg-navy-900" />
        </CardContent>
      </Card>
    );
  }

  if (!data.rulesActive) {
    return null; // referrals are OFF platform-wide — don't clutter Settings with a dead feature.
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Gift className="h-5 w-5 text-green-600" /> Refer a school, both of you save</CardTitle>
        <p className="mt-1 text-xs text-navy-500 dark:text-navy-400">
          Share your code with another school. Once they become a real paying NEYO customer, you both get {Math.round(data.discountPct * 100)}% off your next NEYO subscription charge — automatically, no forms.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-green-200 bg-green-50/60 p-4 dark:border-green-900/40 dark:bg-green-950/20">
          <div className="flex-1">
            <p className="text-xs font-bold uppercase tracking-widest text-green-700 dark:text-green-300">Your referral code</p>
            <p className="mt-1 font-mono text-lg font-black text-navy-950 dark:text-white">{data.referralCode}</p>
          </div>
          <Button size="sm" variant="secondary" onClick={copyCode}>
            {copied ? <><CheckCircle2 className="h-4 w-4" /> Copied</> : <><Copy className="h-4 w-4" /> Copy code</>}
          </Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-navy-100 bg-white/70 p-4 text-center dark:border-navy-800 dark:bg-navy-900/60">
            <p className="text-2xl font-black text-navy-950 dark:text-white">{data.schoolsReferred}</p>
            <p className="text-xs text-navy-500 dark:text-navy-400">Schools you've referred</p>
          </div>
          <div className="rounded-2xl border border-navy-100 bg-white/70 p-4 text-center dark:border-navy-800 dark:bg-navy-900/60">
            <p className="text-2xl font-black text-navy-950 dark:text-white">{data.credits.filter((c) => c.status === "APPLIED").length}</p>
            <p className="text-xs text-navy-500 dark:text-navy-400">Discounts applied so far</p>
          </div>
        </div>

        {!data.referredByTenantId && (
          <div className="space-y-2">
            <p className="text-sm font-semibold text-navy-800 dark:text-navy-100">Have a referral code from another school?</p>
            <div className="flex gap-2">
              <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="NEYO-AB39F" className="font-mono" />
              <Button onClick={applyCode} disabled={applying || !code.trim()}>
                {applying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Apply
              </Button>
            </div>
          </div>
        )}

        {data.credits.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-widest text-navy-400">Your referral credits</p>
            {data.credits.map((c) => (
              <div key={c.id} className="flex items-center justify-between rounded-2xl border border-navy-100 bg-white/70 p-3 dark:border-navy-800 dark:bg-navy-900/60">
                <div>
                  <p className="text-sm font-semibold text-navy-900 dark:text-navy-50">
                    {c.role === "REFERRER" ? `You referred ${c.counterpartName}` : `Referred by ${c.counterpartName}`}
                  </p>
                  <p className="text-xs text-navy-500 dark:text-navy-400">{Math.round(c.discountPct * 100)}% discount{c.appliedAmountKes ? ` · KES ${c.appliedAmountKes.toLocaleString()} applied` : ""}</p>
                </div>
                <Badge tone={c.status === "APPLIED" ? "green" : c.status === "EXPIRED" ? "neutral" : "amber"}>{c.status}</Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
