"use client";

/** PART J.4 — Competency Framework UI components. Presentational only. */
import * as React from "react";
import {
  AlertCircle,
  BarChart3,
  Brain,
  CheckCircle2,
  Eye,
  Layers,
  Lightbulb,
  Loader2,
  Plus,
  Save,
  ShieldCheck,
  Sparkles,
  Target,
  UserRoundCheck,
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

export interface CompetencyView {
  id: string;
  groupId: string | null;
  curriculumId: string | null;
  learningAreaId: string | null;
  name: string;
  code: string;
  description: string | null;
  sequence: number;
  active: boolean;
}

export interface CompetencyGroupView {
  id: string;
  curriculumId: string | null;
  name: string;
  code: string;
  description: string | null;
  sequence: number;
  active: boolean;
  competencies: CompetencyView[];
}

export interface CompetencySummaryView {
  groups: number;
  competencies: number;
  evidence: number;
  visibleEvidence: number;
  approvedEvidence: number;
}

export interface CompetencyBoardView {
  canManage: boolean;
  canRecordEvidence: boolean;
  canApproveEvidence: boolean;
  groups: CompetencyGroupView[];
  competencies: CompetencyView[];
  summary: CompetencySummaryView;
}

export interface StudentCompetencyItemView {
  competencyId: string;
  name: string;
  code: string;
  groupName: string | null;
  evidenceCount: number;
  averageLevel: number | null;
  latest: unknown;
}

export interface StudentCompetencySummaryView {
  student: { id: string; name: string; admissionNo: string; className: string | null };
  competencies: StudentCompetencyItemView[];
  totalEvidence: number;
}

export interface CompetencyHeatmapRowView {
  competencyId: string;
  competency: string;
  code: string;
  evidenceCount: number;
  learnerCount: number;
  averageLevel: number | null;
}

type GroupDraft = { id?: string; curriculumId: string; name: string; code: string; description: string; sequence: number; active: boolean };
type CompetencyDraft = { id?: string; groupId: string; curriculumId: string; learningAreaId: string; name: string; code: string; description: string; sequence: number; active: boolean };
type EvidenceDraft = { competencyId: string; studentId: string; sourceModule: string; sourceId: string; level: string; scorePct: string; narrative: string; evidenceDate: string };

const SOURCE_OPTIONS = ["CBC", "ASSESSMENT", "LMS", "MANUAL", "CLUB", "PORTFOLIO"];

function NativeSelect({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn("mt-1 h-12 w-full rounded-2xl border border-navy-200 bg-white/80 px-3.5 text-[15px] text-navy-900 outline-none transition-colors duration-200 ease-apple focus:border-navy-300 focus:ring-2 focus:ring-green-500/30 dark:border-navy-700 dark:bg-navy-900/80 dark:text-navy-50", className)} {...props} />;
}

function Stat({ icon: Icon, label, value, tone = "neutral" }: { icon: LucideIcon; label: string; value: string | number; tone?: "neutral" | "green" | "blue" | "amber" }) {
  const toneClass = { neutral: "bg-white/70 text-navy-700 dark:bg-navy-900/60 dark:text-navy-100", green: "bg-green-50/80 text-green-700 dark:bg-green-950/40 dark:text-green-200", blue: "bg-blue-50/80 text-blue-700 dark:bg-blue-950/40 dark:text-blue-200", amber: "bg-amber-50/80 text-amber-700 dark:bg-amber-950/40 dark:text-amber-200" }[tone];
  return <div className={cn("rounded-2xl border border-white/50 p-4 shadow-sm backdrop-blur-md dark:border-white/10", toneClass)}><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/70 shadow-sm dark:bg-navy-950/50"><Icon className="h-5 w-5" /></span><div><p className="text-xs font-medium uppercase tracking-[0.18em] opacity-70">{label}</p><p className="mt-0.5 text-2xl font-semibold tracking-tight">{value}</p></div></div></div>;
}

export function CompetencyFrameworkHero({ canManage, onSeedDefaults, onCreateCompetency }: { canManage: boolean; onSeedDefaults?: () => void; onCreateCompetency?: () => void }) {
  return <Card className="overflow-hidden border-white/40 bg-white/75 shadow-card backdrop-blur-xl dark:border-white/10 dark:bg-navy-950/70"><CardContent className="relative p-5 sm:p-7"><div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_top_right,rgba(31,157,95,0.16),transparent_34%),radial-gradient(circle_at_bottom_left,rgba(28,39,64,0.12),transparent_35%)]" /><div className="relative grid gap-5 lg:grid-cols-[1.35fr_0.9fr] lg:items-center"><div><Badge tone="green" className="mb-3"><ShieldCheck className="h-3.5 w-3.5" /> Competency Framework</Badge><h2 className="max-w-3xl text-2xl font-semibold tracking-tight text-navy-950 dark:text-white sm:text-3xl">Track growth beyond marks without locking NEYO to one curriculum.</h2><p className="mt-3 max-w-2xl text-sm leading-6 text-navy-600 dark:text-navy-300">Connect CBC observations, flexible assessments, LMS work and teacher notes into configurable competencies like Communication and Critical Thinking.</p><div className="mt-5 flex flex-wrap items-center gap-2">{canManage && onCreateCompetency ? <Button onClick={onCreateCompetency}><Plus className="h-4 w-4" /> New competency</Button> : null}{canManage && onSeedDefaults ? <Button variant="secondary" onClick={onSeedDefaults}><Sparkles className="h-4 w-4" /> Load core set</Button> : null}<Badge tone="blue"><Brain className="h-3.5 w-3.5" /> Skills and growth</Badge><Badge tone="neutral"><Target className="h-3.5 w-3.5" /> Evidence over time</Badge></div></div><div className="rounded-[1.75rem] border border-white/60 bg-white/65 p-4 shadow-card backdrop-blur-xl dark:border-white/10 dark:bg-navy-900/60"><div className="rounded-2xl bg-navy-950 p-4 text-white shadow-card dark:bg-white dark:text-navy-950"><div className="flex items-center gap-3"><Brain className="h-6 w-6 text-green-300 dark:text-green-600" /><div><p className="text-sm font-semibold">Competency layer</p><p className="text-xs opacity-75">Configurable · evidence-based · parent-safe</p></div></div></div><div className="mt-3 grid grid-cols-2 gap-2 text-xs">{["Groups", "Competencies", "Evidence", "Heatmaps"].map((label)=><div key={label} className="rounded-2xl border border-navy-100 bg-white/75 p-3 font-medium text-navy-700 dark:border-navy-800 dark:bg-navy-950/50 dark:text-navy-200">{label}</div>)}</div></div></div></CardContent></Card>;
}

