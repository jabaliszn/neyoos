"use client";

import * as React from "react";
import { Loader2, TrendingUp, AlertTriangle, Activity, BookOpen, HeartPulse, ShieldAlert, Route } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

export function AdvancedAnalyticsClient() {
  const [data, setData] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const { toast } = useToast();

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/analytics/advanced");
      const json = await res.json();
      if (json.ok) setData(json.data);
      else toast({ title: json.error?.message || "Failed to load advanced analytics", tone: "error" });
    } catch {
      toast({ title: "Failed to load advanced analytics", tone: "error" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  React.useEffect(() => { void load(); }, [load]);

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="h-6 w-6 animate-spin text-navy-400" /></div>;
  if (!data) return <Card><CardContent className="p-6"><EmptyState icon={AlertTriangle} title="Advanced analytics unavailable" description="We could not load the leadership analytics right now." /></CardContent></Card>;

  const gapGroups = [
    { title: "Weak competencies overall", rows: data.competencyGaps.overall },
    { title: "By class", rows: data.competencyGaps.byClass },
    { title: "By grade", rows: data.competencyGaps.byGrade },
    { title: "By subject", rows: data.competencyGaps.bySubject },
    { title: "By teacher", rows: data.competencyGaps.byTeacher },
  ];

  return (
    <div className="space-y-6 animate-in fade-in">
      <div>
        <h2 className="text-xl font-black text-navy-950 dark:text-white">Advanced School Analytics</h2>
        <p className="text-sm font-medium text-navy-500">Cross-module correlation, pathway readiness, wellbeing signals and intervention alerts.</p>
      </div>

      {data.interventions.length > 0 ? (
        <div className="space-y-3">
          <h3 className="text-sm font-bold uppercase tracking-widest text-red-600 dark:text-red-400 flex items-center"><AlertTriangle className="mr-2 h-4 w-4" /> Principal intervention required</h3>
          {data.interventions.map((inv: any, idx: number) => (
            <div key={idx} className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/50 p-4 rounded-2xl flex gap-4 items-start">
              <div className="h-10 w-10 shrink-0 bg-red-100 dark:bg-red-900/50 rounded-full flex items-center justify-center text-red-600 dark:text-red-400"><ShieldAlert className="h-5 w-5" /></div>
              <div>
                <h4 className="font-bold text-red-900 dark:text-red-300">{inv.title}</h4>
                <p className="text-sm text-red-700 dark:text-red-400 mt-1">{inv.description}</p>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-3 border-b border-navy-50 dark:border-navy-800"><CardTitle className="flex items-center text-navy-950 dark:text-white text-base"><TrendingUp className="mr-2 h-5 w-5 text-blue-500" /> Attendance vs performance</CardTitle></CardHeader>
          <CardContent className="pt-4">
            <p className="text-xs text-navy-500 mb-4">Correlation between absence brackets and average exam score.</p>
            <div className="space-y-4">
              {data.attendanceTrend.map((t: any, idx: number) => (
                <div key={idx}>
                  <div className="flex justify-between text-xs font-bold text-navy-950 dark:text-white mb-1"><span>{t.bracket} <span className="font-medium text-navy-400">({t.count} learners)</span></span><span>{t.avgScore}% avg</span></div>
                  <div className="h-2 w-full bg-navy-50 dark:bg-navy-900 rounded-full overflow-hidden"><div className={`${idx === 0 ? "bg-green-500" : idx === 1 ? "bg-amber-500" : "bg-red-500"} h-full rounded-full`} style={{ width: `${t.avgScore}%` }} /></div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3 border-b border-navy-50 dark:border-navy-800"><CardTitle className="flex items-center text-navy-950 dark:text-white text-base"><Activity className="mr-2 h-5 w-5 text-purple-500" /> Assessment balance</CardTitle></CardHeader>
          <CardContent className="pt-4 space-y-3">
            {data.assessmentBalance.map((a: any, idx: number) => (
              <div key={idx} className="flex items-center justify-between p-3 rounded-xl border border-navy-100 bg-navy-50/50 dark:border-navy-800 dark:bg-navy-900/30">
                <span className="font-bold text-sm text-navy-950 dark:text-white">{a.label}</span>
                <Badge tone={a.color === "amber" ? "amber" : a.color === "blue" ? "blue" : "neutral"}>{a.value}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3 border-b border-navy-50 dark:border-navy-800"><CardTitle className="flex items-center text-navy-950 dark:text-white text-base"><HeartPulse className="mr-2 h-5 w-5 text-green-500" /> Talent and wellbeing indicators</CardTitle></CardHeader>
          <CardContent className="pt-4 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Stat label="Talent participation" value={`${data.wellbeingIndicators.participationPct}%`} />
              <Stat label="Medical profiles" value={String(data.wellbeingIndicators.medicalProfiles)} />
              <Stat label="Counseling notes" value={String(data.wellbeingIndicators.counselingNotes)} />
              <Stat label="Clinic visits" value={String(data.wellbeingIndicators.clinicVisits)} />
            </div>
            <div>
              <p className="text-xs text-navy-500 mb-3">Top participation areas</p>
              <div className="space-y-2">
                {data.talentParticipation.length === 0 ? <p className="text-sm italic text-navy-400">No talent records yet.</p> : data.talentParticipation.map((t: any, idx: number) => (
                  <div key={idx} className="flex justify-between items-center p-2 rounded hover:bg-navy-50 dark:hover:bg-navy-900/50"><div><h4 className="text-sm font-bold text-navy-950 dark:text-white">{t.name}</h4><span className="text-[10px] text-navy-400 uppercase tracking-widest">{t.category}</span></div><Badge tone="green">{t.count} records</Badge></div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3 border-b border-navy-50 dark:border-navy-800"><CardTitle className="flex items-center text-navy-950 dark:text-white text-base"><Route className="mr-2 h-5 w-5 text-indigo-500" /> Pathway readiness snapshot</CardTitle></CardHeader>
          <CardContent className="pt-4 space-y-3">
            {data.pathwayReadiness.length === 0 ? <p className="text-sm italic text-navy-400">No pathway allocations yet.</p> : data.pathwayReadiness.slice(0, 6).map((p: any, idx: number) => (
              <div key={idx} className="flex items-center justify-between p-3 rounded-xl border border-navy-100 bg-white dark:border-navy-800 dark:bg-navy-950/40">
                <div>
                  <p className="font-bold text-sm text-navy-950 dark:text-white">{p.pathwayName} ({p.pathwayCode})</p>
                  <p className="text-xs text-navy-500">Allocated: {p.allocatedCount}{p.capacity != null ? ` / ${p.capacity}` : ""}</p>
                </div>
                <Badge tone={p.fillPct != null && p.fillPct >= 80 ? "amber" : "blue"}>{p.fillPct != null ? `${p.fillPct}% full` : "Open"}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
        {gapGroups.map((group) => (
          <Card key={group.title}>
            <CardHeader className="pb-3 border-b border-navy-50 dark:border-navy-800"><CardTitle className="flex items-center text-navy-950 dark:text-white text-base"><BookOpen className="mr-2 h-5 w-5 text-amber-500" /> {group.title}</CardTitle></CardHeader>
            <CardContent className="pt-4">
              {group.rows.length === 0 ? <p className="text-sm italic text-green-600">No weak signals detected.</p> : <div className="space-y-3">{group.rows.map((g: any, idx: number) => <div key={idx} className="flex justify-between items-start border-b border-navy-50 dark:border-navy-800 pb-2 last:border-0 last:pb-0"><span className="text-sm font-semibold text-navy-950 dark:text-white">{g.name || g.label}</span><Badge tone="red">{g.count} flags</Badge></div>)}</div>}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border border-navy-100 bg-white/70 p-3 dark:border-navy-800 dark:bg-navy-950/40"><p className="text-[10px] font-black uppercase tracking-widest text-navy-400">{label}</p><p className="mt-1 text-xl font-black text-navy-950 dark:text-white">{value}</p></div>;
}
