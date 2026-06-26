"use client";

/**
 * B.13 LMS — family portal cards (shared parent/student portal):
 * - SubmitWorkDialog: hand in homework (typed answer and/or A.9 file upload)
 * - QuizzesCard: published quizzes -> take (one attempt) -> instant score + review
 * - ForumCard: class discussion threads + replies (locked threads read-only)
 * Mobile-first; all 4 UX states.
 */
import * as React from "react";
import {
  Loader2, X, FileText, Send, CheckCircle2, ListChecks, MessageCircle,
  Lock, Plus, ChevronLeft,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { FileUpload, type UploadedFile } from "@/components/ui/file-upload";
import { useToast } from "@/components/ui/toast";

// ---------------------------------------------------------------------------
// Homework submission
// ---------------------------------------------------------------------------

export function SubmitWorkDialog({ homeworkId, title, onClose, onDone }: {
  homeworkId: string; title: string; onClose: () => void; onDone: () => void;
}) {
  const { toast } = useToast();
  const [text, setText] = React.useState("");
  const [file, setFile] = React.useState<UploadedFile | null>(null);
  const [saving, setSaving] = React.useState(false);

  async function submit() {
    setSaving(true);
    try {
      const res = await fetch("/api/portal/lms", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "submitHomework", homeworkId,
          text: text || undefined, fileUrl: file?.url, fileName: file?.fileName,
        }),
      });
      const json = await res.json();
      if (json.ok) {
        toast({ title: json.data.late ? "Handed in (marked late)" : "Work handed in ✓", tone: "success" });
        onDone();
      } else toast({ title: json.error?.message || "Could not hand in", tone: "error" });
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-navy-950/40 p-4 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-card dark:bg-navy-900" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between">
          <h3 className="text-base font-semibold text-navy-900 dark:text-navy-50">Hand in — {title}</h3>
          <button onClick={onClose} className="rounded-full p-1 text-navy-400 hover:bg-navy-50 dark:hover:bg-navy-800" aria-label="Close"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <Label>Your answer (optional if you upload a file)</Label>
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} placeholder="Type your answer or a note for the teacher…" className="w-full rounded-2xl border border-navy-200 bg-white px-3.5 py-2.5 text-sm dark:border-navy-700 dark:bg-navy-900" />
          </div>
          <div>
            <Label>Upload your work (photo or PDF)</Label>
            {file ? (
              <p className="flex items-center gap-2 rounded-xl bg-warm-50 px-3 py-2 text-xs text-navy-600 dark:bg-navy-800 dark:text-navy-300">
                <FileText className="h-3.5 w-3.5" /> {file.fileName}
                <button onClick={() => setFile(null)} className="ml-auto text-navy-400 hover:text-red-600" aria-label="Remove file"><X className="h-3.5 w-3.5" /></button>
              </p>
            ) : (
              <div className="flex items-center gap-1 text-xs text-navy-400">
                <FileUpload category="homework-submission" onUploaded={setFile} label="Upload your work" />
                <span>Snap a photo of your exercise book</span>
              </div>
            )}
          </div>
          <Button onClick={submit} disabled={saving || (!text && !file)} className="w-full">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Hand in
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Quizzes
// ---------------------------------------------------------------------------

interface QuizRow {
  id: string; title: string; subjectName: string; teacherName: string;
  instructions: string | null; dueDate: string | null; questions: number; closed: boolean;
  attempt: { scorePct: number; score: number; total: number; submittedAt: string } | null;
}
interface Paper { id: string; title: string; instructions: string | null; subjectName: string; questions: { order: number; prompt: string; options: string[] }[] }
interface ReviewRow { prompt: string; options: string[]; yourAnswer: number; correctIndex: number }

