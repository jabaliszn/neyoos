"use client";

/**
 * B.13 LMS — staff client. 3 tabs:
 * - Quizzes: create MCQ quiz (server-graded), publish gate, per-student results
 * - Hand-ins: pick a homework task -> roster w/ submissions -> grade 0-100 + feedback
 * - Discussions: class forum threads w/ teacher lock/unlock
 * Teacher-scoped via the same B.12 rule (own classes); leadership sees all.
 */
import * as React from "react";
import {
  ListChecks, Inbox, MessageCircle, Plus, X, Loader2, AlertCircle,
  Eye, EyeOff, ArrowLeft, CheckCircle2, Trash2, Send, FileText, Download,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { ThreadView } from "@/components/portal/lms-cards";

interface ClassOpt { id: string; label: string }
interface Subject { id: string; name: string; code: string }

export function LmsClient() {
  const [tab, setTab] = React.useState<"quizzes" | "handins" | "forum">("quizzes");
  const [classes, setClasses] = React.useState<ClassOpt[]>([]);
  const [subjects, setSubjects] = React.useState<Subject[]>([]);

  React.useEffect(() => {
    fetch("/api/teacher").then((r) => r.json()).then((j) => {
      if (j.ok) setClasses(j.data.classes.map((c: { id: string; label: string }) => ({ id: c.id, label: c.label })));
    }).catch(() => {});
    fetch("/api/academics/subjects").then((r) => r.json()).then((j) => j.ok && setSubjects(j.data.subjects)).catch(() => {});
  }, []);

  const tabs = [
    { key: "quizzes" as const, label: "Quizzes", icon: ListChecks },
    { key: "handins" as const, label: "Hand-ins", icon: Inbox },
    { key: "forum" as const, label: "Discussions", icon: MessageCircle },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors duration-200 ease-apple ${
              tab === t.key
                ? "bg-navy-900 text-white dark:bg-navy-50 dark:text-navy-900"
                : "bg-white text-navy-600 border border-navy-100 hover:bg-warm-50 dark:bg-navy-900 dark:text-navy-300 dark:border-navy-800"
            }`}
          >
            <t.icon className="h-3.5 w-3.5" /> {t.label}
          </button>
        ))}
      </div>
      {tab === "quizzes" && <QuizzesTab classes={classes} subjects={subjects} />}
      {tab === "handins" && <HandinsTab />}
      {tab === "forum" && <ForumTab classes={classes} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Quizzes
// ---------------------------------------------------------------------------

interface QuizRow { id: string; title: string; className: string; subjectName: string; published: boolean; dueDate: string | null; questions: number; attempts: number; avgPct: number | null; mine: boolean; teacherName: string }
interface QuizResultData { quiz: { id: string; title: string; published: boolean; subjectName: string; questionCount: number }; students: { studentId: string; name: string; admissionNo: string; scorePct: number | null; score: number | null; total: number | null }[]; attempted: number; avgPct: number | null }

function QuizzesTab({ classes, subjects }: { classes: ClassOpt[]; subjects: Subject[] }) {
  const { toast } = useToast();
  const [rows, setRows] = React.useState<QuizRow[] | null>(null);
  const [error, setError] = React.useState(false);
  const [creating, setCreating] = React.useState(false);
  const [openResults, setOpenResults] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setError(false);
    try {
      const res = await fetch("/api/lms/quizzes");
      const json = await res.json();
      if (json.ok) setRows(json.data.quizzes); else setError(true);
    } catch { setError(true); }
  }, []);
  React.useEffect(() => { load(); }, [load]);

  async function togglePublish(q: QuizRow) {
    const res = await fetch("/api/lms/quizzes", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quizId: q.id, published: !q.published }),
    });
    const json = await res.json();
    if (json.ok) { toast({ title: q.published ? "Quiz hidden from students" : "Quiz published — students can take it now", tone: "success" }); load(); }
    else toast({ title: json.error?.message || "Could not update", tone: "error" });
  }

  if (openResults) return <QuizResults quizId={openResults} onBack={() => { setOpenResults(null); load(); }} />;
  if (error) return <LoadError onRetry={load} />;
  if (rows === null) return <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16 rounded-2xl" />)}</div>;

  return (
    <div className="space-y-3">
      <Button onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> New quiz</Button>
      {rows.length === 0 ? (
        <EmptyState icon={ListChecks} title="No quizzes yet" description="Build a quick MCQ quiz — NEYO marks it automatically the moment a learner submits." action={<Button onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> New quiz</Button>} />
      ) : (
        <div className="space-y-2">
          {rows.map((q) => (
            <Card key={q.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-2 p-4">
                <button onClick={() => setOpenResults(q.id)} className="min-w-0 text-left">
                  <p className="text-sm font-semibold text-navy-900 dark:text-navy-50">{q.title}</p>
                  <p className="text-xs text-navy-400">
                    {q.className} · {q.subjectName} · {q.questions} questions · {q.attempts} attempt{q.attempts === 1 ? "" : "s"}
                    {q.avgPct !== null ? ` · avg ${q.avgPct}%` : ""}{q.dueDate ? ` · due ${q.dueDate}` : ""}
                  </p>
                </button>
                <div className="flex items-center gap-2">
                  <Badge tone={q.published ? "green" : "neutral"}>{q.published ? "published" : "draft"}</Badge>
                  {q.mine && (
                    <Button size="sm" variant="secondary" onClick={() => togglePublish(q)}>
                      {q.published ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />} {q.published ? "Hide" : "Publish"}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      {creating && <QuizBuilder classes={classes} subjects={subjects} onClose={() => setCreating(false)} onDone={() => { setCreating(false); load(); }} />}
    </div>
  );
}

function QuizResults({ quizId, onBack }: { quizId: string; onBack: () => void }) {
  const [data, setData] = React.useState<QuizResultData | null>(null);
  React.useEffect(() => {
    fetch(`/api/lms/quizzes?id=${quizId}`).then((r) => r.json()).then((j) => j.ok && setData(j.data)).catch(() => {});
  }, [quizId]);

  if (data === null) return <Skeleton className="h-48 rounded-2xl" />;
  return (
    <div className="space-y-3">
      <button onClick={onBack} className="inline-flex items-center gap-1 text-sm font-medium text-navy-500 hover:text-navy-900 dark:text-navy-400">
        <ArrowLeft className="h-4 w-4" /> Quizzes
      </button>
      <Card>
        <CardHeader>
          <CardTitle>{data.quiz.title}</CardTitle>
          <p className="mt-1 text-xs text-navy-400">{data.quiz.subjectName} · {data.quiz.questionCount} questions · {data.attempted} attempted{data.avgPct !== null ? ` · class avg ${data.avgPct}%` : ""}</p>
        </CardHeader>
        <CardContent>
          <ul className="divide-y divide-navy-50 dark:divide-navy-800">
            {data.students.map((s) => (
              <li key={s.studentId} className="flex items-center justify-between py-2 text-sm">
                <div>
                  <p className="font-medium text-navy-900 dark:text-navy-50">{s.name}</p>
                  <p className="font-mono text-xs text-navy-400">{s.admissionNo}</p>
                </div>
                {s.scorePct !== null ? (
                  <Badge tone={s.scorePct >= 65 ? "green" : s.scorePct >= 50 ? "amber" : "red"}>{s.score}/{s.total} · {s.scorePct}%</Badge>
                ) : (
                  <Badge tone="neutral">not attempted</Badge>
                )}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

interface DraftQ { prompt: string; options: string[]; correctIndex: number }

function QuizBuilder({ classes, subjects, onClose, onDone }: { classes: ClassOpt[]; subjects: Subject[]; onClose: () => void; onDone: () => void }) {
  const { toast } = useToast();
  const [f, setF] = React.useState({ classId: classes[0]?.id ?? "", subjectId: "", title: "", instructions: "", dueDate: "" });
  const [questions, setQuestions] = React.useState<DraftQ[]>([{ prompt: "", options: ["", ""], correctIndex: 0 }]);
  const [saving, setSaving] = React.useState(false);
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  const setQ = (i: number, patch: Partial<DraftQ>) => setQuestions((prev) => prev.map((q, qi) => (qi === i ? { ...q, ...patch } : q)));

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/lms/quizzes", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classId: f.classId, subjectId: f.subjectId, title: f.title,
          instructions: f.instructions || undefined, dueDate: f.dueDate || undefined,
          questions: questions.map((q) => ({ ...q, options: q.options.filter((o) => o.trim()) })),
        }),
      });
      const json = await res.json();
      if (json.ok) { toast({ title: "Quiz saved as draft — publish when ready", tone: "success" }); onDone(); }
      else toast({ title: json.error?.message || "Could not save the quiz", tone: "error" });
    } finally { setSaving(false); }
  }

  const select = "w-full rounded-2xl border border-navy-200 bg-white px-3.5 py-2.5 text-sm dark:border-navy-700 dark:bg-navy-900";
  const valid = f.classId && f.subjectId && f.title.trim().length >= 3 &&
    questions.every((q) => q.prompt.trim() && q.options.filter((o) => o.trim()).length >= 2 && q.correctIndex < q.options.filter((o) => o.trim()).length);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-navy-950/40 p-4 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-card dark:bg-navy-900" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between">
          <h3 className="text-base font-semibold text-navy-900 dark:text-navy-50">New quiz (auto-graded)</h3>
          <button onClick={onClose} className="rounded-full p-1 text-navy-400 hover:bg-navy-50 dark:hover:bg-navy-800" aria-label="Close"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Class</Label>
              <select value={f.classId} onChange={(e) => set("classId", e.target.value)} className={select}>
                {classes.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <Label>Subject</Label>
              <select value={f.subjectId} onChange={(e) => set("subjectId", e.target.value)} className={select}>
                <option value="">Pick a subject…</option>
                {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>
          <div><Label>Title</Label><Input value={f.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Quadratics check-in quiz" /></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><Label>Instructions (optional)</Label><Input value={f.instructions} onChange={(e) => set("instructions", e.target.value)} placeholder="One attempt. 10 minutes." /></div>
            <div><Label>Due date (optional)</Label><Input type="date" value={f.dueDate} onChange={(e) => set("dueDate", e.target.value)} /></div>
          </div>

          {questions.map((q, qi) => (
            <div key={qi} className="space-y-2 rounded-2xl border border-navy-100 p-4 dark:border-navy-800">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-navy-900 dark:text-navy-50">Question {qi + 1}</p>
                {questions.length > 1 && (
                  <button onClick={() => setQuestions((prev) => prev.filter((_, i) => i !== qi))} className="rounded-full p-1 text-navy-300 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20" aria-label={`Remove question ${qi + 1}`}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
              <Input value={q.prompt} onChange={(e) => setQ(qi, { prompt: e.target.value })} placeholder="e.g. Solve x² - 5x + 6 = 0" />
              <p className="text-[11px] text-navy-400">Tick the correct answer:</p>
              {q.options.map((opt, oi) => (
                <div key={oi} className="flex items-center gap-2">
                  <button
                    onClick={() => setQ(qi, { correctIndex: oi })}
                    aria-label={`Mark option ${oi + 1} correct`}
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition-colors ${q.correctIndex === oi ? "border-green-600 bg-green-600 text-white" : "border-navy-200 text-transparent hover:border-green-400 dark:border-navy-700"}`}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                  </button>
                  <input
                    value={opt}
                    onChange={(e) => setQ(qi, { options: q.options.map((o, i) => (i === oi ? e.target.value : o)) })}
                    placeholder={`Option ${oi + 1}`}
                    className="w-full rounded-xl border border-navy-200 bg-white px-3 py-1.5 text-sm dark:border-navy-700 dark:bg-navy-900"
                  />
                  {q.options.length > 2 && (
                    <button onClick={() => setQ(qi, { options: q.options.filter((_, i) => i !== oi), correctIndex: q.correctIndex >= oi && q.correctIndex > 0 ? q.correctIndex - 1 : q.correctIndex })} className="text-navy-300 hover:text-red-600" aria-label="Remove option">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
              {q.options.length < 6 && (
                <button onClick={() => setQ(qi, { options: [...q.options, ""] })} className="text-xs font-medium text-green-700 underline dark:text-green-400">+ add option</button>
              )}
            </div>
          ))}
          <Button variant="secondary" onClick={() => setQuestions((prev) => [...prev, { prompt: "", options: ["", ""], correctIndex: 0 }])}>
            <Plus className="h-4 w-4" /> Add question
          </Button>
          <Button onClick={save} disabled={saving || !valid} className="w-full">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Save quiz ({questions.length} question{questions.length === 1 ? "" : "s"})
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Hand-ins (homework submissions + grading)
// ---------------------------------------------------------------------------

interface HwOpt { id: string; title: string; className: string; dueDate: string }
interface SubRow { studentId: string; name: string; admissionNo: string; submission: { id: string; text: string | null; fileUrl: string | null; fileName: string | null; late: boolean; submittedAt: string; gradePct: number | null; feedback: string | null } | null }
interface SubData { homework: { id: string; title: string; dueDate: string; subjectName: string }; students: SubRow[]; submitted: number; graded: number }

function HandinsTab() {
  const { toast } = useToast();
  const [hwList, setHwList] = React.useState<HwOpt[] | null>(null);
  const [hwId, setHwId] = React.useState("");
  const [data, setData] = React.useState<SubData | null>(null);
  const [grading, setGrading] = React.useState<SubRow | null>(null);

  React.useEffect(() => {
    fetch("/api/teacher/homework").then((r) => r.json()).then((j) => {
      if (j.ok) {
        const list = j.data.homework.map((h: { id: string; title: string; className: string; dueDate: string }) => ({ id: h.id, title: h.title, className: h.className, dueDate: h.dueDate }));
        setHwList(list);
        if (list.length) setHwId(list[0].id);
      }
    }).catch(() => setHwList([]));
  }, []);

  const load = React.useCallback(async () => {
    if (!hwId) return;
    setData(null);
    try {
      const res = await fetch(`/api/lms/submissions?homeworkId=${hwId}`);
      const json = await res.json();
      if (json.ok) setData(json.data);
    } catch { /* skeleton remains */ }
  }, [hwId]);
  React.useEffect(() => { load(); }, [load]);

  if (hwList === null) return <Skeleton className="h-40 rounded-2xl" />;
  if (hwList.length === 0) return <EmptyState icon={Inbox} title="No homework tasks yet" description="Assign homework from My Classes — hand-ins land here for grading." />;

  return (
    <div className="space-y-3">
      <select value={hwId} onChange={(e) => setHwId(e.target.value)} className="max-w-full rounded-full border border-navy-200 bg-white px-3.5 py-2 text-sm dark:border-navy-700 dark:bg-navy-900">
        {hwList.map((h) => <option key={h.id} value={h.id}>{h.className} · {h.title}</option>)}
      </select>
      {data === null ? (
        <Skeleton className="h-48 rounded-2xl" />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>{data.homework.title}</CardTitle>
            <p className="mt-1 text-xs text-navy-400">{data.homework.subjectName} · due {data.homework.dueDate} · {data.submitted}/{data.students.length} handed in · {data.graded} graded</p>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-navy-50 dark:divide-navy-800">
              {data.students.map((s) => (
                <li key={s.studentId} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium text-navy-900 dark:text-navy-50">{s.name}</p>
                    <p className="font-mono text-xs text-navy-400">{s.admissionNo}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {s.submission ? (
                      <>
                        {s.submission.late && <Badge tone="amber">late</Badge>}
                        {s.submission.gradePct != null ? (
                          <Badge tone={s.submission.gradePct >= 65 ? "green" : s.submission.gradePct >= 50 ? "amber" : "red"}>{s.submission.gradePct}%</Badge>
                        ) : (
                          <Badge tone="blue">handed in</Badge>
                        )}
                        <Button size="sm" variant="secondary" onClick={() => setGrading(s)}>{s.submission.gradePct != null ? "Re-grade" : "Grade"}</Button>
                      </>
                    ) : (
                      <Badge tone="neutral">missing</Badge>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
      {grading?.submission && (
        <GradeDialog
          row={grading}
          onClose={() => setGrading(null)}
          onDone={() => { setGrading(null); toast({ title: "Grade saved — the family can see it on the portal", tone: "success" }); load(); }}
        />
      )}
    </div>
  );
}

function GradeDialog({ row, onClose, onDone }: { row: SubRow; onClose: () => void; onDone: () => void }) {
  const { toast } = useToast();
  const sub = row.submission!;
  const [gradePct, setGradePct] = React.useState(sub.gradePct != null ? String(sub.gradePct) : "");
  const [feedback, setFeedback] = React.useState(sub.feedback ?? "");
  const [saving, setSaving] = React.useState(false);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/lms/submissions", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "grade", submissionId: sub.id, gradePct: Number(gradePct), feedback: feedback || undefined }),
      });
      const json = await res.json();
      if (json.ok) onDone();
      else toast({ title: json.error?.message || "Could not save the grade", tone: "error" });
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-navy-950/40 p-4 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-card dark:bg-navy-900" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between">
          <h3 className="text-base font-semibold text-navy-900 dark:text-navy-50">Grade — {row.name}</h3>
          <button onClick={onClose} className="rounded-full p-1 text-navy-400 hover:bg-navy-50 dark:hover:bg-navy-800" aria-label="Close"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-3">
          {sub.text && (
            <div className="rounded-xl bg-warm-50 px-3 py-2 text-sm text-navy-700 dark:bg-navy-800 dark:text-navy-200">
              <p className="mb-1 text-[11px] font-medium text-navy-400">Typed answer</p>
              {sub.text}
            </div>
          )}
          {sub.fileUrl && (
            <a href={sub.fileUrl} className="inline-flex items-center gap-1.5 text-sm font-medium text-green-700 underline dark:text-green-400">
              <Download className="h-3.5 w-3.5" /> {sub.fileName ?? "Uploaded work"}
            </a>
          )}
          {sub.late && <Badge tone="amber">handed in late</Badge>}
          <div><Label>Grade (0–100%)</Label><Input type="number" min={0} max={100} value={gradePct} onChange={(e) => setGradePct(e.target.value)} placeholder="e.g. 78" /></div>
          <div>
            <Label>Feedback (optional — the family sees this)</Label>
            <textarea value={feedback} onChange={(e) => setFeedback(e.target.value)} rows={2} placeholder="Vizuri! Revise Q5 — show the factor pairs." className="w-full rounded-2xl border border-navy-200 bg-white px-3.5 py-2.5 text-sm dark:border-navy-700 dark:bg-navy-900" />
          </div>
          <Button onClick={save} disabled={saving || gradePct === ""} className="w-full">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Save grade
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Discussions (teacher view of class forums w/ lock)
// ---------------------------------------------------------------------------

interface ThreadRow { id: string; title: string; authorName: string; authorRole: string; locked: boolean; replies: number }

function ForumTab({ classes }: { classes: ClassOpt[] }) {
  const { toast } = useToast();
  const [classId, setClassId] = React.useState("");
  const [threads, setThreads] = React.useState<ThreadRow[] | null>(null);
  const [open, setOpen] = React.useState<string | null>(null);
  const [composing, setComposing] = React.useState(false);
  const [title, setTitle] = React.useState("");
  const [body, setBody] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => { if (classes.length && !classId) setClassId(classes[0].id); }, [classes, classId]);

  const load = React.useCallback(async () => {
    if (!classId) return;
    setThreads(null);
    try {
      const res = await fetch(`/api/lms/forum?classId=${classId}`);
      const json = await res.json();
      if (json.ok) setThreads(json.data.threads);
    } catch { /* skeleton remains */ }
  }, [classId]);
  React.useEffect(() => { load(); }, [load]);

  async function post() {
    setSaving(true);
    try {
      const res = await fetch("/api/lms/forum", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "thread", classId, title, body }),
      });
      const json = await res.json();
      if (json.ok) { setComposing(false); setTitle(""); setBody(""); toast({ title: "Posted to the class", tone: "success" }); load(); }
      else toast({ title: json.error?.message || "Could not post", tone: "error" });
    } finally { setSaving(false); }
  }

  if (classes.length === 0) return <EmptyState icon={MessageCircle} title="No classes" description="Class discussions appear once you have classes (class teacher or on the timetable)." />;

  if (open) return <div className="max-w-2xl"><ThreadView threadId={open} onBack={() => { setOpen(null); load(); }} canLock /></div>;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <select value={classId} onChange={(e) => setClassId(e.target.value)} className="rounded-full border border-navy-200 bg-white px-3.5 py-2 text-sm dark:border-navy-700 dark:bg-navy-900">
          {classes.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
        <Button size="sm" onClick={() => setComposing(true)}><Plus className="h-3.5 w-3.5" /> New thread</Button>
      </div>
      {threads === null ? (
        <Skeleton className="h-32 rounded-2xl" />
      ) : threads.length === 0 ? (
        <EmptyState icon={MessageCircle} title="No discussions yet" description="Start one — students and parents in this class can read and reply on the portal." />
      ) : (
        <div className="space-y-2">
          {threads.map((t) => (
            <Card key={t.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-2 p-4">
                <button onClick={() => setOpen(t.id)} className="min-w-0 text-left">
                  <p className="text-sm font-semibold text-navy-900 dark:text-navy-50">{t.title}</p>
                  <p className="text-xs text-navy-400">{t.authorName} · {t.replies} repl{t.replies === 1 ? "y" : "ies"}</p>
                </button>
                {t.locked && <Badge tone="neutral">locked</Badge>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      {composing && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-navy-950/40 p-4 backdrop-blur-sm sm:items-center" onClick={() => setComposing(false)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-card dark:bg-navy-900" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-start justify-between">
              <h3 className="text-base font-semibold text-navy-900 dark:text-navy-50">New thread</h3>
              <button onClick={() => setComposing(false)} className="rounded-full p-1 text-navy-400 hover:bg-navy-50 dark:hover:bg-navy-800" aria-label="Close"><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-3">
              <div><Label>Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Revision plan for the CAT" /></div>
              <div>
                <Label>Message</Label>
                <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} className="w-full rounded-2xl border border-navy-200 bg-white px-3.5 py-2.5 text-sm dark:border-navy-700 dark:bg-navy-900" />
              </div>
              <Button onClick={post} disabled={saving || !title.trim() || !body.trim()} className="w-full">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Post to class
              </Button>
            </div>
          </div>
        </div>
      )}
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
