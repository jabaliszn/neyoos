"use client";

import * as React from "react";
import { useToast } from "@/components/ui/toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, ArrowRight, CheckCircle2, Plus, X, GraduationCap, Sparkles, FolderOpen } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

type Readiness = {
  pathwayId: string;
  pathwayName: string;
  pathwayCode: string;
  capacity: number | null;
  allocatedCount: number;
  seatsLeft: number | null;
  isChoice: boolean;
  choiceOrder: number | null;
  isAllocated: boolean;
  isRecommended: boolean;
  requirementsMet: number;
  requirementsTotal: number;
  academicReadinessPct: number;
  talentEvidenceCount: number;
  portfolioEvidenceCount: number;
  overallReadiness: "READY" | "ALMOST" | "DEVELOPING" | "NO_DATA";
  subjects: { subjectName: string; isCore: boolean; minScorePct: number | null; studentAvgPct: number | null; met: boolean }[];
};

const READINESS_TONE: Record<string, string> = {
  READY: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400",
  ALMOST: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
  DEVELOPING: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400",
  NO_DATA: "bg-navy-100 text-navy-600 dark:bg-navy-900 dark:text-navy-300",
};
const READINESS_LABEL: Record<string, string> = {
  READY: "Ready", ALMOST: "Almost there", DEVELOPING: "Developing", NO_DATA: "No marks yet",
};

