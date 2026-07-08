"use client";

/**
 * PART J.2 — Curriculum Engine UI components.
 *
 * Reusable Liquid Glass-ready surfaces for the future-proof Education OS setup.
 * These components are presentational + form components; Chunk 6 mounts them on
 * a page and connects them to the real `/api/curriculum` endpoint.
 */
import * as React from "react";
import {
  AlertCircle,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Compass,
  GraduationCap,
  Layers,
  Link2,
  ListChecks,
  Loader2,
  Pencil,
  Plus,
  Save,
  School,
  Settings2,
  ShieldCheck,
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

export interface CurriculumLevelView {
  id: string;
  name: string;
  levelKey: string;
  sequence: number;
  description: string | null;
}

export interface GradeBandView {
  id: string;
  name: string;
  shortName: string | null;
  sequence: number;
  entryAge: number | null;
  exitAge: number | null;
  educationLevelId: string | null;
}

export interface LearningAreaView {
  id: string;
  name: string;
  code: string;
  description: string | null;
}

export interface CurriculumView {
  id: string;
  name: string;
  country: string;
  context: string | null;
  activeVersion: string;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  isActive: boolean;
  notes: string | null;
  educationLevels: CurriculumLevelView[];
  gradeBands: GradeBandView[];
  learningAreas: LearningAreaView[];
}

export interface CurriculumBoardSummary {
  curricula: number;
  educationLevels: number;
  gradeBands: number;
  learningAreas: number;
  unmappedSubjects: number;
  unmappedClasses: number;
  unmappedTerms: number;
}

export interface MappingSubjectView {
  id: string;
  name: string;
  code: string;
  curriculum: string;
  curriculumId: string | null;
  learningAreaId: string | null;
}

export interface MappingClassView {
  id: string;
  level: string;
  stream: string | null;
  curriculum: string;
  curriculumId: string | null;
  gradeBandId: string | null;
}

export interface MappingTermView {
  id: string;
  year: number;
  term: number;
  startDate: string;
  endDate: string;
  current: boolean;
  curriculumId: string | null;
}

export interface MappingStrandView {
  id: string;
  subjectId: string;
  name: string;
  learningAreaId: string | null;
}

export interface CurriculumBoardView {
  canManage: boolean;
  curricula: CurriculumView[];
  summary: CurriculumBoardSummary;
  mappings: {
    subjects: MappingSubjectView[];
    classes: MappingClassView[];
    terms: MappingTermView[];
    strands: MappingStrandView[];
  };
}

type CurriculumDraft = {
  id?: string;
  name: string;
  country: string;
  context: string;
  activeVersion: string;
  effectiveFrom: string;
  effectiveTo: string;
  isActive: boolean;
  notes: string;
};

type LevelDraft = {
  id?: string;
  curriculumId: string;
  name: string;
  levelKey: string;
  sequence: number;
  description: string;
};

type GradeDraft = {
  id?: string;
  curriculumId: string;
  educationLevelId: string;
  name: string;
  shortName: string;
  sequence: number;
  entryAge: string;
  exitAge: string;
};

type AreaDraft = {
  id?: string;
  curriculumId: string;
  name: string;
  code: string;
  description: string;
};

const LEVEL_OPTIONS = [
  { value: "preschool", label: "Preschool" },
  { value: "primary", label: "Primary" },
  { value: "junior", label: "Junior" },
  { value: "senior", label: "Senior" },
  { value: "forms", label: "Forms" },
  { value: "college", label: "College" },
  { value: "university", label: "University" },
  { value: "custom", label: "Custom" },
];

function FieldHint({ children }: { children: React.ReactNode }) {
  return <p className="mt-1 text-xs leading-5 text-navy-500 dark:text-navy-400">{children}</p>;
}

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

function SurfaceStat({ icon: Icon, label, value, tone = "neutral" }: { icon: LucideIcon; label: string; value: string | number; tone?: "neutral" | "green" | "amber" | "blue" }) {
  const toneClass = {
    neutral: "bg-white/70 text-navy-700 dark:bg-navy-900/60 dark:text-navy-100",
    green: "bg-green-50/80 text-green-700 dark:bg-green-950/40 dark:text-green-200",
    amber: "bg-amber-50/80 text-amber-700 dark:bg-amber-950/40 dark:text-amber-200",
    blue: "bg-blue-50/80 text-blue-700 dark:bg-blue-950/40 dark:text-blue-200",
  }[tone];
  return (
    <div className={cn("rounded-2xl border border-white/50 p-4 shadow-sm backdrop-blur-md dark:border-white/10", toneClass)}>
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/70 shadow-sm dark:bg-navy-950/50">
          <Icon className="h-5 w-5" />
        </span>
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] opacity-70">{label}</p>
          <p className="mt-0.5 text-2xl font-semibold tracking-tight">{value}</p>
        </div>
      </div>
    </div>
  );
}

