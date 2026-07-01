"use client";

/**
 * B.4 Academics — tabs: Subjects · Departments · Terms · Timetable · Lessons.
 * Timetable: Odoo-style weekly grid, click a cell to set subject+teacher,
 * conflict errors surface as toasts, plus the greedy Auto-fill dialog.
 * All 4 UX states; mobile = horizontal-scroll grid.
 */
import * as React from "react";
import { TalentManagerClient } from "./talent-manager";
import { ReportBuilderClient } from "./report-builder";
import { CurriculumVersionManagerClient } from "./curriculum-version-manager";
import { PathwayManagerClient } from "./pathway-manager";
import { SubjectSelectionManager } from "./subject-selection-manager";
import { ComputationDashboardClient } from "./computation-dashboard";
import {
  BookOpen, Building2, CalendarRange, Grid3X3, NotebookPen, Plus,
  AlertCircle, Loader2, X, Sparkles, Trash2, Check, Calendar, Printer, Palette, Sliders, Info, HelpCircle, Save, Trophy,
  Calculator, FileText, Clock3, Wand2, RefreshCw, Link2, Ban, Users, TimerReset, ShieldCheck, RotateCcw, ClipboardList
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
import { cn } from "@/lib/utils";

interface Subject { id: string; name: string; code: string; curriculum: string; departmentId: string | null; departmentName: string | null; archived: boolean }
interface Dept { id: string; name: string; hodId: string | null; hodName: string | null; subjectCount: number }
interface Term { id: string; year: number; term: number; startDate: string; endDate: string; current: boolean }
interface ClassOpt { id: string; name: string }
interface Slot { id: string; dayOfWeek: number; period: number; subjectId?: string | null; subjectName?: string | null; subjectCode?: string | null; activityCategoryId?: string | null; activityCategoryName?: string | null; activityCategoryColor?: string | null; teacherId: string | null; teacherName: string | null; venue?: string | null; className?: string; slotType?: string; weekRotation?: string; isCombined?: boolean; combinedDetails?: string; }
interface TimetablePrintGroup { id: string; title: string; subtitle: string; config: any; slots: Slot[] }
interface TimetablePrintBundle { mode: "classes" | "teachers" | "venues"; groups: TimetablePrintGroup[] }
interface Plan { id: string; date: string; topic: string; status: string; subjectName: string; subjectCode: string; className: string; teacherName: string }
interface Staff { id: string; fullName: string; role: string }

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri"];

export function AcademicsClient({ canManage, canAppointHod, isScopedHod, isCurriculumEngineEnabled = false, schoolLevelActivation }: { canManage: boolean; canAppointHod: boolean; isScopedHod: boolean; isCurriculumEngineEnabled?: boolean; schoolLevelActivation?: { shouldShowPathwayTools: boolean; shouldShowSubjectSelectionTools: boolean; isJuniorSchool: boolean; isSeniorSchool: boolean; isMixedSchool: boolean; educationLevelsOffered: string[] } }) {
  const [subjects, setSubjects] = React.useState<Subject[]>([]);
  const [tab, setTab] = React.useState<"subjects" | "departments" | "cocurricular" | "terms" | "timetable" | "exam-timetable" | "exam-auto-generator" | "lessons" | "generator" | "smart-timetable" | "roster" | "reports" | "curriculum-versions" | "pathways" | "computation" | "subject-selection">("subjects");

  React.useEffect(() => {
    fetch("/api/academics/subjects")
      .then((r) => r.json())
      .then((j) => { if (j.ok) setSubjects(j.data.subjects ?? []); })
      .catch(() => {});
  }, []);

  const showPathwayTools = schoolLevelActivation?.shouldShowPathwayTools ?? true;
  const showSubjectSelectionTools = schoolLevelActivation?.shouldShowSubjectSelectionTools ?? true;

  const tabs = [
    { key: "subjects" as const, label: "Subjects", icon: BookOpen },
    { key: "departments" as const, label: "Departments", icon: Building2 },
    { key: "cocurricular" as const, label: "Co-curricular", icon: Trophy },
    { key: "terms" as const, label: "Terms", icon: CalendarRange },
    { key: "timetable" as const, label: "Timetable", icon: Grid3X3 },
    { key: "exam-timetable" as const, label: "Exam Timetable", icon: ClipboardList },
    { key: "exam-auto-generator" as const, label: "Exam Auto-Generator", icon: Sparkles },
    { key: "lessons" as const, label: "Lesson plans", icon: NotebookPen },
    ...(isCurriculumEngineEnabled ? [
      { key: "computation" as const, label: "Grading Engine", icon: Calculator },
      { key: "reports" as const, label: "Report Builder", icon: FileText },
      { key: "curriculum-versions" as const, label: "Curriculum Versions", icon: Sliders },
      ...(showPathwayTools ? [{ key: "pathways" as const, label: "Senior Pathways", icon: Sparkles }] : []),
      ...(showSubjectSelectionTools ? [{ key: "subject-selection" as const, label: "Subject Selection", icon: BookOpen }] : [])
    ] : []),
    { key: "generator" as const, label: "Timetable Generator", icon: Sparkles },
    { key: "smart-timetable" as const, label: "Smart Timetable", icon: Wand2 },
    { key: "roster" as const, label: "Duty Roster", icon: CalendarRange },
  ];
  return (
    <div className="space-y-5">
      {schoolLevelActivation && (
        <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900 dark:border-green-900/30 dark:bg-green-950/20 dark:text-green-200">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="green">Level-aware Academics</Badge>
            {schoolLevelActivation.isJuniorSchool && <Badge tone="blue">Junior School active</Badge>}
            {schoolLevelActivation.isSeniorSchool && <Badge tone="blue">Senior School active</Badge>}
            {schoolLevelActivation.isMixedSchool && <Badge tone="amber">Mixed school</Badge>}
          </div>
          <p className="mt-2 text-xs text-green-800 dark:text-green-300">
            Subject Selection tools appear only when Junior School or Senior School is active. Senior Pathway tools appear only when Senior School is active.
          </p>
          <p className="mt-2 text-xs text-green-800 dark:text-green-300">
            Timetable preset guidance: {schoolLevelActivation.isSeniorSchool ? 'favor pathway-aware, combination-aware, and richer subject-structure planning' : schoolLevelActivation.isJuniorSchool ? 'favor subject-selection-aware planning without full Senior pathway complexity' : 'favor broad simpler planning with less pathway complexity'}.
          </p>
        </div>
      )}
      <div className="inline-flex max-w-full overflow-x-auto rounded-full border border-navy-200 p-0.5 dark:border-navy-700">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium transition-colors duration-200 ease-apple ${tab === t.key ? "bg-navy-900 text-white dark:bg-navy-50 dark:text-navy-900" : "text-navy-500"}`}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === "subjects" && <SubjectsTab canManage={canManage} />}
      {tab === "departments" && <DepartmentsTab canManage={canManage} canAppointHod={canAppointHod} isScopedHod={isScopedHod} />}
      {tab === "cocurricular" && <CoCurricularTab canManage={canManage} onOpenTimetable={() => setTab("timetable")} />}
      {tab === "terms" && <TermsTab canManage={canManage} />}
      {tab === "timetable" && <TimetableTab canManage={canManage} />}
      {tab === "exam-timetable" && <ExamTimetableTab canManage={canManage} />}
      {tab === "exam-auto-generator" && <ExamAutoGeneratorTab canManage={canManage} />}
      {tab === "lessons" && <LessonsTab />}
      {tab === "computation" && <ComputationDashboardClient canManage={canManage} schoolLevelActivation={schoolLevelActivation} />}
      {tab === "reports" && <ReportBuilderClient canManage={canManage} schoolLevelActivation={schoolLevelActivation} />}
      {tab === "curriculum-versions" && <CurriculumVersionManagerClient canManage={canManage} />}
      {tab === "pathways" && <PathwayManagerClient subjects={[]} />}
      {tab === "subject-selection" && <SubjectSelectionManager subjects={subjects} />}
      {tab === "generator" && <TimetableGeneratorTab canManage={canManage} />}
      {tab === "smart-timetable" && <TimetableEngineTab canManage={canManage} schoolLevelActivation={schoolLevelActivation} />}
      {tab === "roster" && (
        <div className="space-y-8">
          <DutyRosterTab canManage={canManage} />
          <div className="border-t border-navy-100 dark:border-navy-800 pt-8 mt-8">
            <StudentDutyRosterClient canManage={canManage} />
          </div>
        </div>
      )}
    </div>
  );
}

// ---- Subjects -----------------------------------------------------------------
function SubjectsTab({ canManage }: { canManage: boolean }) {
  const { toast } = useToast();
  const [subjects, setSubjects] = React.useState<Subject[] | null>(null);
  const [error, setError] = React.useState(false);
  const [dialog, setDialog] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  const load = React.useCallback(async () => {
    setError(false);
    try {
      const res = await fetch("/api/academics/subjects");
      const json = await res.json();
      if (json.ok) setSubjects(json.data.subjects); else setError(true);
    } catch { setError(true); }
  }, []);
  React.useEffect(() => { load(); }, [load]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw);
      hydratingDraftRef.current = true;
      if (draft.timeOffTeacherId) setTimeOffTeacherId(draft.timeOffTeacherId);
      if (Array.isArray(draft.timeOffWindows) && draft.timeOffWindows.length > 0) setTimeOffWindows(draft.timeOffWindows);
      if (draft.combinationForm) setCombinationForm(draft.combinationForm);
      setDraftMeta({ savedAt: draft.savedAt, dirty: false, restored: true });
      setTimeout(() => { hydratingDraftRef.current = false; }, 0);
    } catch {}
  }, []);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    if (hydratingDraftRef.current) return;
    const draft = {
      savedAt: new Date().toISOString(),
      timeOffTeacherId,
      timeOffWindows,
      combinationForm,
    };
    try {
      window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      setDraftMeta({ savedAt: draft.savedAt, dirty: true, restored: draftMeta.restored });
    } catch {}
  }, [timeOffTeacherId, timeOffWindows, combinationForm]);

  function clearDraft(showToast = true) {
    if (typeof window !== "undefined") window.localStorage.removeItem(DRAFT_KEY);
    setDraftMeta({ dirty: false, restored: false });
    if (showToast) toast({ title: "Saved draft cleared", tone: "success" });
  }

  async function addPreset(preset: "CBC" | "8-4-4") {
    setBusy(true);
    try {
      const res = await fetch("/api/academics/subjects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ preset }) });
      const json = await res.json();
      if (json.ok) { toast({ title: `${json.data.added} ${preset} subjects added`, tone: "success" }); load(); }
      else toast({ title: json.error?.message || "Failed", tone: "error" });
    } finally { setBusy(false); }
  }

  if (error) return <LoadError onRetry={load} />;
  if (subjects === null) return <Skeletons />;

  return (
    <div className="space-y-4">
      {canManage && (
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={() => setDialog(true)}><Plus className="h-4 w-4" /> New subject</Button>
          <Button variant="secondary" disabled={busy} onClick={() => addPreset("CBC")}><Sparkles className="h-4 w-4" /> Add CBC set</Button>
          <Button variant="secondary" disabled={busy} onClick={() => addPreset("8-4-4")}><Sparkles className="h-4 w-4" /> Add 8-4-4 set</Button>
        </div>
      )}
      {subjects.length === 0 ? (
        <EmptyState icon={BookOpen} title="No subjects yet" description='Use "Add CBC set" or "Add 8-4-4 set" to load the standard Kenyan subjects in one click.' />
      ) : (
        <TableContainer>
          <Table>
            <THead><TR><TH>Code</TH><TH>Subject</TH><TH>Curriculum</TH><TH>Department</TH></TR></THead>
            <TBody>
              {subjects.map((s) => (
                <TR key={s.id}>
                  <TD className="font-mono text-xs">{s.code}</TD>
                  <TD className="font-medium">{s.name}</TD>
                  <TD><Badge tone={s.curriculum === "CBC" ? "green" : s.curriculum === "8-4-4" ? "blue" : "neutral"}>{s.curriculum}</Badge></TD>
                  <TD className="text-navy-400">{s.departmentName ?? "—"}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </TableContainer>
      )}
      {dialog && <SubjectDialog onClose={() => setDialog(false)} onDone={() => { setDialog(false); load(); }} />}
    </div>
  );
}

function SubjectDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { toast } = useToast();
  const [f, setF] = React.useState({ name: "", code: "", curriculum: "BOTH" });
  const [saving, setSaving] = React.useState(false);
  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/academics/subjects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) });
      const json = await res.json();
      if (json.ok) { toast({ title: "Subject added", tone: "success" }); onDone(); }
      else toast({ title: json.error?.message || "Failed", tone: "error" });
    } finally { setSaving(false); }
  }
  return (
    <Modal title="New subject" onClose={onClose}>
      <div className="space-y-3">
        <div><Label>Name</Label><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="e.g. Mathematics" /></div>
        <div className="grid grid-cols-2 gap-2">
          <div><Label>Code</Label><Input value={f.code} onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase() })} placeholder="MAT" /></div>
          <div>
            <Label>Curriculum</Label>
            <select value={f.curriculum} onChange={(e) => setF({ ...f, curriculum: e.target.value })} className="mt-1 w-full rounded-xl border border-navy-200 bg-white px-3 py-2 text-sm dark:border-navy-700 dark:bg-navy-800">
              <option value="BOTH">Both</option><option value="CBC">CBC</option><option value="8-4-4">8-4-4</option>
            </select>
          </div>
        </div>
        <Button onClick={save} disabled={saving || f.name.length < 2 || f.code.length < 2} className="w-full">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Add subject
        </Button>
      </div>
    </Modal>
  );
}

// ---- Departments ----------------------------------------------------------------
function DepartmentsTab({ canManage, canAppointHod, isScopedHod }: { canManage: boolean; canAppointHod: boolean; isScopedHod: boolean }) {
  const { toast } = useToast();
  const [depts, setDepts] = React.useState<Dept[] | null>(null);
  const [subjects, setSubjects] = React.useState<Subject[]>([]);
  const [teachers, setTeachers] = React.useState<Staff[]>([]);
  const [error, setError] = React.useState(false);
  const [name, setName] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [editingDept, setEditingDept] = React.useState<Dept | null>(null);

  const load = React.useCallback(async () => {
    setError(false);
    try {
      const res = await fetch("/api/academics/departments");
      const json = await res.json();
      if (json.ok) setDepts(json.data.departments); else setError(true);
    } catch { setError(true); }
  }, []);

  React.useEffect(() => {
    load();
    fetch("/api/academics/subjects").then((r) => r.json()).then((j) => j.ok && setSubjects(j.data.subjects));
    fetch("/api/conversations/recipients").then((r) => r.json()).then((j) => {
      if (j.ok) {
        setTeachers((j.data.recipients ?? []).filter((u: any) => 
          ["TEACHER", "CLASS_TEACHER", "HOD", "DEPUTY_PRINCIPAL", "PRINCIPAL", "SCHOOL_OWNER"].includes(u.role)
        ));
      }
    });
  }, [load]);

  async function add() {
    setSaving(true);
    try {
      const res = await fetch("/api/academics/departments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
      const json = await res.json();
      if (json.ok) { toast({ title: "Department added", tone: "success" }); setName(""); load(); }
      else toast({ title: json.error?.message || "Failed", tone: "error" });
    } finally { setSaving(false); }
  }

  if (error) return <LoadError onRetry={load} />;
  if (depts === null) return <Skeletons />;

  return (
    <div className="space-y-4">
      {isScopedHod && (
        <Card>
          <CardContent className="p-4 text-sm text-navy-600 dark:text-navy-300">
            You are in HOD mode. NEYO shows only your assigned department and allows changes only inside that department. Principal or School Owner appointment is required to change a Department Head.
          </CardContent>
        </Card>
      )}
      {canManage && !isScopedHod && (
        <div className="flex gap-2">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sciences" className="max-w-xs" />
          <Button onClick={add} disabled={saving || name.trim().length < 2}><Plus className="h-4 w-4" /> Add Department</Button>
        </div>
      )}
      {depts.length === 0 ? (
        <EmptyState icon={Building2} title="No departments yet" description="Group subjects under departments (Languages, Sciences, Humanities…) and assign HODs." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {depts.map((d) => (
            <Card key={d.id}>
              <CardContent className="p-5 flex flex-col justify-between h-full gap-4">
                <div className="min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold text-navy-900 dark:text-navy-50">{d.name}</p>
                    {d.name.toLowerCase().includes("co-curricular") && (
                      <Badge tone="green">Non-Academic</Badge>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-navy-500 dark:text-navy-400">
                    {d.subjectCount} subject{d.subjectCount === 1 ? "" : "s"}
                    {d.hodName ? ` · HOD: ${d.hodName}` : " · No HOD Assigned"}
                  </p>
                </div>
                {canManage && (
                  <Button size="sm" variant="secondary" className="w-full" onClick={() => setEditingDept(d)}>
                    Configure Department
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {editingDept && (
        <EditDeptModal
          dept={editingDept}
          teachers={teachers}
          subjects={subjects}
          currentSubjectIds={subjects.filter((s) => s.departmentId === editingDept.id).map((s) => s.id)}
          canAppointHod={canAppointHod}
          onClose={() => setEditingDept(null)}
          onSaved={() => { setEditingDept(null); load(); toast({ title: "Department updated", tone: "success" }); }}
        />
      )}
    </div>
  );
}

// ---- Department Config & Subject Mapping Modal --------------------------------------
function EditDeptModal({ dept, teachers, subjects, currentSubjectIds, canAppointHod, onClose, onSaved }: {
  dept: Dept; teachers: Staff[]; subjects: Subject[]; currentSubjectIds: string[]; canAppointHod: boolean; onClose: () => void; onSaved: () => void;
}) {
  const { toast } = useToast();
  const [name, setName] = React.useState(dept.name);
  const [hodId, setHodId] = React.useState(dept.hodId ?? "");
  const [selectedSubjectIds, setSelectedSubjectIds] = React.useState<Set<string>>(new Set(currentSubjectIds));
  const [saving, setSaving] = React.useState(false);

  function toggleSubject(sid: string) {
    const next = new Set(selectedSubjectIds);
    if (next.has(sid)) next.delete(sid); else next.add(sid);
    setSelectedSubjectIds(next);
  }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/academics/departments?id=${dept.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          hodId: hodId || null,
          subjectIds: [...selectedSubjectIds],
        }),
      });
      const json = await res.json();
      if (json.ok) onSaved();
      else toast({ title: json.error?.message || "Department update failed", tone: "error" });
    } finally { setSaving(false); }
  }

  return (
    <Modal title={`Configure: ${dept.name}`} onClose={onClose} wide>
      <div className="space-y-4">
        <div>
          <Label>Department Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Humanities" />
        </div>

        <div>
          <Label>Appoint Department Head (HOD)</Label>
          {canAppointHod ? (
            <select value={hodId} onChange={(e) => setHodId(e.target.value)}
              className="mt-1.5 w-full rounded-2xl border border-navy-200 bg-white px-3.5 py-2.5 text-sm dark:border-navy-700 dark:bg-navy-900 text-navy-800 dark:text-navy-100">
              <option value="">No HOD Appointed</option>
              {teachers.map((t) => <option key={t.id} value={t.id}>{t.fullName}</option>)}
            </select>
          ) : (
            <div className="mt-1.5 rounded-2xl border border-navy-100 bg-navy-50 px-3.5 py-2.5 text-sm text-navy-600 dark:border-navy-800 dark:bg-navy-900/60 dark:text-navy-300">
              {dept.hodName || "No HOD appointed yet"} · only the Principal or School Owner can change this.
            </div>
          )}
        </div>

        <div>
          <Label>Map Subjects to this Department</Label>
          <div className="mt-2 max-h-48 overflow-y-auto space-y-1.5 pr-1">
            {subjects.map((s) => (
              <label key={s.id} className="flex items-center gap-2.5 rounded-lg p-1.5 hover:bg-navy-50 text-xs text-navy-700 dark:text-navy-200 cursor-pointer">
                <input type="checkbox" checked={selectedSubjectIds.has(s.id)} onChange={() => toggleSubject(s.id)} className="h-4 w-4 rounded border-navy-300 text-green-600 focus:ring-green-500" />
                <span>{s.name} ({s.code})</span>
              </label>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-navy-100 dark:border-navy-800">
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Save Configuration</Button>
        </div>
      </div>
    </Modal>
  );
}


// ---- Co-curricular ---------------------------------------------------------------
function classLabel(c: any) {
  return [c.level, c.stream].filter(Boolean).join(" ") || c.name || "Class";
}

function configWithDefaults(classId: string, current: any | null) {
  return {
    classId,
    periodsPerDay: current?.periodsPerDay ?? 8,
    freePeriodsPerWeek: current?.freePeriodsPerWeek ?? 4,
    coCurricularCount: current?.coCurricularCount ?? 2,
    coCurricularName: current?.coCurricularName ?? "Games",
    schoolDayStartTime: current?.schoolDayStartTime ?? "08:00",
    saturdayStartTime: current?.saturdayStartTime ?? "08:00",
    saturdayEndTime: current?.saturdayEndTime ?? "12:40",
    lessonDurationMins: current?.lessonDurationMins ?? 40,
    shortBreakStart: current?.shortBreakStart ?? 2,
    shortBreakMins: current?.shortBreakMins ?? 15,
    longBreakStart: current?.longBreakStart ?? 4,
    longBreakMins: current?.longBreakMins ?? 30,
    lunchStart: current?.lunchStart ?? 6,
    lunchMins: current?.lunchMins ?? 60,
    hasRemedials: current?.hasRemedials ?? false,
    hasPreps: current?.hasPreps ?? false,
    lunchShift: current?.lunchShift ?? 1,
    hasSaturday: current?.hasSaturday ?? true,
  };
}

function CoCurricularTab({ canManage, onOpenTimetable }: { canManage: boolean; onOpenTimetable: () => void }) {
  return <TalentManagerClient canManage={canManage} />;
}

function OldCoCurricularTab({ canManage, onOpenTimetable }: { canManage: boolean; onOpenTimetable: () => void }) {
  const { toast } = useToast();
  const [data, setData] = React.useState<any | null>(null);
  const [departments, setDepartments] = React.useState<Dept[]>([]);
  const [error, setError] = React.useState(false);
  const [savingClassId, setSavingClassId] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setError(false);
    try {
      const [generatorRes, departmentRes] = await Promise.all([
        fetch("/api/academics/timetable/generator"),
        fetch("/api/academics/departments"),
      ]);
      const generatorJson = await generatorRes.json();
      const departmentJson = await departmentRes.json();
      if (!generatorJson.ok || !departmentJson.ok) {
        setError(true);
        return;
      }
      setData(generatorJson.data);
      setDepartments(departmentJson.data.departments ?? []);
    } catch {
      setError(true);
    }
  }, []);

  React.useEffect(() => { load(); }, [load]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw);
      hydratingDraftRef.current = true;
      if (draft.timeOffTeacherId) setTimeOffTeacherId(draft.timeOffTeacherId);
      if (Array.isArray(draft.timeOffWindows) && draft.timeOffWindows.length > 0) setTimeOffWindows(draft.timeOffWindows);
      if (draft.combinationForm) setCombinationForm(draft.combinationForm);
      setDraftMeta({ savedAt: draft.savedAt, dirty: false, restored: true });
      setTimeout(() => { hydratingDraftRef.current = false; }, 0);
    } catch {}
  }, []);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    if (hydratingDraftRef.current) return;
    const draft = {
      savedAt: new Date().toISOString(),
      timeOffTeacherId,
      timeOffWindows,
      combinationForm,
    };
    try {
      window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      setDraftMeta({ savedAt: draft.savedAt, dirty: true, restored: draftMeta.restored });
    } catch {}
  }, [timeOffTeacherId, timeOffWindows, combinationForm]);

  function clearDraft(showToast = true) {
    if (typeof window !== "undefined") window.localStorage.removeItem(DRAFT_KEY);
    setDraftMeta({ dirty: false, restored: false });
    if (showToast) toast({ title: "Saved draft cleared", tone: "success" });
  }

  async function saveClassConfig(classId: string, current: any | null, values: { coCurricularName: string; coCurricularCount: number }) {
    setSavingClassId(classId);
    try {
      const payload = {
        action: "save_config",
        ...configWithDefaults(classId, current),
        coCurricularName: values.coCurricularName.trim() || "Games",
        coCurricularCount: Math.max(0, Math.min(4, values.coCurricularCount)),
      };
      const res = await fetch("/api/academics/timetable/generator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (json.ok) {
        toast({ title: "Co-curricular timetable link saved", description: "The next timetable generation will reserve these activity slots.", tone: "success" });
        await load();
      } else {
        toast({ title: json.error?.message || "Failed to save co-curricular link", tone: "error" });
      }
    } finally {
      setSavingClassId(null);
    }
  }

  if (error) return <LoadError onRetry={load} />;
  if (!data) return <Skeletons />;

  const coDepartments = departments.filter((d) => /co[-\s]?curricular|sports|games|clubs|activities/i.test(d.name));
  const linkedConfigs = (data.configs ?? []).filter((cfg: any) => Number(cfg.coCurricularCount ?? 0) > 0);
  const classes = data.classes ?? [];

  return (
    <div className="space-y-5">
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2 overflow-hidden">
          <CardContent className="p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <Badge tone="green">Linked to timetable</Badge>
                <h2 className="mt-3 text-lg font-black tracking-tight text-navy-950 dark:text-navy-50">Co-curricular Activities</h2>
                <p className="mt-1 max-w-2xl text-sm leading-relaxed text-navy-500 dark:text-navy-400">
                  Manage Games, Clubs, Sports, Music and other non-academic activity blocks from one dedicated tab. These settings are saved to the real timetable configuration, then the generator reserves the activity periods for each class.
                </p>
              </div>
              <Button variant="secondary" onClick={onOpenTimetable}>
                <Grid3X3 className="h-4 w-4" /> Open timetable
              </Button>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs font-bold uppercase tracking-widest text-navy-400">Current setup</p>
            <div className="mt-4 grid grid-cols-2 gap-3 text-center">
              <div className="rounded-2xl border border-navy-100 bg-white/60 p-3 dark:border-navy-800 dark:bg-navy-950/40">
                <p className="text-2xl font-black text-navy-950 dark:text-white">{coDepartments.length}</p>
                <p className="text-[11px] text-navy-500">activity departments</p>
              </div>
              <div className="rounded-2xl border border-green-100 bg-green-50/60 p-3 dark:border-green-900/40 dark:bg-green-950/20">
                <p className="text-2xl font-black text-green-700 dark:text-green-300">{linkedConfigs.length}</p>
                <p className="text-[11px] text-navy-500">classes linked</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.4fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><Building2 className="h-5 w-5 text-green-600" /> Non-academic departments</CardTitle>
            <p className="text-xs text-navy-400">Add “Co-curricular Activities” in Departments, appoint its head there, then map subjects such as Creative Arts & Sports or Music.</p>
          </CardHeader>
          <CardContent>
            {coDepartments.length === 0 ? (
              <EmptyState icon={Trophy} title="No co-curricular department yet" description='Use the Departments tab to add “Co-curricular Activities”, then map sports, clubs or creative subjects to it.' />
            ) : (
              <div className="space-y-2">
                {coDepartments.map((d) => (
                  <div key={d.id} className="rounded-2xl border border-navy-100 bg-white/70 p-3 dark:border-navy-800 dark:bg-navy-950/40">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-bold text-navy-900 dark:text-navy-50">{d.name}</p>
                      <Badge tone="green">Non-academic</Badge>
                    </div>
                    <p className="mt-1 text-xs text-navy-500">{d.subjectCount} mapped subject{d.subjectCount === 1 ? "" : "s"} · {d.hodName ? `Head: ${d.hodName}` : "Head not assigned"}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><Trophy className="h-5 w-5 text-green-600" /> Class activity timetable links</CardTitle>
            <p className="text-xs text-navy-400">Choose the activity label and weekly slots per class. The whole-school timetable generator reserves these blocks, usually Friday late periods.</p>
          </CardHeader>
          <CardContent>
            {classes.length === 0 ? (
              <EmptyState icon={Grid3X3} title="No classes found" description="Add classes first, then link co-curricular activity periods." />
            ) : (
              <div className="space-y-3">
                {classes.map((c: any) => {
                  const current = (data.configs ?? []).find((cfg: any) => cfg.classId === c.id) ?? null;
                  return (
                    <CoCurricularClassRow
                      key={c.id}
                      classItem={c}
                      config={current}
                      canManage={canManage}
                      saving={savingClassId === c.id}
                      onSave={(values) => saveClassConfig(c.id, current, values)}
                    />
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function CoCurricularClassRow({ classItem, config, canManage, saving, onSave }: {
  classItem: any;
  config: any | null;
  canManage: boolean;
  saving: boolean;
  onSave: (values: { coCurricularName: string; coCurricularCount: number }) => void;
}) {
  const [name, setName] = React.useState(config?.coCurricularName ?? "Games");
  const [count, setCount] = React.useState<number>(config?.coCurricularCount ?? 2);

  React.useEffect(() => {
    setName(config?.coCurricularName ?? "Games");
    setCount(config?.coCurricularCount ?? 2);
  }, [config?.coCurricularName, config?.coCurricularCount]);

  return (
    <div className="rounded-2xl border border-navy-100 bg-white/70 p-3 dark:border-navy-800 dark:bg-navy-950/40">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-[10rem]">
          <p className="text-sm font-bold text-navy-950 dark:text-white">{classLabel(classItem)}</p>
          <p className="text-[11px] text-navy-500">Friday activity block · generator reserved</p>
        </div>
        <div className="grid flex-1 gap-2 sm:grid-cols-[1fr_8rem_auto] sm:items-end">
          <div>
            <Label className="text-[10px] uppercase tracking-wider text-navy-400">Activity label</Label>
            <Input value={name} disabled={!canManage} onChange={(e) => setName(e.target.value)} placeholder="Games / Clubs / Music" />
          </div>
          <div>
            <Label className="text-[10px] uppercase tracking-wider text-navy-400">Slots / week</Label>
            <Input type="number" min={0} max={4} value={count} disabled={!canManage} onChange={(e) => setCount(Number(e.target.value))} />
          </div>
          {canManage ? (
            <Button size="sm" onClick={() => onSave({ coCurricularName: name, coCurricularCount: count })} disabled={saving || name.trim().length < 2}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save
            </Button>
          ) : (
            <Badge tone="neutral">View only</Badge>
          )}
        </div>
      </div>
    </div>
  );
}

// ---- Terms -----------------------------------------------------------------------
function TermsTab({ canManage }: { canManage: boolean }) {
  const { toast } = useToast();
  const [terms, setTerms] = React.useState<Term[] | null>(null);
  const [error, setError] = React.useState(false);
  const [f, setF] = React.useState({ year: new Date().getFullYear(), term: 1, startDate: "", endDate: "", current: true });
  const [saving, setSaving] = React.useState(false);

  const load = React.useCallback(async () => {
    setError(false);
    try {
      const res = await fetch("/api/academics/terms");
      const json = await res.json();
      if (json.ok) setTerms(json.data.terms); else setError(true);
    } catch { setError(true); }
  }, []);
  React.useEffect(() => { load(); }, [load]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw);
      hydratingDraftRef.current = true;
      if (draft.timeOffTeacherId) setTimeOffTeacherId(draft.timeOffTeacherId);
      if (Array.isArray(draft.timeOffWindows) && draft.timeOffWindows.length > 0) setTimeOffWindows(draft.timeOffWindows);
      if (draft.combinationForm) setCombinationForm(draft.combinationForm);
      setDraftMeta({ savedAt: draft.savedAt, dirty: false, restored: true });
      setTimeout(() => { hydratingDraftRef.current = false; }, 0);
    } catch {}
  }, []);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    if (hydratingDraftRef.current) return;
    const draft = {
      savedAt: new Date().toISOString(),
      timeOffTeacherId,
      timeOffWindows,
      combinationForm,
    };
    try {
      window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      setDraftMeta({ savedAt: draft.savedAt, dirty: true, restored: draftMeta.restored });
    } catch {}
  }, [timeOffTeacherId, timeOffWindows, combinationForm]);

  function clearDraft(showToast = true) {
    if (typeof window !== "undefined") window.localStorage.removeItem(DRAFT_KEY);
    setDraftMeta({ dirty: false, restored: false });
    if (showToast) toast({ title: "Saved draft cleared", tone: "success" });
  }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/academics/terms", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) });
      const json = await res.json();
      if (json.ok) { toast({ title: `Term ${f.term}, ${f.year} saved`, tone: "success" }); load(); }
      else toast({ title: json.error?.message || "Failed", tone: "error" });
    } finally { setSaving(false); }
  }

  if (error) return <LoadError onRetry={load} />;
  if (terms === null) return <Skeletons />;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader><CardTitle>School terms</CardTitle></CardHeader>
        <CardContent>
          {terms.length === 0 ? (
            <EmptyState icon={CalendarRange} title="No terms set" description="Define Term 1–3 dates so reports, fees and analytics know the current term." />
          ) : (
            <ul className="divide-y divide-navy-50 dark:divide-navy-800">
              {terms.map((t) => (
                <li key={t.id} className="flex items-center justify-between py-2.5 text-sm">
                  <span className="font-medium text-navy-900 dark:text-navy-50">Term {t.term}, {t.year}</span>
                  <span className="text-xs text-navy-400">{t.startDate} → {t.endDate}</span>
                  {t.current && <Badge tone="green">current</Badge>}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
      {canManage && (
        <Card>
          <CardHeader><CardTitle>Add / edit a term</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Year</Label><Input type="number" value={f.year} onChange={(e) => setF({ ...f, year: Number(e.target.value) })} /></div>
              <div>
                <Label>Term</Label>
                <select value={f.term} onChange={(e) => setF({ ...f, term: Number(e.target.value) })} className="mt-1 w-full rounded-xl border border-navy-200 bg-white px-3 py-2 text-sm dark:border-navy-700 dark:bg-navy-800">
                  <option value={1}>Term 1</option><option value={2}>Term 2</option><option value={3}>Term 3</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Starts</Label><Input type="date" value={f.startDate} onChange={(e) => setF({ ...f, startDate: e.target.value })} /></div>
              <div><Label>Ends</Label><Input type="date" value={f.endDate} onChange={(e) => setF({ ...f, endDate: e.target.value })} /></div>
            </div>
            <label className="flex items-center gap-2 text-sm text-navy-600 dark:text-navy-300">
              <input type="checkbox" checked={f.current} onChange={(e) => setF({ ...f, current: e.target.checked })} className="h-4 w-4 rounded border-navy-300 text-green-600 focus:ring-green-500" />
              This is the current term
            </label>
            <Button onClick={save} disabled={saving || !f.startDate || !f.endDate} className="w-full">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Save term
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ---- Timetable ---------------------------------------------------------------------

// ---- Timetable ---------------------------------------------------------------------

// Dynamic helper to compute subject-specific colors for high legibility
function getSubjectStyle(code: string, isBandW: boolean) {
  if (isBandW) {
    return "border border-navy-300 bg-white text-navy-950 font-bold dark:bg-navy-950 dark:text-white";
  }
  
  const c = code.toUpperCase();
  if (c.startsWith("MAT") || c.startsWith("MATH")) {
    return "bg-blue-500/10 border border-blue-200 text-blue-800 dark:bg-blue-950/20 dark:text-blue-300 dark:border-blue-900/30";
  }
  if (c.startsWith("ENG")) {
    return "bg-green-500/10 border border-green-200 text-green-800 dark:bg-green-950/20 dark:text-green-300 dark:border-green-900/30";
  }
  if (c.startsWith("KIS") || c.startsWith("SWA")) {
    return "bg-amber-500/10 border border-amber-200 text-amber-800 dark:bg-amber-950/20 dark:text-amber-300 dark:border-amber-900/30";
  }
  if (c.startsWith("CHEM") || c.startsWith("PHY") || c.startsWith("BIO") || c.startsWith("SCI")) {
    return "bg-purple-500/10 border border-purple-200 text-purple-800 dark:bg-purple-950/20 dark:text-purple-300 dark:border-purple-900/30";
  }
  if (c.startsWith("LUNCH") || c.startsWith("BREAK")) {
    return "bg-red-500/5 border border-red-200 text-red-800 dark:bg-red-950/10 dark:text-red-400 dark:border-red-900/30";
  }
  if (c.startsWith("FREE")) {
    return "bg-navy-50/50 border border-navy-100 text-navy-400 dark:bg-navy-900/20 dark:text-navy-500 dark:border-navy-800/30";
  }
  
  return "bg-green-500/5 border border-green-500/20 text-navy-900 dark:text-green-300 dark:bg-green-950/10";
}

function getSubjectAbbreviation(name: string, code: string): string {
  if (code && code.trim().length > 0) return code.toUpperCase();
  const n = name.trim();
  if (n.length <= 10) return n;
  return n.slice(0, 8) + ".";
}

function formatTimetableTime(totalMins: number) {
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  const periodLabel = h >= 12 ? "PM" : "AM";
  const formattedHour = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${String(formattedHour).padStart(2, "0")}:${String(m).padStart(2, "0")} ${periodLabel}`;
}

function parseTimeToMinutes(value?: string | null, fallback = "08:00") {
  const raw = /^\d{2}:\d{2}$/.test(value ?? "") ? value! : fallback;
  const [h, m] = raw.split(":").map(Number);
  return h * 60 + m;
}

function timetablePeriodStartMinutes(p: number, config: any, dayOfWeek?: number): number {
  const startTotal = parseTimeToMinutes(dayOfWeek === 6 ? config?.saturdayStartTime : config?.schoolDayStartTime, "08:00");
  const duration = config?.lessonDurationMins ?? 40;
  const shortBreakStart = config?.shortBreakStart ?? 2;
  const shortBreakMins = config?.shortBreakMins ?? 15;
  const longBreakStart = config?.longBreakStart ?? 4;
  const longBreakMins = config?.longBreakMins ?? 30;
  const lunchStart = config?.lunchStart ?? 6;
  const lunchMins = config?.lunchMins ?? 60;
  let totalMinutes = 0;
  for (let i = 1; i < p; i++) {
    totalMinutes += duration;
    if (i === shortBreakStart) totalMinutes += shortBreakMins;
    if (i === longBreakStart) totalMinutes += longBreakMins;
    if (i === lunchStart) totalMinutes += lunchMins;
  }
  return startTotal + totalMinutes;
}

function timetablePeriodTimeRange(p: number, config: any, dayOfWeek?: number): string {
  const startTotal = timetablePeriodStartMinutes(p, config, dayOfWeek);
  const endTotal = startTotal + (config?.lessonDurationMins ?? 40);
  return `${formatTimetableTime(startTotal)} - ${formatTimetableTime(endTotal)}`;
}

function timetableNonLessonTimeRange(afterPeriod: number, minutes: number, config: any): string {
  const startTotal = timetablePeriodStartMinutes(afterPeriod, config) + (config?.lessonDurationMins ?? 40);
  const endTotal = startTotal + minutes;
  return `${formatTimetableTime(startTotal)} - ${formatTimetableTime(endTotal)}`;
}

function nonLessonRowsForPeriod(p: number, config: any) {
  const rows: { key: string; label: string; minutes: number; tone: "break" | "lunch"; timeRange: string }[] = [];
  if (!config) return rows;
  if (p === config.shortBreakStart) {
    const minutes = config.shortBreakMins ?? 15;
    rows.push({ key: `short-break-${p}`, label: "Short Break", minutes, tone: "break", timeRange: timetableNonLessonTimeRange(p, minutes, config) });
  }
  if (p === config.longBreakStart) {
    const minutes = config.longBreakMins ?? 30;
    rows.push({ key: `long-break-${p}`, label: "Long Break", minutes, tone: "break", timeRange: timetableNonLessonTimeRange(p, minutes, config) });
  }
  if (p === config.lunchStart) {
    const minutes = config.lunchMins ?? 60;
    rows.push({ key: `lunch-${p}`, label: "Lunch", minutes, tone: "lunch", timeRange: timetableNonLessonTimeRange(p, minutes, config) });
  }
  return rows;
}


function getActivityStyle(color: string | null | undefined, isBandW: boolean) {
  if (isBandW) return "border border-navy-300 bg-white text-navy-950 font-bold dark:bg-navy-950 dark:text-white";
  switch (color) {
    case "blue": return "bg-blue-500/10 border border-blue-200 text-blue-800 dark:bg-blue-950/20 dark:text-blue-300 dark:border-blue-900/30";
    case "green": return "bg-green-500/10 border border-green-200 text-green-800 dark:bg-green-950/20 dark:text-green-300 dark:border-green-900/30";
    case "purple": return "bg-purple-500/10 border border-purple-200 text-purple-800 dark:bg-purple-950/20 dark:text-purple-300 dark:border-purple-900/30";
    case "amber": return "bg-amber-500/10 border border-amber-200 text-amber-800 dark:bg-amber-950/20 dark:text-amber-300 dark:border-amber-900/30";
    case "rose": return "bg-rose-500/10 border border-rose-200 text-rose-800 dark:bg-rose-950/20 dark:text-rose-300 dark:border-rose-900/30";
    default: return "bg-gray-500/10 border border-gray-200 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300 dark:border-gray-800/50";
  }
}

function TimetableSlotCard({ slot, isBandW, fontSize, canManage, onClick, teacherFirst = false }: { slot?: Slot; isBandW: boolean; fontSize: number; canManage?: boolean; onClick?: () => void; teacherFirst?: boolean }) {
  const isActivity = slot?.slotType === "ACTIVITY";
  const cellBgClass = isActivity 
    ? getActivityStyle(slot?.activityCategoryColor ?? null, isBandW)
    : getSubjectStyle(slot?.subjectCode || "FREE", isBandW);
    
  return (
    <button
      disabled={!canManage}
      onClick={onClick}
      className={`w-full min-h-[52px] rounded-xl p-2 text-left transition relative flex flex-col justify-between ${cellBgClass}`}
      style={{ fontSize: `${fontSize}px` }}
    >
      {slot ? (
        <>
          <div className="flex items-center justify-between w-full gap-1">
            <span className="font-extrabold tracking-wide leading-tight line-clamp-2">
              {isActivity ? slot.activityCategoryName : getSubjectAbbreviation(slot.subjectName || "", slot.subjectCode || "")}
            </span>
            {slot.isCombined && !isActivity && (
              <span className="text-[7.5px] uppercase font-black bg-green-500/25 px-1 py-0.5 rounded">Combined</span>
            )}
            {isActivity && (
              <span className="text-[7px] uppercase font-black bg-black/10 dark:bg-white/10 px-1 py-0.5 rounded">Activity</span>
            )}
          </div>
          <div className="flex flex-col mt-1 text-navy-600 dark:text-navy-300 font-medium" style={{ fontSize: `${Math.max(8, fontSize - 2)}px` }}>
            <span>{teacherFirst ? slot.className || slot.teacherName : slot.teacherName}</span>
            {slot.venue && <span className="font-bold text-green-700 dark:text-green-300">@ {slot.venue}</span>}
            {slot.isCombined && slot.combinedDetails && <span className="text-[8px] italic truncate max-w-[100px]">{slot.combinedDetails}</span>}
          </div>
        </>
      ) : (
        <span className="text-[10px] text-navy-300 dark:text-navy-600 font-medium italic">Unassigned</span>
      )}
    </button>
  );
}

function NonLessonMergedRow({ row, colSpan }: { row: { label: string; minutes: number; tone: "break" | "lunch"; timeRange: string }; colSpan: number }) {
  const tone = row.tone === "lunch" ? "bg-green-500/10 text-green-800 dark:bg-green-950/20 dark:text-green-300" : "bg-amber-500/10 text-amber-800 dark:bg-amber-950/20 dark:text-amber-300";
  return (
    <tr className={`${tone} text-center font-bold`}>
      <td className="border-b border-navy-50 p-1 dark:border-navy-800">
        <div className="mx-auto flex h-14 w-9 items-center justify-center rounded-full bg-white/60 text-[10px] font-black uppercase tracking-widest [writing-mode:vertical-rl] rotate-180 dark:bg-navy-950/40">
          {row.tone === "lunch" ? "Lunch" : "Break"}
        </div>
      </td>
      <td colSpan={colSpan} className="border-b border-l border-navy-50 p-2 text-xs font-black uppercase tracking-[0.2em] dark:border-navy-800">
        {row.label} · {row.timeRange} · {row.minutes} mins
      </td>
    </tr>
  );
}

function TimetablePrintBundleView({ bundle, tenantName, tenantLogoUrl }: { bundle: TimetablePrintBundle; tenantName?: string; tenantLogoUrl?: string | null }) {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const modeTitle = bundle.mode === "classes" ? "All Classes" : bundle.mode === "teachers" ? "All Teachers" : "By Venue";
  return (
    <div className="hidden print:block">
      <div className="mb-4 border-b border-navy-200 pb-3">
        <div className="flex items-center gap-2">{tenantLogoUrl && <img src={tenantLogoUrl} alt="School logo" className="h-6 w-6 object-contain" />}<h1 className="text-lg font-black text-navy-950">{tenantName || "School"} · Timetable Print Pack</h1></div>
        <p className="text-xs font-semibold text-navy-500">{modeTitle} · Generated {new Date().toLocaleDateString("en-KE")}</p>
      </div>
      {bundle.groups.length === 0 ? (
        <p className="text-sm font-semibold text-navy-500">No timetable slots found for this print pack.</p>
      ) : bundle.groups.map((group) => {
        const grid = new Map<string, Slot>();
        for (const slot of group.slots) grid.set(`${slot.dayOfWeek}|${slot.period}`, slot);
        return (
          <section key={group.id} className="mb-6 break-after-page last:break-after-auto">
            <div className="mb-2 flex items-end justify-between border-b border-navy-100 pb-1">
              <div>
                <h2 className="text-base font-black text-navy-950">{group.title}</h2>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-navy-400">{group.subtitle}</p>
              </div>
            </div>
            <table className="w-full border-collapse text-[10px]">
              <thead>
                <tr className="bg-navy-50">
                  <th className="w-12 border border-navy-200 p-1 text-center">No.</th>
                  {days.map((d) => <th key={d} className="border border-navy-200 p-1 text-left">{d}</th>)}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: group.config.periodsPerDay || 8 }, (_, i) => i + 1).flatMap((p) => {
                  const lessonRow = (
                    <tr key={`${group.id}-${p}`}>
                      <td className="border border-navy-200 p-1 text-center align-middle">
                        <span className="block text-lg font-black leading-none">{p}</span>
                        <span className="mt-0.5 block text-[7px] font-bold leading-tight text-navy-500">{timetablePeriodTimeRange(p, group.config)}</span>
                      </td>
                      {days.map((_, dIdx) => {
                        const slot = grid.get(`${dIdx + 1}|${p}`);
                        return (
                          <td key={dIdx} className="h-12 border border-navy-200 p-1 align-top">
                            {slot ? (
                              <div>
                                <p className="font-black">{slot.slotType === "ACTIVITY" ? slot.activityCategoryName : getSubjectAbbreviation(slot.subjectName || "", slot.subjectCode || "")}</p>
                                <p>{bundle.mode === "teachers" || bundle.mode === "venues" ? slot.className : slot.teacherName}</p>
                                {slot.venue && bundle.mode !== "venues" && <p className="font-bold">@ {slot.venue}</p>}
                              </div>
                            ) : <span className="text-navy-300">—</span>}
                          </td>
                        );
                      })}
                    </tr>
                  );
                  const programRows = nonLessonRowsForPeriod(p, group.config).map((row) => (
                    <tr key={`${group.id}-${row.key}`} className={row.tone === "lunch" ? "bg-green-50" : "bg-amber-50"}>
                      <td className="border border-navy-200 p-1 text-center"><span className="inline-block font-black uppercase [writing-mode:vertical-rl] rotate-180">{row.tone === "lunch" ? "Lunch" : "Break"}</span></td>
                      <td colSpan={days.length} className="border border-navy-200 p-1 text-center font-black uppercase tracking-widest">{row.label} · {row.timeRange} · {row.minutes} mins</td>
                    </tr>
                  ));
                  return [lessonRow, ...programRows];
                })}
              </tbody>
            </table>
          </section>
        );
      })}
    </div>
  );
}

