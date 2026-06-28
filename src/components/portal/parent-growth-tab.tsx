"use client";

import * as React from "react";
import { Loader2, Target, CheckCircle2, Circle, Trophy, BookOpen, Clock, CalendarDays } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";

export function ParentGrowthTab({ studentId }: { studentId: string }) {
  const [data, setData] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const { toast } = useToast();

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/portal/parent/growth?studentId=${studentId}`);
      const json = await res.json();
      if (json.ok) setData(json.data);
    } catch {
      toast({ title: "Failed to load growth data", tone: "error" });
    } finally {
      setLoading(false);
    }
  }, [studentId, toast]);

  React.useEffect(() => {
    void load();
  }, [load]);

  async function acknowledge(goalId: string) {
    try {
      const res = await fetch("/api/portal/parent/growth", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "acknowledge_goal", goalId })
      });
      if (res.ok) {
        toast({ title: "Goal acknowledged", tone: "success" });
        load();
      } else {
        toast({ title: "Failed to acknowledge", tone: "error" });
      }
    } catch {
      toast({ title: "Network error", tone: "error" });
    }
  }

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="h-6 w-6 animate-spin text-navy-400" /></div>;
  if (!data) return null;

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="grid gap-6 md:grid-cols-2">
        {/* Goals & Collaborative Targets */}
        <Card className="border-amber-100 bg-amber-50/30 dark:border-amber-900/30 dark:bg-amber-950/10">
          <CardHeader className="pb-3 border-b border-amber-100 dark:border-amber-900/30">
            <CardTitle className="flex items-center text-amber-950 dark:text-amber-100">
              <Target className="mr-2 h-5 w-5 text-amber-600" /> Current Goals
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {data.goals.length === 0 ? (
              <p className="text-sm italic text-navy-500">No active goals set by teachers yet.</p>
            ) : (
              <div className="space-y-3">
                {data.goals.map((g: any) => (
                  <div key={g.id} className="bg-white dark:bg-navy-950 p-3 rounded-xl border border-navy-100 dark:border-navy-800 shadow-sm">
                    <div className="flex justify-between items-start">
                      <div>
                        <Badge variant="outline" className="mb-1 text-[9px] uppercase tracking-widest">{g.category}</Badge>
                        <h4 className="font-bold text-navy-950 dark:text-white text-sm">{g.title}</h4>
                      </div>
                      <Badge variant={g.status === "ACHIEVED" ? "secondary" : "outline"} className={g.status === "ACHIEVED" ? "bg-green-100 text-green-800" : ""}>
                        {g.status}
                      </Badge>
                    </div>
                    {g.description && <p className="text-xs text-navy-600 dark:text-navy-300 mt-2">{g.description}</p>}
                    <div className="flex items-center justify-between mt-3 pt-2 border-t border-navy-50 dark:border-navy-800">
                      <span className="text-[10px] text-navy-400">Set by {g.teacher.fullName}</span>
                      {g.acknowledgedByParent ? (
                        <span className="flex items-center text-[10px] font-bold text-green-600"><CheckCircle2 className="h-3 w-3 mr-1"/> Acknowledged</span>
                      ) : (
                        <Button size="sm" variant="outline" className="h-6 text-[10px] rounded-full" onClick={() => acknowledge(g.id)}>
                          Acknowledge
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Talents & Co-curricular */}
        <Card>
          <CardHeader className="pb-3 border-b border-navy-50 dark:border-navy-800">
            <CardTitle className="flex items-center">
              <Trophy className="mr-2 h-5 w-5 text-navy-500" /> Recent Talents & Activities
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {data.talents.length === 0 ? (
              <p className="text-sm italic text-navy-500">No recent co-curricular logs.</p>
            ) : (
              <div className="space-y-3">
                {data.talents.map((t: any) => (
                  <div key={t.id} className="flex gap-3 items-start border-b border-navy-50 dark:border-navy-800 pb-3 last:border-0 last:pb-0">
                    <div className="h-10 w-10 shrink-0 bg-navy-50 dark:bg-navy-900 rounded-full flex items-center justify-center font-black text-navy-600">
                      {t.score || "-"}
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-navy-950 dark:text-white">{t.talentArea.name}</h4>
                      <p className="text-xs text-navy-600 dark:text-navy-300 line-clamp-2">{t.notes}</p>
                      <span className="text-[10px] text-navy-400 mt-1 block">Coach: {t.coach.fullName}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Competencies */}
        <Card>
          <CardHeader className="pb-3 border-b border-navy-50 dark:border-navy-800">
            <CardTitle className="flex items-center">
              <BookOpen className="mr-2 h-5 w-5 text-purple-500" /> Competency Growth
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {data.competencies.length === 0 ? (
              <p className="text-sm italic text-navy-500">No recent competencies published.</p>
            ) : (
              <div className="space-y-3">
                {data.competencies.map((c: any) => (
                  <div key={c.id} className="p-3 bg-navy-50/50 dark:bg-navy-900/30 rounded-xl">
                    <h4 className="font-bold text-sm text-navy-950 dark:text-white">{c.competency.name}</h4>
                    <p className="text-xs text-navy-600 dark:text-navy-300 mt-1">{c.narrative}</p>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-[10px] font-semibold text-purple-600 bg-purple-100 px-2 py-0.5 rounded uppercase">{c.level ? `Level ${c.level}` : (c.scorePct ? `${c.scorePct}%` : 'Noted')}</span>
                      <span className="text-[10px] text-navy-400">{new Date(c.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Upcoming Assessments */}
        <Card>
          <CardHeader className="pb-3 border-b border-navy-50 dark:border-navy-800">
            <CardTitle className="flex items-center">
              <CalendarDays className="mr-2 h-5 w-5 text-blue-500" /> Upcoming Projects & Assessments
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {data.upcomingAssessments.length === 0 ? (
              <p className="text-sm italic text-navy-500">No upcoming major projects found.</p>
            ) : (
              <div className="space-y-3">
                {data.upcomingAssessments.map((a: any) => (
                  <div key={a.id} className="flex gap-3 items-center p-3 border border-navy-100 rounded-xl dark:border-navy-800">
                    <Clock className="h-5 w-5 text-blue-400 shrink-0" />
                    <div>
                      <h4 className="font-bold text-sm text-navy-950 dark:text-white">{a.title}</h4>
                      <p className="text-xs text-navy-500">Max Score: {a.maxScore || a.maxMarks || 100}</p>
                    </div>
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
