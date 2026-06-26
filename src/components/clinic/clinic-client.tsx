"use client";

/**
 * B.21 Clinic UI — tabs:
 * - Visits: record (complaint/treatment/medication/referral) — allergy
 *   warnings inline, referrals SMS the guardian
 * - Allergies: the register (clinic + kitchen safety) + edit profile
 * - Medications: active plans, give dose (trail), stop
 * - Report: year stats + frequent visitors
 */
import * as React from "react";
import {
  Stethoscope, X, Loader2, AlertCircle, Plus, ShieldAlert, Pill, FileBarChart,
  CheckCircle2, OctagonAlert,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { StudentSearchSelect } from "@/components/students/student-search-select";

interface Visit { id: string; studentName: string; admissionNo: string; date: string; complaint: string; treatment: string; medicationGiven: string | null; referredTo: string | null; recordedByName: string; parentNotifiedAt: string | null }
interface AllergyRow { studentId: string; studentName: string; admissionNo: string; className: string | null; allergies: string[]; conditions: string | null }
interface MedRow { id: string; studentName: string; drug: string; dosage: string; frequency: string; startDate: string; endDate: string | null; lastDoseAt: string | null; lastDoseBy: string | null }
interface Report { year: string; totalVisits: number; referrals: number; allergicStudents: number; activeMedications: number; frequentVisitors: { studentId: string; studentName: string; visits: number }[] }
interface StudentOpt { id: string; name: string; admissionNo: string }
interface Data { visits: Visit[]; allergies: AllergyRow[]; meds: MedRow[]; report: Report }

export function ClinicClient({ canManage }: { canManage: boolean }) {
  const { toast } = useToast();
  const [data, setData] = React.useState<Data | null>(null);
  const [error, setError] = React.useState(false);
  const [tab, setTab] = React.useState<"visits" | "allergies" | "meds" | "report">("visits");
  const [students, setStudents] = React.useState<StudentOpt[]>([]);
  const [dialog, setDialog] = React.useState<"visit" | "profile" | "medication" | null>(null);

  const load = React.useCallback(async () => {
    setError(false);
    try {
      const res = await fetch("/api/clinic");
      const json = await res.json();
      if (json.ok) setData(json.data); else setError(true);
    } catch { setError(true); }
  }, []);
  React.useEffect(() => {
    load();
    fetch("/api/students?status=ACTIVE").then((r) => r.json()).then((j) => {
      if (j.ok) setStudents(j.data.students.map((s: { id: string; name?: string; firstName: string; middleName?: string | null; lastName: string; admissionNo: string }) => ({
        id: s.id, name: s.name ?? [s.firstName, s.middleName, s.lastName].filter(Boolean).join(" "), admissionNo: s.admissionNo,
      })));
    }).catch(() => {});
  }, [load]);

  async function dose(planId: string, drug: string) {
    const res = await fetch("/api/clinic", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "dose", planId }),
    });
    const json = await res.json();
    if (json.ok) { toast({ title: `${drug} dose recorded`, tone: "success" }); load(); }
    else toast({ title: json.error?.message || "Failed", tone: "error" });
  }

  async function stopMed(planId: string, drug: string) {
    const res = await fetch("/api/clinic", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "stopMedication", planId }),
    });
    const json = await res.json();
    if (json.ok) { toast({ title: `${drug} plan closed`, tone: "success" }); load(); }
    else toast({ title: json.error?.message || "Failed", tone: "error" });
  }

  if (error) return <LoadError onRetry={load} />;
  if (data === null) return <div className="space-y-3"><Skeleton className="h-24 rounded-2xl" /><Skeleton className="h-48 rounded-2xl" /></div>;

  const tabs = [
    { key: "visits" as const, label: "Visits", icon: Stethoscope },
    { key: "allergies" as const, label: "Allergy register", icon: ShieldAlert },
    { key: "meds" as const, label: "Medications", icon: Pill },
    { key: "report" as const, label: "Health report", icon: FileBarChart },
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

      {tab === "visits" && (
        <div className="space-y-3">
          {canManage && <Button onClick={() => setDialog("visit")}><Plus className="h-4 w-4" /> Record visit</Button>}
          {data.visits.length === 0 ? (
            <EmptyState icon={Stethoscope} title="No clinic visits" description="Sickbay visits appear here. Referrals SMS the parent automatically." action={canManage ? <Button onClick={() => setDialog("visit")}><Plus className="h-4 w-4" /> Record visit</Button> : undefined} />
          ) : (
            <div className="space-y-2">
              {data.visits.map((v) => (
                <Card key={v.id}>
                  <CardContent className="space-y-1 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-navy-900 dark:text-navy-50">{v.studentName} <span className="font-mono text-xs text-navy-400">{v.admissionNo}</span></p>
                      <div className="flex items-center gap-1.5">
                        {v.referredTo && <Badge tone="red">referred → {v.referredTo}</Badge>}
                        {v.parentNotifiedAt && <Badge tone="blue">parent SMS ✓</Badge>}
                      </div>
                    </div>
                    <p className="text-xs text-navy-400">{v.date} · by {v.recordedByName}</p>
                    <p className="text-sm text-navy-700 dark:text-navy-200">{v.complaint} → {v.treatment}{v.medicationGiven ? ` · ${v.medicationGiven}` : ""}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "allergies" && (
        <div className="space-y-3">
          {canManage && <Button onClick={() => setDialog("profile")}><Plus className="h-4 w-4" /> Update medical profile</Button>}
          {data.allergies.length === 0 ? (
            <EmptyState icon={ShieldAlert} title="No recorded allergies" description="Allergy records protect learners at the clinic AND in the kitchen." />
          ) : (
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><OctagonAlert className="h-4 w-4 text-red-500" /> Allergy register — clinic &amp; kitchen safety</CardTitle></CardHeader>
              <CardContent>
                <ul className="divide-y divide-navy-50 dark:divide-navy-800">
                  {data.allergies.map((a) => (
                    <li key={a.studentId} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                      <div>
                        <p className="font-medium text-navy-900 dark:text-navy-50">{a.studentName} <span className="font-mono text-xs text-navy-400">{a.admissionNo}</span></p>
                        <p className="text-xs text-navy-400">{a.className ?? "—"}{a.conditions ? ` · ${a.conditions}` : ""}</p>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {a.allergies.map((al) => <Badge key={al} tone="red">{al}</Badge>)}
                      </div>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {tab === "meds" && (
        <div className="space-y-3">
          {canManage && <Button onClick={() => setDialog("medication")}><Plus className="h-4 w-4" /> Start medication plan</Button>}
          {data.meds.length === 0 ? (
            <EmptyState icon={Pill} title="No active medications" description="Track ongoing medication — every administered dose is logged." />
          ) : (
            <div className="space-y-2">
              {data.meds.map((m) => (
                <Card key={m.id}>
                  <CardContent className="flex flex-wrap items-center justify-between gap-2 p-4">
                    <div>
                      <p className="text-sm font-semibold text-navy-900 dark:text-navy-50">{m.studentName} — {m.drug}</p>
                      <p className="text-xs text-navy-400">
                        {m.dosage} · {m.frequency} · from {m.startDate}{m.endDate ? ` to ${m.endDate}` : ""}
                        {m.lastDoseAt ? ` · last dose ${new Date(m.lastDoseAt).toLocaleString("en-KE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} by ${m.lastDoseBy}` : " · no doses yet"}
                      </p>
                    </div>
                    {canManage && (
                      <div className="flex gap-1.5">
                        <Button size="sm" onClick={() => dose(m.id, m.drug)}><CheckCircle2 className="h-3.5 w-3.5" /> Give dose</Button>
                        <Button size="sm" variant="secondary" onClick={() => stopMed(m.id, m.drug)}>Stop</Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "report" && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Tile label={`Visits ${data.report.year}`} value={String(data.report.totalVisits)} />
            <Tile label="Referrals out" value={String(data.report.referrals)} />
            <Tile label="Students w/ allergies" value={String(data.report.allergicStudents)} />
            <Tile label="Active medications" value={String(data.report.activeMedications)} />
          </div>
          <Card>
            <CardHeader><CardTitle>Frequent visitors (≥3 this year)</CardTitle></CardHeader>
            <CardContent>
              {data.report.frequentVisitors.length === 0 ? (
                <p className="py-3 text-center text-sm text-navy-400">No frequent visitors — healthy school!</p>
              ) : (
                <ul className="divide-y divide-navy-50 dark:divide-navy-800">
                  {data.report.frequentVisitors.map((f) => (
                    <li key={f.studentId} className="flex items-center justify-between py-2 text-sm">
                      <p className="font-medium text-navy-900 dark:text-navy-50">{f.studentName}</p>
                      <Badge tone="amber">{f.visits} visits</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {dialog === "visit" && <VisitDialog students={students} onClose={() => setDialog(null)} onDone={() => { setDialog(null); load(); }} />}
      {dialog === "profile" && <ProfileDialog students={students} onClose={() => setDialog(null)} onDone={() => { setDialog(null); load(); }} />}
      {dialog === "medication" && <MedicationDialog students={students} onClose={() => setDialog(null)} onDone={() => { setDialog(null); load(); }} />}
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

function VisitDialog({ students, onClose, onDone }: { students: StudentOpt[]; onClose: () => void; onDone: () => void }) {
  const { toast } = useToast();
  const [f, setF] = React.useState({ studentId: "", date: today(), complaint: "", treatment: "", medicationGiven: "", referredTo: "" });
  const [saving, setSaving] = React.useState(false);
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/clinic", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "visit", ...f, medicationGiven: f.medicationGiven || undefined, referredTo: f.referredTo || undefined }),
      });
      const json = await res.json();
      if (json.ok) {
        if (json.data.allergyWarning) toast({ title: json.data.allergyWarning, tone: "error" });
        toast({ title: json.data.parentNotified ? "Visit recorded — referral SMS sent to parent" : "Visit recorded", tone: "success" });
        onDone();
      } else toast({ title: json.error?.message || "Failed", tone: "error" });
    } finally { setSaving(false); }
  }

  return (
    <Dialog title="Record a clinic visit" onClose={onClose}>
      <div className="space-y-3">
        <StudentSelect students={students} value={f.studentId} onChange={(v) => set("studentId", v)} />
        <div><Label>Date</Label><Input type="date" value={f.date} onChange={(e) => set("date", e.target.value)} /></div>
        <div><Label>Complaint</Label><Input value={f.complaint} onChange={(e) => set("complaint", e.target.value)} placeholder="e.g. Headache and fever since morning" /></div>
        <div><Label>Treatment given</Label><Input value={f.treatment} onChange={(e) => set("treatment", e.target.value)} placeholder="e.g. Rested 1hr; temperature monitored" /></div>
        <div><Label>Medication (optional)</Label><Input value={f.medicationGiven} onChange={(e) => set("medicationGiven", e.target.value)} placeholder="e.g. Paracetamol 500mg" /></div>
        <div><Label>Referred to (optional — SMS parent)</Label><Input value={f.referredTo} onChange={(e) => set("referredTo", e.target.value)} placeholder="e.g. Kiambu Level 5 Hospital" /></div>
        <Button onClick={save} disabled={saving || !f.studentId || f.complaint.trim().length < 3 || f.treatment.trim().length < 2} className="w-full">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Stethoscope className="h-4 w-4" />} Record visit
        </Button>
      </div>
    </Dialog>
  );
}

function ProfileDialog({ students, onClose, onDone }: { students: StudentOpt[]; onClose: () => void; onDone: () => void }) {
  const { toast } = useToast();
  const [f, setF] = React.useState({ studentId: "", bloodGroup: "", conditions: "", allergiesText: "", shaNumber: "" });
  const [saving, setSaving] = React.useState(false);
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/clinic", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "profile", studentId: f.studentId,
          bloodGroup: f.bloodGroup || undefined, conditions: f.conditions || undefined,
          allergies: f.allergiesText ? f.allergiesText.split(",").map((s) => s.trim()).filter(Boolean) : [],
          shaNumber: f.shaNumber || undefined,
        }),
      });
      const json = await res.json();
      if (json.ok) { toast({ title: "Medical profile saved", tone: "success" }); onDone(); }
      else toast({ title: json.error?.message || "Failed", tone: "error" });
    } finally { setSaving(false); }
  }

  return (
    <Dialog title="Medical profile" onClose={onClose}>
      <div className="space-y-3">
        <StudentSelect students={students} value={f.studentId} onChange={(v) => set("studentId", v)} />
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Blood group</Label>
            <select value={f.bloodGroup} onChange={(e) => set("bloodGroup", e.target.value)} className={selectCls}>
              <option value="">Unknown…</option>
              {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
          <div><Label>SHA number</Label><Input value={f.shaNumber} onChange={(e) => set("shaNumber", e.target.value)} placeholder="SHA-XXXX" /></div>
        </div>
        <div><Label>Chronic conditions</Label><Input value={f.conditions} onChange={(e) => set("conditions", e.target.value)} placeholder="e.g. Asthma" /></div>
        <div>
          <Label>Allergies (comma-separated)</Label>
          <Input value={f.allergiesText} onChange={(e) => set("allergiesText", e.target.value)} placeholder="e.g. Penicillin, Groundnuts" />
          <p className="mt-1 text-xs text-navy-400">These power alerts at the clinic AND on the kitchen board.</p>
        </div>
        <Button onClick={save} disabled={saving || !f.studentId} className="w-full">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldAlert className="h-4 w-4" />} Save profile
        </Button>
      </div>
    </Dialog>
  );
}

function MedicationDialog({ students, onClose, onDone }: { students: StudentOpt[]; onClose: () => void; onDone: () => void }) {
  const { toast } = useToast();
  const [f, setF] = React.useState({ studentId: "", drug: "", dosage: "", frequency: "", startDate: today(), endDate: "" });
  const [saving, setSaving] = React.useState(false);
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/clinic", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "medication", ...f, endDate: f.endDate || undefined }),
      });
      const json = await res.json();
      if (json.ok) { toast({ title: "Medication plan started", tone: "success" }); onDone(); }
      else toast({ title: json.error?.message || "Failed", tone: "error" });
    } finally { setSaving(false); }
  }

  return (
    <Dialog title="Start a medication plan" onClose={onClose}>
      <div className="space-y-3">
        <StudentSelect students={students} value={f.studentId} onChange={(v) => set("studentId", v)} />
        <div><Label>Drug</Label><Input value={f.drug} onChange={(e) => set("drug", e.target.value)} placeholder="e.g. Amoxicillin 250mg" /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Dosage</Label><Input value={f.dosage} onChange={(e) => set("dosage", e.target.value)} placeholder="1 tablet" /></div>
          <div><Label>Frequency</Label><Input value={f.frequency} onChange={(e) => set("frequency", e.target.value)} placeholder="3x daily after meals" /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>From</Label><Input type="date" value={f.startDate} onChange={(e) => set("startDate", e.target.value)} /></div>
          <div><Label>To (optional)</Label><Input type="date" value={f.endDate} onChange={(e) => set("endDate", e.target.value)} /></div>
        </div>
        <p className="rounded-xl bg-warm-50 px-3 py-2 text-xs text-navy-500 dark:bg-navy-800 dark:text-navy-300">If the drug matches a recorded allergy the plan is blocked.</p>
        <Button onClick={save} disabled={saving || !f.studentId || !f.drug || !f.dosage || !f.frequency} className="w-full">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pill className="h-4 w-4" />} Start plan
        </Button>
      </div>
    </Dialog>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-navy-100/70 bg-white px-4 py-3 dark:border-navy-800 dark:bg-navy-900">
      <p className="text-[11px] text-navy-400">{label}</p>
      <p className="text-xl font-semibold text-navy-900 dark:text-navy-50">{value}</p>
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
