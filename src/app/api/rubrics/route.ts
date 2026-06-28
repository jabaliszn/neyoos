/**
 * PART J.5 — Rubrics & Evidence API.
 *
 * GET /api/rubrics
 *   Returns active rubrics board, archive list and role permission flags.
 * POST /api/rubrics
 *   Runs one validated rubric action (create, update, archive, attach, score, evidence).
 */
import { NextRequest } from "next/server";
import { requireUser } from "@/lib/core/session";
import { ok, handleError } from "@/lib/api/respond";
import { rubricActionSchema } from "@/lib/validations/rubric";
import {
  ensureDefaultRubrics,
  rubricBoard,
  createRubric,
  updateRubric,
  archiveRubric,
  attachRubric,
  scoreWithRubric,
  attachEvidenceFile,
} from "@/lib/services/rubric.service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireUser();
    return ok({ board: await rubricBoard(user) });
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const input = rubricActionSchema.parse(await req.json());
    switch (input.action) {
      case "seed_defaults":
        return ok({ result: await ensureDefaultRubrics(user) });
      case "create_rubric":
        return ok({ result: await createRubric(user, input.payload) });
      case "update_rubric":
        return ok({ result: await updateRubric(user, input.payload) });
      case "archive_rubric":
        return ok({ result: await archiveRubric(user, input.payload.id, input.payload.isArchived) });
      case "attach_rubric":
        return ok({ result: await attachRubric(user, input.payload) });
      case "score_with_rubric":
        return ok({ result: await scoreWithRubric(user, input.payload) });
      case "attach_evidence_file":
        return ok({ result: await attachEvidenceFile(user, input.payload) });
      default: {
        const _exhaustive: never = input;
        return ok({ result: _exhaustive });
      }
    }
  } catch (error) {
    return handleError(error);
  }
}
