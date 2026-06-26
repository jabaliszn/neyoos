"use client";

/**
 * B.9 Staff/HR hub: Directory (records + file drawer) · Leave (my leave +
 * approvals) · Recruitment. All 4 UX states; role-aware (manage vs view).
 */
import * as React from "react";
import {
  Users, AlertCircle, Loader2, X, Check, Plus, CalendarOff, Briefcase,
  Star, ShieldAlert, GraduationCap, ArrowUpRight, FileText, Search,
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
import { MessageButton } from "@/components/messaging/message-button";

interface StaffRow { userId: string; name: string; role: string; phone: string | null; email: string | null; tscNumber: string | null; qualifications: string | null; employmentDate: string | null; contractType: string | null; contractEndDate: string | null; hasProfile: boolean }
interface LeaveRow { id: string; userId: string; userName: string; type: string; startDate: string; endDate: string; days: number; reason: string | null; status: string; decidedByName: string | null; decisionNote: string | null }
interface Balance { type: string; label: string; allowance: number; used: number; remaining: number }
interface Posting { id: string; title: string; description: string | null; deadline: string | null; open: boolean; applicationCount: number; applications: { id: string; name: string; phone: string; email: string | null; status: string; notes: string | null }[] }
interface StaffFile { staff: { id: string; fullName: string; role: string; phone: string | null; email: string | null }; profile: Record<string, string | null> | null; leave: LeaveRow[]; appraisals: { id: string; period: string; score: number; strengths: string | null; improvements: string | null; reviewerName: string }[]; disciplinary: { id: string; date: string; category: string; details: string; actionTaken: string | null }[]; training: { id: string; title: string; provider: string | null; date: string; durationDays: number }[]; balances: Balance[] }

const LEAVE_STATUS_TONE: Record<string, "green" | "amber" | "red" | "neutral"> = { APPROVED: "green", PENDING: "amber", REJECTED: "red", CANCELLED: "neutral" };
const STAFF_ROLES = ["PRINCIPAL", "DEPUTY_PRINCIPAL", "DEAN_OF_STUDIES", "HOD", "TEACHER", "CLASS_TEACHER", "BURSAR", "ACCOUNTANT", "RECEPTIONIST", "LIBRARIAN", "HOSTEL_MASTER", "SUPPORT_STAFF"];

export function StaffClient({ canManage }: { canManage: boolean }) {
  const [tab, setTab] = React.useState<"directory" | "leave" | "recruitment">("directory");
  return (
    <div className="space-y-5">
      <div className="inline-flex rounded-full border border-navy-200 p-0.5 dark:border-navy-700">
        {([["directory", "Directory"], ["leave", "Leave"], ["recruitment", "Recruitment"]] as const).map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)} className={`rounded-full px-4 py-1.5 text-sm font-medium ${tab === k ? "bg-navy-900 text-white dark:bg-navy-50 dark:text-navy-900" : "text-navy-500"}`}>{label}</button>
        ))}
      </div>
      {tab === "directory" && <DirectoryTab canManage={canManage} />}
      {tab === "leave" && <LeaveTab canManage={canManage} />}
      {tab === "recruitment" && <RecruitmentTab canManage={canManage} />}
    </div>
  );
}

