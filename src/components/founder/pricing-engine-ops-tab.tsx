"use client";

/**
 * Part V — NEYO Capacity-Based Pricing System 2.0 (founder-confirmed pivot,
 * 2026-07-06). The real NEYO Ops "Pricing Engine" tab (V.7):
 *   1. Live-editable weights/thresholds/free-tier config form.
 *   2. A live "test this formula" calculator, reusing the exact same real
 *      pure functions the server uses (mirrored client-side for instant
 *      feedback, and re-verified server-side via /api/quotes/instant).
 *   3. "Schools & Their Current Pricing" — every real school's current
 *      SIZE_BASED_V2 price + its full real TenantPricingSnapshot history.
 *   4. "Quote Requests" queue — review, send a formal quotation, mark
 *      onboarding assistance done.
 *   5. The real, rare discretionary-decrease delegate list (V.8).
 *   6. The real, one-time "migrate everyone now" trigger (V.0).
 *
 * Every number here is genuinely live from the real PlatformSetting-JSON
 * config and real DB rows — never a mock or a hardcoded placeholder.
 */
import * as React from "react";
import {
  Sliders,
  Coins,
  Calculator,
  Building2,
  Inbox,
  UserCog,
  Zap,
  RefreshCw,
  Check,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { formatKES } from "@/lib/utils";

type PricingEngineConfig = {
  weightStudent: number;
  weightStaff: number;
  weightParent: number;
  weightStorageGb: number;
  weightAiOcrUsage: number;
  baseFloorKes: number;
  kesPerScorePoint: number;
  avgGbPerStudent: number;
  avgGbPerStaff: number;
  flatSchoolOverheadGb: number;
  avgAiOcrUsagePerStudent: number;
  fairUseStorageMultiplier: number;
  defaultRepriceThresholdPct: number;
  studentRepriceThresholdPct: number | null;
  staffRepriceThresholdPct: number | null;
  parentRepriceThresholdPct: number | null;
  storageRepriceThresholdPct: number | null;
  freeTierMode: "TRIAL" | "EVERYONE_PAYS";
  freeTrialDays: number;
  alumniStorageFactorEnabled: boolean;
  avgGbPerAlumniRecord: number;
};

type SchoolPricingRow = {
  tenantId: string;
  name: string;
  pricingMode: string;
  sizeBasedPriceKes: number;
  latestSnapshot: {
    id: string;
    studentCount: number;
    staffCount: number;
    parentCount: number;
    estimatedStorageGb: number;
    estimatedAiOcrUsage: number;
    alumniRecordCount: number;
    alumniStorageGbAdded: number;
    alumniFactorApplied: boolean;
    rawScore: number;
    monthlyPriceKes: number;
    reason: string;
    calculatedAt: string;
    note: string | null;
  } | null;
};

type QuoteRequestRow = {
  id: string;
  schoolName: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  declaredStudentCount: number | null;
  declaredStaffCount: number | null;
  declaredParentCount: number | null;
  requestedEstimate: boolean;
  instantQuotedPriceKes: number;
  formalQuoteRequested: boolean;
  finalQuotedPriceKes: number | null;
  status: "REQUESTED" | "QUOTED" | "ACCEPTED" | "DECLINED" | "LIVE";
  onboardingAssistanceRequested: boolean;
  onboardingAssistanceNote: string | null;
  onboardingAssistanceDoneAt: string | null;
  createdAt: string;
};

type DelegateRow = { id: string; fullName: string; email: string; canApplyDiscretionaryDecrease: boolean };

function computeSizeScoreClient(
  studentCount: number,
  staffCount: number,
  parentCount: number,
  config: PricingEngineConfig
) {
  const estimatedStorageGb = studentCount * config.avgGbPerStudent + staffCount * config.avgGbPerStaff + config.flatSchoolOverheadGb;
  const estimatedAiOcrUsage = studentCount * config.avgAiOcrUsagePerStudent;
  const rawScore =
    studentCount * config.weightStudent +
    staffCount * config.weightStaff +
    parentCount * config.weightParent +
    estimatedStorageGb * config.weightStorageGb +
    estimatedAiOcrUsage * config.weightAiOcrUsage;
  const monthlyPriceKes = Math.round(config.baseFloorKes + rawScore * config.kesPerScorePoint);
  return { estimatedStorageGb, estimatedAiOcrUsage, rawScore, monthlyPriceKes };
}

function NumField({ label, value, onChange, hint, step = 1 }: { label: string; value: number; onChange: (v: number) => void; hint?: string; step?: number }) {
  return (
    <div>
      <Label>{label}</Label>
      <Input type="number" step={step} value={Number.isFinite(value) ? value : 0} onChange={(e) => onChange(Number(e.target.value))} />
      {hint && <p className="mt-1 text-[11px] text-navy-400">{hint}</p>}
    </div>
  );
}

function NullableNumField({ label, value, onChange, hint }: { label: string; value: number | null; onChange: (v: number | null) => void; hint?: string }) {
  const [override, setOverride] = React.useState(value !== null);
  return (
    <div>
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        <button
          type="button"
          className="text-[11px] font-semibold text-green-700 dark:text-green-400"
          onClick={() => {
            const next = !override;
            setOverride(next);
            onChange(next ? (value ?? 20) : null);
          }}
        >
          {override ? "Use default instead" : "Override"}
        </button>
      </div>
      {override ? (
        <Input type="number" value={value ?? 0} onChange={(e) => onChange(Number(e.target.value))} />
      ) : (
        <p className="rounded-xl border border-dashed border-navy-200 px-3 py-2 text-xs text-navy-400 dark:border-navy-700">Using the overall default threshold</p>
      )}
      {hint && <p className="mt-1 text-[11px] text-navy-400">{hint}</p>}
    </div>
  );
}

export function PricingEngineOpsTab() {
  const { toast } = useToast();
  const [config, setConfig] = React.useState<PricingEngineConfig | null>(null);
  const [savingConfig, setSavingConfig] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [schools, setSchools] = React.useState<SchoolPricingRow[] | null>(null);
  const [quotes, setQuotes] = React.useState<QuoteRequestRow[] | null>(null);
  const [delegates, setDelegates] = React.useState<DelegateRow[] | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [migrating, setMigrating] = React.useState(false);

  // Calculator state
  const [calcStudents, setCalcStudents] = React.useState("300");
  const [calcStaff, setCalcStaff] = React.useState("20");
  const [calcParents, setCalcParents] = React.useState("390");

  // Formal quote entry
  const [formalQuoteDrafts, setFormalQuoteDrafts] = React.useState<Record<string, string>>({});

  const load = React.useCallback(async () => {
    setError(null);
    try {
      const [cfgRes, schoolsRes, quotesRes, delegatesRes] = await Promise.all([
        fetch("/api/platform/pricing-engine").then((r) => r.json()),
        fetch("/api/ops/pricing-schools").then((r) => r.json()),
        fetch("/api/ops/quotes").then((r) => r.json()),
        fetch("/api/ops/pricing-decrease-delegate").then((r) => r.json()),
      ]);
      if (cfgRes.ok) setConfig(cfgRes.data);
      else setError(cfgRes.error?.message || "Failed to load pricing engine config");
      if (schoolsRes.ok) setSchools(schoolsRes.data.schools);
      if (quotesRes.ok) setQuotes(quotesRes.data.requests);
      if (delegatesRes.ok) setDelegates(delegatesRes.data.staff);
    } catch {
      setError("Failed to load the pricing engine");
    }
  }, []);

  React.useEffect(() => { void load(); }, [load]);

  async function saveConfig() {
    if (!config) return;
    setSavingConfig(true);
    try {
      const res = await fetch("/api/platform/pricing-engine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      const json = await res.json();
      if (json.ok) {
        toast({ title: "Pricing engine config saved", tone: "success" });
        await load();
      } else {
        toast({ title: json.error?.message || "Failed to save", tone: "error" });
      }
    } finally {
      setSavingConfig(false);
    }
  }

  async function sendFormalQuote(id: string) {
    const raw = formalQuoteDrafts[id];
    const price = Number(raw);
    if (!raw || !Number.isFinite(price) || price < 0) {
      toast({ title: "Enter a valid final quoted price in KES first", tone: "error" });
      return;
    }
    setBusyId(id);
    try {
      const res = await fetch(`/api/ops/quotes/${id}/formal-quote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ finalQuotedPriceKes: price }),
      });
      const json = await res.json();
      if (json.ok) {
        toast({ title: "Formal quotation sent", tone: "success" });
        await load();
      } else {
        toast({ title: json.error?.message || "Failed to send quotation", tone: "error" });
      }
    } finally {
      setBusyId(null);
    }
  }

  async function markAssistanceDone(id: string) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/ops/quotes/${id}/onboarding-assistance-done`, { method: "POST" });
      const json = await res.json();
      if (json.ok) {
        toast({ title: "Onboarding assistance marked done", tone: "success" });
        await load();
      } else {
        toast({ title: json.error?.message || "Failed", tone: "error" });
      }
    } finally {
      setBusyId(null);
    }
  }

  async function toggleDelegate(userId: string, next: boolean) {
    setBusyId(userId);
    try {
      const res = await fetch("/api/ops/pricing-decrease-delegate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, canApplyDiscretionaryDecrease: next }),
      });
      const json = await res.json();
      if (json.ok) {
        toast({ title: next ? "Delegated the discretionary-decrease capability" : "Revoked", tone: "success" });
        await load();
      } else {
        toast({ title: json.error?.message || "Failed", tone: "error" });
      }
    } finally {
      setBusyId(null);
    }
  }

  async function runMigration() {
    setMigrating(true);
    try {
      const res = await fetch("/api/ops/pricing-migration", { method: "POST" });
      const json = await res.json();
      if (json.ok) {
        toast({ title: `Migration complete — ${json.data.migrated} school(s) migrated, ${json.data.skipped} already on Capacity-Based Pricing 2.0`, tone: "success" });
        await load();
      } else {
        toast({ title: json.error?.message || "Migration failed", tone: "error" });
      }
    } finally {
      setMigrating(false);
    }
  }

  if (error) {
    return (
      <Card className="border-red-200 bg-red-50/80 p-5 dark:border-red-900 dark:bg-red-950/20">
        <p className="text-sm font-medium text-red-700 dark:text-red-300">{error}</p>
        <Button onClick={() => void load()} className="mt-3" variant="secondary"><RefreshCw className="mr-2 h-4 w-4" />Retry</Button>
      </Card>
    );
  }

  if (!config) {
    return <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-24 w-full rounded-2xl" />)}</div>;
  }

  const preview = computeSizeScoreClient(Number(calcStudents) || 0, Number(calcStaff) || 0, Number(calcParents) || 0, config);
  const pendingQuotes = (quotes ?? []).filter((q) => q.status === "REQUESTED");
  const otherQuotes = (quotes ?? []).filter((q) => q.status !== "REQUESTED");

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Coins className="h-5 w-5 text-green-600" />Capacity-Based Pricing 2.0 — the engine</CardTitle>
          <p className="mt-1 text-xs text-navy-500 dark:text-navy-400">
            NEYO Complete: every real feature is available to every school. Price is set purely by a real School Size + Usage Score — students, staff, ALL parents (live or dormant), an estimated storage figure, and an estimated Bundi/OCR usage figure. Nothing here is a mock — every weight below is live and takes effect the moment you save.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-navy-400">Score weights</p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <NumField label="Per student" value={config.weightStudent} step={0.1} onChange={(v) => setConfig({ ...config, weightStudent: v })} />
              <NumField label="Per staff account" value={config.weightStaff} step={0.1} onChange={(v) => setConfig({ ...config, weightStaff: v })} />
              <NumField label="Per parent (all, live or dormant)" value={config.weightParent} step={0.1} onChange={(v) => setConfig({ ...config, weightParent: v })} />
              <NumField label="Per estimated storage GB" value={config.weightStorageGb} step={0.1} onChange={(v) => setConfig({ ...config, weightStorageGb: v })} />
              <NumField label="Per estimated Bundi/OCR usage unit" value={config.weightAiOcrUsage} step={0.1} onChange={(v) => setConfig({ ...config, weightAiOcrUsage: v })} hint="Folded silently into the score — schools are always honestly told 'no setup fee'." />
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-navy-400">Price floor &amp; conversion</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <NumField label="Base floor (KES/month)" value={config.baseFloorKes} onChange={(v) => setConfig({ ...config, baseFloorKes: v })} />
              <NumField label="KES per score point" value={config.kesPerScorePoint} step={0.5} onChange={(v) => setConfig({ ...config, kesPerScorePoint: v })} />
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-navy-400">Storage &amp; Bundi/OCR estimate formula</p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <NumField label="Avg GB per student" value={config.avgGbPerStudent} step={0.01} onChange={(v) => setConfig({ ...config, avgGbPerStudent: v })} />
              <NumField label="Avg GB per staff account" value={config.avgGbPerStaff} step={0.01} onChange={(v) => setConfig({ ...config, avgGbPerStaff: v })} />
              <NumField label="Flat overhead GB per school" value={config.flatSchoolOverheadGb} step={0.5} onChange={(v) => setConfig({ ...config, flatSchoolOverheadGb: v })} />
              <NumField label="Avg Bundi/OCR usage per student" value={config.avgAiOcrUsagePerStudent} step={0.01} onChange={(v) => setConfig({ ...config, avgAiOcrUsagePerStudent: v })} />
              <NumField label="Fair Use storage multiplier" value={config.fairUseStorageMultiplier} step={0.1} onChange={(v) => setConfig({ ...config, fairUseStorageMultiplier: v })} hint="e.g. 1.5 = a school may use up to 150% of its estimate before it's flagged as above Fair Use." />
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-navy-400">Reprice thresholds — price only ever goes up automatically</p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <NumField label="Overall default threshold %" value={config.defaultRepriceThresholdPct} onChange={(v) => setConfig({ ...config, defaultRepriceThresholdPct: v })} />
              <NullableNumField label="Student growth %" value={config.studentRepriceThresholdPct} onChange={(v) => setConfig({ ...config, studentRepriceThresholdPct: v })} />
              <NullableNumField label="Staff growth %" value={config.staffRepriceThresholdPct} onChange={(v) => setConfig({ ...config, staffRepriceThresholdPct: v })} />
              <NullableNumField label="Parent growth %" value={config.parentRepriceThresholdPct} onChange={(v) => setConfig({ ...config, parentRepriceThresholdPct: v })} />
              <NullableNumField label="Storage growth % (above Fair Use)" value={config.storageRepriceThresholdPct} onChange={(v) => setConfig({ ...config, storageRepriceThresholdPct: v })} />
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-navy-400">Free tier</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Mode</Label>
                <div className="mt-1 grid grid-cols-2 gap-2">
                  {(["TRIAL", "EVERYONE_PAYS"] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setConfig({ ...config, freeTierMode: m })}
                      className={`rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors ${config.freeTierMode === m ? "border-green-500 bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300" : "border-navy-200 text-navy-600 hover:bg-navy-50 dark:border-navy-700 dark:text-navy-300"}`}
                    >
                      {m === "TRIAL" ? "Time-boxed trial" : "Everyone pays from day one"}
                    </button>
                  ))}
                </div>
              </div>
              {config.freeTierMode === "TRIAL" && (
                <NumField label="Trial length (days)" value={config.freeTrialDays} onChange={(v) => setConfig({ ...config, freeTrialDays: v })} />
              )}
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-navy-400">Alumni long-term-storage factor</p>
            <p className="mb-2 text-xs text-navy-500 dark:text-navy-400">
              A genuine no-op for every school until they actually import or graduate real alumni records — OFF by default, zero effect on any school's price. When ON, a school's real graduated-student count adds a real, disclosed amount to their score, reflecting the long-term record-keeping NEYO commits to. This is never silent: the moment it genuinely applies to a school, they are honestly told it's due to their historical/alumni records — never an unexplained increase.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Status</Label>
                <div className="mt-1 grid grid-cols-2 gap-2">
                  {([false, true] as const).map((v) => (
                    <button
                      key={String(v)}
                      type="button"
                      onClick={() => setConfig({ ...config, alumniStorageFactorEnabled: v })}
                      className={`rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors ${config.alumniStorageFactorEnabled === v ? "border-green-500 bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300" : "border-navy-200 text-navy-600 hover:bg-navy-50 dark:border-navy-700 dark:text-navy-300"}`}
                    >
                      {v ? "On — factor in alumni" : "Off — ignore alumni"}
                    </button>
                  ))}
                </div>
              </div>
              {config.alumniStorageFactorEnabled && (
                <NumField label="Avg GB per alumni record" value={config.avgGbPerAlumniRecord} step={0.01} onChange={(v) => setConfig({ ...config, avgGbPerAlumniRecord: v })} />
              )}
            </div>
          </div>

          <Button onClick={saveConfig} disabled={savingConfig}>
            {savingConfig ? "Saving…" : "Save pricing engine config"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Calculator className="h-5 w-5 text-green-600" />Test this formula</CardTitle>
          <p className="mt-1 text-xs text-navy-500 dark:text-navy-400">A live preview using your unsaved changes above — exactly the same math the real engine uses.</p>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <Label>Students</Label>
              <Input type="number" value={calcStudents} onChange={(e) => setCalcStudents(e.target.value)} />
            </div>
            <div>
              <Label>Staff</Label>
              <Input type="number" value={calcStaff} onChange={(e) => setCalcStaff(e.target.value)} />
            </div>
            <div>
              <Label>Parents (all, live or dormant)</Label>
              <Input type="number" value={calcParents} onChange={(e) => setCalcParents(e.target.value)} />
            </div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-4">
            <div className="rounded-2xl border border-navy-100 bg-white/70 p-4 dark:border-navy-800 dark:bg-navy-900/60">
              <p className="text-xs text-navy-400">Estimated storage</p>
              <p className="mt-1 text-lg font-bold text-navy-900 dark:text-navy-50">{preview.estimatedStorageGb.toFixed(2)} GB</p>
            </div>
            <div className="rounded-2xl border border-navy-100 bg-white/70 p-4 dark:border-navy-800 dark:bg-navy-900/60">
              <p className="text-xs text-navy-400">Estimated Bundi/OCR usage</p>
              <p className="mt-1 text-lg font-bold text-navy-900 dark:text-navy-50">{preview.estimatedAiOcrUsage.toFixed(2)}</p>
            </div>
            <div className="rounded-2xl border border-navy-100 bg-white/70 p-4 dark:border-navy-800 dark:bg-navy-900/60">
              <p className="text-xs text-navy-400">Raw score</p>
              <p className="mt-1 text-lg font-bold text-navy-900 dark:text-navy-50">{preview.rawScore.toFixed(1)}</p>
            </div>
            <div className="rounded-2xl border border-green-200/70 bg-green-50/60 p-4 dark:border-green-900 dark:bg-green-900/10">
              <p className="text-xs text-navy-400">Monthly price</p>
              <p className="mt-1 text-lg font-bold text-green-700 dark:text-green-400">{formatKES(preview.monthlyPriceKes)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5 text-green-600" />Schools &amp; their current pricing</CardTitle>
          <div className="mt-2 flex items-center justify-between gap-3">
            <p className="text-xs text-navy-500 dark:text-navy-400">Every real live school, its current SIZE_BASED_V2 price, and the reason for its latest snapshot.</p>
            <Button size="sm" variant="secondary" disabled={migrating} onClick={runMigration}>
              <Zap className="mr-1.5 h-3.5 w-3.5" />{migrating ? "Migrating…" : "Migrate everyone now"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {schools === null ? (
            <div className="space-y-3">{[0, 1].map((i) => <Skeleton key={i} className="h-16 w-full rounded-2xl" />)}</div>
          ) : schools.length === 0 ? (
            <EmptyState icon={Building2} title="No schools yet" description="Schools will appear here once they are onboarded." />
          ) : (
            <div className="space-y-2">
              {schools.map((sc) => (
                <div key={sc.tenantId} className="flex items-center justify-between gap-3 rounded-2xl border border-navy-100 bg-white/70 p-4 dark:border-navy-800 dark:bg-navy-900/60">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-navy-900 dark:text-navy-50">{sc.name}</p>
                      <Badge tone={sc.pricingMode === "SIZE_BASED_V2" ? "green" : "neutral"}>{sc.pricingMode}</Badge>
                    </div>
                    {sc.latestSnapshot ? (
                      <p className="mt-1 text-xs text-navy-500 dark:text-navy-400">
                        {sc.latestSnapshot.studentCount} students · {sc.latestSnapshot.staffCount} staff · {sc.latestSnapshot.parentCount} parents{sc.latestSnapshot.alumniFactorApplied ? ` · ${sc.latestSnapshot.alumniRecordCount} alumni records (+${sc.latestSnapshot.alumniStorageGbAdded.toFixed(1)} GB)` : ""} · last: {sc.latestSnapshot.reason.replace(/_/g, " ").toLowerCase()}
                      </p>
                    ) : (
                      <p className="mt-1 text-xs text-navy-400">No pricing snapshot yet</p>
                    )}
                  </div>
                  <p className="text-lg font-bold text-navy-900 dark:text-navy-50">{formatKES(sc.sizeBasedPriceKes)}<span className="text-xs font-normal text-navy-400">/mo</span></p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Inbox className="h-5 w-5 text-green-600" />Quote requests</CardTitle>
          <p className="mt-1 text-xs text-navy-500 dark:text-navy-400">Prospective schools who requested a real quotation after seeing their instant price.</p>
        </CardHeader>
        <CardContent>
          {quotes === null ? (
            <div className="space-y-3">{[0, 1].map((i) => <Skeleton key={i} className="h-16 w-full rounded-2xl" />)}</div>
          ) : quotes.length === 0 ? (
            <EmptyState icon={Inbox} title="No quote requests yet" description="Prospective schools who ask for a formal quotation will appear here." />
          ) : (
            <div className="space-y-3">
              {[...pendingQuotes, ...otherQuotes].map((q) => (
                <div key={q.id} className="rounded-2xl border border-navy-100 bg-white/70 p-4 dark:border-navy-800 dark:bg-navy-900/60">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-navy-900 dark:text-navy-50">{q.schoolName}</p>
                      <Badge tone={q.status === "REQUESTED" ? "amber" : q.status === "LIVE" ? "green" : "blue"}>{q.status}</Badge>
                      {q.formalQuoteRequested && <Badge tone="neutral">Formal quote requested</Badge>}
                    </div>
                    <p className="text-sm font-bold text-navy-900 dark:text-navy-50">Instant: {formatKES(q.instantQuotedPriceKes)}/mo</p>
                  </div>
                  <p className="mt-1 text-xs text-navy-500 dark:text-navy-400">{q.contactName} · {q.contactEmail} · {q.contactPhone}</p>
                  {q.declaredStudentCount !== null && (
                    <p className="mt-1 text-xs text-navy-400">{q.declaredStudentCount} students · {q.declaredStaffCount ?? 0} staff · {q.declaredParentCount ?? 0} parents{q.requestedEstimate ? " (estimated for them)" : ""}</p>
                  )}
                  {q.finalQuotedPriceKes !== null && (
                    <p className="mt-1 text-xs font-semibold text-green-700 dark:text-green-400">Formal quote sent: {formatKES(q.finalQuotedPriceKes)}/mo</p>
                  )}
                  {q.onboardingAssistanceRequested && (
                    <p className="mt-1 text-xs text-navy-500 dark:text-navy-400">
                      Requested onboarding assistance{q.onboardingAssistanceNote ? `: "${q.onboardingAssistanceNote}"` : ""}
                      {q.onboardingAssistanceDoneAt ? " — done" : ""}
                    </p>
                  )}
                  {q.status === "REQUESTED" && (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Input
                        type="number"
                        placeholder="Final quoted price (KES)"
                        className="w-48"
                        value={formalQuoteDrafts[q.id] ?? String(q.instantQuotedPriceKes)}
                        onChange={(e) => setFormalQuoteDrafts((d) => ({ ...d, [q.id]: e.target.value }))}
                      />
                      <Button size="sm" disabled={busyId === q.id} onClick={() => sendFormalQuote(q.id)}>Send formal quote</Button>
                    </div>
                  )}
                  {q.onboardingAssistanceRequested && !q.onboardingAssistanceDoneAt && (
                    <Button size="sm" variant="secondary" className="mt-2" disabled={busyId === q.id} onClick={() => markAssistanceDone(q.id)}>
                      <Check className="mr-1.5 h-3.5 w-3.5" />Mark onboarding assistance done
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><UserCog className="h-5 w-5 text-green-600" />Discretionary-decrease delegates</CardTitle>
          <p className="mt-1 text-xs text-navy-500 dark:text-navy-400">
            A price decrease is never automatic. By default only NEYO's Super Admin/CEO can grant one — you may also delegate this narrow capability to a specific trusted staff member without promoting them.
          </p>
        </CardHeader>
        <CardContent>
          {delegates === null ? (
            <div className="space-y-3">{[0, 1].map((i) => <Skeleton key={i} className="h-14 w-full rounded-2xl" />)}</div>
          ) : delegates.length === 0 ? (
            <EmptyState icon={UserCog} title="No NEYO staff yet" description="NEYO Super Admin staff will appear here." />
          ) : (
            <div className="space-y-2">
              {delegates.map((d) => (
                <div key={d.id} className="flex items-center justify-between gap-3 rounded-2xl border border-navy-100 bg-white/70 p-3.5 dark:border-navy-800 dark:bg-navy-900/60">
                  <div>
                    <p className="font-semibold text-navy-900 dark:text-navy-50">{d.fullName}</p>
                    <p className="text-xs text-navy-500 dark:text-navy-400">{d.email}</p>
                  </div>
                  <Button
                    size="sm"
                    disabled={busyId === d.id}
                    variant={d.canApplyDiscretionaryDecrease ? "secondary" : "primary"}
                    onClick={() => toggleDelegate(d.id, !d.canApplyDiscretionaryDecrease)}
                  >
                    {d.canApplyDiscretionaryDecrease ? "Revoke" : "Delegate"}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
