"use client";

import * as React from "react";
import Link from "next/link";
import {
  GraduationCap,
  Wallet,
  Target,
  AlertTriangle,
  Banknote,
  TrendingUp,
  Users,
  RefreshCw,
  PencilLine,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { TermPulseCard } from "@/components/owner/term-pulse-card";

/** B.24 Owner Dashboard client — glass-first, KES everywhere, 4 UX states. */

type Dash = {
  asOf: string;
  term: { year: number; term: number } | null;
  students: { active: number; boys: number; girls: number; boarders: number };
  revenue: { todayKes: number; termCollectedKes: number; termBilledKes: number };
  collection: { pct: number; targetPct: number; onTrack: boolean };
  arrears: {
    outstandingKes: number;
    buckets: { current: number; d30: number; d60: number; d90: number };
    topDebtors: { studentId: string; name: string; admissionNo: string; balanceKes: number }[];
    openInvoices: number;
  };
  staffCosts: { period: string; status: string; staff: number; grossKes: number; netKes: number; statutoryKes: number } | null;
  profitability: { collectedTermKes: number; estTermPayrollKes: number; estSurplusKes: number; note: string };
  enrollmentTrend: { key: string; label: string; joined: number }[];
  examTrend: { name: string; term: number; meanPct: number; entries: number }[];
  ranking: { percentile: number | null; cohort: number; note: string };
};

const kes = (n: number) => `KES ${n.toLocaleString("en-KE")}`;

export function OwnerClient() {
  const { toast } = useToast();
  const [data, setData] = React.useState<Dash | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [editTarget, setEditTarget] = React.useState(false);
  const [targetDraft, setTargetDraft] = React.useState("");

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/owner");
      const j = await r.json();
      if (!j.ok) throw new Error(j.error?.message ?? "Could not load the dashboard.");
      setData(j.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load the dashboard.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  async function saveTarget() {
    const pct = parseInt(targetDraft, 10);
    if (Number.isNaN(pct) || pct < 10 || pct > 100) {
      toast({ title: "Target must be between 10 and 100%", tone: "error" });
      return;
    }
    const r = await fetch("/api/owner", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetPct: pct }),
    });
    const j = await r.json();
    if (j.ok) {
      toast({ title: `Collection target set to ${pct}%`, tone: "success" });
      setEditTarget(false);
      load();
    } else {
      toast({ title: j.error?.message ?? "Could not save the target", tone: "error" });
    }
  }

  // ---- Loading state -------------------------------------------------------
  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-64 rounded-2xl" />
          <Skeleton className="h-64 rounded-2xl" />
        </div>
      </div>
    );
  }

  // ---- Error state ---------------------------------------------------------
  if (error || !data) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="Could not load your school's numbers"
        description={error ?? "Something went wrong."}
        action={
          <Button onClick={load}>
            <RefreshCw className="h-4 w-4" /> Try again
          </Button>
        }
      />
    );
  }

  const d = data;
  const termLabel = d.term ? `Term ${d.term.term} ${d.term.year}` : "This year";
  const bucketMax = Math.max(d.arrears.buckets.current, d.arrears.buckets.d30, d.arrears.buckets.d60, d.arrears.buckets.d90, 1);
  const enrollMax = Math.max(...d.enrollmentTrend.map((m) => m.joined), 1);

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-navy-900 dark:text-navy-50">
            My school at a glance
          </h1>
          <p className="mt-1 text-sm text-navy-500 dark:text-navy-400">
            {termLabel} · live as of {d.asOf}
          </p>
        </div>
        <Button variant="ghost" onClick={load}>
          <RefreshCw className="h-4 w-4" /> Refresh
        </Button>
      </div>

      {/* G.15 — Weekly Term Pulse digest */}
      <TermPulseCard />

      {/* Row 1 — the four numbers an owner asks for first */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-navy-500 dark:text-navy-400">Students today</p>
              <GraduationCap className="h-4.5 w-4.5 text-green-600" />
            </div>
            <p className="mt-2 text-3xl font-semibold text-navy-900 dark:text-navy-50">{d.students.active}</p>
            <p className="mt-1 text-xs text-navy-400">
              {d.students.boys} boys · {d.students.girls} girls · {d.students.boarders} boarders
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-navy-500 dark:text-navy-400">Collected today</p>
              <Wallet className="h-4.5 w-4.5 text-green-600" />
            </div>
            <p className="mt-2 text-3xl font-semibold text-navy-900 dark:text-navy-50">{kes(d.revenue.todayKes)}</p>
            <p className="mt-1 text-xs text-navy-400">{kes(d.revenue.termCollectedKes)} this term</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-navy-500 dark:text-navy-400">Collection rate</p>
              <Target className="h-4.5 w-4.5 text-green-600" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <p className="text-3xl font-semibold text-navy-900 dark:text-navy-50">{d.collection.pct}%</p>
              <Badge tone={d.collection.onTrack ? "green" : "amber"}>
                target {d.collection.targetPct}%
              </Badge>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-navy-100 dark:bg-navy-800">
              <div
                className={`h-full rounded-full ${d.collection.onTrack ? "bg-green-500" : "bg-amber-500"}`}
                style={{ width: `${Math.min(d.collection.pct, 100)}%` }}
              />
            </div>
            {editTarget ? (
              <div className="mt-2 flex items-center gap-2">
                <input
                  value={targetDraft}
                  onChange={(e) => setTargetDraft(e.target.value)}
                  className="w-16 rounded-lg border border-navy-200 bg-white px-2 py-1 text-xs dark:border-navy-700 dark:bg-navy-900"
                  placeholder={String(d.collection.targetPct)}
                  inputMode="numeric"
                />
                <button onClick={saveTarget} className="text-xs font-semibold text-green-600">Save</button>
                <button onClick={() => setEditTarget(false)} className="text-xs text-navy-400">Cancel</button>
              </div>
            ) : (
              <button
                onClick={() => { setTargetDraft(String(d.collection.targetPct)); setEditTarget(true); }}
                className="mt-2 flex items-center gap-1 text-xs text-navy-400 hover:text-navy-600"
              >
                <PencilLine className="h-3 w-3" /> Change target
              </button>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-navy-500 dark:text-navy-400">Outstanding fees</p>
              <AlertTriangle className="h-4.5 w-4.5 text-amber-500" />
            </div>
            <p className="mt-2 text-3xl font-semibold text-navy-900 dark:text-navy-50">{kes(d.arrears.outstandingKes)}</p>
            <p className="mt-1 text-xs text-navy-400">{d.arrears.openInvoices} open invoices</p>
          </CardContent>
        </Card>
      </div>

      {/* Row 2 — arrears breakdown + top debtors */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardContent className="p-5">
            <p className="font-semibold text-navy-900 dark:text-navy-50">Where the arrears sit</p>
            <div className="mt-4 space-y-3">
              {([
                ["Not yet due", d.arrears.buckets.current, "bg-navy-300"],
                ["1–30 days late", d.arrears.buckets.d30, "bg-amber-400"],
                ["31–60 days late", d.arrears.buckets.d60, "bg-orange-500"],
                ["Over 60 days late", d.arrears.buckets.d90, "bg-red-500"],
              ] as const).map(([label, v, color]) => (
                <div key={label}>
                  <div className="flex justify-between text-xs text-navy-500 dark:text-navy-400">
                    <span>{label}</span>
                    <span className="font-semibold text-navy-700 dark:text-navy-200">{kes(v)}</span>
                  </div>
                  <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-navy-100 dark:bg-navy-800">
                    <div className={`h-full rounded-full ${color}`} style={{ width: `${(v / bucketMax) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-navy-900 dark:text-navy-50">Largest balances</p>
              <Link href="/finance" className="text-xs font-semibold text-green-600">Open Finance →</Link>
            </div>
            {d.arrears.topDebtors.length === 0 ? (
              <p className="mt-6 text-sm text-navy-400">No outstanding balances. 🎯</p>
            ) : (
              <ul className="mt-3 divide-y divide-navy-100 dark:divide-navy-800">
                {d.arrears.topDebtors.map((t) => (
                  <li key={t.studentId} className="flex items-center justify-between py-2.5">
                    <Link href={`/students/${t.studentId}`} className="min-w-0">
                      <p className="truncate text-sm font-medium text-navy-800 dark:text-navy-100">{t.name}</p>
                      <p className="text-xs text-navy-400">{t.admissionNo}</p>
                    </Link>
                    <span className="text-sm font-semibold text-red-600">{kes(t.balanceKes)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Row 3 — staff costs + profitability */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-navy-900 dark:text-navy-50">Staff costs</p>
              <Banknote className="h-4.5 w-4.5 text-navy-400" />
            </div>
            {d.staffCosts ? (
              <div className="mt-4 grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-navy-400">Payroll {d.staffCosts.period} ({d.staffCosts.staff} staff)</p>
                  <p className="mt-1 text-2xl font-semibold text-navy-900 dark:text-navy-50">{kes(d.staffCosts.grossKes)}</p>
                  <p className="text-xs text-navy-400">gross / month</p>
                </div>
                <div>
                  <p className="text-xs text-navy-400">Take-home {kes(d.staffCosts.netKes)}</p>
                  <p className="text-xs text-navy-400 mt-1">Statutory {kes(d.staffCosts.statutoryKes)}</p>
                  <Badge tone={d.staffCosts.status === "APPROVED" ? "green" : "amber"} className="mt-2">
                    {d.staffCosts.status === "APPROVED" ? "Approved" : "Draft"}
                  </Badge>
                </div>
              </div>
            ) : (
              <p className="mt-6 text-sm text-navy-400">
                No payroll run yet — <Link href="/payroll" className="text-green-600 font-semibold">run payroll</Link> to see staff costs.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-navy-900 dark:text-navy-50">Term money position</p>
              <TrendingUp className="h-4.5 w-4.5 text-navy-400" />
            </div>
            <div className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-navy-500 dark:text-navy-400">Fees collected</span>
                <span className="font-semibold text-navy-800 dark:text-navy-100">{kes(d.profitability.collectedTermKes)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-navy-500 dark:text-navy-400">Payroll (est. term)</span>
                <span className="font-semibold text-navy-800 dark:text-navy-100">− {kes(d.profitability.estTermPayrollKes)}</span>
              </div>
              <div className="my-2 border-t border-navy-100 dark:border-navy-800" />
              <div className="flex justify-between">
                <span className="font-semibold text-navy-700 dark:text-navy-200">Surplus so far</span>
                <span className={`text-lg font-semibold ${d.profitability.estSurplusKes >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {kes(d.profitability.estSurplusKes)}
                </span>
              </div>
            </div>
            <p className="mt-3 text-xs text-navy-400">{d.profitability.note}</p>
          </CardContent>
        </Card>
      </div>

      {/* Row 4 — trends + ranking */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <p className="font-semibold text-navy-900 dark:text-navy-50">New learners (6 months)</p>
            <div className="mt-4 flex h-32 items-end gap-2">
              {d.enrollmentTrend.map((m) => (
                <div key={m.key} className="flex flex-1 flex-col items-center gap-1">
                  <span className="text-xs font-semibold text-navy-600 dark:text-navy-300">{m.joined || ""}</span>
                  <div
                    className="w-full rounded-t-lg bg-green-500/80"
                    style={{ height: `${(m.joined / enrollMax) * 88}%`, minHeight: m.joined ? 6 : 2 }}
                  />
                  <span className="text-[10px] text-navy-400">{m.label}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <p className="font-semibold text-navy-900 dark:text-navy-50">Exam means this year</p>
            {d.examTrend.length === 0 ? (
              <p className="mt-6 text-sm text-navy-400">Published exam results will chart here.</p>
            ) : (
              <div className="mt-4 space-y-3">
                {d.examTrend.map((e) => (
                  <div key={e.name}>
                    <div className="flex justify-between text-xs">
                      <span className="text-navy-500 dark:text-navy-400">{e.name}</span>
                      <span className="font-semibold text-navy-700 dark:text-navy-200">{e.meanPct}%</span>
                    </div>
                    <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-navy-100 dark:bg-navy-800">
                      <div
                        className={`h-full rounded-full ${e.meanPct >= 65 ? "bg-green-500" : e.meanPct >= 50 ? "bg-amber-400" : "bg-red-500"}`}
                        style={{ width: `${e.meanPct}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-navy-900 dark:text-navy-50">Among NEYO schools</p>
              <Users className="h-4.5 w-4.5 text-navy-400" />
            </div>
            {d.ranking.percentile === null ? (
              <p className="mt-6 text-sm text-navy-400">{d.ranking.note}</p>
            ) : (
              <>
                <p className="mt-4 text-4xl font-semibold text-navy-900 dark:text-navy-50">
                  Top {Math.max(1, 100 - d.ranking.percentile)}%
                </p>
                <p className="mt-2 text-xs text-navy-400">{d.ranking.note}</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