export function CurriculumEngineHero({ canManage, onCreateCurriculum }: { canManage: boolean; onCreateCurriculum?: () => void }) {
  return (
    <Card className="overflow-hidden border-white/40 bg-white/75 shadow-card backdrop-blur-xl dark:border-white/10 dark:bg-navy-950/70">
      <CardContent className="relative p-5 sm:p-7">
        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_top_right,rgba(31,157,95,0.16),transparent_34%),radial-gradient(circle_at_bottom_left,rgba(28,39,64,0.12),transparent_35%)]" />
        <div className="relative grid gap-5 lg:grid-cols-[1.45fr_0.9fr] lg:items-center">
          <div>
            <Badge tone="green" className="mb-3"><ShieldCheck className="h-3.5 w-3.5" /> Future-proof Education OS</Badge>
            <h2 className="max-w-3xl text-2xl font-semibold tracking-tight text-navy-950 dark:text-white sm:text-3xl">
              Configure curriculum. Do not hardcode curriculum.
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-navy-600 dark:text-navy-300">
              NEYO maps the school’s real curriculum, levels, grade names and learning areas into one configurable engine. Existing subjects, classes and terms stay intact.
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-2">
              {canManage && onCreateCurriculum ? (
                <Button onClick={onCreateCurriculum}><Plus className="h-4 w-4" /> New curriculum</Button>
              ) : null}
              <Badge tone="blue"><BookOpen className="h-3.5 w-3.5" /> CBE, 8-4-4, Cambridge, custom</Badge>
              <Badge tone="neutral"><Link2 className="h-3.5 w-3.5" /> Extends existing academics</Badge>
            </div>
          </div>
          <div className="rounded-[1.75rem] border border-white/60 bg-white/65 p-4 shadow-card backdrop-blur-xl dark:border-white/10 dark:bg-navy-900/60">
            <div className="flex items-center gap-3 rounded-2xl bg-navy-950 p-4 text-white shadow-card dark:bg-white dark:text-navy-950">
              <Compass className="h-6 w-6 text-green-300 dark:text-green-600" />
              <div>
                <p className="text-sm font-semibold">Curriculum engine</p>
                <p className="text-xs opacity-75">Versioned · configurable · tenant-owned</p>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              {[
                "Curriculum",
                "Levels",
                "Grade bands",
                "Learning areas",
              ].map((label) => (
                <div key={label} className="rounded-2xl border border-navy-100 bg-white/75 p-3 font-medium text-navy-700 dark:border-navy-800 dark:bg-navy-950/50 dark:text-navy-200">
                  {label}
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function CurriculumSummaryGrid({ summary }: { summary: CurriculumBoardSummary }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <SurfaceStat icon={Compass} label="Curricula" value={summary.curricula} tone="green" />
      <SurfaceStat icon={School} label="Levels" value={summary.educationLevels} tone="blue" />
      <SurfaceStat icon={GraduationCap} label="Grade bands" value={summary.gradeBands} />
      <SurfaceStat icon={Layers} label="Learning areas" value={summary.learningAreas} />
    </div>
  );
}

export function CurriculumLoadingState() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-44 rounded-2xl" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-72 rounded-2xl" />
        <Skeleton className="h-72 rounded-2xl" />
      </div>
    </div>
  );
}

