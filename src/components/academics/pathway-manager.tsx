"use client";

import * as React from "react";
import { Plus, Settings, Users, BookOpen, Trash2, Loader2, Download, X, Sparkles, GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

type ReqDraft = { subjectId: string; isCore: boolean; minScorePct: string };

const PATHWAY_GROUP_OPTIONS: { value: "STEM" | "SOCIAL_SCIENCES" | "ARTS_SPORTS"; label: string }[] = [
  { value: "STEM", label: "STEM" },
  { value: "SOCIAL_SCIENCES", label: "Social Sciences" },
  { value: "ARTS_SPORTS", label: "Arts & Sports Science" },
];

/** P.1 — Senior School pathway type (Triple/Dual) + official KICD taxonomy loader. */
function PathwaySchoolConfigCard({ onOfficialLoaded }: { onOfficialLoaded: () => void }) {
  const { toast } = useToast();
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(false);
  const [pathwaySchoolType, setPathwaySchoolType] = React.useState<"NONE" | "TRIPLE" | "DUAL">("NONE");
  const [enabledGroups, setEnabledGroups] = React.useState<string[]>([]);
  const [saving, setSaving] = React.useState(false);
  const [seeding, setSeeding] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch("/api/pathways/school-config");
      const json = await res.json();
      if (json.ok) {
        setPathwaySchoolType(json.data.pathwaySchoolType);
        setEnabledGroups(json.data.enabledPathwayGroups);
      } else {
        setError(true);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { void load(); }, [load]);

  function toggleGroup(g: string) {
    setEnabledGroups((prev) => (prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]));
  }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/pathways/school-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pathwaySchoolType, enabledPathwayGroups: enabledGroups }),
      });
      const json = await res.json();
      if (json.ok) {
        toast({ title: "Pathway school type saved", tone: "success" });
      } else {
        toast({ title: json.error?.message || "Could not save.", tone: "error" });
      }
    } catch {
      toast({ title: "Network error", tone: "error" });
    } finally {
      setSaving(false);
    }
  }

  async function loadOfficial() {
    if (enabledGroups.length === 0) {
      toast({ title: "Select at least one pathway group first.", tone: "error" });
      return;
    }
    setSeeding(true);
    try {
      const res = await fetch("/api/pathways/seed-official", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groups: enabledGroups }),
      });
      const json = await res.json();
      if (json.ok) {
        const mathNote = (json.data.mathVariantsApplied || [])
          .map((m: any) => `${m.group === "STEM" ? "STEM" : m.group === "SOCIAL_SCIENCES" ? "Social Sciences" : "Arts & Sports"} → ${m.variant === "CORE" ? "Core" : "Essential"} Mathematics`)
          .join(", ");
        const cslNote = json.data.communityServiceLearning
          ? `Community Service Learning attached to every pathway (${json.data.communityServiceLearning.strandsCreated} new / ${json.data.communityServiceLearning.strandsMatched} matched grading strands).`
          : "";
        toast({
          title: `Loaded official pathways: ${json.data.pathwaysCreated} created, ${json.data.pathwaysUpdated} updated`,
          description: `${json.data.subjectsCreated} new subjects, ${json.data.subjectsMatched} matched to existing subjects.${mathNote ? ` Mathematics attached compulsorily: ${mathNote}.` : ""} ${cslNote}`,
          tone: "success",
        });
        onOfficialLoaded();
      } else {
        toast({ title: json.error?.message || "Could not load official pathways.", tone: "error" });
      }
    } catch {
      toast({ title: "Network error", tone: "error" });
    } finally {
      setSeeding(false);
    }
  }

  if (loading) {
    return <Card><CardContent className="flex h-24 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-navy-400" /></CardContent></Card>;
  }
  if (error) {
    return (
      <Card>
        <CardContent className="flex items-center justify-between p-4 text-sm text-red-600 dark:text-red-400">
          Couldn&apos;t load pathway school type. <Button size="sm" variant="secondary" onClick={load}>Retry</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-green-100 dark:border-green-900/40">
      <CardHeader className="pb-3 border-b border-navy-50 dark:border-navy-800">
        <CardTitle className="flex items-center gap-2 text-base">
          <GraduationCap className="h-4.5 w-4.5 text-green-600" /> Senior School Pathway Type (KICD, CBE 2026)
        </CardTitle>
        <p className="text-xs text-navy-500 dark:text-navy-400">
          Declare whether this school is a Triple Pathway school (offers all 3 official pathways) or a Dual Pathway school (STEM + exactly one other), then load the real KICD subject lists.
        </p>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        <div className="grid grid-cols-3 gap-2">
          {(["NONE", "TRIPLE", "DUAL"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => {
                setPathwaySchoolType(t);
                if (t === "TRIPLE") setEnabledGroups(["STEM", "SOCIAL_SCIENCES", "ARTS_SPORTS"]);
                if (t === "NONE") setEnabledGroups([]);
              }}
              className={`rounded-2xl border p-3 text-center text-xs font-bold transition ${
                pathwaySchoolType === t
                  ? "border-green-500 bg-green-500/10 text-navy-950 dark:text-white"
                  : "border-navy-100 bg-white hover:bg-navy-50 text-navy-600 dark:border-navy-800 dark:bg-navy-950"
              }`}
            >
              {t === "NONE" ? "Not configured" : t === "TRIPLE" ? "Triple Pathway" : "Dual Pathway"}
            </button>
          ))}
        </div>

        {pathwaySchoolType !== "NONE" && (
          <div className="space-y-2">
            <Label>{pathwaySchoolType === "TRIPLE" ? "All 3 official pathways (Triple)" : "Choose exactly 2, including STEM (Dual)"}</Label>
            <div className="grid grid-cols-3 gap-2">
              {PATHWAY_GROUP_OPTIONS.map((g) => (
                <button
                  key={g.value}
                  type="button"
                  disabled={pathwaySchoolType === "TRIPLE"}
                  onClick={() => toggleGroup(g.value)}
                  className={`rounded-xl border p-2.5 text-center text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-70 ${
                    enabledGroups.includes(g.value)
                      ? "border-green-500 bg-green-500/10 text-navy-950 dark:text-white"
                      : "border-navy-100 bg-white hover:bg-navy-50 text-navy-600 dark:border-navy-800 dark:bg-navy-950"
                  }`}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-navy-50 dark:border-navy-800">
          <Button onClick={save} disabled={saving} size="sm" className="rounded-full">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save pathway type"}
          </Button>
          {pathwaySchoolType !== "NONE" && (
            <Button onClick={loadOfficial} disabled={seeding} variant="secondary" size="sm" className="rounded-full">
              {seeding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="mr-1.5 h-3.5 w-3.5" />}
              Load official KICD pathways &amp; subjects
            </Button>
          )}
        </div>
        <p className="text-[11px] italic text-navy-400">
          Loading official pathways creates real subjects (e.g. Physics, Chemistry, Business Studies) and one Pathway per official track — it reuses any subject you already have by code, never duplicates. Safe to run again after changing your groups. Mathematics is attached compulsorily per pathway: STEM learners get Core Mathematics, Social Sciences and Arts &amp; Sports Science learners get Essential Mathematics — one real, separately-taught subject each, per Kenya&apos;s 2026 CBE rules. Community Service Learning is attached compulsorily to every pathway, graded on the standard CBE rubric.
        </p>
      </CardContent>
    </Card>
  );
}

export function PathwayManagerClient({ subjects }: { subjects: any[] }) {
  const [pathways, setPathways] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [open, setOpen] = React.useState(false);
  const [reporting, setReporting] = React.useState(false);
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

  async function downloadReport() {
    setReporting(true);
    try {
      const res = await fetch("/api/pathways/report?format=pdf", { cache: "no-store" });
      if (!res.ok) {
        toast({ title: "Could not generate report", tone: "error" });
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "Senior-School-Pathway-Report.pdf";
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: "Check your connection and try again.", tone: "error" });
    } finally {
      setReporting(false);
    }
  }

  if (loading) return <div className="flex h-40 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-navy-400" /></div>;

  return (
    <div className="space-y-6">
      <PathwaySchoolConfigCard onOfficialLoaded={() => void load()} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-navy-950 dark:text-white">Senior School Pathways</h2>
          <p className="text-sm font-medium text-navy-500 dark:text-navy-400">Define academic and career tracks for Senior School students.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={downloadReport} disabled={reporting || pathways.length === 0} className="rounded-full">
            {reporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />} Pathway report
          </Button>
          <Button onClick={() => setOpen(true)} className="rounded-full shadow-pop"><Plus className="mr-2 h-4 w-4" /> New Pathway</Button>
        </div>
      </div>

      {pathways.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No pathways defined"
          description="Load the official KICD pathways above, or create your own custom pathway and set the subject requirements students need to join."
          primaryAction={{ label: "Create Pathway", onClick: () => setOpen(true) }}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {pathways.map((p) => {
            const allocated = p._count.studentPreferences;
            const full = p.capacity != null && allocated >= p.capacity;
            return (
              <Card key={p.id} className="relative overflow-hidden group">
                <CardHeader className="pb-3 border-b border-navy-50 dark:border-navy-800">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="mb-2 flex flex-wrap items-center gap-1.5">
                        <Badge tone="neutral" className="font-bold text-xs uppercase tracking-widest">{p.code}</Badge>
                        {p.isOfficial && <Badge tone="green" className="text-[9px]">OFFICIAL KICD</Badge>}
                      </div>
                      <CardTitle className="text-lg">{p.name}</CardTitle>
                      {p.trackName && <p className="mt-0.5 text-[11px] font-semibold text-navy-400">{p.pathwayGroup ? PATHWAY_GROUP_OPTIONS.find((g) => g.value === p.pathwayGroup)?.label : null} track</p>}
                    </div>
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
                              {req.isCore ? <Badge tone="green" className="text-[9px]">CORE</Badge> : <Badge tone="neutral" className="text-[9px]">ELECTIVE</Badge>}
                              {req.minScorePct ? <span className="text-green-700 font-bold">≥{req.minScorePct}%</span> : null}
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-navy-50 dark:border-navy-800 text-xs font-semibold text-navy-500">
                    <div className="flex items-center gap-1"><Users className="h-3 w-3" /> {allocated} allocated</div>
                    {p.capacity ? (
                      <div className={full ? "text-red-600 font-bold" : ""}>{allocated}/{p.capacity}{full ? " · Full" : ""}</div>
                    ) : <div>No limit</div>}
                  </div>
                </CardContent>
              </Card>
            );
          })}
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
  const [requirements, setRequirements] = React.useState<ReqDraft[]>([]);
  const [saving, setSaving] = React.useState(false);
  const { toast } = useToast();

  function addRequirement() {
    const firstUnused = subjects.find((s: any) => !requirements.some((r) => r.subjectId === s.id));
    if (!firstUnused) return toast({ title: "All subjects already added", tone: "error" });
    setRequirements((prev) => [...prev, { subjectId: firstUnused.id, isCore: true, minScorePct: "" }]);
  }
  function updateRequirement(i: number, patch: Partial<ReqDraft>) {
    setRequirements((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }
  function removeRequirement(i: number) {
    setRequirements((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function save() {
    if (!name || !code) return toast({ title: "Name and Code required", tone: "error" });
    setSaving(true);
    try {
      const res = await fetch("/api/pathways", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          code,
          description: desc || undefined,
          capacity: capacity ? parseInt(capacity, 10) : undefined,
          requirements: requirements.map((r) => ({
            subjectId: r.subjectId,
            isCore: r.isCore,
            minScorePct: r.minScorePct ? parseInt(r.minScorePct, 10) : null,
          })),
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
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>Create Pathway</DialogTitle></DialogHeader>
        <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Pathway Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. STEM" />
            </div>
            <div className="space-y-1">
              <Label>Short Code</Label>
              <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="e.g. STEM" />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Description</Label>
            <Input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Science, Tech, Engineering & Maths" />
          </div>
          <div className="space-y-1">
            <Label>Capacity (Optional)</Label>
            <Input type="number" value={capacity} onChange={(e) => setCapacity(e.target.value)} placeholder="e.g. 40" />
          </div>

          <div className="space-y-2 rounded-2xl border border-navy-100 p-3 dark:border-navy-800">
            <div className="flex items-center justify-between">
              <Label className="mb-0">Subject requirements</Label>
              <Button type="button" variant="secondary" size="sm" className="rounded-full text-xs" onClick={addRequirement}>
                <Plus className="mr-1 h-3 w-3" /> Add subject
              </Button>
            </div>
            {requirements.length === 0 ? (
              <p className="text-xs italic text-navy-400">No subject gates yet — students can join freely. Add subjects with a minimum % to gate entry (e.g. Maths ≥ 70% for STEM).</p>
            ) : (
              <div className="space-y-2">
                {requirements.map((r, i) => (
                  <div key={i} className="flex flex-wrap items-center gap-2 rounded-xl bg-navy-50 p-2 dark:bg-navy-900">
                    <select
                      className="flex-1 min-w-[120px] rounded-lg border border-navy-200 bg-white px-2 py-1 text-xs dark:border-navy-700 dark:bg-navy-950"
                      value={r.subjectId}
                      onChange={(e) => updateRequirement(i, { subjectId: e.target.value })}
                    >
                      {subjects.map((s: any) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                    <select
                      className="rounded-lg border border-navy-200 bg-white px-2 py-1 text-xs dark:border-navy-700 dark:bg-navy-950"
                      value={r.isCore ? "core" : "elective"}
                      onChange={(e) => updateRequirement(i, { isCore: e.target.value === "core" })}
                    >
                      <option value="core">Core</option>
                      <option value="elective">Elective</option>
                    </select>
                    <div className="flex items-center gap-1">
                      <Input
                        type="number" min={0} max={100}
                        className="w-16 text-xs"
                        placeholder="min %"
                        value={r.minScorePct}
                        onChange={(e) => updateRequirement(i, { minScorePct: e.target.value })}
                      />
                      <span className="text-xs text-navy-400">%</span>
                    </div>
                    <Button type="button" variant="ghost" size="sm" className="h-7 w-7 text-navy-400 hover:text-red-600" onClick={() => removeRequirement(i)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={saving} className="rounded-full">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Pathway"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
