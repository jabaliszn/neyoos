"use client";

/**
 * B.12 Teacher Portal UI — "My Classes".
 * Home: class cards + today's lessons + my weekly timetable.
 * Tabs per concern: Homework / Notes / Class report.
 * One-tap links into the engines that already exist:
 *   Record attendance -> /attendance, Enter marks -> /exams,
 *   Lesson plans -> /academics, Roster -> /students?classId=.
 * All 4 UX states. Mobile-first.
 */
import * as React from "react";
import {
  School, AlertCircle, Loader2, X, Plus, BookOpen, FileText, Trash2,
  CalendarCheck, ClipboardList, Users, BarChart3, CalendarDays, Download, UserCog,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { FileUpload, type UploadedFile } from "@/components/ui/file-upload";
import { useToast } from "@/components/ui/toast";
import { ClassChatButton } from "@/components/portal/library-card";

interface ClassCard { id: string; label: string; curriculum: string; isClassTeacher: boolean; students: number; subjects: string[]; openHomework: number }
interface TodayLesson { period: number; subjectName: string; subjectCode: string; className: string; classId: string }
interface Home { classes: ClassCard[]; todayLessons: TodayLesson[] }
interface TtSlot { id: string; dayOfWeek: number; period: number; subjectName: string; subjectCode: string; className: string }
interface CoverageRow { id: string; period: number; classId: string; className: string; subjectName: string | null; originalTeacherName: string }
interface HwRow { id: string; classId: string; className: string; subjectName: string; subjectCode: string; teacherName: string; title: string; instructions: string | null; dueDate: string; fileUrl: string | null; fileName: string | null; mine: boolean }
interface NoteRow { id: string; classId: string; className: string; subjectName: string; subjectCode: string; teacherName: string; title: string; description: string | null; fileUrl: string; fileName: string; mine: boolean }
interface Subject { id: string; name: string; code: string }
interface Report {
  class: { id: string; label: string; curriculum: string; isClassTeacher: boolean };
  summary: { students: number; boys: number; girls: number; attendancePct30d: number | null; latestExam: { name: string; published: boolean; meanPct: number | null } | null };
  students: { id: string; name: string; admissionNo: string; gender: string; attendancePct: number | null; absences30d: number; examAvgPct: number | null }[];
}

const DAYS = ["", "Mon", "Tue", "Wed", "Thu", "Fri"];

export function TeacherPortalClient({ canAssign }: { canAssign: boolean }) {
  const [home, setHome] = React.useState<Home | null>(null);
  const [error, setError] = React.useState(false);
  const [tab, setTab] = React.useState<"overview" | "homework" | "notes" | "report">("overview");
  const [subjects, setSubjects] = React.useState<Subject[]>([]);

  const load = React.useCallback(async () => {
    setError(false);
    try {
      const res = await fetch("/api/teacher");
      const json = await res.json();
      if (json.ok) setHome(json.data); else setError(true);
    } catch { setError(true); }
  }, []);
  React.useEffect(() => {
    load();
    fetch("/api/academics/subjects").then((r) => r.json()).then((j) => j.ok && setSubjects(j.data.subjects)).catch(() => {});
  }, [load]);

  if (error) return <LoadError onRetry={load} />;
  if (home === null) return <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}</div>;

  const tabs = [
    { key: "overview" as const, label: "Overview", icon: School },
    { key: "homework" as const, label: "Homework", icon: BookOpen },
    { key: "notes" as const, label: "Notes", icon: FileText },
    { key: "report" as const, label: "Class report", icon: BarChart3 },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
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
        <a href="/api/teacher/day-one-pack" download>
          <Button size="sm" variant="secondary">
            <Download className="h-3.5 w-3.5" /> Mwalimu Day-Pack
          </Button>
        </a>
      </div>

      {tab === "overview" && <Overview home={home} />}
      {tab === "homework" && <HomeworkTab classes={home.classes} subjects={subjects} canAssign={canAssign} />}
      {tab === "notes" && <NotesTab classes={home.classes} subjects={subjects} canAssign={canAssign} />}
      {tab === "report" && <ReportTab classes={home.classes} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Overview: class cards + today's lessons + weekly timetable
// ---------------------------------------------------------------------------

function Overview({ home }: { home: Home }) {
  const [slots, setSlots] = React.useState<TtSlot[] | null>(null);
  const [coverage, setCoverage] = React.useState<CoverageRow[] | null>(null);
  React.useEffect(() => {
    fetch("/api/teacher/timetable").then((r) => r.json()).then((j) => j.ok && setSlots(j.data.slots)).catch(() => setSlots([]));
    fetch("/api/hr?view=my-coverage").then((r) => r.json()).then((j) => j.ok && setCoverage(j.data.coverage)).catch(() => setCoverage([]));
  }, []);

  return (
    <div className="space-y-4">
      {/* T.12 — real substitute-cover duties for THIS teacher, today only */}
      {coverage !== null && coverage.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><UserCog className="h-4 w-4 text-amber-600" /> You're covering a class today</CardTitle></CardHeader>
          <CardContent>
            <ul className="divide-y divide-navy-50 dark:divide-navy-800">
              {coverage.map((c) => (
                <li key={c.id} className="flex items-center justify-between py-2 text-sm">
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-50 font-mono text-xs font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">P{c.period}</span>
                    <div>
                      <p className="font-medium text-navy-900 dark:text-navy-50">{c.subjectName ?? c.className}</p>
                      <p className="text-xs text-navy-400">{c.className} · covering for {c.originalTeacherName}</p>
                    </div>
                  </div>
                  <Badge tone="amber">substitute</Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* today's lessons */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-green-600" /> Today&apos;s lessons</CardTitle></CardHeader>
        <CardContent>
          {home.todayLessons.length === 0 ? (
            <p className="py-2 text-center text-sm text-navy-400">No lessons on your timetable today.</p>
          ) : (
            <ul className="divide-y divide-navy-50 dark:divide-navy-800">
              {home.todayLessons.map((l) => (
                <li key={`${l.period}-${l.classId}`} className="flex items-center justify-between py-2 text-sm">
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-green-50 font-mono text-xs font-semibold text-green-700 dark:bg-green-900/30 dark:text-green-300">P{l.period}</span>
                    <div>
                      <p className="font-medium text-navy-900 dark:text-navy-50">{l.subjectName}</p>
                      <p className="text-xs text-navy-400">{l.className}</p>
                    </div>
                  </div>
                  <Badge tone="neutral">{l.subjectCode}</Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* class cards */}
      {home.classes.length === 0 ? (
        <EmptyState icon={School} title="No classes assigned yet" description="Ask the admin to set you as a class teacher or put you on the timetable — your classes appear here automatically." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {home.classes.map((c) => (
            <Card key={c.id}>
              <CardContent className="space-y-3 p-5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-base font-semibold text-navy-900 dark:text-navy-50">{c.label}</p>
                    <p className="text-xs text-navy-400">{c.curriculum} · {c.students} students{c.subjects.length ? ` · you teach ${c.subjects.join(", ")}` : ""}</p>
                  </div>
                  {c.isClassTeacher && <Badge tone="green">class teacher</Badge>}
                </div>
                {c.openHomework > 0 && (
                  <p className="flex items-center gap-1.5 text-xs text-navy-500 dark:text-navy-400">
                    <BookOpen className="h-3.5 w-3.5 text-green-600" /> {c.openHomework} open homework task{c.openHomework > 1 ? "s" : ""}
                  </p>
                )}
                <div className="flex flex-wrap gap-1.5">
                  <a href="/attendance"><Button size="sm" variant="secondary"><CalendarCheck className="h-3.5 w-3.5" /> Register</Button></a>
                  <a href="/exams"><Button size="sm" variant="secondary"><ClipboardList className="h-3.5 w-3.5" /> Marks</Button></a>
                  <a href={`/students?classId=${c.id}`}><Button size="sm" variant="secondary"><Users className="h-3.5 w-3.5" /> Roster</Button></a>
                  <ClassChatButton classId={c.id} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* weekly timetable */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-navy-400" /> My weekly timetable</CardTitle></CardHeader>
        <CardContent>
          {slots === null ? (
            <Skeleton className="h-36 rounded-2xl" />
          ) : slots.length === 0 ? (
            <p className="py-2 text-center text-sm text-navy-400">You&apos;re not on the timetable yet — set in Academics → Timetable.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-xs">
                <thead>
                  <tr>
                    <th className="p-1.5 text-left font-semibold text-navy-400">#</th>
                    {[1, 2, 3, 4, 5].map((d) => <th key={d} className="p-1.5 text-left font-semibold text-navy-600 dark:text-navy-300">{DAYS[d]}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {[...new Set(slots.map((s) => s.period))].sort((a, b) => a - b).map((p) => (
                    <tr key={p}>
                      <td className="p-1.5 font-mono text-navy-400">P{p}</td>
                      {[1, 2, 3, 4, 5].map((d) => {
                        const slot = slots.find((s) => s.dayOfWeek === d && s.period === p);
                        return (
                          <td key={d} className="p-1.5">
                            {slot ? (
                              <div className="rounded-md bg-green-50 px-1.5 py-1 dark:bg-green-900/20">
                                <p className="font-semibold text-navy-800 dark:text-navy-100">{slot.subjectCode}</p>
                                <p className="text-[10px] text-navy-400">{slot.className}</p>
                              </div>
                            ) : (
                              <span className="text-navy-200 dark:text-navy-700">—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-navy-400">
        Lesson plans live in <a href="/academics" className="font-medium underline">Academics → Lessons</a>. AI lesson-plan assist arrives with the AI layer (B.23).
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Homework tab
// ---------------------------------------------------------------------------

function HomeworkTab({ classes, subjects, canAssign }: { classes: ClassCard[]; subjects: Subject[]; canAssign: boolean }) {
  const { toast } = useToast();
  const [rows, setRows] = React.useState<HwRow[] | null>(null);
  const [error, setError] = React.useState(false);
  const [openNew, setOpenNew] = React.useState(false);

  const load = React.useCallback(async () => {
    setError(false);
    try {
      const res = await fetch("/api/teacher/homework");
      const json = await res.json();
      if (json.ok) setRows(json.data.homework); else setError(true);
    } catch { setError(true); }
  }, []);
  React.useEffect(() => { load(); }, [load]);

  async function remove(id: string) {
    const res = await fetch(`/api/teacher/homework?id=${id}`, { method: "DELETE" });
    const json = await res.json();
    if (json.ok) { toast({ title: "Homework removed", tone: "success" }); load(); }
    else toast({ title: json.error?.message || "Could not remove", tone: "error" });
  }

  if (error) return <LoadError onRetry={load} />;
  if (rows === null) return <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}</div>;

  const today = new Date(Date.now() + 3 * 3600_000).toISOString().slice(0, 10);

  return (
    <div className="space-y-3">
      {canAssign && <Button onClick={() => setOpenNew(true)}><Plus className="h-4 w-4" /> Assign homework</Button>}
      {rows.length === 0 ? (
        <EmptyState icon={BookOpen} title="No homework yet" description="Assign the first task — parents and students see it on the family portal instantly." action={canAssign ? <Button onClick={() => setOpenNew(true)}><Plus className="h-4 w-4" /> Assign homework</Button> : undefined} />
      ) : (
        <div className="space-y-2">
          {rows.map((h) => (
            <Card key={h.id}>
              <CardContent className="flex flex-wrap items-start justify-between gap-2 p-4">
                <div className="min-w-0 space-y-0.5">
                  <p className="text-sm font-semibold text-navy-900 dark:text-navy-50">{h.title}</p>
                  <p className="text-xs text-navy-400">{h.className} · {h.subjectName} · by {h.teacherName}</p>
                  {h.instructions && <p className="text-xs text-navy-500 dark:text-navy-400">{h.instructions}</p>}
                  {h.fileUrl && <a href={h.fileUrl} className="inline-flex items-center gap-1 text-xs font-medium text-green-700 underline dark:text-green-400"><Download className="h-3 w-3" /> {h.fileName ?? "Attachment"}</a>}
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={h.dueDate < today ? "neutral" : "amber"}>{h.dueDate < today ? `closed ${h.dueDate}` : `due ${h.dueDate}`}</Badge>
                  {h.mine && (
                    <button onClick={() => remove(h.id)} className="rounded-full p-1.5 text-navy-300 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20" aria-label="Remove homework">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      {openNew && <HomeworkDialog classes={classes} subjects={subjects} onClose={() => setOpenNew(false)} onDone={() => { setOpenNew(false); load(); }} />}
    </div>
  );
}

function HomeworkDialog({ classes, subjects, onClose, onDone }: { classes: ClassCard[]; subjects: Subject[]; onClose: () => void; onDone: () => void }) {
  const { toast } = useToast();
  const [f, setF] = React.useState({ classId: classes[0]?.id ?? "", subjectId: "", title: "", instructions: "", dueDate: "" });
  const [file, setFile] = React.useState<UploadedFile | null>(null);
  const [saving, setSaving] = React.useState(false);
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/teacher/homework", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classId: f.classId, subjectId: f.subjectId, title: f.title,
          instructions: f.instructions || undefined, dueDate: f.dueDate,
          fileUrl: file?.url, fileName: file?.fileName,
        }),
      });
      const json = await res.json();
      if (json.ok) { toast({ title: "Homework assigned — families can see it now", tone: "success" }); onDone(); }
      else toast({ title: json.error?.message || "Could not assign homework", tone: "error" });
    } finally { setSaving(false); }
  }

  const select = "w-full rounded-2xl border border-navy-200 bg-white px-3.5 py-2.5 text-sm dark:border-navy-700 dark:bg-navy-900";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-navy-950/40 p-4 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-card dark:bg-navy-900" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between">
          <h3 className="text-base font-semibold text-navy-900 dark:text-navy-50">Assign homework</h3>
          <button onClick={onClose} className="rounded-full p-1 text-navy-400 hover:bg-navy-50 dark:hover:bg-navy-800" aria-label="Close"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-3">
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
          <div><Label>Title</Label><Input value={f.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. KLB Bk 3 — Exercise 4.2, Q1-8" /></div>
          <div>
            <Label>Instructions (optional)</Label>
            <textarea value={f.instructions} onChange={(e) => set("instructions", e.target.value)} rows={3} placeholder="Show all working. Submit Thursday morning." className="w-full rounded-2xl border border-navy-200 bg-white px-3.5 py-2.5 text-sm dark:border-navy-700 dark:bg-navy-900" />
          </div>
          <div><Label>Due date</Label><Input type="date" value={f.dueDate} onChange={(e) => set("dueDate", e.target.value)} /></div>
          <div>
            <Label>Attachment (optional)</Label>
            {file ? (
              <p className="flex items-center gap-2 rounded-xl bg-warm-50 px-3 py-2 text-xs text-navy-600 dark:bg-navy-800 dark:text-navy-300">
                <FileText className="h-3.5 w-3.5" /> {file.fileName}
                <button onClick={() => setFile(null)} className="ml-auto text-navy-400 hover:text-red-600" aria-label="Remove file"><X className="h-3.5 w-3.5" /></button>
              </p>
            ) : (
              <div className="flex items-center gap-1 text-xs text-navy-400">
                <FileUpload category="homework" onUploaded={setFile} label="Attach a file (PDF/image)" />
                <span>Attach a PDF or photo of the task sheet</span>
              </div>
            )}
          </div>
          <Button onClick={save} disabled={saving || !f.classId || !f.subjectId || !f.title || !f.dueDate} className="w-full">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Assign to class
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Notes tab
// ---------------------------------------------------------------------------

function NotesTab({ classes, subjects, canAssign }: { classes: ClassCard[]; subjects: Subject[]; canAssign: boolean }) {
  const { toast } = useToast();
  const [rows, setRows] = React.useState<NoteRow[] | null>(null);
  const [error, setError] = React.useState(false);
  const [openNew, setOpenNew] = React.useState(false);

  const load = React.useCallback(async () => {
    setError(false);
    try {
      const res = await fetch("/api/teacher/notes");
      const json = await res.json();
      if (json.ok) setRows(json.data.notes); else setError(true);
    } catch { setError(true); }
  }, []);
  React.useEffect(() => { load(); }, [load]);

  async function remove(id: string) {
    const res = await fetch(`/api/teacher/notes?id=${id}`, { method: "DELETE" });
    const json = await res.json();
    if (json.ok) { toast({ title: "Notes removed", tone: "success" }); load(); }
    else toast({ title: json.error?.message || "Could not remove", tone: "error" });
  }

  if (error) return <LoadError onRetry={load} />;
  if (rows === null) return <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16 rounded-2xl" />)}</div>;

  return (
    <div className="space-y-3">
      {canAssign && <Button onClick={() => setOpenNew(true)}><Plus className="h-4 w-4" /> Upload notes</Button>}
      {rows.length === 0 ? (
        <EmptyState icon={FileText} title="No notes shared yet" description="Upload revision notes or a past paper — students download them from the family portal." action={canAssign ? <Button onClick={() => setOpenNew(true)}><Plus className="h-4 w-4" /> Upload notes</Button> : undefined} />
      ) : (
        <div className="space-y-2">
          {rows.map((n) => (
            <Card key={n.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-2 p-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-navy-900 dark:text-navy-50">{n.title}</p>
                  <p className="text-xs text-navy-400">{n.className} · {n.subjectName} · by {n.teacherName}{n.description ? ` · ${n.description}` : ""}</p>
                </div>
                <div className="flex items-center gap-2">
                  <a href={n.fileUrl} download={n.fileName}><Button size="sm" variant="secondary"><Download className="h-3.5 w-3.5" /> Download</Button></a>
                  {n.mine && (
                    <button onClick={() => remove(n.id)} className="rounded-full p-1.5 text-navy-300 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20" aria-label="Remove notes">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      {openNew && <NoteDialog classes={classes} subjects={subjects} onClose={() => setOpenNew(false)} onDone={() => { setOpenNew(false); load(); }} />}
    </div>
  );
}

function NoteDialog({ classes, subjects, onClose, onDone }: { classes: ClassCard[]; subjects: Subject[]; onClose: () => void; onDone: () => void }) {
  const { toast } = useToast();
  const [f, setF] = React.useState({ classId: classes[0]?.id ?? "", subjectId: "", title: "", description: "" });
  const [file, setFile] = React.useState<UploadedFile | null>(null);
  const [saving, setSaving] = React.useState(false);
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));

  async function save() {
    if (!file) { toast({ title: "Upload the notes file first.", tone: "error" }); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/teacher/notes", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classId: f.classId, subjectId: f.subjectId, title: f.title,
          description: f.description || undefined, fileUrl: file.url, fileName: file.fileName,
        }),
      });
      const json = await res.json();
      if (json.ok) { toast({ title: "Notes shared with the class", tone: "success" }); onDone(); }
      else toast({ title: json.error?.message || "Could not share the notes", tone: "error" });
    } finally { setSaving(false); }
  }

  const select = "w-full rounded-2xl border border-navy-200 bg-white px-3.5 py-2.5 text-sm dark:border-navy-700 dark:bg-navy-900";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-navy-950/40 p-4 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-card dark:bg-navy-900" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between">
          <h3 className="text-base font-semibold text-navy-900 dark:text-navy-50">Upload class notes</h3>
          <button onClick={onClose} className="rounded-full p-1 text-navy-400 hover:bg-navy-50 dark:hover:bg-navy-800" aria-label="Close"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-3">
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
          <div><Label>Title</Label><Input value={f.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Quadratics revision notes" /></div>
          <div><Label>Description (optional)</Label><Input value={f.description} onChange={(e) => set("description", e.target.value)} placeholder="Covers completing the square + past paper Qs" /></div>
          <div>
            <Label>File (PDF, DOC or image)</Label>
            {file ? (
              <p className="flex items-center gap-2 rounded-xl bg-warm-50 px-3 py-2 text-xs text-navy-600 dark:bg-navy-800 dark:text-navy-300">
                <FileText className="h-3.5 w-3.5" /> {file.fileName}
                <button onClick={() => setFile(null)} className="ml-auto text-navy-400 hover:text-red-600" aria-label="Remove file"><X className="h-3.5 w-3.5" /></button>
              </p>
            ) : (
              <div className="flex items-center gap-1 text-xs text-navy-400">
                <FileUpload
                  category="notes"
                  accept="image/*,application/pdf,.doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  onUploaded={setFile}
                  label="Upload notes file"
                />
                <span>Upload the notes (PDF, DOC or photo)</span>
              </div>
            )}
          </div>
          <Button onClick={save} disabled={saving || !f.classId || !f.subjectId || !f.title || !file} className="w-full">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Share with class
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Class report tab
// ---------------------------------------------------------------------------

function ReportTab({ classes }: { classes: ClassCard[] }) {
  const [classId, setClassId] = React.useState(classes[0]?.id ?? "");
  const [report, setReport] = React.useState<Report | null>(null);
  const [error, setError] = React.useState(false);

  const load = React.useCallback(async () => {
    if (!classId) return;
    setError(false); setReport(null);
    try {
      const res = await fetch(`/api/teacher/report?classId=${classId}`);
      const json = await res.json();
      if (json.ok) setReport(json.data); else setError(true);
    } catch { setError(true); }
  }, [classId]);
  React.useEffect(() => { load(); }, [load]);

  if (classes.length === 0) return <EmptyState icon={BarChart3} title="No classes to report on" description="You'll see a class report once you're assigned a class or appear on the timetable." />;

  return (
    <div className="space-y-3">
      <select value={classId} onChange={(e) => setClassId(e.target.value)} className="rounded-full border border-navy-200 bg-white px-3.5 py-2 text-sm dark:border-navy-700 dark:bg-navy-900">
        {classes.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
      </select>

      {error ? (
        <LoadError onRetry={load} />
      ) : report === null ? (
        <div className="space-y-3"><Skeleton className="h-24 rounded-2xl" /><Skeleton className="h-48 rounded-2xl" /></div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Tile label="Students" value={`${report.summary.students}`} sub={`${report.summary.boys} boys · ${report.summary.girls} girls`} />
            <Tile label="Attendance (30d)" value={report.summary.attendancePct30d === null ? "—" : `${report.summary.attendancePct30d}%`} />
            <Tile label="Latest exam" value={report.summary.latestExam ? `${report.summary.latestExam.meanPct ?? "—"}%` : "—"} sub={report.summary.latestExam ? `${report.summary.latestExam.name}${report.summary.latestExam.published ? "" : " (unreleased)"}` : "no exams yet"} />
            <Tile label="Class teacher" value={report.class.isClassTeacher ? "You ✓" : "—"} sub={report.class.curriculum} />
          </div>

          <Card>
            <CardHeader><CardTitle>Students — {report.class.label}</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-sm">
                  <thead>
                    <tr className="text-left text-xs text-navy-400">
                      <th className="pb-2 font-medium">Student</th>
                      <th className="pb-2 font-medium">Adm No</th>
                      <th className="pb-2 font-medium">Attendance 30d</th>
                      <th className="pb-2 font-medium">Absences</th>
                      <th className="pb-2 font-medium">Exam avg</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-navy-50 dark:divide-navy-800">
                    {report.students.map((s) => (
                      <tr key={s.id}>
                        <td className="py-2 font-medium text-navy-900 dark:text-navy-50">{s.name}</td>
                        <td className="py-2 font-mono text-xs text-navy-500">{s.admissionNo}</td>
                        <td className="py-2">
                          {s.attendancePct === null ? <span className="text-navy-300">—</span> : (
                            <span className={s.attendancePct >= 90 ? "text-green-600" : s.attendancePct >= 75 ? "text-amber-600" : "text-red-600"}>{s.attendancePct}%</span>
                          )}
                        </td>
                        <td className="py-2">{s.absences30d > 0 ? <Badge tone={s.absences30d >= 3 ? "red" : "amber"}>{s.absences30d}</Badge> : <span className="text-navy-300">0</span>}</td>
                        <td className="py-2">{s.examAvgPct === null ? <span className="text-navy-300">—</span> : `${s.examAvgPct}%`}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-navy-100/70 bg-white px-4 py-3 dark:border-navy-800 dark:bg-navy-900">
      <p className="text-[11px] text-navy-400">{label}</p>
      <p className="text-lg font-semibold text-navy-900 dark:text-navy-50">{value}</p>
      {sub && <p className="text-[11px] text-navy-400">{sub}</p>}
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
