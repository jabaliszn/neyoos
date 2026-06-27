"use client";

import * as React from "react";
import { Brain, Layers, Plus, Target, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import {
  CompetencyEmptyState,
  CompetencyErrorState,
  CompetencyEvidenceForm,
  CompetencyForm,
  CompetencyFrameworkHero,
  CompetencyGroupForm,
  CompetencyGroupList,
  CompetencyHeatmapTable,
  CompetencyLoadingState,
  CompetencySummaryGrid,
  StudentCompetencySummaryCard,
  type CompetencyBoardView,
  type CompetencyHeatmapRowView,
  type StudentCompetencySummaryView,
} from "@/components/competencies/competency-framework-components";

const EMPTY_BOARD: CompetencyBoardView = {
  canManage: false,
  canRecordEvidence: false,
  canApproveEvidence: false,
  groups: [],
  competencies: [],
  summary: { groups: 0, competencies: 0, evidence: 0, visibleEvidence: 0, approvedEvidence: 0 },
};

type ModalState =
  | { type: "group" }
  | { type: "competency" }
  | { type: "evidence" }
  | null;

function compactPayload<T extends Record<string, unknown>>(payload: T) {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (value === "" || value === undefined || value === null) continue;
    out[key] = value;
  }
  return out;
}

export function CompetencyFrameworkClient() {
  const { toast } = useToast();
  const [board, setBoard] = React.useState<CompetencyBoardView | null>(null);
  const [heatmap, setHeatmap] = React.useState<CompetencyHeatmapRowView[]>([]);
  const [studentSummary, setStudentSummary] = React.useState<StudentCompetencySummaryView | null>(null);
  const [studentId, setStudentId] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [modal, setModal] = React.useState<ModalState>(null);
  const [saving, setSaving] = React.useState(false);

  const load = React.useCallback(async () => {
    setError(null);
    try {
      const [boardRes, heatmapRes] = await Promise.all([
        fetch("/api/competencies", { cache: "no-store" }),
        fetch("/api/competencies?heatmap=1", { cache: "no-store" }),
      ]);
      const boardJson = await boardRes.json();
      const heatmapJson = await heatmapRes.json();
      if (!boardJson.ok) {
        setBoard(EMPTY_BOARD);
        setError(boardJson.error?.message || "Competencies could not load.");
        return;
      }
      setBoard(boardJson.data.board);
      if (heatmapJson.ok) setHeatmap(heatmapJson.data.heatmap);
    } catch {
      setBoard(EMPTY_BOARD);
      setError("Check your connection and try again.");
    }
  }, []);

  React.useEffect(() => { void load(); }, [load]);

  async function post(action: string, payload: Record<string, unknown>, successTitle: string) {
    setSaving(true);
    try {
      const res = await fetch("/api/competencies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, payload }),
      });
      const json = await res.json();
      if (!json.ok) {
        toast({ title: json.error?.message || "Competency action failed", tone: "error" });
        return null;
      }
      toast({ title: successTitle, tone: "success" });
      await load();
      return json.data.result;
    } catch {
      toast({ title: "Could not reach the competency endpoint", tone: "error" });
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function loadStudentSummary(id: string) {
    if (!id.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/competencies?studentId=${encodeURIComponent(id.trim())}`, { cache: "no-store" });
      const json = await res.json();
      if (!json.ok) {
        toast({ title: json.error?.message || "Could not load learner competency summary", tone: "error" });
        return;
      }
      setStudentSummary(json.data.summary);
    } finally {
      setSaving(false);
    }
  }

  const currentBoard = board ?? EMPTY_BOARD;

  if (!board && !error) return <CompetencyLoadingState />;
  if (error && currentBoard.groups.length === 0) return <CompetencyErrorState message={error} onRetry={load} />;

  return (
    <div className="space-y-5">
      <CompetencyFrameworkHero
        canManage={currentBoard.canManage}
        onSeedDefaults={() => post("seed_defaults", {}, "Core competencies loaded")}
        onCreateCompetency={() => setModal({ type: "competency" })}
      />
      {error ? <CompetencyErrorState message={error} onRetry={load} /> : null}
      <CompetencySummaryGrid summary={currentBoard.summary} />

      {currentBoard.groups.length === 0 ? (
        <CompetencyEmptyState canManage={currentBoard.canManage} onSeedDefaults={() => post("seed_defaults", {}, "Core competencies loaded")} />
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {currentBoard.canManage ? <Button onClick={() => setModal({ type: "group" })}><Plus className="h-4 w-4" /> New group</Button> : null}
            {currentBoard.canRecordEvidence ? <Button variant="secondary" onClick={() => setModal({ type: "evidence" })}><Target className="h-4 w-4" /> Record evidence</Button> : null}
          </div>
          <CompetencyGroupList groups={currentBoard.groups} canManage={currentBoard.canManage} onCreateCompetency={() => setModal({ type: "competency" })} />
        </>
      )}

      <div className="grid gap-4 xl:grid-cols-[1fr_0.9fr]">
        <Card className="border-white/40 bg-white/80 backdrop-blur-xl dark:border-white/10 dark:bg-navy-950/70">
          <CardHeader><CardTitle className="flex items-center gap-2"><Layers className="h-5 w-5 text-green-600" /> Competency heatmap</CardTitle></CardHeader>
          <CardContent>{heatmap.length ? <CompetencyHeatmapTable rows={heatmap} /> : <p className="text-sm text-navy-500">No competency evidence yet.</p>}</CardContent>
        </Card>
        <Card className="border-white/40 bg-white/80 backdrop-blur-xl dark:border-white/10 dark:bg-navy-950/70">
          <CardHeader><CardTitle className="flex items-center gap-2"><Brain className="h-5 w-5 text-green-600" /> Learner summary</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2"><input value={studentId} onChange={(e) => setStudentId(e.target.value)} placeholder="Paste student ID" className="h-11 flex-1 rounded-2xl border border-navy-200 bg-white/80 px-3 text-sm outline-none dark:border-navy-700 dark:bg-navy-900/80" /><Button variant="secondary" disabled={saving} onClick={() => loadStudentSummary(studentId)}>Load</Button></div>
            {studentSummary ? <StudentCompetencySummaryCard summary={studentSummary} /> : <p className="text-sm text-navy-500">Load a learner to see approved competency evidence.</p>}
          </CardContent>
        </Card>
      </div>

      {modal ? (
        <CompetencyModal title={modalTitle(modal)} icon={modalIcon(modal)} onClose={() => setModal(null)}>
          {modal.type === "group" ? (
            <CompetencyGroupForm saving={saving} onCancel={() => setModal(null)} onSubmit={(draft) => post("create_group", compactPayload(draft), "Competency group created").then((ok) => ok ? setModal(null) : null)} />
          ) : null}
          {modal.type === "competency" ? (
            <CompetencyForm groups={currentBoard.groups} saving={saving} onCancel={() => setModal(null)} onSubmit={(draft) => post("create_competency", compactPayload(draft), "Competency created").then((ok) => ok ? setModal(null) : null)} />
          ) : null}
          {modal.type === "evidence" ? (
            <CompetencyEvidenceForm competencies={currentBoard.competencies} saving={saving} onCancel={() => setModal(null)} onSubmit={(draft) => post("record_evidence", compactPayload({ ...draft, level: draft.level ? Number(draft.level) : undefined, scorePct: draft.scorePct ? Number(draft.scorePct) : undefined }), "Competency evidence recorded").then((ok) => ok ? setModal(null) : null)} />
          ) : null}
        </CompetencyModal>
      ) : null}
    </div>
  );
}

function modalTitle(modal: NonNullable<ModalState>) {
  if (modal.type === "group") return "New competency group";
  if (modal.type === "competency") return "New competency";
  return "Record competency evidence";
}
function modalIcon(_modal: NonNullable<ModalState>): LucideIcon { return Brain; }

function CompetencyModal({ title, icon: Icon, children, onClose }: { title: string; icon: LucideIcon; children: React.ReactNode; onClose: () => void }) {
  return <div className="fixed inset-0 z-[70] flex items-center justify-center bg-navy-950/35 p-3 backdrop-blur-md"><Card className="max-h-[min(92dvh,44rem)] w-full max-w-3xl overflow-hidden border-white/50 bg-white/95 shadow-2xl backdrop-blur-xl dark:border-white/10 dark:bg-navy-950/95"><CardHeader className="sticky top-0 z-10 border-b border-navy-100 bg-white/90 backdrop-blur-xl dark:border-navy-800 dark:bg-navy-950/90"><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-200"><Icon className="h-5 w-5" /></span><div><CardTitle>{title}</CardTitle><Badge tone="neutral" className="mt-1">Competency Framework</Badge></div></div><Button variant="ghost" size="sm" onClick={onClose} aria-label="Close">×</Button></div></CardHeader><CardContent className="max-h-[calc(min(92dvh,44rem)-6rem)] overflow-y-auto p-5 sm:p-6">{children}</CardContent></Card></div>;
}
