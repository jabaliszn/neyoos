/**
 * PART J.2 — Curriculum Engine API.
 *
 * GET  /api/curriculum
 *   Returns the tenant curriculum board for signed-in users who may read it.
 *
 * POST /api/curriculum
 *   Runs one validated curriculum action. The service enforces whether the user
 *   may manage curriculum setup (`academics.manage` or `tenant.manage_settings`).
 */
import { NextRequest } from "next/server";
import { requireUser } from "@/lib/core/session";
import { ok, handleError } from "@/lib/api/respond";
import { curriculumActionSchema } from "@/lib/validations/curriculum";
import {
  curriculumBoard,
  createCurriculum,
  updateCurriculum,
  createEducationLevel,
  updateEducationLevel,
  createGradeBand,
  updateGradeBand,
  createLearningArea,
  updateLearningArea,
  mapExistingCurriculumRecords,
  runCurriculumMigrationAssistant,
} from "@/lib/services/curriculum.service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireUser();
    return ok({ board: await curriculumBoard(user) });
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = await req.json();
    const input = curriculumActionSchema.parse(body);

    switch (input.action) {
      case "create_curriculum":
        return ok({ result: await createCurriculum(user, input.payload) });
      case "update_curriculum":
        return ok({ result: await updateCurriculum(user, input.payload) });
      case "create_level":
        return ok({ result: await createEducationLevel(user, input.payload) });
      case "update_level":
        return ok({ result: await updateEducationLevel(user, input.payload) });
      case "create_grade_band":
        return ok({ result: await createGradeBand(user, input.payload) });
      case "update_grade_band":
        return ok({ result: await updateGradeBand(user, input.payload) });
      case "create_learning_area":
        return ok({ result: await createLearningArea(user, input.payload) });
      case "update_learning_area":
        return ok({ result: await updateLearningArea(user, input.payload) });
      case "map_existing_records":
        return ok({ result: await mapExistingCurriculumRecords(user, input.payload) });
      case "run_migration_assistant":
        return ok({ result: await runCurriculumMigrationAssistant(user) });
      default: {
        const _exhaustive: never = input;
        return ok({ result: _exhaustive });
      }
    }
  } catch (error) {
    return handleError(error);
  }
}
