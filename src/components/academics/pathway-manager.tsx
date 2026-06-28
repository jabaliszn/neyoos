"use client";

import * as React from "react";
import { Plus, Settings, Users, BookOpen, Trash2, Edit2, Info, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

export function PathwayManagerClient({ subjects }: { subjects: any[] }) {
  const [pathways, setPathways] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [open, setOpen] = React.useState(false);
  const { toast } = useToast();

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/pathways");
      const json = await res.json();
      if (json.ok) setPathways(json.data);
    } catch {
      toast({ title: "Failed to load pathways", tone: "error" });
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
          <h2 className="text-xl font-black text-navy-950 dark:text-white">Senior School Pathways</h2>
          <p className="text-sm font-medium text-navy-500 dark:text-navy-400">Define academic and career tracks for Senior School students.</p>
        </div>
        <Button onClick={() => setOpen(true)} className="rounded-full shadow-pop"><Plus className="mr-2 h-4 w-4" /> New Pathway</Button>
      </div>

      {pathways.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No pathways defined"
          description="Create your first pathway, like STEM or Creative Arts."
          action={{ label: "Create Pathway", onClick: () => setOpen(true) }}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {pathways.map((p) => (
            <Card key={p.id} className="relative overflow-hidden group">
              <CardHeader className="pb-3 border-b border-navy-50 dark:border-navy-800">
                <div className="flex items-start justify-between">
                  <div>
                    <Badge variant="outline" className="mb-2 font-bold text-xs uppercase tracking-widest">{p.code}</Badge>
                    <CardTitle className="text-lg">{p.name}</CardTitle>
                  </div>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-navy-400 hover:text-navy-950 dark:hover:text-white opacity-0 group-hover:opacity-100 transition-opacity">
                    <Settings className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                {p.description && <p className="text-xs text-navy-600 dark:text-navy-300">{p.description}</p>}
                
                <div className="space-y-2">
                  <div className="flex items-center text-xs font-bold text-navy-500 uppercase tracking-widest">
                    <BookOpen className="mr-1 h-3 w-3" /> Requirements
                  </div>
                  {p.subjectRequirements.length === 0 ? (
                    <p className="text-xs italic text-navy-400">No subject gates defined.</p>
                  ) : (
                    <ul className="space-y-1">
                      {p.subjectRequirements.map((req: any) => (
                        <li key={req.id} className="text-xs flex items-center justify-between bg-navy-50 dark:bg-navy-900 rounded px-2 py-1">
                          <span className="font-semibold">{req.subject.name}</span>
                          <div className="flex items-center gap-2">
                            {req.isCore ? <Badge variant="secondary" className="text-[9px]">CORE</Badge> : <Badge variant="outline" className="text-[9px]">ELECTIVE</Badge>}
                            {req.minScorePct ? <span className="text-green-700 font-bold">≥{req.minScorePct}%</span> : null}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-navy-50 dark:border-navy-800 text-xs font-semibold text-navy-500">
                  <div className="flex items-center gap-1"><Users className="h-3 w-3" /> {p._count.studentPreferences} allocated</div>
                  {p.capacity ? <div>Max {p.capacity}</div> : <div>No limit</div>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      
      {open && <PathwayEditorDialog subjects={subjects} onClose={() => setOpen(false)} onDone={() => { setOpen(false); void load(); }} />}
    </div>
  );
}

function PathwayEditorDialog({ subjects, onClose, onDone }: any) {
  const [name, setName] = React.useState("");
  const [code, setCode] = React.useState("");
  const [desc, setDesc] = React.useState("");
  const [capacity, setCapacity] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const { toast } = useToast();

  async function save() {
    if (!name || !code) return toast({ title: "Name and Code required", tone: "error" });
    setSaving(true);
    try {
      const res = await fetch("/api/pathways", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name, code, description: desc || undefined, capacity: capacity ? parseInt(capacity, 10) : undefined,
          requirements: [] // We'll add requirements builder in UX hardening
        }),
      });
      const json = await res.json();
      if (json.ok) { toast({ title: "Pathway created", tone: "success" }); onDone(); }
      else toast({ title: json.error?.message || "Failed", tone: "error" });
    } catch {
      toast({ title: "Network error", tone: "error" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Create Pathway</DialogTitle></DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-1">
            <Label>Pathway Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. STEM" />
          </div>
          <div className="space-y-1">
            <Label>Short Code</Label>
            <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="e.g. STEM" />
          </div>
          <div className="space-y-1">
            <Label>Description</Label>
            <Input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Science, Tech..." />
          </div>
          <div className="space-y-1">
            <Label>Capacity (Optional)</Label>
            <Input type="number" value={capacity} onChange={(e) => setCapacity(e.target.value)} placeholder="e.g. 40" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={saving} className="rounded-full">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Pathway"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
