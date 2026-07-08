"use client";

/** Connected J.3 Flexible Assessment Engine client. */
import * as React from "react";
import { ClipboardList, FileCheck2, GraduationCap, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import {
  AssessmentEmptyState,
  AssessmentEngineHero,
  AssessmentErrorState,
  AssessmentEvidenceForm,
  AssessmentLoadingState,
  AssessmentPlanCard,
  AssessmentPlanForm,
  AssessmentReleasePanel,
  AssessmentScoreForm,
  AssessmentSheetTable,
  AssessmentSummaryGrid,
  AssessmentTypeCatalog,
  AssessmentTypeForm,
  type AssessmentBoardView,
  type AssessmentPlanView,
  type AssessmentSheetStudentView,
  type AssessmentSheetView,
  type AssessmentTypeView,
} from "@/components/assessments/assessment-engine-components";
import { TeacherRubricScoringPanel, RubricEvidenceUploadCard, type RubricView } from "@/components/rubrics/rubric-components";

const EMPTY_BOARD: AssessmentBoardView = {
  canManagePlans: false,
  canScore: false,
  canModerate: false,
  canRelease: false,
  types: [],
  plans: [],
  summary: { types: 0, plans: 0, records: 0, evidence: 0, releasedPlans: 0 },
};

type ModalState =
  | { type: "type"; assessmentType?: AssessmentTypeView }
  | { type: "plan"; plan?: AssessmentPlanView }
  | { type: "sheet"; plan: AssessmentPlanView }
  | { type: "score"; sheet: AssessmentSheetView; student: AssessmentSheetStudentView }
  | { type: "evidence"; recordId: string }
  | { type: "release"; plan: AssessmentPlanView }
  | null;

function compactPayload<T extends Record<string, unknown>>(payload: T) {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (value === "" || value === undefined || value === null) continue;
    out[key] = value;
  }
  return out;
}

