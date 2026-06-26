"use client";

import * as React from "react";
import { BarChart3, GraduationCap, Loader2, TrendingDown, TrendingUp, UserRoundCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

function tone(mean: number): "green" | "amber" | "red" | "neutral" {
  if (mean >= 70) return "green";
  if (mean >= 50) return "amber";
  if (mean > 0) return "red";
  return "neutral";
}

export function ExamAnalyticsClient() {
  const [data, setData] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    fetch("/api/exams/analytics").then((r) => r.json()).then((j) => { if (j.ok) setData(j.data); }).finally(() => setLoading(false));
  }, []);

  if (loading) return <Card><CardContent className="flex items-center gap-2 p-5 text-sm text-navy-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading exam analytics…</CardContent></Card>;
  if (!data || data.summary.results === 0) return <Card><CardContent className="p-6"><EmptyState icon={BarChart3} title="No analytics yet" description="Enter marks across exams and terms to see subject, teacher and learner progress analytics." /></CardContent></Card>;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base"><BarChart3 className="h-5 w-5 text-green-600" /> Multi-term performance analytics</CardTitle>
        <p className="text-xs text-navy-500 dark:text-navy-400">Uses real Exam and ExamResult records to summarize term trends, subject means, teacher-linked subject performance and learner progress.</p>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-3 sm:grid-cols-5">
          {[ ["Exams", data.summary.exams], ["Results", data.summary.results], ["Subjects", data.summary.subjects], ["Terms", data.summary.terms], ["Teachers", data.summary.teachersWithData] ].map(([label, value]) => <div key={label as string} className="rounded-2xl border border-navy-100 bg-white/70 p-3 text-center dark:border-navy-800 dark:bg-navy-950/40"><p className="text-[10px] font-black uppercase tracking-widest text-navy-400">{label}</p><p className="mt-1 text-xl font-black text-navy-950 dark:text-white">{value as any}</p></div>)}
        </div>

        <div className="grid gap-5 xl:grid-cols-3">
          <Panel title="Term trend" icon={TrendingUp}>{data.termTrend.map((t: any) => <Row key={t.termKey} label={t.termKey} value={`${t.mean}%`} badge={`${t.entries} marks`} mean={t.mean} />)}</Panel>
          <Panel title="Subject performance" icon={GraduationCap}>{data.subjectPerformance.slice(0, 8).map((s: any) => <Row key={s.subjectId} label={`${s.name} (${s.code})`} value={`${s.mean}%`} badge={`${s.entries} marks`} mean={s.mean} />)}</Panel>
          <Panel title="Teacher-linked performance" icon={UserRoundCheck}>{data.teacherPerformance.length === 0 ? <p className="text-sm text-navy-400">Assign teachers in class subject needs to see this.</p> : data.teacherPerformance.slice(0, 8).map((t: any) => <Row key={t.teacherId} label={t.teacherName} value={`${t.mean}%`} badge={`${t.entries} marks`} mean={t.mean} />)}</Panel>
        </div>

        <div>
          <p className="mb-3 text-xs font-black uppercase tracking-widest text-navy-400">Learner progress highlights</p>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {data.studentProgress.slice(0, 9).map((s: any) => <div key={s.studentId} className="rounded-2xl border border-navy-100 bg-white/70 p-4 dark:border-navy-800 dark:bg-navy-950/40"><div className="flex items-start justify-between gap-2"><div><p className="font-black text-navy-950 dark:text-white">{s.name}</p><p className="text-xs text-navy-400">{s.admissionNo}</p></div><Badge tone={s.trend === "rising" ? "green" : s.trend === "falling" ? "red" : "neutral"}>{s.trend}</Badge></div><p className="mt-3 text-sm text-navy-600 dark:text-navy-300">Change: <span className={s.delta >= 0 ? "font-black text-green-700" : "font-black text-red-700"}>{s.delta >= 0 ? "+" : ""}{s.delta}%</span></p><p className="mt-1 text-xs text-navy-400">{s.points.map((p: any) => `${p.termKey}: ${p.mean}%`).join(" · ")}</p></div>)}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Panel({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) {
  return <div className="rounded-2xl border border-navy-100 bg-navy-50/35 p-4 dark:border-navy-800 dark:bg-navy-900/35"><p className="mb-3 flex items-center gap-2 text-sm font-black text-navy-900 dark:text-white"><Icon className="h-4 w-4 text-green-600" />{title}</p><div className="space-y-2">{children}</div></div>;
}
function Row({ label, value, badge, mean }: { label: string; value: string; badge: string; mean: number }) {
  return <div className="flex items-center justify-between gap-3 rounded-xl bg-white p-2.5 text-xs dark:bg-navy-950/60"><span className="min-w-0 truncate font-bold text-navy-700 dark:text-navy-200">{label}</span><div className="flex shrink-0 items-center gap-2"><Badge tone={tone(mean)}>{value}</Badge><span className="text-navy-400">{badge}</span></div></div>;
}
