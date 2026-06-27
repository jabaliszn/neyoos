/**
 * PART J.3 — Flexible Assessment Engine API.
 *
 * GET  /api/assessments
 *   Returns the assessment board visible to the signed-in user.
 *
 * GET  /api/assessments?planId=...
 *   Returns a scoring sheet for one assessment plan.
 *
 * POST /api/assessments
 *   Runs one validated assessment action against the real Prisma service.
 */
import { NextRequest } from "next/server";
import { requireUser } from "@/lib/core/session";
import { ok, handleError } from "@/lib/api/respond";
import { assessmentActionSchema } from "@/lib/validations/assessment";
import {
  assessmentBoard,
  assessmentSheet,
  attachAssessmentEvidence,
  createAssessmentPlan,
  createAssessmentType,
  ensureDefaultAssessmentTypes,
  moderateAssessmentRecord,
  releaseAssessmentPlan,
  scoreAssessmentRecord,
  updateAssessmentPlan,
  updateAssessmentRecord,
  updateAssessmentType,
} from "@/lib/services/assessment.service";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    const planId = req.nextUrl.searchParams.get("planId");
    if (planId) return ok({ sheet: await assessmentSheet(user, planId) });
    return ok({ board: await assessmentBoard(user) });
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = await req.json();
    const input = assessmentActionSchema.parse(body);

    switch (input.action) {
      case "seed_default_types":
        return ok({ result: await ensureDefaultAssessmentTypes(user) });
      case "create_type":
        return ok({ result: await createAssessmentType(user, input.payload) });
      case "update_type":
        return ok({ result: await updateAssessmentType(user, input.payload) });
      case "create_plan":
        return ok({ result: await createAssessmentPlan(user, input.payload) });
      case "update_plan":
        return ok({ result: await updateAssessmentPlan(user, input.payload) });
      case "score_record":
        return ok({ result: await scoreAssessmentRecord(user, input.payload) });
      case "update_record":
        return ok({ result: await updateAssessmentRecord(user, input.payload) });
      case "attach_evidence":
        return ok({ result: await attachAssessmentEvidence(user, input.payload) });
      case "moderate_record":
        return ok({ result: await moderateAssessmentRecord(user, input.payload) });
      case "release_plan":
        return ok({ result: await releaseAssessmentPlan(user, input.payload) });
      default: {
        const _exhaustive: never = input;
        return ok({ result: _exhaustive });
      }
    }
  } catch (error) {
    return handleError(error);
  }
}
