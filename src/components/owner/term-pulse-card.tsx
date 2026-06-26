"use client";

import * as React from "react";
import { Activity, ArrowDownRight, ArrowUpRight, Minus, RefreshCw, Send } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";

/**
 * G.15 Term Trends Pulse — the latest weekly digest, shown on /owner.
 * Glass-first, 4 UX states. The summary line is rule-based (never "AI").
 */

type Pulse = {
  weekKey: string;
  weekStart: string;
  weekEnd: string;
  activeStudents: number;
  joinedThisWeek: number;
  attendancePct: number;
  attendancePrevPct: number;
  attendanceMarked: number;
  collectedWeekKes: number;
  weeklyTargetKes: number;
  collectionTermPct: number;
  summary: string;
  sentCount: number;
};

const kes = (n: number) => `KES ${n.toLocaleString("en-KE")}`;

export function TermPulseCard() {
  const { toast } = useToast();
  const [pulse, setPulse] = React.useState<Pulse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [sending, setSending] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/term-pulse");
      const j = await r.json();
      if (!j.ok) throw new Error(j.error?.message ?? "Could not load the pulse.");
      setPulse(j.data.pulse);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load the pulse.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  async function sendNow() {
    setSending(true);
    try {
      const r = await fetch("/api/term-pulse", { method: "POST" });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error?.message ?? "Could not send the pulse.");
      toast({ title: `Pulse sent to ${j.data.notified} leader${j.data.notified === 1 ? "" : "s"}`, tone: "success" });
      await load();
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Could not send the pulse.", tone: "error" });
    } finally {
      setSending(false);
    }
  }

  // ---- Loading ------------------------------------------------------------
  if (loading) {
    return <Skeleton className="h-44 rounded-2xl" />;
  }

  // ---- Error --------------------------------------------------------------
  if (error) {
    return (
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-navy-700 dark:text-navy-200">Weekly Term Pulse</p>
            <Button variant="ghost" onClick={load}>
              <RefreshCw className="h-4 w-4" /> Retry
            </Button>
          </div>
          <p className="mt-2 text-sm text-red-600">{error}</p>
        </CardContent>
      </Card>
    );
  }

  // ---- Empty (no pulse computed yet) --------------------------------------
  if (!pulse) {
    return (
      <Card>
        <CardContent className="p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="rounded-2xl bg-green-50 p-2.5 dark:bg-green-900/30">
                <Activity className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-navy-900 dark:text-navy-50">Weekly Term Pulse</p>
                <p className="mt-0.5 text-sm text-navy-500 dark:text-navy-400">
                  Your first digest arrives Monday morning — enrolment, attendance and fees vs target.
                </p>
              </div>
            </div>
            <Button onClick={sendNow} disabled={sending}>
              <Send className="h-4 w-4" /> {sending ? "Preparing…" : "Send this week's pulse"}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ---- Populated ----------------------------------------------------------
  const delta = pulse.attendancePct - pulse.attendancePrevPct;
  const DeltaIcon = delta >= 2 ? ArrowUpRight : delta <= -2 ? ArrowDownRight : Minus;
  const deltaTone =
    delta >= 2 ? "text-green-600" : delta <= -2 ? "text-red-600" : "text-navy-400";
  const onTarget = pulse.collectedWeekKes >= pulse.weeklyTargetKes && pulse.weeklyTargetKes > 0;

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-green-50 p-2.5 dark:bg-green-900/30">
              <Activity className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-navy-900 dark:text-navy-50">Weekly Term Pulse</p>
                <Badge tone="neutral">{pulse.weekKey}</Badge>
                {pulse.sentCount > 0 && (
                  <span className="text-xs text-navy-400">sent to {pulse.sentCount}</span>
                )}
              </div>
              <p className="mt-0.5 text-xs text-navy-400">
                Week of {pulse.weekStart} → {pulse.weekEnd}
              </p>
            </div>
          </div>
          <Button variant="ghost" onClick={sendNow} disabled={sending}>
            <Send className="h-4 w-4" /> {sending ? "Sending…" : "Send now"}
          </Button>
        </div>

        {/* The rule-based one-line summary */}
        <p className="mt-4 text-base font-medium leading-relaxed text-navy-800 dark:text-navy-100">
          {pulse.summary}
        </p>

        {/* Three quick numbers */}
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-2xl bg-warm-50 p-3 dark:bg-navy-900/40">
            <p className="text-xs font-medium text-navy-500 dark:text-navy-400">Attendance</p>
            <div className="mt-1 flex items-center gap-1.5">
              <span className="text-2xl font-semibold text-navy-900 dark:text-navy-50">{pulse.attendancePct}%</span>
              <DeltaIcon className={`h-4 w-4 ${deltaTone}`} />
              {pulse.attendanceMarked > 0 && (
                <span className={`text-xs ${deltaTone}`}>
                  {delta > 0 ? "+" : ""}{delta} vs last wk
                </span>
              )}
            </div>
          </div>
          <div className="rounded-2xl bg-warm-50 p-3 dark:bg-navy-900/40">
            <p className="text-xs font-medium text-navy-500 dark:text-navy-400">Fees this week</p>
            <p className="mt-1 text-2xl font-semibold text-navy-900 dark:text-navy-50">{kes(pulse.collectedWeekKes)}</p>
            <p className={`text-xs ${onTarget ? "text-green-600" : "text-amber-600"}`}>
              target {kes(pulse.weeklyTargetKes)}
            </p>
          </div>
          <div className="rounded-2xl bg-warm-50 p-3 dark:bg-navy-900/40">
            <p className="text-xs font-medium text-navy-500 dark:text-navy-400">Enrolment</p>
            <p className="mt-1 text-2xl font-semibold text-navy-900 dark:text-navy-50">{pulse.activeStudents}</p>
            <p className="text-xs text-navy-400">
              {pulse.joinedThisWeek > 0 ? `+${pulse.joinedThisWeek} joined this week` : "no new joiners"}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
