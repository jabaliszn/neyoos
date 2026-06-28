"use client";

import * as React from "react";
import { Plus, Trophy, Trash2, Edit2, Loader2, Target, HeartHandshake, Mic, Code, Palette, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

export function TalentManagerClient({ canManage }: { canManage: boolean }) {
  const [areas, setAreas] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [open, setOpen] = React.useState(false);
  const { toast } = useToast();

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/talents");
      const json = await res.json();
      if (json.ok) setAreas(json.data);
    } catch {
      toast({ title: "Failed to load talent areas", tone: "error" });
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
          <h2 className="text-xl font-black text-navy-950 dark:text-white">Talent Tracking & Co-Curricular</h2>
          <p className="text-sm font-medium text-navy-500">Track and evaluate specific student talents (Music, Drama, Coding, Sports).</p>
        </div>
        {canManage && <Button onClick={() => setOpen(true)} className="rounded-full shadow-pop"><Plus className="mr-2 h-4 w-4" /> New Talent Area</Button>}
      </div>

      {areas.length === 0 ? (
        <EmptyState
          icon={Trophy}
          title="No talent areas defined"
          description="Create specific areas like 'Football', 'Public Speaking', or 'Piano'."
          action={canManage ? { label: "Create Talent Area", onClick: () => setOpen(true) } : undefined}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {areas.map((a) => (
            <Card key={a.id} className="relative overflow-hidden group">
              <CardHeader className="pb-3 border-b border-navy-50 dark:border-navy-800">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="rounded-full bg-navy-50 p-2 text-navy-600 dark:bg-navy-900 dark:text-navy-300">
                      {a.category === "SPORTS" ? <Play className="h-5 w-5" /> :
                       a.category === "ARTS" ? <Palette className="h-5 w-5" /> :
                       a.category === "STEM" ? <Code className="h-5 w-5" /> :
                       a.category === "LEADERSHIP" ? <Target className="h-5 w-5" /> :
                       <Trophy className="h-5 w-5" />}
                    </div>
                    <div>
                      <Badge variant="outline" className="mb-1 font-bold text-[9px] uppercase tracking-widest">{a.category}</Badge>
                      <CardTitle className="text-base">{a.name}</CardTitle>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                {a.description && <p className="text-xs text-navy-600 dark:text-navy-300 line-clamp-2">{a.description}</p>}
                <div className="flex items-center justify-between text-xs font-semibold text-navy-500 pt-2 border-t border-navy-50 dark:border-navy-800">
                  <span>{a._count.records} evaluation records</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      
      {open && <TalentAreaEditorDialog onClose={() => setOpen(false)} onDone={() => { setOpen(false); void load(); }} />}
    </div>
  );
}

function TalentAreaEditorDialog({ onClose, onDone }: any) {
  const [name, setName] = React.useState("");
  const [category, setCategory] = React.useState("SPORTS");
  const [desc, setDesc] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const { toast } = useToast();

  async function save() {
    if (!name) return toast({ title: "Name required", tone: "error" });
    setSaving(true);
    try {
      const res = await fetch("/api/talents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, category, description: desc || undefined }),
      });
      const json = await res.json();
      if (json.ok) { toast({ title: "Talent area created", tone: "success" }); onDone(); }
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
        <DialogHeader><DialogTitle>Create Talent Area</DialogTitle></DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-1">
            <Label>Talent Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Football" />
          </div>
          <div className="space-y-1">
            <Label>Category</Label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full h-10 rounded-xl border border-navy-200 bg-white px-3 text-sm">
              <option value="SPORTS">Sports & Athletics</option>
              <option value="ARTS">Creative Arts (Music, Drama)</option>
              <option value="STEM">STEM (Coding, Robotics)</option>
              <option value="LEADERSHIP">Leadership & Debate</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
          <div className="space-y-1">
            <Label>Description</Label>
            <Input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Optional description..." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={saving} className="rounded-full">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Area"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