export function StudentPathwayTab({ studentId }: { studentId: string }) {
  const [preferences, setPreferences] = React.useState<any[]>([]);
  const [readiness, setReadiness] = React.useState<Readiness[]>([]);
  const [pathways, setPathways] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [editing, setEditing] = React.useState(false);
  const { toast } = useToast();

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const [prefRes, readyRes, pathRes] = await Promise.all([
        fetch(`/api/pathways/preferences?studentId=${studentId}`),
        fetch(`/api/pathways/readiness?studentId=${studentId}`),
        fetch(`/api/pathways`),
      ]);
      const [prefJson, readyJson, pathJson] = await Promise.all([prefRes.json(), readyRes.json(), pathRes.json()]);
      if (prefJson.ok) setPreferences(prefJson.data);
      if (readyJson.ok) setReadiness(readyJson.data.pathways);
      if (pathJson.ok) setPathways(pathJson.data);
    } catch {
      toast({ title: "Failed to load pathway data", tone: "error" });
    } finally {
      setLoading(false);
    }
  }, [studentId, toast]);

  React.useEffect(() => { void load(); }, [load]);

  if (loading) return <div className="flex h-40 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-navy-400" /></div>;

  const allocated = preferences.find((p) => p.isAllocated);

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-navy-950 dark:text-white">Senior School Pathway</h2>
          <p className="text-sm font-medium text-navy-500">Set this learner's pathway choices, see readiness, and confirm the final allocation.</p>
        </div>
        <Button variant="secondary" className="rounded-full" onClick={() => setEditing(true)}>
          <Plus className="mr-2 h-4 w-4" /> Set preferences
        </Button>
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

      {/* Readiness */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-navy-950 dark:text-white uppercase tracking-widest border-b border-navy-100 pb-2">Pathway readiness</h3>
        {readiness.length === 0 ? (
          <EmptyState icon={GraduationCap} title="No pathways yet" description="Create pathways under Academics to see this learner's readiness." />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {readiness.map((r) => (
              <div key={r.pathwayId} className="rounded-2xl border border-navy-100 bg-white p-4 dark:border-navy-800 dark:bg-navy-950">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-navy-950 dark:text-white">{r.pathwayName}</h4>
                    <div className="mt-1 flex flex-wrap items-center gap-1">
                      {r.isChoice && <Badge tone="neutral" className="text-[9px]">Choice #{r.choiceOrder}</Badge>}
                      {r.isRecommended && <Badge tone="green" className="text-[9px]">Recommended</Badge>}
                      {r.capacity != null && <Badge tone="neutral" className="text-[9px]">{r.allocatedCount}/{r.capacity}{r.seatsLeft === 0 ? " · Full" : ""}</Badge>}
                    </div>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-[10px] font-bold ${READINESS_TONE[r.overallReadiness]}`}>
                    {READINESS_LABEL[r.overallReadiness]}
                  </span>
                </div>

                {r.requirementsTotal > 0 && (
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-[11px] font-semibold text-navy-500">
                      <span>{r.requirementsMet}/{r.requirementsTotal} subject gates met</span>
                      <span>{r.academicReadinessPct}%</span>
                    </div>
                    <div className="mt-1 h-1.5 w-full rounded-full bg-navy-100 dark:bg-navy-800">
                      <div className="h-1.5 rounded-full bg-green-500" style={{ width: `${r.academicReadinessPct}%` }} />
                    </div>
                    <ul className="mt-2 space-y-1">
                      {r.subjects.map((s, i) => (
                        <li key={i} className="flex items-center justify-between text-[11px]">
                          <span className="text-navy-600 dark:text-navy-300">{s.subjectName}{s.isCore ? " (core)" : ""}</span>
                          <span className={s.met ? "font-bold text-green-700" : "text-navy-400"}>
                            {s.studentAvgPct == null ? "no marks" : `${s.studentAvgPct}%`}{s.minScorePct != null ? ` / ≥${s.minScorePct}%` : ""}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="mt-3 flex items-center gap-4 text-[11px] text-navy-500">
                  <span className="flex items-center gap-1"><Sparkles className="h-3 w-3" /> {r.talentEvidenceCount} talent records</span>
                  <span className="flex items-center gap-1"><FolderOpen className="h-3 w-3" /> {r.portfolioEvidenceCount} portfolio items</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Stated preferences + allocate */}
      <div className="space-y-4">
        <h3 className="text-sm font-bold text-navy-950 dark:text-white uppercase tracking-widest border-b border-navy-100 pb-2">Stated preferences</h3>
        {preferences.length === 0 ? (
          <EmptyState icon={ArrowRight} title="No preferences set" description="Use “Set preferences” above to record this learner's ranked pathway choices." />
        ) : (
          <div className="space-y-3">
            {preferences.map((pref) => (
              <div key={pref.id} className="flex items-center justify-between p-4 rounded-2xl border border-navy-100 bg-white dark:border-navy-800 dark:bg-navy-950">
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-navy-50 text-navy-600 font-black text-lg dark:bg-navy-900 dark:text-navy-300">
                    {pref.choiceOrder}
                  </div>
                  <div>
                    <h4 className="font-bold text-navy-950 dark:text-white">{pref.pathway.name}</h4>
                    {pref.isRecommended && <Badge tone="green" className="mt-1 text-[10px]">Recommended</Badge>}
                  </div>
                </div>
                {!pref.isAllocated && (
                  <Button
                    variant="secondary" size="sm" className="rounded-full text-xs shadow-sm hover:border-green-600 hover:text-green-700 hover:bg-green-50"
                    onClick={async () => {
                      const res = await fetch(`/api/pathways/allocate?studentId=${studentId}`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ pathwayId: pref.pathwayId, isAllocated: true, isRecommended: true, teacherNotes: "Approved by pathway manager." })
                      });
                      const json = await res.json().catch(() => ({}));
                      if (res.ok) { toast({ title: "Allocated successfully", tone: "success" }); void load(); }
                      else toast({ title: json.error?.message || "Failed to allocate", tone: "error" });
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

      {editing && (
        <SetPreferencesDialog
          studentId={studentId}
          pathways={pathways}
          existing={preferences}
          onClose={() => setEditing(false)}
          onDone={() => { setEditing(false); void load(); }}
        />
      )}
    </div>
  );
}

function SetPreferencesDialog({ studentId, pathways, existing, onClose, onDone }: any) {
  const { toast } = useToast();
  const [saving, setSaving] = React.useState(false);
  const [choices, setChoices] = React.useState<string[]>(() => {
    const allocatable = existing.filter((p: any) => !p.isAllocated).sort((a: any, b: any) => a.choiceOrder - b.choiceOrder);
    return allocatable.length ? allocatable.map((p: any) => p.pathwayId) : [];
  });

  function addChoice() {
    const next = pathways.find((p: any) => !choices.includes(p.id));
    if (!next) return toast({ title: "All pathways already added", tone: "error" });
    setChoices((prev) => [...prev, next.id]);
  }
  function setChoice(i: number, id: string) {
    setChoices((prev) => prev.map((c, idx) => (idx === i ? id : c)));
  }
  function removeChoice(i: number) {
    setChoices((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function save() {
    if (new Set(choices).size !== choices.length) return toast({ title: "Each pathway can only be chosen once", tone: "error" });
    setSaving(true);
    try {
      const res = await fetch(`/api/pathways/preferences?studentId=${studentId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferences: choices.map((id, idx) => ({ pathwayId: id, choiceOrder: idx + 1 })) }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.ok) { toast({ title: "Preferences saved", tone: "success" }); onDone(); }
      else toast({ title: json.error?.message || "Could not save preferences", tone: "error" });
    } catch {
      toast({ title: "Network error", tone: "error" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Set pathway preferences</DialogTitle></DialogHeader>
        <div className="space-y-3 py-4">
          <p className="text-xs text-navy-500">Rank the learner's choices. #1 is their first choice. You can rank up to 5.</p>
          {choices.length === 0 ? (
            <p className="text-xs italic text-navy-400">No choices yet — add a pathway below.</p>
          ) : (
            choices.map((id, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-navy-50 font-bold text-navy-600 dark:bg-navy-900 dark:text-navy-300">{i + 1}</span>
                <select
                  className="flex-1 rounded-lg border border-navy-200 bg-white px-2 py-1.5 text-sm dark:border-navy-700 dark:bg-navy-950"
                  value={id}
                  onChange={(e) => setChoice(i, e.target.value)}
                >
                  {pathways.map((p: any) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <Button type="button" variant="ghost" size="sm" className="h-8 w-8 text-navy-400 hover:text-red-600" onClick={() => removeChoice(i)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))
          )}
          {choices.length < 5 && pathways.length > choices.length && (
            <Button type="button" variant="secondary" size="sm" className="rounded-full text-xs" onClick={addChoice}>
              <Plus className="mr-1 h-3 w-3" /> Add choice
            </Button>
          )}
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={saving} className="rounded-full">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save preferences"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
