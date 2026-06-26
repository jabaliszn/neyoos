/**
 * B.3.8 attendance analytics — trend, per-class today, chronic absentees,
 * anomaly flags. Permission: attendance.view (leaders/teachers).
 */
import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/core/session";
import { ok, handleError } from "@/lib/api/respond";
import { attendanceAnalytics } from "@/lib/services/staff-attendance.service";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const user = await requirePermission("attendance.view");
    const days = Math.min(Math.max(Number(req.nextUrl.searchParams.get("days") ?? 14), 7), 60);
    return ok(await attendanceAnalytics(user, days));
  } catch (e) {
    return handleError(e);
  }
}
