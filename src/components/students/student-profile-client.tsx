"use client";

import * as React from "react";
import {
  Phone, Mail, Hash, CalendarDays, GraduationCap,
  FileText, CheckCircle2, Circle, Plus, ShieldCheck,
  ArrowRightLeft, Download, Undo2, Loader2, X,
  Users, Wallet, Percent, CreditCard, Award, FolderOpen, Pencil, Fingerprint,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileUpload } from "@/components/ui/file-upload";
import { useToast } from "@/components/ui/toast";
import { useBiometricGate } from "@/components/auth/biometric-gate";
import { Skeleton } from "@/components/ui/skeleton";
import { MessageButton } from "@/components/messaging/message-button";
import { StudentCompetencySummaryCard } from "@/components/competencies/competency-framework-components";
import { SkillsPassportCard } from "@/components/skills-passport/skills-passport-card";
import { LearnerJourneyCard } from "@/components/learner-journey/learner-journey-card";
import { StudentPathwayTab } from "@/components/students/student-pathway-tab";
import { StudentIdentityTab } from "@/components/students/student-identity-tab";
import { StudentServiceTab } from "@/components/students/student-service-tab";
import { StudentCareerTab } from "@/components/students/student-career-tab";
import { StudentTalentTab } from "@/components/students/student-talent-tab";

interface Guardian { id: string; guardianId: string; relationship: string; isPrimary: boolean; guardian: { id: string; fullName: string; phone: string; email: string | null; userId: string | null } }
interface Doc { id: string; label: string; fileUrl: string; fileName: string | null; hardcopyLocation: string; createdAt: string }
interface Req { id: string; label: string; category: string; quantity: string | null; mandatory: boolean; fulfilled: boolean }
interface Transfer {
  id: string; destinationSchool: string; destinationCounty: string | null;
  transferDate: string; reason: string | null; createdByName: string;
}
interface Student {
  id: string; admissionNo: string; legacyAdmissionNo: string | null; firstName: string; middleName: string | null; lastName: string;
  gender: string; dateOfBirth: string | null; photoUrl: string | null; status: string;
  upiNumber: string | null; birthCertNo: string | null; notes: string | null;
  schoolClass: { id: string; level: string; stream: string | null } | null;
  guardians: Guardian[]; documents: Doc[]; requirements: Req[]; transfers?: Transfer[];
}

const STATUS_TONE: Record<string, "green"|"neutral"|"amber"|"blue"|"red"> = {
  ACTIVE:"green", INACTIVE:"neutral", GRADUATED:"blue", TRANSFERRED:"amber", SUSPENDED:"red",
};
const STATUSES = ["ACTIVE","INACTIVE","GRADUATED","TRANSFERRED","SUSPENDED"];

