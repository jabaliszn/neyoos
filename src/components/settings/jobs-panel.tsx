"use client";

import * as React from "react";
import { Play, Loader2, Clock, CheckCircle2, XCircle, RotateCw, Sparkles, Building2, Wallet, Users, MessageSquare } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { TableContainer, Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

interface Schedule {
  name: string;
  hour: number;
  minute: number;
  description: string;
}
interface Run {
  id: string;
  name: string;
  status: string;
  progress: number;
  attempts: number;
  result: string | null;
  error: string | null;
  createdAt: string;
}

const TONE: Record<string, "green" | "red" | "amber" | "neutral"> = {
  SUCCESS: "green",
  FAILED: "red",
  RUNNING: "amber",
  PENDING: "neutral",
};

export function JobsPanel() {
  const [tab, setTab] = React.useState<"jobs" | "health">("jobs");

  return (
    <div className="space-y-5">
      <div className="inline-flex rounded-full border border-navy-200 p-0.5 dark:border-navy-700">
        <button onClick={() => setTab("jobs")} className={`rounded-full px-4 py-1.5 text-sm font-medium ${tab === "jobs" ? "bg-navy-900 text-white dark:bg-navy-50 dark:text-navy-900" : "text-navy-500"}`}>
          Background Jobs
        </button>
        <button onClick={() => setTab("health")} className={`rounded-full px-4 py-1.5 text-sm font-medium ${tab === "health" ? "bg-navy-900 text-white dark:bg-navy-50 dark:text-navy-900" : "text-navy-500"}`}>
          Company Churn Health Check
        </button>
      </div>

      {tab === "jobs" && <JobsTab />}
      {tab === "health" && <CompanyHealthTab />}
    </div>
  );
}

// ---- Background Jobs Sub-Tab ----
function JobsTab() {
  const { toast } = useToast();
  const [schedules, setSchedules] = React.useState<Schedule[]>([]);
  const [runs, setRuns] = React.useState<Run[]>([]);
  const [busy, setBusy] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    const res = await fetch("/api/jobs");
    const json = await res.json();
    if (json.ok) {
      setSchedules(json.data.schedules);
      setRuns(json.data.runs);
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  async function run(name: string) {
    setBusy(name);
    try {
      const res = await fetch("/api/jobs/tick", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ only: name, force: true }),
      });
      const json = await res.json();
      if (json.ok) toast({ title: `Ran ${name}`, tone: "success" });
      else toast({ title: json.error?.message || "Run failed", tone: "error" });
      await load();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Scheduled jobs (Africa/Nairobi)</CardTitle>
          <Button size="sm" variant="ghost" onClick={load}>
            <RotateCw className="h-4 w-4" /> Refresh
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <ul className="divide-y divide-navy-100 dark:divide-navy-800">
            {schedules.map((s) => (
              <li key={s.name} className="flex items-center justify-between gap-4 px-5 py-4">
                <div>
                  <p className="text-sm font-medium text-navy-900 dark:text-navy-50">{s.name}</p>
                  <p className="flex items-center gap-1 text-xs text-navy-400 dark:text-navy-500">
                    <Clock className="h-3 w-3" />
                    {String(s.hour).padStart(2, "0")}:{String(s.minute).padStart(2, "0")} EAT — {s.description}
                  </p>
                </div>
                <Button size="sm" variant="secondary" onClick={() => run(s.name)} disabled={busy !== null}>
                  {busy === s.name ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                  Run now
                </Button>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent runs</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {runs.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-navy-400">No job runs yet.</p>
          ) : (
            <ul className="divide-y divide-navy-100 dark:divide-navy-800">
              {runs.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-4 px-5 py-3">
                  <div className="flex items-center gap-3">
                    {r.status === "SUCCESS" ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    ) : r.status === "FAILED" ? (
                      <XCircle className="h-4 w-4 text-red-600" />
                    ) : (
                      <Loader2 className="h-4 w-4 animate-spin text-amber-600" />
                    )}
                    <div>
                      <p className="text-sm font-medium text-navy-900 dark:text-navy-50">{r.name}</p>
                      <p className="text-xs text-navy-400 dark:text-navy-500">
                        {new Date(r.createdAt).toLocaleString("en-KE")} · attempt {r.attempts}
                        {r.result ? ` · ${r.result}` : ""}
                        {r.error ? ` · ${r.error}` : ""}
                      </p>
                    </div>
                  </div>
                  <Badge tone={TONE[r.status] ?? "neutral"}>{r.status}</Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ---- Company Churn Health Check Sub-Tab (G.30) ----
interface HealthCheckItem {
  id: string;
  name: string;
  slug: string;
  loginsCount: number;
  smsCount: number;
  feesCollected: number;
  modulesEnabled: number;
  risk: "LOW" | "MEDIUM" | "HIGH";
  createdAt: string;
}

function CompanyHealthTab() {
  const [pulse, setPulse] = React.useState<HealthCheckItem[] | null>(null);
  const [loading, setLoading] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/health-check");
      const json = await res.json();
      if (json.ok) setPulse(json.data.healthCheck);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  React.useEffect(() => { load(); }, [load]);

  if (pulse === null) {
    return (
      <div className="space-y-3">
        {[...Array(2)].map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
      </div>
    );
  }

  const RISK_TONE: Record<string, "green" | "amber" | "red"> = {
    LOW: "green",
    MEDIUM: "amber",
    HIGH: "red",
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-green-600 animate-pulse" />
          NEYO Company Churn Early Warning Dashboard
        </CardTitle>
        <Button size="sm" variant="ghost" onClick={load} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCw className="h-4 w-4" />} Refresh
        </Button>
      </CardHeader>
      <CardContent>
        <TableContainer>
          <Table>
            <THead>
              <TR>
                <TH>School / Slug</TH>
                <TH>Setup Date</TH>
                <TH align="right">30d Logins</TH>
                <TH align="right">SMS Spend</TH>
                <TH align="right">Fees Reconciled</TH>
                <TH align="right">Adoption</TH>
                <TH align="center">Churn Risk</TH>
              </TR>
            </THead>
            <TBody>
              {pulse.map((item) => (
                <TR key={item.id}>
                  <TD>
                    <div>
                      <p className="font-semibold text-navy-900 dark:text-navy-50 flex items-center gap-1.5">
                        <Building2 className="h-3.5 w-3.5 text-navy-400" />
                        {item.name}
                      </p>
                      <p className="text-[10px] text-navy-400 font-mono">{item.slug}</p>
                    </div>
                  </TD>
                  <TD className="text-xs text-navy-600 dark:text-navy-400 font-mono">{item.createdAt}</TD>
                  <TD align="right" className="font-medium">
                    <span className="inline-flex items-center gap-1">
                      <Users className="h-3 w-3 text-navy-400" />
                      {item.loginsCount}
                    </span>
                  </TD>
                  <TD align="right" className="font-medium text-navy-500">
                    <span className="inline-flex items-center gap-1">
                      <MessageSquare className="h-3 w-3 text-navy-400" />
                      {item.smsCount}
                    </span>
                  </TD>
                  <TD align="right" className="font-bold text-green-600 dark:text-green-400">
                    <span className="inline-flex items-center gap-1">
                      <Wallet className="h-3 w-3 text-green-500" />
                      KES {item.feesCollected.toLocaleString("en-KE")}
                    </span>
                  </TD>
                  <TD align="right">
                    <Badge tone="neutral">{item.modulesEnabled} modules</Badge>
                  </TD>
                  <TD align="center">
                    <Badge tone={RISK_TONE[item.risk]}>{item.risk}</Badge>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </TableContainer>
      </CardContent>
    </Card>
  );
}
