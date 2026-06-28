"use client";

import * as React from "react";
import { Loader2, TrendingUp, AlertTriangle, Activity, BookOpen, UserMinus, ShieldAlert } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { Badge } from "@/components/ui/badge";

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
    } catch {
      toast({ title: "Failed to load advanced analytics", tone: "error" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="h-6 w-6 animate-spin text-navy-400" /></div>;
  if (!data) return null;

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="mb-4">
        <h2 className="text-xl font-black text-navy-950 dark:text-white">Advanced School Analytics</h2>
        <p className="text-sm font-medium text-navy-500">Cross-module correlation and systemic intervention alerts.</p>
      </div>

      {data.interventions.length > 0 && (
        <div className="space-y-3 mb-6">
          <h3 className="text-sm font-bold uppercase tracking-widest text-red-600 dark:text-red-400 flex items-center"><AlertTriangle className="mr-2 h-4 w-4" /> Principal Intervention Required</h3>
          {data.interventions.map((inv: any, idx: number) => (
            <div key={idx} className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/50 p-4 rounded-2xl flex gap-4 items-start">
              <div className="h-10 w-10 shrink-0 bg-red-100 dark:bg-red-900/50 rounded-full flex items-center justify-center text-red-600 dark:text-red-400">
                <ShieldAlert className="h-5 w-5" />
              </div>
              <div>
                <h4 className="font-bold text-red-900 dark:text-red-300">{inv.title}</h4>
                <p className="text-sm text-red-700 dark:text-red-400 mt-1">{inv.description}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {/* Attendance vs Performance */}
        <Card>
          <CardHeader className="pb-3 border-b border-navy-50 dark:border-navy-800">
            <CardTitle className="flex items-center text-navy-950 dark:text-white text-base">
              <TrendingUp className="mr-2 h-5 w-5 text-blue-500" /> Attendance vs Performance
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <p className="text-xs text-navy-500 mb-4">Correlation between number of absences and average exam score.</p>
            <div className="space-y-4">
              {data.attendanceTrend.map((t: any, idx: number) => (
                <div key={idx}>
                  <div className="flex justify-between text-xs font-bold text-navy-950 dark:text-white mb-1">
                    <span>{t.bracket} <span className="font-medium text-navy-400">({t.count} students)</span></span>
                    <span>{t.avgScore}% avg</span>
                  </div>
                  <div className="h-2 w-full bg-navy-50 dark:bg-navy-900 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full ${idx === 0 ? 'bg-green-500' : idx === 1 ? 'bg-amber-500' : 'bg-red-500'}`} 
                      style={{ width: `${t.avgScore}%` }} 
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Assessment Balance */}
        <Card>
          <CardHeader className="pb-3 border-b border-navy-50 dark:border-navy-800">
            <CardTitle className="flex items-center text-navy-950 dark:text-white text-base">
              <Activity className="mr-2 h-5 w-5 text-purple-500" /> Assessment Balance
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 flex flex-col justify-center">
            <p className="text-xs text-navy-500 mb-4">Distribution of evaluation methods across the school.</p>
            <div className="space-y-3">
              {data.assessmentBalance.map((a: any, idx: number) => (
                <div key={idx} className="flex items-center justify-between p-3 rounded-xl border border-navy-100 bg-navy-50/50 dark:border-navy-800 dark:bg-navy-900/30">
                  <div className="flex items-center gap-3">
                    <div className={`h-3 w-3 rounded-full bg-${a.color}-500`} />
                    <span className="font-bold text-sm text-navy-950 dark:text-white">{a.label}</span>
                  </div>
                  <span className="font-black text-lg text-navy-950 dark:text-white">{a.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Competency Gaps */}
        <Card>
          <CardHeader className="pb-3 border-b border-navy-50 dark:border-navy-800">
            <CardTitle className="flex items-center text-navy-950 dark:text-white text-base">
              <BookOpen className="mr-2 h-5 w-5 text-amber-500" /> Competency Gaps
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <p className="text-xs text-navy-500 mb-4">CBC competencies with the highest number of 'Below Expectations' or 'Approaching Expectations' evaluations.</p>
            {data.competencyGaps.length === 0 ? (
              <p className="text-sm italic text-green-600">No systemic competency gaps detected.</p>
            ) : (
              <div className="space-y-3">
                {data.competencyGaps.map((g: any, idx: number) => (
                  <div key={idx} className="flex justify-between items-start border-b border-navy-50 dark:border-navy-800 pb-2 last:border-0 last:pb-0">
                    <span className="text-sm font-semibold text-navy-950 dark:text-white">{g.name}</span>
                    <Badge variant="destructive" className="ml-4 shrink-0">{g.count} flags</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Talent Participation */}
        <Card>
          <CardHeader className="pb-3 border-b border-navy-50 dark:border-navy-800">
            <CardTitle className="flex items-center text-navy-950 dark:text-white text-base">
              <UserMinus className="mr-2 h-5 w-5 text-green-500" /> Top Talent Participation
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <p className="text-xs text-navy-500 mb-4">Most active co-curricular and talent areas.</p>
            {data.talentParticipation.length === 0 ? (
              <p className="text-sm italic text-navy-400">No talent records yet.</p>
            ) : (
              <div className="space-y-3">
                {data.talentParticipation.map((t: any, idx: number) => (
                  <div key={idx} className="flex justify-between items-center p-2 rounded hover:bg-navy-50 dark:hover:bg-navy-900/50">
                    <div>
                      <h4 className="text-sm font-bold text-navy-950 dark:text-white">{t.name}</h4>
                      <span className="text-[10px] text-navy-400 uppercase tracking-widest">{t.category}</span>
                    </div>
                    <span className="font-black text-navy-950 dark:text-white bg-navy-100 dark:bg-navy-800 px-3 py-1 rounded-full">{t.count} students</span>
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