export function StudentProfileClient({ initial, canEdit, isCurriculumEngineEnabled = false }: { initial: Student; canEdit: boolean; isCurriculumEngineEnabled?: boolean }) {
  const { toast } = useToast();
  const [s, setS] = React.useState<Student>(initial);
  const [busy, setBusy] = React.useState(false);

  const fullName = [s.firstName, s.middleName, s.lastName].filter(Boolean).join(" ");
  const className = s.schoolClass ? (s.schoolClass.stream ? `${s.schoolClass.level} ${s.schoolClass.stream}` : s.schoolClass.level) : null;
  const reqDone = s.requirements.filter((r)=>r.fulfilled).length;

  async function refresh() {
    const res = await fetch(`/api/students/${s.id}`);
    const json = await res.json();
    if (json.ok) setS(json.data.student);
  }

  async function setStatus(status: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/students/${s.id}/status`, { method:"PUT", headers:{"Content-Type":"application/json"}, body:JSON.stringify({status}) });
      const json = await res.json();
      if (json.ok) { setS((p)=>({...p,status})); toast({title:`Status: ${status.toLowerCase()}`,tone:"success"}); }
      else toast({title:json.error?.message||"Failed",tone:"error"});
    } finally { setBusy(false); }
  }

  async function toggleReq(r: Req) {
    const res = await fetch(`/api/student-requirements/${r.id}`, { method:"PUT", headers:{"Content-Type":"application/json"}, body:JSON.stringify({fulfilled:!r.fulfilled}) });
    const json = await res.json();
    if (json.ok) setS((p)=>({...p, requirements: p.requirements.map((x)=>x.id===r.id?{...x,fulfilled:!r.fulfilled}:x)}));
  }

  async function setPrimary(guardianId: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/students/${s.id}/guardians`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set_primary", guardianId }),
      });
      const json = await res.json();
      if (json.ok) {
        toast({ title: "Primary guardian updated", tone: "success" });
        refresh();
      } else {
        toast({ title: json.error?.message || "Failed to update primary", tone: "error" });
      }
    } finally {
      setBusy(false);
    }
  }

  const [transferDialog, setTransferDialog] = React.useState(false);
  const activeTransfer = s.transfers?.[0];

  async function undoTransfer() {
    if (!window.confirm("Undo this transfer? The student becomes active again and rejoins their previous class.")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/students/${s.id}/transfer`, { method: "DELETE" });
      const json = await res.json();
      if (json.ok) { toast({ title: "Transfer undone — student is active again", tone: "success" }); refresh(); }
      else toast({ title: json.error?.message || "Failed", tone: "error" });
    } finally { setBusy(false); }
  }

  return (
    <div className="space-y-6">
      {/* transfer banner (B.1.11) */}
      {activeTransfer && (
        <div className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-700/40 dark:bg-amber-900/20 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2">
            <ArrowRightLeft className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <div className="text-sm text-amber-800 dark:text-amber-200">
              <span className="font-semibold">Transferred out</span> to{" "}
              <span className="font-semibold">{activeTransfer.destinationSchool}</span>
              {activeTransfer.destinationCounty ? `, ${activeTransfer.destinationCounty}` : ""} · effective {activeTransfer.transferDate}
              {activeTransfer.reason ? <span className="block text-xs opacity-80">Reason: {activeTransfer.reason}</span> : null}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <a href={`/api/students/${s.id}/transfer/letter`}>
              <Button size="sm" variant="secondary"><Download className="h-3.5 w-3.5" /> Transfer letter</Button>
            </a>
            {canEdit && (
              <Button size="sm" variant="secondary" onClick={undoTransfer} disabled={busy}>
                <Undo2 className="h-3.5 w-3.5" /> Undo
              </Button>
            )}
          </div>
        </div>
      )}

      {/* header card */}
      <Card>
        <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center">
          <Avatar name={fullName} photoUrl={s.photoUrl} />
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-semibold text-navy-900 dark:text-navy-50">{fullName}</h2>
              <Badge tone={STATUS_TONE[s.status] ?? "neutral"}>{s.status.toLowerCase()}</Badge>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-navy-500 dark:text-navy-400">
              <span className="inline-flex items-center gap-1 font-mono text-xs"><Hash className="h-3.5 w-3.5" />{s.legacyAdmissionNo ? `${s.legacyAdmissionNo} · NEYO ${s.admissionNo}` : s.admissionNo}</span>
              <span className="inline-flex items-center gap-1"><GraduationCap className="h-3.5 w-3.5" />{className ?? "Unassigned"}</span>
              <span>{s.gender === "M" ? "Boy" : "Girl"}</span>
              {s.dateOfBirth && <span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />{s.dateOfBirth}</span>}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <a href={`/api/students/${s.id}/id-card`}>
              <Button variant="secondary" size="sm"><CreditCard className="h-3.5 w-3.5" /> ID card</Button>
            </a>
            <a href={`/api/students/${s.id}/transcript`}>
              <Button variant="secondary" size="sm"><FileText className="h-3.5 w-3.5" /> Transcript</Button>
            </a>
            {canEdit && (
              <a href={`/api/students/${s.id}/mzazi-card`}>
                <Button variant="secondary" size="sm"><CreditCard className="h-3.5 w-3.5" /> Mzazi card</Button>
              </a>
            )}
            <a href={`/portfolio?studentId=${s.id}`}>
              <Button variant="secondary" size="sm"><FolderOpen className="h-3.5 w-3.5" /> Portfolio</Button>
            </a>
            {canEdit && (
              <select value={s.status} onChange={(e)=>setStatus(e.target.value)} disabled={busy} className="rounded-full border border-navy-200 bg-white px-3 py-2 text-sm dark:border-navy-700 dark:bg-navy-900">
                {STATUSES.map((st)=><option key={st} value={st}>{st[0]+st.slice(1).toLowerCase()}</option>)}
              </select>
            )}
            {canEdit && !activeTransfer && (
              <Button variant="secondary" onClick={()=>setTransferDialog(true)} disabled={busy}>
                <ArrowRightLeft className="h-4 w-4" /> Transfer out…
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* details */}
        <Card>
          <CardHeader><CardTitle>Details</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <LegacyAdmissionRow student={s} canEdit={canEdit} onUpdated={refresh} />
            <Row label="NEYO admission no." value={s.admissionNo} mono />
            <Row label="UPI / NEMIS" value={s.upiNumber || "—"} />
            <Row label="Birth cert no." value={s.birthCertNo || "—"} />
            <Row label="Class" value={className ?? "Unassigned"} />
            {s.notes && <div className="pt-2 text-navy-600 dark:text-navy-300">{s.notes}</div>}
          </CardContent>
        </Card>

        {/* guardians */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Guardians</CardTitle>
            {canEdit && <AddGuardian studentId={s.id} onAdded={refresh} />}
          </CardHeader>
          <CardContent className="space-y-3">
            {s.guardians.length === 0 ? (
              <p className="text-sm text-navy-400">No guardian on record.</p>
            ) : s.guardians.map((g)=>(
              <div key={g.id} className="rounded-xl border border-navy-100 p-3 dark:border-navy-800">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-navy-900 dark:text-navy-50">{g.guardian.fullName}</span>
                    {g.isPrimary && <Badge tone="green">Primary</Badge>}
                    <span className="text-xs text-navy-400">{g.relationship}</span>
                    {g.guardian.userId && <Badge tone="blue"><ShieldCheck className="h-3 w-3" />Portal</Badge>}
                  </div>
                  {canEdit && (
                    <div className="flex items-center gap-1">
                      {!g.isPrimary && (
                        <Button size="sm" variant="ghost" className="h-7 px-2.5 text-xs text-navy-500 hover:text-green-600 dark:text-navy-400 dark:hover:text-green-500" onClick={() => setPrimary(g.guardian.id)}>
                          Set as Primary
                        </Button>
                      )}
                      <EditGuardian studentId={s.id} guardian={g} onUpdated={refresh} />
                    </div>
                  )}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-navy-500 dark:text-navy-400">
                  <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" />{g.guardian.phone}</span>
                  {g.guardian.email && <span className="inline-flex items-center gap-1"><Mail className="h-3 w-3" />{g.guardian.email}</span>}
                  {g.guardian.userId && (
                    <MessageButton
                      recipientId={g.guardian.userId}
                      recipientName={g.guardian.fullName}
                      label="Message guardian"
                      className="ml-auto"
                    />
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* G.12 sibling intelligence — family view */}
        <FamilyCard studentId={s.id} canManageFinance={canEdit} />

        {/* joining requirements */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Joining requirements</CardTitle>
            <Badge tone={reqDone === s.requirements.length && s.requirements.length>0 ? "green" : "amber"}>{reqDone}/{s.requirements.length}</Badge>
          </CardHeader>
          <CardContent className="space-y-1">
            {s.requirements.length === 0 ? (
              <p className="text-sm text-navy-400">No requirements set. Add them in Settings → School profile.</p>
            ) : s.requirements.map((r)=>(
              <button key={r.id} onClick={()=>canEdit && toggleReq(r)} disabled={!canEdit}
                className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-navy-50 disabled:cursor-default disabled:hover:bg-transparent dark:hover:bg-navy-800">
                {r.fulfilled ? <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" /> : <Circle className="h-4 w-4 shrink-0 text-navy-300" />}
                <span className={r.fulfilled ? "text-navy-400 line-through" : "text-navy-700 dark:text-navy-200"}>
                  {r.label}{r.quantity ? ` (${r.quantity})` : ""}
                </span>
                {!r.mandatory && <span className="ml-auto text-[10px] text-navy-400">optional</span>}
              </button>
            ))}
          </CardContent>
        </Card>

        {/* documents */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Documents</CardTitle>
            {canEdit && <AddDoc studentId={s.id} onAdded={refresh} />}
          </CardHeader>
          <CardContent className="space-y-2">
            {s.documents.length === 0 ? (
              <p className="text-sm text-navy-400">No documents uploaded.</p>
            ) : s.documents.map((d)=>(
              <a key={d.id} href={d.fileUrl} target="_blank" rel="noopener" className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-navy-50 dark:hover:bg-navy-800">
                <FileText className="h-4 w-4 text-navy-400" />
                <span className="text-navy-700 dark:text-navy-200">{d.label}</span>
                {d.fileName && <span className="text-xs text-navy-400">· {d.fileName}</span>}
                <span className="ml-auto text-[11px] text-navy-400">Hardcopy: {d.hardcopyLocation}</span>
              </a>
            ))}
          </CardContent>
        </Card>

        {/* Leaving Certificate Vault (H.3) */}
        <LeavingCertificateCard studentId={s.id} canEdit={canEdit} />

        {/* J.4 Competency Framework Summary */}
        <StudentCompetencySummaryWrapper studentId={s.id} />

        {/* J.6 Skills Passport */}
        <div className="lg:col-span-2">
          <SkillsPassportCard studentId={s.id} />
        </div>

        {/* J.8 Learning Journey Timeline */}
        <div className="lg:col-span-2">
          
          
          {/* Talent Tracking */}
          <StudentTalentTab studentId={s.id} />

          {/* Community Service */}
          <StudentServiceTab studentId={s.id} />

          {/* Career Discovery */}
          <StudentCareerTab studentId={s.id} />
          
          {/* Senior School Pathway */}
          <StudentPathwayTab studentId={s.id} />
          
          <LearnerJourneyCard studentId={s.id} mode="staff" />
        </div>
      </div>

      {transferDialog && (
        <TransferDialog
          studentName={fullName}
          studentId={s.id}
          onClose={()=>setTransferDialog(false)}
          onDone={()=>{ setTransferDialog(false); refresh(); toast({ title: "Student transferred out", tone: "success" }); }}
        />
      )}
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

// ---- transfer dialog (B.1.11) ----------------------------------------------
const REASONS = [
  { value: "relocation", label: "Family relocation" },
  { value: "fees", label: "Fee-related" },
  { value: "boarding", label: "Boarding / day switch" },
  { value: "discipline", label: "Disciplinary" },
  { value: "other", label: "Other" },
];

function TransferDialog({ studentName, studentId, onClose, onDone }: {
  studentName: string; studentId: string; onClose: () => void; onDone: () => void;
}) {
  const { toast } = useToast();
  const [destinationSchool, setDest] = React.useState("");
  const [destinationCounty, setCounty] = React.useState("");
  const [transferDate, setDate] = React.useState(new Date().toISOString().slice(0, 10));
  const [reason, setReason] = React.useState("relocation");
  const [reasonNote, setNote] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/students/${studentId}/transfer`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ destinationSchool, destinationCounty, transferDate, reason, reasonNote }),
      });
      const json = await res.json();
      if (json.ok) onDone();
      else toast({ title: json.error?.message || "Transfer failed", tone: "error" });
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-navy-950/40 p-4 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-card dark:bg-navy-900" onClick={(e)=>e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h3 className="text-base font-semibold text-navy-900 dark:text-navy-50">Transfer out</h3>
            <p className="mt-0.5 text-xs text-navy-500 dark:text-navy-400">{studentName} leaves this school. Their seat is freed and a QR-verified leaving letter becomes available.</p>
          </div>
          <button onClick={onClose} className="rounded-full p-1 text-navy-400 hover:bg-navy-50 dark:hover:bg-navy-800" aria-label="Close"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <Label htmlFor="t-dest">Destination school</Label>
            <Input id="t-dest" value={destinationSchool} onChange={(e)=>setDest(e.target.value)} placeholder="e.g. Moi Forces Academy" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="t-county">County (optional)</Label>
              <Input id="t-county" value={destinationCounty} onChange={(e)=>setCounty(e.target.value)} placeholder="e.g. Nakuru" />
            </div>
            <div>
              <Label htmlFor="t-date">Effective date</Label>
              <Input id="t-date" type="date" value={transferDate} onChange={(e)=>setDate(e.target.value)} />
            </div>
          </div>
          <div>
            <Label htmlFor="t-reason">Reason</Label>
            <select id="t-reason" value={reason} onChange={(e)=>setReason(e.target.value)} className="mt-1 w-full rounded-xl border border-navy-200 bg-white px-3 py-2 text-sm dark:border-navy-700 dark:bg-navy-800">
              {REASONS.map((r)=><option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          <div>
            <Label htmlFor="t-note">Note (optional)</Label>
            <Input id="t-note" value={reasonNote} onChange={(e)=>setNote(e.target.value)} placeholder="Anything the file should record" />
          </div>
          <Button onClick={save} disabled={saving || destinationSchool.trim().length < 3} className="w-full">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRightLeft className="h-4 w-4" />}
            Transfer student
          </Button>
        </div>
      </div>
    </div>
  );
}

