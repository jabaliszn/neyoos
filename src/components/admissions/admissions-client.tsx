"use client";

/**
 * B.2 Admissions pipeline (staff). Kanban-style status columns (Odoo pattern),
 * application drawer with stage actions, walk-in form, inquiry conversion.
 * All 4 UX states; mobile = stacked columns.
 */
import * as React from "react";
import {
  UserPlus, AlertCircle, Loader2, X, CalendarDays, FileText,
  Wallet, GraduationCap, Inbox, Phone, Award, Download,
} from "lucide-react";
import { FileUpload, type UploadedFile } from "@/components/ui/file-upload";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";

interface App {
  id: string; applicationNo: string; name: string; gender: string;
  gradeWanted: string; curriculum: string | null; guardianName: string;
  guardianPhone: string; status: string; source: string;
  interviewDate: string | null; interviewTime: string | null;
  depositRequiredKes: number; depositPaidKes: number; studentId: string | null;
  createdAt: string;
}
interface InquiryRow { id: string; parentName: string; phone: string; studentName: string | null; gradeWanted: string | null; status: string }
interface ClassOpt { id: string; name: string }

const COLUMNS: { key: string; label: string; tone: "neutral" | "blue" | "amber" | "green" | "red" }[] = [
  { key: "APPLIED", label: "Applied", tone: "neutral" },
  { key: "REVIEW", label: "In review", tone: "blue" },
  { key: "INTERVIEW", label: "Interview", tone: "amber" },
  { key: "OFFER", label: "Offer", tone: "green" },
  { key: "WAITLISTED", label: "Waitlist", tone: "neutral" },
];
const CLOSED = ["ADMITTED", "REJECTED", "WITHDRAWN"];

