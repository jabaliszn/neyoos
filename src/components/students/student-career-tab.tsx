"use client";

import * as React from "react";
import { Loader2, Plus, Compass, GraduationCap, Users, Trash2, Sparkles } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

export function StudentCareerTab({ studentId }: { studentId: string }) {
  const [records, setRecords] = React.useState<any[]>([]);
  const [profile, setProfile] = React.useState<any | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [open, setOpen] = React.useState(false);
  const { toast } = useToast();

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const [recordsRes, profileRes] = await Promise.all([
        fetch(`/api/students/careers?studentId=${studentId}`),
        fetch(`/api/students/careers?studentId=${studentId}&view=profile`),
      ]);
      const recordsJson = await recordsRes.json();
      const profileJson = await profileRes.json();
      if (recordsJson.ok) setRecords(recordsJson.data || []);
      if (profileJson.ok) setProfile(profileJson.data);
    } catch {
      toast({ title: "Failed to load career records", tone: "error" });
    } finally {
      setLoading(false);
    }
  }, [studentId, toast]);

  React.useEffect(() => { void load(); }, [load]);

  async function remove(id: string) {
    if (!confirm("Delete this career record?")) return;
    try {
      const res = await fetch(`/api/students/careers?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        toast({ title: "Record deleted", tone: "success" });
        void load();
      } else toast({ title: "Failed to delete", tone: "error" });
    } catch {
      toast({ title: "Network error", tone: "error" });
    }
  }

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="h-6 w-6 animate-spin text-navy-400" /></div>;

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="flex items-center justify-between border-b border-navy-100 pb-4 dark:border-navy-800">
        <div>
          <h2 className="text-xl font-black text-navy-950 dark:text-white flex items-center gap-2"><Compass className="h-5 w-5 text-amber-600" /> Career Discovery & Pathway Guidance</h2>
          <p className="text-sm font-medium text-navy-500">Track interests, recommendations, parent conversations and rule-based career matches without Bundi.</p>
        </div>
        <Button onClick={() => setOpen(true)} className="rounded-full shadow-pop bg-amber-600 hover:bg-amber-700 text-white"><Plus className="mr-2 h-4 w-4" /> Log Conversation</Button>
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-amber-500" /> Rule-based career matches</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {!profile || profile.recommendations.length === 0 ? <p className="text-sm text-navy-500">No strong rule-based matches yet. Add interests, recommendations, talent records and more academic evidence.</p> : profile.recommendations.map((r: any, idx: number) => (
            <div key={idx} className="rounded-2xl border border-navy-100 bg-white/70 p-4 dark:border-navy-800 dark:bg-navy-950/40">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-black text-navy-950 dark:text-white">{r.area}</p>
                  <p className="text-xs text-navy-500">Reasons: {r.reasons.join(" · ") || "Signals are still building."}</p>
                </div>
                <Badge tone={r.confidence === "HIGH" ? "green" : r.confidence === "MEDIUM" ? "amber" : "neutral"}>{r.confidence}</Badge>
              </div>
            </div>
          ))}
          {profile ? <p className="text-[11px] uppercase tracking-widest text-navy-400">Mode: {profile.mode}</p> : null}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Signals used for guidance</CardTitle></CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div>
              <p className="text-xs uppercase tracking-widest text-navy-400">Top academic signals</p>
              <div className="mt-2 flex flex-wrap gap-2">{profile?.signals?.subjectAverages?.slice(0, 6).map((s: any) => <Badge key={s.subjectId} tone="blue">{s.code} {s.avgPct}%</Badge>)}</div>
            </div>
            <div>
              <p className="text-xs uppercase tracking-widest text-navy-400">Competency signals</p>
              <div className="mt-2 flex flex-wrap gap-2">{profile?.signals?.competencies?.slice(0, 6).map((c: any, idx: number) => <Badge key={idx} tone="green">{c.name}</Badge>)}</div>
            </div>
            <div>
              <p className="text-xs uppercase tracking-widest text-navy-400">Talent signals</p>
              <div className="mt-2 flex flex-wrap gap-2">{profile?.signals?.talents?.slice(0, 6).map((t: any, idx: number) => <Badge key={idx} tone="amber">{t.name}</Badge>)}</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Parent/student conversation view</CardTitle></CardHeader>
          <CardContent>
            {records.filter((r) => r.recordType === "PARENT_CONVERSATION").length === 0 ? <p className="text-sm text-navy-500">No parent/student conversations logged yet.</p> : <div className="space-y-3">{records.filter((r) => r.recordType === "PARENT_CONVERSATION").map((r) => <div key={r.id} className="rounded-2xl border border-navy-100 bg-white/70 p-4 dark:border-navy-800 dark:bg-navy-950/40"><p className="font-bold text-navy-950 dark:text-white">{r.careerArea || "Career conversation"}</p><p className="mt-1 text-sm text-navy-600 dark:text-navy-300">{r.notes}</p></div>)}</div>}
          </CardContent>
        </Card>
      </div>

      {records.length === 0 ? (
        <EmptyState icon={Compass} title="No career guidance records" description="Start with a student interest or a teacher recommendation to build the career guidance profile." />
      ) : (
        <div className="space-y-4 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-navy-100 dark:before:via-navy-800 before:to-transparent">
          {records.map((r: any) => (
            <div key={r.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group">
              <div className={`flex items-center justify-center w-10 h-10 rounded-full border-4 border-white dark:border-navy-950 shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow-sm z-10 ${r.recordType === 'STUDENT_INTEREST' ? 'bg-blue-100 text-blue-600' : r.recordType === 'TEACHER_RECOMMENDATION' ? 'bg-amber-100 text-amber-600' : 'bg-green-100 text-green-600'}`}>
                {r.recordType === 'STUDENT_INTEREST' ? <GraduationCap className="h-4 w-4" /> : r.recordType === 'TEACHER_RECOMMENDATION' ? <Compass className="h-4 w-4" /> : <Users className="h-4 w-4" />}
              </div>
              <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-2xl border border-navy-100 bg-white shadow-sm dark:border-navy-800 dark:bg-navy-950">
                <div className="flex justify-between items-start mb-2">
                  <Badge tone="neutral" className="text-[9px] uppercase">{r.recordType.replace(/_/g, " ")}</Badge>
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-navy-400 hover:text-red-500" onClick={() => remove(r.id)}><Trash2 className="h-3 w-3" /></Button>
                </div>
                {r.careerArea ? <h4 className="font-bold text-navy-950 dark:text-white">{r.careerArea}</h4> : null}
                <p className="text-sm text-navy-600 dark:text-navy-300 mt-1">{r.notes}</p>
                <div className="flex items-center justify-between mt-3 text-[10px] text-navy-400 font-semibold border-t border-navy-50 dark:border-navy-900 pt-2"><span>Logged by: {r.recordedByName}</span><span>{new Date(r.createdAt).toLocaleDateString()}</span></div>
              </div>
            </div>
          ))}
        </div>
      )}

      {open ? <CareerLogDialog studentId={studentId} onClose={() => setOpen(false)} onDone={() => { setOpen(false); void load(); }} /> : null}
    </div>
  );
}

function CareerLogDialog({ studentId, onClose, onDone }: any) {
  const [type, setType] = React.useState("STUDENT_INTEREST");
  const [area, setArea] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const { toast } = useToast();
  const CAREER_AREAS = ["Engineering & Technology", "Medicine & Healthcare", "Agriculture & Environmental", "Business & Economics", "ICT & Computer Science", "Creative Arts & Design", "Sports & Athletics", "Education & Training", "Law & Public Service", "Other"];

  async function save() {
    if (!notes) return toast({ title: "Notes are required", tone: "error" });
    setSaving(true);
    try {
      const res = await fetch("/api/students/careers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ studentId, recordType: type, careerArea: area || undefined, notes }) });
      const json = await res.json();
      if (json.ok) { toast({ title: "Career record logged", tone: "success" }); onDone(); }
      else toast({ title: json.error?.message || "Failed", tone: "error" });
    } catch {
      toast({ title: "Network error", tone: "error" });
    } finally { setSaving(false); }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Log Career Discovery</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1"><Label>Log Type</Label><select value={type} onChange={(e) => setType(e.target.value)} className="w-full h-10 rounded-xl border border-navy-200 bg-white px-3 text-sm"><option value="STUDENT_INTEREST">Student Stated Interest</option><option value="TEACHER_RECOMMENDATION">Teacher/Counselor Recommendation</option><option value="PARENT_CONVERSATION">Parent-Student Conversation Note</option></select></div>
          <div className="space-y-1"><Label>Career Area (Optional)</Label><select value={area} onChange={(e) => setArea(e.target.value)} className="w-full h-10 rounded-xl border border-navy-200 bg-white px-3 text-sm"><option value="">Select broad area...</option>{CAREER_AREAS.map((a) => <option key={a} value={a}>{a}</option>)}</select></div>
          <div className="space-y-1"><Label>Narrative / Notes</Label><Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Reasoning, strengths, or details..." /></div>
        </div>
        <DialogFooter><Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button><Button onClick={save} disabled={saving} className="bg-amber-600 hover:bg-amber-700 text-white rounded-full">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Record"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