function AddDoc({ studentId, onAdded }: { studentId: string; onAdded: ()=>void }) {
  const { toast } = useToast();
  const [label, setLabel] = React.useState("");
  const [hardcopyLocation, setHardcopyLocation] = React.useState("");
  const [open, setOpen] = React.useState(false);
  return open ? (
    <div className="w-full space-y-2 rounded-2xl border border-navy-100 p-3 dark:border-navy-800">
      <div className="grid gap-2 sm:grid-cols-2">
        <Input value={label} onChange={(e)=>setLabel(e.target.value)} placeholder="Label e.g. Birth cert" className="h-9" />
        <Input value={hardcopyLocation} onChange={(e)=>setHardcopyLocation(e.target.value)} placeholder="Hardcopy location e.g. Cabinet 2 / File 14" className="h-9" />
      </div>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] text-navy-400">Hardcopy location is required so staff can find the original file later.</p>
        <div className="flex items-center gap-2">
          <button onClick={() => { setOpen(false); setLabel(""); setHardcopyLocation(""); }} className="text-xs text-navy-400 underline">cancel</button>
          <FileUpload category="student-doc" label="File" onUploaded={async (file)=>{
            if (hardcopyLocation.trim().length < 3) {
              toast({ title: "Hardcopy location required", description: "Enter where the original document is filed before uploading.", tone: "error" });
              return;
            }
            const res = await fetch(`/api/students/${studentId}/documents`, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ label: label || file.fileName, fileUrl: file.url, fileName: file.fileName, hardcopyLocation }) });
            const json = await res.json();
            if (json.ok) { toast({title:"Document added",tone:"success"}); setLabel(""); setHardcopyLocation(""); setOpen(false); onAdded(); }
            else toast({title:json.error?.message||"Failed",tone:"error"});
          }} />
        </div>
      </div>
    </div>
  ) : (
    <Button size="sm" variant="ghost" onClick={()=>setOpen(true)}><Plus className="h-4 w-4" /> Add</Button>
  );
}

