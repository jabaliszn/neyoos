"use client";

import * as React from "react";
import { useToast } from "@/components/ui/toast";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Trophy, FileText } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

export function StudentTalentTab({ studentId }: { studentId: string }) {
  const [records, setRecords] = React.useState<any[]>([]);
  const [areas, setAreas] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [open, setOpen] = React.useState(false);
  const { toast } = useToast();

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const [recRes, areasRes] = await Promise.all([
        fetch(`/api/talents/records?studentId=${studentId}`),
        fetch("/api/talents")
      ]);
      const [recJson, areasJson] = await Promise.all([recRes.json(), areasRes.json()]);
      if (recJson.ok) setRecords(recJson.data);
      if (areasJson.ok) setAreas(areasJson.data);
    } catch {
      toast({ title: "Failed to load talent tracking", tone: "error" });
    } finally {
      setLoading(false);
    }
  }, [studentId, toast]);

  React.useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <div className="flex h-40 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-navy-400" /></div>;

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-navy-950 dark:text-white">Talent Tracking</h2>
          <p className="text-sm font-medium text-navy-500">Coach evaluations, club activity links, and co-curricular progression records.</p>
        </div>
        <Button onClick={() => setOpen(true)} className="rounded-full shadow-pop"><Plus className="mr-2 h-4 w-4" /> Add Record</Button>
      </div>

      {records.length === 0 ? (
        <EmptyState
          icon={Trophy}
          title="No talent records"
          description="This student has no evaluations for sports, arts, or other talents."
        />
      ) : (
        <div className="space-y-4">
          {records.map(record => (
            <div key={record.id} className="flex flex-col md:flex-row gap-4 p-4 rounded-2xl border border-navy-100 bg-white dark:border-navy-800 dark:bg-navy-950">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Badge tone="neutral" className="text-[10px]">{record.talentArea.category}</Badge>
                  <span className="text-xs font-semibold text-navy-500">{new Date(record.dateRecorded).toLocaleDateString()}</span>
                </div>
                <h4 className="font-bold text-lg text-navy-950 dark:text-white">{record.talentArea.name}</h4>
                <p className="text-sm text-navy-600 dark:text-navy-300 mt-2">{record.notes}</p>
                <div className="flex items-center gap-2 mt-4 text-xs font-medium text-navy-500">
                  <span className="bg-navy-50 dark:bg-navy-900 px-2 py-1 rounded">Evaluator: {record.coach.fullName}</span>
                  {record.portfolioItemId && <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded flex items-center gap-1"><FileText className="h-3 w-3"/> Has Evidence</span>}
                </div>
              </div>
              {record.score && (
                <div className="shrink-0 flex items-center justify-center h-16 w-16 rounded-full border-4 border-green-500 text-green-700 font-black text-xl bg-green-50">
                  {record.score}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {open && <AddTalentRecordDialog studentId={studentId} areas={areas} onClose={() => setOpen(false)} onDone={() => { setOpen(false); void load(); }} />}
    </div>
  );
}

function AddTalentRecordDialog({ studentId, areas, onClose, onDone }: any) {
  const [areaId, setAreaId] = React.useState("");
  const [score, setScore] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [portfolioItemId, setPortfolioItemId] = React.useState("");
  const [portfolioItems, setPortfolioItems] = React.useState<any[]>([]);
  const [saving, setSaving] = React.useState(false);
  const { toast } = useToast();

  React.useEffect(() => {
    // Load this learner's portfolio items so the coach can link evidence.
    fetch(`/api/portfolio?studentId=${studentId}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.ok && json.data?.timeline?.items) setPortfolioItems(json.data.timeline.items);
      })
      .catch(() => {});
  }, [studentId]);

  async function save() {
    if (!areaId) return toast({ title: "Please select a talent area", tone: "error" });
    setSaving(true);
    try {
      const res = await fetch("/api/talents/records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId,
          talentAreaId: areaId,
          score: score ? parseInt(score, 10) : undefined,
          notes: notes || undefined,
          portfolioItemId: portfolioItemId || undefined,
        }),
      });
      const json = await res.json();
      if (json.ok) { toast({ title: "Record added — also added to Skills Passport", tone: "success" }); onDone(); }
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
        <DialogHeader><DialogTitle>Add Talent Record</DialogTitle></DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-1">
            <Label>Talent Area</Label>
            <select value={areaId} onChange={(e) => setAreaId(e.target.value)} className="w-full h-10 rounded-xl border border-navy-200 bg-white px-3 text-sm dark:border-navy-700 dark:bg-navy-950">
              <option value="">Select...</option>
              {areas.map((a: any) => <option key={a.id} value={a.id}>{a.name} ({a.category})</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <Label>Score (0-100) — Optional</Label>
            <Input type="number" value={score} onChange={(e) => setScore(e.target.value)} placeholder="e.g. 85" min={1} max={100} />
          </div>
          <div className="space-y-1">
            <Label>Coach/Teacher Notes</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Progress observations..." />
          </div>
          <div className="space-y-1">
            <Label>Link portfolio evidence — Optional</Label>
            <select value={portfolioItemId} onChange={(e) => setPortfolioItemId(e.target.value)} className="w-full h-10 rounded-xl border border-navy-200 bg-white px-3 text-sm dark:border-navy-700 dark:bg-navy-950">
              <option value="">No evidence linked</option>
              {portfolioItems.map((it: any) => <option key={it.id} value={it.id}>{it.title} ({it.category})</option>)}
            </select>
            <p className="text-[11px] text-navy-400">This record is also added to the learner's Skills Passport.</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={saving} className="rounded-full">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Record"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