export function CurriculumErrorState({ message = "Curriculum setup could not load.", onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <Card className="border-red-200/70 bg-red-50/80 dark:border-red-900/50 dark:bg-red-950/30">
      <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-200">
            <AlertCircle className="h-5 w-5" />
          </span>
          <div>
            <p className="font-semibold text-red-900 dark:text-red-100">Could not load curriculum setup</p>
            <p className="mt-1 text-sm text-red-700 dark:text-red-200">{message}</p>
          </div>
        </div>
        {onRetry ? <Button variant="secondary" onClick={onRetry}>Try again</Button> : null}
      </CardContent>
    </Card>
  );
}

export function CurriculumEmptyState({ canManage, onCreateCurriculum }: { canManage: boolean; onCreateCurriculum?: () => void }) {
  return (
    <EmptyState
      icon={Compass}
      title="No curriculum configured yet"
      description="Start with CBE Kenya, 8-4-4 Legacy, Cambridge or a custom school framework. Existing subjects and classes will be mapped after the structure is created."
      action={canManage && onCreateCurriculum ? <Button onClick={onCreateCurriculum}><Plus className="h-4 w-4" /> Create curriculum</Button> : undefined}
    />
  );
}

export function CurriculumStructureCard({
  curriculum,
  canManage,
  onEditCurriculum,
  onAddLevel,
  onAddGradeBand,
  onAddLearningArea,
}: {
  curriculum: CurriculumView;
  canManage: boolean;
  onEditCurriculum?: (curriculum: CurriculumView) => void;
  onAddLevel?: (curriculum: CurriculumView) => void;
  onAddGradeBand?: (curriculum: CurriculumView) => void;
  onAddLearningArea?: (curriculum: CurriculumView) => void;
}) {
  return (
    <Card className="overflow-hidden border-white/40 bg-white/80 backdrop-blur-xl dark:border-white/10 dark:bg-navy-950/70">
      <CardHeader className="border-b border-navy-100/70 dark:border-navy-800">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-lg">{curriculum.name}</CardTitle>
              <Badge tone={curriculum.isActive ? "green" : "neutral"}>{curriculum.isActive ? "Active" : "Paused"}</Badge>
              <Badge tone="blue">{curriculum.activeVersion}</Badge>
            </div>
            <p className="mt-1 text-sm text-navy-500 dark:text-navy-400">
              {curriculum.country}{curriculum.context ? ` · ${curriculum.context}` : ""}
            </p>
            <p className="mt-2 text-xs text-navy-400 dark:text-navy-500">
              Effective {curriculum.effectiveFrom ?? "not set"} → {curriculum.effectiveTo ?? "open"}
            </p>
          </div>
          {canManage ? (
            <div className="flex flex-wrap gap-2">
              {onEditCurriculum ? <Button variant="secondary" size="sm" onClick={() => onEditCurriculum(curriculum)}><Pencil className="h-4 w-4" /> Edit</Button> : null}
              {onAddLevel ? <Button variant="ghost" size="sm" onClick={() => onAddLevel(curriculum)}><School className="h-4 w-4" /> Level</Button> : null}
              {onAddGradeBand ? <Button variant="ghost" size="sm" onClick={() => onAddGradeBand(curriculum)}><GraduationCap className="h-4 w-4" /> Grade</Button> : null}
              {onAddLearningArea ? <Button variant="ghost" size="sm" onClick={() => onAddLearningArea(curriculum)}><Layers className="h-4 w-4" /> Area</Button> : null}
            </div>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {curriculum.notes ? <p className="text-sm leading-6 text-navy-600 dark:text-navy-300">{curriculum.notes}</p> : null}
        <div className="grid gap-4 lg:grid-cols-3">
          <StructureList title="Education levels" icon={School} empty="No levels yet" rows={curriculum.educationLevels.map((level) => ({
            id: level.id,
            title: level.name,
            subtitle: `${level.levelKey} · sequence ${level.sequence}`,
          }))} />
          <StructureList title="Grade bands" icon={GraduationCap} empty="No grade bands yet" rows={curriculum.gradeBands.map((grade) => ({
            id: grade.id,
            title: grade.name,
            subtitle: `${grade.shortName ?? "No short name"} · sequence ${grade.sequence}${grade.entryAge ? ` · age ${grade.entryAge}${grade.exitAge ? `–${grade.exitAge}` : ""}` : ""}`,
          }))} />
          <StructureList title="Learning areas" icon={Layers} empty="No learning areas yet" rows={curriculum.learningAreas.map((area) => ({
            id: area.id,
            title: area.name,
            subtitle: area.code,
          }))} />
        </div>
      </CardContent>
    </Card>
  );
}

function StructureList({ title, icon: Icon, rows, empty }: { title: string; icon: LucideIcon; rows: { id: string; title: string; subtitle: string }[]; empty: string }) {
  return (
    <div className="rounded-2xl border border-navy-100 bg-white/65 p-4 backdrop-blur-md dark:border-navy-800 dark:bg-navy-900/45">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-200"><Icon className="h-4 w-4" /></span>
        <p className="text-sm font-semibold text-navy-900 dark:text-navy-50">{title}</p>
        <Badge tone="neutral" className="ml-auto">{rows.length}</Badge>
      </div>
      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-navy-200 p-3 text-sm text-navy-400 dark:border-navy-800 dark:text-navy-500">{empty}</p>
      ) : (
        <div className="space-y-2">
          {rows.map((row) => (
            <div key={row.id} className="rounded-xl border border-navy-100 bg-white/70 p-3 dark:border-navy-800 dark:bg-navy-950/40">
              <p className="text-sm font-medium text-navy-900 dark:text-navy-50">{row.title}</p>
              <p className="mt-0.5 text-xs text-navy-500 dark:text-navy-400">{row.subtitle}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function CurriculumMappingPanel({ board, onOpenMapping }: { board: CurriculumBoardView; onOpenMapping?: () => void }) {
  const rows = [
    { label: "Subjects", value: board.summary.unmappedSubjects, icon: BookOpen },
    { label: "Classes", value: board.summary.unmappedClasses, icon: School },
    { label: "Terms", value: board.summary.unmappedTerms, icon: CalendarDays },
  ];
  const allMapped = rows.every((row) => row.value === 0);
  return (
    <Card className="border-white/40 bg-white/80 backdrop-blur-xl dark:border-white/10 dark:bg-navy-950/70">
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2"><Link2 className="h-5 w-5 text-green-600" /> Existing records mapping</CardTitle>
            <p className="mt-1 text-sm text-navy-500 dark:text-navy-400">Connect existing subjects, classes and terms to the new curriculum engine without duplicating them.</p>
          </div>
          {board.canManage && onOpenMapping ? <Button variant="secondary" onClick={onOpenMapping}><Settings2 className="h-4 w-4" /> Map records</Button> : null}
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-3">
          {rows.map((row) => {
            const Icon = row.icon;
            return (
              <div key={row.label} className="rounded-2xl border border-navy-100 bg-white/70 p-4 dark:border-navy-800 dark:bg-navy-900/45">
                <div className="flex items-center gap-2 text-sm font-medium text-navy-700 dark:text-navy-200"><Icon className="h-4 w-4" /> {row.label}</div>
                <p className={cn("mt-2 text-2xl font-semibold", row.value ? "text-amber-600 dark:text-amber-300" : "text-green-700 dark:text-green-300")}>{row.value}</p>
                <p className="text-xs text-navy-500 dark:text-navy-400">{row.value ? "still unmapped" : "mapped"}</p>
              </div>
            );
          })}
        </div>
        {allMapped ? (
          <div className="mt-4 flex items-center gap-2 rounded-2xl bg-green-50 p-3 text-sm text-green-800 dark:bg-green-950/40 dark:text-green-200">
            <CheckCircle2 className="h-4 w-4" /> Existing academic records are mapped to the curriculum engine.
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function CurriculumForm({
  initial,
  saving = false,
  onSubmit,
  onCancel,
}: {
  initial?: Partial<CurriculumDraft>;
  saving?: boolean;
  onSubmit: (draft: CurriculumDraft) => void;
  onCancel?: () => void;
}) {
  const [draft, setDraft] = React.useState<CurriculumDraft>({
    id: initial?.id,
    name: initial?.name ?? "",
    country: initial?.country ?? "Kenya",
    context: initial?.context ?? "",
    activeVersion: initial?.activeVersion ?? "2026",
    effectiveFrom: initial?.effectiveFrom ?? "",
    effectiveTo: initial?.effectiveTo ?? "",
    isActive: initial?.isActive ?? true,
    notes: initial?.notes ?? "",
  });
  const disabled = saving || draft.name.trim().length < 2 || draft.activeVersion.trim().length < 1 || draft.country.trim().length < 2;
  return (
    <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); if (!disabled) onSubmit(draft); }}>
      <div className="grid gap-3 sm:grid-cols-2">
        <div><Label>Curriculum name</Label><Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="CBE Kenya" /></div>
        <div><Label>Country / context</Label><Input value={draft.country} onChange={(e) => setDraft({ ...draft, country: e.target.value })} placeholder="Kenya" /></div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div><Label>Active version</Label><Input value={draft.activeVersion} onChange={(e) => setDraft({ ...draft, activeVersion: e.target.value })} placeholder="2026" /></div>
        <div><Label>School context</Label><Input value={draft.context} onChange={(e) => setDraft({ ...draft, context: e.target.value })} placeholder="Junior and senior school" /></div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div><Label>Effective from</Label><Input type="date" value={draft.effectiveFrom} onChange={(e) => setDraft({ ...draft, effectiveFrom: e.target.value })} /></div>
        <div><Label>Effective to</Label><Input type="date" value={draft.effectiveTo} onChange={(e) => setDraft({ ...draft, effectiveTo: e.target.value })} /></div>
      </div>
      <label className="flex items-center gap-3 rounded-2xl border border-navy-100 bg-white/60 p-3 text-sm font-medium text-navy-700 dark:border-navy-800 dark:bg-navy-900/50 dark:text-navy-200">
        <input type="checkbox" checked={draft.isActive} onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })} className="h-4 w-4 rounded border-navy-300 text-green-600" />
        Active curriculum version
      </label>
      <div>
        <Label>Notes</Label>
        <textarea value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} className="min-h-24 w-full rounded-2xl border border-navy-200 bg-white/80 px-3.5 py-3 text-sm text-navy-900 outline-none focus:ring-2 focus:ring-green-500/30 dark:border-navy-700 dark:bg-navy-900/80 dark:text-navy-50" placeholder="What should staff know about this curriculum version?" />
      </div>
      <FormActions saving={saving} disabled={disabled} onCancel={onCancel} submitLabel={initial?.id ? "Save curriculum" : "Create curriculum"} />
    </form>
  );
}

export function EducationLevelForm({ curricula, initial, saving = false, onSubmit, onCancel }: { curricula: CurriculumView[]; initial?: Partial<LevelDraft>; saving?: boolean; onSubmit: (draft: LevelDraft) => void; onCancel?: () => void }) {
  const [draft, setDraft] = React.useState<LevelDraft>({ id: initial?.id, curriculumId: initial?.curriculumId ?? curricula[0]?.id ?? "", name: initial?.name ?? "", levelKey: initial?.levelKey ?? "custom", sequence: initial?.sequence ?? 1, description: initial?.description ?? "" });
  const disabled = saving || !draft.curriculumId || draft.name.trim().length < 2;
  return (
    <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); if (!disabled) onSubmit(draft); }}>
      <div><Label>Curriculum</Label><CurriculumSelect curricula={curricula} value={draft.curriculumId} onChange={(value) => setDraft({ ...draft, curriculumId: value })} /></div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div><Label>Level name</Label><Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Junior School" /></div>
        <div><Label>Level type</Label><NativeSelect value={draft.levelKey} onChange={(e) => setDraft({ ...draft, levelKey: e.target.value })}>{LEVEL_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}</NativeSelect></div>
      </div>
      <div><Label>Sequence</Label><Input type="number" min={1} max={1000} value={draft.sequence} onChange={(e) => setDraft({ ...draft, sequence: Number(e.target.value) })} /><FieldHint>Lower numbers appear first.</FieldHint></div>
      <div><Label>Description</Label><Input value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} placeholder="Grades 7 to 9" /></div>
      <FormActions saving={saving} disabled={disabled} onCancel={onCancel} submitLabel={initial?.id ? "Save level" : "Create level"} />
    </form>
  );
}