function AddGuardian({ studentId, onAdded }: { studentId: string; onAdded: () => void }) {
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [f, setF] = React.useState({
    fullName: "",
    phone: "",
    email: "",
    nationalId: "",
    relationship: "Parent",
    isPrimary: false,
    createLogin: false,
  });

  const set = (k: string, v: string | boolean) => setF((p) => ({ ...p, [k]: v }));

  async function save() {
    if (!f.fullName.trim() || !f.phone.trim()) {
      toast({ title: "Name and phone are required", tone: "error" });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/students/${studentId}/guardians`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(f),
      });
      const json = await res.json();
      if (json.ok) {
        toast({ title: "Guardian added", tone: "success" });
        setOpen(false);
        setF({
          fullName: "",
          phone: "",
          email: "",
          nationalId: "",
          relationship: "Parent",
          isPrimary: false,
          createLogin: false,
        });
        onAdded();
      } else {
        toast({ title: json.error?.message || "Failed to add guardian", tone: "error" });
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" /> Add
      </Button>

      {open && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-navy-900/40 backdrop-blur-sm sm:items-center sm:p-4" onClick={() => setOpen(false)}>
          <div className="max-h-[min(92dvh,46rem)] w-full max-w-xl overflow-y-auto rounded-3xl border border-white/60 bg-white p-0 shadow-pop backdrop-blur-xl dark:border-white/10 dark:bg-navy-900" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 z-10 mb-4 flex items-center justify-between border-b border-navy-100 bg-white p-5 backdrop-blur-xl dark:border-navy-800 dark:bg-navy-900">
              <h3 className="text-lg font-semibold text-navy-900 dark:text-navy-50">Add Guardian</h3>
              <button onClick={() => setOpen(false)} className="rounded-full p-1.5 text-navy-400 hover:bg-navy-50 dark:hover:bg-navy-800">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4 px-5 pb-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label>Full name</Label>
                  <Input value={f.fullName} onChange={(e) => set("fullName", e.target.value)} placeholder="e.g. Otieno Brian" autoFocus />
                </div>
                <div className="space-y-1">
                  <Label>Phone number</Label>
                  <Input value={f.phone} onChange={(e) => set("phone", e.target.value)} placeholder="e.g. 0712 345 678" />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label>Email (optional)</Label>
                  <Input value={f.email} onChange={(e) => set("email", e.target.value)} placeholder="e.g. parent@gmail.com" />
                </div>
                <div className="space-y-1">
                  <Label>National ID (optional)</Label>
                  <Input value={f.nationalId} onChange={(e) => set("nationalId", e.target.value)} placeholder="e.g. 12345678" />
                </div>
              </div>

              <div className="space-y-1">
                <Label>Relationship</Label>
                <select value={f.relationship} onChange={(e) => set("relationship", e.target.value)} className="w-full rounded-2xl border border-navy-200 bg-white px-3.5 py-2.5 text-sm dark:border-navy-700 dark:bg-navy-900 text-navy-900 dark:text-navy-50">
                  <option value="Parent">Parent</option>
                  <option value="Mother">Mother</option>
                  <option value="Father">Father</option>
                  <option value="Guardian">Guardian</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div className="rounded-2xl border border-navy-100 p-3 dark:border-navy-800 space-y-3">
                <label className="flex items-center gap-2 text-sm text-navy-600 dark:text-navy-300 select-none cursor-pointer">
                  <input type="checkbox" checked={f.isPrimary} onChange={(e) => set("isPrimary", e.target.checked)} className="h-4 w-4 rounded border-navy-300 text-green-600 focus:ring-green-500" />
                  <span>Choose as primary messenger (receives bulk SMS & alerts)</span>
                </label>

                <label className="flex items-center gap-2 text-sm text-navy-600 dark:text-navy-300 select-none cursor-pointer">
                  <input type="checkbox" checked={f.createLogin} onChange={(e) => set("createLogin", e.target.checked)} className="h-4 w-4 rounded border-navy-300 text-green-600 focus:ring-green-500" />
                  <span>Create PARENT portal login (can see all their kids)</span>
                </label>
              </div>

              <div className="sticky bottom-0 -mx-5 mt-6 flex justify-end gap-2 border-t border-navy-100 bg-white px-5 py-4 backdrop-blur-xl dark:border-navy-800 dark:bg-navy-900">
                <Button variant="secondary" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
                <Button onClick={save} disabled={saving}>
                  {saving ? "Adding..." : "Add Guardian"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/**
 * M.3 — Fix an EXISTING guardian's details (most commonly the phone number,
 * e.g. a parent got a new SIM card). This is deliberately separate from
 * AddGuardian: it edits the one already on file instead of creating a new
 * link, and any class teacher who can see this student can use it (not just
 * leadership) — matching the checklist's "class teachers can update parent
 * phone numbers" requirement.
 */
function EditGuardian({ studentId, guardian, onUpdated }: {
  studentId: string;
  guardian: Guardian;
  onUpdated: () => void;
}) {
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [f, setF] = React.useState({
    fullName: guardian.guardian.fullName,
    phone: guardian.guardian.phone,
    email: guardian.guardian.email ?? "",
    relationship: guardian.relationship,
  });

  React.useEffect(() => {
    if (open) {
      setF({
        fullName: guardian.guardian.fullName,
        phone: guardian.guardian.phone,
        email: guardian.guardian.email ?? "",
        relationship: guardian.relationship,
      });
    }
  }, [open, guardian]);

  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));

  async function save() {
    if (!f.fullName.trim() || !f.phone.trim()) {
      toast({ title: "Name and phone are required", tone: "error" });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/students/${studentId}/guardians`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update_guardian", guardianId: guardian.guardian.id, ...f }),
      });
      const json = await res.json();
      if (json.ok) {
        toast({ title: "Guardian details updated", tone: "success" });
        setOpen(false);
        onUpdated();
      } else {
        toast({ title: json.error?.message || "Failed to update guardian", tone: "error" });
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Button
        size="sm"
        variant="ghost"
        className="h-7 px-2.5 text-xs text-navy-500 hover:text-green-600 dark:text-navy-400 dark:hover:text-green-500"
        onClick={() => setOpen(true)}
        title="Edit guardian details"
      >
        <Pencil className="h-3.5 w-3.5" /> Edit
      </Button>

      {open && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-navy-900/40 backdrop-blur-sm sm:items-center sm:p-4" onClick={() => setOpen(false)}>
          <div className="max-h-[min(92dvh,46rem)] w-full max-w-xl overflow-y-auto rounded-3xl border border-white/60 bg-white p-0 shadow-pop backdrop-blur-xl dark:border-white/10 dark:bg-navy-900" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 z-10 mb-4 flex items-center justify-between border-b border-navy-100 bg-white p-5 backdrop-blur-xl dark:border-navy-800 dark:bg-navy-900">
              <h3 className="text-lg font-semibold text-navy-900 dark:text-navy-50">Edit Guardian</h3>
              <button onClick={() => setOpen(false)} className="rounded-full p-1.5 text-navy-400 hover:bg-navy-50 dark:hover:bg-navy-800">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4 px-5 pb-5">
              {guardian.guardian.userId && (
                <p className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-700 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-300">
                  This guardian has a NEYO portal login — their phone/email/name will update there too, so they keep receiving OTP codes and messages.
                </p>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label>Full name</Label>
                  <Input value={f.fullName} onChange={(e) => set("fullName", e.target.value)} placeholder="e.g. Otieno Brian" autoFocus />
                </div>
                <div className="space-y-1">
                  <Label>Phone number</Label>
                  <Input value={f.phone} onChange={(e) => set("phone", e.target.value)} placeholder="e.g. 0712 345 678" />
                </div>
              </div>

              <div className="space-y-1">
                <Label>Email (optional)</Label>
                <Input value={f.email} onChange={(e) => set("email", e.target.value)} placeholder="e.g. parent@gmail.com" />
              </div>

              <div className="space-y-1">
                <Label>Relationship</Label>
                <select value={f.relationship} onChange={(e) => set("relationship", e.target.value)} className="w-full rounded-2xl border border-navy-200 bg-white px-3.5 py-2.5 text-sm dark:border-navy-700 dark:bg-navy-900 text-navy-900 dark:text-navy-50">
                  <option value="Parent">Parent</option>
                  <option value="Mother">Mother</option>
                  <option value="Father">Father</option>
                  <option value="Guardian">Guardian</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div className="sticky bottom-0 -mx-5 mt-6 flex justify-end gap-2 border-t border-navy-100 bg-white px-5 py-4 backdrop-blur-xl dark:border-navy-800 dark:bg-navy-900">
                <Button variant="secondary" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
                <Button onClick={save} disabled={saving}>
                  {saving ? "Saving..." : "Save changes"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function LegacyAdmissionRow({ student, canEdit, onUpdated }: { student: Student; canEdit: boolean; onUpdated: () => void }) {
  const { toast } = useToast();
  const [editing, setEditing] = React.useState(false);
  const [value, setValue] = React.useState(student.legacyAdmissionNo ?? "");
  const [saving, setSaving] = React.useState(false);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/students/${student.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ legacyAdmissionNo: value.trim() || "" }),
      });
      const json = await res.json();
      if (json.ok) {
        toast({ title: "School admission number saved", tone: "success" });
        setEditing(false);
        onUpdated();
      } else {
        toast({ title: json.error?.message || "Could not save admission number", tone: "error" });
      }
    } finally { setSaving(false); }
  }

  if (!canEdit || !editing) {
    return (
      <div className="flex items-center justify-between">
        <span className="text-navy-400">School admission no.</span>
        <span className="inline-flex items-center gap-2 text-navy-700 dark:text-navy-200">
          <span className="font-mono text-xs">{student.legacyAdmissionNo || "—"}</span>
          {canEdit && <button onClick={() => setEditing(true)} className="text-[10px] font-semibold text-green-700 underline">edit</button>}
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-1 rounded-xl border border-navy-100 p-2 dark:border-navy-800">
      <Label>School admission no.</Label>
      <div className="flex gap-2">
        <Input value={value} onChange={(e) => setValue(e.target.value)} placeholder="e.g. ADM/2024/017" />
        <Button size="sm" onClick={save} disabled={saving}>{saving ? "…" : "Save"}</Button>
        <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setValue(student.legacyAdmissionNo ?? ""); }}>Cancel</Button>
      </div>
    </div>
  );
}

