"use client";

/**
 * PART J.3 — Flexible Assessment Engine UI components.
 *
 * Presentational + form components only. Chunk 6 will mount/connect these to
 * `/api/assessments`. No direct fetching here.
 */
import * as React from "react";
import {
  AlertCircle,
  BarChart3,
  BookOpen,
  CheckCircle2,
  ClipboardList,
  Eye,
  FileCheck2,
  Layers,
  ListChecks,
  Loader2,
  Lock,
  Pencil,
  Plus,
  Save,
  ShieldCheck,
  UploadCloud,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableContainer, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export interface AssessmentTypeView {
  id: string;
  key: string;
  name: string;
  description: string | null;
  category: string;
  scoreMode: string;
  defaultMaxMarks: number | null;
  defaultWeight: number;
  evidenceAllowed: boolean;
  requiresModeration: boolean;
  isSystem: boolean;
  active: boolean;
}

export interface AssessmentEvidenceView {
  id: string;
  evidenceType: string;
  fileName: string | null;
  fileUrl: string | null;
  note: string | null;
  uploadedByName: string;
  createdAt: string | Date;
}

export interface AssessmentRecordView {
  id: string;
  studentId: string;
  scoreMarks: number | null;
  scorePct: number | null;
  rubricLevel: number | null;
  rubricCode: string | null;
  narrative: string | null;
  status: string;
  assessedByName: string;
  assessedAt: string | Date;
  evidence: AssessmentEvidenceView[];
}

export interface AssessmentPlanView {
  id: string;
  title: string;
  description: string | null;
  instructions: string | null;
  year: number;
  term: number;
  weight: number;
  maxMarks: number | null;
  dueDate: string | null;
  status: string;
  visibleToParents: boolean;
  classId: string | null;
  subjectId: string | null;
  learningAreaId: string | null;
  assessmentType: AssessmentTypeView;
  records: AssessmentRecordView[];
}

export interface AssessmentBoardSummary {
  types: number;
  plans: number;
  records: number;
  evidence: number;
  releasedPlans: number;
}

export interface AssessmentBoardView {
  canManagePlans: boolean;
  canScore: boolean;
  canModerate: boolean;
  canRelease: boolean;
  types: AssessmentTypeView[];
  plans: AssessmentPlanView[];
  summary: AssessmentBoardSummary;
}

export interface AssessmentSheetStudentView {
  id: string;
  name: string;
  admissionNo: string;
  classId: string | null;
  record: AssessmentRecordView | null;
}

export interface AssessmentSheetView {
  plan: AssessmentPlanView;
  students: AssessmentSheetStudentView[];
}

type AssessmentTypeDraft = {
  id?: string;
  key: string;
  name: string;
  description: string;
  category: string;
  scoreMode: string;
  defaultMaxMarks: string;
  defaultWeight: number;
  evidenceAllowed: boolean;
  requiresModeration: boolean;
  active: boolean;
};

type AssessmentPlanDraft = {
  id?: string;
  assessmentTypeId: string;
  title: string;
  description: string;
  instructions: string;
  year: number;
  term: number;
  weight: number;
  maxMarks: string;
  dueDate: string;
  classId: string;
  subjectId: string;
  learningAreaId: string;
  status: string;
  visibleToParents: boolean;
};

type AssessmentScoreDraft = {
  planId: string;
  studentId: string;
  scoreMarks: string;
  scorePct: string;
  rubricLevel: string;
  rubricCode: string;
  narrative: string;
};

type AssessmentEvidenceDraft = {
  recordId: string;
  evidenceType: string;
  fileUrl: string;
  fileName: string;
  contentType: string;
  note: string;
};

const CATEGORY_OPTIONS = ["FORMAL", "PRACTICAL", "PORTFOLIO", "OBSERVATION", "SCHOOL_DEFINED"];
const SCORE_MODE_OPTIONS = ["MARKS", "RUBRIC", "NARRATIVE", "MIXED"];
const PLAN_STATUS_OPTIONS = ["DRAFT", "ACTIVE", "MODERATION", "RELEASED", "ARCHIVED"];
const EVIDENCE_OPTIONS = ["FILE", "LINK", "NOTE", "PHOTO", "VIDEO", "CERTIFICATE"];

function NativeSelect({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "mt-1 h-12 w-full rounded-2xl border border-navy-200 bg-white/80 px-3.5 text-[15px] text-navy-900 outline-none transition-colors duration-200 ease-apple focus:border-navy-300 focus:ring-2 focus:ring-green-500/30 dark:border-navy-700 dark:bg-navy-900/80 dark:text-navy-50",
        className
      )}
      {...props}
    />
  );
}