export function GradeBandForm({ curricula, initial, saving = false, onSubmit, onCancel }: { curricula: CurriculumView[]; initial?: Partial<GradeDraft>; saving?: boolean; onSubmit: (draft: GradeDraft) => void; onCancel?: () => void }) {
  const firstCurriculum = curricula[0];
  const [draft, setDraft] = React.useState<GradeDraft>({ id: initial?.id, curriculumId: initial?.curriculumId ?? firstCurriculum?.id ?? "", educationLevelId: initial?.educationLevelId ?? "", name: initial?.name ?? "", shortName: initial?.shortName ?? "", sequence: initial?.sequence ?? 1, entryAge: initial?.entryAge ?? "", exitAge: initial?.exitAge ?? "" });
  const selected = curricula.find((c) => c.id === draft.curriculumId);
  const disabled = saving || !draft.curriculumId || draft.name.trim().length < 2;
  return (
    <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); if (!disabled) onSubmit(draft); }}>
      <div><Label>Curriculum</Label><CurriculumSelect curricula={curricula} value={draft.curriculumId} onChange={(value) => setDraft({ ...draft, curriculumId: value, educationLevelId: "" })} /></div>
      <div><Label>Education level</Label><NativeSelect value={draft.educationLevelId} onChange={(e) => setDraft({ ...draft, educationLevelId: e.target.value })}><option value="">No level yet</option>{selected?.educationLevels.map((level) => <option key={level.id} value={level.id}>{level.name}</option>)}</NativeSelect></div>
      <div className="grid gap-3 sm:grid-cols-2"><div><Label>Grade name</Label><Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Year 9" /></div><div><Label>Short name</Label><Input value={draft.shortName} onChange={(e) => setDraft({ ...draft, shortName: e.target.value })} placeholder="Y9" /></div></div>
      <div className="grid gap-3 sm:grid-cols-3"><div><Label>Sequence</Label><Input type="number" min={1} value={draft.sequence} onChange={(e) => setDraft({ ...draft, sequence: Number(e.target.value) })} /></div><div><Label>Entry age</Label><Input type="number" min={2} value={draft.entryAge} onChange={(e) => setDraft({ ...draft, entryAge: e.target.value })} /></div><div><Label>Exit age</Label><Input type="number" min={2} value={draft.exitAge} onChange={(e) => setDraft({ ...draft, exitAge: e.target.value })} /></div></div>
      <FormActions saving={saving} disabled={disabled} onCancel={onCancel} submitLabel={initial?.id ? "Save grade band" : "Create grade band"} />
    </form>
  );
}