function Avatar({ name, photoUrl }: { name: string; photoUrl: string | null }) {
  const initials = name.split(" ").filter(Boolean).slice(0,2).map((p)=>p[0]).join("").toUpperCase();
  if (photoUrl) return <img src={photoUrl} alt={name} className="h-20 w-20 shrink-0 rounded-2xl object-cover" />;
  return <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-navy-100 text-xl font-semibold text-navy-600 dark:bg-navy-800 dark:text-navy-200">{initials}</span>;
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-navy-400">{label}</span>
      <span className={(mono?"font-mono text-xs ":"")+"text-navy-700 dark:text-navy-200"}>{value}</span>
    </div>
  );
}

// G.12 — Sibling Intelligence: family view (siblings + combined fee position)
// + one-tap sibling discount onto a child's invoice.
const kes = (n: number) => `KES ${n.toLocaleString("en-KE")}`;

interface FamilyKid {
  id: string; name: string; admissionNo: string; className: string;
  photoUrl: string | null; balanceKes: number; billedKes: number; paidKes: number; hasFeeInvoices: boolean; isCurrent: boolean;
  openInvoiceId: string | null; openInvoiceTotalKes: number | null;
}
interface FamilyData {
  siblingCount: number;
  guardians: { id: string; fullName: string; phone: string; relationship: string; isPrimary: boolean; hasPortal: boolean }[];
  children: FamilyKid[];
  combinedBalanceKes: number; combinedBilledKes: number; combinedPaidKes: number;
  siblingDiscountPct: number;
}

