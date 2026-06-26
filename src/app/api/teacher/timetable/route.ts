/**
 * B.12 "View own timetable" API.
 * GET /api/teacher/timetable — the signed-in teacher's weekly slots
 * (reuses B.4 teacherTimetable()).
 */
import { requirePermission } from "@/lib/core/session";
import { ok, handleError } from "@/lib/api/respond";
import { teacherTimetable } from "@/lib/services/academics.service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requirePermission("portal.teacher");
    return ok({ slots: await teacherTimetable(user, user.id) });
  } catch (e) {
    return handleError(e);
  }
}
