import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/core/session";
import { ok, handleError } from "@/lib/api/respond";
import { scanForAttendance } from "@/lib/services/qr-scan.service";

export const dynamic = "force-dynamic";

/**
 * POST /api/qr-scan/attendance — N.2 1-Tap Attendance: scanning a student's
 * ID QR marks today's register instantly. Permission: attendance.record
 * (same as the manual register). Strict duplicate-scan guard is enforced in
 * the service layer (real HTTP 409 on a repeat scan within the cooldown).
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission("attendance.record");
    const body = await req.json().catch(() => ({}));
    const scanned = String(body.scanned ?? "");
    const status = body.status === "L" ? "L" : "P";
    const result = await scanForAttendance(user, scanned, status);
    return ok({ result });
  } catch (err) {
    return handleError(err);
  }
}