function FamilyCard({ studentId, canManageFinance }: { studentId: string; canManageFinance: boolean }) {
  const { toast } = useToast();
  const { requireBiometric } = useBiometricGate();
  const [data, setData] = React.useState<FamilyData | null>(null);
  const [error, setError] = React.useState(false);
  const [applying, setApplying] = React.useState<string | null>(null);
  const [requiresBiometric, setRequiresBiometric] = React.useState(false);

  React.useEffect(() => {
    fetch("/api/finance/security").then((r) => r.json()).then((j) => {
      if (j.ok) setRequiresBiometric(j.data.requireBiometricForFinance);
    }).catch(() => {});
  }, []);

  const load = React.useCallback(async () => {
    setError(false);
    try {
      const res = await fetch(`/api/family?studentId=${studentId}`);
      const json = await res.json();
      if (json.ok) setData(json.data); else setError(true);
    } catch { setError(true); }
  }, [studentId]);
  React.useEffect(() => { load(); }, [load]);

  if (error) {
    return (
      <Card>
        <CardHeader><CardTitle>Family</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-navy-400">Could not load the family view.</p>
          <Button variant="secondary" onClick={load} className="mt-2">Retry</Button>
        </CardContent>
      </Card>
    );
  }
  if (data === null) {
    return (
      <Card>
        <CardHeader><CardTitle>Family</CardTitle></CardHeader>
        <CardContent><div className="h-16 animate-pulse rounded-xl bg-navy-100 dark:bg-navy-800" /></CardContent>
      </Card>
    );
  }

  // only-child: friendly empty state, no fee math noise
  if (data.siblingCount === 0) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Family</CardTitle>
          <Badge tone="neutral">no siblings here</Badge>
        </CardHeader>
        <CardContent>
          <p className="flex items-center gap-2 text-sm text-navy-400">
            <Users className="h-4 w-4" /> This learner has no other children enrolled at the school.
          </p>
        </CardContent>
      </Card>
    );
  }

  async function doApplyDiscount(invoiceId: string, biometricTicket: string | null) {
    setApplying(invoiceId);
    try {
      const res = await fetch("/api/family", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sibling_discount", invoiceId, biometricTicket: biometricTicket ?? undefined }),
      });
      const json = await res.json();
      if (json.ok) { toast({ title: `Sibling discount applied (${data?.siblingDiscountPct}%)`, tone: "success" }); load(); }
      else toast({ title: json.error?.message || "Could not apply", tone: "error" });
    } catch { toast({ title: "Network problem", tone: "error" }); }
    finally { setApplying(null); }
  }

  function applyDiscount(invoiceId: string, invoiceTotalKes: number) {
    if (requiresBiometric) {
      // R.3 — a fresh, server-verified fingerprint/Face ID/passkey check is
      // required before a sibling discount is applied, when this school has
      // opted in — enforced server-side by applyDiscount() itself, since
      // applySiblingDiscount() funnels through the very same function. The
      // action key must match EXACTLY what the server will compute
      // (fee_discount:<invoiceId>:<amountKes>), so we mirror its rounding.
      const pct = data?.siblingDiscountPct ?? 0;
      const amountKes = Math.round((invoiceTotalKes * pct) / 100);
      requireBiometric(
        `Apply sibling discount (${pct}%) on this invoice`,
        (ticket) => doApplyDiscount(invoiceId, ticket),
        `fee_discount:${invoiceId}:${amountKes}`
      );
      return;
    }
    doApplyDiscount(invoiceId, null);
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Family</CardTitle>
        <Badge tone="blue"><Users className="h-3 w-3" />{data.siblingCount} sibling{data.siblingCount === 1 ? "" : "s"} in school</Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* combined fee position */}
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-xl bg-warm-50 p-3 dark:bg-navy-800">
            <p className="text-[11px] text-navy-400">Family billed</p>
            <p className="text-sm font-semibold text-navy-900 dark:text-navy-50">{kes(data.combinedBilledKes)}</p>
          </div>
          <div className="rounded-xl bg-warm-50 p-3 dark:bg-navy-800">
            <p className="text-[11px] text-navy-400">Paid</p>
            <p className="text-sm font-semibold text-green-700 dark:text-green-400">{kes(data.combinedPaidKes)}</p>
          </div>
          <div className="rounded-xl bg-warm-50 p-3 dark:bg-navy-800">
            <p className="text-[11px] text-navy-400">Balance</p>
            <p className={"text-sm font-semibold " + (data.combinedBalanceKes > 0 ? "text-red-600" : "text-navy-900 dark:text-navy-50")}>{kes(data.combinedBalanceKes)}</p>
          </div>
        </div>

        {/* the children */}
        <div className="space-y-1.5">
          {data.children.map((c) => (
            <div key={c.id} className={"flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2 " + (c.isCurrent ? "border-green-200 bg-green-50/60 dark:border-green-900 dark:bg-green-900/10" : "border-navy-100 dark:border-navy-800")}>
              <div className="min-w-0">
                {c.isCurrent ? (
                  <span className="text-sm font-medium text-navy-900 dark:text-navy-50">{c.name} <span className="text-[10px] font-semibold uppercase text-green-600">this learner</span></span>
                ) : (
                  <a href={`/students/${c.id}`} className="text-sm font-medium text-navy-900 hover:underline dark:text-navy-50">{c.name}</a>
                )}
                <p className="text-xs text-navy-400">{c.admissionNo} · {c.className}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={"inline-flex items-center gap-1 text-xs font-medium " + (!c.hasFeeInvoices ? "text-navy-400" : c.balanceKes > 0 ? "text-red-600" : "text-green-700 dark:text-green-400")}>
                  <Wallet className="h-3 w-3" />
                  {!c.hasFeeInvoices ? "no fees billed yet" : c.balanceKes > 0 ? `${kes(c.balanceKes)} due` : "cleared"}
                </span>
                {canManageFinance && data.siblingDiscountPct > 0 && c.openInvoiceId && c.openInvoiceTotalKes !== null && (
                  <Button
                    size="sm" variant="secondary"
                    disabled={applying === c.openInvoiceId}
                    onClick={() => applyDiscount(c.openInvoiceId as string, c.openInvoiceTotalKes as number)}
                  >
                    {applying === c.openInvoiceId ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : requiresBiometric ? <Fingerprint className="h-3.5 w-3.5" /> : <Percent className="h-3.5 w-3.5" />}
                    Apply {data.siblingDiscountPct}%
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* sibling discount seam — real one-tap "Apply" buttons are on each
            child above; this is just the school-wide rate + a fingerprint
            notice when the school has R.3 biometric finance gating on. */}
        {canManageFinance && data.siblingDiscountPct > 0 && (
          <div className="rounded-xl bg-warm-50 p-3 dark:bg-navy-800">
            <p className="flex items-center gap-1.5 text-xs font-medium text-navy-600 dark:text-navy-300">
              <Percent className="h-3.5 w-3.5" /> Sibling discount: {data.siblingDiscountPct}% (set in Settings)
            </p>
            <p className="mt-1 text-[11px] text-navy-400">Tap &quot;Apply {data.siblingDiscountPct}%&quot; next to any child with an open balance above — the family qualifies with {data.siblingCount + 1} children enrolled.</p>
            {requiresBiometric && (
              <p className="mt-1.5 flex items-center gap-1.5 text-[11px] font-medium text-amber-700 dark:text-amber-400">
                <Fingerprint className="h-3 w-3" /> This school requires a fingerprint/Face ID check before applying it.
              </p>
            )}
          </div>
        )}
        {canManageFinance && data.siblingDiscountPct === 0 && (
          <p className="text-[11px] text-navy-400">Tip: set a sibling discount % in Settings → School profile to reward multi-child families.</p>
        )}
      </CardContent>
    </Card>
  );
}

// ---- Leaving Certificate Vault Card (Chunk E — Part 4) -----------------------------
interface CertData { id: string; certificateType: string; certificateNo: string; status: string; hardcopyLocation: string; fileUrl: string | null; fileName: string | null; handedOverTo: string | null; handedOverAt: string | null; handedOverByName: string | null }

function LeavingCertificateCard({ studentId, canEdit }: { studentId: string; canEdit: boolean }) {
  const { toast } = useToast();
  const [cert, setCert] = React.useState<CertData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [vaulting, setVaulting] = React.useState(false);
  const [handingOver, setHandingOver] = React.useState(false);

  // Form states
  const [certType, setCertType] = React.useState("KCSE");
  const [certNo, setCertNo] = React.useState("");
  const [hardcopyLoc, setHardcopyLoc] = React.useState("");
  const [file, setFile] = React.useState<any | null>(null);
  const [recipient, setRecipient] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/students/${studentId}/leaving-certificate`);
      const json = await res.json();
      if (json.ok) setCert(json.data.cert);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [studentId]);

  React.useEffect(() => { load(); }, [load]);

  async function handleVault() {
    if (!certNo.trim()) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/students/${studentId}/leaving-certificate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "vault",
          certificateType: certType,
          certificateNo: certNo.trim(),
          hardcopyLocation: hardcopyLoc.trim(),
          fileUrl: file?.url || undefined,
          fileName: file?.fileName || undefined,
        }),
      });
      const json = await res.json();
      if (json.ok) {
        toast({ title: "Certificate successfully vaulted!", tone: "success" });
        setVaulting(false);
        setCertNo("");
        setFile(null);
        load();
      } else {
        toast({ title: json.error?.message || "Failed to vault", tone: "error" });
      }
    } finally { setBusy(false); }
  }

  async function handleHandover() {
    if (!recipient.trim()) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/students/${studentId}/leaving-certificate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "handover",
          handedOverTo: recipient.trim(),
        }),
      });
      const json = await res.json();
      if (json.ok) {
        toast({ title: "Handover recorded & parent notified!", tone: "success" });
        setHandingOver(false);
        setRecipient("");
        load();
      } else {
        toast({ title: json.error?.message || "Failed to log handover", tone: "error" });
      }
    } finally { setBusy(false); }
  }

  if (loading) return <Skeleton className="h-40 rounded-2xl" />;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="flex items-center gap-1.5">
          <Award className="h-4.5 w-4.5 text-green-600" />
          Leaving Certificate Vault
        </CardTitle>
        {cert && (
          <Badge tone={cert.status === "STORED" ? "green" : "neutral"}>
            {cert.status === "STORED" ? "Safe in Vault" : "Handed Over"}
          </Badge>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {!cert ? (
          <div className="space-y-3">
            <p className="text-xs text-navy-400">
              No academic leaving certificate logged in the NEYO vault yet. Keep certificates safe digitally and track their handovers.
            </p>
            {canEdit && (
              <Button size="sm" variant="secondary" onClick={() => setVaulting(true)} className="w-full">
                <Plus className="h-4 w-4" /> Vault a Certificate
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-3 text-sm">
            <div className="flex justify-between border-b border-navy-100/30 pb-2">
              <span className="text-navy-400 text-xs">Certificate Number</span>
              <span className="font-mono font-bold text-navy-800 dark:text-navy-100">{cert.certificateType}: {cert.certificateNo}</span>
            </div>
            <div className="flex justify-between border-b border-navy-100/30 pb-2">
              <span className="text-navy-400 text-xs">Hardcopy File Location</span>
              <span className="font-semibold text-navy-800 dark:text-navy-100">{cert.hardcopyLocation}</span>
            </div>

            {cert.status === "STORED" ? (
              <div className="space-y-3">
                <p className="text-xs text-green-600 font-semibold bg-green-500/10 px-3 py-2 rounded-xl flex items-center gap-1.5 border border-green-500/25">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  Prised in School Vault · Original Copy Secure
                </p>
                {cert.fileUrl && (
                  <a href={cert.fileUrl} download={cert.fileName ?? undefined} className="flex items-center gap-2 rounded-xl bg-warm-50 px-3 py-2 text-xs text-navy-600 dark:bg-navy-800 dark:text-navy-300">
                    <FileText className="h-4 w-4 text-navy-400" />
                    <span>Download Scanned Certificate ({cert.fileName || "Download"})</span>
                  </a>
                )}
                {canEdit && (
                  <Button size="sm" onClick={() => setHandingOver(true)} className="w-full">
                    Record Physical Handover
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-2 text-xs">
                <div className="flex justify-between border-b border-navy-100/30 pb-2 text-sm">
                  <span className="text-navy-400">Physically Handed To</span>
                  <span className="font-bold text-navy-800 dark:text-navy-100">{cert.handedOverTo}</span>
                </div>
                <div className="flex justify-between border-b border-navy-100/30 pb-2">
                  <span className="text-navy-400">Handover Date</span>
                  <span className="text-navy-700 dark:text-navy-300">
                    {cert.handedOverAt ? new Date(cert.handedOverAt).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-navy-400">Authorized By</span>
                  <span className="text-navy-700 dark:text-navy-300">{cert.handedOverByName}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Vaulting Dialog */}
        {vaulting && (
          <div className="fixed inset-0 z-[60] flex items-end justify-center bg-navy-950/40 p-4 backdrop-blur-sm sm:items-center" onClick={() => setVaulting(false)}>
            <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-card dark:bg-navy-900 border border-navy-100 dark:border-navy-800" onClick={(e) => e.stopPropagation()}>
              <div className="mb-4 flex items-start justify-between">
                <h3 className="text-base font-bold text-navy-900 dark:text-navy-50">Vault Original Certificate</h3>
                <button onClick={() => setVaulting(false)} className="rounded-full p-1 text-navy-400 hover:bg-navy-50 dark:hover:bg-navy-800" aria-label="Close"><X className="h-4 w-4" /></button>
              </div>
              <div className="space-y-3">
                <div>
                  <Label>Certificate Type</Label>
                  <select value={certType} onChange={(e) => setCertType(e.target.value)} className="mt-1 w-full rounded-2xl border border-navy-200 bg-white px-3.5 py-2.5 text-sm dark:border-navy-700 dark:bg-navy-900 text-navy-850">
                    <option value="KCSE">KCSE Leaving Certificate</option>
                    <option value="KCPE">KCPE Leaving Certificate</option>
                    <option value="OTHER">Other Academic Certificate</option>
                  </select>
                </div>
                <div>
                  <Label>Original Certificate Number</Label>
                  <Input value={certNo} onChange={(e) => setCertNo(e.target.value)} placeholder="e.g. 19280392 / 2026" />
                </div>
                <div>
                  <Label>Physical Hardcopy File Location (MANDATORY)</Label>
                  <Input value={hardcopyLoc} onChange={(e) => setHardcopyLoc(e.target.value)} placeholder="e.g. File Cabinet 3, Drawer B, Folder 12" />
                </div>
                <div>
                  <Label>Upload Scanned Scan (Optional)</Label>
                  {file ? (
                    <p className="flex items-center gap-2 rounded-xl bg-warm-50 px-3 py-2 text-xs text-navy-600 dark:bg-navy-800 dark:text-navy-300">
                      <FileText className="h-3.5 w-3.5 text-green-600" /> {file.fileName}
                      <button onClick={() => setFile(null)} className="ml-auto text-navy-400 hover:text-red-600" aria-label="Remove file"><X className="h-3.5 w-3.5" /></button>
                    </p>
                  ) : (
                    <FileUpload category="certificate" accept="image/*,application/pdf" onUploaded={setFile} label="Upload Scanned Certificate" />
                  )}
                </div>
                <Button onClick={handleVault} disabled={busy || !certNo.trim() || !hardcopyLoc.trim()} className="w-full">
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Secure in Vault
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Handover Dialog */}
        {handingOver && (
          <div className="fixed inset-0 z-[60] flex items-end justify-center bg-navy-950/40 p-4 backdrop-blur-sm sm:items-center" onClick={() => setHandingOver(false)}>
            <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-card dark:bg-navy-900 border border-navy-100 dark:border-navy-800" onClick={(e) => e.stopPropagation()}>
              <div className="mb-4 flex items-start justify-between">
                <h3 className="text-base font-bold text-navy-900 dark:text-navy-50">Log Certificate Handover</h3>
                <button onClick={() => setHandingOver(false)} className="rounded-full p-1 text-navy-400 hover:bg-navy-50 dark:hover:bg-navy-800" aria-label="Close"><X className="h-4 w-4" /></button>
              </div>
              <div className="space-y-3">
                <p className="text-xs text-navy-400">
                  This records the physical handover of the original certificate, freezing the vault record with signed receipt details.
                </p>
                <div>
                  <Label>Handed Over To (Full Name)</Label>
                  <Input value={recipient} onChange={(e) => setRecipient(e.target.value)} placeholder="e.g. Mary Wanjiru (Student)" />
                </div>
                <Button onClick={handleHandover} disabled={busy || !recipient.trim()} className="w-full">
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Confirm Physical Handover
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