export function LearningAreaForm({ curricula, initial, saving = false, onSubmit, onCancel }: { curricula: CurriculumView[]; initial?: Partial<AreaDraft>; saving?: boolean; onSubmit: (draft: AreaDraft) => void; onCancel?: () => void }) {
  const [draft, setDraft] = React.useState<AreaDraft>({ id: initial?.id, curriculumId: initial?.curriculumId ?? curricula[0]?.id ?? "", name: initial?.name ?? "", code: initial?.code ?? "", description: initial?.description ?? "" });
  const disabled = saving || !draft.curriculumId || draft.name.trim().length < 2 || draft.code.trim().length < 2;
  return (
    <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); if (!disabled) onSubmit({ ...draft, code: draft.code.toUpperCase() }); }}>
      <div><Label>Curriculum</Label><CurriculumSelect curricula={curricula} value={draft.curriculumId} onChange={(value) => setDraft({ ...draft, curriculumId: value })} /></div>
      <div className="grid gap-3 sm:grid-cols-[1fr_9rem]"><div><Label>Learning area</Label><Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Mathematics" /></div><div><Label>Code</Label><Input value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value.toUpperCase() })} placeholder="MAT" /></div></div>
      <div><Label>Description</Label><Input value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} placeholder="What this learning area covers" /></div>
      <FormActions saving={saving} disabled={disabled} onCancel={onCancel} submitLabel={initial?.id ? "Save learning area" : "Create learning area"} />
    </form>
  );
}

