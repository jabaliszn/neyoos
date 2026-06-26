"use client";

/**
 * B.5 Exams UI. Exams list -> open one -> Results table (positions/means,
 * publish toggle, per-student report PDF) + Enter marks (grid w/ AUTOSAVE).
 * All 4 UX states. Mobile-first.
 */
import * as React from "react";
import {
  ClipboardList, Plus, AlertCircle, Loader2, X, ArrowLeft, FileText,
  CheckCircle2, Eye, EyeOff, Save, Send, ShieldCheck, Clock3,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { TableContainer, Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";

interface ExamRow { id: string; name: string; year: number; term: number; type: string; maxMarks: number; published: boolean; subjectCount: number; resultCount: number }
interface Subject { id: string; name: string; code: string }
interface ClassOpt { id: string; name: string }
interface SummaryStudent { studentId: string; name: string; admissionNo: string; className: string | null; total: number; subjectCount: number; avgPct: number; grade: string; position: number; classPosition: number }
interface ReleaseApproval { id: string; status: string; requestedByName: string; requestedAt: string; decidedByName: string | null; decidedAt: string | null; decisionNote: string | null }
interface Summary {
  exam: { id: string; name: string; maxMarks: number; published: boolean };
  students: SummaryStudent[];
  classMeans: { label: string; level: string | null; mean: number; students: number; rank: number }[];
  levelMeans: { level: string; mean: number; students: number }[];
  subjectMeans: { name: string; code: string; mean: number }[];
  releaseApproval: ReleaseApproval | null;
}
interface SheetStudent { id: string; name: string; admissionNo: string; marks: number | null }

export function ExamsClient({ canManage, canEnterMarks, canPublish, canRequestRelease, canApproveRelease }: { canManage: boolean; canEnterMarks: boolean; canPublish: boolean; canRequestRelease: boolean; canApproveRelease: boolean }) {
  const { toast } = useToast();
  const [exams, setExams] = React.useState<ExamRow[] | null>(null);
  const [error, setError] = React.useState(false);
  const [open, setOpen] = React.useState<ExamRow | null>(null);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [subjects, setSubjects] = React.useState<Subject[]>([]);
  const [classes, setClasses] = React.useState<ClassOpt[]>([]);

  const load = React.useCallback(async () => {
    setError(false);
    try {
      const res = await fetch("/api/exams");
      const json = await res.json();
      if (json.ok) setExams(json.data.exams); else setError(true);
    } catch { setError(true); }
  }, []);
  React.useEffect(() => {
    load();
    fetch("/api/academics/subjects").then((r) => r.json()).then((j) => j.ok && setSubjects(j.data.subjects));
    fetch("/api/classes").then((r) => r.json()).then((j) => j.ok && setClasses(j.data.classes));
  }, [load]);

  React.useEffect(() => {
    if (!exams) return;
    const id = new URLSearchParams(window.location.search).get("open");
    if (id) {
      const found = exams.find((e) => e.id === id);
      if (found) setOpen(found);
    }
  }, [exams]);

  if (open) {
    return <ExamDetail exam={open} subjects={subjects} classes={classes} canEnterMarks={canEnterMarks} canPublish={canPublish} canRequestRelease={canRequestRelease} canApproveRelease={canApproveRelease} onBack={() => { setOpen(null); load(); }} />;
  }

  return (
    <div className="space-y-4">
      {canManage && <Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" /> New exam</Button>}
      {error ? (
        <LoadError onRetry={load} />
      ) : exams === null ? (
        <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16 rounded-2xl" />)}</div>
      ) : exams.length === 0 ? (
        <EmptyState icon={ClipboardList} title="No exams yet" description='Create "End of Term 2" or a CAT, map its subjects, and teachers can start entering marks.' action={canManage ? <Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" /> New exam</Button> : undefined} />
      ) : (
        <div className="space-y-2">
          {exams.map((e) => (
            <button key={e.id} onClick={() => setOpen(e)} className="block w-full text-left">
              <Card className="transition-shadow duration-200 ease-apple hover:shadow-card">
                <CardContent className="flex flex-wrap items-center justify-between gap-2 p-4">
                  <div>
                    <p className="text-sm font-semibold text-navy-900 dark:text-navy-50">{e.name}</p>
                    <p className="mt-0.5 text-xs text-navy-400">Term {e.term}, {e.year} · {e.type} · /{e.maxMarks} · {e.subjectCount} subjects</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {e.resultCount > 0 && <Badge tone="neutral">{e.resultCount} marks</Badge>}
                    <Badge tone={e.published ? "green" : "amber"}>{e.published ? "published" : "draft"}</Badge>
                  </div>
                </CardContent>
              </Card>
            </button>
          ))}
        </div>
      )}
      {createOpen && <CreateExamDialog subjects={subjects} onClose={() => setCreateOpen(false)} onDone={() => { setCreateOpen(false); load(); toast({ title: "Exam created", tone: "success" }); }} />}
    </div>
  );
}

// ---- detail: results + marks entry ------------------------------------------------
function ExamDetail({ exam, subjects, classes, canEnterMarks, canPublish, canRequestRelease, canApproveRelease, onBack }: {
  exam: ExamRow; subjects: Subject[]; classes: ClassOpt[];
  canEnterMarks: boolean; canPublish: boolean; canRequestRelease: boolean; canApproveRelease: boolean; onBack: () => void;
}) {
  const { toast } = useToast();
  const [tab, setTab] = React.useState<"results" | "marks">("results");
  const [summary, setSummary] = React.useState<Summary | null>(null);
  const [error, setError] = React.useState(false);
  const [published, setPublished] = React.useState(exam.published);

  const load = React.useCallback(async () => {
    setError(false);
    try {
      const res = await fetch(`/api/exams/${exam.id}`);
      const json = await res.json();
      if (json.ok) { setSummary(json.data); setPublished(json.data.exam.published); } else setError(true);
    } catch { setError(true); }
  }, [exam.id]);
  React.useEffect(() => { load(); }, [load]);

  async function togglePublish() {
    const res = await fetch(`/api/exams/${exam.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: published ? "unpublish" : "publish" }) });
    const json = await res.json();
    if (json.ok) { setPublished(!published); toast({ title: !published ? "Results released to parents & students" : "Results hidden again", tone: "success" }); }
    else toast({ title: json.error?.message || "Failed", tone: "error" });
  }

  async function releaseAction(action: "request" | "approve" | "reject") {
    const note = action === "reject" ? window.prompt("Why are these results being returned?") ?? "" : undefined;
    const res = await fetch(`/api/exams/${exam.id}/release`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, note }),
    });
    const json = await res.json();
    if (json.ok) {
      const title = action === "request" ? "Release request sent to Principal" : action === "approve" ? "Results approved and released" : "Release request returned";
      toast({ title, tone: "success" });
      load();
    } else {
      toast({ title: json.error?.message || "Release action failed", tone: "error" });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button onClick={onBack} className="inline-flex items-center gap-1 text-sm font-medium text-navy-500 hover:text-navy-900 dark:text-navy-400 dark:hover:text-navy-100">
          <ArrowLeft className="h-4 w-4" /> All exams
        </button>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-full border border-navy-200 p-0.5 dark:border-navy-700">
            <button onClick={() => setTab("results")} className={`rounded-full px-3 py-1 text-xs font-medium ${tab === "results" ? "bg-navy-900 text-white dark:bg-navy-50 dark:text-navy-900" : "text-navy-500"}`}>Results</button>
            {canEnterMarks && <button onClick={() => setTab("marks")} className={`rounded-full px-3 py-1 text-xs font-medium ${tab === "marks" ? "bg-navy-900 text-white dark:bg-navy-50 dark:text-navy-900" : "text-navy-500"}`}>Enter marks</button>}
          </div>
          {!published && summary?.releaseApproval?.status === "PENDING" && <Badge tone="amber"><Clock3 className="mr-1 h-3.5 w-3.5" /> Pending Principal approval</Badge>}
          {!published && canRequestRelease && summary?.students.length ? (summary?.releaseApproval?.status === "PENDING" ? null : (
            <Button size="sm" variant="secondary" onClick={() => releaseAction("request")}>
              <Send className="h-3.5 w-3.5" /> Request release approval
            </Button>
          )) : null}
          {!published && canApproveRelease && summary?.releaseApproval?.status === "PENDING" && (
            <>
              <Button size="sm" variant="secondary" onClick={() => releaseAction("reject")}>Return</Button>
              <Button size="sm" onClick={() => releaseAction("approve")}>
                <ShieldCheck className="h-3.5 w-3.5" /> Approve & release
              </Button>
            </>
          )}
          {canPublish && (published || summary?.releaseApproval?.status !== "PENDING") && (
            <Button size="sm" variant={published ? "secondary" : "primary"} onClick={togglePublish}>
              {published ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              {published ? "Unpublish" : "Release directly"}
            </Button>
          )}
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-navy-900 dark:text-navy-50">{exam.name}</h2>
        <p className="text-xs text-navy-400">Term {exam.term}, {exam.year} · marked out of {exam.maxMarks}</p>
      </div>

      {tab === "results" ? (
        error ? <LoadError onRetry={load} /> : summary === null ? (
          <div className="space-y-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12 rounded-2xl" />)}</div>
        ) : summary.students.length === 0 ? (
          <EmptyState icon={ClipboardList} title="No marks yet" description="Once teachers enter marks, positions and means appear here instantly." />
        ) : (
          <div className="space-y-4">
            {/* means strip */}
            <div className="flex flex-wrap gap-2">
              {summary.subjectMeans.map((sm) => <Badge key={sm.code} tone={sm.mean >= 65 ? "green" : sm.mean >= 50 ? "amber" : "red"}>{sm.code} {sm.mean}%</Badge>)}
            </div>

            {summary.releaseApproval && (
              <Card>
                <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div>
                    <p className="text-sm font-semibold text-navy-900 dark:text-navy-50">Principal release approval</p>
                    <p className="mt-1 text-xs text-navy-500 dark:text-navy-400">
                      Requested by {summary.releaseApproval.requestedByName} · {new Date(summary.releaseApproval.requestedAt).toLocaleString()}
                      {summary.releaseApproval.decidedByName ? ` · Decided by ${summary.releaseApproval.decidedByName}` : ""}
                    </p>
                    {summary.releaseApproval.decisionNote && <p className="mt-1 text-xs text-navy-500 dark:text-navy-400">Note: {summary.releaseApproval.decisionNote}</p>}
                  </div>
                  <Badge tone={summary.releaseApproval.status === "APPROVED" ? "green" : summary.releaseApproval.status === "REJECTED" ? "red" : "amber"}>{summary.releaseApproval.status.toLowerCase()}</Badge>
                </CardContent>
              </Card>
            )}

            {/* inter-stream & class performance (founder request) */}
            {summary.classMeans.length > 0 && (
              <div className="grid gap-3 lg:grid-cols-2">
                <Card>
                  <CardHeader><CardTitle>Stream comparison</CardTitle></CardHeader>
                  <CardContent>
                    <ul className="space-y-2.5">
                      {summary.classMeans.map((c) => (
                        <li key={c.label}>
                          <div className="mb-1 flex items-center justify-between text-sm">
                            <span className="font-medium text-navy-800 dark:text-navy-100">
                              <span className="mr-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-navy-100 text-[10px] font-bold text-navy-600 dark:bg-navy-800 dark:text-navy-200">{c.rank}</span>
                              {c.label}
                            </span>
                            <span className="text-navy-500">{c.mean}% · {c.students} learner{c.students === 1 ? "" : "s"}</span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-navy-100 dark:bg-navy-800">
                            <div className={`h-full rounded-full ${c.mean >= 65 ? "bg-green-500" : c.mean >= 50 ? "bg-amber-400" : "bg-red-400"}`} style={{ width: `${c.mean}%` }} />
                          </div>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader><CardTitle>Overall by class level</CardTitle></CardHeader>
                  <CardContent>
                    {summary.levelMeans.length === 0 ? (
                      <p className="py-4 text-center text-sm text-navy-400">No level data.</p>
                    ) : (
                      <ul className="space-y-2.5">
                        {summary.levelMeans.map((l) => (
                          <li key={l.level}>
                            <div className="mb-1 flex items-center justify-between text-sm">
                              <span className="font-medium text-navy-800 dark:text-navy-100">{l.level} (all streams)</span>
                              <span className="text-navy-500">{l.mean}% · {l.students} learner{l.students === 1 ? "" : "s"}</span>
                            </div>
                            <div className="h-2 overflow-hidden rounded-full bg-navy-100 dark:bg-navy-800">
                              <div className={`h-full rounded-full ${l.mean >= 65 ? "bg-green-500" : l.mean >= 50 ? "bg-amber-400" : "bg-red-400"}`} style={{ width: `${l.mean}%` }} />
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
            <TableContainer>
              <Table>
                <THead><TR><TH>Pos</TH><TH>Student</TH><TH>Class</TH><TH align="right">Total</TH><TH align="right">Avg</TH><TH>Grade</TH><TH>Report</TH></TR></THead>
                <TBody>
                  {summary.students.map((s) => (
                    <TR key={s.studentId}>
                      <TD className="font-semibold">{s.position}</TD>
                      <TD>
                        <span className="font-medium">{s.name}</span>
                        <span className="ml-1 font-mono text-[10px] text-navy-400">{s.admissionNo}</span>
                      </TD>
                      <TD className="text-xs text-navy-400">{s.className ?? "—"} (#{s.classPosition})</TD>
                      <TD align="right">{s.total}</TD>
                      <TD align="right">{s.avgPct}%</TD>
                      <TD><Badge tone={["EE"].includes(s.grade) || s.grade.startsWith("A") ? "green" : ["BE", "E"].includes(s.grade) ? "red" : "blue"}>{s.grade}</Badge></TD>
                      <TD>
                        <a href={`/api/exams/${exam.id}/report/${s.studentId}`} className="inline-flex items-center gap-1 text-xs font-medium text-green-700 hover:underline dark:text-green-400">
                          <FileText className="h-3.5 w-3.5" /> PDF
                        </a>
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </TableContainer>
          </div>
        )
      ) : (
        <MarksEntry examId={exam.id} maxMarks={exam.maxMarks} subjects={subjects} classes={classes} onSaved={load} />
      )}
    </div>
  );
}

// ---- marks grid with autosave -------------------------------------------------------
function MarksEntry({ examId, maxMarks, subjects, classes, onSaved }: {
  examId: string; maxMarks: number; subjects: Subject[]; classes: ClassOpt[]; onSaved: () => void;
}) {
  const { toast } = useToast();
  const [subjectId, setSubjectId] = React.useState("");
  const [classId, setClassId] = React.useState("");
  const [students, setStudents] = React.useState<SheetStudent[] | null>(null);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [savedAt, setSavedAt] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const dirtyRef = React.useRef(false);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadSheet = React.useCallback(async () => {
    if (!subjectId || !classId) { setStudents(null); return; }
    setErrorMsg(null);
    setStudents(null);
    try {
      const res = await fetch(`/api/exams/marks?examId=${examId}&subjectId=${subjectId}&classId=${classId}`);
      const json = await res.json();
      if (json.ok) setStudents(json.data.students);
      else setErrorMsg(json.error?.message ?? "Could not open this sheet.");
    } catch { setErrorMsg("Network problem."); }
  }, [examId, subjectId, classId]);
  React.useEffect(() => { loadSheet(); }, [loadSheet]);

  const doSave = React.useCallback(async (rows: SheetStudent[]) => {
    if (!dirtyRef.current) return;
    setSaving(true);
    try {
      const res = await fetch("/api/exams/marks", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ examId, subjectId, classId, marks: rows.map((s) => ({ studentId: s.id, marks: s.marks })) }),
      });
      const json = await res.json();
      if (json.ok) {
        dirtyRef.current = false;
        setSavedAt(new Date().toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
        onSaved();
      } else toast({ title: json.error?.message || "Autosave failed", tone: "error" });
    } finally { setSaving(false); }
  }, [examId, subjectId, classId, onSaved, toast]);

  function setMark(id: string, raw: string) {
    setStudents((prev) => {
      if (!prev) return prev;
      const v = raw === "" ? null : Math.max(0, Math.min(maxMarks, Number(raw)));
      const next = prev.map((s) => (s.id === id ? { ...s, marks: Number.isNaN(v as number) ? s.marks : v } : s));
      dirtyRef.current = true;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => doSave(next), 1200); // AUTOSAVE
      return next;
    });
  }

  const filled = (students ?? []).filter((s) => s.marks !== null).length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <select value={classId} onChange={(e) => setClassId(e.target.value)} className="rounded-full border border-navy-200 bg-white px-3 py-2 text-sm dark:border-navy-700 dark:bg-navy-900">
          <option value="">Class…</option>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} className="rounded-full border border-navy-200 bg-white px-3 py-2 text-sm dark:border-navy-700 dark:bg-navy-900">
          <option value="">Subject…</option>
          {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        {students && (
          <span className="ml-auto inline-flex items-center gap-2 text-xs text-navy-400">
            {saving ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…</> : savedAt ? <><CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> Saved {savedAt}</> : `${filled}/${students.length} entered`}
          </span>
        )}
      </div>

      {errorMsg ? (
        <div className="flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-700/40 dark:bg-amber-900/20 dark:text-amber-300">
          <AlertCircle className="h-4 w-4" /> {errorMsg}
        </div>
      ) : !subjectId || !classId ? (
        <EmptyState icon={ClipboardList} title="Pick a class and subject" description="The marks sheet opens here. Entries save automatically as you type." />
      ) : students === null ? (
        <div className="space-y-2">{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-11 rounded-xl" />)}</div>
      ) : (
        <div className="rounded-2xl border border-navy-100 bg-white dark:border-navy-800 dark:bg-navy-900">
          <ul className="divide-y divide-navy-50 dark:divide-navy-800">
            {students.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 px-4 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-navy-900 dark:text-navy-50">{s.name}</p>
                  <p className="font-mono text-[10px] text-navy-400">{s.admissionNo}</p>
                </div>
                <input
                  type="number" min={0} max={maxMarks}
                  value={s.marks ?? ""}
                  onChange={(e) => setMark(s.id, e.target.value)}
                  placeholder={`/${maxMarks}`}
                  className="h-10 w-20 shrink-0 rounded-xl border border-navy-200 bg-white px-2 text-right text-sm text-navy-900 outline-none placeholder:text-navy-300 focus:border-navy-300 focus:ring-2 focus:ring-green-500/30 dark:border-navy-700 dark:bg-navy-800 dark:text-navy-50"
                />
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-between border-t border-navy-100 px-4 py-2.5 dark:border-navy-800">
            <p className="text-xs text-navy-400">Marks save automatically · out of {maxMarks}</p>
            <Button size="sm" variant="secondary" onClick={() => { dirtyRef.current = true; doSave(students); }} disabled={saving}>
              <Save className="h-3.5 w-3.5" /> Save now
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---- create dialog --------------------------------------------------------------------
function CreateExamDialog({ subjects, onClose, onDone }: { subjects: Subject[]; onClose: () => void; onDone: () => void }) {
  const { toast } = useToast();
  const [f, setF] = React.useState({ name: "", year: new Date().getFullYear(), term: 2, type: "EXAM", maxMarks: 100 });
  const [picked, setPicked] = React.useState<Set<string>>(new Set(subjects.map((s) => s.id)));
  const [saving, setSaving] = React.useState(false);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/exams", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...f, subjectIds: [...picked] }),
      });
      const json = await res.json();
      if (json.ok) onDone();
      else toast({ title: json.error?.message || "Failed", tone: "error" });
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-navy-950/40 p-4 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-card dark:bg-navy-900" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between">
          <h3 className="text-base font-semibold text-navy-900 dark:text-navy-50">New exam</h3>
          <button onClick={onClose} className="rounded-full p-1 text-navy-400 hover:bg-navy-50 dark:hover:bg-navy-800" aria-label="Close"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-3">
          <div><Label>Name</Label><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="e.g. End of Term 2 Exam" /></div>
          <div className="grid grid-cols-3 gap-2">
            <div><Label>Year</Label><Input type="number" value={f.year} onChange={(e) => setF({ ...f, year: Number(e.target.value) })} /></div>
            <div>
              <Label>Term</Label>
              <select value={f.term} onChange={(e) => setF({ ...f, term: Number(e.target.value) })} className="mt-1 w-full rounded-xl border border-navy-200 bg-white px-3 py-2 text-sm dark:border-navy-700 dark:bg-navy-800">
                <option value={1}>1</option><option value={2}>2</option><option value={3}>3</option>
              </select>
            </div>
            <div>
              <Label>Type</Label>
              <select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })} className="mt-1 w-full rounded-xl border border-navy-200 bg-white px-3 py-2 text-sm dark:border-navy-700 dark:bg-navy-800">
                <option value="EXAM">Exam</option><option value="CAT">CAT</option>
              </select>
            </div>
          </div>
          <div><Label>Out of</Label><Input type="number" min={10} max={200} value={f.maxMarks} onChange={(e) => setF({ ...f, maxMarks: Number(e.target.value) })} /></div>
          <div>
            <Label>Subjects ({picked.size})</Label>
            <div className="mt-1 flex max-h-32 flex-wrap gap-1.5 overflow-y-auto">
              {subjects.map((s) => {
                const on = picked.has(s.id);
                return (
                  <button key={s.id} onClick={() => setPicked((p) => { const n = new Set(p); if (on) n.delete(s.id); else n.add(s.id); return n; })}
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${on ? "bg-green-600 text-white" : "border border-navy-200 text-navy-500 dark:border-navy-700"}`}>
                    {s.code}
                  </button>
                );
              })}
            </div>
          </div>
          <Button onClick={save} disabled={saving || f.name.length < 2 || picked.size === 0} className="w-full">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Create exam
          </Button>
        </div>
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
