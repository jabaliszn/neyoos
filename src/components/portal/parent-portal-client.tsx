"use client";

/**
 * B.10 Parent Portal — "My Children". Child cards -> child detail with
 * attendance, published results (+ report card PDF), fees (+ pay via STK),
 * and message-the-teacher shortcuts. Mobile-first: parents are on phones.
 */
import * as React from "react";
import {
  GraduationCap, AlertCircle, Loader2, ArrowLeft, FileText, Wallet,
  CalendarCheck, MessageSquare, Smartphone, X, BookOpen, Download, Calendar,
  UserCheck, ShieldCheck, KeyRound, Trash2, Camera, FolderOpen,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { SubmitWorkDialog, QuizzesCard, ForumCard } from "@/components/portal/lms-cards";
import { LibraryCard, ClassChatButton } from "@/components/portal/library-card";
import { UniformCard } from "@/components/portal/uniform-card";
import { MessageButton } from "@/components/messaging/message-button";
import { FileUpload, type UploadedFile } from "@/components/ui/file-upload";
import { StudentCompetencySummaryCard } from "@/components/competencies/competency-framework-components";
import { SkillsPassportCard } from "@/components/skills-passport/skills-passport-card";
import { LearnerJourneyCard } from "@/components/learner-journey/learner-journey-card";

const kes = (n: number) => `KES ${n.toLocaleString("en-KE")}`;

interface ChildCard { id: string; name: string; admissionNo: string; photoUrl: string | null; className: string | null; attendancePct: number | null; lastAbsent: string | null; feeBalanceKes: number; latestPublishedExam: { examId: string; name: string; year: number; term: number } | null }
interface ChildDetail {
  timetable: { dayOfWeek: number; period: number; code: string; name: string }[];
  child: { id: string; name: string; admissionNo: string; photoUrl: string | null; className: string | null; classId: string | null };
  attendance: { date: string; status: string; note: string | null }[];
  invoices: { id: string; invoiceNo: string; description: string; totalKes: number; discountKes: number; paidKes: number; balanceKes: number; status: string; dueDate: string }[];
  exams: { examId: string; name: string; year: number; term: number; subjects: number; avgPct: number }[];
  homework: { id: string; title: string; instructions: string | null; subjectName: string; subjectCode: string; teacherName: string; dueDate: string; overdue: boolean; fileUrl: string | null; fileName: string | null; submission: { id: string; late: boolean; submittedAt: string; gradePct: number | null; feedback: string | null } | null }[];
  notes: { id: string; title: string; description: string | null; subjectName: string; subjectCode: string; teacherName: string; fileUrl: string; fileName: string; createdAt: string }[];
  pickupPersons: { id: string; fullName: string; relationship: string; phone: string; nationalId: string | null; createdAt: string }[];
  altPickups: { id: string; pickerName: string; pickerPhone: string | null; relationship: string | null; code: string; screenshotUrl: string | null; expiresAt: string; status: string }[];
  contacts: { id: string; fullName: string; role: string }[];
}

const ATT_TONE: Record<string, "green" | "red" | "amber" | "neutral"> = { P: "green", A: "red", L: "amber", E: "neutral" };
const ATT_LABEL: Record<string, string> = { P: "Present", A: "Absent", L: "Late", E: "Excused" };

export function ParentPortalClient() {
  const [children, setChildren] = React.useState<ChildCard[] | null>(null);
  const [error, setError] = React.useState(false);
  const [openChild, setOpenChild] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setError(false);
    try {
      const res = await fetch("/api/portal");
      const json = await res.json();
      if (json.ok) setChildren(json.data.children); else setError(true);
    } catch { setError(true); }
  }, []);
  React.useEffect(() => { load(); }, [load]);

  if (openChild) return <ChildView id={openChild} onBack={() => { setOpenChild(null); load(); }} />;
  if (error) return <LoadError onRetry={load} />;
  if (children === null) return <div className="grid gap-3 sm:grid-cols-2">{[...Array(2)].map((_, i) => <Skeleton key={i} className="h-44 rounded-2xl" />)}</div>;

  return children.length === 0 ? (
    <EmptyState icon={GraduationCap} title="No children linked yet" description="Ask the school office to link your phone number to your child's record." />
  ) : (
    <div className="grid gap-4 sm:grid-cols-2">
      {children.map((c) => (
        <button key={c.id} onClick={() => setOpenChild(c.id)} className="text-left">
          <Card className="h-full transition-shadow duration-200 ease-apple hover:shadow-card">
            <CardContent className="space-y-3 p-5">
              <div className="flex items-center gap-3">
                <Avatar name={c.name} photoUrl={c.photoUrl} />
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold text-navy-900 dark:text-navy-50">{c.name}</p>
                  <p className="text-xs text-navy-400">{c.className ?? "—"} · <span className="font-mono">{c.admissionNo}</span></p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl bg-warm-50 px-3 py-2 dark:bg-navy-800">
                  <p className="text-[11px] text-navy-400">Attendance (30d)</p>
                  <p className={`text-sm font-semibold ${c.attendancePct === null ? "text-navy-400" : c.attendancePct >= 90 ? "text-green-600" : c.attendancePct >= 75 ? "text-amber-600" : "text-red-600"}`}>
                    {c.attendancePct === null ? "—" : `${c.attendancePct}%`}
                  </p>
                </div>
                <div className="rounded-xl bg-warm-50 px-3 py-2 dark:bg-navy-800">
                  <p className="text-[11px] text-navy-400">Fee balance</p>
                  <p className={`text-sm font-semibold ${c.feeBalanceKes > 0 ? "text-red-600" : "text-green-600"}`}>{c.feeBalanceKes > 0 ? kes(c.feeBalanceKes) : "Cleared ✓"}</p>
                </div>
              </div>
              {c.latestPublishedExam && (
                <p className="flex items-center gap-1.5 text-xs text-navy-500 dark:text-navy-400">
                  <FileText className="h-3.5 w-3.5 text-green-600" /> New results: {c.latestPublishedExam.name}
                </p>
              )}
            </CardContent>
          </Card>
        </button>
      ))}
    </div>
  );
}

