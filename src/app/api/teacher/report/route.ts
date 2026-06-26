/**
 * B.12 Per-class report API.
 * GET /api/teacher/report?classId= — roster + 30-day attendance + latest exam,
 * restricted to the teacher's own classes (fail-closed).
 */
import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/core/session";
import { ok, handleError, fail } from "@/lib/api/respond";
import { classReport } from "@/lib/services/teacher-portal.service";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const user = await requirePermission("portal.teacher");
    const classId = req.nextUrl.searchParams.get("classId");
    if (!classId) return fail("MISSING", "classId required.", 400);
    return ok(await classReport(user, classId));
  } catch (e) {
    return handleError(e);
  }
}
