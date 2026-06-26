"use client";

/**
 * B.20 Discipline UI — tabs:
 * - Incidents: report (category/severity/action) — MAJOR/SEVERE auto-SMS parent
 * - Behavior: demerit board (GOOD/WATCH/AT_RISK bands)
 * - Suspensions: issue (leadership), conditions, complete
 * - Counseling: CONFIDENTIAL tab — only visible to counseling.confidential
 */
import * as React from "react";
import {
  ShieldAlert, X, Loader2, AlertCircle, Plus, Gauge, UserX, HeartHandshake,
  CheckCircle2, Lock, FileText, Camera, Download, Search,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { FileUpload, type UploadedFile } from "@/components/ui/file-upload";
import { StudentSearchSelect } from "@/components/students/student-search-select";

interface Incident { id: string; studentName: string; admissionNo: string; date: string; category: string; severity: string; points: number; description: string; actionTaken: string | null; reportedByName: string; status: string; approvedByName?: string | null; parentNotifiedAt: string | null; proofFileUrl?: string | null; proofFileName?: string | null }
interface Suspension { id: string; studentName: string; admissionNo: string; startDate: string; endDate: string; reason: string; conditions: string | null; status: string; effective: boolean; approvedByName?: string | null; parentNotifiedAt: string | null }
interface BoardRow { studentId: string; studentName: string; admissionNo: string; points: number; incidents: number; lastDate: string; status: string }
interface Note { id: string; studentName: string; date: string; sessionType: string; note: string; followUpOn: string | null; counselorName: string }
interface StudentOpt { id: string; name: string; admissionNo: string }
interface Data { incidents: Incident[]; suspensions: Suspension[]; board: BoardRow[]; canConfidential: boolean }

const SEV_TONE: Record<string, "neutral" | "amber" | "red"> = { MINOR: "neutral", MAJOR: "amber", SEVERE: "red" };
const STATUS_TONE: Record<string, "green" | "amber" | "red"> = { GOOD: "green", WATCH: "amber", AT_RISK: "red" };
const CATEGORIES = ["FIGHTING", "BULLYING", "LATENESS", "NOISEMAKING", "SNEAKING", "VANDALISM", "CHEATING", "OTHER"];

export function DisciplineClient({ canManage, canConfidential, canApproveDiscipline }: { canManage: boolean; canConfidential: boolean; canApproveDiscipline: boolean }) {
  const { toast } = useToast();
  const [data, setData] = React.useState<Data | null>(null);
  const [error, setError] = React.useState(false);
  const [tab, setTab] = React.useState<"incidents" | "behavior" | "suspensions" | "counseling">("incidents");
  const [students, setStudents] = React.useState<StudentOpt[]>([]);
  const [dialog, setDialog] = React.useState<"incident" | "suspend" | "counseling" | null>(null);
  const [incidentQuery, setIncidentQuery] = React.useState("");
  const [notes, setNotes] = React.useState<Note[] | null>(null);

  const load = React.useCallback(async () => {
    setError(false);
    try {
      const qs = incidentQuery.trim() ? `?q=${encodeURIComponent(incidentQuery.trim())}` : "";
      const res = await fetch(`/api/discipline${qs}`);
      const json = await res.json();
      if (json.ok) setData(json.data); else setError(true);
    } catch { setError(true); }
  }, [incidentQuery]);
  React.useEffect(() => {
    load();
    fetch("/api/students?status=ACTIVE").then((r) => r.json()).then((j) => {
      if (j.ok) setStudents(j.data.students.map((s: { id: string; name?: string; firstName: string; middleName?: string | null; lastName: string; admissionNo: string }) => ({
        id: s.id, name: s.name ?? [s.firstName, s.middleName, s.lastName].filter(Boolean).join(" "), admissionNo: s.admissionNo,
      })));
    }).catch(() => {});
  }, [load]);

  const loadNotes = React.useCallback(async () => {
    setNotes(null);
    const res = await fetch("/api/discipline?counseling=1");
    const json = await res.json();
    if (json.ok) setNotes(json.data.notes);
  }, []);
  React.useEffect(() => { if (tab === "counseling" && canConfidential) loadNotes(); }, [tab, canConfidential, loadNotes]);

  async function closeSuspension(id: string, name: string) {
    const res = await fetch("/api/discipline", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "completeSuspension", suspensionId: id }),
    });
    const json = await res.json();
    if (json.ok) { toast({ title: `${name}'s suspension closed`, tone: "success" }); load(); }
    else toast({ title: json.error?.message || "Failed", tone: "error" });
  }

  async function decideIncident(id: string, approve: boolean) {
    const res = await fetch("/api/discipline", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: approve ? "approveIncident" : "rejectIncident", incidentId: id }),
    });
    const json = await res.json();
    if (json.ok) { toast({ title: approve ? "Discipline case approved" : "Discipline case rejected", tone: "success" }); load(); }
    else toast({ title: json.error?.message || "Failed", tone: "error" });
  }

  async function approveProposedSuspension(id: string, name: string) {
    const res = await fetch("/api/discipline", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "approveSuspension", suspensionId: id }),
    });
    const json = await res.json();
    if (json.ok) { toast({ title: `${name}'s suspension approved & parent notified ✓`, tone: "success" }); load(); }
    else toast({ title: json.error?.message || "Failed to approve", tone: "error" });
  }

  if (error) return <LoadError onRetry={load} />;
  if (data === null) return <div className="space-y-3"><Skeleton className="h-24 rounded-2xl" /><Skeleton className="h-48 rounded-2xl" /></div>;

  const tabs = [
    { key: "incidents" as const, label: "Incidents", icon: ShieldAlert },
    { key: "behavior" as const, label: "Behavior board", icon: Gauge },
    { key: "suspensions" as const, label: "Suspensions", icon: UserX },
    ...(canConfidential ? [{ key: "counseling" as const, label: "Counseling", icon: HeartHandshake }] : []),
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

      {tab === "incidents" && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {canManage && <Button onClick={() => setDialog("incident")}><Plus className="h-4 w-4" /> Report incident</Button>}
            <div className="relative min-w-[260px] flex-1 sm:max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-navy-300" />
              <Input value={incidentQuery} onChange={(e) => setIncidentQuery(e.target.value)} placeholder="Search learner, admission no, category or proof file…" className="pl-9" />
            </div>
          </div>
          {data.incidents.length === 0 ? (
            <EmptyState icon={ShieldAlert} title="No incidents" description="Reported incidents appear here. Major ones SMS the parent automatically." action={canManage ? <Button onClick={() => setDialog("incident")}><Plus className="h-4 w-4" /> Report incident</Button> : undefined} />
          ) : (
            <div className="space-y-2">
              {data.incidents.map((i) => (
                <Card key={i.id}>
                  <CardContent className="space-y-1 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-navy-900 dark:text-navy-50">{i.studentName} <span className="font-mono text-xs text-navy-400">{i.admissionNo}</span></p>
                      <div className="flex items-center gap-1.5">
                        <Badge tone={SEV_TONE[i.severity]}>{i.severity.toLowerCase()} · {i.points}pt</Badge>
                        <Badge tone={i.status === "PENDING" ? "amber" : i.status === "REJECTED" ? "red" : "green"}>{i.status === "PENDING" ? "pending approval" : i.status.toLowerCase()}</Badge>
                        {i.parentNotifiedAt && <Badge tone="blue">parent SMS ✓</Badge>}
                      </div>
                    </div>
                    <p className="text-xs text-navy-400">{i.date} · {i.category.toLowerCase()} · reported by {i.reportedByName}{i.approvedByName ? ` · approved by ${i.approvedByName}` : ""}</p>
                    <p className="text-sm text-navy-700 dark:text-navy-200">{i.description}</p>
                    {i.actionTaken && <p className="text-xs text-navy-500 dark:text-navy-400">Action: {i.actionTaken}</p>}
                    {canApproveDiscipline && i.status === "PENDING" && (
                      <div className="flex gap-2 pt-2">
                        <Button size="sm" onClick={() => decideIncident(i.id, true)}><CheckCircle2 className="h-3.5 w-3.5" /> Approve case</Button>
                        <Button size="sm" variant="ghost" className="text-red-600" onClick={() => decideIncident(i.id, false)}>Reject</Button>
                      </div>
                    )}
                    
                    {/* View Photo Evidence / Camera upload link (H.3) */}
                    {i.proofFileUrl && (
                      <div className="pt-2">
                        <a 
                          href={i.proofFileUrl} 
                          download={i.proofFileName ?? undefined} 
                          className="inline-flex items-center gap-1 text-xs font-bold text-green-700 hover:underline dark:text-green-400"
                        >
                          <FileText className="h-3.5 w-3.5" />
                          View Incident Proof ({i.proofFileName || "Attachment"})
                        </a>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "behavior" && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Gauge className="h-4 w-4 text-navy-400" /> Demerit board — this year</CardTitle></CardHeader>
          <CardContent>
            {data.board.length === 0 ? (
              <p className="py-3 text-center text-sm text-navy-400">No demerits recorded — great behavior!</p>
            ) : (
              <ul className="divide-y divide-navy-50 dark:divide-navy-800">
                {data.board.map((b) => (
                  <li key={b.studentId} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                    <div>
                      <p className="font-medium text-navy-900 dark:text-navy-50">{b.studentName} <span className="font-mono text-xs text-navy-400">{b.admissionNo}</span></p>
                      <p className="text-xs text-navy-400">{b.incidents} incident{b.incidents === 1 ? "" : "s"} · last {b.lastDate}</p>
                    </div>
                    <Badge tone={STATUS_TONE[b.status]}>{b.points} pts · {b.status.replace("_", " ").toLowerCase()}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      {tab === "suspensions" && (
        <div className="space-y-3">
          {canManage && <Button onClick={() => setDialog("suspend")}><Plus className="h-4 w-4" /> Issue / propose suspension</Button>}
          {data.suspensions.length === 0 ? (
            <EmptyState icon={UserX} title="No suspensions" description="Suspensions (issued by the principal or deputy) appear here." />
          ) : (
            <div className="space-y-2">
              {data.suspensions.map((s) => (
                <Card key={s.id}>
                  <CardContent className="flex flex-wrap items-center justify-between gap-2 p-4">
                    <div className="space-y-0.5">
                      <p className="text-sm font-semibold text-navy-900 dark:text-navy-50">{s.studentName} <span className="font-mono text-xs text-navy-400">{s.admissionNo}</span></p>
                      <p className="text-xs text-navy-400">{s.startDate} → {s.endDate} · {s.reason}{s.approvedByName ? ` · approved by ${s.approvedByName}` : ""}</p>
                      {s.conditions && <p className="text-xs text-navy-500 dark:text-navy-400">Return conditions: {s.conditions}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      {s.parentNotifiedAt && <Badge tone="blue">parent SMS ✓</Badge>}
                      <Badge tone={s.status === "PENDING" ? "amber" : s.effective ? "red" : s.status === "ACTIVE" ? "amber" : "green"}>
                        {s.status === "PENDING" ? "pending approval" : s.effective ? "suspended now" : s.status.toLowerCase()}
                      </Badge>
                      {canApproveDiscipline && s.status === "PENDING" && (
                        <Button size="sm" onClick={() => approveProposedSuspension(s.id, s.studentName.split(" ")[0])}>
                          <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                        </Button>
                      )}
                      {canApproveDiscipline && s.status === "ACTIVE" && (
                        <Button size="sm" variant="secondary" onClick={() => closeSuspension(s.id, s.studentName.split(" ")[0])}>
                          <CheckCircle2 className="h-3.5 w-3.5" /> Close
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "counseling" && canConfidential && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-1.5 text-xs text-navy-400"><Lock className="h-3.5 w-3.5" /> Confidential — visible only to the principal and deputy.</p>
            <Button size="sm" onClick={() => setDialog("counseling")}><Plus className="h-3.5 w-3.5" /> New session note</Button>
          </div>
          {notes === null ? (
            <Skeleton className="h-32 rounded-2xl" />
          ) : notes.length === 0 ? (
            <EmptyState icon={HeartHandshake} title="No counseling notes" description="Session notes are stored confidentially — never visible to parents or other staff." />
          ) : (
            <div className="space-y-2">
              {notes.map((n) => (
                <Card key={n.id}>
                  <CardContent className="space-y-1 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-navy-900 dark:text-navy-50">{n.studentName}</p>
                      <Badge tone="neutral">{n.sessionType.toLowerCase()}</Badge>
                    </div>
                    <p className="text-xs text-navy-400">{n.date} · {n.counselorName}{n.followUpOn ? ` · follow-up ${n.followUpOn}` : ""}</p>
                    <p className="text-sm text-navy-700 dark:text-navy-200">{n.note}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {dialog === "incident" && <IncidentDialog students={students} onClose={() => setDialog(null)} onDone={() => { setDialog(null); load(); }} />}
      {dialog === "suspend" && <SuspendDialog students={students} onClose={() => setDialog(null)} onDone={() => { setDialog(null); load(); }} />}
      {dialog === "counseling" && <CounselingDialog students={students} onClose={() => setDialog(null)} onDone={() => { setDialog(null); loadNotes(); }} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dialogs
// ---------------------------------------------------------------------------

const selectCls = "w-full rounded-2xl border border-navy-200 bg-white px-3.5 py-2.5 text-sm dark:border-navy-700 dark:bg-navy-900";
const today = () => new Date(Date.now() + 3 * 3600_000).toISOString().slice(0, 10);

function Dialog({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-navy-950/40 p-4 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-card dark:bg-navy-900" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between">
          <h3 className="text-base font-semibold text-navy-900 dark:text-navy-50">{title}</h3>
          <button onClick={onClose} className="rounded-full p-1 text-navy-400 hover:bg-navy-50 dark:hover:bg-navy-800" aria-label="Close"><X className="h-4 w-4" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function StudentSelect({ students, value, onChange }: { students: StudentOpt[]; value: string; onChange: (v: string) => void }) {
  return <StudentSearchSelect students={students} value={value} onChange={onChange} label="Student" placeholder="Type learner name or admission number…" />;
}

function IncidentDialog({ students, onClose, onDone }: { students: StudentOpt[]; onClose: () => void; onDone: () => void }) {
  const { toast } = useToast();
  const [f, setF] = React.useState({ studentId: "", date: today(), category: "LATENESS", severity: "MINOR", description: "", actionTaken: "" });
  const [file, setFile] = React.useState<UploadedFile | null>(null);
  const [saving, setSaving] = React.useState(false);
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/discipline", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          action: "incident", 
          ...f, 
          actionTaken: f.actionTaken || undefined,
          proofFileUrl: file?.url || undefined,
          proofFileName: file?.fileName || undefined,
        }),
      });
      const json = await res.json();
      if (json.ok) {
        toast({
          title: json.data.parentNotified
            ? `Recorded (${json.data.points}pt) — parent SMS sent`
            : `Incident recorded (${json.data.points}pt)`,
          tone: "success",
        });
        onDone();
      } else toast({ title: json.error?.message || "Failed", tone: "error" });
    } finally { setSaving(false); }
  }

  return (
    <Dialog title="Report an incident" onClose={onClose}>
      <div className="space-y-3">
        <StudentSelect students={students} value={f.studentId} onChange={(v) => set("studentId", v)} />
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Date</Label><Input type="date" value={f.date} onChange={(e) => set("date", e.target.value)} /></div>
          <div>
            <Label>Category</Label>
            <select value={f.category} onChange={(e) => set("category", e.target.value)} className={selectCls}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c.charAt(0) + c.slice(1).toLowerCase()}</option>)}
            </select>
          </div>
        </div>
        <div>
          <Label>Severity</Label>
          <div className="flex gap-1.5">
            {(["MINOR", "MAJOR", "SEVERE"] as const).map((s) => (
              <button key={s} onClick={() => set("severity", s)}
                className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${f.severity === s
                  ? s === "SEVERE" ? "bg-red-600 text-white" : s === "MAJOR" ? "bg-amber-500 text-white" : "bg-navy-900 text-white dark:bg-navy-50 dark:text-navy-900"
                  : "border border-navy-100 bg-white text-navy-600 dark:border-navy-800 dark:bg-navy-900 dark:text-navy-300"}`}>
                {s.charAt(0) + s.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
          <p className="mt-1 text-xs text-navy-400">Major and severe incidents SMS the parent automatically.</p>
        </div>
        <div>
          <Label>What happened?</Label>
          <textarea value={f.description} onChange={(e) => set("description", e.target.value)} rows={3} className="w-full rounded-2xl border border-navy-200 bg-white px-3.5 py-2.5 text-sm dark:border-navy-700 dark:bg-navy-900" />
        </div>
        <div><Label>Action taken (optional)</Label><Input value={f.actionTaken} onChange={(e) => set("actionTaken", e.target.value)} placeholder="e.g. Warned; referred to deputy" /></div>
        
        {/* Photo Proof / Camera Upload Section (H.3) */}
        <div>
          <Label>Attach Photo Proof / Evidence (Optional)</Label>
          {file ? (
            <p className="flex items-center gap-2 rounded-xl bg-warm-50 px-3 py-2 text-xs text-navy-600 dark:bg-navy-800 dark:text-navy-300 mt-1">
              <FileText className="h-3.5 w-3.5 text-green-600" /> {file.fileName}
              <button onClick={() => setFile(null)} className="ml-auto text-navy-400 hover:text-red-600" aria-label="Remove file"><X className="h-3.5 w-3.5" /></button>
            </p>
          ) : (
            <div className="flex items-center gap-1.5 text-xs text-navy-400 mt-1">
              <FileUpload category="discipline" accept="image/*,application/pdf" onUploaded={setFile} label="Upload Proof / Take Photo" />
              <span>Supports images, camera photos &amp; PDFs</span>
            </div>
          )}
        </div>

        <Button onClick={save} disabled={saving || !f.studentId || f.description.trim().length < 5} className="w-full">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldAlert className="h-4 w-4" />} Record incident
        </Button>
      </div>
    </Dialog>
  );
}

function SuspendDialog({ students, onClose, onDone }: { students: StudentOpt[]; onClose: () => void; onDone: () => void }) {
  const { toast } = useToast();
  const [f, setF] = React.useState({ studentId: "", startDate: today(), endDate: "", reason: "", conditions: "" });
  const [saving, setSaving] = React.useState(false);
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/discipline", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "suspend", ...f, conditions: f.conditions || undefined }),
      });
      const json = await res.json();
      if (json.ok) {
        toast({ title: json.data.status === "PENDING" ? "Suspension proposed — pending approval" : json.data.parentNotified ? "Suspension issued — parent SMS sent" : "Suspension issued", tone: "success" });
        onDone();
      } else toast({ title: json.error?.message || "Failed", tone: "error" });
    } finally { setSaving(false); }
  }

  return (
    <Dialog title="Issue / propose a suspension" onClose={onClose}>
      <div className="space-y-3">
        <StudentSelect students={students} value={f.studentId} onChange={(v) => set("studentId", v)} />
        <div className="grid grid-cols-2 gap-3">
          <div><Label>From</Label><Input type="date" value={f.startDate} onChange={(e) => set("startDate", e.target.value)} /></div>
          <div><Label>To</Label><Input type="date" value={f.endDate} onChange={(e) => set("endDate", e.target.value)} /></div>
        </div>
        <div><Label>Reason</Label><Input value={f.reason} onChange={(e) => set("reason", e.target.value)} placeholder="e.g. Repeated bullying after warnings" /></div>
        <div><Label>Return conditions (optional)</Label><Input value={f.conditions} onChange={(e) => set("conditions", e.target.value)} placeholder="e.g. Return with a parent" /></div>
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-900/20 dark:text-amber-300">Principal/Deputy approvals activate suspensions and notify the parent by SMS. HOD proposals stay pending until approved.</p>
        <Button onClick={save} disabled={saving || !f.studentId || !f.endDate || f.reason.trim().length < 5} className="w-full">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserX className="h-4 w-4" />} Submit suspension
        </Button>
      </div>
    </Dialog>
  );
}

function CounselingDialog({ students, onClose, onDone }: { students: StudentOpt[]; onClose: () => void; onDone: () => void }) {
  const { toast } = useToast();
  const [f, setF] = React.useState({ studentId: "", date: today(), sessionType: "INDIVIDUAL", note: "", followUpOn: "" });
  const [saving, setSaving] = React.useState(false);
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/discipline", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "counseling", ...f, followUpOn: f.followUpOn || undefined }),
      });
      const json = await res.json();
      if (json.ok) { toast({ title: "Confidential note saved", tone: "success" }); onDone(); }
      else toast({ title: json.error?.message || "Failed", tone: "error" });
    } finally { setSaving(false); }
  }

  return (
    <Dialog title="Counseling session note" onClose={onClose}>
      <div className="space-y-3">
        <p className="flex items-center gap-1.5 rounded-xl bg-warm-50 px-3 py-2 text-xs text-navy-500 dark:bg-navy-800 dark:text-navy-300"><Lock className="h-3.5 w-3.5" /> Confidential — never shown to parents or other staff.</p>
        <StudentSelect students={students} value={f.studentId} onChange={(v) => set("studentId", v)} />
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Date</Label><Input type="date" value={f.date} onChange={(e) => set("date", e.target.value)} /></div>
          <div>
            <Label>Session</Label>
            <select value={f.sessionType} onChange={(e) => set("sessionType", e.target.value)} className={selectCls}>
              {["INDIVIDUAL", "GROUP", "FAMILY", "REFERRAL"].map((t) => <option key={t} value={t}>{t.charAt(0) + t.slice(1).toLowerCase()}</option>)}
            </select>
          </div>
        </div>
        <div>
          <Label>Session note</Label>
          <textarea value={f.note} onChange={(e) => set("note", e.target.value)} rows={4} className="w-full rounded-2xl border border-navy-200 bg-white px-3.5 py-2.5 text-sm dark:border-navy-700 dark:bg-navy-900" />
        </div>
        <div><Label>Follow-up date (optional)</Label><Input type="date" value={f.followUpOn} onChange={(e) => set("followUpOn", e.target.value)} /></div>
        <Button onClick={save} disabled={saving || !f.studentId || f.note.trim().length < 5} className="w-full">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <HeartHandshake className="h-4 w-4" />} Save confidential note
        </Button>
      </div>
    </Dialog>
  );
}

function LoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-900/20 dark:text-red-300">
      <AlertCircle className="h-4 w-4" /> Couldn&apos;t load. <button onClick={onRetry} className="font-medium underline">Retry</button>
    </div>
  );
}