function FieldHint({ children }: { children: React.ReactNode }) {
  return <p className="mt-1 text-xs leading-5 text-navy-500 dark:text-navy-400">{children}</p>;
}

function toneForStatus(status: string): "green" | "amber" | "blue" | "neutral" | "red" {
  if (status === "RELEASED") return "green";
  if (status === "MODERATION") return "amber";
  if (status === "ACTIVE" || status === "SCORED") return "blue";
  if (status === "ARCHIVED") return "red";
  return "neutral";
}

function StatCard({ icon: Icon, label, value, tone = "neutral" }: { icon: LucideIcon; label: string; value: number | string; tone?: "neutral" | "green" | "blue" | "amber" }) {
  const toneClass = {
    neutral: "bg-white/70 text-navy-700 dark:bg-navy-900/60 dark:text-navy-100",
    green: "bg-green-50/80 text-green-700 dark:bg-green-950/40 dark:text-green-200",
    blue: "bg-blue-50/80 text-blue-700 dark:bg-blue-950/40 dark:text-blue-200",
    amber: "bg-amber-50/80 text-amber-700 dark:bg-amber-950/40 dark:text-amber-200",
  }[tone];
  return (
    <div className={cn("rounded-2xl border border-white/50 p-4 shadow-sm backdrop-blur-md dark:border-white/10", toneClass)}>
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/70 shadow-sm dark:bg-navy-950/50"><Icon className="h-5 w-5" /></span>
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] opacity-70">{label}</p>
          <p className="mt-0.5 text-2xl font-semibold tracking-tight">{value}</p>
        </div>
      </div>
    </div>
  );
}