export function QuizzesCard({ studentId }: { studentId: string }) {
  const [rows, setRows] = React.useState<QuizRow[] | null>(null);
  const [taking, setTaking] = React.useState<QuizRow | null>(null);

  const load = React.useCallback(async () => {
    try {
      const res = await fetch(`/api/portal/lms?studentId=${studentId}`);
      const json = await res.json();
      if (json.ok) setRows(json.data.quizzes);
    } catch { /* card stays in skeleton; non-blocking */ }
  }, [studentId]);
  React.useEffect(() => { load(); }, [load]);

  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><ListChecks className="h-4 w-4 text-navy-400" /> Quizzes</CardTitle></CardHeader>
      <CardContent>
        {rows === null ? (
          <Skeleton className="h-16 rounded-2xl" />
        ) : rows.length === 0 ? (
          <p className="py-3 text-center text-sm text-navy-400">Quizzes your teachers publish appear here.</p>
        ) : (
          <ul className="divide-y divide-navy-50 dark:divide-navy-800">
            {rows.map((q) => (
              <li key={q.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                <div className="min-w-0">
                  <p className="font-medium text-navy-900 dark:text-navy-50">{q.title}</p>
                  <p className="text-xs text-navy-400">{q.subjectName} · {q.questions} questions · {q.teacherName}{q.dueDate ? ` · due ${q.dueDate}` : ""}</p>
                </div>
                {q.attempt ? (
                  <Badge tone={q.attempt.scorePct >= 65 ? "green" : q.attempt.scorePct >= 50 ? "amber" : "red"}>
                    {q.attempt.score}/{q.attempt.total} · {q.attempt.scorePct}%
                  </Badge>
                ) : q.closed ? (
                  <Badge tone="neutral">closed</Badge>
                ) : (
                  <Button size="sm" onClick={() => setTaking(q)}>Take quiz</Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
      {taking && <TakeQuizDialog quiz={taking} studentId={studentId} onClose={() => setTaking(null)} onDone={() => { setTaking(null); load(); }} />}
    </Card>
  );
}

function TakeQuizDialog({ quiz, studentId, onClose, onDone }: { quiz: QuizRow; studentId: string; onClose: () => void; onDone: () => void }) {
  const { toast } = useToast();
  const [paper, setPaper] = React.useState<Paper | null>(null);
  const [answers, setAnswers] = React.useState<number[]>([]);
  const [saving, setSaving] = React.useState(false);
  const [result, setResult] = React.useState<{ score: number; total: number; scorePct: number; review: ReviewRow[] } | null>(null);

  React.useEffect(() => {
    fetch(`/api/portal/lms?view=paper&quizId=${quiz.id}&studentId=${studentId}`)
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) { setPaper(j.data); setAnswers(new Array(j.data.questions.length).fill(-1)); }
        else { toast({ title: j.error?.message || "Could not open the quiz", tone: "error" }); onClose(); }
      })
      .catch(() => { toast({ title: "Network problem.", tone: "error" }); onClose(); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quiz.id, studentId]);

  async function submit() {
    setSaving(true);
    try {
      const res = await fetch("/api/portal/lms", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "attemptQuiz", quizId: quiz.id, answers, studentId }),
      });
      const json = await res.json();
      if (json.ok) setResult(json.data);
      else toast({ title: json.error?.message || "Could not submit", tone: "error" });
    } finally { setSaving(false); }
  }

  const answered = answers.filter((a) => a >= 0).length;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-navy-950/40 p-4 backdrop-blur-sm sm:items-center" onClick={result ? onDone : onClose}>
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-card dark:bg-navy-900" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between">
          <h3 className="text-base font-semibold text-navy-900 dark:text-navy-50">{quiz.title}</h3>
          <button onClick={result ? onDone : onClose} className="rounded-full p-1 text-navy-400 hover:bg-navy-50 dark:hover:bg-navy-800" aria-label="Close"><X className="h-4 w-4" /></button>
        </div>

        {result ? (
          <div className="space-y-4">
            <div className="rounded-2xl bg-warm-50 p-4 text-center dark:bg-navy-800">
              <p className="text-3xl font-semibold text-navy-900 dark:text-navy-50">{result.score}/{result.total}</p>
              <p className={`text-sm font-medium ${result.scorePct >= 65 ? "text-green-600" : result.scorePct >= 50 ? "text-amber-600" : "text-red-600"}`}>{result.scorePct}% — auto-graded</p>
            </div>
            <div className="space-y-3">
              {result.review.map((r, i) => (
                <div key={i} className="rounded-xl border border-navy-100 p-3 text-sm dark:border-navy-800">
                  <p className="font-medium text-navy-900 dark:text-navy-50">{i + 1}. {r.prompt}</p>
                  <div className="mt-1.5 space-y-1">
                    {r.options.map((opt, oi) => (
                      <p key={oi} className={`flex items-center gap-1.5 text-xs ${oi === r.correctIndex ? "font-semibold text-green-700 dark:text-green-400" : oi === r.yourAnswer ? "text-red-600 line-through" : "text-navy-400"}`}>
                        {oi === r.correctIndex && <CheckCircle2 className="h-3 w-3" />} {opt}
                      </p>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <Button onClick={onDone} className="w-full">Done</Button>
          </div>
        ) : paper === null ? (
          <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}</div>
        ) : (
          <div className="space-y-4">
            {paper.instructions && <p className="rounded-xl bg-warm-50 px-3 py-2 text-sm text-navy-600 dark:bg-navy-800 dark:text-navy-300">{paper.instructions}</p>}
            {paper.questions.map((q, qi) => (
              <div key={q.order} className="space-y-1.5">
                <p className="text-sm font-medium text-navy-900 dark:text-navy-50">{qi + 1}. {q.prompt}</p>
                <div className="space-y-1">
                  {q.options.map((opt, oi) => (
                    <button
                      key={oi}
                      onClick={() => setAnswers((prev) => { const next = [...prev]; next[qi] = oi; return next; })}
                      className={`block w-full rounded-xl border px-3 py-2 text-left text-sm transition-colors duration-200 ease-apple ${
                        answers[qi] === oi
                          ? "border-green-600 bg-green-50 font-medium text-navy-900 dark:bg-green-900/20 dark:text-navy-50"
                          : "border-navy-100 text-navy-600 hover:bg-warm-50 dark:border-navy-800 dark:text-navy-300"
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <Button onClick={submit} disabled={saving || answered < paper.questions.length} className="w-full">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Submit ({answered}/{paper.questions.length} answered)
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Forum
// ---------------------------------------------------------------------------

interface ThreadRow { id: string; title: string; authorName: string; authorRole: string; locked: boolean; replies: number; createdAt: string }
interface ThreadDetail { id: string; title: string; body: string; authorName: string; authorRole: string; locked: boolean; posts: { id: string; body: string; authorName: string; authorRole: string; createdAt: string }[] }

const ROLE_LABEL: Record<string, string> = {
  TEACHER: "Teacher", CLASS_TEACHER: "Teacher", HOD: "Teacher", DEAN_OF_STUDIES: "Teacher",
  STUDENT: "Student", PARENT: "Parent", PRINCIPAL: "Principal", DEPUTY_PRINCIPAL: "Deputy",
};

export function ForumCard({ classId }: { classId: string }) {
  const { toast } = useToast();
  const [threads, setThreads] = React.useState<ThreadRow[] | null>(null);
  const [open, setOpen] = React.useState<string | null>(null);
  const [composing, setComposing] = React.useState(false);

  const load = React.useCallback(async () => {
    try {
      const res = await fetch(`/api/lms/forum?classId=${classId}`);
      const json = await res.json();
      if (json.ok) setThreads(json.data.threads);
    } catch { /* non-blocking */ }
  }, [classId]);
  React.useEffect(() => { load(); }, [load]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2"><MessageCircle className="h-4 w-4 text-navy-400" /> Class discussion</span>
          <Button size="sm" variant="secondary" onClick={() => setComposing(true)}><Plus className="h-3.5 w-3.5" /> New</Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {open ? (
          <ThreadView threadId={open} onBack={() => { setOpen(null); load(); }} />
        ) : threads === null ? (
          <Skeleton className="h-16 rounded-2xl" />
        ) : threads.length === 0 ? (
          <p className="py-3 text-center text-sm text-navy-400">No discussions yet — ask the class a question.</p>
        ) : (
          <ul className="divide-y divide-navy-50 dark:divide-navy-800">
            {threads.map((t) => (
              <li key={t.id}>
                <button onClick={() => setOpen(t.id)} className="flex w-full flex-wrap items-center justify-between gap-2 py-2.5 text-left text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-navy-900 dark:text-navy-50">{t.locked && <Lock className="mr-1 inline h-3 w-3 text-navy-400" />}{t.title}</p>
                    <p className="text-xs text-navy-400">{t.authorName} · {ROLE_LABEL[t.authorRole] ?? t.authorRole}</p>
                  </div>
                  <Badge tone="neutral">{t.replies} repl{t.replies === 1 ? "y" : "ies"}</Badge>
                </button>
              </li>
            ))}
          </ul>
        )}
        {composing && (
          <NewThreadDialog
            classId={classId}
            onClose={() => setComposing(false)}
            onDone={() => { setComposing(false); toast({ title: "Posted to the class", tone: "success" }); load(); }}
          />
        )}
      </CardContent>
    </Card>
  );
}

export function ThreadView({ threadId, onBack, canLock = false }: { threadId: string; onBack: () => void; canLock?: boolean }) {
  const { toast } = useToast();
  const [thread, setThread] = React.useState<ThreadDetail | null>(null);
  const [reply, setReply] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const load = React.useCallback(async () => {
    const res = await fetch(`/api/lms/forum?threadId=${threadId}`);
    const json = await res.json();
    if (json.ok) setThread(json.data);
  }, [threadId]);
  React.useEffect(() => { load(); }, [load]);

  async function send() {
    setSaving(true);
    try {
      const res = await fetch("/api/lms/forum", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "post", threadId, body: reply }),
      });
      const json = await res.json();
      if (json.ok) { setReply(""); load(); }
      else toast({ title: json.error?.message || "Could not post", tone: "error" });
    } finally { setSaving(false); }
  }

  async function toggleLock() {
    if (!thread) return;
    const res = await fetch("/api/lms/forum", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "lock", threadId, locked: !thread.locked }),
    });
    const json = await res.json();
    if (json.ok) { toast({ title: thread.locked ? "Thread unlocked" : "Thread locked", tone: "success" }); load(); }
    else toast({ title: json.error?.message || "Could not change lock", tone: "error" });
  }

  if (thread === null) return <Skeleton className="h-32 rounded-2xl" />;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="inline-flex items-center gap-1 text-xs font-medium text-navy-500 hover:text-navy-900 dark:text-navy-400">
          <ChevronLeft className="h-3.5 w-3.5" /> All discussions
        </button>
        {canLock && (
          <Button size="sm" variant="secondary" onClick={toggleLock}>
            <Lock className="h-3.5 w-3.5" /> {thread.locked ? "Unlock" : "Lock"}
          </Button>
        )}
      </div>
      <div className="rounded-xl bg-warm-50 p-3 dark:bg-navy-800">
        <p className="text-sm font-semibold text-navy-900 dark:text-navy-50">{thread.title}</p>
        <p className="mt-0.5 text-xs text-navy-400">{thread.authorName} · {ROLE_LABEL[thread.authorRole] ?? thread.authorRole}</p>
        <p className="mt-1.5 text-sm text-navy-700 dark:text-navy-200">{thread.body}</p>
      </div>
      {thread.posts.map((p) => (
        <div key={p.id} className="rounded-xl border border-navy-100 p-3 dark:border-navy-800">
          <p className="text-xs font-medium text-navy-500 dark:text-navy-400">{p.authorName} · {ROLE_LABEL[p.authorRole] ?? p.authorRole}</p>
          <p className="mt-1 text-sm text-navy-700 dark:text-navy-200">{p.body}</p>
        </div>
      ))}
      {thread.locked ? (
        <p className="flex items-center justify-center gap-1.5 rounded-xl bg-warm-50 py-2 text-xs text-navy-400 dark:bg-navy-800"><Lock className="h-3 w-3" /> This thread is locked by the teacher.</p>
      ) : (
        <div className="flex gap-2">
          <Input value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Write a reply…" />
          <Button onClick={send} disabled={saving || !reply.trim()}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}</Button>
        </div>
      )}
    </div>
  );
}

function NewThreadDialog({ classId, onClose, onDone }: { classId: string; onClose: () => void; onDone: () => void }) {
  const { toast } = useToast();
  const [title, setTitle] = React.useState("");
  const [body, setBody] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  async function post() {
    setSaving(true);
    try {
      const res = await fetch("/api/lms/forum", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "thread", classId, title, body }),
      });
      const json = await res.json();
      if (json.ok) onDone();
      else toast({ title: json.error?.message || "Could not post", tone: "error" });
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-navy-950/40 p-4 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-card dark:bg-navy-900" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between">
          <h3 className="text-base font-semibold text-navy-900 dark:text-navy-50">Start a discussion</h3>
          <button onClick={onClose} className="rounded-full p-1 text-navy-400 hover:bg-navy-50 dark:hover:bg-navy-800" aria-label="Close"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-3">
          <div><Label>Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Question about the homework" /></div>
          <div>
            <Label>Message</Label>
            <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} placeholder="Ask the class or the teacher…" className="w-full rounded-2xl border border-navy-200 bg-white px-3.5 py-2.5 text-sm dark:border-navy-700 dark:bg-navy-900" />
          </div>
          <Button onClick={post} disabled={saving || !title.trim() || !body.trim()} className="w-full">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Post
          </Button>
        </div>
      </div>
    </div>
  );
}
