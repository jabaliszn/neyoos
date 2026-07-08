"use client";

/**
 * R.3 — Settings → Security: "Fingerprint / Face ID for money actions".
 * A real, per-school on/off toggle for requireBiometricForFinance, wired to
 * GET/POST /api/finance/security. Server-side enforced everywhere it matters
 * (cash payments, discounts/waivers, bank-deposit entries typed one at a
 * time) — this card is just the visible switch, never the actual security
 * boundary.
 *
 * Founder's exact ask: "the third option" (cash payments AND fee discounts/
 * waivers AND bank-deposit entries AND invoice edits), a real settings
 * toggle a school can turn on or off, and it must work with iPhone Face ID
 * and any other phone's fingerprint/Face unlock — all satisfied by reusing
 * NEYO's existing @simplewebauthn/browser passkey infrastructure as-is.
 */
import * as React from "react";
import { Fingerprint, Loader2, ShieldCheck, ShieldAlert, Banknote, Percent, Landmark } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";

interface Status {
  requireBiometricForFinance: boolean;
  currentUserHasPasskey: boolean;
}

export function FinanceSecurityCard() {
  const { toast } = useToast();
  const [status, setStatus] = React.useState<Status | null>(null);
  const [error, setError] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  const load = React.useCallback(async () => {
    setError(false);
    try {
      const res = await fetch("/api/finance/security");
      const json = await res.json();
      if (json.ok) setStatus(json.data); else setError(true);
    } catch { setError(true); }
  }, []);
  React.useEffect(() => { load(); }, [load]);

  async function toggle(next: boolean) {
    setSaving(true);
    try {
      const res = await fetch("/api/finance/security", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: next }),
      });
      const json = await res.json();
      if (json.ok) {
        setStatus(json.data);
        toast({
          title: next ? "Fingerprint/Face ID check is now required for money actions" : "Fingerprint/Face ID check turned off",
          tone: "success",
        });
      } else {
        toast({ title: json.error?.message || "Could not update this setting.", tone: "error" });
      }
    } catch {
      toast({ title: "Network problem — try again.", tone: "error" });
    } finally {
      setSaving(false);
    }
  }

  if (error) {
    return (
      <Card>
        <CardHeader><CardTitle>Fingerprint / Face ID for money actions</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-navy-400">Could not load this setting.</p>
          <Button variant="secondary" onClick={load} className="mt-2">Retry</Button>
        </CardContent>
      </Card>
    );
  }

  if (status === null) {
    return (
      <Card>
        <CardHeader><CardTitle>Fingerprint / Face ID for money actions</CardTitle></CardHeader>
        <CardContent><div className="h-20 animate-pulse rounded-xl bg-navy-100 dark:bg-navy-800" /></CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2"><Fingerprint className="h-4.5 w-4.5" /> Fingerprint / Face ID for money actions</CardTitle>
        <Badge tone={status.requireBiometricForFinance ? "green" : "neutral"}>
          {status.requireBiometricForFinance ? "On" : "Off"}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-navy-600 dark:text-navy-300">
          When on, staff must scan their fingerprint, Face ID, or another passkey right before:
        </p>
        <ul className="space-y-1.5 text-sm text-navy-600 dark:text-navy-300">
          <li className="flex items-center gap-2"><Banknote className="h-3.5 w-3.5 text-navy-400" /> Recording a cash, M-Pesa-already-paid, or bank-slip payment at the desk or in Finance</li>
          <li className="flex items-center gap-2"><Percent className="h-3.5 w-3.5 text-navy-400" /> Applying a fee discount, waiver, scholarship or sibling discount</li>
          <li className="flex items-center gap-2"><Landmark className="h-3.5 w-3.5 text-navy-400" /> Bank-deposit reconciliation entries typed in one at a time (bulk statement imports, which reconcile money that already landed days earlier, are not affected)</li>
        </ul>
        <p className="text-xs text-navy-400">
          Works with iPhone Face ID and Android fingerprint/face unlock — any device passkey already set up in Settings → Security above. Bank statement bulk-import reconciliation and STK/M-Pesa auto-collected payments are never gated (they are not a person handling cash at a counter).
        </p>

        {!status.currentUserHasPasskey && (
          <p className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300">
            <ShieldAlert className="h-4 w-4 shrink-0" />
            You personally haven&apos;t set up a fingerprint/Face ID/passkey yet — set one up above first, or you&apos;ll be locked out of recording payments yourself once this is on.
          </p>
        )}

        <div className="flex items-center justify-between rounded-2xl border border-navy-100 bg-warm-50 p-4 dark:border-navy-800 dark:bg-navy-800">
          <div className="flex items-center gap-2 text-sm font-medium text-navy-800 dark:text-navy-100">
            {status.requireBiometricForFinance ? <ShieldCheck className="h-4 w-4 text-green-600" /> : <Fingerprint className="h-4 w-4 text-navy-400" />}
            Require fingerprint/Face ID before money actions
          </div>
          <Button
            variant={status.requireBiometricForFinance ? "secondary" : "primary"}
            disabled={saving}
            onClick={() => toggle(!status.requireBiometricForFinance)}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {status.requireBiometricForFinance ? "Turn off" : "Turn on"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
