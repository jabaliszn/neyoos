/**
 * B.12 Teacher Portal home API.
 * GET /api/teacher — my classes (roster counts, subjects I teach, open
 * homework) + today's lessons from my timetable.
 * Permission: portal.teacher (TEACHER/CLASS_TEACHER/HOD/DEAN; leadership via SUPER).
 */
import { requirePermission } from "@/lib/core/session";
import { ok, handleError } from "@/lib/api/respond";
import { teacherHome } from "@/lib/services/teacher-portal.service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requirePermission("portal.teacher");
    return ok(await teacherHome(user));
  } catch (e) {
    return handleError(e);
  }
}