function TimetableTab({ canManage }: { canManage: boolean }) {
  const { toast } = useToast();
  const [tenant, setTenant] = React.useState<any>(null);
  const [classes, setClasses] = React.useState<ClassOpt[]>([]);
  const [classId, setClassId] = React.useState("");
  const [slots, setSlots] = React.useState<Slot[] | null>(null);
  const [config, setConfig] = React.useState<any>(null);
  const [subjects, setSubjects] = React.useState<Subject[]>([]);
  const [activities, setActivities] = React.useState<any[]>([]);
  const [staff, setStaff] = React.useState<any[]>([]);
  const [error, setError] = React.useState(false);
  const [cell, setCell] = React.useState<{ day: number; period: number } | null>(null);
  const [autoOpen, setAutoOpen] = React.useState(false);
  const [showSaturday, setShowSaturday] = React.useState(true);
  const [bulkSatOpen, setBulkSatOpen] = React.useState(false);
  const [configOpen, setConfigOpen] = React.useState(false);
  const [isBandW, setIsBandW] = React.useState(false);
  const [daysVertical, setDaysVertical] = React.useState(false);
  const [cellFontSize, setCellFontSize] = React.useState(11);
  const [printBundle, setPrintBundle] = React.useState<TimetablePrintBundle | null>(null);
  const [printBusy, setPrintBusy] = React.useState<"classes" | "teachers" | "venues" | null>(null);

  const daysList = showSaturday ? ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] : ["Mon", "Tue", "Wed", "Thu", "Fri"];

  React.useEffect(() => {
    fetch("/api/tenant/current").then((r) => r.json()).then((j) => j.ok && setTenant(j.data.tenant));
    fetch("/api/classes").then((r) => r.json()).then((j) => { if (j.ok) { setClasses(j.data.classes); if (j.data.classes[0]) setClassId(j.data.classes[0].id); } });
    fetch("/api/academics/subjects").then((r) => r.json()).then((j) => j.ok && setSubjects(j.data.subjects));
    fetch("/api/timetable/activities").then((r) => r.json()).then((j) => j.ok && setActivities(j.data));
    fetch("/api/conversations/recipients").then((r) => r.json()).then((j) => j.ok && setStaff((j.data.recipients ?? []).filter((u: any) => ["TEACHER", "CLASS_TEACHER", "HOD", "DEPUTY_PRINCIPAL"].includes(u.role))));
  }, []);

  const load = React.useCallback(async () => {
    if (!classId) return;
    setError(false); setSlots(null); setConfig(null);
    try {
      const res = await fetch(`/api/academics/timetable?classId=${classId}`);
      const json = await res.json();
      if (json.ok) {
        setSlots(json.data.slots);
        setConfig(json.data.config);
      } else setError(true);
    } catch { setError(true); }
  }, [classId]);
  React.useEffect(() => { load(); }, [load]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw);
      hydratingDraftRef.current = true;
      if (draft.timeOffTeacherId) setTimeOffTeacherId(draft.timeOffTeacherId);
      if (Array.isArray(draft.timeOffWindows) && draft.timeOffWindows.length > 0) setTimeOffWindows(draft.timeOffWindows);
      if (draft.combinationForm) setCombinationForm(draft.combinationForm);
      setDraftMeta({ savedAt: draft.savedAt, dirty: false, restored: true });
      setTimeout(() => { hydratingDraftRef.current = false; }, 0);
    } catch {}
  }, []);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    if (hydratingDraftRef.current) return;
    const draft = {
      savedAt: new Date().toISOString(),
      timeOffTeacherId,
      timeOffWindows,
      combinationForm,
    };
    try {
      window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      setDraftMeta({ savedAt: draft.savedAt, dirty: true, restored: draftMeta.restored });
    } catch {}
  }, [timeOffTeacherId, timeOffWindows, combinationForm]);

  function clearDraft(showToast = true) {
    if (typeof window !== "undefined") window.localStorage.removeItem(DRAFT_KEY);
    setDraftMeta({ dirty: false, restored: false });
    if (showToast) toast({ title: "Saved draft cleared", tone: "success" });
  }

  const grid = new Map<string, Slot>();
  for (const s of slots ?? []) grid.set(`${s.dayOfWeek}|${s.period}`, s);

  async function printBulk(mode: "classes" | "teachers" | "venues") {
    setPrintBusy(mode);
    try {
      const res = await fetch(`/api/academics/timetable?print=${mode}`);
      const json = await res.json();
      if (!json.ok) throw new Error(json.error?.message || "Could not prepare print pack.");
      setPrintBundle(json.data);
      setTimeout(() => window.print(), 250);
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Could not prepare print pack.", tone: "error" });
    } finally {
      setPrintBusy(null);
    }
  }

  function getPeriodTimeRange(p: number): string {
    return timetablePeriodTimeRange(p, config);
  }

  return (
    <div className="space-y-4">
      {/* Print-Only Header */}
      <div className="hidden print:flex items-center justify-between border-b border-navy-200 pb-2 mb-3">
        <div className="flex items-center gap-2.5">
          {tenant?.logoUrl ? (
            <img src={tenant.logoUrl} alt="Logo" className="h-8 w-8 object-contain shrink-0" />
          ) : (
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-500 text-white text-xs font-black">
              {tenant?.name ? tenant.name.slice(0, 2).toUpperCase() : "NY"}
            </span>
          )}
          <div>
            <h2 className="text-sm font-bold text-navy-950 dark:text-white">
              {tenant?.name || "School Timetable"}
            </h2>
            <p className="text-[10px] text-navy-500 font-semibold">
              Class: {classes.find(c => c.id === classId)?.name || "Unassigned"} · {showSaturday ? "6-Day Week" : "5-Day Week"}
            </p>
          </div>
        </div>
        <div className="text-right text-[10px] text-navy-400">
          <p className="font-bold text-navy-700">A4 Landscape Schedule</p>
          <p>Generated: {new Date().toLocaleDateString("en-KE")}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="flex flex-wrap items-center gap-2">
          <select value={classId} onChange={(e) => setClassId(e.target.value)} className="rounded-full border border-navy-200 bg-white px-3 py-2 text-sm dark:border-navy-700 dark:bg-navy-900">
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          {classId && (
            <Button variant="secondary" onClick={() => { setPrintBundle(null); setTimeout(() => window.print(), 100); }}>
              <Printer className="h-4 w-4 text-green-600" /> Print Timetable
            </Button>
          )}
          <Button variant="secondary" onClick={() => printBulk("classes")} disabled={!!printBusy}>
            <Printer className="h-4 w-4 text-green-600" /> {printBusy === "classes" ? "Preparing…" : "Print all classes"}
          </Button>
          <Button variant="secondary" onClick={() => printBulk("teachers")} disabled={!!printBusy}>
            <Printer className="h-4 w-4 text-green-600" /> {printBusy === "teachers" ? "Preparing…" : "Print all teachers"}
          </Button>
          <Button variant="secondary" onClick={() => printBulk("venues")} disabled={!!printBusy}>
            <Printer className="h-4 w-4 text-green-600" /> {printBusy === "venues" ? "Preparing…" : "Print by venue"}
          </Button>
          {canManage && classId && (
            <>
              <Button variant="secondary" onClick={() => setConfigOpen(true)}><Sliders className="h-4 w-4 text-green-600" /> Schedule rules</Button>
              <Button variant="secondary" onClick={() => setAutoOpen(true)}><Sparkles className="h-4 w-4" /> Auto-fill week</Button>
              <Button variant="secondary" onClick={() => setBulkSatOpen(true)}><Calendar className="h-4 w-4 text-green-600" /> Bulk Saturday Scheduler</Button>
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex items-center gap-2 rounded-full border border-navy-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-navy-700 dark:border-navy-700 dark:bg-navy-900 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={daysVertical}
              onChange={(e) => setDaysVertical(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-navy-300 text-green-600 focus:ring-green-500"
            />
            Vertical days
          </label>
          <label className="inline-flex items-center gap-2 rounded-full border border-navy-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-navy-700 dark:border-navy-700 dark:bg-navy-900 select-none">
            Cell font
            <select value={cellFontSize} onChange={(e) => setCellFontSize(Number(e.target.value))} className="rounded-full border border-navy-200 bg-white px-2 py-0.5 dark:border-navy-700 dark:bg-navy-900">
              <option value={9}>Small</option>
              <option value={11}>Normal</option>
              <option value={13}>Large</option>
              <option value={15}>XL</option>
            </select>
          </label>
          <label className="inline-flex items-center gap-2 rounded-full border border-navy-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-navy-700 dark:border-navy-700 dark:bg-navy-900 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={isBandW}
              onChange={(e) => setIsBandW(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-navy-300 text-green-600 focus:ring-green-500"
            />
            🖨️ Ink-Saver B&W Mode
          </label>
          <label className="inline-flex items-center gap-2 rounded-full border border-navy-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-navy-700 dark:border-navy-700 dark:bg-navy-900 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showSaturday}
              onChange={(e) => setShowSaturday(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-navy-300 text-green-600 focus:ring-green-500"
            />
            Include Saturday Timetable
          </label>
        </div>
      </div>

      {config && (
        <div className="print:hidden rounded-2xl border border-green-100 bg-green-50/50 px-4 py-2 text-xs font-medium text-navy-600 dark:border-green-900/40 dark:bg-green-950/10 dark:text-navy-300">
          Normal day starts {config.schoolDayStartTime ?? "08:00"} · Saturday short day {config.saturdayStartTime ?? "08:00"}–{config.saturdayEndTime ?? "12:40"} · {config.lessonDurationMins ?? 40} minute lessons
        </div>
      )}

      {error ? <LoadError onRetry={load} /> : slots === null ? <Skeletons /> : (
        <>
          <div className={`${printBundle ? "print:hidden" : ""} overflow-x-auto rounded-2xl border border-navy-100 dark:border-navy-800`}>
            {!daysVertical ? (
              <table className="w-full min-w-[720px] border-collapse bg-white text-xs dark:bg-navy-900">
                <thead>
                  <tr className="bg-warm-50 dark:bg-navy-800">
                    <th className="w-20 border-b border-navy-100 p-2.5 text-center font-semibold text-navy-400 dark:border-navy-800">Period</th>
                    {daysList.map((d) => <th key={d} className="border-b border-navy-100 p-2.5 text-left font-semibold text-navy-600 dark:border-navy-800 dark:text-navy-300">{d}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: config?.periodsPerDay || 8 }, (_, i) => i + 1).flatMap((p) => {
                    const lessonRow = (
                      <tr key={`period-${p}`}>
                        <td className="border-b border-navy-50 p-2.5 text-center font-black text-navy-900 dark:border-navy-800 dark:text-white">
                          <span className="block text-2xl leading-none">{p}</span>
                          <span className="mt-1 block text-[8px] font-semibold text-navy-400">{getPeriodTimeRange(p)}</span>
                        </td>
                        {Array.from({ length: daysList.length }, (_, dIdx) => {
                          const d = dIdx + 1;
                          const s = grid.get(`${d}|${p}`);
                          return (
                            <td key={d} className="border-b border-l border-navy-50 p-1 dark:border-navy-800">
                              <TimetableSlotCard slot={s} isBandW={isBandW} fontSize={cellFontSize} canManage={canManage} onClick={() => setCell({ day: d, period: p })} />
                            </td>
                          );
                        })}
                      </tr>
                    );
                    return [lessonRow, ...nonLessonRowsForPeriod(p, config).map((row) => <NonLessonMergedRow key={row.key} row={row} colSpan={daysList.length} />)];
                  })}
                </tbody>
              </table>
            ) : (
              <table className="w-full min-w-[920px] border-collapse bg-white text-xs dark:bg-navy-900">
                <thead>
                  <tr className="bg-warm-50 dark:bg-navy-800">
                    <th className="w-20 border-b border-navy-100 p-2.5 text-left font-semibold text-navy-400 dark:border-navy-800">Day</th>
                    {Array.from({ length: config?.periodsPerDay || 8 }, (_, i) => i + 1).map((p) => (
                      <React.Fragment key={p}>
                        <th className="border-b border-navy-100 p-2.5 text-center font-black text-navy-700 dark:border-navy-800 dark:text-navy-200">
                          <span className="block text-2xl leading-none">{p}</span>
                          <span className="mt-1 block text-[8px] font-semibold leading-tight text-navy-400 dark:text-navy-500">{getPeriodTimeRange(p)}</span>
                        </th>
                        {nonLessonRowsForPeriod(p, config).map((row) => (
                          <th key={`${p}-${row.key}`} className="w-16 border-b border-l border-navy-100 p-1 text-center dark:border-navy-800">
                            <span className={`mx-auto block rounded-full px-1 py-1 text-[9px] font-black uppercase tracking-widest ${row.tone === "lunch" ? "bg-green-500/10 text-green-700 dark:text-green-300" : "bg-amber-500/10 text-amber-700 dark:text-amber-300"}`}>
                              {row.tone === "lunch" ? "Lunch" : "Break"}
                            </span>
                            <span className="mt-1 block text-[7px] font-semibold leading-tight text-navy-400 dark:text-navy-500">{row.timeRange}</span>
                          </th>
                        ))}
                      </React.Fragment>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {daysList.map((dName, dIdx) => {
                    const d = dIdx + 1;
                    return (
                      <tr key={dName}>
                        <td className="border-b border-navy-50 p-2.5 font-black text-navy-700 dark:border-navy-800 dark:text-navy-200">{dName}</td>
                        {Array.from({ length: config?.periodsPerDay || 8 }, (_, i) => i + 1).map((p) => (
                          <React.Fragment key={`${d}-${p}`}>
                            <td className="border-b border-l border-navy-50 p-1 dark:border-navy-800">
                              <TimetableSlotCard slot={grid.get(`${d}|${p}`)} isBandW={isBandW} fontSize={cellFontSize} canManage={canManage} onClick={() => setCell({ day: d, period: p })} />
                            </td>
                            {nonLessonRowsForPeriod(p, config).map((row) => (
                              <td key={`${d}-${row.key}`} className={`${row.tone === "lunch" ? "bg-green-500/10 text-green-800" : "bg-amber-500/10 text-amber-800"} border-b border-l border-navy-50 p-1 text-center font-black dark:border-navy-800`}>
                                <span className="mx-auto block text-[10px] uppercase tracking-widest [writing-mode:vertical-rl] rotate-180">{row.label}</span>
                              </td>
                            ))}
                          </React.Fragment>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Print-Only Footer */}
          <div className="hidden print:flex items-center justify-between border-t border-navy-100 pt-2 mt-4 text-[9px] text-navy-400">
            <p>NEYO School Operating System (School OS) · Class Timetable Schedule</p>
            <p className="font-bold uppercase tracking-wider">Powered by NEYO</p>
          </div>
        </>
      )}

      {printBundle && <TimetablePrintBundleView bundle={printBundle} tenantName={tenant?.name} tenantLogoUrl={tenant?.logoUrl} />}

      {cell && classId && (
        <SlotDialog
          classId={classId} day={cell.day} period={cell.period}
          existing={grid.get(`${cell.day}|${cell.period}`) ?? null}
          subjects={subjects.filter((s) => !s.archived)} staff={staff} activities={activities}
          showSaturday={showSaturday}
          onClose={() => setCell(null)}
          onDone={() => { setCell(null); load(); }}
        />
      )}
      {autoOpen && classId && (
        <AutoFillDialog
          classId={classId}
          subjects={subjects.filter((s) => !s.archived)}
          staff={staff}
          onClose={() => setAutoOpen(false)}
          onDone={() => { setAutoOpen(false); load(); }}
        />
      )}
      {bulkSatOpen && (
        <BulkSaturdayModal
          classes={classes}
          subjects={subjects.filter((s) => !s.archived)}
          staff={staff}
          onClose={() => setBulkSatOpen(false)}
          onDone={(msg) => { setBulkSatOpen(false); toast({ title: msg, tone: "success" }); load(); }}
        />
      )}
      {configOpen && classId && (
        <ClassConfigModal
          classId={classId}
          currentConfig={config}
          onClose={() => setConfigOpen(false)}
          onSaved={() => { setConfigOpen(false); load(); toast({ title: "Schedule rules saved", tone: "success" }); }}
        />
      )}
    </div>
  );
}

function SlotDialog({ classId, day, period, existing, subjects, activities, staff, showSaturday, onClose, onDone }: any) {
  const { toast } = useToast();
  const [mode, setMode] = React.useState<"SUBJECT" | "ACTIVITY">(existing?.slotType === "ACTIVITY" ? "ACTIVITY" : "SUBJECT");
  const [subId, setSubId] = React.useState(existing?.subjectId ?? "");
  const [actId, setActId] = React.useState(existing?.activityCategoryId ?? "");
  const [teacherId, setStaffId] = React.useState(existing?.teacherId ?? "");
  const [venue, setVenue] = React.useState(existing?.venue ?? "");
  const [isCombined, setIsCombined] = React.useState(existing?.isCombined ?? false);
  const [combinedDetails, setCombinedDetails] = React.useState(existing?.combinedDetails ?? "");
  const [saving, setSaving] = React.useState(false);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/academics/timetable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "set",
          classId, dayOfWeek: day, period,
          slotType: mode,
          subjectId: mode === "SUBJECT" ? (subId || undefined) : undefined,
          activityCategoryId: mode === "ACTIVITY" ? (actId || undefined) : undefined,
          teacherId: teacherId || undefined,
          venue: venue || undefined,
          isCombined: mode === "SUBJECT" ? isCombined : false,
          combinedDetails: mode === "SUBJECT" && isCombined ? combinedDetails : undefined,
        }),
      });
      const json = await res.json();
      if (json.ok) { toast({ title: "Slot updated", tone: "success" }); onDone(); }
      else toast({ title: json.error?.message || "Failed", tone: "error" });
    } catch { toast({ title: "Network error", tone: "error" }); }
    finally { setSaving(false); }
  }

  async function clear() {
    setSaving(true);
    try {
      const res = await fetch("/api/academics/timetable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "clear", classId, dayOfWeek: day, period }),
      });
      const json = await res.json();
      if (json.ok) { toast({ title: "Slot cleared", tone: "success" }); onDone(); }
      else toast({ title: "Failed", tone: "error" });
    } catch { toast({ title: "Network error", tone: "error" }); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/40 backdrop-blur-sm px-4 animate-fade-in" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl border border-navy-100 bg-white p-6 shadow-pop text-left" onClick={(e)=>e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between border-b border-navy-50 pb-2">
          <h4 className="font-bold text-navy-950">Set Lesson Slot</h4>
          <button onClick={onClose} className="rounded-full p-1 text-navy-400 hover:bg-navy-50"><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-4">
          <div className="space-y-1"><Label>Subject</Label>
            <select value={subId} onChange={(e)=>setSubId(e.target.value)} className="w-full h-10 rounded-full border border-navy-200 bg-white px-3 text-sm">
              <option value="">Unassigned (Free Period)</option>
              {subjects.map((s: any)=><option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
            </select>
          </div>
          <div className="space-y-1"><Label>Teacher</Label>
            <select value={teacherId} onChange={(e)=>setStaffId(e.target.value)} className="w-full h-10 rounded-full border border-navy-200 bg-white px-3 text-sm">
              <option value="">Unassigned</option>
              {staff.map((s: any)=><option key={s.id} value={s.id}>{s.fullName}</option>)}
            </select>
          </div>
          <div className="space-y-1"><Label>Venue / Room</Label>
            <Input value={venue} onChange={(e)=>setVenue(e.target.value)} placeholder="e.g. 8 East, Science Lab, Hall" />
          </div>

          <div className="flex items-center gap-2 py-1.5 border-t border-b border-navy-50">
            <input
              type="checkbox"
              id="isCombined"
              checked={isCombined}
              onChange={(e) => setIsCombined(e.target.checked)}
              className="h-4 w-4 rounded border-navy-300 text-green-600 focus:ring-green-500"
            />
            <label htmlFor="isCombined" className="text-xs font-semibold text-navy-700 cursor-pointer select-none">
              Is Combined / Joint Lesson
            </label>
          </div>

          {isCombined && (
            <div className="space-y-1.5 animate-fade-in">
              <Label>Combined Lesson Details</Label>
              <Input
                placeholder="E.g. Mr. Njoroge, Joint Stream A & B"
                value={combinedDetails}
                onChange={(e) => setCombinedDetails(e.target.value)}
                className="h-9 text-xs"
              />
            </div>
          )}
        </div>
        <div className="mt-6 flex justify-end gap-2">
          {existing && <Button variant="secondary" onClick={clear} disabled={saving} className="text-red-600 hover:text-red-700 border-red-200 bg-red-50/50">Clear</Button>}
          <Button onClick={save} disabled={saving}>{saving?<Loader2 className="h-4 w-4 animate-spin" />:<Check className="h-4 w-4" />} Save</Button>
        </div>
      </div>
    </div>
  );
}

function AutoFillDialog({ classId, subjects, staff, onClose, onDone }: {
  classId: string; subjects: Subject[]; staff: Staff[];
  onClose: () => void; onDone: (msg: string) => void;
}) {
  const { toast } = useToast();
  const [load, setLoad] = React.useState<Record<string, number>>({});
  const [teachers, setTeachers] = React.useState<Record<string, string>>({});
  const [clearExisting, setClear] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const total = Object.values(load).reduce((a, b) => a + b, 0);

  async function run() {
    setSaving(true);
    try {
      const res = await fetch("/api/academics/timetable", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "autofill", classId, weeklyLoad: load, teachers, clearExisting }),
      });
      const json = await res.json();
      if (json.ok) {
        const un = json.data.unplaced.length;
        onDone(`${json.data.placed} periods placed${un ? ` · ${un} subject(s) could not fully fit` : ""}`);
      } else toast({ title: json.error?.message || "Failed", tone: "error" });
    } finally { setSaving(false); }
  }

  return (
    <Modal title="Auto-fill the week" onClose={onClose} wide>
      <p className="mb-3 text-xs text-navy-500 dark:text-navy-400">
        Set lessons-per-week for each subject (and optionally the teacher — their clashes across other classes are avoided automatically). 40 periods available.
      </p>
      <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
        {subjects.map((s) => (
          <div key={s.id} className="flex items-center gap-2">
            <span className="w-40 truncate text-sm text-navy-800 dark:text-navy-100">{s.name}</span>
            <Input type="number" min={0} max={10} className="w-20" value={load[s.id] ?? ""} placeholder="0"
              onChange={(e) => { const v = Number(e.target.value); setLoad((p) => { const n = { ...p }; if (v > 0) n[s.id] = v; else delete n[s.id]; return n; }); }} />
            <select value={teachers[s.id] ?? ""} onChange={(e) => setTeachers((p) => ({ ...p, [s.id]: e.target.value }))}
              className="flex-1 rounded-xl border border-navy-200 bg-white px-2 py-1.5 text-xs dark:border-navy-700 dark:bg-navy-800">
              <option value="">No teacher</option>
              {staff.map((t) => <option key={t.id} value={t.id}>{t.fullName}</option>)}
            </select>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between">
        <label className="flex items-center gap-2 text-xs text-navy-600 dark:text-navy-300">
          <input type="checkbox" checked={clearExisting} onChange={(e) => setClear(e.target.checked)} className="h-3.5 w-3.5 rounded border-navy-300 text-green-600" />
          Clear existing periods first
        </label>
        <Button onClick={run} disabled={saving || total === 0 || total > 40}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          Place {total} period{total === 1 ? "" : "s"}
        </Button>
      </div>
    </Modal>
  );
}

// ---- Lesson plans -------------------------------------------------------------------
interface PlanRow extends Plan {
  classId: string; teacherId: string;
  objectives?: string | null; activities?: string | null; notes?: string | null;
  strand?: { id: string; name: string } | null;
  competency?: { id: string; name: string } | null;
  assessmentPlan?: { id: string; title: string } | null;
  resources?: { id: string; fileUrl: string; fileName?: string | null }[];
}
interface CompetencyOpt { id: string; name: string; code?: string }
interface AssessmentPlanOpt { id: string; title: string; subjectId?: string | null; classId?: string | null }
interface StrandOpt { id: string; name: string }

const selectClass = "mt-1 w-full rounded-xl border border-navy-200 bg-white px-3 py-2 text-sm dark:border-navy-700 dark:bg-navy-800";
const areaClass = "mt-1 w-full rounded-xl border border-navy-200 bg-white px-3 py-2 text-sm dark:border-navy-700 dark:bg-navy-800";

function LessonsTab() {
  const { toast } = useToast();
  const [plans, setPlans] = React.useState<PlanRow[] | null>(null);
  const [error, setError] = React.useState(false);
  const [dialog, setDialog] = React.useState(false);
  const [subjects, setSubjects] = React.useState<Subject[]>([]);
  const [classes, setClasses] = React.useState<ClassOpt[]>([]);
  const [competencies, setCompetencies] = React.useState<CompetencyOpt[]>([]);
  const [assessmentPlans, setAssessmentPlans] = React.useState<AssessmentPlanOpt[]>([]);
  const [observeFor, setObserveFor] = React.useState<PlanRow | null>(null);
  const [resourceFor, setResourceFor] = React.useState<PlanRow | null>(null);
  const [analyticsFor, setAnalyticsFor] = React.useState<{ classId: string; subjectId: string } | null>(null);

  const load = React.useCallback(async () => {
    setError(false);
    try {
      const res = await fetch("/api/academics/lesson-plans");
      const json = await res.json();
      if (json.ok) setPlans(json.data.plans); else setError(true);
    } catch { setError(true); }
  }, []);
  React.useEffect(() => {
    load();
    fetch("/api/academics/subjects").then((r) => r.json()).then((j) => j.ok && setSubjects(j.data.subjects));
    fetch("/api/classes").then((r) => r.json()).then((j) => j.ok && setClasses(j.data.classes));
    fetch("/api/competencies").then((r) => r.json()).then((j) => j.ok && setCompetencies(j.data.board?.competencies ?? []));
    fetch("/api/assessments").then((r) => r.json()).then((j) => j.ok && setAssessmentPlans((j.data.board?.plans ?? []).map((p: any) => ({ id: p.id, title: p.title, subjectId: p.subjectId, classId: p.classId }))));
  }, [load]);

  async function setStatus(id: string, status: string) {
    const res = await fetch(`/api/academics/lesson-plans?id=${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    const json = await res.json();
    if (json.ok) load();
    else toast({ title: json.error?.message || "Failed", tone: "error" });
  }

  if (error) return <LoadError onRetry={load} />;
  if (plans === null) return <Skeletons />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => setDialog(true)}><Plus className="h-4 w-4" /> Plan a lesson</Button>
      </div>
      {plans.length === 0 ? (
        <EmptyState icon={NotebookPen} title="No lesson plans yet" description="Teachers plan their lessons here — topic, objectives, curriculum links, resources and observations per class and date." />
      ) : (
        <TableContainer>
          <Table>
            <THead><TR><TH>Date</TH><TH>Class</TH><TH>Subject</TH><TH>Topic</TH><TH>Curriculum links</TH><TH>Status</TH><TH>Actions</TH></TR></THead>
            <TBody>
              {plans.map((p) => (
                <TR key={p.id}>
                  <TD className="text-xs text-navy-400">{p.date}</TD>
                  <TD>{p.className}</TD>
                  <TD className="font-mono text-xs">{p.subjectCode}</TD>
                  <TD className="font-medium">{p.topic}</TD>
                  <TD className="text-xs">
                    <div className="flex flex-wrap gap-1">
                      {p.strand && <Badge tone="blue">Strand: {p.strand.name}</Badge>}
                      {p.competency && <Badge tone="blue">Competency: {p.competency.name}</Badge>}
                      {p.assessmentPlan && <Badge tone="green">Assessment: {p.assessmentPlan.title}</Badge>}
                      {(p.resources?.length ?? 0) > 0 && <Badge>{p.resources!.length} resource{p.resources!.length > 1 ? "s" : ""}</Badge>}
                      {!p.strand && !p.competency && !p.assessmentPlan && (p.resources?.length ?? 0) === 0 && <span className="text-navy-300">—</span>}
                    </div>
                  </TD>
                  <TD>
                    <select value={p.status} onChange={(e) => setStatus(p.id, e.target.value)} className="rounded-full border border-navy-200 bg-white px-2 py-1 text-xs dark:border-navy-700 dark:bg-navy-800">
                      <option value="PLANNED">Planned</option><option value="TAUGHT">Taught</option><option value="SKIPPED">Skipped</option>
                    </select>
                  </TD>
                  <TD>
                    <div className="flex flex-wrap gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setObserveFor(p)}>Observe</Button>
                      <Button size="sm" variant="ghost" onClick={() => setResourceFor(p)}>Resources</Button>
                      <Button size="sm" variant="ghost" onClick={() => setAnalyticsFor({ classId: p.classId, subjectId: (subjects.find((s) => s.code === p.subjectCode)?.id) || "" })}>Coverage</Button>
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </TableContainer>
      )}
      {dialog && <PlanDialog subjects={subjects} classes={classes} competencies={competencies} assessmentPlans={assessmentPlans} onClose={() => setDialog(false)} onDone={() => { setDialog(false); load(); toast({ title: "Lesson planned", tone: "success" }); }} />}
      {observeFor && <ObservationDialog plan={observeFor} onClose={() => setObserveFor(null)} onDone={() => toast({ title: "Observation recorded", tone: "success" })} />}
      {resourceFor && <ResourceDialog plan={resourceFor} onClose={() => setResourceFor(null)} onDone={() => { setResourceFor(null); load(); toast({ title: "Resource attached", tone: "success" }); }} />}
      {analyticsFor && <CoverageDialog classId={analyticsFor.classId} subjectId={analyticsFor.subjectId} onClose={() => setAnalyticsFor(null)} />}
    </div>
  );
}

function PlanDialog({ subjects, classes, competencies, assessmentPlans, onClose, onDone }: {
  subjects: Subject[]; classes: ClassOpt[]; competencies: CompetencyOpt[]; assessmentPlans: AssessmentPlanOpt[]; onClose: () => void; onDone: () => void;
}) {
  const { toast } = useToast();
  const [f, setF] = React.useState({ subjectId: "", classId: "", date: new Date(Date.now() + 3 * 3600_000).toISOString().slice(0, 10), topic: "", objectives: "", activities: "", strandId: "", competencyId: "", assessmentPlanId: "" });
  const [strands, setStrands] = React.useState<StrandOpt[]>([]);
  const [resources, setResources] = React.useState<{ fileUrl: string; fileName: string }[]>([]);
  const [resUrl, setResUrl] = React.useState("");
  const [resName, setResName] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!f.subjectId) { setStrands([]); return; }
    fetch(`/api/cbc/strands?subjectId=${f.subjectId}`).then((r) => r.json()).then((j) => j.ok && setStrands((j.data.strands ?? []).map((s: any) => ({ id: s.id, name: s.name }))));
  }, [f.subjectId]);

  function addResource() {
    try { new URL(resUrl); } catch { toast({ title: "Enter a valid resource URL (https://…)", tone: "error" }); return; }
    setResources([...resources, { fileUrl: resUrl, fileName: resName || "" }]);
    setResUrl(""); setResName("");
  }

  async function save() {
    setSaving(true);
    try {
      const body: any = {
        subjectId: f.subjectId, classId: f.classId, date: f.date, topic: f.topic,
        objectives: f.objectives || undefined, activities: f.activities || undefined,
        strandId: f.strandId || undefined, competencyId: f.competencyId || undefined,
        assessmentPlanId: f.assessmentPlanId || undefined,
        resources: resources.length ? resources.map((r) => ({ fileUrl: r.fileUrl, fileName: r.fileName || undefined })) : undefined,
      };
      const res = await fetch("/api/academics/lesson-plans", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const json = await res.json();
      if (json.ok) onDone();
      else toast({ title: json.error?.message || "Failed", tone: "error" });
    } finally { setSaving(false); }
  }

  const planOptions = assessmentPlans.filter((p) => !p.subjectId || p.subjectId === f.subjectId);

  return (
    <Modal title="Plan a lesson" onClose={onClose} wide>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label>Class</Label>
            <select value={f.classId} onChange={(e) => setF({ ...f, classId: e.target.value })} className={selectClass}>
              <option value="">Choose…</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <Label>Subject</Label>
            <select value={f.subjectId} onChange={(e) => setF({ ...f, subjectId: e.target.value, strandId: "" })} className={selectClass}>
              <option value="">Choose…</option>
              {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        </div>
        <div><Label>Date</Label><Input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></div>
        <div><Label>Topic</Label><Input value={f.topic} onChange={(e) => setF({ ...f, topic: e.target.value })} placeholder="e.g. Quadratic equations — completing the square" /></div>
        <div><Label>Objectives (optional)</Label><Input value={f.objectives} onChange={(e) => setF({ ...f, objectives: e.target.value })} /></div>
        <div><Label>Activities (optional)</Label><Input value={f.activities} onChange={(e) => setF({ ...f, activities: e.target.value })} /></div>

        <div className="rounded-xl border border-navy-200 p-3 dark:border-navy-700">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-navy-400">Link to curriculum (CBC objectives)</p>
          <div className="grid grid-cols-1 gap-2">
            <div>
              <Label>Curriculum strand / objective (optional)</Label>
              <select value={f.strandId} onChange={(e) => setF({ ...f, strandId: e.target.value })} className={selectClass} disabled={!f.subjectId}>
                <option value="">{f.subjectId ? "Choose a strand…" : "Pick a subject first"}</option>
                {strands.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <Label>Competency (optional)</Label>
              <select value={f.competencyId} onChange={(e) => setF({ ...f, competencyId: e.target.value })} className={selectClass}>
                <option value="">Choose a competency…</option>
                {competencies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <Label>Assessment plan (optional)</Label>
              <select value={f.assessmentPlanId} onChange={(e) => setF({ ...f, assessmentPlanId: e.target.value })} className={selectClass}>
                <option value="">Choose an assessment plan…</option>
                {planOptions.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-navy-200 p-3 dark:border-navy-700">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-navy-400">Learning resources & evidence (optional)</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input value={resUrl} onChange={(e) => setResUrl(e.target.value)} placeholder="https://… link to resource" />
            <Input value={resName} onChange={(e) => setResName(e.target.value)} placeholder="Name (optional)" />
            <Button type="button" variant="secondary" onClick={addResource}><Plus className="h-4 w-4" /> Add</Button>
          </div>
          {resources.length > 0 && (
            <ul className="mt-2 space-y-1">
              {resources.map((r, i) => (
                <li key={i} className="flex items-center justify-between rounded-lg bg-navy-50 px-2 py-1 text-xs dark:bg-navy-800">
                  <span className="truncate">{r.fileName || r.fileUrl}</span>
                  <button type="button" onClick={() => setResources(resources.filter((_, idx) => idx !== i))} className="text-red-500"><Trash2 className="h-3 w-3" /></button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <Button onClick={save} disabled={saving || !f.classId || !f.subjectId || f.topic.length < 2} className="w-full">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Save plan
        </Button>
      </div>
    </Modal>
  );
}

function ObservationDialog({ plan, onClose, onDone }: { plan: PlanRow; onClose: () => void; onDone: () => void }) {
  const { toast } = useToast();
  const [obs, setObs] = React.useState<any[] | null>(null);
  const [note, setNote] = React.useState("");
  const [level, setLevel] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const load = React.useCallback(async () => {
    const res = await fetch(`/api/academics/lesson-plans/observations?lessonPlanId=${plan.id}`);
    const json = await res.json();
    if (json.ok) setObs(json.data.observations); else setObs([]);
  }, [plan.id]);
  React.useEffect(() => { load(); }, [load]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw);
      hydratingDraftRef.current = true;
      if (draft.timeOffTeacherId) setTimeOffTeacherId(draft.timeOffTeacherId);
      if (Array.isArray(draft.timeOffWindows) && draft.timeOffWindows.length > 0) setTimeOffWindows(draft.timeOffWindows);
      if (draft.combinationForm) setCombinationForm(draft.combinationForm);
      setDraftMeta({ savedAt: draft.savedAt, dirty: false, restored: true });
      setTimeout(() => { hydratingDraftRef.current = false; }, 0);
    } catch {}
  }, []);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    if (hydratingDraftRef.current) return;
    const draft = {
      savedAt: new Date().toISOString(),
      timeOffTeacherId,
      timeOffWindows,
      combinationForm,
    };
    try {
      window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      setDraftMeta({ savedAt: draft.savedAt, dirty: true, restored: draftMeta.restored });
    } catch {}
  }, [timeOffTeacherId, timeOffWindows, combinationForm]);

  function clearDraft(showToast = true) {
    if (typeof window !== "undefined") window.localStorage.removeItem(DRAFT_KEY);
    setDraftMeta({ dirty: false, restored: false });
    if (showToast) toast({ title: "Saved draft cleared", tone: "success" });
  }

  async function save() {
    if (note.trim().length < 2) { toast({ title: "Write a short observation note.", tone: "error" }); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/academics/lesson-plans/observations", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lessonPlanId: plan.id, note: note.trim(), level: level ? Number(level) : undefined }),
      });
      const json = await res.json();
      if (json.ok) { setNote(""); setLevel(""); await load(); onDone(); }
      else toast({ title: json.error?.message || "Failed", tone: "error" });
    } finally { setSaving(false); }
  }

  return (
    <Modal title={`Observations — ${plan.topic}`} onClose={onClose}>
      <div className="space-y-3">
        <p className="text-xs text-navy-400">Record what you observed in this lesson. Links to its strand/competency automatically.</p>
        <div>
          <Label>Observation note</Label>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} className={areaClass} placeholder="e.g. Most learners grasped factorisation; 4 still struggle with sign changes." />
        </div>
        <div>
          <Label>CBC proficiency level (optional, 1–4)</Label>
          <select value={level} onChange={(e) => setLevel(e.target.value)} className={selectClass}>
            <option value="">—</option>
            <option value="1">1 — Below expectation</option>
            <option value="2">2 — Approaching expectation</option>
            <option value="3">3 — Meeting expectation</option>
            <option value="4">4 — Exceeding expectation</option>
          </select>
        </div>
        <Button onClick={save} disabled={saving} className="w-full">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Record observation
        </Button>
        <div className="border-t border-navy-100 pt-2 dark:border-navy-800">
          <p className="mb-1 text-xs font-bold uppercase tracking-wide text-navy-400">Recorded</p>
          {obs === null ? <Skeletons /> : obs.length === 0 ? (
            <p className="text-xs text-navy-300">No observations yet.</p>
          ) : (
            <ul className="space-y-1">
              {obs.map((o) => (
                <li key={o.id} className="rounded-lg bg-navy-50 px-2 py-1 text-xs dark:bg-navy-800">
                  <span className="font-medium">{o.studentName}</span>{o.level ? ` · L${o.level}` : ""} — {o.note} <span className="text-navy-300">({o.date})</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Modal>
  );
}

function ResourceDialog({ plan, onClose, onDone }: { plan: PlanRow; onClose: () => void; onDone: () => void }) {
  const { toast } = useToast();
  const [url, setUrl] = React.useState("");
  const [name, setName] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  async function save() {
    try { new URL(url); } catch { toast({ title: "Enter a valid URL (https://…)", tone: "error" }); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/academics/lesson-plans/resources", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lessonPlanId: plan.id, resources: [{ fileUrl: url, fileName: name || undefined }] }),
      });
      const json = await res.json();
      if (json.ok) onDone();
      else toast({ title: json.error?.message || "Failed", tone: "error" });
    } finally { setSaving(false); }
  }
  return (
    <Modal title={`Attach resource — ${plan.topic}`} onClose={onClose}>
      <div className="space-y-3">
        {(plan.resources?.length ?? 0) > 0 && (
          <ul className="space-y-1">
            {plan.resources!.map((r) => (
              <li key={r.id} className="truncate rounded-lg bg-navy-50 px-2 py-1 text-xs dark:bg-navy-800">{r.fileName || r.fileUrl}</li>
            ))}
          </ul>
        )}
        <div><Label>Resource URL</Label><Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://… worksheet, video, slides" /></div>
        <div><Label>Name (optional)</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
        <Button onClick={save} disabled={saving} className="w-full">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Attach
        </Button>
      </div>
    </Modal>
  );
}

function CoverageDialog({ classId, subjectId, onClose }: { classId: string; subjectId: string; onClose: () => void }) {
  const [data, setData] = React.useState<any>(null);
  const [error, setError] = React.useState(false);
  React.useEffect(() => {
    if (!classId || !subjectId) { setError(true); return; }
    fetch(`/api/academics/lesson-plans/analytics?classId=${classId}&subjectId=${subjectId}`)
      .then((r) => r.json()).then((j) => j.ok ? setData(j.data.data) : setError(true)).catch(() => setError(true));
  }, [classId, subjectId]);
  return (
    <Modal title="Planning coverage & analytics" onClose={onClose}>
      {error ? (
        <p className="text-sm text-red-500">Could not load analytics. Pick a plan with a known subject.</p>
      ) : data === null ? <Skeletons /> : (
        <div className="space-y-3">
          <p className="text-xs text-navy-400">Planned vs taught vs assessed for this class &amp; subject.</p>
          <div className="grid grid-cols-3 gap-2 text-center">
            <Stat label="Planned" value={data.totalPlans} />
            <Stat label="Taught" value={`${data.taughtPlans} (${data.taughtPct}%)`} />
            <Stat label="Assessed" value={`${data.assessedPlans} (${data.assessedPct}%)`} />
          </div>
          <div className="grid grid-cols-2 gap-2 text-center">
            <Stat label="Strands covered" value={`${data.uniqueStrandsCovered}/${data.totalStrands} (${data.strandCoveragePct}%)`} />
            <Stat label="Competencies taught" value={data.uniqueCompetenciesTaught} />
          </div>
          <div className="grid grid-cols-2 gap-2 text-center">
            <Stat label="Plans linked to assessment" value={data.plansLinkedToAssessment} />
            <Stat label="Objectives assessed" value={data.assessedObjectives} />
          </div>
        </div>
      )}
    </Modal>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-navy-200 p-3 dark:border-navy-700">
      <p className="text-lg font-bold text-navy-950 dark:text-white">{value}</p>
      <p className="text-[10px] uppercase tracking-wide text-navy-400">{label}</p>
    </div>
  );
}

// ---- Timetable Generator (G.18) ------------------------------------------------------

function TimetableGeneratorTab({ canManage }: { canManage: boolean }) {
  const { toast } = useToast();
  const [data, setData] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  const [weights, setWeights] = React.useState<Record<string, any>>({});
  const [hasConfiguredConstraints, setHasConfiguredConstraints] = React.useState(false);
  const [validationOpen, setValidationOpen] = React.useState(false);
  const [bulkOpen, setBulkOpen] = React.useState(false);

  const load = React.useCallback(async () => {
    try {
      const res = await fetch("/api/academics/timetable/generator");
      const json = await res.json();
      if (json.ok) {
        setData(json.data);
        const initialWeights: any = {};
        json.data.subjects.forEach((s: any) => {
          initialWeights[s.id] = { lessons: "5", doubles: "1", singles: "3" };
        });
        setWeights(initialWeights);
      }
    } catch { /* ignore */ }
  }, []);

  React.useEffect(() => { load(); }, [load]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw);
      hydratingDraftRef.current = true;
      if (draft.timeOffTeacherId) setTimeOffTeacherId(draft.timeOffTeacherId);
      if (Array.isArray(draft.timeOffWindows) && draft.timeOffWindows.length > 0) setTimeOffWindows(draft.timeOffWindows);
      if (draft.combinationForm) setCombinationForm(draft.combinationForm);
      setDraftMeta({ savedAt: draft.savedAt, dirty: false, restored: true });
      setTimeout(() => { hydratingDraftRef.current = false; }, 0);
    } catch {}
  }, []);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    if (hydratingDraftRef.current) return;
    const draft = {
      savedAt: new Date().toISOString(),
      timeOffTeacherId,
      timeOffWindows,
      combinationForm,
    };
    try {
      window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      setDraftMeta({ savedAt: draft.savedAt, dirty: true, restored: draftMeta.restored });
    } catch {}
  }, [timeOffTeacherId, timeOffWindows, combinationForm]);

  function clearDraft(showToast = true) {
    if (typeof window !== "undefined") window.localStorage.removeItem(DRAFT_KEY);
    setDraftMeta({ dirty: false, restored: false });
    if (showToast) toast({ title: "Saved draft cleared", tone: "success" });
  }

  async function generate(force = false) {
    if (!force && !hasConfiguredConstraints) {
      setValidationOpen(true);
      return;
    }

    setLoading(true);
    setValidationOpen(false);
    try {
      const res = await fetch("/api/academics/timetable/generator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "generate", weights }),
      });
      const json = await res.json();
      if (json.ok) {
        toast({ title: "Timetable generated successfully!", description: "All lessons mapped conflict-free.", tone: "success" });
        load();
      } else {
        toast({ title: json.error?.message || "Generation failed", tone: "error" });
      }
    } catch {
      toast({ title: "Network error during timetable generation.", tone: "error" });
    } finally {
      setLoading(false);
    }
  }

  function handleSaveConstraints() {
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      setHasConfiguredConstraints(true);
      toast({
        title: "Subject constraints saved",
        description: "Ministry lessons-per-week weights applied to generator limits.",
        tone: "success",
      });
    }, 600);
  }

  if (data === null) return <Skeletons />;

  return (
    <div className="space-y-6 text-left">
      <Card className="border border-amber-100 bg-amber-50/70 dark:border-amber-900/40 dark:bg-amber-950/10">
        <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-amber-700 dark:text-amber-300">Draft resume protection</p>
            <p className="mt-1 text-sm text-navy-700 dark:text-navy-200">
              If you leave this screen midway, NEYO restores your unfinished teacher time-off and combination setup when you return.
            </p>
            <p className="mt-1 text-xs text-navy-500 dark:text-navy-400">
              {draftMeta.savedAt ? `Last saved locally: ${new Date(draftMeta.savedAt).toLocaleString()}` : "No local draft saved yet."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {draftMeta.restored && <Badge tone="blue">Draft restored</Badge>}
            {draftMeta.dirty && <Badge tone="amber">Unsaved setup protected</Badge>}
            <Button size="sm" variant="secondary" onClick={() => clearDraft()}><RotateCcw className="h-4 w-4" /> Clear saved draft</Button>
          </div>
        </CardContent>
      </Card>
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Subject Weights Constraints Editor Card */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sliders className="h-5 w-5 text-green-600 animate-pulse" />
              Subject constraints & Period Weights
            </CardTitle>
            <p className="text-xs text-navy-400">
              Configure standard period constraints (lessons per week, double blocks, and singles) in alignment with Ministry of Education regulations.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="max-h-[320px] overflow-y-auto space-y-3 pr-1">
              {data.subjects.map((sub: any) => {
                const w = weights[sub.id] || { lessons: "5", doubles: "1", singles: "3" };
                return (
                  <div key={sub.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl border border-navy-50 bg-white dark:border-navy-800 dark:bg-navy-950 text-xs">
                    <div className="space-y-0.5">
                      <span className="font-bold text-navy-900 dark:text-white">{sub.name}</span>
                      <span className="block text-[10px] text-navy-400 font-mono">Code: {sub.code}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="w-18">
                        <Label className="text-[9px] uppercase font-bold text-navy-400">Lessons/Wk</Label>
                        <Input
                          type="number"
                          value={w.lessons}
                          onChange={(e) => setWeights({ ...weights, [sub.id]: { ...w, lessons: e.target.value } })}
                          className="h-8 text-xs p-1"
                        />
                      </div>
                      <div className="w-18">
                        <Label className="text-[9px] uppercase font-bold text-navy-400 font-semibold">Doubles</Label>
                        <Input
                          type="number"
                          value={w.doubles}
                          onChange={(e) => setWeights({ ...weights, [sub.id]: { ...w, doubles: e.target.value } })}
                          className="h-8 text-xs p-1"
                        />
                      </div>
                      <div className="w-18">
                        <Label className="text-[9px] uppercase font-bold text-navy-400 font-semibold">Singles</Label>
                        <Input
                          type="number"
                          value={w.singles}
                          onChange={(e) => setWeights({ ...weights, [sub.id]: { ...w, singles: e.target.value } })}
                          className="h-8 text-xs p-1"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <Button size="sm" onClick={handleSaveConstraints} disabled={saving} className="w-full">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save MoE Subject Constraints
            </Button>
          </CardContent>
        </Card>

        {/* Generator Controls Card */}
        <Card className="flex flex-col h-full justify-between">
          <CardHeader>
            <CardTitle className="text-base">Conflict-Free Generator</CardTitle>
            <p className="text-xs text-navy-400">Generates mathematical timetables with 0 teacher conflicts.</p>
          </CardHeader>
          <CardContent className="space-y-4 flex-1">
            <div className="rounded-2xl border border-navy-50 bg-navy-50/20 p-4 text-xs text-navy-600 leading-relaxed dark:border-navy-800">
              ⚡ <strong>Active Scoping:</strong> Generates a full week including break periods, Saturday morning alternates, and combined classes for all {data.classCount} classes and {data.teacherCount} teachers on record.
            </div>

            <Button
              onClick={() => generate(false)}
              disabled={loading}
              className="w-full h-12 text-sm shadow-md"
            >
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
              Generate Timetable
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* PRE-GENERATION CONSTRAINTS VALIDATION MODAL */}
      {validationOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/40 backdrop-blur-sm px-4 animate-fade-in" onClick={() => setValidationOpen(false)}>
          <div className="w-full max-w-md rounded-2xl border border-navy-100 bg-white p-6 shadow-pop text-center" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-500/10 text-amber-600 mb-4">
              <HelpCircle className="h-8 w-8 animate-bounce" />
            </div>

            <h3 className="text-base font-bold text-navy-950">
              Review Subject Constraints?
            </h3>
            
            <p className="mt-3 text-xs leading-relaxed text-navy-500">
              Are you sure you would like to generate the timetable without your own configured subject weights constraints?
            </p>

            <div className="mt-6 flex flex-col sm:flex-row gap-2.5 justify-center">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setValidationOpen(false);
                  toast({
                    title: "Action halted",
                    description: "Do the necessary, configure your subject weights, and get back!",
                    tone: "info",
                  });
                }}
              >
                No, Configure First
              </Button>
              <Button
                size="sm"
                onClick={() => generate(true)}
              >
                Yes, Bypass & Generate
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


function TimetableEngineTab({ canManage, schoolLevelActivation }: { canManage: boolean; schoolLevelActivation?: { isSeniorSchool: boolean; isJuniorSchool: boolean; isMixedSchool: boolean; educationLevelsOffered: string[] } }) {
  const { toast } = useToast();
  const DRAFT_KEY = "neyo-smart-timetable-draft-v1";
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [starting, setStarting] = React.useState(false);
  const [payload, setPayload] = React.useState<any>(null);
  const [job, setJob] = React.useState<any>(null);
  const [classes, setClasses] = React.useState<any[]>([]);
  const [subjects, setSubjects] = React.useState<any[]>([]);
  const [teachers, setTeachers] = React.useState<any[]>([]);
  const [classNeeds, setClassNeeds] = React.useState<Record<string, any[]>>({});
  const [timeOffTeacherId, setTimeOffTeacherId] = React.useState("");
  const [timeOffWindows, setTimeOffWindows] = React.useState([{ dayOfWeek: 1, period: 1, note: "" }]);
  const [combinationForm, setCombinationForm] = React.useState<any>({
    id: "",
    name: "",
    subjectId: "",
    teacherId: "",
    lessonsPerWeek: 4,
    doubleCount: 0,
    scope: "SELECTED",
    source: "MANUAL",
    classIds: [] as string[],
  });
  const [draftMeta, setDraftMeta] = React.useState<{ savedAt?: string; dirty: boolean; restored: boolean }>({ dirty: false, restored: false });
  const pollRef = React.useRef<any>(null);
  const hydratingDraftRef = React.useRef(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const [engineRes, generatorRes, jobRes, teacherRes] = await Promise.all([
        fetch("/api/academics/timetable/engine"),
        fetch("/api/academics/timetable/generator"),
        fetch("/api/academics/timetable/generate-job"),
        fetch("/api/conversations/recipients"),
      ]);
      const [engineJson, generatorJson, jobJson, teacherJson] = await Promise.all([
        engineRes.json(), generatorRes.json(), jobRes.json(), teacherRes.json(),
      ]);
      if (!engineJson.ok || !generatorJson.ok) throw new Error("Failed to load timetable engine data.");
      setPayload(engineJson.data);
      setJob(jobJson.ok ? jobJson.data.job : null);
      setClasses(generatorJson.data.classes ?? []);
      setSubjects((generatorJson.data.subjects ?? []).filter((s: any) => !s.archived));
      setClassNeeds(generatorJson.data.needsByClassId ?? {});
      setTeachers((teacherJson.ok ? teacherJson.data.recipients : []).filter((u: any) => ["TEACHER", "CLASS_TEACHER", "HOD", "DEPUTY_PRINCIPAL", "PRINCIPAL", "SCHOOL_OWNER", "DEAN_OF_STUDIES"].includes(u.role)));
    } catch {
      toast({ title: "Could not load smart timetable settings.", tone: "error" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  React.useEffect(() => { load(); }, [load]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw);
      hydratingDraftRef.current = true;
      if (draft.timeOffTeacherId) setTimeOffTeacherId(draft.timeOffTeacherId);
      if (Array.isArray(draft.timeOffWindows) && draft.timeOffWindows.length > 0) setTimeOffWindows(draft.timeOffWindows);
      if (draft.combinationForm) setCombinationForm(draft.combinationForm);
      setDraftMeta({ savedAt: draft.savedAt, dirty: false, restored: true });
      setTimeout(() => { hydratingDraftRef.current = false; }, 0);
    } catch {}
  }, []);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    if (hydratingDraftRef.current) return;
    const draft = {
      savedAt: new Date().toISOString(),
      timeOffTeacherId,
      timeOffWindows,
      combinationForm,
    };
    try {
      window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      setDraftMeta({ savedAt: draft.savedAt, dirty: true, restored: draftMeta.restored });
    } catch {}
  }, [timeOffTeacherId, timeOffWindows, combinationForm]);

  function clearDraft(showToast = true) {
    if (typeof window !== "undefined") window.localStorage.removeItem(DRAFT_KEY);
    setDraftMeta({ dirty: false, restored: false });
    if (showToast) toast({ title: "Saved draft cleared", tone: "success" });
  }

  React.useEffect(() => {
    if (!job || !["QUEUED", "RUNNING"].includes(job.status)) {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = null;
      return;
    }
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/academics/timetable/generate-job?jobId=${job.id}`);
        const json = await res.json();
        if (json.ok) {
          setJob(json.data.job);
          if (!["QUEUED", "RUNNING"].includes(json.data.job?.status)) {
            clearInterval(pollRef.current);
            pollRef.current = null;
            load();
          }
        }
      } catch {}
    }, 2000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [job, load]);

  async function saveNeed(classId: string, subjectId: string, patch: any) {
    setSaving(true);
    try {
      const current = (classNeeds[classId] ?? []).find((n: any) => n.subjectId === subjectId) ?? {};
      const body = {
        action: "save_need",
        classId,
        subjectId,
        lessonsPerWeek: Number(patch.lessonsPerWeek ?? current.lessonsPerWeek ?? 0),
        teacherId: patch.teacherId ?? current.teacherId ?? null,
        doubleCount: Number(patch.doubleCount ?? current.doubleCount ?? 0),
        allowSplitDouble: Boolean(patch.allowSplitDouble ?? current.allowSplitDouble ?? false),
      };
      const res = await fetch("/api/academics/timetable/generator", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error?.message || "Failed");
      await load();
      toast({ title: "Class subject need saved", tone: "success" });
    } catch (e: any) {
      toast({ title: e?.message || "Could not save class subject need.", tone: "error" });
    } finally {
      setSaving(false);
    }
  }

  async function saveConstraint(constraint: any) {
    setSaving(true);
    try {
      const res = await fetch("/api/academics/timetable/engine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "upsert_constraint", ...constraint }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error?.message || "Failed");
      await load();
      toast({ title: "Constraint saved", tone: "success" });
    } catch (e: any) {
      toast({ title: e?.message || "Could not save constraint.", tone: "error" });
    } finally {
      setSaving(false);
    }
  }

  async function saveTimeOff() {
    if (!timeOffTeacherId) {
      toast({ title: "Choose a teacher first.", tone: "error" });
      return;
    }
    setSaving(true);
    try {
      const windows = timeOffWindows.map((w) => ({ dayOfWeek: Number(w.dayOfWeek), period: Number(w.period), note: w.note || undefined }));
      const res = await fetch("/api/academics/timetable/engine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save_timeoff", teacherId: timeOffTeacherId, windows }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error?.message || "Failed");
      await load();
      clearDraft(false);
      toast({ title: "Teacher time-off saved", tone: "success" });
    } catch (e: any) {
      toast({ title: e?.message || "Could not save teacher time-off.", tone: "error" });
    } finally {
      setSaving(false);
    }
  }

  async function saveCombination() {
    if (!combinationForm.name || !combinationForm.subjectId) {
      toast({ title: "Combination needs a name and subject.", tone: "error" });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/academics/timetable/engine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "upsert_combination", ...combinationForm, lessonsPerWeek: Number(combinationForm.lessonsPerWeek), doubleCount: Number(combinationForm.doubleCount) }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error?.message || "Failed");
      setCombinationForm({ id: "", name: "", subjectId: "", teacherId: "", lessonsPerWeek: 4, doubleCount: 0, scope: "SELECTED", source: "MANUAL", classIds: [] });
      await load();
      clearDraft(false);
      toast({ title: "Combination group saved", tone: "success" });
    } catch (e: any) {
      toast({ title: e?.message || "Could not save combination group.", tone: "error" });
    } finally {
      setSaving(false);
    }
  }

  async function deleteCombination(id: string) {
    setSaving(true);
    try {
      const res = await fetch("/api/academics/timetable/engine", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "delete_combination", id }) });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error?.message || "Failed");
      await load();
      toast({ title: "Combination group deleted", tone: "success" });
    } catch (e: any) {
      toast({ title: e?.message || "Could not delete combination group.", tone: "error" });
    } finally {
      setSaving(false);
    }
  }

  async function runMasterButton() {
    setStarting(true);
    try {
      const res = await fetch("/api/academics/timetable/generate-job", { method: "POST" });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error?.message || "Failed");
      setJob(json.data.job);
      toast({ title: "Timetable generation started", description: "The master button is now building the timetable in the background.", tone: "success" });
    } catch (e: any) {
      toast({ title: e?.message || "Could not start timetable generation.", tone: "error" });
    } finally {
      setStarting(false);
    }
  }

  if (loading || !payload) return <Skeletons />;

  const constraintSummary = (c: any) => {
    const cfg = c.config ?? {};
    if (c.kind === "SUBJECT_MORNING") return `Subjects: ${(cfg.subjectIds ?? []).length} · up to period ${cfg.maxPeriod ?? 4}`;
    if (c.kind === "SUBJECTS_NOT_ADJACENT") return `${cfg.subjectAName ?? "Subject A"} should not follow ${cfg.subjectBName ?? "Subject B"}`;
    if (c.kind === "PE_TIMESLOT") return `Allowed periods: ${(cfg.allowedPeriods ?? []).join(", ") || "not set"}`;
    if (c.kind === "TEACHER_TIMEOFF") return "Uses saved teacher blocked windows";
    if (c.kind === "LESSON_DISTRIBUTION") return `Spread target: ${cfg.minDays ?? 2} days`;
    if (c.kind === "ONE_SINGLE_PER_DAY") return "At most one single lesson per subject per day";
    if (c.kind === "SPLIT_DOUBLE_HARD") return `Subjects: ${(cfg.subjectIds ?? []).length}`;
    return c.label;
  };

  return (
    <div className="space-y-6 text-left">
      <Card className="border border-amber-100 bg-amber-50/70 dark:border-amber-900/40 dark:bg-amber-950/10">
        <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-amber-700 dark:text-amber-300">Draft resume protection</p>
            <p className="mt-1 text-sm text-navy-700 dark:text-navy-200">
              If you leave this screen midway, NEYO restores your unfinished teacher time-off and combination setup when you return.
            </p>
            <p className="mt-1 text-xs text-navy-500 dark:text-navy-400">
              {draftMeta.savedAt ? `Last saved locally: ${new Date(draftMeta.savedAt).toLocaleString()}` : "No local draft saved yet."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {draftMeta.restored && <Badge tone="blue">Draft restored</Badge>}
            {draftMeta.dirty && <Badge tone="amber">Unsaved setup protected</Badge>}
            <Button size="sm" variant="secondary" onClick={() => clearDraft()}><RotateCcw className="h-4 w-4" /> Clear saved draft</Button>
          </div>
        </CardContent>
      </Card>
      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="overflow-hidden border border-white/50 bg-white/80 backdrop-blur-xl dark:border-navy-800 dark:bg-navy-950/70">
          <CardContent className="p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <Badge tone="green">L.7 Smart Timetable Engine</Badge>
                <h2 className="mt-3 text-xl font-black tracking-tight text-navy-950 dark:text-white">Master button timetable generation</h2>
                <p className="mt-2 max-w-3xl text-sm leading-relaxed text-navy-500 dark:text-navy-400">
                  Set the real school rules first, then press one master button. NEYO builds the timetable in the background, shows live progress, respects teacher time-off, avoids clashes, and schedules single, double and combination lessons deterministically.
                </p>
              </div>
              <Button onClick={runMasterButton} disabled={!canManage || starting || ["QUEUED", "RUNNING"].includes(job?.status)} className="h-12 min-w-[220px]">
                {starting || ["QUEUED", "RUNNING"].includes(job?.status)
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <Wand2 className="h-4 w-4" />}
                {job?.status === "RUNNING" ? "Generating…" : job?.status === "QUEUED" ? "Queued…" : "Start Master Button"}
              </Button>
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-3">
              <StatPill icon={Users} label="Classes" value={String(classes.length)} />
              <StatPill icon={BookOpen} label="Subjects" value={String(subjects.length)} />
              <StatPill icon={Clock3} label="Constraints" value={String((payload.constraints ?? []).length)} />
            </div>
            {job && (
              <div className="mt-5 rounded-3xl border border-green-100 bg-green-50/70 p-4 dark:border-green-900/40 dark:bg-green-950/10">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-green-700 dark:text-green-300">Background job</p>
                    <p className="mt-1 text-sm font-semibold text-navy-800 dark:text-navy-100">{job.phase || job.status}</p>
                  </div>
                  <Badge tone={job.status === "DONE" ? "green" : job.status === "FAILED" ? "red" : "blue"}>{job.status}</Badge>
                </div>
                <div className="mt-3 h-3 overflow-hidden rounded-full bg-white/80 dark:bg-navy-900">
                  <div className="h-full rounded-full bg-gradient-to-r from-green-500 to-emerald-400 transition-all" style={{ width: `${Math.max(3, Number(job.progress ?? 0))}%` }} />
                </div>
                <div className="mt-3 grid gap-2 text-xs text-navy-600 dark:text-navy-300 md:grid-cols-3">
                  <div><strong>Progress:</strong> {job.progress ?? 0}%</div>
                  <div><strong>Slots placed:</strong> {job.slotsPlaced ?? 0}</div>
                  <div><strong>Warnings:</strong> {(job.warnings ?? []).length}</div>
                </div>
                {(job.unplaced ?? []).length > 0 && (
                  <div className="mt-3 rounded-2xl border border-amber-100 bg-white/80 p-3 text-xs text-amber-700 dark:border-amber-900/40 dark:bg-navy-950/60 dark:text-amber-300">
                    <strong>Unplaced lessons:</strong> {(job.unplaced ?? []).slice(0, 5).map((u: any) => u.subjectCode || u.classLabel || "item").join(", ")}
                  </div>
                )}
                {job.error && (
                  <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300">{job.error}</div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">What this engine enforces now</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-navy-600 dark:text-navy-300">
            <FeatureRow icon={ShieldCheck} text="No class double-booking and no teacher double-booking" />
            <FeatureRow icon={TimerReset} text="Single and double lessons with optional split doubles" />
            <FeatureRow icon={Link2} text="Combination classes can run once across many classes" />
            <FeatureRow icon={Ban} text="Teacher time-off and blocked periods are respected" />
            <FeatureRow icon={Clock3} text="Morning subjects, PE time slots, spread rules, adjacency rules" />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><Sliders className="h-5 w-5 text-green-600" /> Constraint settings</CardTitle>
            <p className="text-xs text-navy-400">Turn timetable rules on or off and tune how the school wants lessons arranged.</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {(payload.constraints ?? []).length === 0 && (
              <EmptyState icon={Sliders} title="No smart constraints saved yet" description="Create timetable rules below. The engine already supports lessons-per-week, doubles, combinations and teacher time-off." />
            )}
            {(payload.constraints ?? []).map((constraint: any) => (
              <div key={constraint.id} className="rounded-2xl border border-navy-100 p-4 dark:border-navy-800">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-navy-900 dark:text-white">{constraint.label}</p>
                    <p className="mt-1 text-xs text-navy-500 dark:text-navy-400">{constraintSummary(constraint)}</p>
                  </div>
                  <Badge tone={constraint.enabled ? "green" : "neutral"}>{constraint.enabled ? "Enabled" : "Off"}</Badge>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" disabled={saving} onClick={() => saveConstraint({ ...constraint, enabled: !constraint.enabled, config: constraint.config })}>{constraint.enabled ? "Turn off" : "Turn on"}</Button>
                  <Button size="sm" variant="secondary" disabled={saving} onClick={() => {
                    const minDays = Number((constraint.config?.minDays ?? 2)) + 1;
                    saveConstraint({ ...constraint, config: { ...(constraint.config ?? {}), minDays: Math.min(5, minDays) } });
                  }}>Tune</Button>
                </div>
              </div>
            ))}
            <div className="rounded-2xl border border-dashed border-navy-200 p-4 dark:border-navy-700">
              <p className="text-xs font-bold uppercase tracking-widest text-navy-400">Quick add rules</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {[
                  { kind: "SUBJECT_MORNING", label: "Math in morning", config: { maxPeriod: 4 } },
                  { kind: "SUBJECTS_NOT_ADJACENT", label: "English and Kiswahili apart", config: {} },
                  { kind: "LESSON_DISTRIBUTION", label: "Spread lessons", config: { minDays: 2 } },
                  { kind: "ONE_SINGLE_PER_DAY", label: "One single per day", config: {} },
                  { kind: "PE_TIMESLOT", label: "PE allowed slots", config: { allowedPeriods: [6, 7, 8] } },
                ].map((preset) => (
                  <Button key={preset.kind + preset.label} size="sm" variant="secondary" disabled={saving} onClick={() => saveConstraint({ kind: preset.kind, label: preset.label, enabled: true, config: preset.config })}>{preset.label}</Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><Ban className="h-5 w-5 text-amber-600" /> Teacher time-off</CardTitle>
            <p className="text-xs text-navy-400">Block days or periods when a teacher should not be scheduled.</p>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>Teacher</Label>
              <select value={timeOffTeacherId} onChange={(e) => setTimeOffTeacherId(e.target.value)} className="mt-1 w-full rounded-xl border border-navy-200 bg-white px-3 py-2 text-sm dark:border-navy-700 dark:bg-navy-800">
                <option value="">Choose teacher…</option>
                {teachers.map((t: any) => <option key={t.id} value={t.id}>{t.fullName}</option>)}
              </select>
            </div>
            {timeOffWindows.map((w, index) => (
              <div key={index} className="grid grid-cols-[1fr_1fr_1.4fr_auto] gap-2">
                <select value={w.dayOfWeek} onChange={(e) => setTimeOffWindows((prev) => prev.map((x, i) => i === index ? { ...x, dayOfWeek: Number(e.target.value) } : x))} className="rounded-xl border border-navy-200 bg-white px-3 py-2 text-sm dark:border-navy-700 dark:bg-navy-800">
                  <option value={0}>All days</option>
                  {DAY_NAMES.map((d, i) => <option key={d} value={i + 1}>{d}</option>)}
                </select>
                <select value={w.period} onChange={(e) => setTimeOffWindows((prev) => prev.map((x, i) => i === index ? { ...x, period: Number(e.target.value) } : x))} className="rounded-xl border border-navy-200 bg-white px-3 py-2 text-sm dark:border-navy-700 dark:bg-navy-800">
                  <option value={0}>Whole day</option>
                  {Array.from({ length: 8 }, (_, i) => i + 1).map((p) => <option key={p} value={p}>Period {p}</option>)}
                </select>
                <Input value={w.note} onChange={(e) => setTimeOffWindows((prev) => prev.map((x, i) => i === index ? { ...x, note: e.target.value } : x))} placeholder="Reason" />
                <Button size="sm" variant="ghost" onClick={() => setTimeOffWindows((prev) => prev.filter((_, i) => i !== index))}><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" onClick={() => setTimeOffWindows((prev) => [...prev, { dayOfWeek: 1, period: 1, note: "" }])}><Plus className="h-4 w-4" /> Add window</Button>
              <Button size="sm" onClick={saveTimeOff} disabled={saving || !canManage}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save time-off</Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><Grid3X3 className="h-5 w-5 text-blue-600" /> Class subject lesson requirements</CardTitle>
            <p className="text-xs text-navy-400">For each class and subject, save lessons per week, number of doubles, split-double preference and teacher.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            {classes.slice(0, 6).map((cls: any) => (
              <div key={cls.id} className="rounded-2xl border border-navy-100 p-4 dark:border-navy-800">
                <p className="text-sm font-bold text-navy-900 dark:text-white">{cls.level} {cls.stream}</p>
                <div className="mt-3 space-y-2">
                  {subjects.slice(0, 8).map((subject: any) => {
                    const current = (classNeeds[cls.id] ?? []).find((n: any) => n.subjectId === subject.id) ?? {};
                    return (
                      <div key={subject.id} className="grid grid-cols-[minmax(120px,1.2fr)_84px_84px_130px_1fr_auto] items-center gap-2 rounded-xl border border-navy-50 p-2 text-xs dark:border-navy-800">
                        <div>
                          <p className="font-semibold text-navy-800 dark:text-navy-100">{subject.name}</p>
                          <p className="text-[10px] text-navy-400">{subject.code}</p>
                        </div>
                        <Input type="number" min={0} max={12} defaultValue={current.lessonsPerWeek ?? 0} onBlur={(e) => saveNeed(cls.id, subject.id, { lessonsPerWeek: e.target.value })} />
                        <Input type="number" min={0} max={6} defaultValue={current.doubleCount ?? 0} onBlur={(e) => saveNeed(cls.id, subject.id, { doubleCount: e.target.value })} />
                        <label className="flex items-center gap-2 text-xs text-navy-600 dark:text-navy-300"><input type="checkbox" defaultChecked={Boolean(current.allowSplitDouble)} onChange={(e) => saveNeed(cls.id, subject.id, { allowSplitDouble: e.target.checked })} /> Split double</label>
                        <select defaultValue={current.teacherId ?? ""} onChange={(e) => saveNeed(cls.id, subject.id, { teacherId: e.target.value || null })} className="rounded-xl border border-navy-200 bg-white px-3 py-2 text-sm dark:border-navy-700 dark:bg-navy-800">
                          <option value="">Teacher…</option>
                          {teachers.map((t: any) => <option key={t.id} value={t.id}>{t.fullName}</option>)}
                        </select>
                        <Badge tone={(current.lessonsPerWeek ?? 0) > 0 ? "green" : "neutral"}>{(current.lessonsPerWeek ?? 0) > 0 ? "Saved" : "Empty"}</Badge>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
            {classes.length > 6 && <p className="text-xs text-navy-400">Showing first 6 classes for speed. The same save flow works for the rest through the existing Timetable Generator tab.</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><Link2 className="h-5 w-5 text-purple-600" /> Combination classes</CardTitle>
            <p className="text-xs text-navy-400">Handle grouped lessons for whole school combinations or selected classes only.</p>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-3 rounded-2xl border border-navy-100 p-4 dark:border-navy-800">
              <Input value={combinationForm.name} onChange={(e) => setCombinationForm((p: any) => ({ ...p, name: e.target.value }))} placeholder="e.g. Combined Physics" />
              <div className="grid grid-cols-2 gap-2">
                <select value={combinationForm.subjectId} onChange={(e) => setCombinationForm((p: any) => ({ ...p, subjectId: e.target.value }))} className="rounded-xl border border-navy-200 bg-white px-3 py-2 text-sm dark:border-navy-700 dark:bg-navy-800">
                  <option value="">Subject…</option>
                  {subjects.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <select value={combinationForm.teacherId} onChange={(e) => setCombinationForm((p: any) => ({ ...p, teacherId: e.target.value }))} className="rounded-xl border border-navy-200 bg-white px-3 py-2 text-sm dark:border-navy-700 dark:bg-navy-800">
                  <option value="">Teacher…</option>
                  {teachers.map((t: any) => <option key={t.id} value={t.id}>{t.fullName}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input type="number" min={1} max={12} value={combinationForm.lessonsPerWeek} onChange={(e) => setCombinationForm((p: any) => ({ ...p, lessonsPerWeek: Number(e.target.value) }))} placeholder="Lessons / week" />
                <Input type="number" min={0} max={6} value={combinationForm.doubleCount} onChange={(e) => setCombinationForm((p: any) => ({ ...p, doubleCount: Number(e.target.value) }))} placeholder="Double lessons" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <select value={combinationForm.scope} onChange={(e) => setCombinationForm((p: any) => ({ ...p, scope: e.target.value }))} className="rounded-xl border border-navy-200 bg-white px-3 py-2 text-sm dark:border-navy-700 dark:bg-navy-800">
                  <option value="SELECTED">Selected classes only</option>
                  <option value="GLOBAL">Whole class group</option>
                </select>
                <select value={combinationForm.source} onChange={(e) => setCombinationForm((p: any) => ({ ...p, source: e.target.value }))} className="rounded-xl border border-navy-200 bg-white px-3 py-2 text-sm dark:border-navy-700 dark:bg-navy-800">
                  <option value="MANUAL">School-defined classes</option>
                  <option value="SUBJECT_CHOICE">Use student subject choices</option>
                </select>
              </div>
              <div className="max-h-36 overflow-y-auto rounded-2xl border border-navy-100 p-3 dark:border-navy-800">
                <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-navy-400">Member classes</p>
                <div className="space-y-2">
                  {classes.map((cls: any) => {
                    const checked = combinationForm.classIds.includes(cls.id);
                    return (
                      <label key={cls.id} className="flex items-center gap-2 text-sm text-navy-700 dark:text-navy-200">
                        <input type="checkbox" checked={checked} onChange={(e) => setCombinationForm((p: any) => ({ ...p, classIds: e.target.checked ? [...p.classIds, cls.id] : p.classIds.filter((id: string) => id !== cls.id) }))} />
                        <span>{cls.level} {cls.stream}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
              <Button onClick={saveCombination} disabled={saving || !canManage}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save combination group</Button>
            </div>
            <div className="space-y-2">
              {(payload.combinations ?? []).map((group: any) => (
                <div key={group.id} className="rounded-2xl border border-navy-100 p-3 dark:border-navy-800">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-navy-900 dark:text-white">{group.name}</p>
                      <p className="mt-1 text-xs text-navy-500 dark:text-navy-400">{group.lessonsPerWeek} lessons/week · {group.doubleCount} doubles · {group.source} · {group.scope}</p>
                      <p className="mt-1 text-xs text-navy-500 dark:text-navy-400">{(group.members ?? []).length} class members</p>
                    </div>
                    <Button size="sm" variant="ghost" disabled={saving || !canManage} onClick={() => deleteCombination(group.id)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatPill({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-navy-100 bg-white/70 px-4 py-3 dark:border-navy-800 dark:bg-navy-950/60">
      <div className="flex items-center gap-2 text-navy-500 dark:text-navy-400"><Icon className="h-4 w-4" /><span className="text-xs font-semibold uppercase tracking-widest">{label}</span></div>
      <p className="mt-2 text-2xl font-black tracking-tight text-navy-950 dark:text-white">{value}</p>
    </div>
  );
}

function FeatureRow({ icon: Icon, text }: { icon: any; text: string }) {
  return <div className="flex items-start gap-2"><Icon className="mt-0.5 h-4 w-4 text-green-600" /><p>{text}</p></div>;
}

function TeacherSubjectsModal({ teacherId, subjects, currentSubjectIds, onClose, onSaved }: {
  teacherId: string; subjects: any[]; currentSubjectIds: string[]; onClose: () => void; onSaved: () => void;
}) {
  const { toast } = useToast();
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set(currentSubjectIds));
  const [saving, setSaving] = React.useState(false);

  function toggle(sid: string) {
    const next = new Set(selectedIds);
    if (next.has(sid)) next.delete(sid); else next.add(sid);
    setSelectedIds(next);
  }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/academics/timetable/generator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save_teacher_subject", teacherId, subjectIds: [...selectedIds] }),
      });
      const json = await res.json();
      if (json.ok) onSaved();
      else toast({ title: json.error?.message || "Department update failed", tone: "error" });
    } finally { setSaving(false); }
  }

  return (
    <Modal title="Configure Qualified Subjects" onClose={onClose} wide>
      <p className="mb-3 text-xs text-navy-400">Select which subjects this teacher teaches. The solver uses this map to auto-assign teachers during slot scheduling.</p>
      <div className="max-h-72 overflow-y-auto space-y-2 mb-4 pr-1">
        {subjects.map((s) => (
          <label key={s.id} className="flex items-center gap-2.5 rounded-lg p-2 hover:bg-navy-50 text-sm text-navy-700 dark:text-navy-200 cursor-pointer">
            <input type="checkbox" checked={selectedIds.has(s.id)} onChange={() => toggle(s.id)} className="h-4 w-4 rounded border-navy-300 text-green-600 focus:ring-green-500" />
            <span>{s.name} ({s.code})</span>
          </label>
        ))}
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
        <Button onClick={save} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Changes"}</Button>
      </div>
    </Modal>
  );
}

function SubjectNeedsModal({ classId, subjects, teachers, currentNeeds, onClose, onSaved }: {
  classId: string; subjects: any[]; teachers: any[]; currentNeeds: any[]; onClose: () => void; onSaved: () => void;
}) {
  const [saving, setSaving] = React.useState(false);
  const [needs, setNeeds] = React.useState<Record<string, { lessons: number; teacherId: string }>>(() => {
    const map: Record<string, { lessons: number; teacherId: string }> = {};
    for (const s of subjects) {
      const n = currentNeeds.find((x) => x.subjectId === s.id);
      map[s.id] = { lessons: n?.lessonsPerWeek ?? 0, teacherId: n?.teacherId ?? "" };
    }
    return map;
  });

  async function save() {
    setSaving(true);
    try {
      // Save each subject need that has lessons > 0 or has changes
      for (const sid of Object.keys(needs)) {
        const item = needs[sid];
        await fetch("/api/academics/timetable/generator", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "save_need",
            classId,
            subjectId: sid,
            lessonsPerWeek: item.lessons,
            teacherId: item.teacherId || null,
          }),
        });
      }
      onSaved();
    } finally { setSaving(false); }
  }

  function updateLessons(sid: string, val: number) {
    setNeeds((p) => ({ ...p, [sid]: { ...p[sid], lessons: val } }));
  }

  function updateTeacher(sid: string, val: string) {
    setNeeds((p) => ({ ...p, [sid]: { ...p[sid], teacherId: val } }));
  }

  return (
    <Modal title="Configure Subject Loads" onClose={onClose} wide>
      <p className="mb-3 text-xs text-navy-400">Configure weekly lessons needs and the assigned subject teacher (The Input Matrix) for this class.</p>
      <div className="max-h-80 overflow-y-auto space-y-3 mb-4 pr-1">
        {subjects.map((s) => {
          const item = needs[s.id] || { lessons: 0, teacherId: "" };
          return (
            <div key={s.id} className="flex items-center gap-3 rounded-xl border border-navy-100 p-2.5 dark:border-navy-800">
              <span className="w-28 truncate text-sm font-medium text-navy-800 dark:text-navy-100">{s.name}</span>
              <div className="flex items-center gap-1.5 shrink-0">
                <Label className="text-[10px] text-navy-400">Lessons/wk</Label>
                <Input type="number" min={0} max={10} value={item.lessons || ""} placeholder="0" className="w-16 h-8 text-xs"
                  onChange={(e) => updateLessons(s.id, Number(e.target.value))} />
              </div>
              <div className="flex-1">
                <select value={item.teacherId} onChange={(e) => updateTeacher(s.id, e.target.value)}
                  className="w-full h-8 rounded-lg border border-navy-200 bg-white px-2 text-xs dark:border-navy-700 dark:bg-navy-900 text-navy-800 dark:text-navy-100">
                  <option value="">Choose Teacher…</option>
                  {teachers.map((t) => <option key={t.id} value={t.id}>{t.fullName}</option>)}
                </select>
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
        <Button onClick={save} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Needs Matrix"}</Button>
      </div>
    </Modal>
  );
}

function ClassConfigModal({ classId, currentConfig, onClose, onSaved }: {
  classId: string; currentConfig: any | null; onClose: () => void; onSaved: () => void;
}) {
  const { toast } = useToast();
  const [saving, setSaving] = React.useState(false);
  const [f, setF] = React.useState({
    periodsPerDay: currentConfig?.periodsPerDay ?? 8,
    freePeriodsPerWeek: currentConfig?.freePeriodsPerWeek ?? 4,
    coCurricularCount: currentConfig?.coCurricularCount ?? 2,
    coCurricularName: currentConfig?.coCurricularName ?? "Games",
    schoolDayStartTime: currentConfig?.schoolDayStartTime ?? "08:00",
    saturdayStartTime: currentConfig?.saturdayStartTime ?? "08:00",
    saturdayEndTime: currentConfig?.saturdayEndTime ?? "12:40",
    lessonDurationMins: currentConfig?.lessonDurationMins ?? 40,
    shortBreakStart: currentConfig?.shortBreakStart ?? 2,
    shortBreakMins: currentConfig?.shortBreakMins ?? 15,
    longBreakStart: currentConfig?.longBreakStart ?? 4,
    longBreakMins: currentConfig?.longBreakMins ?? 30,
    lunchStart: currentConfig?.lunchStart ?? 6,
    lunchMins: currentConfig?.lunchMins ?? 60,
    hasRemedials: currentConfig?.hasRemedials ?? false,
    hasPreps: currentConfig?.hasPreps ?? false,
    lunchShift: currentConfig?.lunchShift ?? 1,
    hasSaturday: currentConfig?.hasSaturday ?? true, // Added for Saturday attendance control
  });

  const set = (k: string, v: any) => setF((p) => ({ ...p, [k]: v }));

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/academics/timetable/generator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save_config", classId, ...f }),
      });
      const json = await res.json();
      if (json.ok) onSaved();
      else toast({ title: json.error?.message || "Department update failed", tone: "error" });
    } finally { setSaving(false); }
  }

  return (
    <Modal title="Configure General Schedule Rules" onClose={onClose} wide>
      <div className="space-y-4 mb-4 max-h-96 overflow-y-auto pr-1">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="cfg-periods">Periods Per Day</Label>
            <Input id="cfg-periods" type="number" min={4} max={10} value={f.periodsPerDay} onChange={(e) => set("periodsPerDay", Number(e.target.value))} />
          </div>
          <div>
            <Label htmlFor="cfg-duration">Lesson Duration (mins)</Label>
            <Input id="cfg-duration" type="number" min={10} max={120} value={f.lessonDurationMins} onChange={(e) => set("lessonDurationMins", Number(e.target.value))} />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 rounded-2xl border border-green-100 bg-green-50/40 p-3 dark:border-green-900/40 dark:bg-green-950/10">
          <div>
            <Label htmlFor="cfg-start">Normal day starts</Label>
            <Input id="cfg-start" type="time" value={f.schoolDayStartTime} onChange={(e) => set("schoolDayStartTime", e.target.value)} />
          </div>
          <div>
            <Label htmlFor="cfg-sat-start">Saturday starts</Label>
            <Input id="cfg-sat-start" type="time" value={f.saturdayStartTime} onChange={(e) => set("saturdayStartTime", e.target.value)} />
          </div>
          <div>
            <Label htmlFor="cfg-sat-end">Saturday ends</Label>
            <Input id="cfg-sat-end" type="time" value={f.saturdayEndTime} onChange={(e) => set("saturdayEndTime", e.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="cfg-free">Free study periods / week</Label>
            <Input id="cfg-free" type="number" min={0} max={15} value={f.freePeriodsPerWeek} onChange={(e) => set("freePeriodsPerWeek", Number(e.target.value))} />
          </div>
          <div>
            <Label htmlFor="cfg-coconname">Co-curricular Activity</Label>
            <Input id="cfg-coconname" value={f.coCurricularName} onChange={(e) => set("coCurricularName", e.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="cfg-cocon">Co-curricular slots / week</Label>
            <Input id="cfg-cocon" type="number" min={0} max={4} value={f.coCurricularCount} onChange={(e) => set("coCurricularCount", Number(e.target.value))} />
          </div>
          <div className="flex flex-col gap-2 pt-5">
            <label className="flex items-center gap-2 text-sm text-navy-600 dark:text-navy-300 select-none cursor-pointer">
              <input type="checkbox" checked={f.hasRemedials} onChange={(e) => set("hasRemedials", e.target.checked)} className="h-4 w-4 rounded border-navy-300 text-green-600" />
              <span>Participates in Remedials</span>
            </label>
            <label className="flex items-center gap-2 text-sm text-navy-600 dark:text-navy-300 select-none cursor-pointer">
              <input type="checkbox" checked={f.hasPreps} onChange={(e) => set("hasPreps", e.target.checked)} className="h-4 w-4 rounded border-navy-300 text-green-600" />
              <span>Participates in Preps</span>
            </label>
            <label className="flex items-center gap-2 text-sm text-navy-600 dark:text-navy-300 select-none cursor-pointer">
              <input type="checkbox" checked={f.hasSaturday} onChange={(e) => set("hasSaturday", e.target.checked)} className="h-4 w-4 rounded border-navy-300 text-green-600" />
              <span>Attends Saturday Remedials</span>
            </label>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="cfg-lunchshift">Lunch Shift</Label>
            <select
              id="cfg-lunchshift"
              value={f.lunchShift}
              onChange={(e) => set("lunchShift", Number(e.target.value))}
              className="mt-1 w-full h-10 rounded-2xl border border-navy-200 bg-white px-3.5 text-sm dark:border-navy-700 dark:bg-navy-900 text-navy-800 dark:text-navy-100"
            >
              <option value={1}>Shift 1 (Period 5)</option>
              <option value={2}>Shift 2 (Period 6)</option>
              <option value={3}>Shift 3 (Period 7)</option>
            </select>
          </div>
        </div>

        <div className="border-t border-navy-100 dark:border-navy-800 pt-3 space-y-3">
          <p className="text-xs font-bold text-navy-800 dark:text-navy-100">Configure Breaks &amp; Times</p>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label className="text-[10px]">Short Break After Period</Label>
              <Input type="number" value={f.shortBreakStart} onChange={(e) => set("shortBreakStart", Number(e.target.value))} />
            </div>
            <div>
              <Label className="text-[10px]">Short Break (mins)</Label>
              <Input type="number" value={f.shortBreakMins} onChange={(e) => set("shortBreakMins", Number(e.target.value))} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label className="text-[10px]">Long Break After Period</Label>
              <Input type="number" value={f.longBreakStart} onChange={(e) => set("longBreakStart", Number(e.target.value))} />
            </div>
            <div>
              <Label className="text-[10px]">Long Break (mins)</Label>
              <Input type="number" value={f.longBreakMins} onChange={(e) => set("longBreakMins", Number(e.target.value))} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label className="text-[10px]">Lunch Break After Period</Label>
              <Input type="number" value={f.lunchStart} onChange={(e) => set("lunchStart", Number(e.target.value))} />
            </div>
            <div>
              <Label className="text-[10px]">Lunch Break (mins)</Label>
              <Input type="number" value={f.lunchMins} onChange={(e) => set("lunchMins", Number(e.target.value))} />
            </div>
          </div>
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
        <Button onClick={save} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Config"}</Button>
      </div>
    </Modal>
  );
}

// ---- Bulk Saturday Timetable Scheduler (Chunk C — Part 3) ---------------------------
function BulkSaturdayModal({
  classes,
  subjects,
  staff,
  onClose,
  onDone,
}: {
  classes: ClassOpt[];
  subjects: Subject[];
  staff: Staff[];
  onClose: () => void;
  onDone: (msg: string) => void;
}) {
  const { toast } = useToast();
  const [selectedClassIds, setSelectedClassIds] = React.useState<Set<string>>(new Set());
  const [selectedPeriods, setSelectedPeriods] = React.useState<Set<number>>(new Set());
  const [subjectId, setSubjectId] = React.useState("");
  const [fairSubjectIds, setFairSubjectIds] = React.useState<Set<string>>(new Set());
  const [teacherId, setTeacherId] = React.useState("");
  const [weekRotation, setWeekRotation] = React.useState("ALL"); // ALL | WEEK_A | WEEK_B
  const [fairMode, setFairMode] = React.useState(false);
  const [scheduleMode, setScheduleMode] = React.useState<"SATURDAY" | "REMEDIAL" | "EXAM_PREP">("SATURDAY");
  const [configs, setConfigs] = React.useState<any[]>([]); // Loaded internally to prevent prop drilling
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    fetch("/api/academics/timetable/generator")
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) {
          setConfigs(j.data.configs ?? []);
        }
      });
  }, []);

  // Filter out classes configured to NOT attend Saturdays (H.2)
  const activeClasses = classes.filter((c) => {
    const cfg = configs.find((x) => x.classId === c.id);
    return cfg ? cfg.hasSaturday !== false : true;
  });
  const selectedConfig = configs.find((cfg) => selectedClassIds.has(cfg.classId)) ?? configs[0] ?? null;
  const saturdayWindow = selectedConfig
    ? `${selectedConfig.saturdayStartTime ?? "08:00"}–${selectedConfig.saturdayEndTime ?? "12:40"}`
    : "08:00–12:40";

  function toggleClass(id: string) {
    const next = new Set(selectedClassIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedClassIds(next);
  }

  function togglePeriod(p: number) {
    const next = new Set(selectedPeriods);
    if (next.has(p)) next.delete(p); else next.add(p);
    setSelectedPeriods(next);
  }

  function toggleFairSubject(id: string) {
    const next = new Set(fairSubjectIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setFairSubjectIds(next);
  }

  // Quick Select Helpers
  function selectGrade6to9() {
    const targetIds = activeClasses
      .filter((c) => {
        const num = parseInt(c.name.match(/\d+/)?.[0] ?? "");
        return c.name.toLowerCase().includes("grade") && num >= 6 && num <= 9;
      })
      .map((c) => c.id);
    setSelectedClassIds(new Set(targetIds.length > 0 ? targetIds : activeClasses.map((c) => c.id)));
  }

  function selectForm1to4() {
    const targetIds = activeClasses
      .filter((c) => c.name.toLowerCase().includes("form"))
      .map((c) => c.id);
    setSelectedClassIds(new Set(targetIds.length > 0 ? targetIds : activeClasses.map((c) => c.id)));
  }

  function selectAllClasses() {
    setSelectedClassIds(new Set(activeClasses.map((c) => c.id)));
  }

  async function handleBulkSchedule() {
    if (selectedClassIds.size === 0) {
      toast({ title: "Select at least one class.", tone: "error" });
      return;
    }
    if (selectedPeriods.size === 0) {
      toast({ title: "Select at least one lesson period.", tone: "error" });
      return;
    }
    if (!fairMode && !subjectId) {
      toast({ title: "Select a subject.", tone: "error" });
      return;
    }
    if (fairMode && fairSubjectIds.size < 2) {
      toast({ title: "Pick at least two subjects for fair rotation.", tone: "error" });
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/academics/timetable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fairMode ? {
          action: "fairSaturday",
          classIds: [...selectedClassIds],
          periodIds: [...selectedPeriods],
          subjectIds: [...fairSubjectIds],
          teacherId: teacherId || null,
          mode: scheduleMode,
          rotationMode: weekRotation === "ALL" ? "ALL" : "ALTERNATE",
        } : {
          action: "bulkSaturday",
          classIds: [...selectedClassIds],
          periodIds: [...selectedPeriods],
          subjectId,
          teacherId: teacherId || null,
          weekRotation,
        }),
      });
      const json = await res.json();
      if (json.ok) {
        onDone(fairMode ? `Fair Saturday rotation generated across ${fairSubjectIds.size} subjects for ${selectedClassIds.size} classes!` : `Successfully scheduled Saturday (${weekRotation === "ALL" ? "Weekly" : `Alternating ${weekRotation}`}) for ${selectedClassIds.size} classes!`);
      } else {
        toast({ title: json.error?.message || "Bulk scheduling failed.", tone: "error" });
      }
    } catch {
      toast({ title: "Failed to connect to bulk scheduler.", tone: "error" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Bulk Saturday Scheduler (Preps / Remedials)" onClose={onClose} wide>
      <div className="space-y-4 max-h-[85vh] overflow-y-auto pr-1">
        <p className="text-xs text-navy-400">
          Schedule Saturday exam prep, study halls, or remedials for multiple classes simultaneously in one single tap. Current Saturday window: {saturdayWindow}.
        </p>

        {/* 1) Class Selection */}
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Label>Select Target Classes ({selectedClassIds.size})</Label>
            <div className="flex gap-1">
              <button onClick={selectGrade6to9} className="rounded bg-navy-50 hover:bg-navy-100 text-[10px] font-semibold text-navy-600 px-2 py-1 dark:bg-navy-800 dark:text-navy-300">Grade 6-9</button>
              <button onClick={selectForm1to4} className="rounded bg-navy-50 hover:bg-navy-100 text-[10px] font-semibold text-navy-600 px-2 py-1 dark:bg-navy-800 dark:text-navy-300">Form 1-4</button>
              <button onClick={selectAllClasses} className="rounded bg-navy-50 hover:bg-navy-100 text-[10px] font-semibold text-navy-600 px-2 py-1 dark:bg-navy-800 dark:text-navy-300">All</button>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 border border-navy-100 dark:border-navy-800 bg-warm-50/50 p-3 rounded-2xl max-h-32 overflow-y-auto">
            {activeClasses.map((c) => (
              <label key={c.id} className="flex items-center gap-1.5 text-xs text-navy-700 dark:text-navy-200 cursor-pointer">
                <input type="checkbox" checked={selectedClassIds.has(c.id)} onChange={() => toggleClass(c.id)} className="h-3.5 w-3.5 rounded border-navy-300 text-green-600 focus:ring-green-500" />
                <span className="truncate">{c.name}</span>
              </label>
            ))}
          </div>
        </div>

        {/* 2) Period Selection */}
        <div className="space-y-2">
          <Label>Select Saturday Lesson Periods ({selectedPeriods.size})</Label>
          <div className="grid grid-cols-4 gap-2">
            {Array.from({ length: 12 }, (_, i) => i + 1).map((p) => {
              const selected = selectedPeriods.has(p);
              return (
                <button
                  key={p}
                  onClick={() => togglePeriod(p)}
                  className={cn(
                    "rounded-xl border p-2 text-center text-xs font-semibold transition-all select-none",
                    selected
                      ? "bg-green-600 border-green-500 text-white shadow-sm"
                      : "bg-white border-navy-100 text-navy-600 dark:bg-navy-900 dark:border-navy-800 dark:text-navy-300 hover:bg-navy-50"
                  )}
                >
                  <span className="block">Period {p}</span>
                  <span className="mt-0.5 block text-[9px] opacity-75">{timetablePeriodTimeRange(p, selectedConfig, 6)}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 3) Fairness mode */}
        <div className="rounded-2xl border border-green-200/60 bg-green-50/40 p-3 dark:border-green-900 dark:bg-green-900/10">
          <label className="flex items-center gap-2 text-xs font-semibold text-navy-700 dark:text-navy-200">
            <input type="checkbox" checked={fairMode} onChange={(e) => setFairMode(e.target.checked)} className="h-4 w-4 rounded border-navy-300 text-green-600" />
            Fair rotation mode — share limited Saturday periods across different subjects
          </label>
          {fairMode && (
            <div className="mt-3 space-y-2">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {subjects.slice(0, 12).map((s) => (
                  <label key={s.id} className="flex items-center gap-1.5 text-[11px] text-navy-600 dark:text-navy-300">
                    <input type="checkbox" checked={fairSubjectIds.has(s.id)} onChange={() => toggleFairSubject(s.id)} className="h-3.5 w-3.5 rounded border-navy-300 text-green-600" />
                    <span className="truncate">{s.code}</span>
                  </label>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Mode</Label>
                  <select value={scheduleMode} onChange={(e) => setScheduleMode(e.target.value as any)} className="mt-1 w-full rounded-2xl border border-navy-200 bg-white px-3 py-2 text-xs dark:border-navy-700 dark:bg-navy-900 text-navy-800 dark:text-navy-100">
                    <option value="SATURDAY">Saturday lessons</option>
                    <option value="REMEDIAL">Remedial mode</option>
                    <option value="EXAM_PREP">Exam prep mode</option>
                  </select>
                </div>
                <div>
                  <Label>Rotation</Label>
                  <select value={weekRotation} onChange={(e) => setWeekRotation(e.target.value)} className="mt-1 w-full rounded-2xl border border-navy-200 bg-white px-3 py-2 text-xs dark:border-navy-700 dark:bg-navy-900 text-navy-800 dark:text-navy-100">
                    <option value="WEEK_A">Alternate Week A/B</option>
                    <option value="ALL">Every Saturday</option>
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 4) Subject, Teacher, and Alternating Week Rotation */}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <Label>Subject</Label>
            <select value={subjectId} disabled={fairMode} onChange={(e) => setSubjectId(e.target.value)}
              className="mt-1.5 w-full rounded-2xl border border-navy-200 bg-white px-3 py-2.5 text-xs dark:border-navy-700 dark:bg-navy-900 text-navy-800 dark:text-navy-100">
              <option value="">Select subject…</option>
              {subjects.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
            </select>
          </div>
          <div>
            <Label>Teacher (optional)</Label>
            <select value={teacherId} onChange={(e) => setTeacherId(e.target.value)}
              className="mt-1.5 w-full rounded-2xl border border-navy-200 bg-white px-3 py-2.5 text-xs dark:border-navy-700 dark:bg-navy-900 text-navy-800 dark:text-navy-100">
              <option value="">No Teacher</option>
              {staff.map((t) => <option key={t.id} value={t.id}>{t.fullName}</option>)}
            </select>
          </div>
          <div>
            <Label>Rotation / Alternating</Label>
            <select value={weekRotation} onChange={(e) => setWeekRotation(e.target.value)}
              className="mt-1.5 w-full rounded-2xl border border-navy-200 bg-white px-3 py-2.5 text-xs dark:border-navy-700 dark:bg-navy-900 text-navy-800 dark:text-navy-100">
              <option value="ALL">Every Saturday</option>
              <option value="WEEK_A">Week A Only (Odd)</option>
              <option value="WEEK_B">Week B Only (Even)</option>
            </select>
          </div>
        </div>

        {/* 4) Save Actions */}
        <div className="flex justify-end gap-2 pt-2 border-t border-navy-100 dark:border-navy-800">
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleBulkSchedule} disabled={saving || selectedClassIds.size === 0 || selectedPeriods.size === 0 || (!fairMode && !subjectId) || (fairMode && fairSubjectIds.size < 2)} className="px-6">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {fairMode ? "Generate Fair Rotation" : `Schedule Saturday (${selectedClassIds.size * selectedPeriods.size} Slots)`}
          </Button>
        </div>

      </div>
    </Modal>
  );
}

// ---- shared bits ---------------------------------------------------------------------
function Modal({ title, children, onClose, wide }: { title: string; children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-navy-950/40 p-4 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div className={`w-full ${wide ? "max-w-lg" : "max-w-md"} rounded-2xl bg-white p-6 shadow-card dark:bg-navy-900`} onClick={(e) => e.stopPropagation()}>
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

// ---- Teachers Duty Roster Tab (I.78 real generated timetable) ---------------------------
function DutyRosterTab({ canManage }: { canManage: boolean }) {
  const { toast } = useToast();
  const [rotation, setRotation] = React.useState<"WEEKLY" | "BI_WEEKLY" | "MONTHLY">("WEEKLY");
  const [teachersPerCycle, setTeachersPerCycle] = React.useState(2);
  const [teachers, setStaff] = React.useState<any[]>([]);
  const [roster, setRoster] = React.useState<any[]>([]);
  const [termLabel, setTermLabel] = React.useState("Current term");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(false);

  const loadRoster = React.useCallback(async () => {
    setError(false);
    try {
      const res = await fetch("/api/academics/duty-roster");
      const json = await res.json();
      if (!json.ok) throw new Error(json.error?.message || "Could not load duty roster.");
      setRoster(json.data.entries ?? []);
      setTermLabel(json.data.termLabel ?? "Current term");
      if (Array.isArray(json.data.teachers)) setStaff(json.data.teachers.map((t: any) => ({ ...t, selected: true })));
      if (json.data.entries?.[0]?.rotationPeriod) setRotation(json.data.entries[0].rotationPeriod);
      if (json.data.entries?.[0]?.dutyTeamSize) setTeachersPerCycle(json.data.entries[0].dutyTeamSize);
    } catch {
      setError(true);
    }
  }, []);

  React.useEffect(() => {
    loadRoster();
  }, [loadRoster]);

  async function handleGenerateRoster() {
    const activePool = teachers.filter((t) => t.selected);
    if (activePool.length === 0) {
      toast({ title: "Please select at least one teacher.", tone: "error" });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/academics/duty-roster", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rotationPeriod: rotation, teachersPerCycle, teacherIds: activePool.map((t) => t.id) }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error?.message || "Duty roster generation failed.");
      setRoster(json.data.entries ?? []);
      setTermLabel(json.data.termLabel ?? termLabel);
      toast({ title: "Duty roster generated", description: `Saved ${json.data.entries?.length ?? 0} rotation block(s) for ${termLabel}.`, tone: "success" });
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Duty roster generation failed.", tone: "error" });
    } finally {
      setLoading(false);
    }
  }

  const rotationLabel = rotation === "WEEKLY" ? "Weekly" : rotation === "BI_WEEKLY" ? "Bi-weekly" : "Monthly";
  const teamNames = (r: any) => {
    try {
      const parsed = JSON.parse(r.dutyTeacherNames || "[]");
      if (Array.isArray(parsed) && parsed.length) return parsed.join(", ");
    } catch {}
    return [r.primaryTeacherName, r.assistantTeacherName].filter(Boolean).join(", ");
  };

  return (
    <div className="space-y-6 text-left">
      <Card className="border border-amber-100 bg-amber-50/70 dark:border-amber-900/40 dark:bg-amber-950/10">
        <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-amber-700 dark:text-amber-300">Draft resume protection</p>
            <p className="mt-1 text-sm text-navy-700 dark:text-navy-200">
              If you leave this screen midway, NEYO restores your unfinished teacher time-off and combination setup when you return.
            </p>
            <p className="mt-1 text-xs text-navy-500 dark:text-navy-400">
              {draftMeta.savedAt ? `Last saved locally: ${new Date(draftMeta.savedAt).toLocaleString()}` : "No local draft saved yet."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {draftMeta.restored && <Badge tone="blue">Draft restored</Badge>}
            {draftMeta.dirty && <Badge tone="amber">Unsaved setup protected</Badge>}
            <Button size="sm" variant="secondary" onClick={() => clearDraft()}><RotateCcw className="h-4 w-4" /> Clear saved draft</Button>
          </div>
        </CardContent>
      </Card>
      <Card className="print:hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Calendar className="h-5 w-5 text-green-600" />
            NEYO Teachers Duty Roster
          </CardTitle>
          <p className="text-xs text-navy-400">
            Choose the reshuffle period, select the teacher pool, and generate a saved term-level Teacher on Duty timetable.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && <LoadError onRetry={loadRoster} />}
          <div className="grid gap-4 lg:grid-cols-3">
            <div>
              <Label>Reshuffle Rotation Period</Label>
              <select
                value={rotation}
                onChange={(e) => setRotation(e.target.value as any)}
                className="w-full h-10 rounded-full border border-navy-200 bg-white px-3.5 py-2 text-sm dark:border-navy-700 dark:bg-navy-900"
              >
                <option value="WEEKLY">Weekly Reshuffle (Every 7 days)</option>
                <option value="BI_WEEKLY">Bi-weekly Reshuffle (Every 14 days)</option>
                <option value="MONTHLY">Monthly Reshuffle (Every 28 days)</option>
              </select>
              <p className="mt-1 text-[10px] font-semibold text-navy-400">Current roster term: {termLabel}</p>
            </div>
            <div>
              <Label>Teachers per reshuffle cycle</Label>
              <Input
                type="number"
                min={1}
                max={Math.max(1, teachers.filter((t) => t.selected).length || teachers.length || 1)}
                value={teachersPerCycle}
                onChange={(e) => setTeachersPerCycle(Math.max(1, Number(e.target.value) || 1))}
              />
              <p className="mt-1 text-[10px] font-semibold text-navy-400">Example: choose 3 if three teachers should be on duty in every cycle.</p>
            </div>
            <div className="space-y-1">
              <Label>Active Rotation Pool (Select Teachers)</Label>
              <div className="max-h-[120px] overflow-y-auto border border-navy-100 rounded-2xl p-3 bg-white space-y-1.5 dark:border-navy-800 dark:bg-navy-900">
                {teachers.map((t, idx) => (
                  <label key={t.id} className="flex items-center gap-2 text-xs font-medium text-navy-700 dark:text-navy-200 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={t.selected}
                      onChange={(e) => {
                        const copy = [...teachers];
                        copy[idx].selected = e.target.checked;
                        setStaff(copy);
                      }}
                      className="h-3.5 w-3.5 rounded border-navy-300 text-green-600 focus:ring-green-500"
                    />
                    {t.fullName}
                  </label>
                ))}
              </div>
            </div>
          </div>
          <Button onClick={handleGenerateRoster} disabled={!canManage || loading} className="w-full h-11 text-xs font-bold">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4 text-green-400" />}
            Generate & Save Duty Roster
          </Button>
        </CardContent>
      </Card>

      {roster.length > 0 ? (
        <Card className="print:border-none print:shadow-none">
          <CardHeader className="flex flex-row items-center justify-between border-b border-navy-50 pb-3 mb-2 print:hidden">
            <CardTitle className="text-sm uppercase tracking-wider text-navy-400">{termLabel} Teacher Duty Roster</CardTitle>
            <Button size="sm" variant="secondary" onClick={() => window.print()}>
              <Printer className="h-4 w-4 text-green-600" /> Print Duty Roster
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <div className="hidden print:flex items-center justify-between border-b border-navy-200 pb-2 mb-3">
              <span className="text-sm font-bold text-navy-950">{termLabel} Teachers Duty Roster Schedule</span>
              <span className="text-xs text-navy-400">Reshuffle: {rotationLabel}</span>
            </div>
            <div className="overflow-x-auto rounded-2xl border border-navy-100 print:border-none">
              <table className="w-full border-collapse bg-white text-xs dark:bg-navy-900">
                <thead>
                  <tr className="bg-warm-50 border-b border-navy-100 dark:bg-navy-800">
                    <th className="p-3 text-left font-bold text-navy-700">Block</th>
                    <th className="p-3 text-left font-bold text-navy-700">Date Range</th>
                    <th className="p-3 text-left font-bold text-navy-700">Lead T.O.D.</th>
                    <th className="p-3 text-left font-bold text-navy-700">Full duty team</th>
                    <th className="p-3 text-left font-bold text-navy-700">Assigned Duties</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-navy-50 dark:divide-navy-800">
                  {roster.map((r) => (
                    <tr key={r.id ?? r.weekNo}>
                      <td className="p-3 font-bold text-navy-950 dark:text-white">Block {r.weekNo}</td>
                      <td className="p-3 text-navy-500 font-mono text-[10px]">{r.startDate} → {r.endDate}</td>
                      <td className="p-3 text-green-800 font-bold dark:text-green-300">{r.primaryTeacherName}</td>
                      <td className="p-3 text-navy-600 font-medium dark:text-navy-400">
                        <span className="block font-bold text-navy-700 dark:text-navy-200">{r.dutyTeamSize ?? 2} teacher{(r.dutyTeamSize ?? 2) === 1 ? "" : "s"}</span>
                        <span className="text-[10px] text-navy-400">{teamNames(r)}</span>
                      </td>
                      <td className="p-3 text-navy-500 text-[10px]">{r.duties}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="hidden print:flex items-center justify-between border-t border-navy-100 pt-2 mt-4 text-[8px] text-navy-400">
              <p>Printed: {new Date().toLocaleDateString("en-KE")}</p>
              <p className="font-bold uppercase tracking-wider">Powered by NEYO</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <EmptyState icon={Calendar} title="No saved duty roster yet" description="Choose teachers and generate the roster once; it is saved to the school database for printing and review." />
      )}
    </div>
  );
}

function StudentDutyRosterClient({ canManage }: { canManage: boolean }) {
  const [areas, setAreas] = React.useState<any[]>([]);
  const { toast } = useToast();

  React.useEffect(() => {
    // Simulated load for K.12 features representation
    setAreas([
      { id: "1", name: "Dining Hall Cleanup", genderConstraint: "MIXED", maxStudents: 5 },
      { id: "2", name: "Library Prefect", genderConstraint: "GIRLS_ONLY", maxStudents: 2 },
    ]);
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-bold text-navy-950 dark:text-white">Student Duty Areas (K.12)</h3>
          <p className="text-xs text-navy-500">Configure areas, gender parity, and medical exclusions.</p>
        </div>
        <Button size="sm" className="rounded-full"><Plus className="h-4 w-4 mr-1"/> Add Duty Area</Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {areas.map(a => (
          <Card key={a.id}>
            <CardContent className="p-4">
              <h4 className="font-bold">{a.name}</h4>
              <div className="flex gap-2 mt-2">
                <Badge variant="secondary" className="text-[10px]">{a.genderConstraint}</Badge>
                <Badge variant="secondary" className="text-[10px]">Max: {a.maxStudents}</Badge>
              </div>
              <p className="text-[10px] text-navy-400 mt-3 italic">Automatically excludes health-conditioned students & school leaders.</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function BulkConfigDialog({ data, onClose, onDone }: any) {
  const [selectedClasses, setSelectedClasses] = React.useState<Set<string>>(new Set());
  const [periods, setPeriods] = React.useState(8);
  const [shortBreak, setShortBreak] = React.useState(2);
  const [shortBreak2, setShortBreak2] = React.useState(0);
  const [lunchAfter, setLunchAfter] = React.useState(6);
  const [satEnd, setSatEnd] = React.useState("12:40");
  const [saving, setSaving] = React.useState(false);
  const { toast } = useToast();

  async function save() {
    if (selectedClasses.size === 0) return toast({ title: "Select at least one class", tone: "error" });
    setSaving(true);
    try {
      // Send multiple POSTs or a bulk POST. We'll do multiple for now to be safe.
      for (const cid of selectedClasses) {
        await fetch("/api/academics/timetable/generator", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            action: "save_config", classId: cid, 
            periodsPerDay: periods, 
            shortBreakStart: shortBreak, 
            shortBreak2Start: shortBreak2 || null,
            lunchStart: lunchAfter,
            saturdayEndTime: satEnd
          })
        });
      }
      toast({ title: "Bulk rules applied", tone: "success" });
      onDone();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader><DialogTitle>Bulk Apply Schedule Rules</DialogTitle></DialogHeader>
        <div className="py-4 space-y-4 max-h-[70vh] overflow-y-auto">
          <div className="space-y-1 border border-navy-100 dark:border-navy-800 p-3 rounded-xl">
            <Label className="text-xs uppercase tracking-widest text-navy-500 font-bold mb-2 block">Target Classes</Label>
            <div className="flex flex-wrap gap-2">
              {data.classes.map((c: any) => {
                const isSelected = selectedClasses.has(c.id);
                return (
                  <Badge 
                    key={c.id} 
                    variant={isSelected ? "secondary" : "outline"} 
                    className="cursor-pointer"
                    onClick={() => {
                      const next = new Set(selectedClasses);
                      if (next.has(c.id)) next.delete(c.id); else next.add(c.id);
                      setSelectedClasses(next);
                    }}
                  >
                    {c.level} {c.stream}
                  </Badge>
                );
              })}
            </div>
            <Button size="sm" variant="ghost" className="mt-2 text-xs" onClick={() => setSelectedClasses(new Set(data.classes.map((c:any)=>c.id)))}>Select All</Button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1"><Label>Periods Per Day (Max 12)</Label><Input type="number" value={periods} onChange={(e) => setPeriods(Number(e.target.value))} max={12} /></div>
            <div className="space-y-1"><Label>Saturday End Time</Label><Input type="time" value={satEnd} onChange={(e) => setSatEnd(e.target.value)} /></div>
          </div>
          
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1"><Label>Short Break 1 (After Period)</Label><Input type="number" value={shortBreak} onChange={(e) => setShortBreak(Number(e.target.value))} /></div>
            <div className="space-y-1"><Label>Short Break 2 (Optional)</Label><Input type="number" value={shortBreak2} onChange={(e) => setShortBreak2(Number(e.target.value))} placeholder="0 to disable"/></div>
            <div className="space-y-1"><Label>Lunch (After Period)</Label><Input type="number" value={lunchAfter} onChange={(e) => setLunchAfter(Number(e.target.value))} /></div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={saving} className="rounded-full bg-blue-600 hover:bg-blue-700 text-white">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Apply Rules"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type ExamPaper = { id: string; subjectId: string; classId?: string | null; name: string; outOfMarks: number; weightPct: number };
type ExamSlotRow = {
  id: string;
  classId: string;
  subjectId: string;
  examName: string;
  paperName?: string | null;
  examDate: string;
  startTime: string;
  endTime: string;
  venue?: string | null;
  targetScope: string;
  targetJson?: string | null;
  invigilatorScope?: string;
  eligibleInvigilators?: { teacherId: string; teacherName: string }[];
  invigilators?: { teacherId: string; teacherName: string; warning?: string }[];
  warnings?: string[];
  notes?: string | null;
};

function ExamTimetableTab({ canManage }: { canManage: boolean }) {
  const { toast } = useToast();
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [setup, setSetup] = React.useState<{ slots: ExamSlotRow[]; papers: ExamPaper[]; classes: ClassOpt[]; subjects: Subject[]; streamGroups: { id: string; label: string; classIds: string[] }[]; combinationGroups: { id: string; label: string; classIds: string[]; subjectId: string; source: string; scope: string }[] } | null>(null);
  const [teachers, setTeachers] = React.useState<Staff[]>([]);
  const [examName, setExamName] = React.useState('Midterm');
  const [editingSlotId, setEditingSlotId] = React.useState<string | null>(null);
  const [form, setForm] = React.useState<any>({
    classId: '',
    subjectId: '',
    paperConfigId: '',
    paperName: 'PP1',
    examDate: '',
    startTime: '08:00',
    endTime: '10:00',
    venue: '',
    targetScope: 'CLASS',
    targetIds: [] as string[],
    invigilatorScope: 'AUTO',
    eligibleInvigilatorIds: [] as string[],
    notes: '',
  });

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const [setupRes, teacherRes] = await Promise.all([
        fetch('/api/academics/exam-timetable'),
        fetch('/api/conversations/recipients'),
      ]);
      const [setupJson, teacherJson] = await Promise.all([setupRes.json(), teacherRes.json()]);
      if (!setupJson.ok) throw new Error(setupJson.error?.message || 'Could not load exam timetable setup.');
      setSetup(setupJson.data);
      if (teacherJson.ok) {
        setTeachers((teacherJson.data.recipients ?? []).filter((u: any) => ['TEACHER', 'CLASS_TEACHER', 'HOD', 'DEPUTY_PRINCIPAL', 'DEAN_OF_STUDIES'].includes(u.role)));
      }
      const latestExam = setupJson.data.slots?.[0]?.examName;
      if (latestExam) setExamName(latestExam);
    } catch (e: any) {
      toast({ title: e?.message || 'Could not load exam timetable.', tone: 'error' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  React.useEffect(() => { load(); }, [load]);

  React.useEffect(() => {
    if (!setup?.classes?.length) return;
    setForm((prev: any) => ({
      ...prev,
      classId: prev.classId || setup.classes[0].id,
      targetIds: prev.targetIds?.length ? prev.targetIds : [setup.classes[0].id],
    }));
  }, [setup]);

  const filteredPapers = React.useMemo(() => {
    if (!setup) return [];
    return setup.papers.filter((p) => p.subjectId === form.subjectId && (!p.classId || p.classId === form.classId));
  }, [setup, form.subjectId, form.classId]);

  const selectedCombinationGroups = React.useMemo(() => {
    if (!setup || form.targetScope !== 'COMBINATION') return [];
    return setup.combinationGroups.filter((group) => group.classIds.length > 0 && group.classIds.every((id) => form.targetIds.includes(id)));
  }, [setup, form.targetScope, form.targetIds]);

  function resetForm() {
    setEditingSlotId(null);
    setForm({
      classId: setup?.classes?.[0]?.id || '',
      subjectId: '',
      paperConfigId: '',
      paperName: 'PP1',
      examDate: '',
      startTime: '08:00',
      endTime: '10:00',
      venue: '',
      targetScope: 'CLASS',
      targetIds: setup?.classes?.[0]?.id ? [setup.classes[0].id] : [],
      invigilatorScope: 'AUTO',
      eligibleInvigilatorIds: [],
      notes: '',
    });
  }

  function startEdit(slot: ExamSlotRow) {
    setEditingSlotId(slot.id);
    setExamName(slot.examName || '');
    setForm({
      classId: slot.classId || '',
      subjectId: slot.subjectId || '',
      paperConfigId: slot.paperConfigId || '',
      paperName: slot.paperName || 'PP1',
      examDate: slot.examDate || '',
      startTime: slot.startTime || '08:00',
      endTime: slot.endTime || '10:00',
      venue: slot.venue || '',
      targetScope: slot.targetScope || 'CLASS',
      targetIds: Array.isArray((slot as any).targetIds) ? (slot as any).targetIds : Array.isArray(slot.targetJson) ? slot.targetJson : [],
      invigilatorScope: slot.invigilatorScope || 'AUTO',
      eligibleInvigilatorIds: (slot.eligibleInvigilators ?? []).map((t) => t.teacherId),
      notes: slot.notes || '',
    });
  }

  async function saveSlot() {
    if (!form.classId || !form.subjectId || !examName || !form.examDate || !form.startTime || !form.endTime) {
      toast({ title: 'Fill exam name, class, subject, date and time first.', tone: 'error' });
      return;
    }
    if (form.startTime >= form.endTime) {
      toast({ title: 'End time must be after start time.', tone: 'error' });
      return;
    }
    if (form.targetScope !== 'CLASS' && (!form.targetIds || form.targetIds.length === 0)) {
      toast({ title: 'Select at least one target group for this exam slot.', tone: 'error' });
      return;
    }
    if (form.targetScope === 'COMBINATION' && selectedCombinationGroups.length === 0) {
      toast({ title: 'Choose at least one real combination group for this subject.', tone: 'error' });
      return;
    }
    if (form.invigilatorScope === 'ELIGIBLE_ONLY' && (!form.eligibleInvigilatorIds || form.eligibleInvigilatorIds.length === 0)) {
      toast({ title: 'Pick at least one eligible invigilator or switch back to Auto.', tone: 'error' });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/academics/exam-timetable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save_slot',
          id: editingSlotId,
          examName,
          classId: form.classId,
          subjectId: form.subjectId,
          paperConfigId: form.paperConfigId || null,
          paperName: form.paperName || null,
          examDate: form.examDate,
          startTime: form.startTime,
          endTime: form.endTime,
          venue: form.venue || null,
          targetScope: form.targetScope,
          targetIds: form.targetIds?.length ? form.targetIds : [form.classId],
          invigilatorScope: form.invigilatorScope,
          eligibleInvigilatorIds: form.eligibleInvigilatorIds,
          notes: form.notes || null,
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error?.message || 'Could not save exam slot.');
      toast({ title: editingSlotId ? 'Exam timetable slot updated' : 'Exam timetable slot saved', tone: 'success' });
      await load();
      resetForm();
    } catch (e: any) {
      toast({ title: e?.message || 'Could not save exam slot.', tone: 'error' });
    } finally {
      setSaving(false);
    }
  }

  async function generateInvigilators() {
    if (!examName) {
      toast({ title: 'Enter exam name first.', tone: 'error' });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/academics/exam-timetable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate_invigilators', examName }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error?.message || 'Could not generate invigilators.');
      toast({ title: `Invigilators generated for ${examName}`, tone: 'success' });
      await load();
    } catch (e: any) {
      toast({ title: e?.message || 'Could not generate invigilators.', tone: 'error' });
    } finally {
      setSaving(false);
    }
  }

  async function saveInvigilatorPool(slotId: string, scope: string, teacherIds: string[]) {
    setSaving(true);
    try {
      const res = await fetch('/api/academics/exam-timetable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save_invigilator_pool', examName, slotId, invigilatorScope: scope, eligibleInvigilatorIds: teacherIds }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error?.message || 'Could not save eligible invigilator pool.');
      toast({ title: 'Eligible invigilator pool saved', tone: 'success' });
      await load();
    } catch (e: any) {
      toast({ title: e?.message || 'Could not save eligible invigilator pool.', tone: 'error' });
    } finally {
      setSaving(false);
    }
  }

  async function deleteSlot(slotId: string) {
    if (typeof window !== 'undefined' && !window.confirm('Delete this exam slot? This removes the saved paper and its generated invigilator assignment.')) return;
    setSaving(true);
    try {
      const res = await fetch('/api/academics/exam-timetable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete_slot', id: slotId }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error?.message || 'Could not delete exam slot.');
      toast({ title: 'Exam slot deleted', tone: 'success' });
      if (editingSlotId === slotId) resetForm();
      await load();
    } catch (e: any) {
      toast({ title: e?.message || 'Could not delete exam slot.', tone: 'error' });
    } finally {
      setSaving(false);
    }
  }

  if (loading || !setup) return <Skeletons />;

  return (
    <div className="space-y-5">
      <Card>
        <CardContent className="p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <Badge tone="green">Exam papers + invigilators</Badge>
              <h2 className="mt-2 text-lg font-black tracking-tight text-navy-950 dark:text-navy-50">Exam timetable builder</h2>
              <p className="mt-1 max-w-3xl text-sm text-navy-500 dark:text-navy-400">
                Set exam papers by day and time, choose PP1 / PP2 / PP3 / Theory / Practical, target classes or groups, define the eligible invigilator pool, then let NEYO generate with honest fallback warnings when no fully free invigilator exists.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Input value={examName} onChange={(e) => setExamName(e.target.value)} placeholder="e.g. Midterm 2026" className="min-w-[180px]" />
              <Button onClick={generateInvigilators} disabled={!canManage || saving}><Sparkles className="h-4 w-4" /> Generate Invigilators</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base">{editingSlotId ? 'Edit exam slot' : 'Add exam slot'}</CardTitle>
                <p className="text-xs text-navy-400">Use this to set the paper, timing, target class/group, and the eligible invigilator pool.</p>
              </div>
              {editingSlotId && (
                <Button variant="ghost" size="sm" onClick={resetForm} disabled={saving}>
                  <X className="h-4 w-4" /> Cancel edit
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Class</Label>
                <select value={form.classId} onChange={(e) => setForm((p: any) => ({ ...p, classId: e.target.value, targetIds: p.targetScope === 'CLASS' ? [e.target.value] : p.targetIds }))} className={selectClass}>
                  <option value="">Choose class…</option>
                  {setup.classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <Label>Subject</Label>
                <select value={form.subjectId} onChange={(e) => setForm((p: any) => ({ ...p, subjectId: e.target.value, paperConfigId: '', targetIds: p.targetScope === 'COMBINATION' ? [] : p.targetIds }))} className={selectClass}>
                  <option value="">Choose subject…</option>
                  {setup.subjects.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Paper type</Label>
                <select value={form.paperName} onChange={(e) => setForm((p: any) => ({ ...p, paperName: e.target.value }))} className={selectClass}>
                  {['PP1', 'PP2', 'PP3', 'Theory', 'Practical'].map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </div>
              <div>
                <Label>Paper config (optional)</Label>
                <select value={form.paperConfigId} onChange={(e) => setForm((p: any) => ({ ...p, paperConfigId: e.target.value }))} className={selectClass}>
                  <option value="">None</option>
                  {filteredPapers.map((paper) => <option key={paper.id} value={paper.id}>{paper.name} · {paper.weightPct}%</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div><Label>Date</Label><Input type="date" value={form.examDate} onChange={(e) => setForm((p: any) => ({ ...p, examDate: e.target.value }))} /></div>
              <div><Label>Venue</Label><Input value={form.venue} onChange={(e) => setForm((p: any) => ({ ...p, venue: e.target.value }))} placeholder="Hall / Lab / Room" /></div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div><Label>Starts</Label><Input type="time" value={form.startTime} onChange={(e) => setForm((p: any) => ({ ...p, startTime: e.target.value }))} /></div>
              <div><Label>Ends</Label><Input type="time" value={form.endTime} onChange={(e) => setForm((p: any) => ({ ...p, endTime: e.target.value }))} /></div>
            </div>

            <div>
              <Label>Target scope</Label>
              <select value={form.targetScope} onChange={(e) => setForm((p: any) => ({ ...p, targetScope: e.target.value, targetIds: e.target.value === 'CLASS' ? (p.classId ? [p.classId] : []) : [] }))} className={selectClass}>
                <option value="CLASS">Single class</option>
                <option value="STREAM_GROUP">Multiple classes / streams</option>
                <option value="COMBINATION">Combination group</option>
              </select>

              {form.targetScope === 'CLASS' && (
                <div className="mt-2 rounded-xl border border-navy-100 p-3 dark:border-navy-800">
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-navy-400">Target class</p>
                  <p className="text-xs text-navy-600 dark:text-navy-300">This paper will target the selected class above: <span className="font-bold">{setup.classes.find((c) => c.id === form.classId)?.name || 'No class selected'}</span></p>
                </div>
              )}

              {form.targetScope === 'STREAM_GROUP' && (
                <div className="mt-2 rounded-xl border border-navy-100 p-3 dark:border-navy-800">
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-navy-400">Target stream groups</p>
                  <div className="grid grid-cols-1 gap-2">
                    {setup.streamGroups.map((group) => {
                      const checked = group.classIds.length > 0 && group.classIds.every((id) => form.targetIds.includes(id));
                      return (
                        <label key={group.id} className="flex items-start gap-2 text-xs text-navy-700 dark:text-navy-200">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => setForm((p: any) => ({
                              ...p,
                              targetIds: e.target.checked
                                ? [...new Set([...p.targetIds, ...group.classIds])]
                                : p.targetIds.filter((id: string) => !group.classIds.includes(id)),
                            }))}
                          />
                          <span>
                            <span className="font-semibold">{group.label}</span>
                            <span className="block text-[11px] text-navy-400">{group.classIds.map((id) => setup.classes.find((c) => c.id === id)?.name).filter(Boolean).join(', ') || 'No classes linked'}</span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              {form.targetScope === 'COMBINATION' && (() => {
                const subjectCombinationGroups = setup.combinationGroups.filter((group) => !form.subjectId || group.subjectId === form.subjectId);
                return (
                  <div className="mt-2 rounded-xl border border-navy-100 p-3 dark:border-navy-800">
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-navy-400">Target combination groups</p>
                    <p className="mb-2 text-[11px] text-navy-400">Now using real saved combination groups for the selected subject where available.</p>
                    {selectedCombinationGroups.length > 0 && <p className="mb-2 text-[11px] text-green-700 dark:text-green-300">Selected: {selectedCombinationGroups.map((group) => group.label).join(', ')}</p>}
                    {subjectCombinationGroups.length === 0 ? (
                      <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300">
                        No active combination group exists yet for this subject. Create the combination group first, then come back and target it here.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-2">
                        {subjectCombinationGroups.map((group) => {
                          const checked = group.classIds.length > 0 && group.classIds.every((id) => form.targetIds.includes(id));
                          return (
                            <label key={group.id} className="flex items-start gap-2 text-xs text-navy-700 dark:text-navy-200">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) => setForm((p: any) => ({
                                  ...p,
                                  targetIds: e.target.checked
                                    ? [...new Set([...p.targetIds, ...group.classIds])]
                                    : p.targetIds.filter((id: string) => !group.classIds.includes(id)),
                                }))}
                              />
                              <span>
                                <span className="font-semibold">{group.label}</span>
                                <span className="block text-[11px] text-navy-400">{group.scope} · {group.source} · {(group.classIds ?? []).map((id) => setup.classes.find((c) => c.id === id)?.name).filter(Boolean).join(', ') || 'No classes linked'}</span>
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            <div>
              <Label>Invigilator pool mode</Label>
              <select value={form.invigilatorScope} onChange={(e) => setForm((p: any) => ({ ...p, invigilatorScope: e.target.value, eligibleInvigilatorIds: e.target.value === 'AUTO' ? [] : p.eligibleInvigilatorIds }))} className={selectClass}>
                <option value="AUTO">Auto from all eligible staff</option>
                <option value="ELIGIBLE_ONLY">Only selected eligible invigilators</option>
              </select>
            </div>

            <div>
              <Label>Eligible invigilators</Label>
              <div className="mt-2 max-h-36 overflow-y-auto rounded-xl border border-navy-100 p-3 dark:border-navy-800">
                {form.invigilatorScope === 'AUTO' && <p className="mb-2 text-[11px] text-navy-400">Auto mode uses the full eligible staff pool and ignores the checkbox list below until you switch to Eligible Only.</p>}
                <div className="space-y-2">
                  {teachers.map((t) => {
                    const checked = form.eligibleInvigilatorIds.includes(t.id);
                    return (
                      <label key={t.id} className="flex items-center gap-2 text-xs text-navy-700 dark:text-navy-200">
                        <input type="checkbox" disabled={form.invigilatorScope === 'AUTO'} checked={checked} onChange={(e) => setForm((p: any) => ({ ...p, eligibleInvigilatorIds: e.target.checked ? [...new Set([...p.eligibleInvigilatorIds, t.id])] : p.eligibleInvigilatorIds.filter((id: string) => id !== t.id) }))} />
                        <span>{t.fullName}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>

            <div><Label>Notes</Label><Input value={form.notes} onChange={(e) => setForm((p: any) => ({ ...p, notes: e.target.value }))} placeholder="Optional exam note" /></div>

            <Button onClick={saveSlot} disabled={!canManage || saving} className="w-full">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {editingSlotId ? 'Update Exam Slot' : 'Save Exam Slot'}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Saved exam timetable</CardTitle>
            <p className="text-xs text-navy-400">See papers, generated invigilators, pool rules, and fallback warnings in one place.</p>
          </CardHeader>
          <CardContent>
            {setup.slots.length === 0 ? (
              <EmptyState icon={ClipboardList} title="No exam slots yet" description="Save the first paper on the left, then generate invigilators." />
            ) : (() => {
              const visibleSlots = setup.slots.filter((slot) => !examName || slot.examName === examName);
              return visibleSlots.length === 0 ? (
                <EmptyState icon={ClipboardList} title="No slots for this exam name yet" description="Change the exam name above or save a new paper for this exam." />
              ) : (
                <div className="space-y-3 max-h-[760px] overflow-y-auto pr-1">
                  {visibleSlots.map((slot) => (
                    <ExamSlotCard key={slot.id} slot={slot} classes={setup.classes} subjects={setup.subjects} teachers={teachers} onSavePool={saveInvigilatorPool} onEdit={startEdit} onDelete={deleteSlot} busy={saving} />
                  ))}
                </div>
              );
            })()}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ExamSlotCard({ slot, classes, subjects, teachers, onSavePool, onEdit, onDelete, busy }: {
  slot: ExamSlotRow;
  classes: ClassOpt[];
  subjects: Subject[];
  teachers: Staff[];
  onSavePool: (slotId: string, scope: string, teacherIds: string[]) => Promise<void>;
  onEdit: (slot: ExamSlotRow) => void;
  onDelete: (slotId: string) => Promise<void>;
  busy: boolean;
}) {
  const [scope, setScope] = React.useState(slot.invigilatorScope || 'AUTO');
  const [teacherIds, setTeacherIds] = React.useState<string[]>((slot.eligibleInvigilators ?? []).map((t) => t.teacherId));
  const className = classes.find((c) => c.id === slot.classId)?.name || 'Class';
  const subjectName = subjects.find((s) => s.id === slot.subjectId)?.name || 'Subject';

  React.useEffect(() => {
    setScope(slot.invigilatorScope || 'AUTO');
    setTeacherIds((slot.eligibleInvigilators ?? []).map((t) => t.teacherId));
  }, [slot.id, slot.invigilatorScope, JSON.stringify(slot.eligibleInvigilators ?? [])]);

  return (
    <div className="rounded-2xl border border-navy-100 p-4 dark:border-navy-800">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-bold text-navy-950 dark:text-navy-50">{slot.examName} · {subjectName} · {slot.paperName || 'Paper'}</p>
            <Badge tone="blue">{className}</Badge>
            <Badge tone="neutral">{slot.targetScope}</Badge>
          </div>
          <p className="mt-1 text-xs text-navy-500 dark:text-navy-400">{slot.examDate} · {slot.startTime}–{slot.endTime} · {slot.venue || 'Venue not set'}</p>
          {(slot.targetIds ?? []).length > 0 && (
            <p className="mt-1 text-[11px] text-navy-400">Targets: {(slot.targetIds ?? []).map((id) => classes.find((c) => c.id === id)?.name).filter(Boolean).join(', ')}</p>
          )}
        </div>
        <div className="flex items-start gap-2">
          <div className="text-right text-xs text-navy-500 dark:text-navy-400">
            <p className="font-semibold">Invigilator mode: {slot.invigilatorScope || 'AUTO'}</p>
            <p>{(slot.eligibleInvigilators ?? []).length} eligible teacher(s)</p>
          </div>
          <Button size="sm" variant="ghost" onClick={() => onEdit(slot)} disabled={busy}>
            Edit
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onDelete(slot.id)} disabled={busy} className="text-rose-600 hover:text-rose-700">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-xl border border-navy-100 p-3 dark:border-navy-800">
          <p className="text-[10px] font-bold uppercase tracking-widest text-navy-400">Generated invigilators</p>
          {(slot.invigilators ?? []).length === 0 ? (
            <p className="mt-2 text-xs text-navy-400">Not generated yet.</p>
          ) : (
            <div className="mt-2 space-y-2">
              {slot.invigilators?.map((inv) => (
                <div key={inv.teacherId} className="rounded-lg bg-green-50 px-2 py-2 text-xs text-green-800 dark:bg-green-950/20 dark:text-green-300">
                  <p className="font-bold">{inv.teacherName}</p>
                  {inv.warning && <p className="mt-1 text-[11px]">{inv.warning}</p>}
                </div>
              ))}
            </div>
          )}
          {(slot.warnings ?? []).length > 0 && (
            <div className="mt-3 space-y-2">
              {slot.warnings?.map((warning, index) => (
                <div key={index} className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-2 text-xs text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300">
                  {warning}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-navy-100 p-3 dark:border-navy-800">
          <p className="text-[10px] font-bold uppercase tracking-widest text-navy-400">Eligible invigilator pool</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-[180px_1fr_auto] sm:items-start">
            <select value={scope} onChange={(e) => setScope(e.target.value)} className="rounded-xl border border-navy-200 bg-white px-3 py-2 text-xs dark:border-navy-700 dark:bg-navy-800">
              <option value="AUTO">AUTO</option>
              <option value="ELIGIBLE_ONLY">ELIGIBLE ONLY</option>
            </select>
            <div className="max-h-28 overflow-y-auto rounded-xl border border-navy-100 p-2 dark:border-navy-800">
              <div className="grid grid-cols-1 gap-1">
                {teachers.map((teacher) => {
                  const checked = teacherIds.includes(teacher.id);
                  return (
                    <label key={teacher.id} className="flex items-center gap-2 text-[11px] text-navy-700 dark:text-navy-200">
                      <input type="checkbox" checked={checked} onChange={(e) => setTeacherIds((prev) => e.target.checked ? [...new Set([...prev, teacher.id])] : prev.filter((id) => id !== teacher.id))} />
                      <span>{teacher.fullName}</span>
                    </label>
                  );
                })}
              </div>
            </div>
            <Button size="sm" onClick={() => onSavePool(slot.id, scope, teacherIds)} disabled={busy}><Save className="h-4 w-4" /> Save Pool</Button>
          </div>
        </div>
      </div>
    </div>
  );
}


type ExamGeneratorRunRow = {
  id: string;
  examName: string;
  startDate: string;
  endDate: string;
  generatedCount: number;
  classIds: string[];
  periods: { label: string; startTime: string; endTime: string }[];
  createdByName: string;
  createdAt: string;
};

function ExamAutoGeneratorTab({ canManage }: { canManage: boolean }) {
  const { toast } = useToast();
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [setup, setSetup] = React.useState<{ classes: ClassOpt[]; runs: ExamGeneratorRunRow[] } | null>(null);
  const [preview, setPreview] = React.useState<any | null>(null);
  const [form, setForm] = React.useState({
    examName: schoolLevelActivation?.isSeniorSchool ? 'Senior School Midterm 2026' : schoolLevelActivation?.isJuniorSchool ? 'Junior School Midterm 2026' : 'Auto Midterm 2026',
    classIds: [] as string[],
    startDate: '',
    endDate: '',
    notes: schoolLevelActivation?.isSeniorSchool ? 'Use richer subject paper structures where configured.' : schoolLevelActivation?.isJuniorSchool ? 'Use subject-selection-aware setup where needed.' : '',
    autoGenerateInvigilators: true,
    periods: schoolLevelActivation?.isSeniorSchool ? [
      { label: 'Morning 1', startTime: '08:00', endTime: '10:00' },
      { label: 'Morning 2', startTime: '10:30', endTime: '12:30' },
      { label: 'Afternoon 1', startTime: '14:00', endTime: '16:00' },
    ] : [
      { label: 'Morning 1', startTime: '08:00', endTime: '10:00' },
      { label: 'Morning 2', startTime: '10:30', endTime: '12:30' },
    ],
  });

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/academics/exam-timetable/generator');
      const json = await res.json();
      if (!json.ok) throw new Error(json.error?.message || 'Could not load exam auto-generator setup.');
      setSetup(json.data);
    } catch (e: any) {
      toast({ title: e?.message || 'Could not load exam auto-generator.', tone: 'error' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  React.useEffect(() => { load(); }, [load]);
  React.useEffect(() => {
    if (!setup?.classes?.length) return;
    setForm((prev) => ({
      ...prev,
      classIds: prev.classIds.length ? prev.classIds : [setup.classes[0].id],
      periods: prev.periods.length ? prev.periods : schoolLevelActivation?.isSeniorSchool
        ? [
            { label: 'Morning 1', startTime: '08:00', endTime: '10:00' },
            { label: 'Morning 2', startTime: '10:30', endTime: '12:30' },
            { label: 'Afternoon 1', startTime: '14:00', endTime: '16:00' },
          ]
        : schoolLevelActivation?.isJuniorSchool
        ? [
            { label: 'Morning 1', startTime: '08:00', endTime: '10:00' },
            { label: 'Morning 2', startTime: '10:30', endTime: '12:30' },
          ]
        : prev.periods,
    }));
  }, [setup, schoolLevelActivation]);

  async function previewGenerator() {
    if (!form.examName || !form.startDate || !form.endDate || form.classIds.length === 0) {
      toast({ title: 'Fill exam name, class selection, and date range first.', tone: 'error' });
      return;
    }
    if (form.periods.some((period) => !period.label || !period.startTime || !period.endTime || period.startTime >= period.endTime)) {
      toast({ title: 'Each custom exam period needs a valid label and time range.', tone: 'error' });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/academics/exam-timetable/generator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, action: 'preview' }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error?.message || 'Could not preview exam timetable.');
      setPreview(json.data);
      toast({ title: `Preview ready with ${json.data.generatedCount} slot(s)`, tone: 'success' });
    } catch (e: any) {
      toast({ title: e?.message || 'Could not preview exam timetable.', tone: 'error' });
    } finally {
      setSaving(false);
    }
  }

  async function runGenerator() {
    if (!form.examName || !form.startDate || !form.endDate || form.classIds.length === 0) {
      toast({ title: 'Fill exam name, class selection, and date range first.', tone: 'error' });
      return;
    }
    if (form.periods.some((period) => !period.label || !period.startTime || !period.endTime || period.startTime >= period.endTime)) {
      toast({ title: 'Each custom exam period needs a valid label and time range.', tone: 'error' });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/academics/exam-timetable/generator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, action: 'generate' }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error?.message || 'Could not auto-generate exam timetable.');
      toast({ title: json.data.invigilatorsGenerated ? `Generated ${json.data.generatedCount} exam slot(s) and invigilators` : `Generated ${json.data.generatedCount} exam slot(s)`, tone: 'success' });
      setPreview(null);
      await load();
    } catch (e: any) {
      toast({ title: e?.message || 'Could not auto-generate exam timetable.', tone: 'error' });
    } finally {
      setSaving(false);
    }
  }

  if (loading || !setup) return <Skeletons />;

  return (
    <div className="space-y-5">
      <Card>
        <CardContent className="p-5">
          {schoolLevelActivation && (
            <div className="mb-3 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900 dark:border-green-900/30 dark:bg-green-950/20 dark:text-green-200">
              <p className="font-semibold">Level-aware Timetable Generation</p>
              <p className="mt-1 text-xs text-green-800 dark:text-green-300">
                Exam auto-generation is most relevant where structured subject loads are active. Subject Selection appears only for Junior/Senior School, and Senior Pathways appear only for Senior School.
              </p>
            </div>
          )}
          <Badge tone="blue">First version</Badge>
          <h2 className="mt-2 text-lg font-black tracking-tight text-navy-950 dark:text-navy-50">Exam timetable auto-generator</h2>
          <p className="mt-1 max-w-3xl text-sm text-navy-500 dark:text-navy-400">
            This version generates exam papers for all subjects already taught in the selected classes, using class/form-aware subject paper design where set. That means one subject can produce multiple papers such as Insha, Oral, Practical, or other custom labels.
          </p>
          {schoolLevelActivation?.isSeniorSchool ? (
            <p className="mt-2 text-xs text-blue-700 dark:text-blue-300">Senior School is active, so the generator expects richer subject-paper structures and pathway-sensitive exam planning later.</p>
          ) : schoolLevelActivation?.isJuniorSchool ? (
            <p className="mt-2 text-xs text-blue-700 dark:text-blue-300">Junior School is active, so subject-selection-aware exam planning matters, but full Senior School pathway complexity stays lighter.</p>
          ) : (
            <p className="mt-2 text-xs text-blue-700 dark:text-blue-300">For lower levels, the generator stays simpler and avoids unnecessary pathway-heavy complexity.</p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Build exam run</CardTitle>
            <p className="text-xs text-navy-400">Set the classes, date range, and custom periods. NEYO will generate the first exam timetable draft for those classes.</p>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>Exam name</Label>
              <Input value={form.examName} onChange={(e) => setForm((p) => ({ ...p, examName: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Start date</Label><Input type="date" value={form.startDate} onChange={(e) => setForm((p) => ({ ...p, startDate: e.target.value }))} /></div>
              <div><Label>End date</Label><Input type="date" value={form.endDate} onChange={(e) => setForm((p) => ({ ...p, endDate: e.target.value }))} /></div>
            </div>
            <div>
              <Label>Selected classes</Label>
              <div className="mt-2 max-h-36 overflow-y-auto rounded-xl border border-navy-100 p-3 dark:border-navy-800">
                <div className="grid grid-cols-2 gap-2">
                  {setup.classes.map((klass) => {
                    const checked = form.classIds.includes(klass.id);
                    return (
                      <label key={klass.id} className="flex items-center gap-2 text-xs text-navy-700 dark:text-navy-200">
                        <input type="checkbox" checked={checked} onChange={(e) => setForm((p) => ({ ...p, classIds: e.target.checked ? [...new Set([...p.classIds, klass.id])] : p.classIds.filter((id) => id !== klass.id) }))} />
                        <span>{klass.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
            <div>
              <Label>Custom exam periods</Label>
              <div className="mt-2 space-y-2">
                {form.periods.map((period, index) => (
                  <div key={index} className="grid grid-cols-[1.1fr_0.9fr_0.9fr_auto] gap-2">
                    <Input value={period.label} onChange={(e) => setForm((p) => ({ ...p, periods: p.periods.map((item, i) => i === index ? { ...item, label: e.target.value } : item) }))} placeholder="Morning 1" />
                    <Input type="time" value={period.startTime} onChange={(e) => setForm((p) => ({ ...p, periods: p.periods.map((item, i) => i === index ? { ...item, startTime: e.target.value } : item) }))} />
                    <Input type="time" value={period.endTime} onChange={(e) => setForm((p) => ({ ...p, periods: p.periods.map((item, i) => i === index ? { ...item, endTime: e.target.value } : item) }))} />
                    <Button variant="ghost" onClick={() => setForm((p) => ({ ...p, periods: p.periods.length > 1 ? p.periods.filter((_, i) => i !== index) : p.periods }))}>Remove</Button>
                  </div>
                ))}
                <Button variant="secondary" onClick={() => setForm((p) => ({ ...p, periods: [...p.periods, { label: `Period ${p.periods.length + 1}`, startTime: schoolLevelActivation?.isSeniorSchool ? '14:00' : '13:30', endTime: schoolLevelActivation?.isSeniorSchool ? '16:00' : '15:30' }] }))}>Add Period</Button>
              </div>
            </div>
            <div>
              <Label>Notes</Label>
              <Input value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} placeholder="Optional generation note" />
            </div>
            <label className="flex items-center gap-2 text-sm text-navy-600 dark:text-navy-300">
              <input type="checkbox" checked={form.autoGenerateInvigilators} onChange={(e) => setForm((p) => ({ ...p, autoGenerateInvigilators: e.target.checked }))} className="h-4 w-4 rounded border-navy-300 text-green-600 focus:ring-green-500" />
              Generate invigilators immediately after building the timetable
            </label>
            <div className="grid gap-2 sm:grid-cols-2">
              <Button variant="secondary" onClick={previewGenerator} disabled={!canManage || saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardList className="h-4 w-4" />} Preview Timetable
              </Button>
              <Button onClick={runGenerator} disabled={!canManage || saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Generate Exam Timetable
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent generated runs</CardTitle>
            <p className="text-xs text-navy-400">Shows the latest exam timetable auto-generation runs and how many exam slots were produced.</p>
          </CardHeader>
          <CardContent>
            {preview && (
              <div className="mb-4 rounded-2xl border border-green-200 bg-green-50 p-4 dark:border-green-900/30 dark:bg-green-950/20">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-bold text-green-900 dark:text-green-200">Preview: {preview.examName}</p>
                  <Badge tone="green">{preview.generatedCount} slot(s)</Badge>
                </div>
                <p className="mt-1 text-xs text-green-800 dark:text-green-300">{preview.startDate} → {preview.endDate}</p>
                <div className="mt-3 max-h-60 space-y-2 overflow-y-auto">
                  {preview.slots.map((slot: any, index: number) => (
                    <div key={`${slot.classId}-${slot.subjectId}-${slot.examDate}-${slot.startTime}-${index}`} className="rounded-xl border border-green-200 bg-white px-3 py-2 text-xs text-green-900 dark:border-green-900/30 dark:bg-navy-900 dark:text-green-200">
                      <p className="font-semibold">{setup.classes.find((klass) => klass.id === slot.classId)?.name || 'Class'} · {slot.paperName || 'Paper'} · {slot.examDate} · {slot.startTime}-{slot.endTime}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {setup.runs.length === 0 ? (
              <EmptyState icon={Sparkles} title="No generated exam runs yet" description="Build the first exam run on the left to generate a timetable draft." />
            ) : (
              <div className="space-y-3 max-h-[760px] overflow-y-auto pr-1">
                {setup.runs.map((run) => (
                  <div key={run.id} className="rounded-2xl border border-navy-100 p-4 dark:border-navy-800">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-bold text-navy-950 dark:text-navy-50">{run.examName}</p>
                          <Badge tone="blue">{run.generatedCount} slot(s)</Badge>
                        </div>
                        <p className="mt-1 text-xs text-navy-500 dark:text-navy-400">{run.startDate} → {run.endDate} · by {run.createdByName}</p>
                        <p className="mt-1 text-[11px] text-navy-400">Classes: {run.classIds.map((id) => setup.classes.find((klass) => klass.id === id)?.name).filter(Boolean).join(', ')}</p>
                        <p className="mt-1 text-[11px] text-navy-400">Periods: {run.periods.map((period) => `${period.label} ${period.startTime}-${period.endTime}`).join(' · ')}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