export function AssessmentEngineClient() {
  const { toast } = useToast();
  const [board, setBoard] = React.useState<AssessmentBoardView | null>(null);
  const [sheet, setSheet] = React.useState<AssessmentSheetView | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [modal, setModal] = React.useState<ModalState>(null);
  const [saving, setSaving] = React.useState(false);

  const load = React.useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/assessments", { cache: "no-store" });
      const json = await res.json();
      if (!json.ok) {
        setBoard(EMPTY_BOARD);
        setError(json.error?.message || "Assessments could not load.");
        return;
      }
      setBoard(json.data.board);
    } catch {
      setBoard(EMPTY_BOARD);
      setError("Check your connection and try again.");
    }
  }, []);

  React.useEffect(() => { void load(); }, [load]);

  async function loadSheet(plan: AssessmentPlanView) {
    setSaving(true);
    try {
      const res = await fetch(`/api/assessments?planId=${encodeURIComponent(plan.id)}`, { cache: "no-store" });
      const json = await res.json();
      if (!json.ok) {
        toast({ title: json.error?.message || "Could not open assessment sheet", tone: "error" });
        return;
      }
      setSheet(json.data.sheet);
      setModal({ type: "sheet", plan });
    } finally {
      setSaving(false);
    }
  }

  async function post(action: string, payload: Record<string, unknown>, successTitle: string) {
    setSaving(true);
    try {
      const res = await fetch("/api/assessments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, payload }),
      });
      const json = await res.json();
      if (!json.ok) {
        toast({ title: json.error?.message || "Assessment action failed", tone: "error" });
        return null;
      }
      toast({ title: successTitle, tone: "success" });
      await load();
      return json.data.result;
    } catch {
      toast({ title: "Could not reach the assessment endpoint", tone: "error" });
      return null;
    } finally {
      setSaving(false);
    }
  }

  const currentBoard = board ?? EMPTY_BOARD;

  if (!board && !error) return <AssessmentLoadingState />;
  if (error && currentBoard.plans.length === 0 && currentBoard.types.length === 0) return <AssessmentErrorState message={error} onRetry={load} />;

  return (
    <div className="space-y-5">
      <AssessmentEngineHero
        canManage={currentBoard.canManagePlans}
        onCreatePlan={() => setModal({ type: "plan" })}
        onSeedTypes={() => post("seed_default_types", {}, "Default assessment types loaded")}
      />
      {error ? <AssessmentErrorState message={error} onRetry={load} /> : null}
      <AssessmentSummaryGrid summary={currentBoard.summary} />

      {currentBoard.types.length === 0 && currentBoard.plans.length === 0 ? (
        <AssessmentEmptyState
          canManage={currentBoard.canManagePlans}
          onSeedTypes={() => post("seed_default_types", {}, "Default assessment types loaded")}
          onCreatePlan={() => setModal({ type: "plan" })}
        />
      ) : (
        <>
          <AssessmentTypeCatalog
            types={currentBoard.types}
            canManage={currentBoard.canManagePlans}
            onEditType={(assessmentType) => setModal({ type: "type", assessmentType })}
          />
          <div className="grid gap-4 xl:grid-cols-2">
            {currentBoard.plans.map((plan) => (
              <AssessmentPlanCard
                key={plan.id}
                plan={plan}
                canScore={currentBoard.canScore}
                canModerate={currentBoard.canModerate}
                canRelease={currentBoard.canRelease}
                onOpenSheet={(item) => loadSheet(item)}
                onRelease={(item) => setModal({ type: "release", plan: item })}
              />
            ))}
          </div>
          {currentBoard.plans.length === 0 ? (
            <AssessmentEmptyState canManage={currentBoard.canManagePlans} onCreatePlan={() => setModal({ type: "plan" })} />
          ) : null}
        </>
      )}

      {modal ? (
        <AssessmentModal title={modalTitle(modal)} icon={modalIcon(modal)} onClose={() => { setModal(null); setSheet(null); }}>
          {modal.type === "type" ? (
            <AssessmentTypeForm
              saving={saving}
              initial={modal.assessmentType ? {
                id: modal.assessmentType.id,
                key: modal.assessmentType.key,
                name: modal.assessmentType.name,
                description: modal.assessmentType.description ?? "",
                category: modal.assessmentType.category,
                scoreMode: modal.assessmentType.scoreMode,
                defaultMaxMarks: modal.assessmentType.defaultMaxMarks?.toString() ?? "",
                defaultWeight: modal.assessmentType.defaultWeight,
                evidenceAllowed: modal.assessmentType.evidenceAllowed,
                requiresModeration: modal.assessmentType.requiresModeration,
                active: modal.assessmentType.active,
              } : undefined}
              onCancel={() => setModal(null)}
              onSubmit={(draft) => post(draft.id ? "update_type" : "create_type", compactPayload({
                ...(draft.id ? { id: draft.id } : {}),
                key: draft.key,
                name: draft.name,
                description: draft.description,
                category: draft.category,
                scoreMode: draft.scoreMode,
                defaultMaxMarks: draft.defaultMaxMarks ? Number(draft.defaultMaxMarks) : undefined,
                defaultWeight: draft.defaultWeight,
                evidenceAllowed: draft.evidenceAllowed,
                requiresModeration: draft.requiresModeration,
                active: draft.active,
              }), draft.id ? "Assessment type saved" : "Assessment type created").then((ok) => ok ? setModal(null) : null)}
            />
          ) : null}

          {modal.type === "plan" ? (
            <AssessmentPlanForm
              types={currentBoard.types}
              saving={saving}
              onCancel={() => setModal(null)}
              onSubmit={(draft) => post(draft.id ? "update_plan" : "create_plan", compactPayload({
                ...(draft.id ? { id: draft.id } : {}),
                assessmentTypeId: draft.assessmentTypeId,
                title: draft.title,
                description: draft.description,
                instructions: draft.instructions,
                year: draft.year,
                term: draft.term,
                weight: draft.weight,
                maxMarks: draft.maxMarks ? Number(draft.maxMarks) : undefined,
                dueDate: draft.dueDate,
                classId: draft.classId,
                subjectId: draft.subjectId,
                learningAreaId: draft.learningAreaId,
                status: draft.status,
                visibleToParents: draft.visibleToParents,
              }), draft.id ? "Assessment plan saved" : "Assessment plan created").then((ok) => ok ? setModal(null) : null)}
            />
          ) : null}

          {modal.type === "sheet" && sheet ? (
            <div className="space-y-4">
              <AssessmentSheetTable sheet={sheet} canScore={currentBoard.canScore} onScoreStudent={(student) => setModal({ type: "score", sheet, student })} />
              <div className="flex justify-end"><Button variant="secondary" onClick={() => setModal(null)}>Close</Button></div>
            </div>
          ) : null}

          {modal.type === "score" ? (
            <RubricScoreWrapper
              student={modal.student}
              planId={modal.sheet.plan.id}
              saving={saving}
              onCancel={() => setModal({ type: "sheet", plan: modal.sheet.plan })}
              onDone={async () => {
                const refreshedPlan = currentBoard.plans.find((p) => p.id === modal.sheet.plan.id) ?? modal.sheet.plan;
                await loadSheet(refreshedPlan);
              }}
            />
          ) : null}

          {modal.type === "evidence" ? (
            <AssessmentEvidenceForm recordId={modal.recordId} saving={saving} onCancel={() => setModal(null)} onSubmit={(draft) => post("attach_evidence", compactPayload(draft), "Assessment evidence attached").then((ok) => ok ? setModal(null) : null)} />
          ) : null}

          {modal.type === "release" ? (
            <AssessmentReleasePanel plan={modal.plan} canRelease={currentBoard.canRelease} saving={saving} onRelease={(visibleToParents) => post("release_plan", { planId: modal.plan.id, visibleToParents }, "Assessment released").then((ok) => ok ? setModal(null) : null)} />
          ) : null}
        </AssessmentModal>
      ) : null}
    </div>
  );
}

