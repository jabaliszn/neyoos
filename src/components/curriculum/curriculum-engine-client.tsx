"use client";

/**
 * PART J.2 — connected Curriculum Engine client.
 * Fetches the real `/api/curriculum` endpoint and posts validated actions to it.
 */
import * as React from "react";
import { Compass, GraduationCap, Layers, School, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import {
  CurriculumEmptyState,
  CurriculumEngineHero,
  CurriculumErrorState,
  CurriculumForm,
  CurriculumLoadingState,
  CurriculumMappingPanel,
  CurriculumMappingReviewTable,
  CurriculumStructureCard,
  CurriculumSummaryGrid,
  EducationLevelForm,
  GradeBandForm,
  LearningAreaForm,
  type CurriculumBoardView,
  type CurriculumView,
} from "@/components/curriculum/curriculum-engine-components";

const EMPTY_BOARD: CurriculumBoardView = {
  canManage: false,
  curricula: [],
  summary: {
    curricula: 0,
    educationLevels: 0,
    gradeBands: 0,
    learningAreas: 0,
    unmappedSubjects: 0,
    unmappedClasses: 0,
    unmappedTerms: 0,
  },
  mappings: { subjects: [], classes: [], terms: [], strands: [] },
};

type ModalState =
  | { type: "curriculum"; curriculum?: CurriculumView }
  | { type: "level"; curriculum?: CurriculumView }
  | { type: "grade"; curriculum?: CurriculumView }
  | { type: "area"; curriculum?: CurriculumView }
  | { type: "mapping" }
  | null;

export function CurriculumEngineClient() {
  const { toast } = useToast();
  const [board, setBoard] = React.useState<CurriculumBoardView | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [modal, setModal] = React.useState<ModalState>(null);
  const [saving, setSaving] = React.useState(false);

  const load = React.useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/curriculum", { cache: "no-store" });
      const json = await res.json();
      if (!json.ok) {
        setError(json.error?.message || "Curriculum setup could not load.");
        setBoard(EMPTY_BOARD);
        return;
      }
      setBoard(json.data.board);
    } catch {
      setError("Check your connection and try again.");
      setBoard(EMPTY_BOARD);
    }
  }, []);

  React.useEffect(() => { void load(); }, [load]);

  async function post(action: string, payload: Record<string, unknown>, successTitle: string) {
    setSaving(true);
    try {
      const res = await fetch("/api/curriculum", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, payload }),
      });
      const json = await res.json();
      if (!json.ok) {
        toast({ title: json.error?.message || "Curriculum update failed", tone: "error" });
        return;
      }
      toast({ title: successTitle, tone: "success" });
      setModal(null);
      await load();
    } catch {
      toast({ title: "Could not reach the curriculum endpoint", tone: "error" });
    } finally {
      setSaving(false);
    }
  }

  const currentBoard = board ?? EMPTY_BOARD;

  if (!board && !error) return <CurriculumLoadingState />;
  if (error && currentBoard.curricula.length === 0) return <CurriculumErrorState message={error} onRetry={load} />;

  return (
    <div className="space-y-5">
      <CurriculumEngineHero canManage={currentBoard.canManage} onCreateCurriculum={() => setModal({ type: "curriculum" })} />
      {error ? <CurriculumErrorState message={error} onRetry={load} /> : null}

      {currentBoard.curricula.length === 0 ? (
        <CurriculumEmptyState canManage={currentBoard.canManage} onCreateCurriculum={() => setModal({ type: "curriculum" })} />
      ) : (
        <>
          <CurriculumSummaryGrid summary={currentBoard.summary} />
          <CurriculumMappingPanel board={currentBoard} onOpenMapping={() => setModal({ type: "mapping" })} />
          <div className="grid gap-4 xl:grid-cols-2">
            {currentBoard.curricula.map((curriculum) => (
              <CurriculumStructureCard
                key={curriculum.id}
                curriculum={curriculum}
                canManage={currentBoard.canManage}
                onEditCurriculum={(item) => setModal({ type: "curriculum", curriculum: item })}
                onAddLevel={(item) => setModal({ type: "level", curriculum: item })}
                onAddGradeBand={(item) => setModal({ type: "grade", curriculum: item })}
                onAddLearningArea={(item) => setModal({ type: "area", curriculum: item })}
              />
            ))}
          </div>
        </>
      )}

      {modal ? (
        <CurriculumModal title={modalTitle(modal)} icon={modalIcon(modal)} onClose={() => setModal(null)}>
          {modal.type === "curriculum" ? (
            <CurriculumForm
              saving={saving}
              initial={modal.curriculum ? {
                id: modal.curriculum.id,
                name: modal.curriculum.name,
                country: modal.curriculum.country,
                context: modal.curriculum.context ?? "",
                activeVersion: modal.curriculum.activeVersion,
                effectiveFrom: modal.curriculum.effectiveFrom ?? "",
                effectiveTo: modal.curriculum.effectiveTo ?? "",
                isActive: modal.curriculum.isActive,
                notes: modal.curriculum.notes ?? "",
              } : undefined}
              onCancel={() => setModal(null)}
              onSubmit={(draft) => post(
                draft.id ? "update_curriculum" : "create_curriculum",
                {
                  ...(draft.id ? { id: draft.id } : {}),
                  name: draft.name,
                  country: draft.country,
                  context: draft.context,
                  activeVersion: draft.activeVersion,
                  effectiveFrom: draft.effectiveFrom,
                  effectiveTo: draft.effectiveTo,
                  isActive: draft.isActive,
                  notes: draft.notes,
                },
                draft.id ? "Curriculum saved" : "Curriculum created"
              )}
            />
          ) : null}

          {modal.type === "level" ? (
            <EducationLevelForm
              curricula={currentBoard.curricula}
              saving={saving}
              initial={{ curriculumId: modal.curriculum?.id }}
              onCancel={() => setModal(null)}
              onSubmit={(draft) => post("create_level", draft, "Education level created")}
            />
          ) : null}

          {modal.type === "grade" ? (
            <GradeBandForm
              curricula={currentBoard.curricula}
              saving={saving}
              initial={{ curriculumId: modal.curriculum?.id }}
              onCancel={() => setModal(null)}
              onSubmit={(draft) => post("create_grade_band", {
                curriculumId: draft.curriculumId,
                educationLevelId: draft.educationLevelId,
                name: draft.name,
                shortName: draft.shortName,
                sequence: draft.sequence,
                entryAge: draft.entryAge === "" ? undefined : Number(draft.entryAge),
                exitAge: draft.exitAge === "" ? undefined : Number(draft.exitAge),
              }, "Grade band created")}
            />
          ) : null}

          {modal.type === "area" ? (
            <LearningAreaForm
              curricula={currentBoard.curricula}
              saving={saving}
              initial={{ curriculumId: modal.curriculum?.id }}
              onCancel={() => setModal(null)}
              onSubmit={(draft) => post("create_learning_area", draft, "Learning area created")}
            />
          ) : null}

          {modal.type === "mapping" ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-green-100 bg-green-50/80 p-4 text-sm leading-6 text-green-900 dark:border-green-900/40 dark:bg-green-950/30 dark:text-green-100">
                Existing subjects, classes, terms and strands are listed here so the school can see what still needs mapping. The automatic migration assistant arrives in the next seed/migration chunk; nothing is duplicated.
              </div>
              <CurriculumMappingReviewTable board={currentBoard} />
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button variant="secondary" onClick={() => setModal(null)}>Close</Button>
                {currentBoard.canManage ? (
                  <Button
                    disabled={saving}
                    onClick={() => post("run_migration_assistant", {}, "Curriculum migration assistant completed")}
                  >
                    {saving ? "Running…" : "Run migration assistant"}
                  </Button>
                ) : null}
              </div>
            </div>
          ) : null}
        </CurriculumModal>
      ) : null}
    </div>
  );
}