export function AssessmentEngineHero({ canManage, onCreatePlan, onSeedTypes }: { canManage: boolean; onCreatePlan?: () => void; onSeedTypes?: () => void }) {
  return (
    <Card className="overflow-hidden border-white/40 bg-white/75 shadow-card backdrop-blur-xl dark:border-white/10 dark:bg-navy-950/70">
      <CardContent className="relative p-5 sm:p-7">
        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_top_right,rgba(31,157,95,0.16),transparent_34%),radial-gradient(circle_at_bottom_left,rgba(28,39,64,0.12),transparent_35%)]" />
        <div className="relative grid gap-5 lg:grid-cols-[1.35fr_0.9fr] lg:items-center">
          <div>
            <Badge tone="green" className="mb-3"><ShieldCheck className="h-3.5 w-3.5" /> Flexible Assessment Engine</Badge>
            <h2 className="max-w-3xl text-2xl font-semibold tracking-tight text-navy-950 dark:text-white sm:text-3xl">
              Assess projects, practicals, oral work and observations without replacing exams.
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-navy-600 dark:text-navy-300">
              Formal exams, CBE observations and LMS work stay intact. This layer adds flexible plans, scoring, evidence and release control on top.
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-2">
              {canManage && onCreatePlan ? <Button onClick={onCreatePlan}><Plus className="h-4 w-4" /> New assessment plan</Button> : null}
              {canManage && onSeedTypes ? <Button variant="secondary" onClick={onSeedTypes}><ListChecks className="h-4 w-4" /> Load default types</Button> : null}
              <Badge tone="blue"><ClipboardList className="h-3.5 w-3.5" /> Projects · practicals · portfolio</Badge>
              <Badge tone="neutral"><FileCheck2 className="h-3.5 w-3.5" /> Evidence-ready</Badge>
            </div>
          </div>
          <div className="rounded-[1.75rem] border border-white/60 bg-white/65 p-4 shadow-card backdrop-blur-xl dark:border-white/10 dark:bg-navy-900/60">
            <div className="rounded-2xl bg-navy-950 p-4 text-white shadow-card dark:bg-white dark:text-navy-950">
              <div className="flex items-center gap-3"><ClipboardList className="h-6 w-6 text-green-300 dark:text-green-600" /><div><p className="text-sm font-semibold">Assessment layer</p><p className="text-xs opacity-75">Compatible · moderated · release-aware</p></div></div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              {["Types", "Plans", "Records", "Evidence"].map((label) => <div key={label} className="rounded-2xl border border-navy-100 bg-white/75 p-3 font-medium text-navy-700 dark:border-navy-800 dark:bg-navy-950/50 dark:text-navy-200">{label}</div>)}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function AssessmentSummaryGrid({ summary }: { summary: AssessmentBoardSummary }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      <StatCard icon={ListChecks} label="Types" value={summary.types} tone="green" />
      <StatCard icon={ClipboardList} label="Plans" value={summary.plans} tone="blue" />
      <StatCard icon={BarChart3} label="Records" value={summary.records} />
      <StatCard icon={UploadCloud} label="Evidence" value={summary.evidence} />
      <StatCard icon={Eye} label="Released" value={summary.releasedPlans} tone="amber" />
    </div>
  );
}

export function AssessmentLoadingState() {
  return <div className="space-y-4"><Skeleton className="h-44 rounded-2xl" /><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{[0,1,2,3,4].map((i)=><Skeleton key={i} className="h-24 rounded-2xl" />)}</div><Skeleton className="h-80 rounded-2xl" /></div>;
}

export function AssessmentErrorState({ message = "Assessment setup could not load.", onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <Card className="border-red-200/70 bg-red-50/80 dark:border-red-900/50 dark:bg-red-950/30"><CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-200"><AlertCircle className="h-5 w-5" /></span><div><p className="font-semibold text-red-900 dark:text-red-100">Could not load assessments</p><p className="mt-1 text-sm text-red-700 dark:text-red-200">{message}</p></div></div>{onRetry ? <Button variant="secondary" onClick={onRetry}>Try again</Button> : null}</CardContent></Card>
  );
}

export function AssessmentEmptyState({ canManage, onCreatePlan, onSeedTypes }: { canManage: boolean; onCreatePlan?: () => void; onSeedTypes?: () => void }) {
  return (
    <EmptyState icon={ClipboardList} title="No assessment plans yet" description="Load the default assessment types, then create a project, practical, oral or observation plan for a real class. Formal exams remain in Exams." action={canManage ? <div className="flex flex-wrap justify-center gap-2">{onSeedTypes ? <Button variant="secondary" onClick={onSeedTypes}><ListChecks className="h-4 w-4" /> Load types</Button> : null}{onCreatePlan ? <Button onClick={onCreatePlan}><Plus className="h-4 w-4" /> New plan</Button> : null}</div> : undefined} />
  );
}

