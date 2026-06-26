/**
 * B.3 Attendance history (per student / class / date range). Row-scoped.
 * GET /api/attendance/history?studentId=&classId=&from=&to=
 */
import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/core/session";
import { ok, handleError } from "@/lib/api/respond";
import { historyQuerySchema } from "@/lib/validations/attendance";
import { attendanceHistory } from "@/lib/services/attendance.service";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const user = await requirePermission("attendance.view");
    const sp = req.nextUrl.searchParams;
    const q = historyQuerySchema.parse({
      studentId: sp.get("studentId") || undefined,
      classId: sp.get("classId") || undefined,
      from: sp.get("from") || undefined,
      to: sp.get("to") || undefined,
    });
    return ok({ records: await attendanceHistory(user, q) });
  } catch (e) {
    return handleError(e);
  }
}
