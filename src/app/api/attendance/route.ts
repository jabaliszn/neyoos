/**
 * B.3 Attendance.
 * GET  /api/attendance?date=YYYY-MM-DD              -> per-class overview
 * GET  /api/attendance?classId=&date=               -> full register
 * POST /api/attendance                              -> mark register (idempotent;
 *      offline-safe: accepts Idempotency-Key replays because upserts are per
 *      student+day — replaying the same payload is a no-op).
 */
import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/core/session";
import { ok, handleError } from "@/lib/api/respond";
import { markRegisterSchema, registerQuerySchema } from "@/lib/validations/attendance";
import { getRegister, markRegister, attendanceOverview, nairobiToday } from "@/lib/services/attendance.service";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const user = await requirePermission("attendance.view");
    const sp = req.nextUrl.searchParams;
    const date = sp.get("date") || nairobiToday();
    const classId = sp.get("classId");
    if (classId) {
      const q = registerQuerySchema.parse({ classId, date });
      return ok(await getRegister(user, q.classId, q.date));
    }
    return ok(await attendanceOverview(user, date));
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission("attendance.record");
    const body = markRegisterSchema.parse(await req.json());
    return ok(await markRegister(user, body));
  } catch (e) {
    return handleError(e);
  }
}
