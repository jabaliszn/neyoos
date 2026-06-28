"use client";

/**
 * PART J.5 — connected Rubrics & Evidence Engine client.
 * Fetches the real `/api/rubrics` endpoint and posts validated actions to it.
 */
import * as React from "react";
import { useToast } from "@/components/ui/toast";
import {
  RubricHero,
  RubricSummaryGrid,
  RubricLoadingState,
  RubricErrorState,
  RubricEmptyState,
  RubricCard,
  RubricForm,
  type RubricView,
} from "@/components/rubrics/rubric-components";

interface RubricBoardView {
  canManage: boolean;
  canScore: boolean;
  rubrics: RubricView[];
  archivedRubrics: RubricView[];
  summary: {
    total: number;
    active: number;
    archived: number;
  };
}

const EMPTY_BOARD: RubricBoardView = {
  canManage: false,
  canScore: false,
  rubrics: [],
  archivedRubrics: [],
  summary: { total: 0, active: 0, archived: 0 },
};

type ModalState =
  | { type: "new" }
  | { type: "edit"; rubric: RubricView }
  | null;

export function RubricEngineClient() {
  const { toast } = useToast();
  const [board, setBoard] = React.useState<RubricBoardView | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [modal, setModal] = React.useState<ModalState>(null);
  const [saving, setSaving] = React.useState(false);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/rubrics", { cache: "no-store" });
      const json = await res.json();
      if (!json.ok) {
        setError(json.error?.message || "Rubric framework could not load.");
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

  async function post(action: string, payload: Record<string, unknown>, successTitle: string, targetId?: string) {
    if (targetId) setBusyId(targetId);
    else setSaving(true);
    try {
      const res = await fetch("/api/rubrics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, payload }),
      });
      const json = await res.json();
      if (!json.ok) {
        toast({ title: json.error?.message || "Rubric update failed", tone: "error" });
        return;
      }
      toast({ title: successTitle, tone: "success" });
      setModal(null);
      await load();
    } catch {
      toast({ title: "Could not reach the rubric endpoint", tone: "error" });
    } finally {
      if (targetId) setBusyId(null);
      else setSaving(false);
    }
  }

  const currentBoard = board ?? EMPTY_BOARD;

  if (!board && !error) return <RubricLoadingState />;
  if (error && currentBoard.rubrics.length === 0 && currentBoard.archivedRubrics.length === 0) {
    return <RubricErrorState onRetry={load} />;
  }

  return (
    <div className="space-y-6">
      <RubricHero
        canManage={currentBoard.canManage}
        onSeedDefaults={() => post("seed_defaults", {}, "Default rubrics seeded")}
        onNewRubric={() => setModal({ type: "new" })}
        seeding={saving}
      />
      {error ? <RubricErrorState onRetry={load} /> : null}

      {currentBoard.rubrics.length === 0 && currentBoard.archivedRubrics.length === 0 ? (
        <RubricEmptyState
          canManage={currentBoard.canManage}
          onSeedDefaults={() => post("seed_defaults", {}, "Default rubrics seeded")}
          onNewRubric={() => setModal({ type: "new" })}
        />
      ) : (
        <>
          <RubricSummaryGrid
            total={currentBoard.summary.total}
            active={currentBoard.summary.active}
            archived={currentBoard.summary.archived}
          />

          <div className="space-y-4">
            <h2 className="text-lg font-bold text-navy-900 dark:text-navy-50">Active Rubrics</h2>
            {currentBoard.rubrics.length === 0 ? (
              <p className="text-sm text-navy-500 dark:text-navy-400">No active rubrics. Create one or restore from the archive.</p>
            ) : (
              <div className="grid gap-6 xl:grid-cols-2">
                {currentBoard.rubrics.map((r) => (
                  <RubricCard
                    key={r.id}
                    rubric={r}
                    canManage={currentBoard.canManage}
                    onEdit={() => setModal({ type: "edit", rubric: r })}
                    onToggleArchive={() => post("archive_rubric", { id: r.id, isArchived: true }, "Rubric archived", r.id)}
                    busy={busyId === r.id}
                  />
                ))}
              </div>
            )}
          </div>

          {currentBoard.archivedRubrics.length > 0 && (
            <div className="space-y-4 pt-6 border-t border-navy-100 dark:border-navy-800">
              <h2 className="text-lg font-bold text-navy-500 dark:text-navy-400">Archived Rubrics</h2>
              <div className="grid gap-6 xl:grid-cols-2">
                {currentBoard.archivedRubrics.map((r) => (
                  <RubricCard
                    key={r.id}
                    rubric={r}
                    canManage={currentBoard.canManage}
                    onEdit={() => setModal({ type: "edit", rubric: r })}
                    onToggleArchive={() => post("archive_rubric", { id: r.id, isArchived: false }, "Rubric restored", r.id)}
                    busy={busyId === r.id}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {modal ? (
        <RubricForm
          initial={modal.type === "edit" ? modal.rubric : undefined}
          saving={saving}
          onClose={() => setModal(null)}
          onSubmit={(draft) => post(
            modal.type === "edit" ? "update_rubric" : "create_rubric",
            {
              ...(modal.type === "edit" ? { id: modal.rubric.id } : {}),
              name: draft.name,
              description: draft.description,
              category: draft.category,
              isArchived: draft.isArchived,
              levels: draft.levels,
            },
            modal.type === "edit" ? "Rubric definition saved" : "Rubric created"
          )}
        />
      ) : null}
    </div>
  );
}
