/**
 * J.12 — observations recorded directly from a lesson plan.
 * GET  ?lessonPlanId=  list observations (own-scoped for teachers).
 * POST create one observation.
 */
import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/core/session";
import { ok, fail, handleError } from "@/lib/api/respond";
import { lessonObservationSchema } from "@/lib/validations/academics";
import { recordLessonObservation, listLessonObservations } from "@/lib/services/academics.service";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const user = await requirePermission("academics.view");
    const lessonPlanId = req.nextUrl.searchParams.get("lessonPlanId");
    if (!lessonPlanId) return fail("MISSING_ID", "lessonPlanId required.", 400);
    return ok({ observations: await listLessonObservations(user, lessonPlanId) });
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission("academics.view"); // teachers have view; own-scoped in service
    const input = lessonObservationSchema.parse(await req.json());
    return ok(await recordLessonObservation(user, input));
  } catch (e) {
    return handleError(e);
  }
}
