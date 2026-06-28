"use client";

import * as React from "react";
import { useToast } from "@/components/ui/toast";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, ArrowRight, CheckCircle2, Lock } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";

export function StudentPathwayTab({ studentId }: { studentId: string }) {
  const [preferences, setPreferences] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const { toast } = useToast();

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/pathways/preferences?studentId=${studentId}`);
      const json = await res.json();
      if (json.ok) setPreferences(json.data);
    } catch {
      toast({ title: "Failed to load preferences", tone: "error" });
    } finally {
      setLoading(false);
    }
  }, [studentId, toast]);

  React.useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <div className="flex h-40 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-navy-400" /></div>;

  const allocated = preferences.find(p => p.isAllocated);

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-navy-950 dark:text-white">Senior School Pathway</h2>
          <p className="text-sm font-medium text-navy-500">Manage student pathway preferences and final allocations.</p>
        </div>
      </div>

      {allocated ? (
        <Card className="border-green-200 bg-green-50/50 dark:border-green-900/30 dark:bg-green-950/10">
          <CardContent className="p-6 flex items-start gap-4">
            <div className="rounded-full bg-green-100 p-3 dark:bg-green-900/50 text-green-700 dark:text-green-400">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-green-700 dark:text-green-500 mb-1">Final Allocation</p>
              <h3 className="text-2xl font-black text-navy-950 dark:text-white">{allocated.pathway.name}</h3>
              <p className="mt-2 text-sm font-medium text-navy-600 dark:text-navy-300">
                {allocated.teacherNotes || "Allocated based on academic readiness and preference."}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="space-y-4">
        <h3 className="text-sm font-bold text-navy-950 dark:text-white uppercase tracking-widest border-b border-navy-100 pb-2">Stated Preferences</h3>
        {preferences.length === 0 ? (
          <EmptyState
            icon={ArrowRight}
            title="No preferences set"
            description="This student has not yet indicated any pathway preferences."
          />
        ) : (
          <div className="space-y-3">
            {preferences.map(pref => (
              <div key={pref.id} className="flex items-center justify-between p-4 rounded-2xl border border-navy-100 bg-white dark:border-navy-800 dark:bg-navy-950">
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-navy-50 text-navy-600 font-black text-lg dark:bg-navy-900 dark:text-navy-300">
                    {pref.choiceOrder}
                  </div>
                  <div>
                    <h4 className="font-bold text-navy-950 dark:text-white">{pref.pathway.name}</h4>
                    {pref.isRecommended && <Badge variant="secondary" className="mt-1 text-[10px]">Recommended</Badge>}
                  </div>
                </div>
                {!pref.isAllocated && (
                  <Button 
                    variant="outline" size="sm" className="rounded-full text-xs shadow-sm hover:border-green-600 hover:text-green-700 hover:bg-green-50"
                    onClick={async () => {
                      const res = await fetch(`/api/pathways/allocate?studentId=${studentId}`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ pathwayId: pref.pathwayId, isAllocated: true, isRecommended: true, teacherNotes: "Approved by pathway manager." })
                      });
                      if (res.ok) {
                        toast({ title: "Allocated successfully", tone: "success" });
                        void load();
                      } else {
                        toast({ title: "Failed to allocate", tone: "error" });
                      }
                    }}
                  >
                    Allocate to {pref.pathway.code}
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
