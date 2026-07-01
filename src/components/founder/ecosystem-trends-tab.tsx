"use client";

import * as React from "react";
import { Loader2, Globe, HeartHandshake, Trees, ShieldCheck, PieChart, Activity } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { Badge } from "@/components/ui/badge";

export function EcosystemTrendsTab() {
  const [data, setData] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const { toast } = useToast();

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/ops/education-trends");
      const json = await res.json();
      if (json.ok) setData(json.data);
    } catch {
      toast({ title: "Failed to load ecosystem trends", tone: "error" });
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
        <h2 className="text-xl font-black text-navy-950 dark:text-white flex items-center gap-2">
          <Globe className="h-5 w-5 text-blue-500" /> NEYO Ecosystem Macro Trends
        </h2>
        <p className="text-sm font-medium text-navy-500">Cross-tenant anonymous aggregate data monitoring the impact of NEYO across Kenya.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Network Scale */}
        <Card className="md:col-span-3 bg-gradient-to-r from-blue-900 to-navy-950 border-0 text-white">
          <CardContent className="p-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-blue-300 text-xs font-bold uppercase tracking-widest">Active Schools</p>
                <p className="text-3xl font-black mt-1">{data.adoption.totalSchools}</p>
              </div>
              <div>
                <p className="text-blue-300 text-xs font-bold uppercase tracking-widest">Active Students</p>
                <p className="text-3xl font-black mt-1">{data.adoption.totalStudents.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-blue-300 text-xs font-bold uppercase tracking-widest">Avg Attendance Rate</p>
                <p className="text-3xl font-black mt-1 text-green-400">{data.attendance.globalAttendanceRate}%</p>
              </div>
              <div>
                <p className="text-blue-300 text-xs font-bold uppercase tracking-widest">Community Service</p>
                <p className="text-3xl font-black mt-1 text-amber-400">{data.coCurricular.globalCommunityServiceHours} <span className="text-lg">hrs</span></p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Global Competency Health */}
        <Card>
          <CardHeader className="pb-3 border-b border-navy-50 dark:border-navy-800">
            <CardTitle className="flex items-center text-navy-950 dark:text-white text-base">
              <PieChart className="mr-2 h-5 w-5 text-purple-500" /> CBC Competency Health
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="space-y-4">
              <div className="flex justify-between items-end">
                <div>
                  <p className="text-2xl font-black text-navy-950 dark:text-white">{data.competencies.totalEvaluations.toLocaleString()}</p>
                  <p className="text-[10px] text-navy-400 font-bold uppercase tracking-widest">Total Evaluations</p>
                </div>
              </div>
              
              <div className="space-y-2">
                <div>
                  <div className="flex justify-between text-xs font-bold text-navy-950 dark:text-white mb-1">
                    <span>Meeting/Exceeding</span>
                    <span className="text-green-600">{data.competencies.meetingPct}%</span>
                  </div>
                  <div className="h-2 w-full bg-navy-50 dark:bg-navy-900 rounded-full overflow-hidden">
                    <div className="h-full bg-green-500 rounded-full" style={{ width: `${data.competencies.meetingPct}%` }} />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-bold text-navy-950 dark:text-white mb-1">
                    <span>Approaching/Below</span>
                    <span className="text-amber-600">{data.competencies.strugglingPct}%</span>
                  </div>
                  <div className="h-2 w-full bg-navy-50 dark:bg-navy-900 rounded-full overflow-hidden">
                    <div className="h-full bg-amber-500 rounded-full" style={{ width: `${data.competencies.strugglingPct}%` }} />
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Most Popular Senior Pathways */}
        <Card>
          <CardHeader className="pb-3 border-b border-navy-50 dark:border-navy-800">
            <CardTitle className="flex items-center text-navy-950 dark:text-white text-base">
              <Activity className="mr-2 h-5 w-5 text-amber-500" /> Popular Senior Pathways
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {data.pathways.length === 0 ? (
              <p className="text-sm italic text-navy-500">No pathway allocations logged.</p>
            ) : (
              <div className="space-y-3">
                {data.pathways.map((p: any, idx: number) => (
                  <div key={idx} className="flex justify-between items-center p-2 bg-navy-50/50 dark:bg-navy-900/30 rounded-lg">
                    <span className="font-bold text-sm text-navy-950 dark:text-white">{p.name}</span>
                    <Badge tone="neutral" className="font-black">{p.count} students</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Co-Curricular Summary */}
        <Card>
          <CardHeader className="pb-3 border-b border-navy-50 dark:border-navy-800">
            <CardTitle className="flex items-center text-navy-950 dark:text-white text-base">
              <HeartHandshake className="mr-2 h-5 w-5 text-green-500" /> Co-Curricular & Talent
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
             <div className="flex items-center gap-4 p-4 rounded-xl border border-navy-100 bg-navy-50/50 dark:border-navy-800 dark:bg-navy-900/30">
               <div className="h-12 w-12 shrink-0 bg-green-100 dark:bg-green-900/50 text-green-600 rounded-full flex items-center justify-center">
                 <Trees className="h-6 w-6" />
               </div>
               <div>
                 <p className="text-sm font-bold text-navy-950 dark:text-white">Community Service</p>
                 <p className="text-xs text-navy-500 mt-0.5">Students across all schools have logged <strong className="text-navy-950 dark:text-white">{data.coCurricular.globalCommunityServiceHours} approved hours</strong> of community and environmental service.</p>
               </div>
             </div>
             
             <div className="flex items-center gap-4 mt-3 p-4 rounded-xl border border-navy-100 bg-navy-50/50 dark:border-navy-800 dark:bg-navy-900/30">
               <div className="h-12 w-12 shrink-0 bg-purple-100 dark:bg-purple-900/50 text-purple-600 rounded-full flex items-center justify-center">
                 <ShieldCheck className="h-6 w-6" />
               </div>
               <div>
                 <p className="text-sm font-bold text-navy-950 dark:text-white">Talent Evaluations</p>
                 <p className="text-xs text-navy-500 mt-0.5">Coaches have recorded <strong className="text-navy-950 dark:text-white">{data.coCurricular.totalTalentRecords} progression notes</strong> across all sports and arts.</p>
               </div>
             </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