function modalTitle(modal: NonNullable<ModalState>) {
  if (modal.type === "type") return modal.assessmentType ? "Edit assessment type" : "New assessment type";
  if (modal.type === "plan") return modal.plan ? "Edit assessment plan" : "New assessment plan";
  if (modal.type === "sheet") return "Assessment scoring sheet";
  if (modal.type === "score") return "Score learner";
  if (modal.type === "evidence") return "Attach evidence";
  return "Release assessment";
}
function modalIcon(modal: NonNullable<ModalState>): LucideIcon {
  if (modal.type === "type") return ClipboardList;
  if (modal.type === "plan") return ClipboardList;
  if (modal.type === "sheet") return GraduationCap;
  if (modal.type === "score") return GraduationCap;
  if (modal.type === "evidence") return FileCheck2;
  return ClipboardList;
}
function AssessmentModal({ title, icon: Icon, children, onClose }: { title: string; icon: LucideIcon; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-navy-950/35 p-3 backdrop-blur-md">
      <Card className="max-h-[min(92dvh,44rem)] w-full max-w-4xl overflow-hidden border-white/50 bg-white shadow-2xl backdrop-blur-xl dark:border-white/10 dark:bg-navy-900">
        <CardHeader className="sticky top-0 z-10 border-b border-navy-100 bg-white backdrop-blur-xl dark:border-navy-800 dark:bg-navy-900">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-200"><Icon className="h-5 w-5" /></span>
              <div><CardTitle>{title}</CardTitle><Badge tone="neutral" className="mt-1">Flexible Assessment Engine</Badge></div>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close"><X className="h-4 w-4" /></Button>
          </div>
        </CardHeader>
        <CardContent className="max-h-[calc(min(92dvh,44rem)-6rem)] overflow-y-auto p-5 sm:p-6">{children}</CardContent>
      </Card>
    </div>
  );
}

function RubricScoreWrapper({ student, planId, saving, onCancel, onDone }: {
  student: AssessmentSheetStudentView;
  planId: string;
  saving: boolean;
  onCancel: () => void;
  onDone: () => void;
}) {
  const { toast } = useToast();
  const [rubrics, setRubrics] = React.useState<RubricView[]>([]);
  const [selectedId, setSelectedId] = React.useState<string>("");
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    fetch("/api/rubrics")
      .then((r) => r.json())
      .then((json) => {
        if (json.ok && json.data?.board?.rubrics) {
          setRubrics(json.data.board.rubrics);
          if (json.data.board.rubrics.length > 0) setSelectedId(json.data.board.rubrics[0].id);
        }
      })
      .catch(() => {});
  }, []);

  const activeRubric = rubrics.find((r) => r.id === selectedId);

  async function handleScore(data: { rubricLevel: number; rubricCode: string; points: number | null; narrative: string }) {
    setBusy(true);
    try {
      let targetId = student.record?.id;
      if (!targetId) {
        const r1 = await fetch("/api/assessments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "score_record", payload: { planId, studentId: student.id, rubricLevel: data.rubricLevel, rubricCode: data.rubricCode, narrative: data.narrative } }),
        });
        const j1 = await r1.json();
        if (j1.ok && j1.data?.result?.id) targetId = j1.data.result.id;
      }
      if (targetId) {
        const res = await fetch("/api/rubrics", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "score_with_rubric", payload: { targetType: "assessment_record", targetId, rubricId: selectedId, rubricLevel: data.rubricLevel, rubricCode: data.rubricCode, points: data.points ?? undefined, narrative: data.narrative } }),
        });
        const json = await res.json();
        if (json.ok) {
          toast({ title: "Rubric evaluation saved", tone: "success" });
          onDone();
        } else {
          toast({ title: json.error?.message || "Rubric scoring failed", tone: "error" });
        }
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {rubrics.length > 0 && (
        <div className="space-y-1.5 border-b border-navy-100 pb-4 dark:border-navy-800">
          <label className="text-sm font-semibold">Evaluation Mode</label>
          <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)} className="w-full rounded-2xl border border-navy-200 bg-white p-2.5 text-sm dark:border-navy-700 dark:bg-navy-900">
            <option value="">Standard manual score form</option>
            {rubrics.map((r) => <option key={r.id} value={r.id}>Rubric: {r.name}</option>)}
          </select>
        </div>
      )}

      {activeRubric ? (
        <TeacherRubricScoringPanel
          rubric={activeRubric}
          onScore={handleScore}
          saving={busy || saving}
          initialLevel={student.record?.rubricLevel ?? undefined}
          initialCode={student.record?.rubricCode ?? undefined}
          initialNarrative={student.record?.narrative ?? undefined}
        />
      ) : (
        <AssessmentScoreForm
          student={student}
          planId={planId}
          initial={student.record}
          saving={saving}
          onCancel={onCancel}
          onSubmit={(draft) => {
            fetch("/api/assessments", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "score_record", payload: { planId, studentId: student.id, scoreMarks: draft.scoreMarks ? Number(draft.scoreMarks) : undefined, scorePct: draft.scorePct ? Number(draft.scorePct) : undefined, rubricLevel: draft.rubricLevel ? Number(draft.rubricLevel) : undefined, rubricCode: draft.rubricCode, narrative: draft.narrative } }),
            }).then(() => onDone());
          }}
        />
      )}
    </div>
  );
}
