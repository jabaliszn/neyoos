/**
 * PART J.4 — Competency Framework API.
 *
 * GET /api/competencies
 *   Returns competency framework board.
 * GET /api/competencies?studentId=...
 *   Returns row-scoped learner competency summary.
 * GET /api/competencies?heatmap=1&classId=...
 *   Returns class/cohort competency heatmap foundation.
 * POST /api/competencies
 *   Runs one validated competency action.
 */
import { NextRequest } from "next/server";
import { requireUser } from "@/lib/core/session";
import { ok, handleError } from "@/lib/api/respond";
import { competencyActionSchema } from "@/lib/validations/competency";
import {
  approveCompetencyEvidence,
  competencyBoard,
  competencyHeatmap,
  createCompetency,
  createCompetencyGroup,
  ensureDefaultCompetencyFramework,
  recordCompetencyEvidence,
  studentCompetencySummary,
  updateCompetency,
  updateCompetencyEvidence,
  updateCompetencyGroup,
} from "@/lib/services/competency.service";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    const studentId = req.nextUrl.searchParams.get("studentId");
    if (studentId) return ok({ summary: await studentCompetencySummary(user, studentId) });
    if (req.nextUrl.searchParams.get("heatmap") === "1") {
      return ok({ heatmap: await competencyHeatmap(user, { classId: req.nextUrl.searchParams.get("classId") || undefined }) });
    }
    return ok({ board: await competencyBoard(user) });
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const input = competencyActionSchema.parse(await req.json());
    switch (input.action) {
      case "seed_defaults":
        return ok({ result: await ensureDefaultCompetencyFramework(user) });
      case "create_group":
        return ok({ result: await createCompetencyGroup(user, input.payload) });
      case "update_group":
        return ok({ result: await updateCompetencyGroup(user, input.payload) });
      case "create_competency":
        return ok({ result: await createCompetency(user, input.payload) });
      case "update_competency":
        return ok({ result: await updateCompetency(user, input.payload) });
      case "record_evidence":
        return ok({ result: await recordCompetencyEvidence(user, input.payload) });
      case "update_evidence":
        return ok({ result: await updateCompetencyEvidence(user, input.payload) });
      case "approve_evidence":
        return ok({ result: await approveCompetencyEvidence(user, input.payload) });
      default: {
        const _exhaustive: never = input;
        return ok({ result: _exhaustive });
      }
    }
  } catch (error) {
    return handleError(error);
  }
}
