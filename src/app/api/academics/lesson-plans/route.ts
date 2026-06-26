/**
 * B.4 lesson plans. GET own/all (academics.view) · POST create (teachers) ·
 * PATCH ?id= status. Teachers are scoped to their own plans in the service.
 */
import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/core/session";
import { ok, handleError, fail } from "@/lib/api/respond";
import { lessonPlanSchema, lessonStatusSchema } from "@/lib/validations/academics";
import { listLessonPlans, createLessonPlan, setLessonStatus } from "@/lib/services/academics.service";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const user = await requirePermission("academics.view");
    const sp = req.nextUrl.searchParams;
    return ok({
      plans: await listLessonPlans(user, {
        classId: sp.get("classId") || undefined,
        from: sp.get("from") || undefined,
        to: sp.get("to") || undefined,
      }),
    });
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission("academics.view"); // teachers have view; creation is own-scoped
    const input = lessonPlanSchema.parse(await req.json());
    return ok(await createLessonPlan(user, input));
  } catch (e) {
    return handleError(e);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await requirePermission("academics.view");
    const id = req.nextUrl.searchParams.get("id");
    if (!id) return fail("MISSING_ID", "Lesson plan id required.", 400);
    const { status } = lessonStatusSchema.parse(await req.json());
    return ok(await setLessonStatus(user, id, status));
  } catch (e) {
    return handleError(e);
  }
}