export function CompetencySummaryGrid({ summary }: { summary: CompetencySummaryView }) {
  return <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5"><Stat icon={Layers} label="Groups" value={summary.groups} tone="green" /><Stat icon={Brain} label="Competencies" value={summary.competencies} tone="blue" /><Stat icon={Target} label="Evidence" value={summary.evidence} /><Stat icon={CheckCircle2} label="Approved" value={summary.approvedEvidence} /><Stat icon={Eye} label="Parent visible" value={summary.visibleEvidence} tone="amber" /></div>;
}

export function CompetencyLoadingState() { return <div className="space-y-4"><Skeleton className="h-44 rounded-2xl" /><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{[0,1,2,3,4].map((i)=><Skeleton key={i} className="h-24 rounded-2xl" />)}</div><Skeleton className="h-80 rounded-2xl" /></div>; }
export function CompetencyErrorState({ message = "Competencies could not load.", onRetry }: { message?: string; onRetry?: () => void }) { return <Card className="border-red-200/70 bg-red-50/80 dark:border-red-900/50 dark:bg-red-950/30"><CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-200"><AlertCircle className="h-5 w-5" /></span><div><p className="font-semibold text-red-900 dark:text-red-100">Could not load competencies</p><p className="mt-1 text-sm text-red-700 dark:text-red-200">{message}</p></div></div>{onRetry ? <Button variant="secondary" onClick={onRetry}>Try again</Button> : null}</CardContent></Card>; }
export function CompetencyEmptyState({ canManage, onSeedDefaults }: { canManage: boolean; onSeedDefaults?: () => void }) { return <EmptyState icon={Brain} title="No competency framework yet" description="Load the core competency set, then connect evidence from CBC observations, flexible assessments and teacher notes." action={canManage && onSeedDefaults ? <Button onClick={onSeedDefaults}><Sparkles className="h-4 w-4" /> Load core competencies</Button> : undefined} />; }

export function CompetencyGroupList({ groups, canManage, onCreateCompetency }: { groups: CompetencyGroupView[]; canManage: boolean; onCreateCompetency?: () => void }) {
  return <div className="grid gap-4 xl:grid-cols-2">{groups.map((group)=><Card key={group.id} className="border-white/40 bg-white/80 backdrop-blur-xl dark:border-white/10 dark:bg-navy-950/70"><CardHeader><div className="flex items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><CardTitle>{group.name}</CardTitle><Badge tone={group.active ? "green" : "neutral"}>{group.active ? "Active" : "Paused"}</Badge></div><p className="mt-1 text-xs font-mono text-navy-400">{group.code}</p>{group.description ? <p className="mt-2 text-sm text-navy-500 dark:text-navy-400">{group.description}</p> : null}</div>{canManage && onCreateCompetency ? <Button variant="secondary" size="sm" onClick={onCreateCompetency}><Plus className="h-4 w-4" /> Competency</Button> : null}</div></CardHeader><CardContent><div className="space-y-2">{group.competencies.length === 0 ? <p className="rounded-2xl border border-dashed border-navy-200 p-4 text-sm text-navy-400 dark:border-navy-800">No competencies in this group yet.</p> : group.competencies.map((competency)=><CompetencyCard key={competency.id} competency={competency} />)}</div></CardContent></Card>)}</div>;
}

export function CompetencyCard({ competency }: { competency: CompetencyView }) {
  return <div className="rounded-2xl border border-navy-100 bg-white/70 p-4 dark:border-navy-800 dark:bg-navy-900/45"><div className="flex flex-wrap items-center gap-2"><p className="font-semibold text-navy-900 dark:text-navy-50">{competency.name}</p><Badge tone={competency.active ? "green" : "neutral"}>{competency.active ? "Active" : "Paused"}</Badge></div><p className="mt-1 text-xs font-mono text-navy-400">{competency.code}</p>{competency.description ? <p className="mt-2 text-sm leading-6 text-navy-600 dark:text-navy-300">{competency.description}</p> : null}</div>;
}

export function CompetencyGroupForm({ saving=false, onSubmit, onCancel }: { saving?: boolean; onSubmit: (draft: GroupDraft) => void; onCancel?: () => void }) {
  const [draft,setDraft]=React.useState<GroupDraft>({ curriculumId:"", name:"", code:"", description:"", sequence:1, active:true });
  const disabled=saving || draft.name.length<2 || draft.code.length<2;
  return <form className="space-y-4" onSubmit={(e)=>{e.preventDefault(); if(!disabled) onSubmit({...draft, code:draft.code.toUpperCase()});}}><div className="grid gap-3 sm:grid-cols-2"><div><Label>Name</Label><Input value={draft.name} onChange={(e)=>setDraft({...draft,name:e.target.value})} placeholder="Core Competencies" /></div><div><Label>Code</Label><Input value={draft.code} onChange={(e)=>setDraft({...draft,code:e.target.value.toUpperCase()})} placeholder="CORE" /></div></div><div><Label>Description</Label><Input value={draft.description} onChange={(e)=>setDraft({...draft,description:e.target.value})} /></div><div><Label>Sequence</Label><Input type="number" value={draft.sequence} onChange={(e)=>setDraft({...draft,sequence:Number(e.target.value)})} /></div><Toggle label="Active" checked={draft.active} onChange={(v)=>setDraft({...draft,active:v})} /><Actions saving={saving} disabled={disabled} label="Save group" onCancel={onCancel} /></form>;
}

export function CompetencyForm({ groups, saving=false, onSubmit, onCancel }: { groups: CompetencyGroupView[]; saving?: boolean; onSubmit: (draft: CompetencyDraft) => void; onCancel?: () => void }) {
  const [draft,setDraft]=React.useState<CompetencyDraft>({ groupId: groups[0]?.id ?? "", curriculumId:"", learningAreaId:"", name:"", code:"", description:"", sequence:1, active:true });
  const disabled=saving || draft.name.length<2 || draft.code.length<2;
  return <form className="space-y-4" onSubmit={(e)=>{e.preventDefault(); if(!disabled) onSubmit({...draft, code:draft.code.toUpperCase()});}}><div><Label>Group</Label><NativeSelect value={draft.groupId} onChange={(e)=>setDraft({...draft,groupId:e.target.value})}><option value="">No group</option>{groups.map((g)=><option key={g.id} value={g.id}>{g.name}</option>)}</NativeSelect></div><div className="grid gap-3 sm:grid-cols-2"><div><Label>Name</Label><Input value={draft.name} onChange={(e)=>setDraft({...draft,name:e.target.value})} placeholder="Communication" /></div><div><Label>Code</Label><Input value={draft.code} onChange={(e)=>setDraft({...draft,code:e.target.value.toUpperCase()})} placeholder="COMMUNICATION" /></div></div><div><Label>Description</Label><Input value={draft.description} onChange={(e)=>setDraft({...draft,description:e.target.value})} /></div><div><Label>Sequence</Label><Input type="number" value={draft.sequence} onChange={(e)=>setDraft({...draft,sequence:Number(e.target.value)})} /></div><Toggle label="Active" checked={draft.active} onChange={(v)=>setDraft({...draft,active:v})} /><Actions saving={saving} disabled={disabled} label="Save competency" onCancel={onCancel} /></form>;
}

export function CompetencyEvidenceForm({ competencies, studentId="", saving=false, onSubmit, onCancel }: { competencies: CompetencyView[]; studentId?: string; saving?: boolean; onSubmit: (draft: EvidenceDraft) => void; onCancel?: () => void }) {
  const [draft,setDraft]=React.useState<EvidenceDraft>({ competencyId: competencies[0]?.id ?? "", studentId, sourceModule:"MANUAL", sourceId:"", level:"", scorePct:"", narrative:"", evidenceDate:new Date().toISOString().slice(0,10) });
  const disabled=saving || !draft.competencyId || !draft.studentId || (!draft.level && !draft.scorePct && !draft.narrative);
  return <form className="space-y-4" onSubmit={(e)=>{e.preventDefault(); if(!disabled) onSubmit(draft);}}><div><Label>Competency</Label><NativeSelect value={draft.competencyId} onChange={(e)=>setDraft({...draft,competencyId:e.target.value})}>{competencies.map((c)=><option key={c.id} value={c.id}>{c.name}</option>)}</NativeSelect></div><div><Label>Student ID</Label><Input value={draft.studentId} onChange={(e)=>setDraft({...draft,studentId:e.target.value})} /></div><div className="grid gap-3 sm:grid-cols-3"><div><Label>Source</Label><NativeSelect value={draft.sourceModule} onChange={(e)=>setDraft({...draft,sourceModule:e.target.value})}>{SOURCE_OPTIONS.map((s)=><option key={s} value={s}>{s}</option>)}</NativeSelect></div><div><Label>Level</Label><Input value={draft.level} onChange={(e)=>setDraft({...draft,level:e.target.value})} placeholder="1-4" /></div><div><Label>Score %</Label><Input value={draft.scorePct} onChange={(e)=>setDraft({...draft,scorePct:e.target.value})} /></div></div><div><Label>Narrative evidence</Label><Input value={draft.narrative} onChange={(e)=>setDraft({...draft,narrative:e.target.value})} /></div><div><Label>Evidence date</Label><Input type="date" value={draft.evidenceDate} onChange={(e)=>setDraft({...draft,evidenceDate:e.target.value})} /></div><Actions saving={saving} disabled={disabled} label="Record evidence" onCancel={onCancel} /></form>;
}

export function StudentCompetencySummaryCard({ summary }: { summary: StudentCompetencySummaryView }) {
  return <Card className="border-white/40 bg-white/80 backdrop-blur-xl dark:border-white/10 dark:bg-navy-950/70"><CardHeader><CardTitle className="flex items-center gap-2"><UserRoundCheck className="h-5 w-5 text-green-600" /> {summary.student.name}</CardTitle><p className="text-sm text-navy-500">{summary.student.admissionNo} · {summary.student.className ?? "No class"}</p></CardHeader><CardContent>{summary.competencies.length===0 ? <p className="text-sm text-navy-500">No approved competency evidence yet.</p> : <div className="space-y-2">{summary.competencies.map((c)=><div key={c.competencyId} className="rounded-2xl border border-navy-100 bg-white/70 p-3 dark:border-navy-800 dark:bg-navy-900/45"><div className="flex items-center justify-between"><p className="font-medium">{c.name}</p><Badge tone="blue">Level {c.averageLevel ?? "—"}</Badge></div><p className="text-xs text-navy-400">{c.evidenceCount} evidence point(s)</p></div>)}</div>}</CardContent></Card>;
}

export function CompetencyHeatmapTable({ rows }: { rows: CompetencyHeatmapRowView[] }) {
  return <TableContainer><Table><THead><TR><TH>Competency</TH><TH>Learners</TH><TH>Evidence</TH><TH>Average level</TH></TR></THead><TBody>{rows.map((r)=><TR key={r.competencyId}><TD><div className="font-medium">{r.competency}</div><div className="text-xs text-navy-400">{r.code}</div></TD><TD>{r.learnerCount}</TD><TD>{r.evidenceCount}</TD><TD><Badge tone="green">{r.averageLevel ?? "—"}</Badge></TD></TR>)}</TBody></Table></TableContainer>;
}

function Toggle({ label, checked, onChange }: { label:string; checked:boolean; onChange:(value:boolean)=>void }) { return <label className="flex items-center gap-3 rounded-2xl border border-navy-100 bg-white/60 p-3 text-sm font-medium text-navy-700 dark:border-navy-800 dark:bg-navy-900/50 dark:text-navy-200"><input type="checkbox" checked={checked} onChange={(e)=>onChange(e.target.checked)} className="h-4 w-4 rounded border-navy-300 text-green-600" />{label}</label>; }
function Actions({ saving, disabled, label, onCancel }: { saving:boolean; disabled:boolean; label:string; onCancel?:()=>void }) { return <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">{onCancel ? <Button type="button" variant="ghost" onClick={onCancel}><X className="h-4 w-4" /> Cancel</Button> : null}<Button type="submit" disabled={disabled}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {label}</Button></div>; }