function modalTitle(modal: NonNullable<ModalState>) {
  if (modal.type === "curriculum") return modal.curriculum ? "Edit curriculum" : "New curriculum";
  if (modal.type === "level") return "New education level";
  if (modal.type === "grade") return "New grade band";
  if (modal.type === "area") return "New learning area";
  return "Existing records mapping";
}

function modalIcon(modal: NonNullable<ModalState>) {
  if (modal.type === "curriculum") return Compass;
  if (modal.type === "level") return School;
  if (modal.type === "grade") return GraduationCap;
  if (modal.type === "area") return Layers;
  return Compass;
}

function CurriculumModal({ title, icon: Icon, children, onClose }: { title: string; icon: typeof Compass; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-navy-950/35 p-3 backdrop-blur-md">
      <Card className="max-h-[min(92dvh,44rem)] w-full max-w-2xl overflow-hidden border-white/50 bg-white/95 shadow-2xl backdrop-blur-xl dark:border-white/10 dark:bg-navy-950/95">
        <CardHeader className="sticky top-0 z-10 border-b border-navy-100 bg-white/90 backdrop-blur-xl dark:border-navy-800 dark:bg-navy-950/90">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-200"><Icon className="h-5 w-5" /></span>
              <div>
                <CardTitle>{title}</CardTitle>
                <Badge tone="neutral" className="mt-1">Curriculum Engine</Badge>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close"><X className="h-4 w-4" /></Button>
          </div>
        </CardHeader>
        <CardContent className="max-h-[calc(min(92dvh,44rem)-6rem)] overflow-y-auto p-5 sm:p-6">
          {children}
        </CardContent>
      </Card>
    </div>
  );
}