export function AssessmentTypeCatalog({ types, canManage, onEditType }: { types: AssessmentTypeView[]; canManage: boolean; onEditType?: (type: AssessmentTypeView) => void }) {
  return (
    <Card className="border-white/40 bg-white/80 backdrop-blur-xl dark:border-white/10 dark:bg-navy-950/70"><CardHeader><CardTitle className="flex items-center gap-2"><ListChecks className="h-5 w-5 text-green-600" /> Assessment type catalog</CardTitle><p className="mt-1 text-sm text-navy-500 dark:text-navy-400">School-defined type rules for marks, rubrics, narratives and evidence.</p></CardHeader><CardContent><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{types.map((type)=><div key={type.id} className="rounded-2xl border border-navy-100 bg-white/70 p-4 dark:border-navy-800 dark:bg-navy-900/45"><div className="flex items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><p className="font-semibold text-navy-900 dark:text-navy-50">{type.name}</p><Badge tone={type.active ? "green" : "neutral"}>{type.active ? "Active" : "Paused"}</Badge></div><p className="mt-1 text-xs font-mono text-navy-400">{type.key}</p></div>{canManage && onEditType ? <Button variant="ghost" size="sm" onClick={() => onEditType(type)}><Pencil className="h-4 w-4" /> Edit</Button> : null}</div><div className="mt-3 flex flex-wrap gap-2"><Badge tone="blue">{type.category}</Badge><Badge tone="neutral">{type.scoreMode}</Badge>{type.evidenceAllowed ? <Badge tone="green">Evidence</Badge> : <Badge tone="neutral">No evidence</Badge>}{type.requiresModeration ? <Badge tone="amber">Moderate</Badge> : null}</div>{type.description ? <p className="mt-3 text-sm leading-6 text-navy-600 dark:text-navy-300">{type.description}</p> : null}</div>)}</div></CardContent></Card>
  );
}

export function AssessmentPlanCard({ plan, canScore, canModerate, canRelease, onOpenSheet, onRelease }: { plan: AssessmentPlanView; canScore: boolean; canModerate: boolean; canRelease: boolean; onOpenSheet?: (plan: AssessmentPlanView) => void; onRelease?: (plan: AssessmentPlanView) => void }) {
  const evidenceCount = plan.records.reduce((sum, record) => sum + record.evidence.length, 0);
  return (
    <Card className="overflow-hidden border-white/40 bg-white/80 backdrop-blur-xl dark:border-white/10 dark:bg-navy-950/70"><CardHeader className="border-b border-navy-100/70 dark:border-navy-800"><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><CardTitle>{plan.title}</CardTitle><Badge tone={toneForStatus(plan.status)}>{plan.status}</Badge><Badge tone="blue">{plan.assessmentType.name}</Badge></div><p className="mt-1 text-sm text-navy-500 dark:text-navy-400">Year {plan.year} · Term {plan.term} · Weight {plan.weight}% {plan.dueDate ? `· Due ${plan.dueDate}` : ""}</p></div><div className="flex flex-wrap gap-2">{canScore && onOpenSheet ? <Button variant="secondary" size="sm" onClick={() => onOpenSheet(plan)}><BarChart3 className="h-4 w-4" /> Score</Button> : null}{canRelease && onRelease && plan.status !== "RELEASED" ? <Button size="sm" onClick={() => onRelease(plan)}><Eye className="h-4 w-4" /> Release</Button> : null}</div></div></CardHeader><CardContent className="space-y-4">{plan.description ? <p className="text-sm leading-6 text-navy-600 dark:text-navy-300">{plan.description}</p> : null}<div className="grid gap-3 sm:grid-cols-4"><MiniMetric icon={BarChart3} label="Records" value={plan.records.length} /><MiniMetric icon={UploadCloud} label="Evidence" value={evidenceCount} /><MiniMetric icon={ShieldCheck} label="Moderation" value={plan.assessmentType.requiresModeration || canModerate ? "Yes" : "No"} /><MiniMetric icon={plan.visibleToParents ? Eye : Lock} label="Parents" value={plan.visibleToParents ? "Visible" : "Hidden"} /></div></CardContent></Card>
  );
}

function MiniMetric({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string | number }) {
  return <div className="rounded-2xl border border-navy-100 bg-white/65 p-3 dark:border-navy-800 dark:bg-navy-900/45"><div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.14em] text-navy-400"><Icon className="h-4 w-4" /> {label}</div><p className="mt-2 text-lg font-semibold text-navy-900 dark:text-navy-50">{value}</p></div>;
}

export function AssessmentTypeForm({ initial, saving = false, onSubmit, onCancel }: { initial?: Partial<AssessmentTypeDraft>; saving?: boolean; onSubmit: (draft: AssessmentTypeDraft) => void; onCancel?: () => void }) {
  const [draft, setDraft] = React.useState<AssessmentTypeDraft>({ id: initial?.id, key: initial?.key ?? "PROJECT", name: initial?.name ?? "", description: initial?.description ?? "", category: initial?.category ?? "SCHOOL_DEFINED", scoreMode: initial?.scoreMode ?? "MIXED", defaultMaxMarks: initial?.defaultMaxMarks ?? "", defaultWeight: initial?.defaultWeight ?? 0, evidenceAllowed: initial?.evidenceAllowed ?? true, requiresModeration: initial?.requiresModeration ?? true, active: initial?.active ?? true });
  const disabled = saving || draft.key.trim().length < 2 || draft.name.trim().length < 2;
  return <form className="space-y-4" onSubmit={(e)=>{e.preventDefault(); if(!disabled) onSubmit({ ...draft, key: draft.key.toUpperCase() });}}><div className="grid gap-3 sm:grid-cols-2"><div><Label>Type key</Label><Input value={draft.key} onChange={(e)=>setDraft({...draft,key:e.target.value.toUpperCase()})} /></div><div><Label>Name</Label><Input value={draft.name} onChange={(e)=>setDraft({...draft,name:e.target.value})} placeholder="Project" /></div></div><div className="grid gap-3 sm:grid-cols-2"><div><Label>Category</Label><NativeSelect value={draft.category} onChange={(e)=>setDraft({...draft,category:e.target.value})}>{CATEGORY_OPTIONS.map((x)=><option key={x} value={x}>{x}</option>)}</NativeSelect></div><div><Label>Score mode</Label><NativeSelect value={draft.scoreMode} onChange={(e)=>setDraft({...draft,scoreMode:e.target.value})}>{SCORE_MODE_OPTIONS.map((x)=><option key={x} value={x}>{x}</option>)}</NativeSelect></div></div><div className="grid gap-3 sm:grid-cols-2"><div><Label>Default max marks</Label><Input type="number" value={draft.defaultMaxMarks} onChange={(e)=>setDraft({...draft,defaultMaxMarks:e.target.value})} /></div><div><Label>Default weight %</Label><Input type="number" min={0} max={100} value={draft.defaultWeight} onChange={(e)=>setDraft({...draft,defaultWeight:Number(e.target.value)})} /></div></div><div><Label>Description</Label><Input value={draft.description} onChange={(e)=>setDraft({...draft,description:e.target.value})} placeholder="How this assessment type is used" /></div><ToggleRow label="Allow evidence" checked={draft.evidenceAllowed} onChange={(v)=>setDraft({...draft,evidenceAllowed:v})} /><ToggleRow label="Requires moderation" checked={draft.requiresModeration} onChange={(v)=>setDraft({...draft,requiresModeration:v})} /><ToggleRow label="Active" checked={draft.active} onChange={(v)=>setDraft({...draft,active:v})} /><FormActions saving={saving} disabled={disabled} submitLabel={initial?.id ? "Save type" : "Create type"} onCancel={onCancel} /></form>;
}

export function AssessmentPlanForm({ types, initial, saving = false, onSubmit, onCancel }: { types: AssessmentTypeView[]; initial?: Partial<AssessmentPlanDraft>; saving?: boolean; onSubmit: (draft: AssessmentPlanDraft) => void; onCancel?: () => void }) {
  const [draft, setDraft] = React.useState<AssessmentPlanDraft>({ id: initial?.id, assessmentTypeId: initial?.assessmentTypeId ?? types[0]?.id ?? "", title: initial?.title ?? "", description: initial?.description ?? "", instructions: initial?.instructions ?? "", year: initial?.year ?? new Date().getFullYear(), term: initial?.term ?? 2, weight: initial?.weight ?? 0, maxMarks: initial?.maxMarks ?? "", dueDate: initial?.dueDate ?? "", classId: initial?.classId ?? "", subjectId: initial?.subjectId ?? "", learningAreaId: initial?.learningAreaId ?? "", status: initial?.status ?? "DRAFT", visibleToParents: initial?.visibleToParents ?? false });
  const disabled = saving || !draft.assessmentTypeId || draft.title.trim().length < 2 || (!draft.classId && !draft.subjectId && !draft.learningAreaId);
  return <form className="space-y-4" onSubmit={(e)=>{e.preventDefault(); if(!disabled) onSubmit(draft);}}><div><Label>Assessment type</Label><NativeSelect value={draft.assessmentTypeId} onChange={(e)=>setDraft({...draft,assessmentTypeId:e.target.value})}><option value="">Choose type</option>{types.map((t)=><option key={t.id} value={t.id}>{t.name} · {t.scoreMode}</option>)}</NativeSelect></div><div><Label>Title</Label><Input value={draft.title} onChange={(e)=>setDraft({...draft,title:e.target.value})} placeholder="Term 2 Science Project" /></div><div className="grid gap-3 sm:grid-cols-3"><div><Label>Year</Label><Input type="number" value={draft.year} onChange={(e)=>setDraft({...draft,year:Number(e.target.value)})} /></div><div><Label>Term</Label><Input type="number" value={draft.term} onChange={(e)=>setDraft({...draft,term:Number(e.target.value)})} /></div><div><Label>Weight %</Label><Input type="number" min={0} max={100} value={draft.weight} onChange={(e)=>setDraft({...draft,weight:Number(e.target.value)})} /></div></div><div className="grid gap-3 sm:grid-cols-2"><div><Label>Class ID</Label><Input value={draft.classId} onChange={(e)=>setDraft({...draft,classId:e.target.value})} placeholder="Class id from setup" /></div><div><Label>Subject ID</Label><Input value={draft.subjectId} onChange={(e)=>setDraft({...draft,subjectId:e.target.value})} placeholder="Subject id from setup" /></div></div><div className="grid gap-3 sm:grid-cols-2"><div><Label>Learning area ID</Label><Input value={draft.learningAreaId} onChange={(e)=>setDraft({...draft,learningAreaId:e.target.value})} placeholder="Optional learning area" /></div><div><Label>Due date</Label><Input type="date" value={draft.dueDate} onChange={(e)=>setDraft({...draft,dueDate:e.target.value})} /></div></div><div><Label>Instructions</Label><textarea value={draft.instructions} onChange={(e)=>setDraft({...draft,instructions:e.target.value})} className="min-h-24 w-full rounded-2xl border border-navy-200 bg-white/80 px-3.5 py-3 text-sm text-navy-900 outline-none focus:ring-2 focus:ring-green-500/30 dark:border-navy-700 dark:bg-navy-900/80 dark:text-navy-50" /></div><ToggleRow label="Visible to parents after release" checked={draft.visibleToParents} onChange={(v)=>setDraft({...draft,visibleToParents:v})} /><FieldHint>At least one class, subject or learning area is required. Pickers are wired in the page chunk.</FieldHint><FormActions saving={saving} disabled={disabled} submitLabel={initial?.id ? "Save plan" : "Create plan"} onCancel={onCancel} /></form>;
}

export function AssessmentScoreForm({ student, planId, initial, saving = false, onSubmit, onCancel }: { student: AssessmentSheetStudentView; planId: string; initial?: AssessmentRecordView | null; saving?: boolean; onSubmit: (draft: AssessmentScoreDraft) => void; onCancel?: () => void }) {
  const [draft, setDraft] = React.useState<AssessmentScoreDraft>({ planId, studentId: student.id, scoreMarks: initial?.scoreMarks?.toString() ?? "", scorePct: initial?.scorePct?.toString() ?? "", rubricLevel: initial?.rubricLevel?.toString() ?? "", rubricCode: initial?.rubricCode ?? "", narrative: initial?.narrative ?? "" });
  const disabled = saving || (!draft.scoreMarks && !draft.scorePct && !draft.rubricLevel && !draft.rubricCode && !draft.narrative);
  return <form className="space-y-4" onSubmit={(e)=>{e.preventDefault(); if(!disabled) onSubmit(draft);}}><div className="rounded-2xl bg-green-50/80 p-3 text-sm text-green-900 dark:bg-green-950/30 dark:text-green-100"><strong>{student.name}</strong> · {student.admissionNo}</div><div className="grid gap-3 sm:grid-cols-4"><div><Label>Marks</Label><Input value={draft.scoreMarks} onChange={(e)=>setDraft({...draft,scoreMarks:e.target.value})} /></div><div><Label>%</Label><Input value={draft.scorePct} onChange={(e)=>setDraft({...draft,scorePct:e.target.value})} /></div><div><Label>Rubric level</Label><Input value={draft.rubricLevel} onChange={(e)=>setDraft({...draft,rubricLevel:e.target.value})} /></div><div><Label>Code</Label><Input value={draft.rubricCode} onChange={(e)=>setDraft({...draft,rubricCode:e.target.value.toUpperCase()})} placeholder="EE" /></div></div><div><Label>Narrative observation</Label><textarea value={draft.narrative} onChange={(e)=>setDraft({...draft,narrative:e.target.value})} className="min-h-24 w-full rounded-2xl border border-navy-200 bg-white/80 px-3.5 py-3 text-sm text-navy-900 outline-none focus:ring-2 focus:ring-green-500/30 dark:border-navy-700 dark:bg-navy-900/80 dark:text-navy-50" /></div><FormActions saving={saving} disabled={disabled} submitLabel="Save score" onCancel={onCancel} /></form>;
}

export function AssessmentEvidenceCard({ evidence }: { evidence: AssessmentEvidenceView }) {
  return <div className="rounded-2xl border border-navy-100 bg-white/70 p-3 dark:border-navy-800 dark:bg-navy-900/45"><div className="flex flex-wrap items-center gap-2"><Badge tone="blue">{evidence.evidenceType}</Badge>{evidence.fileName ? <span className="text-sm font-medium text-navy-900 dark:text-navy-50">{evidence.fileName}</span> : null}</div>{evidence.note ? <p className="mt-2 text-sm text-navy-600 dark:text-navy-300">{evidence.note}</p> : null}<p className="mt-2 text-xs text-navy-400">Uploaded by {evidence.uploadedByName}</p></div>;
}

export function AssessmentEvidenceForm({ recordId, saving = false, onSubmit, onCancel }: { recordId: string; saving?: boolean; onSubmit: (draft: AssessmentEvidenceDraft) => void; onCancel?: () => void }) {
  const [draft, setDraft] = React.useState<AssessmentEvidenceDraft>({ recordId, evidenceType: "NOTE", fileUrl: "", fileName: "", contentType: "", note: "" });
  const disabled = saving || (!draft.fileUrl && !draft.note);
  return <form className="space-y-4" onSubmit={(e)=>{e.preventDefault(); if(!disabled) onSubmit(draft);}}><div><Label>Evidence type</Label><NativeSelect value={draft.evidenceType} onChange={(e)=>setDraft({...draft,evidenceType:e.target.value})}>{EVIDENCE_OPTIONS.map((x)=><option key={x} value={x}>{x}</option>)}</NativeSelect></div><div className="grid gap-3 sm:grid-cols-2"><div><Label>File URL or link</Label><Input value={draft.fileUrl} onChange={(e)=>setDraft({...draft,fileUrl:e.target.value})} placeholder="Encrypted file URL or reference" /></div><div><Label>File name</Label><Input value={draft.fileName} onChange={(e)=>setDraft({...draft,fileName:e.target.value})} placeholder="project-photo.jpg" /></div></div><div><Label>Note</Label><Input value={draft.note} onChange={(e)=>setDraft({...draft,note:e.target.value})} placeholder="What this evidence proves" /></div><FieldHint>File upload picker is wired in the page chunk and must use Storage Vault encrypted upload.</FieldHint><FormActions saving={saving} disabled={disabled} submitLabel="Attach evidence" onCancel={onCancel} /></form>;
}

export function AssessmentSheetTable({ sheet, canScore, onScoreStudent }: { sheet: AssessmentSheetView; canScore: boolean; onScoreStudent?: (student: AssessmentSheetStudentView) => void }) {
  return <TableContainer><Table><THead><TR><TH>Learner</TH><TH>Marks</TH><TH>Rubric</TH><TH>Status</TH><TH>Evidence</TH><TH></TH></TR></THead><TBody>{sheet.students.map((student)=><TR key={student.id}><TD><div className="font-medium">{student.name}</div><div className="text-xs text-navy-400">{student.admissionNo}</div></TD><TD>{student.record?.scorePct ?? "—"}{student.record?.scorePct != null ? "%" : ""}</TD><TD>{student.record?.rubricCode ?? student.record?.rubricLevel ?? "—"}</TD><TD><Badge tone={toneForStatus(student.record?.status ?? "DRAFT")}>{student.record?.status ?? "Not scored"}</Badge></TD><TD>{student.record?.evidence.length ?? 0}</TD><TD>{canScore && onScoreStudent ? <Button variant="secondary" size="sm" onClick={()=>onScoreStudent(student)}>{student.record ? "Edit" : "Score"}</Button> : null}</TD></TR>)}</TBody></Table></TableContainer>;
}

export function AssessmentReleasePanel({ plan, canRelease, saving = false, onRelease }: { plan: AssessmentPlanView; canRelease: boolean; saving?: boolean; onRelease?: (visibleToParents: boolean) => void }) {
  const [visible, setVisible] = React.useState(true);
  const released = plan.status === "RELEASED";
  return <Card className="border-white/40 bg-white/80 backdrop-blur-xl dark:border-white/10 dark:bg-navy-950/70"><CardHeader><CardTitle className="flex items-center gap-2">{released ? <CheckCircle2 className="h-5 w-5 text-green-600" /> : <ShieldCheck className="h-5 w-5 text-amber-600" />} Release control</CardTitle></CardHeader><CardContent className="space-y-4"><p className="text-sm text-navy-600 dark:text-navy-300">Release only after moderation. Parents and students see this assessment only when it is released and visible.</p><ToggleRow label="Visible to parents and students" checked={visible} onChange={setVisible} />{canRelease && !released && onRelease ? <Button disabled={saving} onClick={()=>onRelease(visible)}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />} Release assessment</Button> : <Badge tone={released ? "green" : "neutral"}>{released ? "Released" : "Awaiting release"}</Badge>}</CardContent></Card>;
}

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <label className="flex items-center gap-3 rounded-2xl border border-navy-100 bg-white/60 p-3 text-sm font-medium text-navy-700 dark:border-navy-800 dark:bg-navy-900/50 dark:text-navy-200"><input type="checkbox" checked={checked} onChange={(e)=>onChange(e.target.checked)} className="h-4 w-4 rounded border-navy-300 text-green-600" />{label}</label>;
}

function FormActions({ saving, disabled, submitLabel, onCancel }: { saving: boolean; disabled: boolean; submitLabel: string; onCancel?: () => void }) {
  return <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">{onCancel ? <Button type="button" variant="ghost" onClick={onCancel}><X className="h-4 w-4" /> Cancel</Button> : null}<Button type="submit" disabled={disabled}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {submitLabel}</Button></div>;
}
