"use client";

/**
 * B.6 CBC UI: Strands (per learning area + KICD presets) · Assess (tap-level
 * rubric per learner) · Learner report (competency profile + KICD PDF).
 * All 4 UX states; rubric pills are one-tap like the attendance register.
 */
import * as React from "react";
import {
  Layers, Plus, AlertCircle, Loader2, X, Sparkles, Check, FileText, Search,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";

interface Subject { id: string; name: string; code: string; curriculum: string }
interface Strand { id: string; name: string; learningOutcome: string | null; subjectId: string; subjectName: string; subjectCode: string; assessmentCount: number }
interface ClassOpt { id: string; name: string }
interface SheetStudent { id: string; name: string; admissionNo: string; latest: { level: number; date: string } | null }
interface Profile {
  student: { id: string; name: string; admissionNo: string; className: string | null };
  subjects: { subjectId: string; subject: string; code: string; avgLevel: number; overall: string; strands: { strand: string; code: string; label: string; parentFriendly: string; comment: string | null; date: string; teacherName: string }[] }[];
  totalAssessments: number;
}

const LEVELS = [
  { v: 4, code: "EE", cls: "bg-green-600 text-white" },
  { v: 3, code: "ME", cls: "bg-blue-600 text-white" },
  { v: 2, code: "AE", cls: "bg-amber-500 text-white" },
  { v: 1, code: "BE", cls: "bg-red-500 text-white" },
];
const CODE_TONE: Record<string, "green" | "blue" | "amber" | "red"> = { EE: "green", ME: "blue", AE: "amber", BE: "red" };

export function CbcClient({ canManage, canAssess }: { canManage: boolean; canAssess: boolean }) {
  const [tab, setTab] = React.useState<"strands" | "assess" | "report">("strands");
  const [subjects, setSubjects] = React.useState<Subject[]>([]);
  const [classes, setClasses] = React.useState<ClassOpt[]>([]);
  React.useEffect(() => {
    fetch("/api/academics/subjects").then((r) => r.json()).then((j) => j.ok && setSubjects(j.data.subjects));
    fetch("/api/classes").then((r) => r.json()).then((j) => j.ok && setClasses(j.data.classes));
  }, []);

  return (
    <div className="space-y-5">
      <div className="inline-flex rounded-full border border-navy-200 p-0.5 dark:border-navy-700">
        <button onClick={() => setTab("strands")} className={`rounded-full px-4 py-1.5 text-sm font-medium ${tab === "strands" ? "bg-navy-900 text-white dark:bg-navy-50 dark:text-navy-900" : "text-navy-500"}`}>Strands</button>
        {canAssess && <button onClick={() => setTab("assess")} className={`rounded-full px-4 py-1.5 text-sm font-medium ${tab === "assess" ? "bg-navy-900 text-white dark:bg-navy-50 dark:text-navy-900" : "text-navy-500"}`}>Assess</button>}
        <button onClick={() => setTab("report")} className={`rounded-full px-4 py-1.5 text-sm font-medium ${tab === "report" ? "bg-navy-900 text-white dark:bg-navy-50 dark:text-navy-900" : "text-navy-500"}`}>Learner report</button>
      </div>
      {tab === "strands" && <StrandsTab subjects={subjects} canManage={canManage} />}
      {tab === "assess" && <AssessTab classes={classes} />}
      {tab === "report" && <ReportTab />}
    </div>
  );
}

// ---- Strands ------------------------------------------------------------------
function StrandsTab({ subjects, canManage }: { subjects: Subject[]; canManage: boolean }) {
  const { toast } = useToast();
  const [strands, setStrands] = React.useState<Strand[] | null>(null);
  const [error, setError] = React.useState(false);
  const [dialog, setDialog] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  const load = React.useCallback(async () => {
    setError(false);
    try {
      const res = await fetch("/api/cbc/strands");
      const json = await res.json();
      if (json.ok) setStrands(json.data.strands); else setError(true);
    } catch { setError(true); }
  }, []);
  React.useEffect(() => { load(); }, [load]);

  async function addPreset(subjectId: string, code: string) {
    setBusy(true);
    try {
      const res = await fetch("/api/cbc/strands", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ preset: true, subjectId, presetCode: code }) });
      const json = await res.json();
      if (json.ok) { toast({ title: `${json.data.added} KICD strands added`, tone: "success" }); load(); }
      else toast({ title: json.error?.message || "Failed", tone: "error" });
    } finally { setBusy(false); }
  }

  if (error) return <LoadError onRetry={load} />;
  if (strands === null) return <Skeletons />;

  const presetable = subjects.filter((s) => ["ENG", "KIS", "MAT", "ISC", "SST"].includes(s.code));
  const grouped = new Map<string, Strand[]>();
  for (const st of strands) {
    const k = `${st.subjectName} (${st.subjectCode})`;
    grouped.set(k, [...(grouped.get(k) ?? []), st]);
  }

  return (
    <div className="space-y-4">
      {canManage && (
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={() => setDialog(true)}><Plus className="h-4 w-4" /> New strand</Button>
          {presetable.map((s) => (
            <Button key={s.id} variant="secondary" size="sm" disabled={busy} onClick={() => addPreset(s.id, s.code)}>
              <Sparkles className="h-3.5 w-3.5" /> KICD {s.code}
            </Button>
          ))}
        </div>
      )}
      {strands.length === 0 ? (
        <EmptyState icon={Layers} title="No strands yet" description="Add the KICD strands for each learning area with one click, or create your own." />
      ) : (
        <div className="space-y-4">
          {[...grouped.entries()].map(([subject, list]) => (
            <Card key={subject}>
              <CardHeader><CardTitle>{subject}</CardTitle></CardHeader>
              <CardContent>
                <ul className="divide-y divide-navy-50 dark:divide-navy-800">
                  {list.map((st) => (
                    <li key={st.id} className="py-2.5">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-navy-900 dark:text-navy-50">{st.name}</p>
                        {st.assessmentCount > 0 && <Badge tone="neutral">{st.assessmentCount} obs</Badge>}
                      </div>
                      {st.learningOutcome && <p className="mt-0.5 text-xs text-navy-400">{st.learningOutcome}</p>}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      {dialog && <StrandDialog subjects={subjects} onClose={() => setDialog(false)} onDone={() => { setDialog(false); load(); }} />}
    </div>
  );
}

function StrandDialog({ subjects, onClose, onDone }: { subjects: Subject[]; onClose: () => void; onDone: () => void }) {
  const { toast } = useToast();
  const [f, setF] = React.useState({ subjectId: "", name: "", learningOutcome: "" });
  const [saving, setSaving] = React.useState(false);
  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/cbc/strands", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) });
      const json = await res.json();
      if (json.ok) { toast({ title: "Strand added", tone: "success" }); onDone(); }
      else toast({ title: json.error?.message || "Failed", tone: "error" });
    } finally { setSaving(false); }
  }
  return (
    <Modal title="New strand" onClose={onClose}>
      <div className="space-y-3">
        <div>
          <Label>Learning area</Label>
          <select value={f.subjectId} onChange={(e) => setF({ ...f, subjectId: e.target.value })} className="mt-1 w-full rounded-xl border border-navy-200 bg-white px-3 py-2 text-sm dark:border-navy-700 dark:bg-navy-800">
            <option value="">Choose…</option>
            {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div><Label>Strand name</Label><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="e.g. Reading" /></div>
        <div><Label>Learning outcome (optional)</Label><Input value={f.learningOutcome} onChange={(e) => setF({ ...f, learningOutcome: e.target.value })} placeholder="What should the learner be able to do?" /></div>
        <Button onClick={save} disabled={saving || !f.subjectId || f.name.length < 2} className="w-full">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Add strand
        </Button>
      </div>
    </Modal>
  );
}

// ---- Assess ---------------------------------------------------------------------
function AssessTab({ classes }: { classes: ClassOpt[] }) {
  const { toast } = useToast();
  const [strands, setStrands] = React.useState<Strand[]>([]);
  const [strandId, setStrandId] = React.useState("");
  const [classId, setClassId] = React.useState("");
  const [students, setStudents] = React.useState<SheetStudent[] | null>(null);
  const [levels, setLevels] = React.useState<Map<string, number>>(new Map());
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    fetch("/api/cbc/strands").then((r) => r.json()).then((j) => j.ok && setStrands(j.data.strands));
  }, []);

  const loadSheet = React.useCallback(async () => {
    if (!strandId || !classId) { setStudents(null); return; }
    setErrorMsg(null); setStudents(null); setLevels(new Map());
    try {
      const res = await fetch(`/api/cbc/assess?strandId=${strandId}&classId=${classId}`);
      const json = await res.json();
      if (json.ok) setStudents(json.data.students);
      else setErrorMsg(json.error?.message ?? "Could not open the sheet.");
    } catch { setErrorMsg("Network problem."); }
  }, [strandId, classId]);
  React.useEffect(() => { loadSheet(); }, [loadSheet]);

  async function save() {
    if (!students) return;
    setSaving(true);
    try {
      const res = await fetch("/api/cbc/assess", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          strandId, classId, date: new Date(Date.now() + 3 * 3600_000).toISOString().slice(0, 10),
          entries: students.map((s) => ({ studentId: s.id, level: levels.get(s.id) ?? null })),
        }),
      });
      const json = await res.json();
      if (json.ok) { toast({ title: `${json.data.saved} observation${json.data.saved === 1 ? "" : "s"} recorded`, tone: "success" }); loadSheet(); }
      else toast({ title: json.error?.message || "Failed", tone: "error" });
    } finally { setSaving(false); }
  }

  const strand = strands.find((s) => s.id === strandId);
  const marked = levels.size;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <select value={classId} onChange={(e) => setClassId(e.target.value)} className="rounded-full border border-navy-200 bg-white px-3 py-2 text-sm dark:border-navy-700 dark:bg-navy-900">
          <option value="">Class…</option>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={strandId} onChange={(e) => setStrandId(e.target.value)} className="max-w-xs rounded-full border border-navy-200 bg-white px-3 py-2 text-sm dark:border-navy-700 dark:bg-navy-900">
          <option value="">Strand…</option>
          {strands.map((s) => <option key={s.id} value={s.id}>{s.subjectCode}: {s.name}</option>)}
        </select>
      </div>
      {strand?.learningOutcome && (
        <p className="rounded-xl bg-warm-50 px-3 py-2 text-xs text-navy-600 dark:bg-navy-800 dark:text-navy-300">{strand.learningOutcome}</p>
      )}

      {errorMsg ? (
        <div className="flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-700/40 dark:bg-amber-900/20 dark:text-amber-300">
          <AlertCircle className="h-4 w-4" /> {errorMsg}
        </div>
      ) : !strandId || !classId ? (
        <EmptyState icon={Layers} title="Pick a class and strand" description="Tap EE / ME / AE / BE per learner — each save keeps the history of observations." />
      ) : students === null ? (
        <Skeletons />
      ) : (
        <>
          <div className="rounded-2xl border border-navy-100 bg-white dark:border-navy-800 dark:bg-navy-900">
            <ul className="divide-y divide-navy-50 dark:divide-navy-800">
              {students.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-navy-900 dark:text-navy-50">{s.name}</p>
                    <p className="font-mono text-[10px] text-navy-400">
                      {s.admissionNo}
                      {s.latest && <span className="ml-1.5 text-navy-300">last: {LEVELS.find((l) => l.v === s.latest!.level)?.code} on {s.latest.date}</span>}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    {LEVELS.map((l) => {
                      const on = levels.get(s.id) === l.v;
                      return (
                        <button key={l.v} onClick={() => setLevels((p) => { const n = new Map(p); if (on) n.delete(s.id); else n.set(s.id, l.v); return n; })}
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold transition-colors duration-200 ease-apple ${on ? l.cls : "border border-navy-200 text-navy-400 dark:border-navy-700"}`}>
                          {l.code}
                        </button>
                      );
                    })}
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-xs text-navy-400">{marked}/{students.length} observed this round</p>
            <Button onClick={save} disabled={saving || marked === 0}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Record {marked} observation{marked === 1 ? "" : "s"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

// ---- Learner report ----------------------------------------------------------------
function ReportTab() {
  const [q, setQ] = React.useState("");
  const [hits, setHits] = React.useState<{ id: string; title: string; subtitle: string }[]>([]);
  const [profile, setProfile] = React.useState<Profile | null>(null);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (q.trim().length < 2) { setHits([]); return; }
    const t = setTimeout(async () => {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      const json = await res.json();
      if (json.ok) setHits(json.data.hits.filter((h: { type: string }) => h.type === "student"));
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  async function openProfile(id: string) {
    setLoading(true); setHits([]); setQ("");
    try {
      const res = await fetch(`/api/cbc/report/${id}`);
      const json = await res.json();
      if (json.ok) setProfile(json.data);
    } finally { setLoading(false); }
  }

  return (
    <div className="space-y-4">
      <div className="relative max-w-md">
        <div className="flex items-center gap-2 rounded-2xl border border-navy-200 bg-white px-3.5 py-2.5 dark:border-navy-700 dark:bg-navy-900">
          <Search className="h-4 w-4 text-navy-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a learner…" className="w-full bg-transparent text-sm outline-none placeholder:text-navy-400 dark:text-navy-50" />
        </div>
        {hits.length > 0 && (
          <div className="absolute z-10 mt-1 w-full rounded-2xl border border-navy-100 bg-white p-1 shadow-card dark:border-navy-700 dark:bg-navy-900">
            {hits.map((h) => (
              <button key={h.id} onClick={() => openProfile(h.id)} className="block w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-navy-50 dark:hover:bg-navy-800">
                <span className="font-medium text-navy-900 dark:text-navy-50">{h.title}</span>
                <span className="ml-2 text-xs text-navy-400">{h.subtitle}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {loading ? <Skeletons /> : profile === null ? (
        <EmptyState icon={FileText} title="Search for a learner" description="Their competency profile across all learning areas appears here, with the KICD report download." />
      ) : profile.subjects.length === 0 ? (
        <EmptyState icon={FileText} title={`No observations yet for ${profile.student.name}`} description="Record formative assessments in the Assess tab first." />
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-semibold text-navy-900 dark:text-navy-50">{profile.student.name}</h3>
              <p className="text-xs text-navy-400">{profile.student.admissionNo}{profile.student.className ? ` · ${profile.student.className}` : ""} · {profile.totalAssessments} observations</p>
            </div>
            <a href={`/api/cbc/report/${profile.student.id}?format=pdf`}>
              <Button><FileText className="h-4 w-4" /> KICD report PDF</Button>
            </a>
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            {profile.subjects.map((sub) => (
              <Card key={sub.subjectId}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>{sub.subject}</span>
                    <Badge tone={CODE_TONE[sub.overall] ?? "neutral"}>{sub.overall}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {sub.strands.map((st) => (
                      <li key={st.strand} className="rounded-xl bg-warm-50 p-2.5 dark:bg-navy-800">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-navy-800 dark:text-navy-100">{st.strand}</p>
                          <Badge tone={CODE_TONE[st.code] ?? "neutral"}>{st.code}</Badge>
                        </div>
                        <p className="mt-0.5 text-xs text-navy-500 dark:text-navy-400">
                          {profile.student.name.split(" ")[0]} {st.parentFriendly} <span className="text-navy-300">· {st.date}</span>
                        </p>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---- shared ---------------------------------------------------------------------------
function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-navy-950/40 p-4 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-card dark:bg-navy-900" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between">
          <h3 className="text-base font-semibold text-navy-900 dark:text-navy-50">{title}</h3>
          <button onClick={onClose} className="rounded-full p-1 text-navy-400 hover:bg-navy-50 dark:hover:bg-navy-800" aria-label="Close"><X className="h-4 w-4" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
function LoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-900/20 dark:text-red-300">
      <AlertCircle className="h-4 w-4" /> Couldn&apos;t load. <button onClick={onRetry} className="font-medium underline">Retry</button>
    </div>
  );
}
function Skeletons() {
  return <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}</div>;
}