function CurriculumSelect({ curricula, value, onChange }: { curricula: CurriculumView[]; value: string; onChange: (value: string) => void }) {
  return (
    <NativeSelect value={value} onChange={(event) => onChange(event.target.value)}>
      <option value="">Choose curriculum</option>
      {curricula.map((curriculum) => <option key={curriculum.id} value={curriculum.id}>{curriculum.name} · {curriculum.activeVersion}</option>)}
    </NativeSelect>
  );
}

function FormActions({ saving, disabled, onCancel, submitLabel }: { saving: boolean; disabled: boolean; onCancel?: () => void; submitLabel: string }) {
  return (
    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      {onCancel ? <Button type="button" variant="ghost" onClick={onCancel}><X className="h-4 w-4" /> Cancel</Button> : null}
      <Button type="submit" disabled={disabled}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {submitLabel}</Button>
    </div>
  );
}

export function CurriculumMappingReviewTable({ board }: { board: CurriculumBoardView }) {
  return (
    <TableContainer>
      <Table>
        <THead><TR><TH>Area</TH><TH>Total</TH><TH>Unmapped</TH><TH>Status</TH></TR></THead>
        <TBody>
          <MappingRow icon={BookOpen} label="Subjects" total={board.mappings.subjects.length} unmapped={board.summary.unmappedSubjects} />
          <MappingRow icon={School} label="Classes" total={board.mappings.classes.length} unmapped={board.summary.unmappedClasses} />
          <MappingRow icon={CalendarDays} label="Academic terms" total={board.mappings.terms.length} unmapped={board.summary.unmappedTerms} />
          <MappingRow icon={ListChecks} label="CBE strands" total={board.mappings.strands.length} unmapped={board.mappings.strands.filter((strand) => !strand.learningAreaId).length} />
        </TBody>
      </Table>
    </TableContainer>
  );
}

function MappingRow({ icon: Icon, label, total, unmapped }: { icon: LucideIcon; label: string; total: number; unmapped: number }) {
  return (
    <TR>
      <TD><span className="inline-flex items-center gap-2 font-medium"><Icon className="h-4 w-4 text-green-600" /> {label}</span></TD>
      <TD>{total}</TD>
      <TD className={unmapped ? "text-amber-600 dark:text-amber-300" : "text-green-700 dark:text-green-300"}>{unmapped}</TD>
      <TD><Badge tone={unmapped ? "amber" : "green"}>{unmapped ? "Needs mapping" : "Mapped"}</Badge></TD>
    </TR>
  );
}
