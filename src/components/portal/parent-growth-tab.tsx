"use client";

import * as React from "react";
import { Loader2, Target, CheckCircle2, Trophy, BookOpen, Clock, CalendarDays, CalendarCheck, ShieldAlert, FolderOpen, MessageSquareText } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";

type Tone = "neutral" | "green" | "red" | "amber" | "blue";

export function ParentGrowthTab({ studentId }: { studentId: string }) {
  const [data, setData] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(false);
  const { toast } = useToast();

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch(`/api/portal/parent/growth?studentId=${studentId}`);
      const json = await res.json();
      if (json.ok) setData(json.data.data ?? json.data); else setError(true);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  React.useEffect(() => { void load(); }, [load]);

  async function acknowledge(goalId: string) {
    try {
      const res = await fetch("/api/portal/parent/growth", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "acknowledge_goal", goalId }),
      });
      const json = await res.json();
      if (json.ok) { toast({ title: "Goal acknowledged", tone: "success" }); load(); }
      else toast({ title: json.error?.message || "Failed to acknowledge", tone: "error" });
    } catch { toast({ title: "Network error", tone: "error" }); }
  }

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="h-6 w-6 animate-spin text-navy-400" /></div>;
  if (error) return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center dark:border-red-900/40 dark:bg-red-950/20">
      <p className="text-sm text-red-700 dark:text-red-300">Could not load the growth dashboard.</p>
      <Button size="sm" variant="secondary" className="mt-3" onClick={load}>Try again</Button>
    </div>
  );
  if (!data) return null;

  const s = data.summary || {};
  const empty = (data.goals?.length ?? 0) === 0 && (data.talents?.length ?? 0) === 0 && (data.competencies?.length ?? 0) === 0
    && (data.portfolio?.length ?? 0) === 0 && (data.upcomingAssessments?.length ?? 0) === 0 && (data.feedbackDigest?.length ?? 0) === 0
    && (data.attendance?.totalMarked ?? 0) === 0 && (data.behavior?.incidents ?? 0) === 0;

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* Growth not just grades — summary roll-up */}
      <div>
        <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-navy-400">Growth, not just grades</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <SummaryStat label="Attendance" value={s.attendancePct != null ? `${s.attendancePct}%` : "—"} tone={s.attendancePct == null ? "neutral" : s.attendancePct >= 90 ? "green" : s.attendancePct >= 75 ? "amber" : "red"} />
          <SummaryStat label="Active goals" value={s.goalsActive ?? 0} tone="blue" />
          <SummaryStat label="Talents logged" value={s.talentsLogged ?? 0} tone="neutral" />
          <SummaryStat label="Portfolio highlights" value={s.portfolioHighlights ?? 0} tone="neutral" />
          <SummaryStat label="Competencies" value={s.competenciesShown ?? 0} tone="neutral" />
          <SummaryStat label="Goals achieved" value={s.goalsAchieved ?? 0} tone="green" />
          <SummaryStat label="Behavior notes" value={s.behaviorIncidents ?? 0} tone={(s.behaviorIncidents ?? 0) === 0 ? "green" : "amber"} />
          {data.goalAckEnabled && <SummaryStat label="To acknowledge" value={s.goalsToAcknowledge ?? 0} tone={(s.goalsToAcknowledge ?? 0) > 0 ? "amber" : "green"} />}
        </div>
      </div>

      {empty && (
        <div className="rounded-xl border border-navy-100 bg-navy-50/40 p-8 text-center dark:border-navy-800 dark:bg-navy-900/20">
          <p className="text-sm text-navy-500">No growth updates yet. As teachers log goals, competencies, talents and feedback, they will appear here.</p>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {/* Goals */}
        <Card className="border-amber-100 bg-amber-50/30 dark:border-amber-900/30 dark:bg-amber-950/10">
          <CardHeader className="pb-3"><CardTitle className="flex items-center"><Target className="mr-2 h-5 w-5 text-amber-600" /> Current goals</CardTitle></CardHeader>
          <CardContent className="pt-2">
            {(data.goals?.length ?? 0) === 0 ? <Empty text="No goals set by teachers yet." /> : (
              <div className="space-y-3">
                {data.goals.map((g: any) => (
                  <div key={g.id} className="rounded-xl border border-navy-100 bg-white p-3 shadow-sm dark:border-navy-800 dark:bg-navy-950">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <Badge tone="neutral" className="mb-1 text-[9px] uppercase tracking-widest">{g.category}</Badge>
                        <h4 className="text-sm font-bold text-navy-950 dark:text-white">{g.title}</h4>
                      </div>
                      <Badge tone={g.status === "ACHIEVED" ? "green" : g.status === "MISSED" ? "red" : "blue"}>{g.status}</Badge>
                    </div>
                    {g.description && <p className="mt-2 text-xs text-navy-600 dark:text-navy-300">{g.description}</p>}
                    <div className="mt-3 flex items-center justify-between border-t border-navy-50 pt-2 dark:border-navy-800">
                      <span className="text-[10px] text-navy-400">Set by {g.teacher.fullName}{g.targetDate ? ` · by ${g.targetDate}` : ""}</span>
                      {g.acknowledgedByParent ? (
                        <span className="flex items-center text-[10px] font-bold text-green-600"><CheckCircle2 className="mr-1 h-3 w-3" /> Acknowledged</span>
                      ) : data.goalAckEnabled ? (
                        <Button size="sm" variant="secondary" className="h-6 rounded-full text-[10px]" onClick={() => acknowledge(g.id)}>Acknowledge</Button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Attendance */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="flex items-center"><CalendarCheck className="mr-2 h-5 w-5 text-navy-500" /> Attendance (last 60 days)</CardTitle></CardHeader>
          <CardContent className="pt-2">
            {(data.attendance?.totalMarked ?? 0) === 0 ? <Empty text="No attendance marked in this window." /> : (
              <div>
                <div className="mb-3 text-3xl font-black text-navy-950 dark:text-white">{data.attendance.presentPct}%<span className="ml-2 text-xs font-medium text-navy-400">present</span></div>
                <div className="grid grid-cols-4 gap-2 text-center text-xs">
                  <MiniStat label="Present" value={data.attendance.present} />
                  <MiniStat label="Late" value={data.attendance.late} />
                  <MiniStat label="Absent" value={data.attendance.absent} />
                  <MiniStat label="Excused" value={data.attendance.excused} />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Behavior */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="flex items-center"><ShieldAlert className="mr-2 h-5 w-5 text-rose-500" /> Behavior (last 60 days)</CardTitle></CardHeader>
          <CardContent className="pt-2">
            {(data.behavior?.incidents ?? 0) === 0 ? <Empty text="No behavior incidents recorded — well done!" /> : (
              <div>
                <div className="mb-3 flex items-end gap-4">
                  <div><div className="text-2xl font-black text-navy-950 dark:text-white">{data.behavior.incidents}</div><div className="text-[10px] uppercase text-navy-400">incidents</div></div>
                  <div><div className="text-2xl font-black text-rose-600">{data.behavior.demeritPoints}</div><div className="text-[10px] uppercase text-navy-400">demerit pts</div></div>
                </div>
                <div className="space-y-1">
                  {data.behavior.recent.map((i: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between rounded-lg bg-navy-50 px-2 py-1 text-xs dark:bg-navy-900/40">
                      <span>{i.category}</span>
                      <Badge tone={i.severity === "SEVERE" ? "red" : i.severity === "MAJOR" ? "amber" : "neutral"}>{i.severity}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Talents */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="flex items-center"><Trophy className="mr-2 h-5 w-5 text-navy-500" /> Recent talents & activities</CardTitle></CardHeader>
          <CardContent className="pt-2">
            {(data.talents?.length ?? 0) === 0 ? <Empty text="No recent co-curricular logs." /> : (
              <div className="space-y-3">
                {data.talents.map((t: any) => (
                  <div key={t.id} className="flex items-start gap-3 border-b border-navy-50 pb-3 last:border-0 last:pb-0 dark:border-navy-800">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-navy-50 font-black text-navy-600 dark:bg-navy-900">{t.score ?? "-"}</div>
                    <div>
                      <h4 className="text-sm font-bold text-navy-950 dark:text-white">{t.talentArea.name}</h4>
                      {t.notes && <p className="line-clamp-2 text-xs text-navy-600 dark:text-navy-300">{t.notes}</p>}
                      <span className="mt-1 block text-[10px] text-navy-400">Coach: {t.coach.fullName} · {t.date}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Competencies */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="flex items-center"><BookOpen className="mr-2 h-5 w-5 text-purple-500" /> Competency growth</CardTitle></CardHeader>
          <CardContent className="pt-2">
            {(data.competencies?.length ?? 0) === 0 ? <Empty text="No approved competencies shared yet." /> : (
              <div className="space-y-3">
                {data.competencies.map((c: any) => (
                  <div key={c.id} className="rounded-xl bg-navy-50/50 p-3 dark:bg-navy-900/30">
                    <h4 className="text-sm font-bold text-navy-950 dark:text-white">{c.competency.name}</h4>
                    {c.narrative && <p className="mt-1 text-xs text-navy-600 dark:text-navy-300">{c.narrative}</p>}
                    <div className="mt-2 flex items-center justify-between">
                      <Badge tone="blue">{c.level ? `Level ${c.level}` : (c.scorePct != null ? `${c.scorePct}%` : "Noted")}</Badge>
                      <span className="text-[10px] text-navy-400">{new Date(c.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Portfolio highlights */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="flex items-center"><FolderOpen className="mr-2 h-5 w-5 text-emerald-500" /> Portfolio highlights</CardTitle></CardHeader>
          <CardContent className="pt-2">
            {(data.portfolio?.length ?? 0) === 0 ? <Empty text="No approved portfolio items to show yet." /> : (
              <div className="space-y-2">
                {data.portfolio.map((p: any) => (
                  <div key={p.id} className="flex items-center justify-between rounded-xl border border-navy-100 p-3 dark:border-navy-800">
                    <div className="min-w-0">
                      <h4 className="truncate text-sm font-bold text-navy-950 dark:text-white">{p.title}</h4>
                      <Badge tone="neutral" className="mt-1 text-[9px] uppercase">{p.category}</Badge>
                    </div>
                    {(p.fileUrl || p.externalLink) && (
                      <a href={p.fileUrl || p.externalLink} target="_blank" rel="noreferrer" className="ml-2 shrink-0 text-xs font-semibold text-blue-600 hover:underline">View</a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Upcoming assessments */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="flex items-center"><CalendarDays className="mr-2 h-5 w-5 text-blue-500" /> Upcoming assessments</CardTitle></CardHeader>
          <CardContent className="pt-2">
            {(data.upcomingAssessments?.length ?? 0) === 0 ? <Empty text="No upcoming assessments shared." /> : (
              <div className="space-y-3">
                {data.upcomingAssessments.map((a: any) => (
                  <div key={a.id} className="flex items-center gap-3 rounded-xl border border-navy-100 p-3 dark:border-navy-800">
                    <Clock className="h-5 w-5 shrink-0 text-blue-400" />
                    <div>
                      <h4 className="text-sm font-bold text-navy-950 dark:text-white">{a.title}</h4>
                      <p className="text-xs text-navy-500">Due {a.dueDate}{a.maxMarks ? ` · out of ${a.maxMarks}` : ""}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Teacher feedback digest */}
        <Card className="md:col-span-2">
          <CardHeader className="pb-3"><CardTitle className="flex items-center"><MessageSquareText className="mr-2 h-5 w-5 text-navy-500" /> Teacher feedback digest</CardTitle></CardHeader>
          <CardContent className="pt-2">
            {(data.feedbackDigest?.length ?? 0) === 0 ? <Empty text="No feedback shared yet." /> : (
              <div className="space-y-2">
                {data.feedbackDigest.map((f: any, idx: number) => (
                  <div key={idx} className="rounded-xl border border-navy-100 p-3 dark:border-navy-800">
                    <div className="mb-1 flex items-center justify-between">
                      <Badge tone="neutral" className="text-[9px] uppercase">{f.source}</Badge>
                      <span className="text-[10px] text-navy-400">{f.from} · {f.date}</span>
                    </div>
                    <p className="text-xs text-navy-700 dark:text-navy-200">{f.text}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function SummaryStat({ label, value, tone }: { label: string; value: React.ReactNode; tone: Tone }) {
  const ring: Record<Tone, string> = {
    neutral: "border-navy-200 dark:border-navy-700",
    green: "border-green-300 dark:border-green-800",
    red: "border-red-300 dark:border-red-800",
    amber: "border-amber-300 dark:border-amber-800",
    blue: "border-blue-300 dark:border-blue-800",
  };
  return (
    <div className={`rounded-xl border ${ring[tone]} p-3 text-center`}>
      <div className="text-xl font-black text-navy-950 dark:text-white">{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-navy-400">{label}</div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-navy-50 py-2 dark:bg-navy-900/40">
      <div className="font-bold text-navy-950 dark:text-white">{value}</div>
      <div className="text-[9px] uppercase text-navy-400">{label}</div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="text-sm italic text-navy-500">{text}</p>;
}
