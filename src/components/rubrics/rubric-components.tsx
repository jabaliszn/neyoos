"use client";

/**
 * PART J.5 — Rubrics & Evidence UI Components.
 *
 * Liquid Glass-ready reusable components for the rubric administration and
 * teacher scoring surfaces. All components are presentational/forms only and
 * intentionally do not fetch directly; page/API wiring comes in Chunk 6.
 */
import * as React from "react";
import {
  ListChecks, Target, Sparkles, Layers, ShieldCheck, UploadCloud,
  Eye, CheckCircle2, AlertCircle, Loader2, Plus, Save, X, Archive,
  Trash2, FileText, FileCheck2, Award, RefreshCw, Bookmark,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { FileUpload, type UploadedFile } from "@/components/ui/file-upload";
import { TableContainer, Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { RUBRIC_CATEGORIES } from "@/lib/validations/rubric";

export interface RubricLevelView {
  id: string;
  level: number;
  code: string;
  label: string;
  descriptor: string | null;
  points: number | null;
}

export interface RubricView {
  id: string;
  name: string;
  description: string | null;
  category: string;
  isArchived: boolean;
  levels: RubricLevelView[];
}

// ---- 1. Rubric Hero --------------------------------------------------------
export function RubricHero({ canManage, onSeedDefaults, onNewRubric, seeding }: {
  canManage: boolean;
  onSeedDefaults: () => void;
  onNewRubric: () => void;
  seeding: boolean;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/40 bg-gradient-to-r from-navy-900/80 to-navy-850/80 p-6 backdrop-blur-2xl dark:border-white/10 dark:from-navy-950/80 dark:to-navy-900/80 sm:p-8">
      <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Badge tone="green" className="border border-green-400/30 px-2.5 py-1 text-xs font-semibold uppercase tracking-wider">
              Education OS · Rubrics & Evidence
            </Badge>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Structured Evaluation & Rubric Framework
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-navy-100 dark:text-navy-200">
            Formal exams, CBC observations and LMS work stay intact. Rubrics provide structured evaluation for projects, practicals, portfolios and competencies to track growth beyond marks.
          </p>
        </div>
        {canManage && (
          <div className="flex shrink-0 flex-wrap items-center gap-3">
            <Button variant="secondary" onClick={onSeedDefaults} disabled={seeding} className="rounded-full backdrop-blur-xl">
              {seeding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4 text-green-400" />}
              Seed default rubrics
            </Button>
            <Button onClick={onNewRubric} className="rounded-full bg-green-600 hover:bg-green-500 text-white shadow-card">
              <Plus className="h-4 w-4" /> New rubric
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// ---- 2. Rubric Summary Grid ------------------------------------------------
export function RubricSummaryGrid({ total, active, archived }: { total: number; active: number; archived: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <Card className="border-white/40 bg-white/80 backdrop-blur-xl dark:border-white/10 dark:bg-navy-950/70">
        <CardContent className="flex items-center justify-between p-6">
          <div className="space-y-1">
            <p className="text-sm font-medium text-navy-500 dark:text-navy-400">Total Rubrics</p>
            <p className="text-2xl font-bold text-navy-900 dark:text-navy-50">{total}</p>
          </div>
          <div className="rounded-2xl bg-navy-50 p-3 dark:bg-navy-900/50">
            <ListChecks className="h-6 w-6 text-navy-600 dark:text-navy-300" />
          </div>
        </CardContent>
      </Card>
      <Card className="border-white/40 bg-white/80 backdrop-blur-xl dark:border-white/10 dark:bg-navy-950/70">
        <CardContent className="flex items-center justify-between p-6">
          <div className="space-y-1">
            <p className="text-sm font-medium text-navy-500 dark:text-navy-400">Active Definitions</p>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">{active}</p>
          </div>
          <div className="rounded-2xl bg-green-50 p-3 dark:bg-green-900/20">
            <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
          </div>
        </CardContent>
      </Card>
      <Card className="border-white/40 bg-white/80 backdrop-blur-xl dark:border-white/10 dark:bg-navy-950/70">
        <CardContent className="flex items-center justify-between p-6">
          <div className="space-y-1">
            <p className="text-sm font-medium text-navy-500 dark:text-navy-400">Archived</p>
            <p className="text-2xl font-bold text-navy-600 dark:text-navy-400">{archived}</p>
          </div>
          <div className="rounded-2xl bg-navy-50 p-3 dark:bg-navy-900/50">
            <Archive className="h-6 w-6 text-navy-500 dark:text-navy-400" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ---- 3. Mandatory UX States ------------------------------------------------
export function RubricLoadingState() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-32 w-full rounded-2xl" />
      <div className="grid gap-4 sm:grid-cols-3">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {[1, 2].map((i) => <Skeleton key={i} className="h-64 rounded-2xl" />)}
      </div>
    </div>
  );
}

export function RubricErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <Card className="border-red-200 bg-red-50/80 backdrop-blur-xl dark:border-red-900/50 dark:bg-red-950/40">
      <CardContent className="flex flex-col items-center justify-center gap-4 p-8 text-center">
        <div className="rounded-full bg-red-100 p-3 dark:bg-red-900/50">
          <AlertCircle className="h-8 w-8 text-red-600 dark:text-red-400" />
        </div>
        <div className="space-y-1">
          <p className="text-base font-semibold text-red-900 dark:text-red-200">Unable to load rubric framework</p>
          <p className="text-sm text-red-600 dark:text-red-400">Please check your connection and try again.</p>
        </div>
        <Button onClick={onRetry} variant="secondary" className="rounded-full bg-white dark:bg-navy-900">
          <RefreshCw className="h-4 w-4" /> Try again
        </Button>
      </CardContent>
    </Card>
  );
}

export function RubricEmptyState({ canManage, onSeedDefaults, onNewRubric }: {
  canManage: boolean;
  onSeedDefaults: () => void;
  onNewRubric: () => void;
}) {
  return (
    <EmptyState
      icon={ListChecks}
      title="No rubrics configured yet"
      description="Start by seeding the default CBC and Project rubrics, or create a custom rubric definition for your school's unique evaluation needs."
      primaryAction={canManage ? { label: "Seed default rubrics", onClick: onSeedDefaults } : undefined}
      secondaryAction={canManage ? { label: "Create custom rubric", onClick: onNewRubric } : undefined}
    />
  );
}

// ---- 4. Rubric Card --------------------------------------------------------
export function RubricCard({ rubric, canManage, onEdit, onToggleArchive, busy }: {
  rubric: RubricView;
  canManage: boolean;
  onEdit: () => void;
  onToggleArchive: () => void;
  busy: boolean;
}) {
  return (
    <Card className="flex flex-col justify-between border-white/40 bg-white/80 backdrop-blur-xl transition-all duration-200 ease-apple hover:shadow-card dark:border-white/10 dark:bg-navy-950/70">
      <div>
        <CardHeader className="flex flex-row items-start justify-between gap-4 pb-3">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={rubric.category === "CBC" ? "green" : rubric.category === "PROJECT" ? "blue" : "amber"}>
                {rubric.category}
              </Badge>
              {rubric.isArchived && <Badge tone="neutral">Archived</Badge>}
            </div>
            <CardTitle className="text-lg font-bold text-navy-900 dark:text-navy-50">{rubric.name}</CardTitle>
            {rubric.description && <p className="text-sm text-navy-500 dark:text-navy-400">{rubric.description}</p>}
          </div>
          {canManage && (
            <div className="flex items-center gap-1.5">
              <Button size="sm" variant="ghost" onClick={onEdit} disabled={busy} className="rounded-full">
                Edit
              </Button>
              <Button size="sm" variant="ghost" onClick={onToggleArchive} disabled={busy} className="rounded-full text-navy-500 hover:text-red-600">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : rubric.isArchived ? "Restore" : "Archive"}
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-2.5 pt-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-navy-400">Levels & Descriptors</p>
          <div className="space-y-2">
            {rubric.levels.map((l) => (
              <div key={l.id} className="rounded-2xl border border-navy-100 bg-white/60 p-3.5 dark:border-navy-800 dark:bg-navy-900/40">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-navy-900 text-xs font-bold text-white dark:bg-navy-100 dark:text-navy-900">
                      {l.level}
                    </span>
                    <span className="font-semibold text-navy-900 dark:text-navy-100">{l.label}</span>
                    <Badge tone="neutral" className="font-mono text-xs">{l.code}</Badge>
                  </div>
                  {l.points !== null && (
                    <Badge tone="green" className="font-semibold">
                      {l.points} pts
                    </Badge>
                  )}
                </div>
                {l.descriptor && <p className="mt-1.5 text-sm text-navy-600 dark:text-navy-300">{l.descriptor}</p>}
              </div>
            ))}
          </div>
        </CardContent>
      </div>
    </Card>
  );
}

// ---- 5. Rubric Modal Form --------------------------------------------------
export function RubricForm({ initial, onSubmit, onClose, saving }: {
  initial?: RubricView;
  onSubmit: (data: { name: string; description: string; category: string; isArchived: boolean; levels: { level: number; code: string; label: string; descriptor: string; points: number | null }[] }) => void;
  onClose: () => void;
  saving: boolean;
}) {
  const [name, setName] = React.useState(initial?.name ?? "");
  const [description, setDescription] = React.useState(initial?.description ?? "");
  const [category, setCategory] = React.useState(initial?.category ?? "GENERAL");
  const [isArchived, setIsArchived] = React.useState(initial?.isArchived ?? false);
  const [levels, setLevels] = React.useState(
    initial?.levels.map((l) => ({ level: l.level, code: l.code, label: l.label, descriptor: l.descriptor ?? "", points: l.points })) ?? [
      { level: 4, code: "EE", label: "Exceeding Expectation", descriptor: "", points: 100 },
      { level: 3, code: "ME", label: "Meeting Expectation", descriptor: "", points: 75 },
      { level: 2, code: "AE", label: "Approaching Expectation", descriptor: "", points: 50 },
      { level: 1, code: "BE", label: "Below Expectation", descriptor: "", points: 25 },
    ]
  );

  function addLevel() {
    const nextLevel = levels.length > 0 ? Math.max(...levels.map((l) => l.level)) + 1 : 1;
    setLevels([...levels, { level: nextLevel, code: `L${nextLevel}`, label: `Level ${nextLevel}`, descriptor: "", points: null }]);
  }
  function removeLevel(index: number) {
    setLevels(levels.filter((_, i) => i !== index));
  }
  function updateLevel(index: number, field: string, value: any) {
    const copy = [...levels];
    copy[index] = { ...copy[index], [field]: value };
    setLevels(copy);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({ name, description, category, isArchived, levels });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <div className="fixed inset-0 bg-navy-900/40 backdrop-blur-sm dark:bg-navy-950/60" onClick={onClose} />
      <Card className="relative z-10 w-full max-w-3xl overflow-hidden border-white/40 bg-white/90 backdrop-blur-2xl dark:border-white/10 dark:bg-navy-950/90 shadow-2xl">
        <form onSubmit={handleSubmit}>
          <CardHeader className="flex flex-row items-center justify-between border-b border-navy-100 px-6 py-4 dark:border-navy-800">
            <CardTitle className="text-lg font-bold">{initial ? "Edit Rubric Definition" : "Create New Rubric"}</CardTitle>
            <Button type="button" variant="ghost" onClick={onClose} className="rounded-full p-2.5">
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className="max-h-[min(82dvh,46rem)] overflow-y-auto p-6 space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Rubric Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. 5-Level Project Rubric" required />
              </div>
              <div className="space-y-1.5">
                <Label>Category</Label>
                <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full rounded-2xl border border-navy-200 bg-white p-2.5 text-sm dark:border-navy-700 dark:bg-navy-900">
                  {RUBRIC_CATEGORIES.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Archive Status</Label>
                <label className="flex h-10 items-center gap-3 rounded-2xl border border-navy-100 bg-white/60 px-4 text-sm font-medium dark:border-navy-800 dark:bg-navy-900/50">
                  <input type="checkbox" checked={isArchived} onChange={(e) => setIsArchived(e.target.checked)} className="h-4 w-4 rounded text-green-600" />
                  Archived (hide from selection)
                </label>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Description (optional)</Label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Explain when and how this rubric is used..." className="w-full rounded-2xl border border-navy-200 bg-white p-3 text-sm dark:border-navy-700 dark:bg-navy-900" rows={2} />
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-base font-bold">Rubric Levels ({levels.length})</Label>
                <Button type="button" variant="secondary" onClick={addLevel} size="sm" className="rounded-full">
                  <Plus className="h-3.5 w-3.5" /> Add Level
                </Button>
              </div>
              <div className="space-y-4">
                {levels.map((l, i) => (
                  <div key={i} className="relative rounded-2xl border border-navy-100 bg-navy-50/50 p-4 dark:border-navy-800 dark:bg-navy-900/30 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="w-20 space-y-1">
                          <Label className="text-xs">Level #</Label>
                          <Input type="number" value={l.level} onChange={(e) => updateLevel(i, "level", parseInt(e.target.value) || 1)} min={1} max={20} required />
                        </div>
                        <div className="w-28 space-y-1">
                          <Label className="text-xs">Code</Label>
                          <Input value={l.code} onChange={(e) => updateLevel(i, "code", e.target.value)} placeholder="EE, PASS..." required />
                        </div>
                        <div className="flex-1 min-w-[140px] space-y-1">
                          <Label className="text-xs">Label</Label>
                          <Input value={l.label} onChange={(e) => updateLevel(i, "label", e.target.value)} placeholder="Exceeding Expectation..." required />
                        </div>
                        <div className="w-24 space-y-1">
                          <Label className="text-xs">Points (opt)</Label>
                          <Input type="number" value={l.points ?? ""} onChange={(e) => updateLevel(i, "points", e.target.value ? parseFloat(e.target.value) : null)} placeholder="100..." min={0} max={1000} />
                        </div>
                      </div>
                      <Button type="button" variant="ghost" onClick={() => removeLevel(i)} className="rounded-full p-2 text-navy-400 hover:text-red-600">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Descriptor</Label>
                      <textarea value={l.descriptor} onChange={(e) => updateLevel(i, "descriptor", e.target.value)} placeholder="Detailed evaluation criteria for this level..." className="w-full rounded-xl border border-navy-200 bg-white p-2 text-xs dark:border-navy-700 dark:bg-navy-900" rows={2} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
          <div className="flex items-center justify-end gap-3 border-t border-navy-100 bg-navy-50/50 px-6 py-4 dark:border-navy-800 dark:bg-navy-900/50">
            <Button type="button" variant="ghost" onClick={onClose} disabled={saving} className="rounded-full">Cancel</Button>
            <Button type="submit" disabled={saving || levels.length === 0} className="rounded-full bg-green-600 hover:bg-green-500 text-white">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save Rubric
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

// ---- 6. Teacher Rubric Scoring Panel ---------------------------------------
export function TeacherRubricScoringPanel({ rubric, onScore, saving, initialLevel, initialCode, initialNarrative }: {
  rubric: RubricView;
  onScore: (data: { rubricLevel: number; rubricCode: string; points: number | null; narrative: string }) => void;
  saving: boolean;
  initialLevel?: number;
  initialCode?: string;
  initialNarrative?: string;
}) {
  const [selectedLevel, setSelectedLevel] = React.useState<number | null>(initialLevel ?? null);
  const [selectedCode, setSelectedCode] = React.useState<string | null>(initialCode ?? null);
  const [pointsOverride, setPointsOverride] = React.useState<number | null>(null);
  const [narrative, setNarrative] = React.useState(initialNarrative ?? "");

  const selectedLevelData = rubric.levels.find((l) => l.level === selectedLevel && l.code === selectedCode);

  function handleSelect(level: number, code: string, points: number | null) {
    setSelectedLevel(level);
    setSelectedCode(code);
    setPointsOverride(points);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (selectedLevel !== null && selectedCode !== null) {
      onScore({ rubricLevel: selectedLevel, rubricCode: selectedCode, points: pointsOverride, narrative });
    }
  }

  return (
    <Card className="border-white/40 bg-white/80 backdrop-blur-xl dark:border-white/10 dark:bg-navy-950/70">
      <form onSubmit={handleSubmit}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5 text-green-600" /> Rubric Evaluation: {rubric.name}
            </CardTitle>
            <Badge tone="green">{rubric.category}</Badge>
          </div>
          {rubric.description && <p className="text-sm text-navy-500 dark:text-navy-400">{rubric.description}</p>}
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <Label className="text-sm font-semibold">Select Level of Mastery</Label>
            <div className="grid gap-3 sm:grid-cols-2">
              {rubric.levels.map((l) => {
                const isSelected = l.level === selectedLevel && l.code === selectedCode;
                return (
                  <button
                    type="button"
                    key={l.id}
                    onClick={() => handleSelect(l.level, l.code, l.points)}
                    className={`flex flex-col justify-between rounded-2xl border p-4 text-left transition-all duration-200 ease-apple ${
                      isSelected
                        ? "border-green-600 bg-green-50/80 shadow-md dark:border-green-500 dark:bg-green-950/40"
                        : "border-navy-100 bg-white/60 hover:bg-white dark:border-navy-800 dark:bg-navy-900/40"
                    }`}
                  >
                    <div className="w-full space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${isSelected ? "bg-green-600 text-white" : "bg-navy-900 text-white dark:bg-navy-100 dark:text-navy-900"}`}>
                            {l.level}
                          </span>
                          <span className="font-bold text-navy-900 dark:text-navy-50">{l.label}</span>
                          <Badge tone={isSelected ? "green" : "neutral"} className="font-mono text-xs">{l.code}</Badge>
                        </div>
                        {l.points !== null && (
                          <Badge tone={isSelected ? "green" : "neutral"} className="font-semibold">
                            {l.points} pts
                          </Badge>
                        )}
                      </div>
                      {l.descriptor && <p className="text-xs leading-relaxed text-navy-600 dark:text-navy-300">{l.descriptor}</p>}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {selectedLevelData && selectedLevelData.points !== null && (
            <div className="space-y-1.5 w-40">
              <Label>Assigned Points</Label>
              <Input type="number" value={pointsOverride ?? ""} onChange={(e) => setPointsOverride(e.target.value ? parseFloat(e.target.value) : null)} placeholder={`${selectedLevelData.points}`} min={0} max={1000} />
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Teacher Narrative & Qualitative Observations</Label>
            <textarea value={narrative} onChange={(e) => setNarrative(e.target.value)} placeholder="Provide qualitative feedback supporting this rubric score..." className="w-full rounded-2xl border border-navy-200 bg-white p-3 text-sm dark:border-navy-700 dark:bg-navy-900" rows={3} />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button type="submit" disabled={saving || selectedLevel === null} className="rounded-full bg-green-600 hover:bg-green-500 text-white shadow-card">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save Evaluation
            </Button>
          </div>
        </CardContent>
      </form>
    </Card>
  );
}

// ---- 7. Rubric Evidence Upload Card ----------------------------------------
export function RubricEvidenceUploadCard({ onAttachEvidence, uploading }: {
  onAttachEvidence: (data: { storedFileId: string; fileUrl: string; fileName: string; contentType?: string; evidenceType: string; note: string }) => void;
  uploading: boolean;
}) {
  const [file, setFile] = React.useState<UploadedFile | null>(null);
  const [evidenceType, setEvidenceType] = React.useState("FILE");
  const [note, setNote] = React.useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (file) {
      onAttachEvidence({ storedFileId: file.id, fileUrl: file.url, fileName: file.fileName, contentType: file.contentType ?? undefined, evidenceType, note });
    }
  }

  return (
    <Card className="border-white/40 bg-white/80 backdrop-blur-xl dark:border-white/10 dark:bg-navy-950/70">
      <form onSubmit={handleSubmit}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UploadCloud className="h-5 w-5 text-green-600" /> Attach Supporting Evidence
          </CardTitle>
          <p className="text-sm text-navy-500 dark:text-navy-400">
            Evidence uploads use the encrypted Storage Vault path to ensure absolute student privacy and data security.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Select File (Encrypted Storage Vault)</Label>
              <FileUpload onUploaded={(u) => setFile(u)} category="evidence" />
              {file && (
                <div className="flex items-center gap-2 mt-2 text-sm font-medium text-green-600 dark:text-green-400">
                  <CheckCircle2 className="h-4 w-4" /> {file.fileName} (Ready to attach)
                </div>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Evidence Type</Label>
              <select value={evidenceType} onChange={(e) => setEvidenceType(e.target.value)} className="w-full rounded-2xl border border-navy-200 bg-white p-2.5 text-sm dark:border-navy-700 dark:bg-navy-900">
                {["FILE", "LINK", "NOTE", "PHOTO", "VIDEO", "CERTIFICATE"].map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Teacher Note / Context</Label>
              <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add specific details about what this evidence proves..." className="w-full rounded-2xl border border-navy-200 bg-white p-3 text-sm dark:border-navy-700 dark:bg-navy-900" rows={2} />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button type="submit" disabled={uploading || !file} className="rounded-full bg-green-600 hover:bg-green-500 text-white shadow-card">
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Attach Evidence
            </Button>
          </div>
        </CardContent>
      </form>
    </Card>
  );
}
