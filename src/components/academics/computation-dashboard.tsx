"use client";

import * as React from "react";
import { Loader2, PlayCircle, CheckCircle2, Lock, Unlock, Mail, Bell, Settings2, Calculator } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { Progress } from "@/components/ui/progress";

export function ComputationDashboardClient({ canManage }: { canManage: boolean }) {
  const [portals, setPortals] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const { toast } = useToast();

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/academics/grading/portals");
      const json = await res.json();
      if (json.ok) setPortals(json.data);
    } catch {
      toast({ title: "Failed to load portals", tone: "error" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    void load();
  }, [load]);

  // Poll for progress if computing
  React.useEffect(() => {
    const isComputing = portals.some(p => p.status === "COMPUTING");
    if (!isComputing) return;

    const interval = setInterval(() => {
      fetch("/api/academics/grading/portals").then(r => r.json()).then(j => {
        if (j.ok) setPortals(j.data);
      });
    }, 3000); // Check every 3 seconds

    return () => clearInterval(interval);
  }, [portals]);

  const triggerCompute = async (id: string) => {
    try {
      const res = await fetch("/api/academics/grading/computation", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "COMPUTE", portalId: id })
      });
      if (res.ok) {
        toast({ title: "Computation started", tone: "success" });
        load();
      } else {
        const json = await res.json();
        toast({ title: json.error?.message || "Failed", tone: "error" });
      }
    } catch {
      toast({ title: "Network error", tone: "error" });
    }
  };

  const releaseResults = async (id: string) => {
    if (!confirm("Are you sure? This will send SMS to all parents and lock results.")) return;
    try {
      const res = await fetch("/api/academics/grading/computation", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "RELEASE", portalId: id })
      });
      if (res.ok) {
        toast({ title: "Results Released Successfully!", tone: "success" });
        load();
      } else {
        const json = await res.json();
        toast({ title: json.error?.message || "Failed. You might need Principal privileges.", tone: "error" });
      }
    } catch {
      toast({ title: "Network error", tone: "error" });
    }
  };

  if (loading) return <div className="flex h-40 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-navy-400" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-navy-100 pb-4 dark:border-navy-800">
        <div>
          <h2 className="text-xl font-black text-navy-950 dark:text-white flex items-center gap-2">
            <Calculator className="h-5 w-5 text-blue-600" /> Grading Engine & Result Release
          </h2>
          <p className="text-sm font-medium text-navy-500">Close marks entry, compute weighted averages asynchronously, and blast SMS results to parents.</p>
        </div>
      </div>

      {portals.length === 0 ? (
        <EmptyState
          icon={Settings2}
          title="No Marks Portals Found"
          description="Open a marks portal to allow teachers to enter exam data."
        />
      ) : (
        <div className="space-y-4">
          {portals.map((p) => {
            const isClosed = new Date(p.closeDate) < new Date();
            return (
              <Card key={p.id} className={\`overflow-hidden \${p.status === "COMPUTING" ? "border-blue-300 ring-2 ring-blue-500/20" : ""}\`}>
                <CardContent className="p-0">
                  <div className="p-4 bg-white dark:bg-navy-950 flex justify-between items-center">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant={p.status === "OPEN" ? "outline" : "secondary"} className={p.status === "OPEN" ? "bg-green-50 text-green-700" : ""}>
                          {p.status}
                        </Badge>
                        <span className="text-xs font-semibold text-navy-500">Close Date: {new Date(p.closeDate).toLocaleString()}</span>
                      </div>
                      <h3 className="font-black text-lg text-navy-950 dark:text-white">{p.name}</h3>
                    </div>
                    <div>
                      {p.status === "OPEN" && isClosed && canManage && (
                        <Button onClick={() => triggerCompute(p.id)} className="bg-blue-600 hover:bg-blue-700 rounded-full shadow-pop text-white">
                          <PlayCircle className="h-4 w-4 mr-2" /> Start Computation
                        </Button>
                      )}
                      {p.status === "OPEN" && !isClosed && (
                        <div className="flex items-center text-sm font-bold text-amber-600 bg-amber-50 px-3 py-1.5 rounded-full border border-amber-200">
                          <Unlock className="h-4 w-4 mr-2" /> Marks Entry is Live
                        </div>
                      )}
                      {p.status === "PENDING_RELEASE" && (
                        <Button onClick={() => releaseResults(p.id)} className="bg-green-600 hover:bg-green-700 rounded-full shadow-pop text-white">
                          <Mail className="h-4 w-4 mr-2" /> Joint Release & Send SMS
                        </Button>
                      )}
                      {p.status === "RELEASED" && (
                        <div className="flex items-center text-sm font-bold text-green-700 bg-green-50 px-3 py-1.5 rounded-full border border-green-200">
                          <CheckCircle2 className="h-4 w-4 mr-2" /> Released to Parents
                        </div>
                      )}
                    </div>
                  </div>

                  {p.status === "COMPUTING" && (
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-4 border-t border-blue-100 dark:border-blue-900/50">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-xs font-bold text-blue-700 dark:text-blue-300 flex items-center"><Loader2 className="h-3 w-3 animate-spin mr-1"/> Aggregating Term Results...</span>
                        <span className="text-xs font-black text-blue-700 dark:text-blue-300">{p.computationProgress}%</span>
                      </div>
                      <Progress value={p.computationProgress} className="h-2 bg-blue-200 dark:bg-blue-950" indicatorClassName="bg-blue-600" />
                      <p className="text-[10px] text-blue-500 mt-2 italic">Computing micro-weights (PP1/PP2), macro-weights (CAT+Exam), and mapping CBC rubrics. Please wait.</p>
                    </div>
                  )}

                  {p.status === "PENDING_RELEASE" && (
                    <div className="bg-amber-50 dark:bg-amber-900/20 p-4 border-t border-amber-100 dark:border-amber-900/50 flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm font-medium text-amber-800 dark:text-amber-300">
                        <Bell className="h-4 w-4" /> Computation finished. {p.computationTotalRows} records processed.
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-amber-600 dark:text-amber-400">Awaiting Principal Approval</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
