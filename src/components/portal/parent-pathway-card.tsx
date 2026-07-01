"use client";

import * as React from "react";
import { Loader2, GraduationCap, CheckCircle2 } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const READINESS_TONE: Record<string, string> = {
  READY: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400",
  ALMOST: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
  DEVELOPING: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400",
  NO_DATA: "bg-navy-100 text-navy-600 dark:bg-navy-900 dark:text-navy-300",
};
const READINESS_LABEL: Record<string, string> = {
  READY: "Ready", ALMOST: "Almost there", DEVELOPING: "Developing", NO_DATA: "No marks yet",
};

export function ParentPathwayCard({ studentId }: { studentId: string }) {
  const [data, setData] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch(`/api/portal/parent/pathway?studentId=${studentId}`);
      const json = await res.json();
      if (json.ok) setData(json.data);
      else setError(true);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  React.useEffect(() => { void load(); }, [load]);

  // Hide the card entirely if there are no pathways configured (keeps portal clean).
  if (!loading && !error && data && data.pathways.length === 0) return null;

  const allocated = data?.pathways.find((p: any) => p.isAllocated);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <GraduationCap className="h-4 w-4 text-navy-400" /> Senior School Pathway readiness
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex h-24 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-navy-400" /></div>
        ) : error ? (
          <div className="text-sm text-navy-500">Couldn&apos;t load pathway readiness. <button onClick={load} className="font-medium underline">Retry</button></div>
        ) : (
          <div className="space-y-3">
            {allocated && (
              <div className="flex items-center gap-3 rounded-2xl border border-green-200 bg-green-50/60 p-3 dark:border-green-900/30 dark:bg-green-950/10">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-green-700">Confirmed pathway</p>
                  <p className="font-bold text-navy-950 dark:text-white">{allocated.pathwayName}</p>
                </div>
              </div>
            )}
            <p className="text-xs text-navy-500">This shows how ready your child is for each Senior School pathway, based on their results and growth so far.</p>
            <div className="space-y-2">
              {data.pathways.map((p: any) => (
                <div key={p.pathwayCode} className="rounded-2xl border border-navy-100 p-3 dark:border-navy-800">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-wrap items-center gap-1">
                      <span className="font-bold text-navy-950 dark:text-white">{p.pathwayName}</span>
                      {p.isChoice && <Badge variant="outline" className="text-[9px]">Choice #{p.choiceOrder}</Badge>}
                      {p.isRecommended && <Badge variant="secondary" className="text-[9px]">Recommended</Badge>}
                    </div>
                    <span className={`rounded-full px-3 py-1 text-[10px] font-bold ${READINESS_TONE[p.readiness]}`}>
                      {READINESS_LABEL[p.readiness]}
                    </span>
                  </div>
                  {p.requirementsTotal > 0 && (
                    <div className="mt-2">
                      <div className="h-1.5 w-full rounded-full bg-navy-100 dark:bg-navy-800">
                        <div className="h-1.5 rounded-full bg-green-500" style={{ width: `${p.academicReadinessPct}%` }} />
                      </div>
                      <p className="mt-1 text-[11px] text-navy-500">{p.requirementsMet} of {p.requirementsTotal} subject targets met</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
