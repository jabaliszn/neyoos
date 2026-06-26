/**
 * B.13 Homework submissions — teacher side.
 * GET  /api/lms/submissions?homeworkId=  — roster + submission status (scoped)
 * POST /api/lms/submissions               {action:"grade", submissionId, gradePct, feedback?}
 * Permission: homework.assign.
 */
import { NextRequest } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/core/session";
import { ok, handleError, fail } from "@/lib/api/respond";
import { gradeSchema } from "@/lib/validations/lms";
import { submissionsForHomework, gradeSubmission } from "@/lib/services/lms.service";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const user = await requirePermission("homework.assign");
    const homeworkId = req.nextUrl.searchParams.get("homeworkId");
    if (!homeworkId) return fail("MISSING", "homeworkId required.", 400);
    return ok(await submissionsForHomework(user, homeworkId));
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission("homework.assign");
    const input = z.object({ action: z.literal("grade") }).and(gradeSchema).parse(await req.json());
    return ok(await gradeSubmission(user, input));
  } catch (e) {
    return handleError(e);
  }
}
