"use client";

import * as React from "react";
import { Loader2, Plus, BookOpen, Users, CheckCircle2, Lock } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { EmptyState } from "@/components/ui/empty-state";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

export function SubjectSelectionManager({ subjects }: { subjects: any[] }) {
  const [portals, setPortals] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [open, setOpen] = React.useState(false);
  const [reportPortalId, setReportPortalId] = React.useState<string | null>(null);
  const { toast } = useToast();

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/academics/subject-selection");
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

  if (loading) return <div className="flex h-40 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-navy-400" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-navy-950 dark:text-white flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-indigo-600" /> Subject Selection (Electives)
          </h2>
          <p className="text-sm font-medium text-navy-500">Configure portals for students to select their optional subjects from home.</p>
        </div>
        <Button onClick={() => setOpen(true)} className="rounded-full shadow-pop bg-indigo-600 hover:bg-indigo-700 text-white">
          <Plus className="mr-2 h-4 w-4" /> Open Selection Portal
        </Button>
      </div>

      {portals.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No Active Selection Portals"
          description="Open a portal for Form 3 or Grade 9 students to pick their subjects."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {portals.map(p => {
            const rules = JSON.parse(p.rulesJson);
            const isClosed = new Date(p.closeDate) < new Date() || p.status !== "OPEN";
            
            return (
              <Card key={p.id}>
                <CardContent className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <Badge variant={isClosed ? "secondary" : "outline"} className={isClosed ? "bg-amber-100 text-amber-800" : "bg-green-50 text-green-700 border-green-200"}>
                      {isClosed ? "CLOSED" : "ACTIVE"}
                    </Badge>
                    <span className="text-[10px] font-bold uppercase text-navy-400">Target: {p.targetLevel}</span>
                  </div>
                  <h3 className="font-bold text-lg text-navy-950 dark:text-white">{p.name}</h3>
                  <div className="text-xs text-navy-500 mt-2 space-y-1 bg-navy-50 dark:bg-navy-900/50 p-2 rounded-xl border border-navy-100 dark:border-navy-800">
                    <p><strong>Compulsory:</strong> {rules.compulsorySubjectIds?.length || 0} subjects</p>
                    <p><strong>Electives allowed:</strong> {rules.minElectives} to {rules.maxElectives}</p>
                    <p><strong>Close Date:</strong> {new Date(p.closeDate).toLocaleString()}</p>
                  </div>
                  <div className="flex justify-between items-center mt-4 pt-3 border-t border-navy-50 dark:border-navy-800">
                    <div className="flex items-center gap-1 text-xs font-semibold text-navy-500">
                      <Users className="h-4 w-4" /> {p._count.selections} Responses
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setReportPortalId(p.id)} className="h-8 text-xs rounded-full">
                      View Report
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {open && <CreatePortalDialog subjects={subjects} onClose={() => setOpen(false)} onDone={() => { setOpen(false); void load(); }} />}
      {reportPortalId && <SelectionReportDialog portalId={reportPortalId} onClose={() => setReportPortalId(null)} />}
    </div>
  );
}

function CreatePortalDialog({ subjects, onClose, onDone }: any) {
  const [name, setName] = React.useState("");
  const [level, setLevel] = React.useState("");
  const [closeDate, setCloseDate] = React.useState("");
  const [minElectives, setMin] = React.useState(2);
  const [maxElectives, setMax] = React.useState(3);
  const [compulsory, setCompulsory] = React.useState<Set<string>>(new Set());
  const [electives, setElectives] = React.useState<Set<string>>(new Set());
  
  const [saving, setSaving] = React.useState(false);
  const { toast } = useToast();

  async function save() {
    if (!name || !level || !closeDate) return toast({ title: "Fill required fields", tone: "error" });
    setSaving(true);
    try {
      const res = await fetch("/api/academics/subject-selection", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name, targetLevel: level,
          openDate: new Date(),
          closeDate: new Date(closeDate),
          rules: {
            minElectives, maxElectives,
            compulsorySubjectIds: Array.from(compulsory),
            electiveSubjectIds: Array.from(electives)
          }
        })
      });
      const json = await res.json();
      if (json.ok) { toast({ title: "Portal Opened", tone: "success" }); onDone(); }
      else toast({ title: json.error?.message || "Failed", tone: "error" });
    } finally { setSaving(false); }
  }

  function toggle(id: string, isCompulsory: boolean) {
    if (isCompulsory) {
      const next = new Set(compulsory);
      if (next.has(id)) next.delete(id); else { next.add(id); electives.delete(id); setElectives(new Set(electives)); }
      setCompulsory(next);
    } else {
      const next = new Set(electives);
      if (next.has(id)) next.delete(id); else { next.add(id); compulsory.delete(id); setCompulsory(new Set(compulsory)); }
      setElectives(next);
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader><DialogTitle>Open Subject Selection Portal</DialogTitle></DialogHeader>
        <div className="flex-1 overflow-y-auto space-y-4 py-2 pr-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1"><Label>Portal Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Form 3 Subject Choices" /></div>
            <div className="space-y-1"><Label>Target Class Level</Label><Input value={level} onChange={(e) => setLevel(e.target.value)} placeholder="e.g. Form 3" /></div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1"><Label>Close Date</Label><Input type="datetime-local" value={closeDate} onChange={(e) => setCloseDate(e.target.value)} /></div>
            <div className="space-y-1"><Label>Min Electives</Label><Input type="number" value={minElectives} onChange={(e) => setMin(Number(e.target.value))} /></div>
            <div className="space-y-1"><Label>Max Electives</Label><Input type="number" value={maxElectives} onChange={(e) => setMax(Number(e.target.value))} /></div>
          </div>
          
          <div className="space-y-2 mt-4 border-t border-navy-100 pt-4 dark:border-navy-800">
            <Label className="font-bold text-navy-950 dark:text-white">Subject Pool Configuration</Label>
            <p className="text-xs text-navy-500 mb-2">Define which subjects are mandatory (all students get them) and which are optional electives.</p>
            
            <div className="grid sm:grid-cols-2 gap-2">
              {subjects.map((s: any) => {
                const isC = compulsory.has(s.id);
                const isE = electives.has(s.id);
                return (
                  <div key={s.id} className="flex items-center justify-between p-2 border border-navy-100 rounded-lg dark:border-navy-800 bg-navy-50/30 dark:bg-navy-900/10">
                    <span className="text-xs font-semibold">{s.name} ({s.code})</span>
                    <div className="flex items-center gap-1">
                      <Button size="sm" variant={isC ? "default" : "outline"} className={\`h-6 text-[10px] px-2 \${isC ? "bg-red-600 hover:bg-red-700" : ""}\`} onClick={() => toggle(s.id, true)}>Compulsory</Button>
                      <Button size="sm" variant={isE ? "default" : "outline"} className={\`h-6 text-[10px] px-2 \${isE ? "bg-green-600 hover:bg-green-700" : ""}\`} onClick={() => toggle(s.id, false)}>Elective</Button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
        <DialogFooter className="mt-4 pt-4 border-t border-navy-100 dark:border-navy-800">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-full">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Publish Portal"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SelectionReportDialog({ portalId, onClose }: any) {
  const [data, setData] = React.useState<any>(null);
  
  React.useEffect(() => {
    fetch(\`/api/academics/subject-selection?portalId=\${portalId}\`)
      .then(r => r.json())
      .then(j => { if (j.ok) setData(j.data); });
  }, [portalId]);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader><DialogTitle>Subject Selection Report</DialogTitle></DialogHeader>
        {!data ? <div className="p-6 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto"/></div> : (
          <div className="flex-1 overflow-y-auto space-y-6 py-4">
            <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-900/50 p-4 rounded-xl">
              <h3 className="font-bold text-indigo-900 dark:text-indigo-300 mb-2">Subject Popularity Tally</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {Object.entries(data.tally).filter(([_, v]) => (v as number) > 0).map(([sub, count]) => (
                  <div key={sub} className="bg-white dark:bg-navy-950 p-2 rounded-lg text-center border border-navy-100 dark:border-navy-800 shadow-sm">
                    <div className="text-2xl font-black text-navy-950 dark:text-white">{count as number}</div>
                    <div className="text-[10px] uppercase font-bold text-navy-500 truncate">{sub}</div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="font-bold text-navy-950 dark:text-white mb-2">Student Responses</h3>
              <table className="w-full text-xs text-left">
                <thead className="bg-navy-50 dark:bg-navy-900">
                  <tr>
                    <th className="p-2 border border-navy-100 dark:border-navy-800">Student Name</th>
                    <th className="p-2 border border-navy-100 dark:border-navy-800 w-24">Adm No</th>
                    <th className="p-2 border border-navy-100 dark:border-navy-800">Selected Electives</th>
                  </tr>
                </thead>
                <tbody>
                  {data.studentSelections.map((s: any, idx: number) => (
                    <tr key={idx} className="border-b border-navy-100 dark:border-navy-800">
                      <td className="p-2 font-bold">{s.studentName}</td>
                      <td className="p-2 text-navy-500">{s.admissionNo}</td>
                      <td className="p-2">
                        <div className="flex flex-wrap gap-1">
                          {s.subjects.map((sub: string) => <Badge key={sub} variant="outline" className="text-[9px]">{sub}</Badge>)}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