export function AdmissionsClient() {
  const { toast } = useToast();
  const [apps, setApps] = React.useState<App[] | null>(null);
  const [inquiries, setInquiries] = React.useState<InquiryRow[]>([]);
  const [classes, setClasses] = React.useState<ClassOpt[]>([]);
  const [error, setError] = React.useState(false);
  const [selected, setSelected] = React.useState<App | null>(null);
  const [walkIn, setWalkIn] = React.useState(false);
  const [examVaultOpen, setExamVaultOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  const load = React.useCallback(async () => {
    setError(false);
    try {
      const [a, i, c] = await Promise.all([
        fetch("/api/admissions").then((r) => r.json()),
        fetch("/api/reception/inquiries").then((r) => r.json()).catch(() => ({ ok: false })),
        fetch("/api/classes").then((r) => r.json()),
      ]);
      if (a.ok) setApps(a.data.applications); else setError(true);
      if (i.ok) setInquiries((i.data.inquiries ?? []).filter((q: InquiryRow) => q.status === "NEW"));
      if (c.ok) setClasses(c.data.classes);
    } catch { setError(true); }
  }, []);
  React.useEffect(() => { load(); }, [load]);

  async function act(id: string, body: Record<string, unknown>, successMsg: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/admissions/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const json = await res.json();
      if (json.ok) { toast({ title: successMsg, tone: "success" }); setSelected(null); load(); }
      else toast({ title: json.error?.message || "Failed", tone: "error" });
    } finally { setBusy(false); }
  }

  async function convertInquiry(id: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/admissions?inquiry=${id}`, { method: "POST" });
      const json = await res.json();
      if (json.ok) { toast({ title: "Inquiry converted to application", tone: "success" }); load(); }
      else toast({ title: json.error?.message || "Failed", tone: "error" });
    } finally { setBusy(false); }
  }

  const closed = (apps ?? []).filter((a) => CLOSED.includes(a.status));

  return (
    <div className="space-y-6">
      {/* actions row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-navy-500 dark:text-navy-400">
          {apps ? `${apps.length} application${apps.length === 1 ? "" : "s"} · ${closed.filter((a) => a.status === "ADMITTED").length} admitted` : " "}
        </p>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => setExamVaultOpen(true)}>
            <FileText className="h-4 w-4 text-green-600 animate-pulse" /> Entrance Exam Vault
          </Button>
          <Button onClick={() => setWalkIn(true)}><UserPlus className="h-4 w-4" /> New application</Button>
        </div>
      </div>

      {/* pending walk-in inquiries from reception (B.2.4) */}
      {inquiries.length > 0 && (
        <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-4 dark:border-blue-900/40 dark:bg-blue-950/20">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-blue-800 dark:text-blue-200">
            <Inbox className="h-3.5 w-3.5" /> {inquiries.length} front-desk inquir{inquiries.length === 1 ? "y" : "ies"} waiting
          </p>
          <ul className="space-y-1.5">
            {inquiries.map((q) => (
              <li key={q.id} className="flex flex-wrap items-center justify-between gap-2 text-sm text-navy-700 dark:text-navy-200">
                <span>
                  <span className="font-medium">{q.studentName ?? "Name pending"}</span>
                  {q.gradeWanted ? ` · ${q.gradeWanted}` : ""} — {q.parentName} <span className="text-xs text-navy-400">({q.phone})</span>
                </span>
                <Button size="sm" variant="secondary" onClick={() => convertInquiry(q.id)} disabled={busy}>Start application</Button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* board */}
      {error ? (
        <div className="flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-900/20 dark:text-red-300">
          <AlertCircle className="h-4 w-4" /> Couldn&apos;t load applications. <button onClick={load} className="font-medium underline">Retry</button>
        </div>
      ) : apps === null ? (
        <div className="grid gap-3 md:grid-cols-5">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-48 rounded-2xl" />)}</div>
      ) : apps.length === 0 ? (
        <EmptyState
          icon={GraduationCap}
          title="No applications yet"
          description="Applications arrive from the online form on your school address, from front-desk inquiries, or add one manually."
          action={<Button onClick={() => setWalkIn(true)}><UserPlus className="h-4 w-4" /> New application</Button>}
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-5">
          {COLUMNS.map((col) => {
            const items = apps.filter((a) => a.status === col.key);
            return (
              <div key={col.key} className="rounded-2xl bg-warm-50 p-3 dark:bg-navy-900/60">
                <div className="mb-2 flex items-center justify-between px-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-navy-500 dark:text-navy-400">{col.label}</p>
                  <Badge tone={col.tone}>{items.length}</Badge>
                </div>
                <div className="space-y-2">
                  {items.length === 0 ? (
                    <p className="px-1 py-3 text-center text-xs text-navy-300 dark:text-navy-600">—</p>
                  ) : items.map((a) => (
                    <button key={a.id} onClick={() => setSelected(a)} className="block w-full rounded-xl border border-navy-100 bg-white p-3 text-left shadow-sm transition-shadow duration-200 ease-apple hover:shadow-card dark:border-navy-800 dark:bg-navy-900">
                      <p className="truncate text-sm font-medium text-navy-900 dark:text-navy-50">{a.name}</p>
                      <p className="mt-0.5 text-xs text-navy-400">{a.gradeWanted}{a.curriculum ? ` · ${a.curriculum}` : ""}</p>
                      {col.key === "INTERVIEW" && a.interviewDate && (
                        <p className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-amber-600"><CalendarDays className="h-3 w-3" /> {a.interviewDate}{a.interviewTime ? ` ${a.interviewTime}` : ""}</p>
                      )}
                      {col.key === "OFFER" && a.depositRequiredKes > 0 && (
                        <p className={`mt-1 text-xs font-medium ${a.depositPaidKes >= a.depositRequiredKes ? "text-green-600" : "text-navy-400"}`}>
                          Deposit {a.depositPaidKes.toLocaleString("en-KE")}/{a.depositRequiredKes.toLocaleString("en-KE")}
                        </p>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* closed strip */}
      {closed.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {closed.map((a) => (
            <button key={a.id} onClick={() => setSelected(a)} className="rounded-full border border-navy-100 px-3 py-1.5 text-xs text-navy-500 hover:bg-navy-50 dark:border-navy-800 dark:hover:bg-navy-800">
              {a.name} · <span className={a.status === "ADMITTED" ? "text-green-600 font-medium" : ""}>{a.status.toLowerCase()}</span>
            </button>
          ))}
        </div>
      )}

      {selected && <AppDrawer app={selected} classes={classes} busy={busy} onAct={act} onClose={() => setSelected(null)} />}
      {walkIn && <WalkInDialog onClose={() => setWalkIn(false)} onDone={() => { setWalkIn(false); load(); toast({ title: "Application created", tone: "success" }); }} />}
      {examVaultOpen && (
        <EntranceExamVaultModal
          classes={classes}
          onClose={() => setExamVaultOpen(false)}
        />
      )}
    </div>
  );
}

// ---- application drawer ------------------------------------------------------
function AppDrawer({ app, classes, busy, onAct, onClose }: {
  app: App; classes: ClassOpt[]; busy: boolean;
  onAct: (id: string, body: Record<string, unknown>, msg: string) => void; onClose: () => void;
}) {
  const [ivDate, setIvDate] = React.useState("");
  const [ivTime, setIvTime] = React.useState("09:00");
  const [deposit, setDeposit] = React.useState("0");
  const [amount, setAmount] = React.useState("");
  const [ref, setRef] = React.useState("");
  const [classId, setClassId] = React.useState("");

  const depositMet = app.depositRequiredKes === 0 || app.depositPaidKes >= app.depositRequiredKes;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-navy-950/40 backdrop-blur-sm" onClick={onClose}>
      <div className="h-full w-full max-w-md overflow-y-auto bg-white p-6 shadow-card dark:bg-navy-900" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold text-navy-900 dark:text-navy-50">{app.name}</h3>
            <p className="mt-0.5 font-mono text-xs text-navy-400">{app.applicationNo}</p>
          </div>
          <button onClick={onClose} className="rounded-full p-1 text-navy-400 hover:bg-navy-50 dark:hover:bg-navy-800" aria-label="Close"><X className="h-4 w-4" /></button>
        </div>

        <div className="mb-5 space-y-1.5 rounded-2xl bg-warm-50 p-4 text-sm dark:bg-navy-800">
          <p><span className="text-navy-400">Applying for:</span> <span className="font-medium">{app.gradeWanted}</span>{app.curriculum ? ` (${app.curriculum})` : ""}</p>
          <p><span className="text-navy-400">Guardian:</span> {app.guardianName} · <Phone className="inline h-3 w-3" /> {app.guardianPhone}</p>
          <p><span className="text-navy-400">Source:</span> {app.source.replace("_", " ")} · <span className="text-navy-400">Status:</span> <Badge tone={app.status === "ADMITTED" ? "green" : app.status === "REJECTED" ? "red" : "blue"}>{app.status.toLowerCase()}</Badge></p>
          {app.depositRequiredKes > 0 && (
            <p><span className="text-navy-400">Deposit:</span> <span className={depositMet ? "font-medium text-green-600" : "font-medium text-amber-600"}>KES {app.depositPaidKes.toLocaleString("en-KE")} / {app.depositRequiredKes.toLocaleString("en-KE")}</span></p>
          )}
        </div>

        <div className="space-y-4">
          {app.status === "APPLIED" && (
            <Button className="w-full" disabled={busy} onClick={() => onAct(app.id, { action: "review" }, "Moved to review")}>Start review</Button>
          )}

          {["APPLIED", "REVIEW", "WAITLISTED"].includes(app.status) && (
            <div className="rounded-2xl border border-navy-100 p-4 dark:border-navy-800">
              <p className="mb-2 flex items-center gap-1.5 text-sm font-medium text-navy-800 dark:text-navy-100"><CalendarDays className="h-4 w-4 text-amber-500" /> Schedule interview</p>
              <div className="grid grid-cols-2 gap-2">
                <Input type="date" value={ivDate} onChange={(e) => setIvDate(e.target.value)} />
                <Input type="time" value={ivTime} onChange={(e) => setIvTime(e.target.value)} />
              </div>
              <Button variant="secondary" className="mt-2 w-full" disabled={busy || !ivDate}
                onClick={() => onAct(app.id, { action: "schedule_interview", interviewDate: ivDate, interviewTime: ivTime }, "Interview scheduled — added to the school calendar")}>
                Schedule
              </Button>
            </div>
          )}

          {["REVIEW", "INTERVIEW", "WAITLISTED"].includes(app.status) && (
            <div className="rounded-2xl border border-navy-100 p-4 dark:border-navy-800">
              <p className="mb-2 flex items-center gap-1.5 text-sm font-medium text-navy-800 dark:text-navy-100"><FileText className="h-4 w-4 text-green-600" /> Make an offer</p>
              <Label htmlFor="dep">Commitment deposit (KES, 0 = none)</Label>
              <Input id="dep" type="number" min={0} value={deposit} onChange={(e) => setDeposit(e.target.value)} />
              <Button className="mt-2 w-full" disabled={busy}
                onClick={() => onAct(app.id, { action: "offer", depositRequiredKes: Number(deposit) || 0 }, "Offer made")}>
                Offer a place
              </Button>
            </div>
          )}

          {app.status === "OFFER" && (
            <>
              {app.depositRequiredKes > 0 && (
                <div className="rounded-2xl border border-navy-100 p-4 dark:border-navy-800">
                  <p className="mb-2 flex items-center gap-1.5 text-sm font-medium text-navy-800 dark:text-navy-100"><Wallet className="h-4 w-4 text-green-600" /> Record deposit</p>
                  <div className="grid grid-cols-2 gap-2">
                    <Input type="number" min={1} placeholder="Amount KES" value={amount} onChange={(e) => setAmount(e.target.value)} />
                    <Input placeholder="M-Pesa ref (optional)" value={ref} onChange={(e) => setRef(e.target.value)} />
                  </div>
                  <Button variant="secondary" className="mt-2 w-full" disabled={busy || !amount}
                    onClick={() => onAct(app.id, { action: "record_deposit", amountKes: Number(amount), reference: ref }, "Deposit recorded")}>
                    Record payment
                  </Button>
                </div>
              )}
              <div className="rounded-2xl border border-green-200 bg-green-50/50 p-4 dark:border-green-900/40 dark:bg-green-950/20">
                <p className="mb-2 flex items-center gap-1.5 text-sm font-medium text-navy-800 dark:text-navy-100"><GraduationCap className="h-4 w-4 text-green-600" /> Admit as student</p>
                <Label htmlFor="cls">Assign class (optional)</Label>
                <select id="cls" value={classId} onChange={(e) => setClassId(e.target.value)} className="mt-1 w-full rounded-xl border border-navy-200 bg-white px-3 py-2 text-sm dark:border-navy-700 dark:bg-navy-800">
                  <option value="">Decide later</option>
                  {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                {!depositMet && <p className="mt-2 text-xs text-amber-600">Deposit must be completed before admission.</p>}
                <Button className="mt-2 w-full" disabled={busy || !depositMet}
                  onClick={() => onAct(app.id, { action: "admit", classId }, "Admitted — student record created 🎉")}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <GraduationCap className="h-4 w-4" />} Admit
                </Button>
              </div>
            </>
          )}

          {["OFFER", "ADMITTED"].includes(app.status) && (
            <a href={`/api/admissions/${app.id}/letter`} className="block">
              <Button variant="secondary" className="w-full"><FileText className="h-4 w-4" /> Download {app.status === "ADMITTED" ? "admission" : "offer"} letter</Button>
            </a>
          )}
          {app.studentId && (
            <a href={`/students/${app.studentId}`} className="block">
              <Button variant="secondary" className="w-full"><GraduationCap className="h-4 w-4" /> Open student profile</Button>
            </a>
          )}

          {!CLOSED_SET.has(app.status) && (
            <div className="flex gap-2">
              <Button variant="ghost" className="flex-1 text-navy-500" disabled={busy} onClick={() => onAct(app.id, { action: "waitlist" }, "Moved to waitlist")}>Waitlist</Button>
              <Button variant="ghost" className="flex-1 text-red-600" disabled={busy} onClick={() => onAct(app.id, { action: "reject" }, "Application rejected")}>Reject</Button>
              <Button variant="ghost" className="flex-1 text-navy-400" disabled={busy} onClick={() => onAct(app.id, { action: "withdraw" }, "Marked withdrawn")}>Withdrawn</Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
const CLOSED_SET = new Set(["ADMITTED", "REJECTED", "WITHDRAWN"]);

// ---- walk-in dialog -----------------------------------------------------------
function WalkInDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { toast } = useToast();
  const [f, setF] = React.useState({ firstName: "", lastName: "", gender: "M", gradeWanted: "", guardianName: "", guardianPhone: "" });
  const [saving, setSaving] = React.useState(false);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF((p) => ({ ...p, [k]: e.target.value }));

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/admissions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) });
      const json = await res.json();
      if (json.ok) onDone();
      else toast({ title: json.error?.message || "Failed", tone: "error" });
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-navy-950/40 p-4 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-card dark:bg-navy-900" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between">
          <h3 className="text-base font-semibold text-navy-900 dark:text-navy-50">New application (walk-in)</h3>
          <button onClick={onClose} className="rounded-full p-1 text-navy-400 hover:bg-navy-50 dark:hover:bg-navy-800" aria-label="Close"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div><Label>First name</Label><Input value={f.firstName} onChange={set("firstName")} /></div>
            <div><Label>Last name</Label><Input value={f.lastName} onChange={set("lastName")} /></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Gender</Label>
              <select value={f.gender} onChange={set("gender")} className="mt-1 w-full rounded-xl border border-navy-200 bg-white px-3 py-2 text-sm dark:border-navy-700 dark:bg-navy-800">
                <option value="M">Boy</option><option value="F">Girl</option>
              </select>
            </div>
            <div><Label>Class applying for</Label><Input placeholder="e.g. Form 1" value={f.gradeWanted} onChange={set("gradeWanted")} /></div>
          </div>
          <div><Label>Guardian name</Label><Input value={f.guardianName} onChange={set("guardianName")} /></div>
          <div><Label>Guardian phone</Label><Input placeholder="07XX XXX XXX" value={f.guardianPhone} onChange={set("guardianPhone")} /></div>
          <Button onClick={save} disabled={saving || !f.firstName || !f.lastName || !f.gradeWanted || !f.guardianName || !f.guardianPhone} className="w-full">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />} Create application
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---- Admissions Entrance Exam Paper Vault Modal (I.11) -----------------------
interface ExamPaper {
  id: string;
  classId: string | null;
  classLevel: string;
  classLabel: string;
  title: string;
  fileUrl: string;
  fileName: string;
  hardcopyLocation: string;
  uploadedBy: string | null;
  printCount: number;
  lastPrintedAt: string | null;
}

function EntranceExamVaultModal({ classes, onClose }: { classes: ClassOpt[]; onClose: () => void }) {
  const { toast } = useToast();
  const [papers, setPapers] = React.useState<ExamPaper[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [uploadingClassId, setUploadingClassId] = React.useState<string | null>(null);
  const [drafts, setDrafts] = React.useState<Record<string, { title: string; hardcopyLocation: string }>>({});
  const [busy, setBusy] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admissions/entrance-exams");
      const json = await res.json();
      if (json.ok) setPapers(json.data.papers ?? []);
    } catch {
      toast({ title: "Could not load entrance papers.", tone: "error" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  React.useEffect(() => { load(); }, [load]);

  const paperByClass = React.useMemo(() => {
    const map = new Map<string, ExamPaper>();
    for (const paper of papers) if (paper.classId) map.set(paper.classId, paper);
    return map;
  }, [papers]);

  function draftFor(classId: string, fallbackTitle: string) {
    return drafts[classId] ?? {
      title: `${fallbackTitle} entrance interview paper`,
      hardcopyLocation: "Admissions office file",
    };
  }

  function updateDraft(classId: string, patch: Partial<{ title: string; hardcopyLocation: string }>) {
    const current = draftFor(classId, classes.find((c) => c.id === classId)?.name ?? "Class");
    setDrafts((prev) => ({ ...prev, [classId]: { ...current, ...patch } }));
  }

  async function handleUpload(cls: ClassOpt, file: UploadedFile) {
    const draft = draftFor(cls.id, cls.name);
    if (draft.title.trim().length < 3 || draft.hardcopyLocation.trim().length < 3) {
      toast({ title: "Add title and hard-copy file location before uploading.", tone: "error" });
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/admissions/entrance-exams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classId: cls.id,
          title: draft.title.trim(),
          hardcopyLocation: draft.hardcopyLocation.trim(),
          fileUrl: file.url,
          fileName: file.fileName,
        }),
      });
      const json = await res.json();
      if (json.ok) {
        toast({ title: `Entrance paper saved for ${cls.name}`, tone: "success" });
        setUploadingClassId(null);
        load();
      } else {
        toast({ title: json.error?.message || "Upload failed.", tone: "error" });
      }
    } catch {
      toast({ title: "Failed to connect to the exam vault.", tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/45 p-4 backdrop-blur-md" onClick={onClose}>
      <div className="w-full max-w-3xl rounded-3xl border border-white/20 bg-white p-6 shadow-pop dark:border-navy-800 dark:bg-navy-900" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h3 className="flex items-center gap-2 text-base font-bold text-navy-900 dark:text-navy-50">
              <Award className="h-5 w-5 text-green-600" />
              Entrance Exam Paper Vault
            </h3>
            <p className="text-xs text-navy-500 dark:text-navy-400">
              Store one printable interview paper per exact class/stream. Staff can open the paper directly during admissions.
            </p>
          </div>
          <button onClick={onClose} className="rounded-full p-1 text-navy-400 hover:bg-navy-50 dark:hover:bg-navy-800" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        {loading ? (
          <div className="space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}</div>
        ) : classes.length === 0 ? (
          <EmptyState icon={FileText} title="No classes set up" description="Create classes under Students → Manage classes first, then upload entrance interview exams." />
        ) : (
          <div className="max-h-[65vh] space-y-3 overflow-y-auto pr-1">
            {classes.map((cls) => {
              const paper = paperByClass.get(cls.id);
              const isUploading = uploadingClassId === cls.id;
              const draft = draftFor(cls.id, cls.name);
              return (
                <div key={cls.id} className="rounded-2xl border border-navy-100 bg-warm-50/50 p-4 dark:border-navy-800 dark:bg-navy-950/30">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-bold text-navy-900 dark:text-navy-50">{cls.name}</p>
                        <Badge tone={paper ? "green" : "neutral"}>{paper ? "Paper stored" : "Missing"}</Badge>
                        {paper?.printCount ? <Badge tone="blue">Printed {paper.printCount}</Badge> : null}
                      </div>
                      <p className="mt-1 truncate text-xs text-navy-500 dark:text-navy-400">
                        {paper ? `${paper.title} · ${paper.fileName}` : "No entrance paper uploaded for this exact class yet."}
                      </p>
                      {paper && (
                        <p className="mt-1 text-xs text-navy-400">
                          Hard copy: <span className="font-medium text-navy-600 dark:text-navy-300">{paper.hardcopyLocation}</span>
                          {paper.uploadedBy ? ` · by ${paper.uploadedBy}` : ""}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {paper && (
                        <a href={`/api/admissions/entrance-exams/${paper.id}/print`} target="_blank" rel="noreferrer">
                          <Button size="sm" variant="secondary">
                            <Download className="h-3.5 w-3.5" /> Print / Download
                          </Button>
                        </a>
                      )}
                      <Button size="sm" onClick={() => setUploadingClassId(isUploading ? null : cls.id)} disabled={busy}>
                        {paper ? "Replace paper" : "Upload paper"}
                      </Button>
                    </div>
                  </div>

                  {isUploading && (
                    <div className="mt-3 grid gap-3 rounded-2xl border border-green-100 bg-white/70 p-3 dark:border-green-900/40 dark:bg-navy-900/70 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                      <div>
                        <Label>Paper title</Label>
                        <Input value={draft.title} onChange={(e) => updateDraft(cls.id, { title: e.target.value })} />
                      </div>
                      <div>
                        <Label>Hard-copy file location</Label>
                        <Input value={draft.hardcopyLocation} onChange={(e) => updateDraft(cls.id, { hardcopyLocation: e.target.value })} placeholder="e.g. Admissions cabinet A / File 4" />
                      </div>
                      <div className="flex items-center gap-2">
                        <FileUpload
                          category="entrance_exam"
                          accept="application/pdf,.doc,.docx"
                          onUploaded={(file) => handleUpload(cls, file)}
                          label="Select paper"
                        />
                        <button onClick={() => setUploadingClassId(null)} className="text-xs font-semibold text-red-500">Cancel</button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