function ChildView({ id, onBack }: { id: string; onBack: () => void }) {
  const { toast } = useToast();
  const [data, setData] = React.useState<ChildDetail | null>(null);
  const [error, setError] = React.useState(false);
  const [payInvoice, setPayInvoice] = React.useState<ChildDetail["invoices"][number] | null>(null);
  const [commitInvoice, setCommitInvoice] = React.useState<ChildDetail["invoices"][number] | null>(null);
  const [submitHw, setSubmitHw] = React.useState<{ id: string; title: string } | null>(null); // B.13
  const [pickupDialog, setPickupDialog] = React.useState<"permanent" | "alternate" | null>(null);

  const load = React.useCallback(async () => {
    setError(false);
    try {
      const res = await fetch(`/api/portal?view=child&id=${id}`);
      const json = await res.json();
      if (json.ok) setData(json.data); else setError(true);
    } catch { setError(true); }
  }, [id]);
  React.useEffect(() => { load(); }, [load]);

  if (error) return <LoadError onRetry={load} />;
  if (data === null) return <div className="space-y-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}</div>;

  const openInvoices = data.invoices.filter((i) => i.balanceKes > 0);

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="inline-flex items-center gap-1 text-sm font-medium text-navy-500 hover:text-navy-900 dark:text-navy-400">
        <ArrowLeft className="h-4 w-4" /> My children
      </button>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Avatar name={data.child.name} photoUrl={data.child.photoUrl} size={56} />
          <div>
            <h2 className="text-lg font-semibold text-navy-900 dark:text-navy-50">{data.child.name}</h2>
            <p className="text-xs text-navy-400">{data.child.className ?? "—"} · <span className="font-mono">{data.child.admissionNo}</span></p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a href={`/portfolio?studentId=${data.child.id}`}>
            <Button size="sm" variant="secondary"><FolderOpen className="h-3.5 w-3.5" /> Portfolio</Button>
          </a>
          {data.child.classId && <ClassChatButton classId={data.child.classId} />}
        </div>
      </div>

      {/* fees first — what parents check most */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Wallet className="h-4 w-4 text-green-600" /> Fees</CardTitle></CardHeader>
        <CardContent>
          {data.invoices.length === 0 ? (
            <p className="py-3 text-center text-sm text-navy-400">No invoices yet.</p>
          ) : (
            <ul className="divide-y divide-navy-50 dark:divide-navy-800">
              {data.invoices.map((inv) => (
                <li key={inv.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                  <div>
                    <p className="font-medium text-navy-900 dark:text-navy-50">{inv.description}</p>
                    <p className="text-xs text-navy-400">{inv.invoiceNo} · due {inv.dueDate}{inv.discountKes > 0 ? ` · bursary -${kes(inv.discountKes)}` : ""}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {inv.balanceKes > 0 ? (
                      <>
                        <span className="font-semibold text-red-600">{kes(inv.balanceKes)}</span>
                        <Button size="sm" onClick={() => setPayInvoice(inv)}><Smartphone className="h-3.5 w-3.5" /> Pay</Button>
                        <Button size="sm" variant="secondary" onClick={() => setCommitInvoice(inv)}>
                          <Calendar className="h-3.5 w-3.5" /> Commit to Pay
                        </Button>
                      </>
                    ) : (
                      <Badge tone="green">paid ✓</Badge>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* results */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><FileText className="h-4 w-4 text-navy-400" /> Results</CardTitle></CardHeader>
        <CardContent>
          {data.exams.length === 0 ? (
            <p className="py-3 text-center text-sm text-navy-400">Results appear here when the school releases them.</p>
          ) : (
            <ul className="divide-y divide-navy-50 dark:divide-navy-800">
              {data.exams.map((e) => (
                <li key={e.examId} className="flex items-center justify-between py-2.5 text-sm">
                  <div>
                    <p className="font-medium text-navy-900 dark:text-navy-50">{e.name}</p>
                    <p className="text-xs text-navy-400">Term {e.term}, {e.year} · {e.subjects} subjects · avg {e.avgPct}%</p>
                  </div>
                  <a href={`/api/exams/${e.examId}/report/${data.child.id}`}>
                    <Button size="sm" variant="secondary"><FileText className="h-3.5 w-3.5" /> Report card</Button>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* J.4 Competency Framework Summary */}
      <StudentCompetencySummaryWrapper studentId={id} />

      {/* J.6 Skills Passport */}
      <SkillsPassportCard studentId={id} />

      {/* J.8 Learning Journey Timeline */}
      <LearnerJourneyCard studentId={id} mode="parent" />

      {/* attendance */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><CalendarCheck className="h-4 w-4 text-navy-400" /> Attendance (last 60 days)</CardTitle></CardHeader>
        <CardContent>
          {data.attendance.length === 0 ? (
            <p className="py-3 text-center text-sm text-navy-400">No attendance marked yet.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {data.attendance.map((a) => (
                <span key={a.date} title={`${a.date}: ${ATT_LABEL[a.status]}${a.note ? ` — ${a.note}` : ""}`}>
                  <Badge tone={ATT_TONE[a.status] ?? "neutral"}>{a.date.slice(5)} {a.status}</Badge>
                </span>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <PickupSafetyCard
        studentId={data.child.id}
        studentName={data.child.name}
        pickupPersons={data.pickupPersons}
        altPickups={data.altPickups}
        onAddPermanent={() => setPickupDialog("permanent")}
        onAddAlternate={() => setPickupDialog("alternate")}
        onChanged={load}
      />

      {/* timetable (B.11 — shared family portal) */}
      {data.timetable.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><CalendarCheck className="h-4 w-4 text-navy-400" /> Timetable</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] text-xs">
                <thead>
                  <tr>
                    <th className="p-1.5 text-left font-semibold text-navy-400">#</th>
                    {["Mon", "Tue", "Wed", "Thu", "Fri"].map((d) => <th key={d} className="p-1.5 text-left font-semibold text-navy-600 dark:text-navy-300">{d}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {[...new Set(data.timetable.map((t) => t.period))].sort((a, b) => a - b).map((p) => (
                    <tr key={p}>
                      <td className="p-1.5 font-mono text-navy-400">P{p}</td>
                      {[1, 2, 3, 4, 5].map((d) => {
                        const slot = data.timetable.find((t) => t.dayOfWeek === d && t.period === p);
                        return <td key={d} className="p-1.5">{slot ? <span className="rounded-md bg-green-50 px-1.5 py-0.5 font-semibold text-navy-800 dark:bg-green-900/20 dark:text-navy-100" title={slot.name}>{slot.code}</span> : <span className="text-navy-200 dark:text-navy-700">—</span>}</td>;
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* homework (B.12 — view homework / assignments) */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><BookOpen className="h-4 w-4 text-navy-400" /> Homework</CardTitle></CardHeader>
        <CardContent>
          {data.homework.length === 0 ? (
            <p className="py-3 text-center text-sm text-navy-400">No homework assigned yet.</p>
          ) : (
            <ul className="divide-y divide-navy-50 dark:divide-navy-800">
              {data.homework.map((h) => (
                <li key={h.id} className="space-y-1 py-2.5 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium text-navy-900 dark:text-navy-50">{h.title}</p>
                    <div className="flex items-center gap-1.5">
                      {/* B.13 submission status */}
                      {h.submission?.gradePct != null ? (
                        <Badge tone={h.submission.gradePct >= 65 ? "green" : h.submission.gradePct >= 50 ? "amber" : "red"}>graded {h.submission.gradePct}%</Badge>
                      ) : h.submission ? (
                        <Badge tone="blue">{h.submission.late ? "handed in late" : "handed in ✓"}</Badge>
                      ) : (
                        <Badge tone={h.overdue ? "neutral" : "amber"}>{h.overdue ? `was due ${h.dueDate}` : `due ${h.dueDate}`}</Badge>
                      )}
                      {!h.submission && <Button size="sm" onClick={() => setSubmitHw({ id: h.id, title: h.title })}>Hand in</Button>}
                      {h.submission && h.submission.gradePct == null && (
                        <Button size="sm" variant="secondary" onClick={() => setSubmitHw({ id: h.id, title: h.title })}>Re-submit</Button>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-navy-400">{h.subjectName} · {h.teacherName}</p>
                  {h.instructions && <p className="text-xs text-navy-500 dark:text-navy-400">{h.instructions}</p>}
                  {h.submission?.feedback && (
                    <p className="rounded-lg bg-warm-50 px-2 py-1 text-xs text-navy-600 dark:bg-navy-800 dark:text-navy-300">Teacher: {h.submission.feedback}</p>
                  )}
                  {h.fileUrl && (
                    <a href={h.fileUrl} className="inline-flex items-center gap-1 text-xs font-medium text-green-700 underline dark:text-green-400">
                      <Download className="h-3 w-3" /> {h.fileName ?? "Attachment"}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* quizzes (B.13 — auto-graded, one attempt) */}
      <QuizzesCard studentId={data.child.id} />

      {/* class notes (B.12 — download notes) */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><FileText className="h-4 w-4 text-navy-400" /> Class notes</CardTitle></CardHeader>
        <CardContent>
          {data.notes.length === 0 ? (
            <p className="py-3 text-center text-sm text-navy-400">Notes your teachers share appear here.</p>
          ) : (
            <ul className="divide-y divide-navy-50 dark:divide-navy-800">
              {data.notes.map((n) => (
                <li key={n.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-navy-900 dark:text-navy-50">{n.title}</p>
                    <p className="text-xs text-navy-400">{n.subjectName} · {n.teacherName}{n.description ? ` · ${n.description}` : ""}</p>
                  </div>
                  <a href={n.fileUrl} download={n.fileName}>
                    <Button size="sm" variant="secondary"><Download className="h-3.5 w-3.5" /> Download</Button>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* uniform shop (G.24 — order from the app, tailor delivers at school) */}
      <UniformCard studentId={data.child.id} studentName={data.child.name} />

      {/* library reading history (B.15) */}
      <LibraryCard studentId={data.child.id} />

      {/* class discussion forum (B.13) */}
      {data.child.classId && <ForumCard classId={data.child.classId} />}

      {/* message the school */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><MessageSquare className="h-4 w-4 text-navy-400" /> Talk to the school</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {data.contacts.map((t) => (
            <MessageButton
              key={t.id}
              recipientId={t.id}
              recipientName={t.fullName}
              label={`${t.fullName} · ${t.role === "PRINCIPAL" ? "Principal" : t.role === "DEPUTY_PRINCIPAL" ? "Deputy" : "Class teacher"}`}
            />
          ))}
        </CardContent>
      </Card>

      {pickupDialog === "permanent" && <PickupPersonDialog studentId={data.child.id} onClose={() => setPickupDialog(null)} onDone={() => { setPickupDialog(null); load(); }} />}
      {pickupDialog === "alternate" && <AltPickupDialog studentId={data.child.id} onClose={() => setPickupDialog(null)} onDone={() => { setPickupDialog(null); load(); }} />}
      {payInvoice && <PayDialog childName={data.child.name} invoice={payInvoice} onClose={() => setPayInvoice(null)} onDone={() => { setPayInvoice(null); toast({ title: "Check your phone for the M-Pesa prompt", tone: "success" }); load(); }} />}
      {commitInvoice && <CommitToPayDialog invoice={commitInvoice} onClose={() => setCommitInvoice(null)} onDone={() => { setCommitInvoice(null); load(); }} />}
      {submitHw && <SubmitWorkDialog homeworkId={submitHw.id} title={submitHw.title} onClose={() => setSubmitHw(null)} onDone={() => { setSubmitHw(null); load(); }} />}
    </div>
  );
}

function StudentCompetencySummaryWrapper({ studentId }: { studentId: string }) {
  const [summary, setSummary] = React.useState<any>(null);
  React.useEffect(() => {
    fetch(`/api/competencies?studentId=${studentId}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.ok && json.data?.summary) setSummary(json.data.summary);
      })
      .catch(() => {});
  }, [studentId]);

  if (!summary) return null;
  return <StudentCompetencySummaryCard summary={summary} />;
}


function PickupSafetyCard({ studentId, studentName, pickupPersons, altPickups, onAddPermanent, onAddAlternate, onChanged }: {
  studentId: string;
  studentName: string;
  pickupPersons: ChildDetail["pickupPersons"];
  altPickups: ChildDetail["altPickups"];
  onAddPermanent: () => void;
  onAddAlternate: () => void;
  onChanged: () => void;
}) {
  const { toast } = useToast();
  const [busyId, setBusyId] = React.useState<string | null>(null);

  async function removePerson(id: string, name: string) {
    if (!window.confirm(`Remove ${name} from ${studentName}'s pickup list?`)) return;
    setBusyId(id);
    try {
      const res = await fetch("/api/portal/pickup", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "removePickup", personId: id }),
      });
      const json = await res.json();
      if (json.ok) { toast({ title: `${name} removed from pickup list`, tone: "success" }); onChanged(); }
      else toast({ title: json.error?.message || "Could not remove", tone: "error" });
    } finally { setBusyId(null); }
  }

  async function cancelAlt(id: string, code: string) {
    setBusyId(id);
    try {
      const res = await fetch("/api/portal/pickup", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancelAltPickup", id }),
      });
      const json = await res.json();
      if (json.ok) { toast({ title: `Pickup code ${code} cancelled`, tone: "success" }); onChanged(); }
      else toast({ title: json.error?.message || "Could not cancel", tone: "error" });
    } finally { setBusyId(null); }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-green-600" /> Pickup safety</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs leading-5 text-navy-500 dark:text-navy-400">
          Add trusted people by National ID. At the gate, security checks the ID and taps verify — you receive an instant SMS after pickup.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={onAddPermanent}><UserCheck className="h-3.5 w-3.5" /> Add authorised person</Button>
          <Button size="sm" variant="secondary" onClick={onAddAlternate}><KeyRound className="h-3.5 w-3.5" /> One-time pickup code</Button>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-navy-400">Permanent pickup list</p>
          {pickupPersons.length === 0 ? (
            <p className="rounded-2xl bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">Nobody is authorised yet. Add at least one trusted pickup person.</p>
          ) : (
            <ul className="divide-y divide-navy-50 rounded-2xl border border-white/55 bg-white/40 dark:divide-navy-800 dark:border-white/10 dark:bg-navy-900/40">
              {pickupPersons.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                  <div>
                    <p className="font-semibold text-navy-900 dark:text-navy-50">{p.fullName} <span className="text-xs font-normal text-navy-400">({p.relationship})</span></p>
                    <p className="text-xs text-navy-400">{p.phone} · ID {p.nationalId || "not recorded"}</p>
                  </div>
                  <button onClick={() => removePerson(p.id, p.fullName)} disabled={busyId === p.id} className="rounded-full p-2 text-navy-300 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20" aria-label={`Remove ${p.fullName}`}>
                    {busyId === p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {altPickups.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-navy-400">Active one-time pickup codes</p>
            <ul className="divide-y divide-navy-50 rounded-2xl border border-amber-200 bg-amber-50/60 dark:divide-amber-900/50 dark:border-amber-900 dark:bg-amber-900/10">
              {altPickups.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                  <div>
                    <p className="font-semibold text-navy-900 dark:text-navy-50">{a.pickerName} <span className="font-mono text-xs text-amber-700">{a.code}</span></p>
                    <p className="text-xs text-navy-500">Expires {new Date(a.expiresAt).toLocaleString("en-KE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {a.screenshotUrl && <a href={a.screenshotUrl} target="_blank" rel="noreferrer" className="text-xs font-semibold text-green-700 underline dark:text-green-400">Screenshot</a>}
                    <button onClick={() => cancelAlt(a.id, a.code)} disabled={busyId === a.id} className="text-xs font-semibold text-navy-400 hover:text-red-600">Cancel</button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PickupPersonDialog({ studentId, onClose, onDone }: { studentId: string; onClose: () => void; onDone: () => void }) {
  const { toast } = useToast();
  const [f, setF] = React.useState({ fullName: "", relationship: "", phone: "", nationalId: "" });
  const [saving, setSaving] = React.useState(false);
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/portal/pickup", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "addPickup", studentId, ...f }),
      });
      const json = await res.json();
      if (json.ok) { toast({ title: "Pickup person authorised", tone: "success" }); onDone(); }
      else toast({ title: json.error?.message || "Could not authorise pickup person", tone: "error" });
    } finally { setSaving(false); }
  }

  return (
    <Modal title="Authorise pickup person" onClose={onClose}>
      <div className="space-y-3">
        <p className="text-xs leading-5 text-navy-500 dark:text-navy-400">The person must present this National ID at the gate. Security verifies the ID before the learner leaves.</p>
        <div><Label>Full name</Label><Input value={f.fullName} onChange={(e) => set("fullName", e.target.value)} placeholder="e.g. Njeri Wambui" /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Relationship</Label><Input value={f.relationship} onChange={(e) => set("relationship", e.target.value)} placeholder="Aunt / Driver" /></div>
          <div><Label>Phone</Label><Input value={f.phone} onChange={(e) => set("phone", e.target.value)} placeholder="07XX XXX XXX" /></div>
        </div>
        <div><Label>National ID number *</Label><Input value={f.nationalId} onChange={(e) => set("nationalId", e.target.value)} placeholder="12345678" /></div>
        <Button onClick={save} disabled={saving || f.fullName.trim().length < 3 || f.relationship.trim().length < 2 || f.phone.trim().length < 7 || f.nationalId.trim().length < 4} className="w-full">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserCheck className="h-4 w-4" />} Authorise person
        </Button>
      </div>
    </Modal>
  );
}

function AltPickupDialog({ studentId, onClose, onDone }: { studentId: string; onClose: () => void; onDone: () => void }) {
  const { toast } = useToast();
  const [f, setF] = React.useState({ pickerName: "", relationship: "", pickerPhone: "", validHours: "12" });
  const [shot, setShot] = React.useState<UploadedFile | null>(null);
  const [saving, setSaving] = React.useState(false);
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/portal/pickup", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "createAltPickup", studentId,
          pickerName: f.pickerName, relationship: f.relationship,
          pickerPhone: f.pickerPhone, validHours: Number(f.validHours) || 12,
          screenshotUrl: shot?.url, screenshotName: shot?.fileName,
        }),
      });
      const json = await res.json();
      if (json.ok) { toast({ title: `Pickup code ${json.data.code} created`, tone: "success" }); onDone(); }
      else toast({ title: json.error?.message || "Could not create pickup code", tone: "error" });
    } finally { setSaving(false); }
  }

  return (
    <Modal title="One-time pickup code" onClose={onClose}>
      <div className="space-y-3">
        <p className="text-xs leading-5 text-navy-500 dark:text-navy-400">Use this when someone not on the permanent list is collecting today. Share the code with the picker; security verifies it at the gate.</p>
        <div><Label>Picker name</Label><Input value={f.pickerName} onChange={(e) => set("pickerName", e.target.value)} placeholder="e.g. Auntie Njeri" /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Relationship</Label><Input value={f.relationship} onChange={(e) => set("relationship", e.target.value)} placeholder="Aunt / Friend" /></div>
          <div><Label>Picker phone</Label><Input value={f.pickerPhone} onChange={(e) => set("pickerPhone", e.target.value)} placeholder="07XX XXX XXX" /></div>
        </div>
        <div><Label>Valid for hours</Label><Input type="number" min={1} max={72} value={f.validHours} onChange={(e) => set("validHours", e.target.value)} /></div>
        <FileUpload label="Screenshot proof (optional)" accept="image/*" category="alt-pickup" onUploaded={setShot} />
        {shot && <p className="text-xs text-green-700">Attached: {shot.fileName}</p>}
        <Button onClick={save} disabled={saving || f.pickerName.trim().length < 3} className="w-full">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />} Create pickup code
        </Button>
      </div>
    </Modal>
  );
}

function PayDialog({ childName, invoice, onClose, onDone }: {
  childName: string;
  invoice: { id: string; invoiceNo: string; balanceKes: number };
  onClose: () => void; onDone: () => void;
}) {
  const { toast } = useToast();
  const [phone, setPhone] = React.useState("");
  const [amount, setAmount] = React.useState(String(invoice.balanceKes));
  const [saving, setSaving] = React.useState(false);

  async function pay() {
    setSaving(true);
    try {
      const res = await fetch("/api/portal", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "stk", invoiceId: invoice.id, phone, amountKes: Number(amount) }),
      });
      const json = await res.json();
      if (json.ok) onDone();
      else toast({ title: json.error?.message || "Payment failed to start", tone: "error" });
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-navy-950/40 p-4 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-card dark:bg-navy-900" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between">
          <h3 className="text-base font-semibold text-navy-900 dark:text-navy-50">Pay fees — {childName}</h3>
          <button onClick={onClose} className="rounded-full p-1 text-navy-400 hover:bg-navy-50 dark:hover:bg-navy-800" aria-label="Close"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-3">
          <p className="rounded-xl bg-warm-50 px-3 py-2 text-sm text-navy-600 dark:bg-navy-800 dark:text-navy-300">
            {invoice.invoiceNo} · balance <span className="font-semibold text-red-600">{kes(invoice.balanceKes)}</span>
          </p>
          <div><Label>Your M-Pesa phone</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="07XX XXX XXX" /></div>
          <div><Label>Amount (KES)</Label><Input type="number" min={1} max={invoice.balanceKes} value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
          <p className="text-xs text-navy-400">You&apos;ll get an M-Pesa prompt on your phone. Enter your PIN to complete — your receipt arrives by SMS.</p>
          <Button onClick={pay} disabled={saving || !phone || !amount} className="w-full">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Smartphone className="h-4 w-4" />} Pay {amount ? kes(Number(amount)) : ""}
          </Button>
        </div>
      </div>
    </div>
  );
}

function CommitToPayDialog({ invoice, onClose, onDone }: {
  invoice: { id: string; invoiceNo: string; balanceKes: number };
  onClose: () => void;
  onDone: () => void;
}) {
  const { toast } = useToast();
  const [promiseDate, setPromiseDate] = React.useState("");
  const [amount, setAmount] = React.useState(String(invoice.balanceKes));
  const [saving, setSaving] = React.useState(false);

  async function save() {
    if (!promiseDate) {
      toast({ title: "Select a payment date", tone: "error" });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/portal/promise-to-pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoiceId: invoice.id,
          promiseDate,
          amountKes: Number(amount),
        }),
      });
      const json = await res.json();
      if (json.ok) {
        toast({ title: "Commitment saved successfully!", tone: "success" });
        onDone();
      } else {
        toast({ title: json.error?.message || "Failed to save commitment", tone: "error" });
      }
    } catch {
      toast({ title: "Error occurred", tone: "error" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Commit to Payment Date" onClose={onClose}>
      <div className="space-y-4">
        <p className="text-xs text-navy-500">
          Commit to a date when you will pay the outstanding fees. The school bursar will be notified of your promise.
        </p>
        <div>
          <Label>Invoice</Label>
          <p className="text-sm font-semibold text-navy-800 dark:text-navy-100">{invoice.invoiceNo}</p>
        </div>
        <div>
          <Label>Commitment Date</Label>
          <Input type="date" value={promiseDate} onChange={(e) => setPromiseDate(e.target.value)} min={new Date().toISOString().slice(0, 10)} />
        </div>
        <div>
          <Label>Promised Amount (KES)</Label>
          <Input type="number" min={1} max={invoice.balanceKes} value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Saving..." : "Save Commitment"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function Avatar({ name, photoUrl, size = 44 }: { name: string; photoUrl: string | null; size?: number }) {
  const initials = name.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
  if (photoUrl) return <img src={photoUrl} alt={name} className="shrink-0 rounded-2xl object-cover" style={{ width: size, height: size }} />;
  return <span className="flex shrink-0 items-center justify-center rounded-2xl bg-navy-100 font-semibold text-navy-600 dark:bg-navy-800 dark:text-navy-200" style={{ width: size, height: size, fontSize: size / 2.6 }}>{initials}</span>;
}

function LoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-900/20 dark:text-red-300">
      <AlertCircle className="h-4 w-4" /> Couldn&apos;t load. <button onClick={onRetry} className="font-medium underline">Retry</button>
    </div>
  );
}

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