// ---- Directory --------------------------------------------------------------------
function DirectoryTab({ canManage }: { canManage: boolean }) {
  const [rows, setRows] = React.useState<StaffRow[] | null>(null);
  const [error, setError] = React.useState(false);
  const [file, setFile] = React.useState<string | null>(null);
  const [q, setQ] = React.useState("");
  const [importing, setImporting] = React.useState(false);

  const load = React.useCallback(async () => {
    setError(false);
    try {
      const res = await fetch("/api/hr?view=directory");
      const json = await res.json();
      if (json.ok) setRows(json.data.staff); else setError(true);
    } catch { setError(true); }
  }, []);
  React.useEffect(() => { load(); }, [load]);

  if (error) return <LoadError onRetry={load} />;
  if (rows === null) return <Skeletons />;

  const filtered = rows.filter((r) => 
    r.name.toLowerCase().includes(q.toLowerCase()) ||
    r.role.toLowerCase().includes(q.toLowerCase()) ||
    (r.tscNumber && r.tscNumber.toLowerCase().includes(q.toLowerCase()))
  );

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-navy-300" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search staff, role, TSC No..."
            className="w-64 rounded-full border border-navy-200 bg-white py-2 pl-9 pr-4 text-sm dark:border-navy-700 dark:bg-navy-900"
          />
        </div>
        {canManage && (
          <Button onClick={() => setImporting(true)}>
            <Plus className="h-4 w-4" /> Bulk Import Staff
          </Button>
        )}
      </div>

      <TableContainer>
        <Table>
          <THead><TR><TH>Staff</TH><TH>TSC No.</TH><TH>Contract</TH><TH>Since</TH><TH></TH></TR></THead>
          <TBody>
            {filtered.map((r) => (
              <TR key={r.userId}>
                <TD>
                  <span className="font-medium">{r.name}</span>
                  <span className="block text-[10px] text-navy-400">{r.role.replaceAll("_", " ").toLowerCase()}{r.phone ? ` · ${r.phone}` : ""}</span>
                </TD>
                <TD className="font-mono text-xs">{r.tscNumber ?? <span className="text-navy-300">—</span>}</TD>
                <TD>{r.contractType ? <Badge tone={r.contractType === "PERMANENT" ? "green" : "blue"}>{r.contractType.toLowerCase()}</Badge> : <Badge tone="amber">no record</Badge>}</TD>
                <TD className="text-xs text-navy-400">{r.employmentDate ?? "—"}</TD>
                <TD>
                  <div className="flex items-center gap-1.5">
                    <Button size="sm" variant="secondary" onClick={() => setFile(r.userId)}><FileText className="h-3.5 w-3.5" /> File</Button>
                    <MessageButton recipientId={r.userId} recipientName={r.name} />
                  </div>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </TableContainer>
      {file && <StaffFileDrawer userId={file} canManage={canManage} onClose={() => { setFile(null); load(); }} />}
      {importing && <ImportStaffModal onClose={() => setImporting(false)} onDone={() => { setImporting(false); load(); }} />}
    </>
  );
}

function StaffFileDrawer({ userId, canManage, onClose }: { userId: string; canManage: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const [data, setData] = React.useState<StaffFile | null>(null);
  const [editProfile, setEditProfile] = React.useState(false);
  const [promote, setPromote] = React.useState(false);
  const [addRec, setAddRec] = React.useState<null | "appraisal" | "disciplinary" | "training">(null);

  const load = React.useCallback(async () => {
    const res = await fetch(`/api/hr?view=file&userId=${userId}`);
    const json = await res.json();
    if (json.ok) setData(json.data);
  }, [userId]);
  React.useEffect(() => { load(); }, [load]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-navy-950/40 backdrop-blur-sm" onClick={onClose}>
      <div className="h-full w-full max-w-lg overflow-y-auto bg-white p-6 shadow-card dark:bg-navy-900" onClick={(e) => e.stopPropagation()}>
        {data === null ? <Skeletons /> : (
          <div className="space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold text-navy-900 dark:text-navy-50">{data.staff.fullName}</h3>
                <p className="text-xs text-navy-400">{data.staff.role.replaceAll("_", " ").toLowerCase()} · {data.staff.email ?? data.staff.phone ?? ""}</p>
                <div className="mt-2"><MessageButton recipientId={data.staff.id} recipientName={data.staff.fullName} label="Message this person" /></div>
              </div>
              <button onClick={onClose} className="rounded-full p-1 text-navy-400 hover:bg-navy-50 dark:hover:bg-navy-800" aria-label="Close"><X className="h-4 w-4" /></button>
            </div>

            {canManage && (
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" onClick={() => setEditProfile(true)}>Edit record</Button>
                <Button size="sm" variant="secondary" onClick={() => setPromote(true)}><ArrowUpRight className="h-3.5 w-3.5" /> Change role</Button>
                <Button size="sm" variant="secondary" onClick={() => setAddRec("appraisal")}><Star className="h-3.5 w-3.5" /> Appraise</Button>
                <Button size="sm" variant="secondary" onClick={() => setAddRec("training")}><GraduationCap className="h-3.5 w-3.5" /> Training</Button>
                <Button size="sm" variant="ghost" className="text-red-600" onClick={() => setAddRec("disciplinary")}><ShieldAlert className="h-3.5 w-3.5" /> Disciplinary</Button>
              </div>
            )}

            <Card>
              <CardHeader><CardTitle>HR record</CardTitle></CardHeader>
              <CardContent className="space-y-1.5 text-sm">
                <Row k="TSC number" v={data.profile?.tscNumber ?? "—"} />
                <Row k="National ID" v={data.profile?.nationalId ?? "—"} />
                <Row k="KRA PIN" v={data.profile?.kraPin ?? "—"} />
                <Row k="Qualifications" v={data.profile?.qualifications ?? "—"} />
                <Row k="Employed since" v={data.profile?.employmentDate ?? "—"} />
                <Row k="Contract" v={`${data.profile?.contractType ?? "—"}${data.profile?.contractEndDate ? ` (ends ${data.profile.contractEndDate})` : ""}`} />
                <Row k="Emergency contact" v={data.profile?.emergencyContact ?? "—"} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Leave balances ({new Date().getFullYear()})</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-2">
                  {data.balances.map((b) => (
                    <div key={b.type} className="rounded-xl bg-warm-50 px-3 py-2 dark:bg-navy-800">
                      <p className="text-xs text-navy-400">{b.label}</p>
                      <p className="text-sm font-semibold text-navy-900 dark:text-navy-50">{b.remaining}<span className="text-xs font-normal text-navy-400"> / {b.allowance} days left</span></p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {data.appraisals.length > 0 && (
              <Card>
                <CardHeader><CardTitle>Appraisals</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {data.appraisals.map((a) => (
                    <div key={a.id} className="rounded-xl bg-warm-50 px-3 py-2 text-sm dark:bg-navy-800">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{a.period}</span>
                        <span className="text-amber-500">{"★".repeat(a.score)}{"☆".repeat(5 - a.score)}</span>
                      </div>
                      {a.strengths && <p className="mt-0.5 text-xs text-navy-500">+ {a.strengths}</p>}
                      {a.improvements && <p className="text-xs text-navy-400">→ {a.improvements}</p>}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {data.training.length > 0 && (
              <Card>
                <CardHeader><CardTitle>Training / CPD</CardTitle></CardHeader>
                <CardContent className="space-y-1.5 text-sm">
                  {data.training.map((t) => (
                    <p key={t.id}><span className="font-medium">{t.title}</span> <span className="text-xs text-navy-400">· {t.provider ?? ""} · {t.date} · {t.durationDays}d</span></p>
                  ))}
                </CardContent>
              </Card>
            )}

            {data.disciplinary.length > 0 && (
              <Card>
                <CardHeader><CardTitle className="text-red-600">Disciplinary</CardTitle></CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {data.disciplinary.map((dr) => (
                    <div key={dr.id} className="rounded-xl bg-red-50 px-3 py-2 dark:bg-red-950/20">
                      <p className="text-xs font-semibold text-red-700 dark:text-red-300">{dr.category.replaceAll("_", " ")} · {dr.date}</p>
                      <p className="text-xs text-navy-600 dark:text-navy-300">{dr.details}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        )}
        {editProfile && data && <ProfileDialog userId={userId} profile={data.profile} onClose={() => setEditProfile(false)} onDone={() => { setEditProfile(false); load(); toast({ title: "Record saved", tone: "success" }); }} />}
        {promote && data && <PromoteDialog userId={userId} current={data.staff.role} onClose={() => setPromote(false)} onDone={() => { setPromote(false); load(); toast({ title: "Role change confirmed", tone: "success" }); }} />}
        {addRec && data && <RecordDialog kind={addRec} userId={userId} onClose={() => setAddRec(null)} onDone={() => { setAddRec(null); load(); toast({ title: "Saved", tone: "success" }); }} />}
      </div>
    </div>
  );

  function Row({ k, v }: { k: string; v: string }) {
    return <div className="flex justify-between gap-3"><span className="text-navy-400">{k}</span><span className="text-right text-navy-800 dark:text-navy-100">{v}</span></div>;
  }
}

function ProfileDialog({ userId, profile, onClose, onDone }: { userId: string; profile: Record<string, string | null> | null; onClose: () => void; onDone: () => void }) {
  const { toast } = useToast();
  const [f, setF] = React.useState({
    tscNumber: profile?.tscNumber ?? "", nationalId: profile?.nationalId ?? "", kraPin: profile?.kraPin ?? "",
    qualifications: profile?.qualifications ?? "", employmentDate: profile?.employmentDate ?? "",
    contractType: profile?.contractType ?? "PERMANENT", contractEndDate: profile?.contractEndDate ?? "",
    emergencyContact: profile?.emergencyContact ?? "",
  });
  const [saving, setSaving] = React.useState(false);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF((p) => ({ ...p, [k]: e.target.value }));

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/hr", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "profile", userId, ...f }) });
      const json = await res.json();
      if (json.ok) onDone(); else toast({ title: json.error?.message || "Failed", tone: "error" });
    } finally { setSaving(false); }
  }

  return (
    <Modal title="HR record" onClose={onClose}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div><Label>TSC number</Label><Input value={f.tscNumber} onChange={set("tscNumber")} placeholder="TSC/123456" /></div>
          <div><Label>National ID</Label><Input value={f.nationalId} onChange={set("nationalId")} /></div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div><Label>KRA PIN</Label><Input value={f.kraPin} onChange={set("kraPin")} placeholder="A012345678Z" /></div>
          <div><Label>Employed since</Label><Input type="date" value={f.employmentDate} onChange={set("employmentDate")} /></div>
        </div>
        <div><Label>Qualifications</Label><Input value={f.qualifications} onChange={set("qualifications")} placeholder="B.Ed (Maths/Physics), Kenyatta University" /></div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label>Contract</Label>
            <select value={f.contractType} onChange={set("contractType")} className="mt-1 w-full rounded-xl border border-navy-200 bg-white px-3 py-2 text-sm dark:border-navy-700 dark:bg-navy-800">
              <option value="PERMANENT">Permanent</option><option value="CONTRACT">Contract</option><option value="BOM">BOM</option><option value="INTERN">Intern</option>
            </select>
          </div>
          <div><Label>Contract ends (if any)</Label><Input type="date" value={f.contractEndDate} onChange={set("contractEndDate")} /></div>
        </div>
        <div><Label>Emergency contact</Label><Input value={f.emergencyContact} onChange={set("emergencyContact")} placeholder="Name · 07XX XXX XXX" /></div>
        <Button onClick={save} disabled={saving} className="w-full">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Save record</Button>
      </div>
    </Modal>
  );
}

function PromoteDialog({ userId, current, onClose, onDone }: { userId: string; current: string; onClose: () => void; onDone: () => void }) {
  const { toast } = useToast();
  const [newRole, setNewRole] = React.useState(current);
  const [note, setNote] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/hr", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "promote", userId, newRole, note }) });
      const json = await res.json();
      if (json.ok) onDone(); else toast({ title: json.error?.message || "Failed", tone: "error" });
    } finally { setSaving(false); }
  }
  return (
    <Modal title="Confirm role change" onClose={onClose}>
      <div className="space-y-3">
        <p className="rounded-2xl border border-amber-200 bg-amber-50/70 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200">
          Role changes are critical. Only a Principal or School Owner can confirm them, and the confirmation is saved in the audit trail.
        </p>
        <div>
          <Label>New role</Label>
          <select value={newRole} onChange={(e) => setNewRole(e.target.value)} className="mt-1 w-full rounded-xl border border-navy-200 bg-white px-3 py-2 text-sm dark:border-navy-700 dark:bg-navy-800">
            {STAFF_ROLES.map((r) => <option key={r} value={r}>{r.replaceAll("_", " ")}</option>)}
          </select>
        </div>
        <div><Label>Confirmation note (audit trail)</Label><Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Principal confirmed HOD Sciences appointment" /></div>
        <Button onClick={save} disabled={saving || newRole === current} className="w-full">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUpRight className="h-4 w-4" />} Confirm role change</Button>
      </div>
    </Modal>
  );
}

function RecordDialog({ kind, userId, onClose, onDone }: { kind: "appraisal" | "disciplinary" | "training"; userId: string; onClose: () => void; onDone: () => void }) {
  const { toast } = useToast();
  const today = new Date(Date.now() + 3 * 3600_000).toISOString().slice(0, 10);
  const [f, setF] = React.useState<Record<string, string>>({ period: "", score: "3", strengths: "", improvements: "", date: today, category: "VERBAL_WARNING", details: "", actionTaken: "", title: "", provider: "", durationDays: "1" });
  const [saving, setSaving] = React.useState(false);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF((p) => ({ ...p, [k]: e.target.value }));

  async function save() {
    setSaving(true);
    try {
      const body = kind === "appraisal"
        ? { action: "appraisal", userId, period: f.period, score: Number(f.score), strengths: f.strengths, improvements: f.improvements }
        : kind === "disciplinary"
        ? { action: "disciplinary", userId, date: f.date, category: f.category, details: f.details, actionTaken: f.actionTaken }
        : { action: "training", userId, title: f.title, provider: f.provider, date: f.date, durationDays: Number(f.durationDays) };
      const res = await fetch("/api/hr", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const json = await res.json();
      if (json.ok) onDone(); else toast({ title: json.error?.message || "Failed", tone: "error" });
    } finally { setSaving(false); }
  }

  return (
    <Modal title={kind === "appraisal" ? "Performance appraisal" : kind === "disciplinary" ? "Disciplinary record" : "Training / CPD"} onClose={onClose}>
      <div className="space-y-3">
        {kind === "appraisal" && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Period</Label><Input value={f.period} onChange={set("period")} placeholder="2026-T2" /></div>
              <div>
                <Label>Score</Label>
                <select value={f.score} onChange={set("score")} className="mt-1 w-full rounded-xl border border-navy-200 bg-white px-3 py-2 text-sm dark:border-navy-700 dark:bg-navy-800">
                  {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n} — {"★".repeat(n)}</option>)}
                </select>
              </div>
            </div>
            <div><Label>Strengths</Label><Input value={f.strengths} onChange={set("strengths")} /></div>
            <div><Label>Areas to improve</Label><Input value={f.improvements} onChange={set("improvements")} /></div>
          </>
        )}
        {kind === "disciplinary" && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Date</Label><Input type="date" value={f.date} onChange={set("date")} /></div>
              <div>
                <Label>Category</Label>
                <select value={f.category} onChange={set("category")} className="mt-1 w-full rounded-xl border border-navy-200 bg-white px-3 py-2 text-sm dark:border-navy-700 dark:bg-navy-800">
                  <option value="VERBAL_WARNING">Verbal warning</option><option value="WRITTEN_WARNING">Written warning</option><option value="SUSPENSION">Suspension</option><option value="OTHER">Other</option>
                </select>
              </div>
            </div>
            <div><Label>Details</Label><Input value={f.details} onChange={set("details")} /></div>
            <div><Label>Action taken</Label><Input value={f.actionTaken} onChange={set("actionTaken")} /></div>
          </>
        )}
        {kind === "training" && (
          <>
            <div><Label>Training title</Label><Input value={f.title} onChange={set("title")} placeholder="e.g. CBC upskilling workshop" /></div>
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-1"><Label>Provider</Label><Input value={f.provider} onChange={set("provider")} placeholder="KICD" /></div>
              <div><Label>Date</Label><Input type="date" value={f.date} onChange={set("date")} /></div>
              <div><Label>Days</Label><Input type="number" min={1} value={f.durationDays} onChange={set("durationDays")} /></div>
            </div>
          </>
        )}
        <Button onClick={save} disabled={saving} className="w-full">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Save</Button>
      </div>
    </Modal>
  );
}

// ---- Leave -------------------------------------------------------------------------
function LeaveTab({ canManage }: { canManage: boolean }) {
  const { toast } = useToast();
  const [mine, setMine] = React.useState<{ leave: LeaveRow[]; balances: Balance[] } | null>(null);
  const [all, setAll] = React.useState<LeaveRow[] | null>(null);
  const [error, setError] = React.useState(false);
  const [applyOpen, setApplyOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  const load = React.useCallback(async () => {
    setError(false);
    try {
      const m = await fetch("/api/hr?view=mine").then((r) => r.json());
      if (m.ok) setMine(m.data); else setError(true);
      if (canManage) {
        const a = await fetch("/api/hr?view=leave").then((r) => r.json());
        if (a.ok) setAll(a.data.leave);
      }
    } catch { setError(true); }
  }, [canManage]);
  React.useEffect(() => { load(); }, [load]);

  async function decide(leaveId: string, approve: boolean) {
    setBusy(true);
    try {
      const res = await fetch("/api/hr", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "leave_decide", leaveId, approve }) });
      const json = await res.json();
      if (json.ok) { toast({ title: approve ? "Leave approved — added to the calendar" : "Leave rejected", tone: "success" }); load(); }
      else toast({ title: json.error?.message || "Failed", tone: "error" });
    } finally { setBusy(false); }
  }

  if (error) return <LoadError onRetry={load} />;
  if (mine === null) return <Skeletons />;

  const pending = (all ?? []).filter((l) => l.status === "PENDING");

  return (
    <div className="space-y-4">
      {/* my balances + apply */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>My leave</span>
            <Button size="sm" onClick={() => setApplyOpen(true)}><Plus className="h-3.5 w-3.5" /> Apply for leave</Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {mine.balances.map((b) => (
              <div key={b.type} className="rounded-xl bg-warm-50 px-3 py-2 dark:bg-navy-800">
                <p className="text-xs text-navy-400">{b.label}</p>
                <p className="text-sm font-semibold text-navy-900 dark:text-navy-50">{b.remaining}<span className="text-xs font-normal text-navy-400"> / {b.allowance} left</span></p>
              </div>
            ))}
          </div>
          {mine.leave.length > 0 && (
            <ul className="divide-y divide-navy-50 dark:divide-navy-800">
              {mine.leave.map((l) => (
                <li key={l.id} className="flex items-center justify-between py-2 text-sm">
                  <span>{l.startDate} → {l.endDate} <span className="text-xs text-navy-400">({l.days}d {l.type.toLowerCase()})</span></span>
                  <Badge tone={LEAVE_STATUS_TONE[l.status]}>{l.status.toLowerCase()}</Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* approvals (leadership) */}
      {canManage && all !== null && (
        <Card>
          <CardHeader><CardTitle>Approvals {pending.length > 0 && <Badge tone="amber">{pending.length} pending</Badge>}</CardTitle></CardHeader>
          <CardContent>
            {all.length === 0 ? (
              <EmptyState icon={CalendarOff} title="No leave requests" description="Staff applications appear here for approval." />
            ) : (
              <ul className="divide-y divide-navy-50 dark:divide-navy-800">
                {all.map((l) => (
                  <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                    <div>
                      <p className="font-medium text-navy-900 dark:text-navy-50">{l.userName}</p>
                      <p className="text-xs text-navy-400">{l.startDate} → {l.endDate} · {l.days}d {l.type.toLowerCase()}{l.reason ? ` · "${l.reason}"` : ""}</p>
                    </div>
                    {l.status === "PENDING" ? (
                      <div className="flex gap-1.5">
                        <Button size="sm" onClick={() => decide(l.id, true)} disabled={busy}><Check className="h-3.5 w-3.5" /> Approve</Button>
                        <Button size="sm" variant="ghost" className="text-red-600" onClick={() => decide(l.id, false)} disabled={busy}>Reject</Button>
                      </div>
                    ) : (
                      <Badge tone={LEAVE_STATUS_TONE[l.status]}>{l.status.toLowerCase()}</Badge>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      {applyOpen && <ApplyLeaveDialog balances={mine.balances} onClose={() => setApplyOpen(false)} onDone={() => { setApplyOpen(false); load(); toast({ title: "Leave request submitted", tone: "success" }); }} />}
    </div>
  );
}

function ApplyLeaveDialog({ balances, onClose, onDone }: { balances: Balance[]; onClose: () => void; onDone: () => void }) {
  const { toast } = useToast();
  const [f, setF] = React.useState({ type: "ANNUAL", startDate: "", endDate: "", reason: "" });
  const [saving, setSaving] = React.useState(false);
  const bal = balances.find((b) => b.type === f.type);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/hr", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "leave_apply", ...f }) });
      const json = await res.json();
      if (json.ok) onDone(); else toast({ title: json.error?.message || "Failed", tone: "error" });
    } finally { setSaving(false); }
  }

  return (
    <Modal title="Apply for leave" onClose={onClose}>
      <div className="space-y-3">
        <div>
          <Label>Type</Label>
          <select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })} className="mt-1 w-full rounded-xl border border-navy-200 bg-white px-3 py-2 text-sm dark:border-navy-700 dark:bg-navy-800">
            {balances.map((b) => <option key={b.type} value={b.type}>{b.label} ({b.remaining} left)</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div><Label>From</Label><Input type="date" value={f.startDate} onChange={(e) => setF({ ...f, startDate: e.target.value })} /></div>
          <div><Label>To</Label><Input type="date" value={f.endDate} onChange={(e) => setF({ ...f, endDate: e.target.value })} /></div>
        </div>
        <div><Label>Reason (optional)</Label><Input value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} /></div>
        {bal && <p className="text-xs text-navy-400">{bal.remaining} of {bal.allowance} {bal.label.toLowerCase()} days remaining this year.</p>}
        <Button onClick={save} disabled={saving || !f.startDate || !f.endDate} className="w-full">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarOff className="h-4 w-4" />} Submit request
        </Button>
      </div>
    </Modal>
  );
}

// ---- Recruitment ---------------------------------------------------------------------
function RecruitmentTab({ canManage }: { canManage: boolean }) {
  const { toast } = useToast();
  const [postings, setPostings] = React.useState<Posting[] | null>(null);
  const [error, setError] = React.useState(false);
  const [newOpen, setNewOpen] = React.useState(false);
  const [applyTo, setApplyTo] = React.useState<Posting | null>(null);

  const load = React.useCallback(async () => {
    setError(false);
    try {
      const res = await fetch("/api/hr?view=postings");
      const json = await res.json();
      if (json.ok) setPostings(json.data.postings); else setError(true);
    } catch { setError(true); }
  }, []);
  React.useEffect(() => { load(); }, [load]);

  async function setStatus(applicationId: string, status: string) {
    const res = await fetch("/api/hr", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "app_status", applicationId, status }) });
    const json = await res.json();
    if (json.ok) load(); else toast({ title: json.error?.message || "Failed", tone: "error" });
  }

  if (error) return <LoadError onRetry={load} />;
  if (postings === null) return <Skeletons />;

  return (
    <div className="space-y-4">
      {canManage && <Button onClick={() => setNewOpen(true)}><Plus className="h-4 w-4" /> Post a job</Button>}
      {postings.length === 0 ? (
        <EmptyState icon={Briefcase} title="No open positions" description="Post a vacancy and log applicants as they come in — calls, walk-ins or referrals." />
      ) : (
        postings.map((p) => (
          <Card key={p.id}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>{p.title} {!p.open && <Badge tone="neutral">closed</Badge>}</span>
                <div className="flex items-center gap-2">
                  <Badge tone="blue">{p.applicationCount} applicant{p.applicationCount === 1 ? "" : "s"}</Badge>
                  {canManage && <Button size="sm" variant="secondary" onClick={() => setApplyTo(p)}>Log applicant</Button>}
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {p.description && <p className="mb-2 text-sm text-navy-500 dark:text-navy-400">{p.description}{p.deadline ? ` · Deadline ${p.deadline}` : ""}</p>}
              {p.applications.length > 0 && (
                <ul className="divide-y divide-navy-50 dark:divide-navy-800">
                  {p.applications.map((a) => (
                    <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                      <span><span className="font-medium">{a.name}</span> <span className="text-xs text-navy-400">· {a.phone}</span></span>
                      {canManage ? (
                        <select value={a.status} onChange={(e) => setStatus(a.id, e.target.value)} className="rounded-full border border-navy-200 bg-white px-2 py-1 text-xs dark:border-navy-700 dark:bg-navy-800">
                          {["NEW", "SHORTLISTED", "INTERVIEWED", "HIRED", "REJECTED"].map((s) => <option key={s} value={s}>{s.toLowerCase()}</option>)}
                        </select>
                      ) : (
                        <Badge tone="neutral">{a.status.toLowerCase()}</Badge>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        ))
      )}
      {newOpen && <PostingDialog onClose={() => setNewOpen(false)} onDone={() => { setNewOpen(false); load(); toast({ title: "Job posted", tone: "success" }); }} />}
      {applyTo && <ApplicantDialog posting={applyTo} onClose={() => setApplyTo(null)} onDone={() => { setApplyTo(null); load(); toast({ title: "Applicant logged", tone: "success" }); }} />}
    </div>
  );
}

function PostingDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { toast } = useToast();
  const [f, setF] = React.useState({ title: "", description: "", deadline: "" });
  const [saving, setSaving] = React.useState(false);
  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/hr", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "posting", ...f }) });
      const json = await res.json();
      if (json.ok) onDone(); else toast({ title: json.error?.message || "Failed", tone: "error" });
    } finally { setSaving(false); }
  }
  return (
    <Modal title="Post a job" onClose={onClose}>
      <div className="space-y-3">
        <div><Label>Title</Label><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="e.g. Mathematics / Physics teacher" /></div>
        <div><Label>Description (optional)</Label><Input value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
        <div><Label>Deadline (optional)</Label><Input type="date" value={f.deadline} onChange={(e) => setF({ ...f, deadline: e.target.value })} /></div>
        <Button onClick={save} disabled={saving || f.title.length < 3} className="w-full">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Briefcase className="h-4 w-4" />} Post job</Button>
      </div>
    </Modal>
  );
}

function ApplicantDialog({ posting, onClose, onDone }: { posting: Posting; onClose: () => void; onDone: () => void }) {
  const { toast } = useToast();
  const [f, setF] = React.useState({ name: "", phone: "", email: "", notes: "" });
  const [saving, setSaving] = React.useState(false);
  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/hr", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "application", postingId: posting.id, ...f }) });
      const json = await res.json();
      if (json.ok) onDone(); else toast({ title: json.error?.message || "Failed", tone: "error" });
    } finally { setSaving(false); }
  }
  return (
    <Modal title={`Applicant — ${posting.title}`} onClose={onClose}>
      <div className="space-y-3">
        <div><Label>Full name</Label><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
        <div className="grid grid-cols-2 gap-2">
          <div><Label>Phone</Label><Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder="07XX XXX XXX" /></div>
          <div><Label>Email (optional)</Label><Input value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
        </div>
        <div><Label>Notes (optional)</Label><Input value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></div>
        <Button onClick={save} disabled={saving || f.name.length < 2 || !f.phone} className="w-full">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Log applicant</Button>
      </div>
    </Modal>
  );
}

// ---- shared ----------------------------------------------------------------------------
function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-navy-950/40 p-4 backdrop-blur-sm sm:items-center" onClick={onClose}>
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

// ---- Staff Excel / CSV Import Modal (Chunk C — Part 1) -------------------------------
interface ImportErrorItem { row: number; name: string; message: string }

function ImportStaffModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { toast } = useToast();
  const [text, setText] = React.useState("");
  const [file, setFile] = React.useState<File | null>(null);
  const [hasHeader, setHasHeader] = React.useState(true);
  const [importing, setImporting] = React.useState(false);
  const [result, setResult] = React.useState<{ created: number; skipped: number; errors: ImportErrorItem[] } | null>(null);

  async function handleImport() {
    if (!text.trim() && !file) return;
    setImporting(true);
    setResult(null);

    try {
      let res: Response;
      if (file) {
        const form = new FormData();
        form.append("file", file);
        form.append("hasHeader", String(hasHeader));
        res = await fetch("/api/hr/import", { method: "POST", body: form });
      } else {
        res = await fetch("/api/hr/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, hasHeader }),
        });
      }

      const json = await res.json();
      if (json.ok) {
        setResult(json.data);
        toast({
          title: `Import completed: ${json.data.created} staff member${json.data.created === 1 ? "" : "s"} created`,
          tone: json.data.created > 0 ? "success" : "error",
        });
        if (json.data.created > 0) onDone();
      } else {
        toast({ title: json.error?.message || "Import failed.", tone: "error" });
      }
    } catch {
      toast({ title: "Failed to parse or submit import data.", tone: "error" });
    } finally {
      setImporting(false);
    }
  }

  const sample = "Full Name,Role,Phone,Email,TSC Number,National ID,KRA PIN,Qualifications,Employment Date,Contract Type,Emergency Contact\nMary Akinyi,TEACHER,0711223344,mary.akinyi@karibuhigh.ac.ke,TSC/778899,23991122,A123456789Z,B.Ed Kiswahili,23/06/2026,CONTRACT,Otieno 0722000000";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/40 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-2xl rounded-3xl border border-navy-100 bg-white p-6 shadow-pop dark:border-navy-800 dark:bg-navy-900" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <div className="space-y-0.5">
            <h3 className="text-base font-bold text-navy-900 dark:text-navy-50">Bulk Import Staff</h3>
            <p className="text-xs text-navy-400">Upload CSV/XLSX or paste from Excel. Bundi handwriting scan can feed the same import later; this works fully rule-based today.</p>
          </div>
          <button onClick={onClose} className="rounded-full p-1.5 text-navy-400 hover:bg-navy-50 dark:hover:bg-navy-800" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-dashed border-green-200 bg-green-50/60 p-4 text-xs dark:border-green-900/40 dark:bg-green-950/15">
            <p className="font-bold text-navy-800 dark:text-navy-100">Accepted columns</p>
            <p className="mt-1 font-mono text-navy-600 dark:text-navy-300">Full Name · Role · Phone · Email · TSC Number · National ID · KRA PIN · Qualifications · Employment Date · Contract Type · Emergency Contact</p>
            <p className="mt-2 text-navy-500 dark:text-navy-400">Headers are auto-mapped, phone numbers are normalized to +254, duplicates are denied before any staff account is created.</p>
          </div>

          {!result ? (
            <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
              <div className="space-y-3">
                <div>
                  <Label htmlFor="staff-import-file">Upload staff file</Label>
                  <input
                    id="staff-import-file"
                    type="file"
                    accept=".csv,.tsv,.txt,.xlsx"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                    className="mt-1.5 w-full rounded-2xl border border-navy-200 bg-white px-3.5 py-2.5 text-sm dark:border-navy-700 dark:bg-navy-900"
                    disabled={importing}
                  />
                  {file && <p className="mt-1 text-[11px] text-green-700 dark:text-green-300">Selected: {file.name}</p>}
                </div>
                <label className="flex items-center gap-2 rounded-2xl border border-navy-100 bg-white/60 px-3 py-2 text-xs text-navy-600 dark:border-navy-800 dark:bg-navy-950/40 dark:text-navy-300">
                  <input type="checkbox" checked={hasHeader} onChange={(e) => setHasHeader(e.target.checked)} className="h-4 w-4 rounded border-navy-300 text-green-600" />
                  First row contains column headers
                </label>
                <Button variant="secondary" onClick={() => { setText(sample); setFile(null); }} disabled={importing} className="w-full">
                  <FileText className="h-4 w-4" /> Use sample CSV
                </Button>
              </div>

              <div className="space-y-3">
                <div>
                  <Label htmlFor="paste-data">Or paste spreadsheet cells</Label>
                  <textarea
                    id="paste-data"
                    rows={8}
                    value={text}
                    onChange={(e) => { setText(e.target.value); if (e.target.value.trim()) setFile(null); }}
                    placeholder={sample}
                    className="mt-1.5 w-full rounded-2xl border border-navy-200 bg-white px-3.5 py-2.5 text-xs font-mono transition-colors duration-200 ease-apple focus:border-navy-300 focus:outline-none focus:ring-2 focus:ring-green-500/30 dark:border-navy-700 dark:bg-navy-900 text-navy-900 dark:text-navy-50"
                    disabled={importing}
                  />
                </div>
                <Button onClick={handleImport} disabled={importing || (!text.trim() && !file)} className="w-full">
                  {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  Run Rule-Based Staff Import
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-center text-xs">
                <div className="rounded-2xl bg-green-500/10 border border-green-500/20 p-3 text-green-700 dark:text-green-300 font-semibold">
                  <span className="block text-lg font-bold">{result.created}</span>
                  Created Successfully
                </div>
                <div className="rounded-2xl bg-amber-500/10 border border-amber-500/20 p-3 text-amber-700 dark:text-amber-300 font-semibold">
                  <span className="block text-lg font-bold">{result.skipped}</span>
                  Skipped / Errors
                </div>
              </div>

              {result.errors.length > 0 && (
                <div className="max-h-40 overflow-y-auto rounded-2xl border border-red-100 bg-red-50/50 p-3 dark:border-red-900/30 dark:bg-red-950/20 space-y-1.5">
                  <p className="text-xs font-bold text-red-700 dark:text-red-300">Detailed Import Logs:</p>
                  {result.errors.map((e, idx) => (
                    <div key={idx} className="text-[11px] text-navy-600 dark:text-navy-300">
                      <span className="font-semibold">{e.name} (Row {e.row}):</span> {e.message}
                    </div>
                  ))}
                </div>
              )}

              <Button variant="secondary" onClick={() => { setResult(null); setText(""); setFile(null); }} className="w-full">
                Import Another List
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
